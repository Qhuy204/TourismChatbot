import { useState, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { DataBrowser } from '@/components/browser/DataBrowser';
import { AnnotationInterface } from '@/components/annotate/AnnotationInterface';
import { RandomQACheck } from '@/components/qa-check/RandomQACheck';
import { CrawlInterface } from '@/components/crawl/CrawlInterface';
import { ExportInterface } from '@/components/export/ExportInterface';
import { mockRecords, calculateStats } from '@/lib/mockData';
import { DatasetRecord } from '@/types/dataset';

const Index = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [records, setRecords] = useState<DatasetRecord[]>(mockRecords);

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
      case 'crawl':
        return <CrawlInterface onAddRecords={handleAddRecords} />;
      case 'export':
        return <ExportInterface records={records} stats={stats} />;
      default:
        return <Dashboard records={records} stats={stats} />;
    }
  };

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
