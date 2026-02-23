import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { TaskAnnotationInterface } from '@/components/annotate/TaskAnnotationInterface';
import { RandomQACheck } from '@/components/qa-check/RandomQACheck';
import { QACheckInterface } from '@/components/qa-check/QACheckInterface';
import { CrawlInterface } from '@/components/crawl/CrawlInterface';
import { ImportInterface } from '@/components/import/ImportInterface';
import { ExportInterface } from '@/components/export/ExportInterface';
import { SettingsInterface } from '@/components/settings/SettingsInterface';
import { UserSettingsDialog } from '@/components/settings/UserSettingsDialog';
import { ChatbotInterface } from '@/components/chatbot/ChatbotInterface';
import { DatasetRecord } from '@/types/dataset';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const initialTab = searchParams.get('tab') || 'dashboard';
  const initialTaskId = searchParams.get('task') || undefined;
  const initialSampleId = searchParams.get('sample') || undefined;

  const [currentView, setCurrentView] = useState(initialTab);

  // Use database-synced data
  const { records, loading: dataLoading, totalCount, loadedCount, loadMoreRecords, loadAllRecords, addRecords, updateRecord, deleteRecords, deleteByVersion, deleteByStatus, deleteByDateRange, deleteAllRecords, refetch, calculateStats } = useDataset();
  const { users } = useUsers();
  const { tasks, createTask, deleteTask, getTaskImageIds, availableRecordsInfo, refetch: refetchTasks } = useTasks();

  // Annotation navigation state - initialize from URL
  const [annotateRecordId, setAnnotateRecordId] = useState<string | undefined>(initialSampleId);
  const [annotateLocation, setAnnotateLocation] = useState<string | undefined>(searchParams.get('location') || undefined);
  const [annotateFilteredIds, setAnnotateFilteredIds] = useState<string[] | undefined>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(initialTaskId);
  const [qaCheckRecordIds, setQaCheckRecordIds] = useState<string[]>([]);

  // User settings dialog
  const [showUserSettings, setShowUserSettings] = useState(false);

  // Sync URL with state changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (currentView && currentView !== 'dashboard') {
      params.set('tab', currentView);
    }

    if (selectedTaskId) {
      params.set('task', selectedTaskId);
    }

    if (annotateLocation) {
      params.set('location', annotateLocation);
    }

    if (annotateRecordId) {
      params.set('id', annotateRecordId);
    }

    // Update URL without navigation
    const newSearch = params.toString();
    const currentSearch = searchParams.toString();

    if (newSearch !== currentSearch) {
      setSearchParams(params, { replace: true });
    }
  }, [currentView, selectedTaskId, annotateRecordId, annotateLocation, setSearchParams, searchParams]);

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
  const handleNavigateToAnnotate = useCallback((recordId: string, locationName?: string) => {
    setAnnotateRecordId(recordId);
    setAnnotateLocation(locationName);
    setAnnotateFilteredIds(undefined);
    setCurrentView('annotate');
  }, []);

  // Navigate to annotate from QA Check with filtered records - OLD (for Annotate All)
  const handleStartQAAnnotation = useCallback((recordIds: string[]) => {
    setAnnotateFilteredIds(recordIds);
    setAnnotateRecordId(recordIds[0]);
    setAnnotateLocation(undefined);
    setCurrentView('annotate');
  }, []);

  // Navigate to QA Check Interface with random sample
  const handleStartQACheck = useCallback((recordIds: string[]) => {
    setQaCheckRecordIds(recordIds);
    setCurrentView('qa-check-interface');
  }, []);

  // Navigate to task annotation - just navigate to task-annotate view with taskId
  const handleStartTaskAnnotation = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setAnnotateLocation(undefined);
    setAnnotateRecordId(undefined);
    setCurrentView('task-annotate');
  }, []);

  // Handle view change - reset annotation state when going to annotate directly
  const handleViewChange = useCallback((view: string) => {
    if (view === 'annotate' && currentView !== 'annotate') {
      setAnnotateRecordId(undefined);
      setAnnotateFilteredIds(undefined);
      setAnnotateLocation(undefined);
    }
    if (view !== 'task-annotate') {
      setSelectedTaskId(undefined);
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

  // Use availableRecordsInfo from useTasks hook (fetches directly from DB)
  const availableRecords = availableRecordsInfo.available;
  const totalRecordsCount = availableRecordsInfo.total;

  // Create task handler for admin
  const handleCreateTask = useCallback(async (
    name: string,
    userId: string,
    percentage: number,
    onProgress?: (stage: string, current: number, total: number) => void
  ) => {
    await createTask(name, userId, percentage, onProgress);
  }, [createTask]);

  // Delete task handler for admin
  const handleDeleteTask = useCallback(async (taskId: string) => {
    return await deleteTask(taskId);
  }, [deleteTask]);

  const renderContent = () => {
    // Only render active view - others are unmounted to save resources
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
            totalRecords={totalRecordsCount}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
          />
        ) : (
          <UserDashboard
            records={records}
            tasks={userTasks}
            onNavigateToAnnotate={() => setCurrentView('task-annotate')}
            onStartTask={handleStartTaskAnnotation}
          />
        );
      case 'task-annotate':
        return (
          <TaskAnnotationInterface
            key="task-annotate"
            tasks={isAdmin ? tasks || [] : userTasks}
            onRecordUpdate={handleRecordUpdate}
            initialTaskId={selectedTaskId}
            onTaskStatusUpdate={refetchTasks}
          />
        );
      case 'browser':
        return (
          <DataBrowser
            key="browser"
            records={records}
            totalCount={totalCount}
            loadedCount={loadedCount}
            onLoadMore={loadMoreRecords}
            onLoadAll={loadAllRecords}
            onRecordUpdate={handleRecordUpdate}
            onRecordsUpdate={handleRecordsUpdate}
            onNavigateToAnnotate={handleNavigateToAnnotate}
            onDeleteByVersion={deleteByVersion}
            onDeleteByStatus={deleteByStatus}
            onDeleteByDateRange={deleteByDateRange}
            onDeleteAll={deleteAllRecords}
            onRefreshData={refetch}
          />
        );
      case 'annotate':
        return (
          <AnnotationInterface
            key="annotate"
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
            key="random-check"
            records={records}
            totalCount={totalCount}
            onRecordUpdate={handleRecordUpdate}
            onStartQACheck={handleStartQACheck}
          />
        );
      case 'qa-check-interface':
        return (
          <QACheckInterface
            key="qa-check-interface"
            recordIds={qaCheckRecordIds}
            onRecordUpdate={handleRecordUpdate}
            onBack={() => setCurrentView('random-check')}
          />
        );
      case 'import':
        return isAdmin ? (
          <ImportInterface key="import" onAddRecords={handleAddRecords} />
        ) : (
          <AccessDenied />
        );
      case 'crawl':
        return isAdmin ? (
          <CrawlInterface key="crawl" onAddRecords={handleAddRecords} />
        ) : (
          <AccessDenied />
        );
      case 'export':
        return <ExportInterface key="export" records={records} stats={stats} />;
      case 'chatbot':
        return <ChatbotInterface key="chatbot" />;
      case 'settings':
        return <SettingsInterface key="settings" />;
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
            totalRecords={totalRecordsCount}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
          />
        ) : (
          <UserDashboard records={records} tasks={userTasks} onNavigateToAnnotate={() => setCurrentView('task-annotate')} onStartTask={handleStartTaskAnnotation} />
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
