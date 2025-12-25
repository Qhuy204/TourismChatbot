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
import { mockRecords, calculateStats } from '@/lib/mockData';
import { DatasetRecord } from '@/types/dataset';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('dashboard');
  const [records, setRecords] = useState<DatasetRecord[]>(mockRecords);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const stats = useMemo(() => calculateStats(records), [records]);

  const handleRecordUpdate = useCallback((updatedRecord: DatasetRecord) => {
    setRecords(prev => 
      prev.map(r => r.record_id === updatedRecord.record_id ? updatedRecord : r)
    );
  }, []);

  const handleAddRecords = useCallback((newRecords: DatasetRecord[]) => {
    setRecords(prev => [...prev, ...newRecords]);
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard records={records} stats={stats} />;
      case 'browser':
        return <DataBrowser records={records} onRecordUpdate={handleRecordUpdate} />;
      case 'annotate':
        return <AnnotationInterface records={records} onRecordUpdate={handleRecordUpdate} />;
      case 'random-check':
        return <RandomQACheck records={records} onRecordUpdate={handleRecordUpdate} />;
      case 'import':
        return <ImportInterface onAddRecords={handleAddRecords} />;
      case 'crawl':
        return <CrawlInterface onAddRecords={handleAddRecords} />;
      case 'export':
        return <ExportInterface records={records} stats={stats} />;
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
    <div className="flex min-h-screen bg-background">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
