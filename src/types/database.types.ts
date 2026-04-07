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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      atribuicoes: {
        Row: {
          competencia: string | null
          concluida_em: string | null
          created_at: string
          evidencia_url: string | null
          filho_id: string
          id: string
          nota_rejeicao: string | null
          pontos_snapshot: number
          status: Database["public"]["Enums"]["atribuicao_status"]
          tarefa_id: string
          validada_em: string | null
          validada_por: string | null
        }
        Insert: {
          competencia?: string | null
          concluida_em?: string | null
          created_at?: string
          evidencia_url?: string | null
          filho_id: string
          id?: string
          nota_rejeicao?: string | null
          pontos_snapshot: number
          status?: Database["public"]["Enums"]["atribuicao_status"]
          tarefa_id: string
          validada_em?: string | null
          validada_por?: string | null
        }
        Update: {
          competencia?: string | null
          concluida_em?: string | null
          created_at?: string
          evidencia_url?: string | null
          filho_id?: string
          id?: string
          nota_rejeicao?: string | null
          pontos_snapshot?: number
          status?: Database["public"]["Enums"]["atribuicao_status"]
          tarefa_id?: string
          validada_em?: string | null
          validada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_filho_id_fkey"
            columns: ["filho_id"]
            isOneToOne: false
            referencedRelation: "filhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_validada_por_fkey"
            columns: ["validada_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          alvo_id: string | null
          alvo_tipo: string
          created_at: string
          detalhes: Json | null
          familia_id: string
          id: string
          operador_id: string
        }
        Insert: {
          acao: string
          alvo_id?: string | null
          alvo_tipo: string
          created_at?: string
          detalhes?: Json | null
          familia_id: string
          id?: string
          operador_id: string
        }
        Update: {
          acao?: string
          alvo_id?: string | null
          alvo_tipo?: string
          created_at?: string
          detalhes?: Json | null
          familia_id?: string
          id?: string
          operador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      familias: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      filhos: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          familia_id: string
          id: string
          nome: string
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          familia_id: string
          id?: string
          nome: string
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          familia_id?: string
          id?: string
          nome?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filhos_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          created_at: string
          descricao: string
          filho_id: string
          id: string
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["movimentacao_tipo"]
          valor: number
        }
        Insert: {
          created_at?: string
          descricao: string
          filho_id: string
          id?: string
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["movimentacao_tipo"]
          valor: number
        }
        Update: {
          created_at?: string
          descricao?: string
          filho_id?: string
          id?: string
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["movimentacao_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_filho_id_fkey"
            columns: ["filho_id"]
            isOneToOne: false
            referencedRelation: "filhos"
            referencedColumns: ["id"]
          },
        ]
      }
      premios: {
        Row: {
          ativo: boolean
          created_at: string
          custo_pontos: number
          descricao: string | null
          familia_id: string
          id: string
          imagem_url: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_pontos: number
          descricao?: string | null
          familia_id: string
          id?: string
          imagem_url?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_pontos?: number
          descricao?: string | null
          familia_id?: string
          id?: string
          imagem_url?: string | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "premios_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_id: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      resgates: {
        Row: {
          created_at: string
          familia_id: string
          filho_id: string
          id: string
          pontos_debitados: number
          premio_id: string
          status: Database["public"]["Enums"]["resgate_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          familia_id: string
          filho_id: string
          id?: string
          pontos_debitados: number
          premio_id: string
          status?: Database["public"]["Enums"]["resgate_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          familia_id?: string
          filho_id?: string
          id?: string
          pontos_debitados?: number
          premio_id?: string
          status?: Database["public"]["Enums"]["resgate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resgates_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgates_filho_id_fkey"
            columns: ["filho_id"]
            isOneToOne: false
            referencedRelation: "filhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgates_premio_id_fkey"
            columns: ["premio_id"]
            isOneToOne: false
            referencedRelation: "premios"
            referencedColumns: ["id"]
          },
        ]
      }
      resgates_cofrinho: {
        Row: {
          created_at: string
          filho_id: string
          id: string
          status: Database["public"]["Enums"]["resgate_status"]
          taxa_aplicada: number
          updated_at: string
          valor_liquido: number
          valor_solicitado: number
        }
        Insert: {
          created_at?: string
          filho_id: string
          id?: string
          status?: Database["public"]["Enums"]["resgate_status"]
          taxa_aplicada: number
          updated_at?: string
          valor_liquido: number
          valor_solicitado: number
        }
        Update: {
          created_at?: string
          filho_id?: string
          id?: string
          status?: Database["public"]["Enums"]["resgate_status"]
          taxa_aplicada?: number
          updated_at?: string
          valor_liquido?: number
          valor_solicitado?: number
        }
        Relationships: [
          {
            foreignKeyName: "resgates_cofrinho_filho_id_fkey"
            columns: ["filho_id"]
            isOneToOne: false
            referencedRelation: "filhos"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos: {
        Row: {
          cofrinho: number
          data_ultima_valorizacao: string | null
          filho_id: string
          id: string
          indice_valorizacao: number
          periodo_valorizacao: Database["public"]["Enums"]["periodo_valorizacao"]
          proxima_valorizacao_em: string | null
          saldo_livre: number
          taxa_resgate_cofrinho: number
          updated_at: string
        }
        Insert: {
          cofrinho?: number
          data_ultima_valorizacao?: string | null
          filho_id: string
          id?: string
          indice_valorizacao?: number
          periodo_valorizacao?: Database["public"]["Enums"]["periodo_valorizacao"]
          proxima_valorizacao_em?: string | null
          saldo_livre?: number
          taxa_resgate_cofrinho?: number
          updated_at?: string
        }
        Update: {
          cofrinho?: number
          data_ultima_valorizacao?: string | null
          filho_id?: string
          id?: string
          indice_valorizacao?: number
          periodo_valorizacao?: Database["public"]["Enums"]["periodo_valorizacao"]
          proxima_valorizacao_em?: string | null
          saldo_livre?: number
          taxa_resgate_cofrinho?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saldos_filho_id_fkey"
            columns: ["filho_id"]
            isOneToOne: true
            referencedRelation: "filhos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          descricao: string | null
          exige_evidencia: boolean
          familia_id: string
          frequencia: Database["public"]["Enums"]["tarefa_frequencia"]
          id: string
          pontos: number
          titulo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          exige_evidencia?: boolean
          familia_id: string
          frequencia?: Database["public"]["Enums"]["tarefa_frequencia"]
          id?: string
          pontos: number
          titulo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          exige_evidencia?: boolean
          familia_id?: string
          frequencia?: Database["public"]["Enums"]["tarefa_frequencia"]
          id?: string
          pontos?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          created_at: string
          familia_id: string
          id: string
          nome: string
          notif_prefs: Json
          papel: Database["public"]["Enums"]["usuario_papel"]
        }
        Insert: {
          created_at?: string
          familia_id: string
          id: string
          nome: string
          notif_prefs?: Json
          papel: Database["public"]["Enums"]["usuario_papel"]
        }
        Update: {
          created_at?: string
          familia_id?: string
          id?: string
          nome?: string
          notif_prefs?: Json
          papel?: Database["public"]["Enums"]["usuario_papel"]
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aplicar_penalizacao: {
        Args: { p_descricao: string; p_filho_id: string; p_valor: number }
        Returns: number
      }
      aplicar_valorizacao: { Args: { p_filho_id: string }; Returns: number }
      aprovar_atribuicao: {
        Args: { atribuicao_id: string }
        Returns: undefined
      }
      avancar_data_valorizacao: {
        Args: {
          p_data_base: string
          p_periodo: Database["public"]["Enums"]["periodo_valorizacao"]
        }
        Returns: string
      }
      bucket_evidencias_id: { Args: never; Returns: string }
      cancelar_envio_atribuicao: {
        Args: { p_atribuicao_id: string }
        Returns: undefined
      }
      cancelar_resgate: { Args: { p_resgate_id: string }; Returns: undefined }
      cancelar_resgate_cofrinho: {
        Args: { p_resgate_id: string }
        Returns: undefined
      }
      concluir_atribuicao: {
        Args: { p_atribuicao_id: string; p_evidencia_url?: string }
        Returns: undefined
      }
      configurar_taxa_resgate_cofrinho: {
        Args: { p_filho_id: string; p_taxa: number }
        Returns: undefined
      }
      configurar_valorizacao: {
        Args: { p_filho_id: string; p_indice: number }
        Returns: undefined
      }
      confirmar_resgate: { Args: { p_resgate_id: string }; Returns: undefined }
      confirmar_resgate_cofrinho: {
        Args: { p_resgate_id: string }
        Returns: undefined
      }
      criar_familia: {
        Args: { nome_familia: string; nome_usuario: string }
        Returns: string
      }
      criar_filho_na_familia: {
        Args: { filho_nome: string; filho_user_id: string }
        Returns: string
      }
      criar_tarefa_com_atribuicoes: {
        Args: {
          p_descricao: string
          p_exige_evidencia: boolean
          p_filho_ids?: string[]
          p_frequencia: Database["public"]["Enums"]["tarefa_frequencia"]
          p_pontos: number
          p_titulo: string
        }
        Returns: string
      }
      cron_sincronizar_valorizacoes: { Args: never; Returns: number }
      desativar_filho: { Args: { p_filho_id: string }; Returns: Json }
      desativar_premio: { Args: { p_premio_id: string }; Returns: number }
      desativar_tarefa: { Args: { p_tarefa_id: string }; Returns: number }
      editar_filho: {
        Args: { p_avatar_url?: string; p_filho_id: string; p_nome: string }
        Returns: undefined
      }
      editar_premio: {
        Args: {
          p_ativo?: boolean
          p_custo_pontos: number
          p_descricao: string
          p_imagem_url?: string
          p_nome: string
          p_premio_id: string
        }
        Returns: string
      }
      editar_tarefa: {
        Args: {
          p_descricao: string
          p_frequencia?: Database["public"]["Enums"]["tarefa_frequencia"]
          p_pontos?: number
          p_requer_evidencia?: boolean
          p_tarefa_id: string
          p_titulo: string
        }
        Returns: undefined
      }
      excluir_minha_conta: { Args: never; Returns: undefined }
      garantir_atribuicoes_diarias: { Args: never; Returns: undefined }
      limpar_auth_user_orfao: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      limpar_registros_antigos: { Args: never; Returns: Json }
      meu_filho_id: { Args: never; Returns: string }
      meu_papel: { Args: never; Returns: string }
      minha_familia_id: { Args: never; Returns: string }
      obter_filho_admin: {
        Args: { p_filho_id: string }
        Returns: {
          ativo: boolean
          avatar_url: string
          email: string
          id: string
          nome: string
          usuario_id: string
        }[]
      }
      obter_meu_perfil: { Args: never; Returns: Json }
      reativar_filho: { Args: { p_filho_id: string }; Returns: undefined }
      reativar_premio: { Args: { p_premio_id: string }; Returns: undefined }
      reativar_tarefa: { Args: { p_tarefa_id: string }; Returns: undefined }
      registrar_audit: {
        Args: {
          p_acao: string
          p_alvo_id?: string
          p_alvo_tipo: string
          p_detalhes?: Json
        }
        Returns: undefined
      }
      rejeitar_atribuicao: {
        Args: { p_atribuicao_id: string; p_nota_rejeicao: string }
        Returns: undefined
      }
      sincronizar_avatar_filho: {
        Args: { p_avatar_url: string }
        Returns: undefined
      }
      sincronizar_valorizacoes_automaticas: {
        Args: { p_filho_id?: string }
        Returns: number
      }
      solicitar_resgate: { Args: { p_premio_id: string }; Returns: string }
      solicitar_resgate_cofrinho: { Args: { p_valor: number }; Returns: string }
      transferir_para_cofrinho: {
        Args: { p_filho_id: string; p_valor: number }
        Returns: undefined
      }
      upsert_push_token: {
        Args: { p_device_id?: string; p_token: string }
        Returns: undefined
      }
      usuario_autenticado_id: { Args: never; Returns: string }
      usuario_e_admin: { Args: never; Returns: boolean }
      validar_filho_da_familia: {
        Args: { p_familia_id: string; p_filho_id: string }
        Returns: undefined
      }
      verificar_limite_frequencia: {
        Args: {
          p_filho_id: string
          p_janela: string
          p_limite: number
          p_tipo: string
        }
        Returns: undefined
      }
    }
    Enums: {
      atribuicao_status:
        | "pendente"
        | "aguardando_validacao"
        | "aprovada"
        | "rejeitada"
      movimentacao_tipo:
        | "credito"
        | "debito"
        | "transferencia_cofrinho"
        | "valorizacao"
        | "penalizacao"
        | "resgate"
        | "estorno_resgate"
        | "resgate_cofrinho"
      periodo_valorizacao: "diario" | "semanal" | "mensal"
      resgate_status: "pendente" | "confirmado" | "cancelado"
      tarefa_frequencia: "diaria" | "unica"
      usuario_papel: "admin" | "filho"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      atribuicao_status: [
        "pendente",
        "aguardando_validacao",
        "aprovada",
        "rejeitada",
      ],
      movimentacao_tipo: [
        "credito",
        "debito",
        "transferencia_cofrinho",
        "valorizacao",
        "penalizacao",
        "resgate",
        "estorno_resgate",
        "resgate_cofrinho",
      ],
      periodo_valorizacao: ["diario", "semanal", "mensal"],
      resgate_status: ["pendente", "confirmado", "cancelado"],
      tarefa_frequencia: ["diaria", "unica"],
      usuario_papel: ["admin", "filho"],
    },
  },
} as const
