// Data parser - simplified for new format
// This module handles conversion from various input formats to the standard DatasetRecord format

import { DatasetRecord, QAPair } from '@/types/dataset';

export function detectAndParseFile(content: string, filename: string): { type: string; data: any[] } {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (ext === 'jsonl') {
    const lines = content.split('\n').filter(line => line.trim());
    const data = lines.map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    return { type: 'jsonl', data };
  }
  
  if (ext === 'json') {
    try {
      const parsed = JSON.parse(content);
      const data = Array.isArray(parsed) ? parsed : [parsed];
      return { type: 'json', data };
    } catch {
      return { type: 'unknown', data: [] };
    }
  }
  
  return { type: 'unknown', data: [] };
}

export function mergeDataByImageId(dataArrays: { type: string; data: any[]; filename: string }[]): Map<string, any> {
  const mergedMap = new Map<string, any>();

  for (const { data } of dataArrays) {
    for (const item of data) {
      const id = item.id || item.image_id || item.record_id || `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const existing = mergedMap.get(id) || { id };
      mergedMap.set(id, { ...existing, ...item });
    }
  }

  return mergedMap;
}

export function convertMergedDataToRecords(mergedMap: Map<string, any>): DatasetRecord[] {
  const records: DatasetRecord[] = [];
  let index = 0;

  mergedMap.forEach((item) => {
    records.push(convertToDatasetRecord(item, index++));
  });

  return records;
}

export function convertToDatasetRecord(item: any, index: number): DatasetRecord {
  // If already in correct format
  if (item.id && item.paths && item.metadata && item.qa_pairs) {
    return {
      ...item,
      status: item.status || 'pending'
    };
  }

  const idNumber = String(index + 1).padStart(3, '0');
  const id = item.id || `VN_LM_2025_${idNumber}_00`;

  const landmarkName = item.metadata?.landmark_name ||
    item.metadata?.geographic_info?.location_name ||
    item.metadata?.entity_name ||
    item.geographic_info?.location_name ||
    item.entity_name ||
    item.landmark_name ||
    'Unknown';

  const city = item.metadata?.location?.city ||
    item.metadata?.geographic_info?.city ||
    item.geographic_info?.city ||
    item.city ||
    '';
  
  const district = item.metadata?.location?.district ||
    item.metadata?.geographic_info?.district ||
    item.geographic_info?.district ||
    item.district ||
    '';

  const gpsLat = item.metadata?.location?.gps?.lat ||
    item.metadata?.geographic_info?.lat ||
    item.geographic_info?.lat ||
    item.lat ||
    0;
  
  const gpsLon = item.metadata?.location?.gps?.lon ||
    item.metadata?.geographic_info?.lon ||
    item.geographic_info?.lon ||
    item.lon ||
    0;

  const imagePath = item.paths?.image ||
    item.image_path ||
    item.file_path ||
    '';
  
  const audioEvidencePath = item.paths?.audio_evidence ||
    item.audio_evidence_path ||
    '';

  // Transcript extraction with priority ranking
  // Priority 1: exact "transcript" keyword
  // Priority 2: fallback to "description"
  const transcript = 
    item.metadata?.audio_spec?.transcript ||  // Priority 1
    item.audio_spec?.transcript ||             // Priority 1
    item.transcript ||                          // Priority 1
    item.metadata?.description ||               // Priority 2
    item.description ||                         // Priority 2
    item.metadata?.image_spec?.description ||   // Priority 2
    '';

  let qaPairs: QAPair[] = [];
  
  if (item.qa_pairs && Array.isArray(item.qa_pairs)) {
    qaPairs = item.qa_pairs.map((qa: any) => ({
      q: qa.q || qa.question || '',
      a: qa.a || qa.answer || qa.answers?.[0] || '',
      type: qa.type || 'ask_image',
      paths: qa.paths || { question_audio: '', answer_audio: '' },
      audio_meta: qa.audio_meta || {
        q_voice: { id: 'vi-VN-HoaiMyNeural' },
        a_voice: { id: 'vi-VN-HoaiMyNeural' }
      }
    }));
  } else if (item.vqa_pairs && Array.isArray(item.vqa_pairs)) {
    qaPairs = item.vqa_pairs.map((qa: any) => ({
      q: qa.question || '',
      a: qa.answers?.[0] || qa.answer || '',
      type: 'ask_image' as const,
      paths: { question_audio: '', answer_audio: '' },
      audio_meta: {
        q_voice: { id: 'vi-VN-HoaiMyNeural' },
        a_voice: { id: 'vi-VN-HoaiMyNeural' }
      }
    }));
  }

  const record: DatasetRecord = {
    id,
    timestamp: item.timestamp || new Date().toISOString(),
    paths: {
      image: imagePath,
      ...(audioEvidencePath && { audio_evidence: audioEvidencePath })
    },
    metadata: {
      landmark_name: landmarkName,
      location: {
        city,
        district,
        gps: {
          lat: typeof gpsLat === 'number' ? gpsLat : parseFloat(gpsLat) || 0,
          lon: typeof gpsLon === 'number' ? gpsLon : parseFloat(gpsLon) || 0
        }
      },
      // Add audio_spec with transcript if available
      ...(transcript && {
        audio_spec: {
          transcript,
          voice_id: item.metadata?.audio_spec?.voice_id || item.audio_spec?.voice_id || ''
        }
      })
    },
    qa_pairs: qaPairs,
    status: 'pending'
  };

  return record;
}

export function parseHuggingFaceDataset(repoContent: any[]): DatasetRecord[] {
  return repoContent.map((item, idx) => convertToDatasetRecord(item, idx));
}
