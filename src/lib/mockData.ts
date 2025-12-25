import { DatasetRecord, DatasetStats } from '@/types/dataset';

// Empty mock data - production ready
export const generateMockRecords = (count: number = 0): DatasetRecord[] => {
  return [];
};

export const calculateStats = (records: DatasetRecord[]): DatasetStats => {
  const stats: DatasetStats = {
    total: records.length,
    pending: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
    warning: 0,
    scenarios: {
      text_ask_image: 0,
      audio_ask_image: 0,
      text_ask_audio: 0,
      audio_ask_audio: 0
    }
  };

  records.forEach(record => {
    if (record.status === 'pending') stats.pending++;
    else if (record.status === 'reviewed') stats.reviewed++;
    else if (record.status === 'approved') stats.approved++;
    else if (record.status === 'rejected') stats.rejected++;
    else if (record.status === 'warning') stats.warning++;
    else stats.pending++; // default to pending if no status

    record.qa_items.forEach(qa => {
      if (qa.scenario && stats.scenarios[qa.scenario]) {
        stats.scenarios[qa.scenario]++;
      }
    });
  });

  return stats;
};

export const mockRecords: DatasetRecord[] = [];
export const mockStats = calculateStats(mockRecords);
