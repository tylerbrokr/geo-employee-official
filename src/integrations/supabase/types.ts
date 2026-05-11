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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      change_requests: {
        Row: {
          admin_response: string | null
          category: Database["public"]["Enums"]["change_request_category"]
          client_id: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["change_request_status"]
        }
        Insert: {
          admin_response?: string | null
          category: Database["public"]["Enums"]["change_request_category"]
          client_id: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Update: {
          admin_response?: string | null
          category?: Database["public"]["Enums"]["change_request_category"]
          client_id?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_client_profile"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_areas: {
        Row: {
          ai_generated_at: string | null
          ai_model: string | null
          area_type: string
          client_id: string
          created_at: string
          faqs: Json
          id: string
          intro: string
          manually_edited: Json
          market_blurb: string
          meta_description: string
          meta_title: string
          name: string
          parent_area_id: string | null
          slug: string
          stale: boolean
          state: string | null
          updated_at: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_model?: string | null
          area_type: string
          client_id: string
          created_at?: string
          faqs?: Json
          id?: string
          intro?: string
          manually_edited?: Json
          market_blurb?: string
          meta_description?: string
          meta_title?: string
          name: string
          parent_area_id?: string | null
          slug: string
          stale?: boolean
          state?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_model?: string | null
          area_type?: string
          client_id?: string
          created_at?: string
          faqs?: Json
          id?: string
          intro?: string
          manually_edited?: Json
          market_blurb?: string
          meta_description?: string
          meta_title?: string
          name?: string
          parent_area_id?: string | null
          slug?: string
          stale?: boolean
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_areas_parent_area_id_fkey"
            columns: ["parent_area_id"]
            isOneToOne: false
            referencedRelation: "client_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      client_markets: {
        Row: {
          cities: string[]
          client_id: string
          counties: string[]
          id: string
          neighborhoods: string[]
          primary_city: string | null
          primary_state: string | null
          updated_at: string
        }
        Insert: {
          cities?: string[]
          client_id: string
          counties?: string[]
          id?: string
          neighborhoods?: string[]
          primary_city?: string | null
          primary_state?: string | null
          updated_at?: string
        }
        Update: {
          cities?: string[]
          client_id?: string
          counties?: string[]
          id?: string
          neighborhoods?: string[]
          primary_city?: string | null
          primary_state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_markets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_markets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "public_client_profile"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_sites: {
        Row: {
          agent_display_name: string | null
          client_id: string
          cloudflare_hostname_id: string | null
          created_at: string
          custom_domain: string | null
          dns_records: Json | null
          dns_verified: boolean
          id: string
          last_verified_at: string | null
          provisioned_at: string | null
          ssl_status: string | null
          subdomain: string | null
          updated_at: string
          verification_token: string | null
          verify_attempts: number
        }
        Insert: {
          agent_display_name?: string | null
          client_id: string
          cloudflare_hostname_id?: string | null
          created_at?: string
          custom_domain?: string | null
          dns_records?: Json | null
          dns_verified?: boolean
          id?: string
          last_verified_at?: string | null
          provisioned_at?: string | null
          ssl_status?: string | null
          subdomain?: string | null
          updated_at?: string
          verification_token?: string | null
          verify_attempts?: number
        }
        Update: {
          agent_display_name?: string | null
          client_id?: string
          cloudflare_hostname_id?: string | null
          created_at?: string
          custom_domain?: string | null
          dns_records?: Json | null
          dns_verified?: boolean
          id?: string
          last_verified_at?: string | null
          provisioned_at?: string | null
          ssl_status?: string | null
          subdomain?: string | null
          updated_at?: string
          verification_token?: string | null
          verify_attempts?: number
        }
        Relationships: []
      }
      client_specialties: {
        Row: {
          client_id: string
          created_at: string
          id: string
          specialty: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          specialty: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          specialty?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_specialties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_specialties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_client_profile"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_topics: {
        Row: {
          client_id: string
          created_at: string
          geo_scope: string | null
          h2s: string[]
          id: string
          kind: Database["public"]["Enums"]["topic_kind"]
          niche: string | null
          position: number
          primary_keyword: string | null
          secondary_keywords: string[]
          status: Database["public"]["Enums"]["topic_status"]
          talking_points: string[]
          title: string
          updated_at: string
          used_at: string | null
          word_count: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          geo_scope?: string | null
          h2s?: string[]
          id?: string
          kind: Database["public"]["Enums"]["topic_kind"]
          niche?: string | null
          position?: number
          primary_keyword?: string | null
          secondary_keywords?: string[]
          status?: Database["public"]["Enums"]["topic_status"]
          talking_points?: string[]
          title: string
          updated_at?: string
          used_at?: string | null
          word_count?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          geo_scope?: string | null
          h2s?: string[]
          id?: string
          kind?: Database["public"]["Enums"]["topic_kind"]
          niche?: string | null
          position?: number
          primary_keyword?: string | null
          secondary_keywords?: string[]
          status?: Database["public"]["Enums"]["topic_status"]
          talking_points?: string[]
          title?: string
          updated_at?: string
          used_at?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          accent_color: string | null
          autopilot_day: number | null
          autopilot_enabled: boolean
          autopilot_started_at: string | null
          brokerage: string | null
          brokerage_story: string | null
          business_name: string | null
          city: string | null
          created_at: string
          differentiators: string | null
          headshot_url: string | null
          id: string
          ideal_client: string | null
          last_autopublish_at: string | null
          logo_url: string | null
          owner_user_id: string
          phone: string | null
          phone_e164: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          postal_code: string | null
          primary_color: string | null
          property_types: string[]
          site_status: Database["public"]["Enums"]["site_status"]
          site_url: string | null
          state: string | null
          street_address: string | null
          updated_at: string
          values_text: string | null
          voice: string | null
          years_experience: string | null
        }
        Insert: {
          accent_color?: string | null
          autopilot_day?: number | null
          autopilot_enabled?: boolean
          autopilot_started_at?: string | null
          brokerage?: string | null
          brokerage_story?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          differentiators?: string | null
          headshot_url?: string | null
          id?: string
          ideal_client?: string | null
          last_autopublish_at?: string | null
          logo_url?: string | null
          owner_user_id: string
          phone?: string | null
          phone_e164?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          postal_code?: string | null
          primary_color?: string | null
          property_types?: string[]
          site_status?: Database["public"]["Enums"]["site_status"]
          site_url?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          values_text?: string | null
          voice?: string | null
          years_experience?: string | null
        }
        Update: {
          accent_color?: string | null
          autopilot_day?: number | null
          autopilot_enabled?: boolean
          autopilot_started_at?: string | null
          brokerage?: string | null
          brokerage_story?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          differentiators?: string | null
          headshot_url?: string | null
          id?: string
          ideal_client?: string | null
          last_autopublish_at?: string | null
          logo_url?: string | null
          owner_user_id?: string
          phone?: string | null
          phone_e164?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          postal_code?: string | null
          primary_color?: string | null
          property_types?: string[]
          site_status?: Database["public"]["Enums"]["site_status"]
          site_url?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          values_text?: string | null
          voice?: string | null
          years_experience?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string
          provider_id: string | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id: string
          provider_id?: string | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string
          provider_id?: string | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_template_copy: {
        Row: {
          body_paragraphs: string[]
          cta_label: string
          eyebrow: string
          headline: string
          signature_line_1: string
          signature_line_2: string
          subject: string
          template_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_paragraphs?: string[]
          cta_label?: string
          eyebrow?: string
          headline: string
          signature_line_1?: string
          signature_line_2?: string
          subject: string
          template_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_paragraphs?: string[]
          cta_label?: string
          eyebrow?: string
          headline?: string
          signature_line_1?: string
          signature_line_2?: string
          subject?: string
          template_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      intake_status: {
        Row: {
          client_id: string
          completed_at: string | null
          current_step: number
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          current_step?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          current_step?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "public_client_profile"
            referencedColumns: ["client_id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string
          client_id: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          scheduled_for: string | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          tag: string | null
          target_keyword: string | null
          title: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          client_id: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          tag?: string | null
          target_keyword?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          tag?: string | null
          target_keyword?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_client_profile"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "posts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "client_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_cache_purges: {
        Row: {
          attempt_count: number
          client_id: string
          created_at: string
          hostname: string
          id: string
          last_error: string | null
          paths: string[]
          purge_trigger: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          client_id: string
          created_at?: string
          hostname: string
          id?: string
          last_error?: string | null
          paths?: string[]
          purge_trigger: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          client_id?: string
          created_at?: string
          hostname?: string
          id?: string
          last_error?: string | null
          paths?: string[]
          purge_trigger?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_cache_purges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_cache_purges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_client_profile"
            referencedColumns: ["client_id"]
          },
        ]
      }
      site_copy: {
        Row: {
          ai_generated_at: string | null
          ai_model: string | null
          area_blurb: string
          bio_long: string
          bio_short: string
          client_id: string
          created_at: string
          ideal_client_blurb: string
          manually_edited: Json
          meta_description: string
          meta_title: string
          og_image_url: string | null
          stale: boolean
          tagline: string
          updated_at: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_model?: string | null
          area_blurb?: string
          bio_long?: string
          bio_short?: string
          client_id: string
          created_at?: string
          ideal_client_blurb?: string
          manually_edited?: Json
          meta_description?: string
          meta_title?: string
          og_image_url?: string | null
          stale?: boolean
          tagline?: string
          updated_at?: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_model?: string | null
          area_blurb?: string
          bio_long?: string
          bio_short?: string
          client_id?: string
          created_at?: string
          ideal_client_blurb?: string
          manually_edited?: Json
          meta_description?: string
          meta_title?: string
          og_image_url?: string | null
          stale?: boolean
          tagline?: string
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      public_client_areas: {
        Row: {
          area_type: string | null
          client_id: string | null
          faqs: Json | null
          intro: string | null
          market_blurb: string | null
          meta_description: string | null
          meta_title: string | null
          name: string | null
          slug: string | null
          state: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_client_market: {
        Row: {
          cities: string[] | null
          client_id: string | null
          counties: string[] | null
          neighborhoods: string[] | null
          primary_city: string | null
          primary_state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_markets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_markets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "public_client_profile"
            referencedColumns: ["client_id"]
          },
        ]
      }
      public_client_profile: {
        Row: {
          accent_color: string | null
          brokerage: string | null
          brokerage_story: string | null
          business_name: string | null
          client_id: string | null
          differentiators: string | null
          headshot_url: string | null
          ideal_client: string | null
          logo_url: string | null
          primary_color: string | null
          property_types: string[] | null
          values_text: string | null
          voice: string | null
          years_experience: string | null
        }
        Relationships: []
      }
      public_client_site: {
        Row: {
          agent_display_name: string | null
          client_id: string | null
          custom_domain: string | null
          provisioned_at: string | null
          ssl_status: string | null
          subdomain: string | null
        }
        Insert: {
          agent_display_name?: string | null
          client_id?: string | null
          custom_domain?: string | null
          provisioned_at?: string | null
          ssl_status?: string | null
          subdomain?: string | null
        }
        Update: {
          agent_display_name?: string | null
          client_id?: string | null
          custom_domain?: string | null
          provisioned_at?: string | null
          ssl_status?: string | null
          subdomain?: string | null
        }
        Relationships: []
      }
      public_site_copy: {
        Row: {
          area_blurb: string | null
          bio_long: string | null
          bio_short: string | null
          client_id: string | null
          ideal_client_blurb: string | null
          meta_description: string | null
          meta_title: string | null
          tagline: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      change_request_category:
        | "market"
        | "specialty"
        | "brand"
        | "profile"
        | "other"
      change_request_status: "open" | "in_progress" | "resolved"
      pipeline_stage:
        | "draft"
        | "intake_sent"
        | "intake_complete"
        | "site_live"
        | "topics_ready"
        | "autopilot"
      post_status: "draft" | "pending_review" | "scheduled" | "published"
      site_status: "pending" | "building" | "live"
      topic_kind: "seo" | "geo"
      topic_status: "queued" | "used" | "skipped"
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
      app_role: ["admin", "client"],
      change_request_category: [
        "market",
        "specialty",
        "brand",
        "profile",
        "other",
      ],
      change_request_status: ["open", "in_progress", "resolved"],
      pipeline_stage: [
        "draft",
        "intake_sent",
        "intake_complete",
        "site_live",
        "topics_ready",
        "autopilot",
      ],
      post_status: ["draft", "pending_review", "scheduled", "published"],
      site_status: ["pending", "building", "live"],
      topic_kind: ["seo", "geo"],
      topic_status: ["queued", "used", "skipped"],
    },
  },
} as const
