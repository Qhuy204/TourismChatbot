import { DatasetRecord, QAItem, Scenario, GeographicInfo } from '@/types/dataset';

// Types for different import formats
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MetadataFormat {
  image_id: string;
  image_url?: string;
  page_url?: string;
  keyword?: string;
  site?: string;
  creator_name?: string;
  author_name?: string;
  copyright_statement?: string;
  license_info?: string;
  source?: string;
  timestamp?: number;
  file_path?: string;
  download_timestamp?: number;
  file_size?: number;
}

interface VQAPair {
  question_id: string;
  question: string;
  answers: string[];
  answer_type?: string;
}

interface GeographicFormat {
  image_id: string;
  image_url?: string;
  geographic_info?: {
    lat?: string | number;
    lon?: string | number;
    location_type?: string;
    city?: string;
    district?: string;
    location_name?: string;
    opening_hours?: string;
    ticket_price?: string;
    page_url?: string;
    license_info?: string;
  };
  image_description?: string;
  knowledge_description?: string;
  vqa_pairs?: VQAPair[];
  __source_file_path?: string;
}

interface JSONLFormat {
  image_id: string;
  file_path?: string;
  image_url?: string;
  vqa_pairs?: VQAPair[];
}

interface ConversationFormat {
  image_id: string;
  conversations: ConversationMessage[];
}

// Temporary structure for merging
interface MergedData {
  image_id: string;
  file_path?: string;
  image_url?: string;
  metadata?: Partial<MetadataFormat>;
  conversations?: ConversationMessage[];
  vqa_pairs?: VQAPair[];
  geographic_info?: GeographicInfo;
  image_description?: string;
  knowledge_description?: string;
}

export function parseConversationToQAItems(conversations: ConversationMessage[]): QAItem[] {
  const qaItems: QAItem[] = [];
  let qaIndex = 0;

  for (let i = 0; i < conversations.length - 1; i += 2) {
    if (conversations[i].role === 'user' && conversations[i + 1]?.role === 'assistant') {
      qaItems.push({
        qa_id: `qa_${qaIndex++}`,
        scenario: 'text_ask_image',
        modality_in: ['image', 'text'],
        query: {
          text: conversations[i].content,
          audio_query_path: null,
          audio_query_transcript: null,
        },
        target: {
          answer: conversations[i + 1].content,
          evidence_source: 'image',
          answer_format: conversations[i + 1].content.length > 100 ? 'free' : 'one_sentence',
        },
      });
    }
  }

  return qaItems;
}

export function parseVQAPairsToQAItems(vqaPairs: VQAPair[]): QAItem[] {
  return vqaPairs.map((pair, index) => ({
    qa_id: pair.question_id || `qa_${index}`,
    scenario: 'text_ask_image' as Scenario,
    modality_in: ['image', 'text'] as ('image' | 'audio' | 'text')[],
    query: {
      text: pair.question,
      audio_query_path: null,
      audio_query_transcript: null,
    },
    target: {
      answer: pair.answers[0] || '',
      evidence_source: 'image' as const,
      answer_format: (pair.answers[0]?.length || 0) > 100 ? 'free' as const : 'one_sentence' as const,
      alternative_answers: pair.answers.slice(1),
    },
    answer_type: pair.answer_type,
  }));
}

export function parseJSONL(content: string): JSONLFormat[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean) as JSONLFormat[];
}

