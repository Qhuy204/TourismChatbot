import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useDataset } from '@/hooks/useDataset';
import { useUsers } from '@/hooks/useUsers';
import { useTasks } from '@/hooks/useTasks';
import { Sidebar } from '@/components/layout/Sidebar';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { UserDashboard } from '@/components/dashboard/UserDashboard';
import { DataBrowser } from '@/components/browser/DataBrowser';
import { AnnotationInterface } from '@/components/annotate/AnnotationInterface';
import { RandomQACheck } from '@/components/qa-check/RandomQACheck';
import { CrawlInterface } from '@/components/crawl/CrawlInterface';
import { ImportInterface } from '@/components/import/ImportInterface';
import { ExportInterface } from '@/components/export/ExportInterface';
import { SettingsInterface } from '@/components/settings/SettingsInterface';
import { UserSettingsDialog } from '@/components/settings/UserSettingsDialog';
import { DatasetRecord } from '@/types/dataset';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Use database-synced data
  const { records, loading: dataLoading, totalCount, loadedCount, loadMoreRecords, addRecords, updateRecord, deleteRecords, refetch, calculateStats } = useDataset();
  const { users } = useUsers();
  const { tasks, createTask, deleteTask, getTaskImageIds, refetch: refetchTasks } = useTasks();
  
  // Annotation navigation state
  const [annotateRecordId, setAnnotateRecordId] = useState<string | undefined>();
  const [annotateFilteredIds, setAnnotateFilteredIds] = useState<string[] | undefined>();
  
  // User settings dialog
  const [showUserSettings, setShowUserSettings] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const stats = calculateStats();

  const handleRecordUpdate = useCallback(async (updatedRecord: DatasetRecord) => {
    await updateRecord(updatedRecord);
  }, [updateRecord]);

  const handleRecordsUpdate = useCallback(async (updatedRecords: DatasetRecord[]) => {
    for (const record of updatedRecords) {
      await updateRecord(record);
    }
  }, [updateRecord]);

  const handleAddRecords = useCallback(async (newRecords: DatasetRecord[]) => {
    await addRecords(newRecords);
  }, [addRecords]);

  // Navigate to annotate from DataBrowser
  const handleNavigateToAnnotate = useCallback((recordId: string) => {
    setAnnotateRecordId(recordId);
    setAnnotateFilteredIds(undefined);
    setCurrentView('annotate');
  }, []);

  // Navigate to annotate from QA Check with filtered records
  const handleStartQAAnnotation = useCallback((recordIds: string[]) => {
    setAnnotateFilteredIds(recordIds);
    setAnnotateRecordId(recordIds[0]);
    setCurrentView('annotate');
  }, []);

  // Navigate to annotate from Task with task's record IDs
  const handleStartTaskAnnotation = useCallback(async (taskId: string) => {
    try {
      // Fetch all image IDs for the task
      const { data: taskDetails, error } = await supabase
        .from('anno_task_details')
        .select('image_id')
        .eq('task_id', taskId);

      if (error) {
        toast.error('Không thể tải records của task');
        return;
      }

      const recordIds = taskDetails?.map(tr => tr.image_id) || [];
      
      if (recordIds.length === 0) {
        toast.error('Task không có records nào');
        return;
      }

      // Navigate to annotate with task's record IDs
      setAnnotateFilteredIds(recordIds);
      setAnnotateRecordId(recordIds[0]);
      setCurrentView('annotate');
    } catch (err) {
      console.error('Error starting task annotation:', err);
      toast.error('Có lỗi xảy ra');
    }
  }, []);

  // Handle view change - reset annotation state when going to annotate directly
  const handleViewChange = useCallback((view: string) => {
    if (view === 'annotate' && currentView !== 'annotate') {
      setAnnotateRecordId(undefined);
      setAnnotateFilteredIds(undefined);
    }
    setCurrentView(view);
  }, [currentView]);

  // Access denied component for non-admin trying to access admin features
  const AccessDenied = () => (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Không có quyền truy cập
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Chức năng này chỉ dành cho Admin. Vui lòng liên hệ quản trị viên nếu bạn cần truy cập.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  // Get user's tasks (for regular users)
  const userTasks = tasks?.filter(t => t.assigned_to === user?.id) || [];

  // Calculate available records (total - already assigned in tasks)
  const assignedRecordsCount = tasks?.reduce((sum, task) => sum + (task.progress?.total || 0), 0) || 0;
  const availableRecords = Math.max(0, totalCount - assignedRecordsCount);

  // Create task handler for admin
  const handleCreateTask = useCallback(async (name: string, userId: string, percentage: number) => {
    await createTask(name, userId, percentage);
  }, [createTask]);

  // Delete task handler for admin
  const handleDeleteTask = useCallback(async (taskId: string) => {
    return await deleteTask(taskId);
  }, [deleteTask]);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return isAdmin ? (
          <AdminDashboard 
            records={records} 
            stats={stats} 
            usersCount={users?.length || 0}
            tasksCount={tasks?.length || 0}
            users={users}
            tasks={tasks}
            availableRecords={availableRecords}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
          />
        ) : (
          <UserDashboard 
            records={records}
            tasks={userTasks}
            onNavigateToAnnotate={() => setCurrentView('annotate')}
            onStartTask={handleStartTaskAnnotation}
          />
        );
      case 'task-annotate':
        // Redirect to annotate with first task's records if available
        if (userTasks.length > 0) {
          handleStartTaskAnnotation(userTasks[0].task_id);
        }
        return (
          <div className="p-6 flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Đang tải task...</p>
              </CardContent>
            </Card>
          </div>
        );
      case 'browser':
        return (
          <DataBrowser 
            records={records} 
            totalCount={totalCount}
            loadedCount={loadedCount}
            onLoadMore={loadMoreRecords}
            onRecordUpdate={handleRecordUpdate} 
            onRecordsUpdate={handleRecordsUpdate}
            onNavigateToAnnotate={handleNavigateToAnnotate}
          />
        );
      case 'annotate':
        return (
          <AnnotationInterface 
            records={records} 
            totalCount={totalCount}
            loadedCount={loadedCount}
            onLoadMore={loadMoreRecords}
            onRecordUpdate={handleRecordUpdate}
            initialRecordId={annotateRecordId}
            filteredRecordIds={annotateFilteredIds}
          />
        );
      case 'random-check':
        return (
          <RandomQACheck 
            records={records} 
            totalCount={totalCount}
            onRecordUpdate={handleRecordUpdate}
            onStartAnnotation={handleStartQAAnnotation}
          />
        );
      case 'import':
        // Only admin can import
        return isAdmin ? (
          <ImportInterface onAddRecords={handleAddRecords} />
        ) : (
          <AccessDenied />
        );
      case 'crawl':
        // Only admin can crawl
        return isAdmin ? (
          <CrawlInterface onAddRecords={handleAddRecords} />
        ) : (
          <AccessDenied />
        );
      case 'export':
        return <ExportInterface records={records} stats={stats} />;
      case 'settings':
        return <SettingsInterface />;
      default:
        return isAdmin ? (
          <AdminDashboard 
            records={records} 
            stats={stats} 
            usersCount={users?.length || 0} 
            tasksCount={tasks?.length || 0} 
            users={users} 
            tasks={tasks} 
            availableRecords={availableRecords}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
          />
        ) : (
          <UserDashboard records={records} tasks={userTasks} onNavigateToAnnotate={() => setCurrentView('annotate')} onStartTask={handleStartTaskAnnotation} />
        );
    }
  };

  // Only wait for auth loading - don't block on data loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen h-screen bg-background overflow-hidden">
      <Sidebar 
        currentView={currentView} 
        onViewChange={handleViewChange}
        onOpenSettings={() => setShowUserSettings(true)}
        isAdmin={isAdmin}
      />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
      
      <UserSettingsDialog 
        open={showUserSettings} 
        onOpenChange={setShowUserSettings} 
      />
    </div>
  );
};

export default Index;
