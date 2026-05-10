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
        ]
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
        ]
      }
      clients: {
        Row: {
          accent_color: string | null
          brokerage: string | null
          business_name: string | null
          created_at: string
          headshot_url: string | null
          id: string
          logo_url: string | null
          owner_user_id: string
          phone: string | null
          primary_color: string | null
          site_status: Database["public"]["Enums"]["site_status"]
          site_url: string | null
          updated_at: string
          years_experience: string | null
        }
        Insert: {
          accent_color?: string | null
          brokerage?: string | null
          business_name?: string | null
          created_at?: string
          headshot_url?: string | null
          id?: string
          logo_url?: string | null
          owner_user_id: string
          phone?: string | null
          primary_color?: string | null
          site_status?: Database["public"]["Enums"]["site_status"]
          site_url?: string | null
          updated_at?: string
          years_experience?: string | null
        }
        Update: {
          accent_color?: string | null
          brokerage?: string | null
          business_name?: string | null
          created_at?: string
          headshot_url?: string | null
          id?: string
          logo_url?: string | null
          owner_user_id?: string
          phone?: string | null
          primary_color?: string | null
          site_status?: Database["public"]["Enums"]["site_status"]
          site_url?: string | null
          updated_at?: string
          years_experience?: string | null
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
        ]
      }
      posts: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          published_at: string | null
          scheduled_for: string | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          tag: string | null
          target_keyword: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          tag?: string | null
          target_keyword?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          tag?: string | null
          target_keyword?: string | null
          title?: string
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
      post_status: "draft" | "pending_review" | "scheduled" | "published"
      site_status: "pending" | "building" | "live"
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
      post_status: ["draft", "pending_review", "scheduled", "published"],
      site_status: ["pending", "building", "live"],
    },
  },
} as const
