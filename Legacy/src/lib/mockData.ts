import { DatasetRecord, DatasetStats } from '@/types/dataset';

// Empty mock data - production ready
export const generateMockRecords = (count: number = 0): DatasetRecord[] => {
  return [];
};

export const calculateStats = (records: DatasetRecord[]): DatasetStats => {
  const stats: DatasetStats = {
    total: records.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    needs_review: 0,
    qa_types: {
      ask_image: 0,
      ask_audio: 0,
      ask_both: 0
    }
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
};

export const mockRecords: DatasetRecord[] = [];
export const mockStats = calculateStats(mockRecords);
