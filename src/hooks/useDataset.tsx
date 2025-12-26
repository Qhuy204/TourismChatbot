import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DatasetRecord, DatasetStats } from '@/types/dataset';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { toast } from 'sonner';

export function useDataset() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [statsFromDB, setStatsFromDB] = useState<DatasetStats | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get total count first (bypasses 1000 limit)
      const { count: total, error: countError } = await supabase
        .from('dataset_records')
        .select('*', { count: 'exact', head: true });

      if (!countError && total !== null) {
        setTotalCount(total);
      }

      // Get counts by status for accurate stats
      const [pendingRes, approvedRes, rejectedRes, needsReviewRes] = await Promise.all([
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('dataset_records').select('*', { count: 'exact', head: true }).eq('status', 'needs_review'),
      ]);

      setStatsFromDB({
        total: total || 0,
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
        needs_review: needsReviewRes.count || 0,
        qa_types: { ask_image: 0, ask_audio: 0, ask_both: 0 },
      });

      // Fetch first batch of records for display (limit 1000)
      const { data, error } = await supabase
        .from('dataset_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

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
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const addRecords = useCallback(async (newRecords: DatasetRecord[]) => {
    if (!user || !isAdmin) {
      toast.error('Bạn không có quyền thêm dữ liệu');
      return false;
    }

    try {
      const BATCH_SIZE = 500;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = newRecords.slice(i, i + BATCH_SIZE);
        
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

        if (newRecords.length > BATCH_SIZE) {
          const progress = Math.min(100, Math.round((i + batch.length) / newRecords.length * 100));
          toast.info(`Đang import: ${progress}% (${successCount}/${newRecords.length})`, {
            id: 'import-progress',
          });
        }
      }

      await fetchRecords();
      
      if (errorCount > 0) {
        toast.warning(`Đã thêm ${successCount} records, ${errorCount} lỗi`);
      } else {
        toast.success(`Đã thêm ${successCount} records vào database`);
      }
      
      return successCount > 0;
    } catch (error) {
      console.error('Error adding records:', error);
      toast.error('Lỗi khi thêm dữ liệu');
      return false;
    }
  }, [user, isAdmin, fetchRecords]);

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

      setRecords(prev => prev.map(r => r.id === record.id ? record : r));
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

      setRecords(prev => prev.filter(r => !recordIds.includes(r.id)));
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

  return {
    records,
    loading,
    totalCount,
    addRecords,
    updateRecord,
    deleteRecords,
    refetch: fetchRecords,
    calculateStats,
  };
}
