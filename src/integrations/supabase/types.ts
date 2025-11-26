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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      highticket_data: {
        Row: {
          category: string
          client_id: string
          created_at: string
          harga: number
          id: string
          keterangan: string | null
          nama: string
          nama_ec: string
          nama_program: string
          nohp: string
          pelaksanaan_program: string | null
          status_payment: string
          tanggal_sh2m: string | null
          tanggal_transaksi: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          harga: number
          id?: string
          keterangan?: string | null
          nama: string
          nama_ec: string
          nama_program: string
          nohp: string
          pelaksanaan_program?: string | null
          status_payment?: string
          tanggal_sh2m?: string | null
          tanggal_transaksi: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          harga?: number
          id?: string
          keterangan?: string | null
          nama?: string
          nama_ec?: string
          nama_program?: string
          nohp?: string
          pelaksanaan_program?: string | null
          status_payment?: string
          tanggal_sh2m?: string | null
          tanggal_transaksi?: string
          updated_at?: string
        }
        Relationships: []
      }
      sh2m_data: {
        Row: {
          asal_iklan: string | null
          client_id: string
          created_at: string
          id: string
          jam: string | null
          keterangan: string | null
          nama_client: string
          nama_ec: string | null
          nohp_client: string
          source_iklan: string
          status_payment: string | null
          tanggal: string
          tanggal_update_paid: string | null
          updated_at: string
        }
        Insert: {
          asal_iklan?: string | null
          client_id: string
          created_at?: string
          id?: string
          jam?: string | null
          keterangan?: string | null
          nama_client: string
          nama_ec?: string | null
          nohp_client: string
          source_iklan: string
          status_payment?: string | null
          tanggal: string
          tanggal_update_paid?: string | null
          updated_at?: string
        }
        Update: {
          asal_iklan?: string | null
          client_id?: string
          created_at?: string
          id?: string
          jam?: string | null
          keterangan?: string | null
          nama_client?: string
          nama_ec?: string | null
          nohp_client?: string
          source_iklan?: string
          status_payment?: string | null
          tanggal?: string
          tanggal_update_paid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      source_iklan_categories: {
        Row: {
          created_at: string
          id: string
          kategori: string | null
          source_iklan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kategori?: string | null
          source_iklan: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kategori?: string | null
          source_iklan?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
