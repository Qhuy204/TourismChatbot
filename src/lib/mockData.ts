import { DatasetRecord, DatasetStats } from '@/types/dataset';

export const generateMockRecords = (count: number = 50): DatasetRecord[] => {
  const cities = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Huế', 'Hội An', 'Nha Trang', 'Đà Lạt', 'Hạ Long'];
  const districts = ['Ba Đình', 'Hoàn Kiếm', 'Quận 1', 'Quận 3', 'Hải Châu', 'Sơn Trà'];
  const topics = ['vietnam_landmark', 'vietnam_temple', 'vietnam_cuisine', 'vietnam_nature'];
  const entities = [
    'Chùa Một Cột', 'Hồ Hoàn Kiếm', 'Phố cổ Hội An', 'Cầu Rồng', 
    'Nhà thờ Đức Bà', 'Chợ Bến Thành', 'Vịnh Hạ Long', 'Cố đô Huế',
    'Tháp Bà Ponagar', 'Bãi biển Mỹ Khê', 'Đỉnh Fansipan', 'Hang Sơn Đoòng'
  ];
  const tags = ['architecture', 'buddhism', 'historic', 'nature', 'cuisine', 'culture', 'unesco'];
  const audioTypes: ('environment' | 'speech' | 'music')[] = ['environment', 'speech', 'music'];
  const scenarios: ('text_ask_image' | 'audio_ask_image' | 'text_ask_audio' | 'audio_ask_audio')[] = [
    'text_ask_image', 'audio_ask_image', 'text_ask_audio', 'audio_ask_audio'
  ];
  const statuses: ('pending' | 'reviewed' | 'approved' | 'rejected')[] = ['pending', 'reviewed', 'approved', 'rejected'];

  const records: DatasetRecord[] = [];

  for (let i = 0; i < count; i++) {
    const entity = entities[Math.floor(Math.random() * entities.length)];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const hasImage = scenario.includes('image');
    const hasAudio = scenario.includes('audio');

    const record: DatasetRecord = {
      record_id: `VN_LANDMARK_2025_${String(i + 1).padStart(4, '0')}`,
      metadata: {
        topic: topics[Math.floor(Math.random() * topics.length)],
        entity_name: entity,
        location: {
          city: cities[Math.floor(Math.random() * cities.length)],
          district: districts[Math.floor(Math.random() * districts.length)],
          lat_long: [20 + Math.random() * 3, 105 + Math.random() * 5]
        },
        tags: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => 
          tags[Math.floor(Math.random() * tags.length)]
        )
      },
      assets: {
        image_path: hasImage ? `data/images/${entity.toLowerCase().replace(/ /g, '_')}.jpg` : null,
        audio_evidence: hasAudio ? {
          path: `data/audio/evidence_${String(i + 1).padStart(3, '0')}.wav`,
          type: audioTypes[Math.floor(Math.random() * audioTypes.length)],
          transcript: 'Âm thanh môi trường tại địa điểm du lịch',
          duration_sec: Math.floor(Math.random() * 30) + 5,
          sr: 16000
        } : null
      },
      qa_items: [
        {
          qa_id: `qa_${String(i * 3 + 1).padStart(3, '0')}`,
          scenario: scenario,
          modality_in: scenario === 'text_ask_image' ? ['image', 'text'] :
                       scenario === 'audio_ask_image' ? ['image', 'audio'] :
                       scenario === 'text_ask_audio' ? ['audio', 'text'] : ['audio'],
          query: {
            text: scenario.startsWith('text') ? `Đây là câu hỏi mẫu về ${entity}?` : null,
            audio_query_path: scenario.startsWith('audio') ? `data/queries/query_${String(i + 1).padStart(3, '0')}.wav` : null,
            audio_query_transcript: scenario.startsWith('audio') ? `Câu hỏi bằng giọng nói về ${entity}` : null
          },
          target: {
            answer: `Đây là câu trả lời mẫu cho ${entity}.`,
            evidence_source: scenario.includes('image') ? 'image' : 'audio',
            answer_format: ['short_phrase', 'one_sentence', 'free'][Math.floor(Math.random() * 3)] as 'short_phrase' | 'one_sentence' | 'free'
          }
        }
      ],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      reviewedAt: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : undefined
    };

    records.push(record);
  }

  return records;
};

export const calculateStats = (records: DatasetRecord[]): DatasetStats => {
  const stats: DatasetStats = {
    total: records.length,
    pending: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
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

    record.qa_items.forEach(qa => {
      stats.scenarios[qa.scenario]++;
    });
  });

  return stats;
};

export const mockRecords = generateMockRecords(100);
export const mockStats = calculateStats(mockRecords);
