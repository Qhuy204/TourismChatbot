// New format aligned with export JSON structure

export interface GPS {
  lat: number;
  lon: number;
}

export interface Location {
  city: string;
  district: string;
  gps: GPS;
}

export interface ImageSpec {
  source?: string;
  original_url?: string;
  description?: string;
  license?: string;
  match_info?: string;
  resolution?: string;
}

export interface AudioSpec {
  transcript: string;
  voice_id: string;
}

export interface Metadata {
  landmark_name: string;
  location: Location;
  image_spec?: ImageSpec;
  audio_spec?: AudioSpec;
}

export interface QAVoice {
  id: string;
  rate?: string;
  pitch?: string;
  type?: string;
}

export interface QAAudioMeta {
  q_voice: QAVoice;
  a_voice: QAVoice;
}

export interface QAPaths {
  question_audio: string;
  answer_audio: string;
}

export interface QAPair {
  q: string;
  a: string;
  type: 'ask_image' | 'ask_audio' | 'ask_both';
  paths: QAPaths;
  audio_meta: QAAudioMeta;
}

export interface RecordPaths {
  image: string;
  audio_evidence?: string;
}

export interface DatasetRecord {
  id: string;
  timestamp: string;
  paths: RecordPaths;
  metadata: Metadata;
  qa_pairs: QAPair[];
  // Internal tracking
  status?: 'pending' | 'approved' | 'rejected' | 'needs_review';
  reviewedAt?: string;
  reviewedBy?: string;
  db_id?: string; // Supabase UUID
  // Import versioning
  import_version?: number;
  import_batch_id?: string;
  imported_at?: string;
  // Edit tracking
  updated_at?: string;
  updated_by?: string;
  edit_count?: number;
  // Soft delete
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
}

export interface DatasetStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  needs_review: number;
  qa_types: {
    ask_image: number;
    ask_audio: number;
    ask_both: number;
  };
}

export type AppRole = 'admin' | 'user';

export interface UserWithRole {
  id: string;
  email: string;
  display_name?: string;
  role: AppRole;
}

// Updated to match new schema
export interface AnnotationTask {
  task_id: string;
  task_name: string;
  assigned_to?: string;
  assigned_by?: string;
  status: 'open' | 'in_progress' | 'done' | 'archived';
  created_at: string;
  updated_at: string;
  // Computed
  assignee_name?: string;
  progress?: TaskProgress;
}

export interface TaskProgress {
  total: number;
  approved: number;
  pending: number;
  needs_review: number;
  rejected: number;
}

// Updated to match new schema (anno_task_details)
export interface AnnoTaskDetail {
  id: string;
  task_id: string;
  image_id: string;
  annotator_id?: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  reviewed_by?: string;
  reviewed_at?: string;
  updated_at?: string;
}
