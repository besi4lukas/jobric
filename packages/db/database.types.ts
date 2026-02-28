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
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      application_events: {
        Row: {
          application_id: string
          classified_by: string | null
          confidence_score: number | null
          created_at: string | null
          email_message_id: string | null
          event_type: Database['public']['Enums']['event_type']
          id: string
          raw_snippet: string | null
          received_at: string
          sender: string | null
          subject: string | null
        }
        Insert: {
          application_id: string
          classified_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          email_message_id?: string | null
          event_type: Database['public']['Enums']['event_type']
          id?: string
          raw_snippet?: string | null
          received_at: string
          sender?: string | null
          subject?: string | null
        }
        Update: {
          application_id?: string
          classified_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          email_message_id?: string | null
          event_type?: Database['public']['Enums']['event_type']
          id?: string
          raw_snippet?: string | null
          received_at?: string
          sender?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'application_events_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string
          company_domain: string | null
          company_name: string
          created_at: string | null
          current_stage: Database['public']['Enums']['app_stage'] | null
          email_account_id: string | null
          id: string
          is_manual: boolean | null
          last_activity_at: string | null
          notes: string | null
          outcome: string | null
          role_title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_at: string
          company_domain?: string | null
          company_name: string
          created_at?: string | null
          current_stage?: Database['public']['Enums']['app_stage'] | null
          email_account_id?: string | null
          id?: string
          is_manual?: boolean | null
          last_activity_at?: string | null
          notes?: string | null
          outcome?: string | null
          role_title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string
          company_domain?: string | null
          company_name?: string
          created_at?: string | null
          current_stage?: Database['public']['Enums']['app_stage'] | null
          email_account_id?: string | null
          id?: string
          is_manual?: boolean | null
          last_activity_at?: string | null
          notes?: string | null
          outcome?: string | null
          role_title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'applications_email_account_id_fkey'
            columns: ['email_account_id']
            isOneToOne: false
            referencedRelation: 'email_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      email_accounts: {
        Row: {
          created_at: string | null
          email_address: string
          history_id: string | null
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_address: string
          history_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          refresh_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_address?: string
          history_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'email_accounts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      user_metrics: {
        Row: {
          avg_days_to_response: number | null
          computed_at: string | null
          interview_rate: number | null
          metrics_json: Json | null
          offer_rate: number | null
          response_rate: number | null
          total_applied: number | null
          user_id: string
        }
        Insert: {
          avg_days_to_response?: number | null
          computed_at?: string | null
          interview_rate?: number | null
          metrics_json?: Json | null
          offer_rate?: number | null
          response_rate?: number | null
          total_applied?: number | null
          user_id: string
        }
        Update: {
          avg_days_to_response?: number | null
          computed_at?: string | null
          interview_rate?: number | null
          metrics_json?: Json | null
          offer_rate?: number | null
          response_rate?: number | null
          total_applied?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_metrics_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_user_metrics: {
        Args: { target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_stage:
        | 'applied'
        | 'acknowledged'
        | 'assessment'
        | 'interview'
        | 'offer'
        | 'rejected'
        | 'withdrawn'
      event_type:
        | 'applied'
        | 'acknowledged'
        | 'assessment'
        | 'interview_invite'
        | 'interview_completed'
        | 'offer'
        | 'rejected'
        | 'withdrawn'
        | 'other'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_stage: [
        'applied',
        'acknowledged',
        'assessment',
        'interview',
        'offer',
        'rejected',
        'withdrawn',
      ],
      event_type: [
        'applied',
        'acknowledged',
        'assessment',
        'interview_invite',
        'interview_completed',
        'offer',
        'rejected',
        'withdrawn',
        'other',
      ],
    },
  },
} as const