export function parseJSON(content: string): any[] {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export function extractImageIdFromFilename(filename: string): string | null {
  const match = filename.match(/IMG\d+/i);
  return match ? match[0].toUpperCase() : null;
}

export function detectAndParseFile(content: string, filename: string): { type: string; data: any[] } {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (ext === 'jsonl') {
    return { type: 'jsonl', data: parseJSONL(content) };
  }
  
  if (ext === 'json') {
    const parsed = parseJSON(content);
    // Detect format type
    if (parsed.length > 0) {
      const firstItem = parsed[0];
      
      // Check for geographic format (has geographic_info or image_description or knowledge_description)
      if (firstItem.geographic_info || firstItem.image_description || firstItem.knowledge_description) {
        return { type: 'geographic', data: parsed };
      }
      
      if (firstItem.vqa_pairs) {
        return { type: 'vqa', data: parsed };
      }
      if (firstItem.conversations || (Array.isArray(parsed) && firstItem?.role)) {
        return { type: 'conversation', data: parsed };
      }
      if (firstItem.image_id && firstItem.file_path && !firstItem.vqa_pairs) {
        return { type: 'metadata', data: parsed };
      }
    }
    return { type: 'unknown', data: parsed };
  }
  
  return { type: 'unknown', data: [] };
}

export function mergeDataByImageId(dataArrays: { type: string; data: any[]; filename: string }[]): Map<string, MergedData> {
  const mergedMap = new Map<string, MergedData>();

  for (const { type, data, filename } of dataArrays) {
    for (const item of data) {
      let imageId: string | null = item.image_id;
      
      // Try to extract image_id from filename if not present
      if (!imageId) {
        imageId = extractImageIdFromFilename(filename);
      }
      
      if (!imageId) continue;

      const existing: MergedData = mergedMap.get(imageId) || { image_id: imageId };

      switch (type) {
        case 'metadata':
          existing.metadata = { ...existing.metadata, ...item };
          existing.file_path = existing.file_path || item.file_path;
          existing.image_url = existing.image_url || item.image_url;
          break;
        case 'geographic':
          existing.file_path = existing.file_path || item.__source_file_path || item.file_path;
          existing.image_url = existing.image_url || item.image_url;
          existing.geographic_info = { ...existing.geographic_info, ...item.geographic_info };
          existing.image_description = existing.image_description || item.image_description;
          existing.knowledge_description = existing.knowledge_description || item.knowledge_description;
          if (item.vqa_pairs) {
            existing.vqa_pairs = [...(existing.vqa_pairs || []), ...item.vqa_pairs];
          }
          break;
        case 'vqa':
        case 'jsonl':
          existing.file_path = existing.file_path || item.file_path;
          existing.image_url = existing.image_url || item.image_url;
          if (item.vqa_pairs) {
            existing.vqa_pairs = [...(existing.vqa_pairs || []), ...item.vqa_pairs];
          }
          break;
        case 'conversation':
          if (Array.isArray(item) && item[0]?.role) {
            existing.conversations = [...(existing.conversations || []), ...item];
          } else if (item.conversations) {
            existing.conversations = [...(existing.conversations || []), ...item.conversations];
          }
          break;
      }

      mergedMap.set(imageId, existing);
    }
  }

  return mergedMap;
}

export function convertMergedDataToRecords(mergedMap: Map<string, MergedData>): DatasetRecord[] {
  const records: DatasetRecord[] = [];

  mergedMap.forEach((data, imageId) => {
    const qaItems: QAItem[] = [];

    // Add QA items from VQA pairs
    if (data.vqa_pairs && data.vqa_pairs.length > 0) {
      qaItems.push(...parseVQAPairsToQAItems(data.vqa_pairs));
    }

    // Add QA items from conversations
    if (data.conversations && data.conversations.length > 0) {
      qaItems.push(...parseConversationToQAItems(data.conversations));
    }

    // Skip if no QA items - create placeholder
    if (qaItems.length === 0) {
      qaItems.push({
        qa_id: `qa_${imageId}_0`,
        scenario: 'text_ask_image',
        modality_in: ['image', 'text'],
        query: {
          text: 'Mô tả nội dung hình ảnh',
          audio_query_path: null,
          audio_query_transcript: null,
        },
        target: {
          answer: data.image_description || '',
          evidence_source: 'image',
          answer_format: 'free',
        },
      });
    }

    // Parse coordinates from geographic_info
    let lat = 0, lon = 0;
    if (data.geographic_info) {
      const geoLat = data.geographic_info.lat;
      const geoLon = data.geographic_info.lon;
      lat = typeof geoLat === 'number' ? geoLat : parseFloat(geoLat || '0') || 0;
      lon = typeof geoLon === 'number' ? geoLon : parseFloat(geoLon || '0') || 0;
    }

    const record: DatasetRecord = {
      record_id: imageId,
      metadata: {
        topic: data.metadata?.keyword || data.geographic_info?.location_type || 'imported_data',
        entity_name: data.geographic_info?.location_name || data.metadata?.keyword?.replace(/-/g, ' ') || imageId,
        location: {
          city: data.geographic_info?.city || 'Unknown',
          district: data.geographic_info?.district || '',
          lat_long: [lat, lon],
        },
        tags: data.metadata?.source ? [data.metadata.source] : (data.geographic_info?.location_type?.split(', ') || ['imported']),
        image_description: data.image_description,
        knowledge_description: data.knowledge_description,
        geographic_info: {
          ...data.geographic_info,
          // Auto-map fields from different input formats
          page_url: data.geographic_info?.page_url || data.metadata?.page_url,
          license_info: data.geographic_info?.license_info || data.metadata?.license_info,
        },
      },
      assets: {
        image_path: data.file_path || null,
        image_url: data.image_url || null,
        audio_evidence: null,
      },
      qa_items: qaItems,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    records.push(record);
  });

  return records;
}

export function parseHuggingFaceDataset(repoContent: any[]): DatasetRecord[] {
  // Handle Hugging Face dataset format
  const mergedMap = new Map<string, MergedData>();

  for (const item of repoContent) {
    const imageId = item.image_id || item.id || `HF_${Math.random().toString(36).substr(2, 9)}`;
    
    const existing: MergedData = mergedMap.get(imageId) || { image_id: imageId };
    
    existing.file_path = existing.file_path || item.file_path || item.image_path;
    existing.image_url = existing.image_url || item.image_url || item.image;
    
    if (item.geographic_info) {
      existing.geographic_info = { ...existing.geographic_info, ...item.geographic_info };
    }
    
    if (item.image_description) {
      existing.image_description = item.image_description;
    }
    
    if (item.knowledge_description) {
      existing.knowledge_description = item.knowledge_description;
    }
    
    if (item.vqa_pairs) {
      existing.vqa_pairs = [...(existing.vqa_pairs || []), ...item.vqa_pairs];
    }
    
    if (item.conversations) {
      existing.conversations = [...(existing.conversations || []), ...item.conversations];
    }
    
    if (item.question && item.answer) {
      existing.vqa_pairs = existing.vqa_pairs || [];
      existing.vqa_pairs.push({
        question_id: `${imageId}_Q_${existing.vqa_pairs.length}`,
        question: item.question,
        answers: [item.answer],
        answer_type: item.answer_type || 'general',
      });
    }

    mergedMap.set(imageId, existing);
  }

  return convertMergedDataToRecords(mergedMap);
}
