export interface Location {
  city: string;
  district: string;
  lat_long: [number, number];
}

export interface GeographicInfo {
  lat?: string;
  lon?: string;
  location_type?: string;
  city?: string;
  location_name?: string;
  opening_hours?: string;
  ticket_price?: string;
}

export interface Metadata {
  topic: string;
  entity_name: string;
  location: Location;
  tags: string[];
  image_description?: string;
  knowledge_description?: string;
  geographic_info?: GeographicInfo;
}

export interface AudioEvidence {
  path: string;
  type: 'environment' | 'speech' | 'music';
  transcript: string;
  duration_sec: number;
  sr: number;
}

export interface Assets {
  image_path: string | null;
  image_url?: string | null;
  audio_evidence: AudioEvidence | null;
}

export interface Query {
  text: string | null;
  audio_query_path: string | null;
  audio_query_transcript: string | null;
}

export interface Target {
  answer: string;
  evidence_source: 'image' | 'audio';
  answer_format: 'short_phrase' | 'one_sentence' | 'free';
  alternative_answers?: string[];
}

export type Scenario = 'text_ask_image' | 'audio_ask_image' | 'text_ask_audio' | 'audio_ask_audio';
export type Modality = 'image' | 'audio' | 'text';

export interface QAItem {
  qa_id: string;
  scenario: Scenario;
  modality_in: Modality[];
  query: Query;
  target: Target;
  answer_type?: string;
}

export interface DatasetRecord {
  record_id: string;
  metadata: Metadata;
  assets: Assets;
  qa_items: QAItem[];
  status?: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'warning';
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatasetStats {
  total: number;
  pending: number;
  reviewed: number;
  approved: number;
  rejected: number;
  warning: number;
  scenarios: Record<Scenario, number>;
}
