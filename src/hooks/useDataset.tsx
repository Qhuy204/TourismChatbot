import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DatasetRecord, DatasetStats } from '@/types/dataset';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { toast } from 'sonner';
import { validateDatasetRecords } from '@/lib/validation';
import { mapErrorToUserMessage } from '@/lib/errorMessages';

// Global cache to persist data across component mounts
let globalRecordsCache: DatasetRecord[] | null = null;
let globalTotalCount: number | null = null;
let globalStatsCache: DatasetStats | null = null;
let lastFetchTime: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useDataset() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [records, setRecords] = useState<DatasetRecord[]>(globalRecordsCache || []);
  const [loading, setLoading] = useState(globalRecordsCache === null);
  const [totalCount, setTotalCount] = useState(globalTotalCount || 0);
  const [statsFromDB, setStatsFromDB] = useState<DatasetStats | null>(globalStatsCache);
  const [loadedCount, setLoadedCount] = useState(globalRecordsCache?.length || 0);
  const isLoadingMore = useRef(false);
  const hasInitialized = useRef(false);

  // Calculate batch size (5% of total or minimum 100)
  const getBatchSize = useCallback((total: number) => {
    return Math.max(100, Math.ceil(total * 0.05));
  }, []);

  // Fetch initial batch and stats
  const fetchInitialRecords = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    // Use cache if available and not expired
    const now = Date.now();
    if (!forceRefresh && globalRecordsCache && lastFetchTime && (now - lastFetchTime < CACHE_DURATION)) {
      setRecords(globalRecordsCache);
      setTotalCount(globalTotalCount || 0);
      setStatsFromDB(globalStatsCache);
      setLoadedCount(globalRecordsCache.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get total count first
      const { count: total, error: countError } = await supabase
        .from('dataset_records')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Error getting count:', countError);
        return;
      }

      const totalRecords = total || 0;
      setTotalCount(totalRecords);
      globalTotalCount = totalRecords;

      // Get counts by status for accurate stats
      const [pendingRes, approvedRes, rejectedRes, needsReviewRes] = await Promise.all([
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'needs_review'),
      ]);

      const stats: DatasetStats = {
        total: totalRecords,
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
        needs_review: needsReviewRes.count || 0,
        qa_types: { ask_image: 0, ask_audio: 0, ask_both: 0 },
      };
      setStatsFromDB(stats);
      globalStatsCache = stats;

      // Fetch initial batch (5% of total or minimum 100)
      const batchSize = getBatchSize(totalRecords);
      const { data, error } = await supabase
        .from('dataset_records')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, batchSize - 1);

      if (error) {
        console.error('Error fetching records:', error);
        toast.error('Không thể tải dữ liệu');
        return;
      }

      const mapped: DatasetRecord[] = (data || []).map((row: any) => ({
        ...row.data,
        status: row.status,
        db_id: row.id,
      }));

      setRecords(mapped);
      setLoadedCount(mapped.length);
      globalRecordsCache = mapped;
      lastFetchTime = Date.now();
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getBatchSize]);

  // Load more records (next 5%)
  const loadMoreRecords = useCallback(async () => {
    if (!user || isLoadingMore.current || loadedCount >= totalCount) return;

    isLoadingMore.current = true;
    try {
      const batchSize = getBatchSize(totalCount);
      const { data, error } = await supabase
        .from('dataset_records')
        .select('*')
        .order('created_at', { ascending: false })
        .range(loadedCount, loadedCount + batchSize - 1);

      if (error) {
        console.error('Error loading more records:', error);
        return;
      }

      const mapped: DatasetRecord[] = (data || []).map((row: any) => ({
        ...row.data,
        status: row.status,
        db_id: row.id,
      }));

      if (mapped.length > 0) {
        setRecords(prev => {
          const updated = [...prev, ...mapped];
          globalRecordsCache = updated;
          return updated;
        });
        setLoadedCount(prev => prev + mapped.length);
      }
    } catch (error) {
      console.error('Error loading more records:', error);
    } finally {
      isLoadingMore.current = false;
    }
  }, [user, loadedCount, totalCount, getBatchSize]);

  // Initialize on mount - only fetch if not already cached
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchInitialRecords();
    }
  }, [fetchInitialRecords]);

  const addRecords = useCallback(async (newRecords: DatasetRecord[]) => {
    if (!user || !isAdmin) {
      toast.error('Bạn không có quyền thêm dữ liệu');
      return false;
    }

    try {
      // Validate all records before insertion
      const validationResult = validateDatasetRecords(newRecords);
      
      if (validationResult.invalidCount > 0) {
        const errorSummary = validationResult.errors
          .slice(0, 3)
          .map(e => `Record ${e.index + 1}: ${e.errors[0]}`)
          .join('; ');
        
        if (validationResult.validRecords.length === 0) {
          toast.error(`Không có record hợp lệ. ${errorSummary}`);
          return false;
        }
        
        toast.warning(`${validationResult.invalidCount} records không hợp lệ sẽ bị bỏ qua. ${errorSummary}`);
      }

      const recordsToInsert = validationResult.validRecords;
      if (recordsToInsert.length === 0) {
        toast.error('Không có dữ liệu hợp lệ để thêm');
        return false;
      }

      const BATCH_SIZE = 500;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
        const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
        
        const inserts = batch.map(record => ({
          record_id: record.id,
          data: JSON.parse(JSON.stringify(record)),
          status: record.status || 'pending',
          created_by: user.id,
        }));

        const { error } = await supabase
          .from('dataset_records')
          .insert(inserts);

        if (error) {
          console.error(`Error adding batch ${i / BATCH_SIZE + 1}:`, error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }

        if (recordsToInsert.length > BATCH_SIZE) {
          const progress = Math.min(100, Math.round((i + batch.length) / recordsToInsert.length * 100));
          toast.info(`Đang import: ${progress}% (${successCount}/${recordsToInsert.length})`, {
            id: 'import-progress',
          });
        }
      }

      // Force refresh after adding
      globalRecordsCache = null;
      lastFetchTime = null;
      await fetchInitialRecords(true);
      
      if (errorCount > 0) {
        toast.warning(`Đã thêm ${successCount} records, ${errorCount} lỗi`);
      } else {
        toast.success(`Đã thêm ${successCount} records vào database`);
      }
      
      return successCount > 0;
    } catch (error) {
      console.error('Error adding records:', error);
      toast.error(mapErrorToUserMessage(error, 'Lỗi khi thêm dữ liệu'));
      return false;
    }
  }, [user, isAdmin, fetchInitialRecords]);

  const updateRecord = useCallback(async (record: DatasetRecord) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('dataset_records')
        .update({
          data: JSON.parse(JSON.stringify(record)),
          status: record.status,
        })
        .eq('record_id', record.id);

      if (error) {
        console.error('Error updating record:', error);
        toast.error('Không thể cập nhật');
        return false;
      }

      setRecords(prev => {
        const updated = prev.map(r => r.id === record.id ? record : r);
        globalRecordsCache = updated;
        return updated;
      });
      return true;
    } catch (error) {
      console.error('Error updating record:', error);
      return false;
    }
  }, [user]);

  const deleteRecords = useCallback(async (recordIds: string[]) => {
    if (!user || !isAdmin) {
      toast.error('Bạn không có quyền xóa dữ liệu');
      return false;
    }

    try {
      const { error } = await supabase
        .from('dataset_records')
        .delete()
        .in('record_id', recordIds);

      if (error) {
        console.error('Error deleting records:', error);
        toast.error('Không thể xóa');
        return false;
      }

      setRecords(prev => {
        const updated = prev.filter(r => !recordIds.includes(r.id));
        globalRecordsCache = updated;
        return updated;
      });
      setTotalCount(prev => prev - recordIds.length);
      globalTotalCount = (globalTotalCount || 0) - recordIds.length;
      toast.success(`Đã xóa ${recordIds.length} records`);
      return true;
    } catch (error) {
      console.error('Error deleting records:', error);
      return false;
    }
  }, [user, isAdmin]);

  const calculateStats = useCallback((): DatasetStats => {
    // Return accurate stats from DB if available
    if (statsFromDB) {
      return statsFromDB;
    }

    // Fallback to local calculation
    const stats: DatasetStats = {
      total: totalCount || records.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      needs_review: 0,
      qa_types: {
        ask_image: 0,
        ask_audio: 0,
        ask_both: 0,
      },
    };

    records.forEach(record => {
      switch (record.status) {
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'needs_review':
          stats.needs_review++;
          break;
        default:
          stats.pending++;
      }

      record.qa_pairs?.forEach(qa => {
        if (qa.type === 'ask_image') stats.qa_types.ask_image++;
        else if (qa.type === 'ask_audio') stats.qa_types.ask_audio++;
        else if (qa.type === 'ask_both') stats.qa_types.ask_both++;
      });
    });

    return stats;
  }, [records, totalCount, statsFromDB]);

  // Force refresh function
  const refetch = useCallback(async () => {
    globalRecordsCache = null;
    lastFetchTime = null;
    await fetchInitialRecords(true);
  }, [fetchInitialRecords]);

  return {
    records,
    loading,
    totalCount,
    loadedCount,
    loadMoreRecords,
    addRecords,
    updateRecord,
    deleteRecords,
    refetch,
    calculateStats,
  };
}
