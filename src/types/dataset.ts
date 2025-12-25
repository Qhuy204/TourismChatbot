export interface Location {
  city: string;
  district: string;
  lat_long: [number, number];
}

export interface Metadata {
  topic: string;
  entity_name: string;
  location: Location;
  tags: string[];
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
}

export type Scenario = 'text_ask_image' | 'audio_ask_image' | 'text_ask_audio' | 'audio_ask_audio';
export type Modality = 'image' | 'audio' | 'text';

export interface QAItem {
  qa_id: string;
  scenario: Scenario;
  modality_in: Modality[];
  query: Query;
  target: Target;
}

export interface DatasetRecord {
  record_id: string;
  metadata: Metadata;
  assets: Assets;
  qa_items: QAItem[];
  status?: 'pending' | 'reviewed' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface DatasetStats {
  total: number;
  pending: number;
  reviewed: number;
  approved: number;
  rejected: number;
  scenarios: Record<Scenario, number>;
}
