import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { DataBrowser } from '@/components/browser/DataBrowser';
import { AnnotationInterface } from '@/components/annotate/AnnotationInterface';
import { RandomQACheck } from '@/components/qa-check/RandomQACheck';
import { CrawlInterface } from '@/components/crawl/CrawlInterface';
import { ImportInterface } from '@/components/import/ImportInterface';
import { ExportInterface } from '@/components/export/ExportInterface';
import { SettingsInterface } from '@/components/settings/SettingsInterface';
import { UserSettingsDialog } from '@/components/settings/UserSettingsDialog';
import { calculateStats } from '@/lib/mockData';
import { DatasetRecord } from '@/types/dataset';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('dashboard');
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  
  // Annotation navigation state
  const [annotateRecordId, setAnnotateRecordId] = useState<string | undefined>();
  const [annotateFilteredIds, setAnnotateFilteredIds] = useState<string[] | undefined>();
  
  // User settings dialog
  const [showUserSettings, setShowUserSettings] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const stats = useMemo(() => calculateStats(records), [records]);

  const handleRecordUpdate = useCallback((updatedRecord: DatasetRecord) => {
    setRecords(prev => 
      prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)
    );
  }, []);

  const handleRecordsUpdate = useCallback((updatedRecords: DatasetRecord[]) => {
    setRecords(updatedRecords);
  }, []);

  const handleAddRecords = useCallback((newRecords: DatasetRecord[]) => {
    setRecords(prev => [...prev, ...newRecords]);
  }, []);

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

  // Handle view change - reset annotation state when going to annotate directly
  const handleViewChange = useCallback((view: string) => {
    if (view === 'annotate' && currentView !== 'annotate') {
      // Direct navigation to annotate - reset to show pending records
      setAnnotateRecordId(undefined);
      setAnnotateFilteredIds(undefined);
    }
    setCurrentView(view);
  }, [currentView]);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard records={records} stats={stats} />;
      case 'browser':
        return (
          <DataBrowser 
            records={records} 
            onRecordUpdate={handleRecordUpdate} 
            onRecordsUpdate={handleRecordsUpdate}
            onNavigateToAnnotate={handleNavigateToAnnotate}
          />
        );
      case 'annotate':
        return (
          <AnnotationInterface 
            records={records} 
            onRecordUpdate={handleRecordUpdate}
            initialRecordId={annotateRecordId}
            filteredRecordIds={annotateFilteredIds}
          />
        );
      case 'random-check':
        return (
          <RandomQACheck 
            records={records} 
            onRecordUpdate={handleRecordUpdate}
            onStartAnnotation={handleStartQAAnnotation}
          />
        );
      case 'import':
        return <ImportInterface onAddRecords={handleAddRecords} />;
      case 'crawl':
        return <CrawlInterface onAddRecords={handleAddRecords} />;
      case 'export':
        return <ExportInterface records={records} stats={stats} />;
      case 'settings':
        return <SettingsInterface />;
      default:
        return <Dashboard records={records} stats={stats} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
