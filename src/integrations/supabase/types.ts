export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_model_configs: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_enabled: boolean
          model_id: string
          model_name: string
          model_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          model_id: string
          model_name: string
          model_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          model_id?: string
          model_name?: string
          model_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      anno_task_details: {
        Row: {
          annotator_id: string | null
          created_at: string
          id: string
          image_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          task_id: string
          updated_at: string | null
        }
        Insert: {
          annotator_id?: string | null
          created_at?: string
          id?: string
          image_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_id: string
          updated_at?: string | null
        }
        Update: {
          annotator_id?: string | null
          created_at?: string
          id?: string
          image_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anno_task_details_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "dataset_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anno_task_details_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "annotation_tasks"
            referencedColumns: ["task_id"]
          },
        ]
      }
      annotation_tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          status: string
          task_id: string
          task_name: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          status?: string
          task_id?: string
          task_name: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          status?: string
          task_id?: string
          task_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          encrypted_key: string
          id: string
          is_active: boolean
          key_name: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encrypted_key: string
          id?: string
          is_active?: boolean
          key_name: string
          provider?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encrypted_key?: string
          id?: string
          is_active?: boolean
          key_name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      dataset_records: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          deleted_at: string | null
          deleted_by: string | null
          edit_count: number
          id: string
          import_batch_id: string | null
          import_version: number | null
          imported_at: string | null
          is_deleted: boolean
          record_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: Json
          deleted_at?: string | null
          deleted_by?: string | null
          edit_count?: number
          id?: string
          import_batch_id?: string | null
          import_version?: number | null
          imported_at?: string | null
          is_deleted?: boolean
          record_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          deleted_at?: string | null
          deleted_by?: string | null
          edit_count?: number
          id?: string
          import_batch_id?: string | null
          import_version?: number | null
          imported_at?: string | null
          is_deleted?: boolean
          record_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          annotations_count: number | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          qa_checks_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annotations_count?: number | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          qa_checks_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annotations_count?: number | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          qa_checks_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_usage: {
        Row: {
          created_at: string
          current_value: number
          id: string
          last_checked_at: string
          max_limit: number
          updated_at: string
          usage_type: string
          warning_threshold: number
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          last_checked_at?: string
          max_limit?: number
          updated_at?: string
          usage_type: string
          warning_threshold?: number
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          last_checked_at?: string
          max_limit?: number
          updated_at?: string
          usage_type?: string
          warning_threshold?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_events: {
        Row: {
          id: number
          user_id: string
          event_type: string
          event_name: string
          page: string | null
          object_type: string | null
          object_id: string | null
          duration_ms: number | null
          score: number
          payload: Json | null
          session_id: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          event_type: string
          event_name: string
          page?: string | null
          object_type?: string | null
          object_id?: string | null
          duration_ms?: number | null
          score?: number
          payload?: Json | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          event_type?: string
          event_name?: string
          page?: string | null
          object_type?: string | null
          object_id?: string | null
          duration_ms?: number | null
          score?: number
          payload?: Json | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      chat_logs: {
        Row: {
          id: number
          user_id: string
          session_id: string
          role: string
          message: string
          context: Json | null
          model_used: string | null
          response_time_ms: number | null
          feedback_score: number | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          session_id: string
          role: string
          message: string
          context?: Json | null
          model_used?: string | null
          response_time_ms?: number | null
          feedback_score?: number | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          session_id?: string
          role?: string
          message?: string
          context?: Json | null
          model_used?: string | null
          response_time_ms?: number | null
          feedback_score?: number | null
          created_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          theme: string | null
          animation_level: string | null
          last_detected_emotion: string | null
          emotion_confidence: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string | null
          animation_level?: string | null
          last_detected_emotion?: string | null
          emotion_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme?: string | null
          animation_level?: string | null
          last_detected_emotion?: string | null
          emotion_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations_cache: {
        Row: {
          id: number
          name: string
          name_normalized: string
          city: string | null
          province: string | null
          category: string
          description: string | null
          details: Json | null
          source_response_id: number | null
          extracted_at: string
        }
        Insert: {
          id?: number
          name: string
          name_normalized: string
          city?: string | null
          province?: string | null
          category?: string
          description?: string | null
          details?: Json | null
          source_response_id?: number | null
          extracted_at?: string
        }
        Update: {
          id?: number
          name?: string
          name_normalized?: string
          city?: string | null
          province?: string | null
          category?: string
          description?: string | null
          details?: Json | null
          source_response_id?: number | null
          extracted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_cache_source_response_id_fkey"
            columns: ["source_response_id"]
            isOneToOne: false
            referencedRelation: "chat_logs"
            referencedColumns: ["id"]
          }
        ]
      }
      model_evaluations: {
        Row: {
          id: number
          chat_log_id: number | null
          session_id: string
          response_latency_ms: number | null
          context_relevance: number | null
          context_count: number | null
          model_used: string | null
          hallucination_score: number | null
          response_length: number | null
          user_feedback_score: number | null
          evaluated_at: string
        }
        Insert: {
          id?: number
          chat_log_id?: number | null
          session_id: string
          response_latency_ms?: number | null
          context_relevance?: number | null
          context_count?: number | null
          model_used?: string | null
          hallucination_score?: number | null
          response_length?: number | null
          user_feedback_score?: number | null
          evaluated_at?: string
        }
        Update: {
          id?: number
          chat_log_id?: number | null
          session_id?: string
          response_latency_ms?: number | null
          context_relevance?: number | null
          context_count?: number | null
          model_used?: string | null
          hallucination_score?: number | null
          response_length?: number | null
          user_feedback_score?: number | null
          evaluated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_evaluations_chat_log_id_fkey"
            columns: ["chat_log_id"]
            isOneToOne: false
            referencedRelation: "chat_logs"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
