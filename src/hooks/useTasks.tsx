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

      // Get progress for each task
      const tasksWithProgress: AnnotationTask[] = await Promise.all(
        (data || []).map(async (task: any) => {
          const { data: taskRecords } = await supabase
            .from('task_records')
            .select('status')
            .eq('task_id', task.id);

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
            total: taskRecords?.length || 0,
            completed: taskRecords?.filter(r => r.status === 'completed').length || 0,
            pending: taskRecords?.filter(r => r.status === 'pending').length || 0,
            needs_review: taskRecords?.filter(r => r.status === 'needs_review').length || 0,
            rejected: taskRecords?.filter(r => r.status === 'rejected').length || 0,
          };

          return {
            ...task,
            assignee_name,
            progress,
          };
        })
      );

      setTasks(tasksWithProgress);
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
    description?: string
  ) => {
    if (!user || !isAdmin) {
      toast.error('Bạn không có quyền tạo task');
      return null;
    }

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
        .from('task_records')
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
          name,
          description,
          assigned_to: assignedTo,
          assigned_by: user.id,
          percentage,
          status: 'pending',
        })
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        toast.error('Không thể tạo task');
        return null;
      }

      // Get records that are NOT already assigned to any task
      const { data: assignedRecordIds } = await supabase
        .from('task_records')
        .select('record_id');

      const alreadyAssignedIds = assignedRecordIds?.map(r => r.record_id) || [];

      // Fetch available records (not in task_records)
      let query = supabase
        .from('dataset_records')
        .select('id')
        .limit(recordsToAssign);

      if (alreadyAssignedIds.length > 0) {
        query = query.not('id', 'in', `(${alreadyAssignedIds.join(',')})`);
      }

      const { data: availableRecords } = await query;

      if (availableRecords && availableRecords.length > 0) {
        const taskRecords = availableRecords.map(record => ({
          task_id: task.id,
          record_id: record.id,
          status: 'pending' as const,
        }));

        await supabase.from('task_records').insert(taskRecords);
      }

      await fetchTasks();
      toast.success(`Đã tạo task với ${availableRecords?.length || 0} records (${percentage}% của ${availableCount} khả dụng)`);
      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Lỗi khi tạo task');
      return null;
    }
  }, [user, isAdmin, fetchTasks]);

  const updateTaskRecordStatus = useCallback(async (
    taskId: string,
    recordId: string,
    status: 'completed' | 'needs_review' | 'rejected'
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('task_records')
        .update({
          status,
          annotated_by: user.id,
          annotated_at: new Date().toISOString(),
        })
        .eq('task_id', taskId)
        .eq('record_id', recordId);

      if (error) {
        console.error('Error updating task record:', error);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error updating task record:', error);
      return false;
    }
  }, [user, fetchTasks]);

  // Get record IDs for a task
  const getTaskRecordIds = useCallback(async (taskId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('task_records')
      .select('record_id')
      .eq('task_id', taskId);

    if (error) {
      console.error('Error fetching task records:', error);
      return [];
    }

    return data?.map(r => r.record_id) || [];
  }, []);

  const getMyProgress = useCallback(() => {
    if (!tasks.length) return null;

    const myTasks = tasks.filter(t => t.assigned_to === user?.id);
    if (!myTasks.length) return null;

    const totals = myTasks.reduce(
      (acc, task) => ({
        total: acc.total + (task.progress?.total || 0),
        completed: acc.completed + (task.progress?.completed || 0),
        pending: acc.pending + (task.progress?.pending || 0),
        needs_review: acc.needs_review + (task.progress?.needs_review || 0),
        rejected: acc.rejected + (task.progress?.rejected || 0),
      }),
      { total: 0, completed: 0, pending: 0, needs_review: 0, rejected: 0 }
    );

    return {
      ...totals,
      completedPercent: totals.total > 0 ? (totals.completed / totals.total) * 100 : 0,
      pendingPercent: totals.total > 0 ? (totals.pending / totals.total) * 100 : 0,
      needsReviewPercent: totals.total > 0 ? (totals.needs_review / totals.total) * 100 : 0,
      rejectedPercent: totals.total > 0 ? (totals.rejected / totals.total) * 100 : 0,
    };
  }, [tasks, user]);

  return {
    tasks,
    loading,
    createTask,
    updateTaskRecordStatus,
    getTaskRecordIds,
    getMyProgress,
    refetch: fetchTasks,
  };
}
