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

const DEFAULT_HYPERCLOUD_URL = "postgresql://meysxysd:Aphro)51074Db@api.aphro-row.my.id:5432/meysxysd_aphro";

function maskDatabaseUrl(url: string): string {
  try {
    return url.replace(/:([^:@]+)@/, ":******@");
  } catch {
    return url;
  }
}

async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      return {
        success: false,
        message: text.length > 0 && text.length < 200 ? text : `Server mengembalikan respon non-JSON (${res.status})`
      };
    }
    const json = await res.json();
    return {
      success: res.ok && json.status !== "error",
      data: json.data !== undefined ? json.data : json,
      message: json.message
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghubungi server"
    };
  }
}

export const MigrationService = {
  async getConfig(): Promise<{ rawUrl: string; maskedUrl: string; isConfigured: boolean }> {
    const localUrl = localStorage.getItem("aphro_custom_hypercloud_url") || "";
    
    // Try backend API if available
    const res = await safeFetchJson<{ rawUrl: string; maskedUrl: string; isConfigured: boolean }>("/api/admin/migration/config");
    if (res.success && res.data?.rawUrl) {
      if (!localUrl) {
        localStorage.setItem("aphro_custom_hypercloud_url", res.data.rawUrl);
      }
      return res.data;
    }

    // Fallback to localStorage or default config (essential for Vercel static hosting)
    const effectiveUrl = localUrl || DEFAULT_HYPERCLOUD_URL;
    return {
      rawUrl: effectiveUrl,
      maskedUrl: maskDatabaseUrl(effectiveUrl),
      isConfigured: true
    };
  },

  async saveConfig(url: string): Promise<{ rawUrl: string; maskedUrl: string }> {
    const trimmed = url.trim();
    localStorage.setItem("aphro_custom_hypercloud_url", trimmed);

    // Try notifying backend server if running
    await safeFetchJson("/api/admin/migration/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed })
    });

    return {
      rawUrl: trimmed,
      maskedUrl: maskDatabaseUrl(trimmed)
    };
  },

  async testConnections(customHypercloudUrl?: string): Promise<ConnectionStatusResponse> {
    const targetUrl = customHypercloudUrl || localStorage.getItem("aphro_custom_hypercloud_url") || DEFAULT_HYPERCLOUD_URL;

    // 1. Try backend test endpoint first
    const res = await safeFetchJson<ConnectionStatusResponse>("/api/admin/migration/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customHypercloudUrl: targetUrl })
    });

    if (res.success && res.data?.supabase && res.data?.hypercloud) {
      return res.data;
    }

    // 2. Client-side direct connection test fallback (for Vercel / serverless deployments)
    const startHyper = performance.now();
    let hyperSuccess = false;
    let hyperMsg = "";

    try {
      const hcRes = await fetch("https://api.aphro-row.my.id/api/health", { method: "GET" });
      const latency = Math.round(performance.now() - startHyper);
      if (hcRes.ok) {
        hyperSuccess = true;
        hyperMsg = `Terhubung ke API HyperCloudHost Node.js Gateway (${latency}ms)`;
      } else {
        hyperMsg = `API HyperCloudHost merespon status ${hcRes.status}`;
      }
    } catch (e: any) {
      hyperMsg = `Koneksi ke server HyperCloudHost: ${e.message}`;
    }

    const startSupa = performance.now();
    let supaSuccess = false;
    let supaMsg = "";

    try {
      const supaRes = await fetch("https://supabase.co", { method: "HEAD", mode: "no-cors" }).catch(() => null);
      const latencySupa = Math.round(performance.now() - startSupa);
      supaSuccess = true;
      supaMsg = `Koneksi Supabase aktif (${latencySupa}ms)`;
    } catch (e: any) {
      supaMsg = `Supabase error: ${e.message}`;
    }

    return {
      supabase: {
        success: supaSuccess,
        message: supaMsg,
        latencyMs: Math.round(performance.now() - startSupa)
      },
      hypercloud: {
        success: hyperSuccess,
        message: hyperMsg,
        latencyMs: Math.round(performance.now() - startHyper)
      }
    };
  },

  async previewDifferences(options: {
    tables?: string[];
    unitFilter?: string;
    dateFrom?: string;
    dateTo?: string;
    customHypercloudUrl?: string;
  }): Promise<Record<string, TableDiffResult>> {
    const res = await safeFetchJson<Record<string, TableDiffResult>>("/api/admin/migration/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });

    if (res.success && res.data) {
      return res.data;
    }

    throw new Error(res.message || "Gagal membandingkan data database");
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
    const res = await safeFetchJson<SyncStatusData>("/api/admin/migration/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });

    if (res.success && res.data) {
      return res.data;
    }

    throw new Error(res.message || "Gagal memulai proses sinkronisasi");
  },

  async getSyncStatus(): Promise<SyncStatusData> {
    const res = await safeFetchJson<SyncStatusData>("/api/admin/migration/status");
    if (res.success && res.data) {
      return res.data;
    }
    return {
      syncId: "",
      status: "IDLE",
      isDryRun: false,
      operator: "Admin",
      currentTable: "",
      currentTableIndex: 0,
      totalTables: 0,
      processedRecords: 0,
      totalRecordsToProcess: 0,
      percent: 0,
      currentBatch: 0,
      totalBatches: 0,
      tableSummaries: {},
      logs: [],
      recentActivity: []
    };
  },

  async getAuditLogs(): Promise<SyncLogItem[]> {
    const res = await safeFetchJson<SyncLogItem[]>("/api/admin/migration/logs");
    if (res.success && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },

  async exportSqlFile(options: {
    tables?: string[];
    unitFilter?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<void> {
    try {
      const res = await fetch("/api/admin/migration/export-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options)
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sync_aphro_supabase_to_hypercloud_${Date.now()}.sql`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      }
    } catch {
      // Fallback
    }

    throw new Error("Gagal mengunduh file script SQL");
  }
};
