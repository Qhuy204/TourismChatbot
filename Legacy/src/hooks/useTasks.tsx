import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnnotationTask, TaskProgress } from '@/types/dataset';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { toast } from 'sonner';

export function useTasks() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const [tasks, setTasks] = useState<AnnotationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableRecordsInfo, setAvailableRecordsInfo] = useState({ available: 0, total: 0 });

  const fetchTasks = useCallback(async () => {
    if (!user || roleLoading) return;

    setLoading(true);
    try {
      let query = supabase
        .from('annotation_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-admins only see their own tasks
      if (!isAdmin) {
        query = query.eq('assigned_to', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tasks:', error);
        return;
      }

      // Get progress for each task using COUNT queries (avoid 1000 row limit)
      const tasksWithProgress: AnnotationTask[] = await Promise.all(
        (data || []).map(async (task: any) => {
          // Use separate count queries for each status to avoid 1000 row limit
          const [totalRes, approvedRes, pendingRes, needsReviewRes, rejectedRes] = await Promise.all([
            supabase
              .from('anno_task_details')
              .select('*', { count: 'exact', head: true })
              .eq('task_id', task.task_id),
            supabase
              .from('anno_task_details')
              .select('*', { count: 'exact', head: true })
              .eq('task_id', task.task_id)
              .eq('status', 'approved'),
            supabase
              .from('anno_task_details')
              .select('*', { count: 'exact', head: true })
              .eq('task_id', task.task_id)
              .eq('status', 'pending'),
            supabase
              .from('anno_task_details')
              .select('*', { count: 'exact', head: true })
              .eq('task_id', task.task_id)
              .eq('status', 'needs_review'),
            supabase
              .from('anno_task_details')
              .select('*', { count: 'exact', head: true })
              .eq('task_id', task.task_id)
              .eq('status', 'rejected'),
          ]);

          // Fetch assignee name separately
          let assignee_name = undefined;
          if (task.assigned_to) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', task.assigned_to)
              .single();
            assignee_name = profile?.display_name || 'Unknown';
          }

          const progress: TaskProgress = {
            total: totalRes.count || 0,
            approved: approvedRes.count || 0,
            pending: pendingRes.count || 0,
            needs_review: needsReviewRes.count || 0,
            rejected: rejectedRes.count || 0,
          };

          return {
            task_id: task.task_id,
            task_name: task.task_name,
            created_by: task.created_by,
            assigned_to: task.assigned_to,
            assigned_by: task.assigned_by,
            status: task.status,
            created_at: task.created_at,
            updated_at: task.updated_at,
            assignee_name,
            progress,
          };
        })
      );

      setTasks(tasksWithProgress);
      
      // Calculate available records count
      if (isAdmin) {
        const [totalRes, assignedRes] = await Promise.all([
          supabase.from('dataset_records').select('*', { count: 'exact', head: true }),
          supabase.from('anno_task_details').select('*', { count: 'exact', head: true }),
        ]);
        const total = totalRes.count || 0;
        const assigned = assignedRes.count || 0;
        setAvailableRecordsInfo({ available: total - assigned, total });
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, roleLoading]);

  useEffect(() => {
    if (!roleLoading) {
      fetchTasks();
    }
  }, [fetchTasks, roleLoading]);

  const createTask = useCallback(async (
    name: string,
    assignedTo: string,
    percentage: number,
    onProgress?: (stage: string, current: number, total: number) => void
  ) => {
    if (!user || !isAdmin) {
      toast.error('Bạn không có quyền tạo task');
      return null;
    }

    onProgress?.('Đang khởi tạo...', 0, 100);

    try {
      // Get TOTAL count of all records
      const { count: totalRecordsCount, error: totalCountError } = await supabase
        .from('dataset_records')
        .select('*', { count: 'exact', head: true });

      if (totalCountError) {
        console.error('Error getting total count:', totalCountError);
        toast.error('Không thể lấy số lượng records');
        return null;
      }

      // Get count of already assigned records
      const { count: assignedCount, error: assignedCountError } = await supabase
        .from('anno_task_details')
        .select('*', { count: 'exact', head: true });

      if (assignedCountError) {
        console.error('Error getting assigned count:', assignedCountError);
        toast.error('Không thể lấy số lượng records đã giao');
        return null;
      }

      const totalCount = totalRecordsCount || 0;
      const alreadyAssigned = assignedCount || 0;
      const availableCount = totalCount - alreadyAssigned;

      if (availableCount <= 0) {
        toast.error('Không còn records khả dụng để giao');
        return null;
      }

      // Calculate how many records to assign based on AVAILABLE count
      const recordsToAssign = Math.ceil((percentage / 100) * availableCount);

      const { data: task, error: taskError } = await supabase
        .from('annotation_tasks')
        .insert({
          task_name: name,
          assigned_to: assignedTo,
          assigned_by: user.id,
          status: 'open',
        })
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        toast.error('Không thể tạo task');
        return null;
      }

      onProgress?.('Đang lấy danh sách records đã giao...', 10, 100);

      // Get records that are NOT already assigned to any task
      // Need to paginate through all assigned IDs first
      let allAssignedIds: string[] = [];
      let offset = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: batch } = await supabase
          .from('anno_task_details')
          .select('image_id')
          .range(offset, offset + pageSize - 1);
        
        if (!batch || batch.length === 0) break;
        allAssignedIds = allAssignedIds.concat(batch.map(r => r.image_id));
        onProgress?.(`Đã quét ${allAssignedIds.length} records đã giao...`, 15, 100);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      onProgress?.('Đang tìm records khả dụng...', 20, 100);

      // Convert to Set for O(1) lookup instead of O(n) includes
      const assignedIdsSet = new Set(allAssignedIds);
      
      // Fetch available records in batches (not in anno_task_details)
      // Need to keep fetching until we have enough available records
      let collectedRecords: string[] = [];
      let fetchOffset = 0;
      const fetchPageSize = 1000;
      
      // Keep fetching until we have enough OR we've exhausted all records
      let hasMoreRecords = true;
      while (collectedRecords.length < recordsToAssign && hasMoreRecords) {
        const progressPercent = Math.min(20 + Math.floor((collectedRecords.length / recordsToAssign) * 50), 70);
        onProgress?.(`Đang thu thập records: ${collectedRecords.length.toLocaleString()}/${recordsToAssign.toLocaleString()}`, progressPercent, 100);
        
        const { data: batch, error: fetchError } = await supabase
          .from('dataset_records')
          .select('id')
          .order('created_at', { ascending: true })
          .range(fetchOffset, fetchOffset + fetchPageSize - 1);
        
        if (fetchError) {
          console.error('Error fetching records batch:', fetchError);
          break;
        }
        
        if (!batch || batch.length === 0) {
          hasMoreRecords = false;
          break;
        }
        
        // Filter out already assigned records
        for (const record of batch) {
          if (!assignedIdsSet.has(record.id)) {
            collectedRecords.push(record.id);
          }
        }
        
        // If we got less than page size, we've reached the end of all records
        if (batch.length < fetchPageSize) {
          hasMoreRecords = false;
        }
        
        fetchOffset += fetchPageSize;
      }
      console.log(`Total collected: ${collectedRecords.length}, requested: ${recordsToAssign}`);
      onProgress?.('Đang chuẩn bị ghi vào database...', 75, 100);
      
      // Dedupe and trim to exact count needed
      const uniqueIds = [...new Set(collectedRecords)];
      const recordsToInsert = uniqueIds.slice(0, recordsToAssign).map(id => ({ id }));

      if (recordsToInsert.length > 0) {
        // Insert in batches of 500 to avoid hitting limits
        const insertBatchSize = 500;
        const totalBatches = Math.ceil(recordsToInsert.length / insertBatchSize);
        
        for (let i = 0; i < recordsToInsert.length; i += insertBatchSize) {
          const batchIndex = Math.floor(i / insertBatchSize) + 1;
          const progressPercent = 75 + Math.floor((batchIndex / totalBatches) * 20);
          onProgress?.(`Đang ghi batch ${batchIndex}/${totalBatches}...`, progressPercent, 100);
          
          const insertBatch = recordsToInsert.slice(i, i + insertBatchSize);
          const taskDetails = insertBatch.map(record => ({
            task_id: task.task_id,
            image_id: record.id,
            status: 'pending' as const,
          }));

          const { error: insertError } = await supabase.from('anno_task_details').insert(taskDetails);
          if (insertError) {
            console.error('Error inserting task details batch:', insertError);
            toast.error('Lỗi khi giao records cho task');
            return null;
          }
        }
      }
      
      const actualInserted = recordsToInsert.length;

      onProgress?.('Hoàn tất!', 100, 100);
      await fetchTasks();
      toast.success(`Đã tạo task với ${actualInserted.toLocaleString()} records (${percentage}% của ${availableCount.toLocaleString()} khả dụng)`);
      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Lỗi khi tạo task');
      return null;
    }
  }, [user, isAdmin, fetchTasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user || !isAdmin) {
      toast.error('Bạn không có quyền xóa task');
      return false;
    }

    try {
      // Delete task (cascade will delete anno_task_details)
      const { error } = await supabase
        .from('annotation_tasks')
        .delete()
        .eq('task_id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        toast.error('Không thể xóa task');
        return false;
      }

      await fetchTasks();
      toast.success('Đã xóa task thành công');
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Lỗi khi xóa task');
      return false;
    }
  }, [user, isAdmin, fetchTasks]);

  const updateTaskDetailStatus = useCallback(async (
    taskId: string,
    imageId: string,
    status: 'approved' | 'needs_review' | 'rejected'
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('anno_task_details')
        .update({
          status,
          annotator_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('task_id', taskId)
        .eq('image_id', imageId);

      if (error) {
        console.error('Error updating task detail:', error);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error updating task detail:', error);
      return false;
    }
  }, [user, fetchTasks]);

  // Get image IDs for a task
  const getTaskImageIds = useCallback(async (taskId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('anno_task_details')
      .select('image_id')
      .eq('task_id', taskId);

    if (error) {
      console.error('Error fetching task details:', error);
      return [];
    }

    return data?.map(r => r.image_id) || [];
  }, []);

  const getMyProgress = useCallback(() => {
    if (!tasks.length) return null;

    const myTasks = tasks.filter(t => t.assigned_to === user?.id);
    if (!myTasks.length) return null;

    const totals = myTasks.reduce(
      (acc, task) => ({
        total: acc.total + (task.progress?.total || 0),
        approved: acc.approved + (task.progress?.approved || 0),
        pending: acc.pending + (task.progress?.pending || 0),
        needs_review: acc.needs_review + (task.progress?.needs_review || 0),
        rejected: acc.rejected + (task.progress?.rejected || 0),
      }),
      { total: 0, approved: 0, pending: 0, needs_review: 0, rejected: 0 }
    );

    return {
      ...totals,
      approvedPercent: totals.total > 0 ? (totals.approved / totals.total) * 100 : 0,
      pendingPercent: totals.total > 0 ? (totals.pending / totals.total) * 100 : 0,
      needsReviewPercent: totals.total > 0 ? (totals.needs_review / totals.total) * 100 : 0,
      rejectedPercent: totals.total > 0 ? (totals.rejected / totals.total) * 100 : 0,
    };
  }, [tasks, user]);

  return {
    tasks,
    loading,
    availableRecordsInfo,
    createTask,
    deleteTask,
    updateTaskDetailStatus,
    getTaskImageIds,
    getMyProgress,
    refetch: fetchTasks,
  };
}
