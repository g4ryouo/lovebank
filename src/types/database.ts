
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "couples": {
                  Row: {
                    "created_at": string,"daily_allowance": number,"id": string,"initial_grant": number,"invite_code": string,"invite_expires_at": string,"paired_at": string | null,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"daily_allowance"?: number,"id"?: string,"initial_grant"?: number,"invite_code": string,"invite_expires_at": string,"paired_at"?: string | null,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"daily_allowance"?: number,"id"?: string,"initial_grant"?: number,"invite_code"?: string,"invite_expires_at"?: string,"paired_at"?: string | null,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ledger": {
                  Row: {
                    "couple_id": string,"created_at": string,"delta": number,"group_id": string,"id": string,"note": string | null,"order_id": string | null,"period_key": string | null,"reason": Database["public"]['Enums']["ledger_reason"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"delta": number,"group_id": string,"id"?: string,"note"?: string | null,"order_id"?: string | null,"period_key"?: string | null,"reason": Database["public"]['Enums']["ledger_reason"],"user_id": string
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"delta"?: number,"group_id"?: string,"id"?: string,"note"?: string | null,"order_id"?: string | null,"period_key"?: string | null,"reason"?: Database["public"]['Enums']["ledger_reason"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_user_id_couple_id_fkey"
      columns: ["user_id","couple_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"limit_requests": {
                  Row: {
                    "couple_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"reason": string | null,"requested_limit": number,"requester_id": string,"status": Database["public"]['Enums']["limit_request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"reason"?: string | null,"requested_limit": number,"requester_id": string,"status"?: Database["public"]['Enums']["limit_request_status"]
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"reason"?: string | null,"requested_limit"?: number,"requester_id"?: string,"status"?: Database["public"]['Enums']["limit_request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "limit_requests_decided_by_couple_id_fkey"
      columns: ["decided_by","couple_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","couple_id"]
    },{
      foreignKeyName: "limit_requests_requester_id_couple_id_fkey"
      columns: ["requester_id","couple_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "active": boolean,"couple_id": string,"created_at": string,"emoji": string | null,"id": string,"owner_id": string,"price": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"couple_id": string,"created_at"?: string,"emoji"?: string | null,"id"?: string,"owner_id": string,"price": number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"couple_id"?: string,"created_at"?: string,"emoji"?: string | null,"id"?: string,"owner_id"?: string,"price"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_items_owner_id_couple_id_fkey"
      columns: ["owner_id","couple_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "accepted_at": string | null,"auto_confirm_at": string | null,"completed_at": string | null,"couple_id": string,"created_at": string,"done_at": string | null,"emoji_snapshot": string | null,"giver_id": string,"id": string,"initiated_by": string,"menu_item_id": string,"note": string | null,"price_snapshot": number,"receiver_id": string,"settled_amount": number | null,"status": Database["public"]['Enums']["order_status"],"title_snapshot": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"auto_confirm_at"?: string | null,"completed_at"?: string | null,"couple_id": string,"created_at"?: string,"done_at"?: string | null,"emoji_snapshot"?: string | null,"giver_id": string,"id"?: string,"initiated_by": string,"menu_item_id": string,"note"?: string | null,"price_snapshot": number,"receiver_id": string,"settled_amount"?: number | null,"status"?: Database["public"]['Enums']["order_status"],"title_snapshot": string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"auto_confirm_at"?: string | null,"completed_at"?: string | null,"couple_id"?: string,"created_at"?: string,"done_at"?: string | null,"emoji_snapshot"?: string | null,"giver_id"?: string,"id"?: string,"initiated_by"?: string,"menu_item_id"?: string,"note"?: string | null,"price_snapshot"?: number,"receiver_id"?: string,"settled_amount"?: number | null,"status"?: Database["public"]['Enums']["order_status"],"title_snapshot"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_menu_item_id_giver_id_couple_id_fkey"
      columns: ["menu_item_id","giver_id","couple_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id","owner_id","couple_id"]
    },{
      foreignKeyName: "orders_receiver_id_couple_id_fkey"
      columns: ["receiver_id","couple_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "couple_id": string | null,"created_at": string,"credit_limit": number,"id": string,"nickname": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id"?: string | null,"created_at"?: string,"credit_limit"?: number,"id": string,"nickname": string
                  }
                  Update: {
                    "couple_id"?: string | null,"created_at"?: string,"credit_limit"?: number,"id"?: string,"nickname"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    }
                  ]
                },"service_proposals": {
                  Row: {
                    "ai_comment": string | null,"ai_reviewed_at": string | null,"ai_verdict": Database["public"]['Enums']["ai_verdict"] | null,"counter_ai_comment": string | null,"counter_ai_verdict": Database["public"]['Enums']["ai_verdict"] | null,"counter_price": number | null,"couple_id": string,"created_at": string,"emoji": string | null,"id": string,"menu_item_id": string | null,"owner_id": string,"price": number,"proposer_id": string,"status": Database["public"]['Enums']["proposal_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_comment"?: string | null,"ai_reviewed_at"?: string | null,"ai_verdict"?: Database["public"]['Enums']["ai_verdict"] | null,"counter_ai_comment"?: string | null,"counter_ai_verdict"?: Database["public"]['Enums']["ai_verdict"] | null,"counter_price"?: number | null,"couple_id": string,"created_at"?: string,"emoji"?: string | null,"id"?: string,"menu_item_id"?: string | null,"owner_id": string,"price": number,"proposer_id": string,"status"?: Database["public"]['Enums']["proposal_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "ai_comment"?: string | null,"ai_reviewed_at"?: string | null,"ai_verdict"?: Database["public"]['Enums']["ai_verdict"] | null,"counter_ai_comment"?: string | null,"counter_ai_verdict"?: Database["public"]['Enums']["ai_verdict"] | null,"counter_price"?: number | null,"couple_id"?: string,"created_at"?: string,"emoji"?: string | null,"id"?: string,"menu_item_id"?: string | null,"owner_id"?: string,"price"?: number,"proposer_id"?: string,"status"?: Database["public"]['Enums']["proposal_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_proposals_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_proposals_owner_id_couple_id_fkey"
      columns: ["owner_id","couple_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","couple_id"]
    },{
      foreignKeyName: "service_proposals_proposer_id_couple_id_fkey"
      columns: ["proposer_id","couple_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                }
          }
          Views: {
            "balances": {
                  Row: {
                    "balance": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"reserved": {
                  Row: {
                    "reserved": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "current_couple_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "ai_verdict": "ok"|"caution"|"unavailable","ledger_reason": "initial"|"allowance"|"order"|"gift"|"adjustment","limit_request_status": "pending"|"approved"|"declined","order_status": "requested"|"accepted"|"done_by_giver"|"completed"|"declined"|"cancelled","proposal_status": "pending"|"countered"|"agreed"|"rejected"|"withdrawn"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "ai_verdict": ["ok", "caution", "unavailable"],"ledger_reason": ["initial", "allowance", "order", "gift", "adjustment"],"limit_request_status": ["pending", "approved", "declined"],"order_status": ["requested", "accepted", "done_by_giver", "completed", "declined", "cancelled"],"proposal_status": ["pending", "countered", "agreed", "rejected", "withdrawn"]
          }
        }
} as const
