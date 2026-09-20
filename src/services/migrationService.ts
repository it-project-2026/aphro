export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  latencyMs: number;
}

export interface ConnectionStatusResponse {
  supabase: ConnectionTestResult;
  hypercloud: ConnectionTestResult;
}

export interface ConflictItem {
  id: string;
  tableName: string;
  unitId?: string;
  type: "INSERT" | "UPDATE" | "SKIP" | "CONFLICT" | "TARGET_ONLY";
  conflictReason?: string;
  differences?: {
    field: string;
    sourceVal: any;
    targetVal: any;
  }[];
  sourceData?: Record<string, any>;
  targetData?: Record<string, any>;
}

export interface TableDiffResult {
  tableName: string;
  totalSource: number;
  totalTarget: number;
  insertCount: number;
  updateCount: number;
  skipCount: number;
  conflictCount: number;
  targetOnlyCount: number;
  errorCount: number;
  conflicts: ConflictItem[];
  sampleInserts: string[];
  sampleUpdates: string[];
  status: "VERIFIED" | "DIFFERENT" | "CONFLICT" | "ERROR" | "NOT_CHECKED";
}

export interface SyncLogItem {
  sync_id: string;
  tanggal_mulai: string;
  tanggal_selesai?: string;
  source: string;
  target: string;
  table_name: string;
  total_source: number;
  total_target_before: number;
  insert_count: number;
  update_count: number;
  skip_count: number;
  conflict_count: number;
  error_count: number;
  status: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  error_message?: string;
  operator: string;
  is_dry_run: boolean;
  batch_size: number;
  unit_filter?: string;
  date_filter?: string;
  created_at: string;
}

export interface SyncStatusData {
  syncId: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "PARTIAL" | "FAILED";
  isDryRun: boolean;
  operator: string;
  currentTable: string;
  currentTableIndex: number;
  totalTables: number;
  processedRecords: number;
  totalRecordsToProcess: number;
  percent: number;
  currentBatch: number;
  totalBatches: number;
  tableSummaries: Record<string, TableDiffResult>;
  logs: SyncLogItem[];
  recentActivity: string[];
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export const MigrationService = {
  async getConfig(): Promise<{ rawUrl: string; maskedUrl: string; isConfigured: boolean }> {
    const res = await fetch("/api/admin/migration/config");
    const json = await res.json();
    return json.data;
  },

  async saveConfig(url: string): Promise<{ rawUrl: string; maskedUrl: string }> {
    const res = await fetch("/api/admin/migration/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const json = await res.json();
    if (json.status !== "success") {
      throw new Error(json.message || "Gagal menyimpan konfigurasi URL database");
    }
    return json.data;
  },

  async testConnections(customHypercloudUrl?: string): Promise<ConnectionStatusResponse> {
    const res = await fetch("/api/admin/migration/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customHypercloudUrl })
    });
    const json = await res.json();
    if (json.status !== "success") {
      throw new Error(json.message || "Gagal menguji koneksi database");
    }
    return json.data;
  },

  async previewDifferences(options: {
    tables?: string[];
    unitFilter?: string;
    dateFrom?: string;
    dateTo?: string;
    customHypercloudUrl?: string;
  }): Promise<Record<string, TableDiffResult>> {
    const res = await fetch("/api/admin/migration/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    const json = await res.json();
    if (json.status !== "success") {
      throw new Error(json.message || "Gagal membandingkan data database");
    }
    return json.data;
  },

  async startSync(options: {
    tables?: string[];
    unitFilter?: string;
    dateFrom?: string;
    dateTo?: string;
    batchSize?: number;
    operator: string;
    isDryRun?: boolean;
    customHypercloudUrl?: string;
  }): Promise<SyncStatusData> {
    const res = await fetch("/api/admin/migration/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    const json = await res.json();
    if (json.status !== "success") {
      throw new Error(json.message || "Gagal memulai proses sinkronisasi");
    }
    return json.data;
  },

  async getSyncStatus(): Promise<SyncStatusData> {
    const res = await fetch("/api/admin/migration/status");
    const json = await res.json();
    return json.data;
  },

  async getAuditLogs(): Promise<SyncLogItem[]> {
    const res = await fetch("/api/admin/migration/logs");
    const json = await res.json();
    return json.data || [];
  },

  async exportSqlFile(options: {
    tables?: string[];
    unitFilter?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<void> {
    const res = await fetch("/api/admin/migration/export-sql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    if (!res.ok) {
      throw new Error("Gagal mengunduh file script SQL");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sync_aphro_supabase_to_hypercloud_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
