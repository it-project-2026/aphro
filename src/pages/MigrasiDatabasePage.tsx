import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import {
  MigrationService,
  ConnectionStatusResponse,
  TableDiffResult,
  FullPreviewResponseData,
  SyncStatusData,
  SyncLogItem,
  ConflictItem,
  RealisasiPreviewResult
} from "../services/migrationService";
import {
  Database,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Eye,
  RefreshCw,
  Download,
  ShieldCheck,
  Server,
  Layers,
  Clock,
  History,
  Info,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Settings,
  Save,
  Lock
} from "lucide-react";

export const MigrasiDatabasePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Connection states
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatusResponse | null>(null);
  const [targetDbUrl, setTargetDbUrl] = useState<string>("postgresql://meysxysd:Aphro)51074Db@127.0.0.1:5432/meysxysd_aphro");
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Filter states
  const [selectedTables, setSelectedTables] = useState<string[]>(["WORK_ORDER", "ABSENSI", "REALISASI"]);
  const [unitFilter, setUnitFilter] = useState<string>("ALL");
  const [dateFilterType, setDateFilterType] = useState<"ALL" | "18_SEPT" | "CUSTOM">("18_SEPT");
  const [customDateFrom, setCustomDateFrom] = useState<string>("2026-09-18");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [batchSize, setBatchSize] = useState<number>(100);

  // Preview & Comparison states
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [fullPreview, setFullPreview] = useState<FullPreviewResponseData | null>(null);
  const [diffSummaries, setDiffSummaries] = useState<Record<string, TableDiffResult> | null>(null);
  const [realisasiPreview, setRealisasiPreview] = useState<RealisasiPreviewResult | null>(null);
  const [isRealisasiPreviewing, setIsRealisasiPreviewing] = useState<boolean>(false);

  // Sync execution states
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [activeSync, setActiveSync] = useState<SyncStatusData | null>(null);
  const [isExportingSql, setIsExportingSql] = useState(false);

  // Conflict view modal
  const [selectedConflict, setSelectedConflict] = useState<ConflictItem | null>(null);

  // Logs & History
  const [auditLogs, setAuditLogs] = useState<SyncLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<"migration" | "logs">("migration");

  // Auto-polling ref
  const pollIntervalRef = useRef<any>(null);

  // Calculate effective date filter
  const getEffectiveDates = () => {
    if (dateFilterType === "18_SEPT") {
      return { dateFrom: "2026-09-18", dateTo: undefined };
    }
    if (dateFilterType === "CUSTOM") {
      return {
        dateFrom: customDateFrom || undefined,
        dateTo: customDateTo || undefined
      };
    }
    return { dateFrom: undefined, dateTo: undefined };
  };

  // Test connection on mount
  useEffect(() => {
    loadConfig();
    handleTestConnection();
    loadAuditLogs();
    fetchSyncStatus();

    pollIntervalRef.current = setInterval(() => {
      fetchSyncStatus();
    }, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await MigrationService.getConfig();
      if (cfg && cfg.rawUrl) {
        setTargetDbUrl(cfg.rawUrl);
      }
    } catch (e) {
      console.warn("Failed to load migration config:", e);
    }
  };

  const handleSaveConfig = async () => {
    if (!targetDbUrl.trim()) {
      showToast("URL database tidak boleh kosong", "error");
      return;
    }
    setIsSavingConfig(true);
    try {
      await MigrationService.saveConfig(targetDbUrl.trim());
      showToast("Konfigurasi URL database target berhasil disimpan!", "success");
      handleTestConnection(targetDbUrl.trim());
    } catch (e: any) {
      showToast(`Gagal menyimpan konfigurasi: ${e.message}`, "error");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConnection = async (overrideUrl?: string, autoPreview = true) => {
    setIsTestingConn(true);
    try {
      const res = await MigrationService.testConnections(overrideUrl || targetDbUrl);
      setConnStatus(res);
      if (res.supabase.success && res.hypercloud.success) {
        showToast("Kedua database (Supabase & HyperCloudHost) berhasil terhubung!", "success");
        if (autoPreview) {
          handlePreviewDifferences();
        }
      } else {
        showToast("Salah satu koneksi database mengalami kendala.", "error");
      }
    } catch (err: any) {
      showToast(`Gagal menguji koneksi: ${err.message}`, "error");
    } finally {
      setIsTestingConn(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await MigrationService.getAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.warn("Failed to load audit logs:", e);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const status = await MigrationService.getSyncStatus();
      if (status && status.status !== "IDLE") {
        setActiveSync(status);
        if (status.status === "COMPLETED" || status.status === "PARTIAL") {
          loadAuditLogs();
        }
      }
    } catch (e) {
      // Silent error during polling
    }
  };

  const handlePreviewDifferences = async () => {
    if (selectedTables.length === 0) {
      showToast("Pilih minimal satu tabel untuk dibandingkan.", "error");
      return;
    }
    setIsPreviewing(true);
    showToast("Membandingkan data Supabase vs HyperCloudHost...", "info");
    try {
      const dates = getEffectiveDates();
      const res = await MigrationService.previewDifferences({
        tables: selectedTables,
        unitFilter,
        dateFrom: dates.dateFrom,
        dateTo: dates.dateTo,
        customHypercloudUrl: targetDbUrl
      });
      setFullPreview(res);
      setDiffSummaries(res.tableSummaries);
      if (res.isSyncAllowed) {
        showToast("Analisa perbandingan data selesai & terverifikasi!", "success");
      } else {
        showToast(res.validationWarning || "Perhatian: Hasil preview menunjukkan selisih. Sync dinonaktifkan.", "error");
      }
    } catch (err: any) {
      showToast(`Gagal membandingkan data: ${err.message}`, "error");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePreviewRealisasi = async () => {
    setIsRealisasiPreviewing(true);
    showToast("Membaca seluruh 11.981 ID REALISASI & membandingkan dengan HyperCloudHost...", "info");
    try {
      const res = await MigrationService.previewRealisasi(targetDbUrl);
      setRealisasiPreview(res);
      if (res.isExact555) {
        showToast("Analisa Selesai: 555 kandidat REALISASI belum tersalin ke HyperCloudHost", "success");
      } else {
        showToast(`Analisa Selesai: Ditemukan ${res.sourceOnlyCount} record (selisih ${res.sourceOnlyCount})`, "info");
      }
    } catch (err: any) {
      showToast(`Gagal preview REALISASI: ${err.message}`, "error");
    } finally {
      setIsRealisasiPreviewing(false);
    }
  };

  const handleStartLiveSync = async (isDryRun = false) => {
    setIsSyncModalOpen(false);
    const dates = getEffectiveDates();
    try {
      const state = await MigrationService.startSync({
        tables: selectedTables,
        unitFilter,
        dateFrom: dates.dateFrom,
        dateTo: dates.dateTo,
        batchSize,
        operator: user?.userName || user?.name || "Admin",
        isDryRun,
        customHypercloudUrl: targetDbUrl
      });
      setActiveSync(state);
      showToast(isDryRun ? "Dry-run simulasi sinkronisasi dimulai." : "Proses live sinkronisasi telah dimulai!", "success");
    } catch (err: any) {
      showToast(`Gagal memulai sinkronisasi: ${err.message}`, "error");
    }
  };

  const handleExportSql = async () => {
    setIsExportingSql(true);
    showToast("Menyiapkan script SQL migration...", "info");
    try {
      const dates = getEffectiveDates();
      await MigrationService.exportSqlFile({
        tables: selectedTables,
        unitFilter,
        dateFrom: dates.dateFrom,
        dateTo: dates.dateTo
      });
      showToast("File SQL berhasil diunduh!", "success");
    } catch (err: any) {
      showToast(`Gagal mengunduh SQL: ${err.message}`, "error");
    } finally {
      setIsExportingSql(false);
    }
  };

  const toggleTable = (tblName: string) => {
    if (selectedTables.includes(tblName)) {
      setSelectedTables(selectedTables.filter((t) => t !== tblName));
    } else {
      setSelectedTables([...selectedTables, tblName]);
    }
  };

  // Grand totals across summaries
  const totals = {
    source: 0,
    target: 0,
    insert: 0,
    update: 0,
    skip: 0,
    conflict: 0
  };

  if (diffSummaries) {
    Object.values(diffSummaries).forEach((d) => {
      totals.source += d.totalSource;
      totals.target += d.totalTarget;
      totals.insert += d.insertCount;
      totals.update += d.updateCount;
      totals.skip += d.skipCount;
      totals.conflict += d.conflictCount;
    });
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-teal-900/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Database Migration Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              MIGRASI DATABASE
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Sinkronisasi data aman & idempotent:{" "}
              <strong className="text-teal-300 font-semibold">SUPABASE (Aktif)</strong>{" "}
              <ArrowRightLeft className="w-3.5 h-3.5 inline mx-1 text-teal-400" />{" "}
              <strong className="text-cyan-300 font-semibold">HYPERCLOUDHOST (Target)</strong>.
              Tidak menghapus data sumber, menjaga primary key, dan memisahkan tenant UL1 & UL2.
            </p>
          </div>

          {/* Quick Tabs */}
          <div className="flex items-center space-x-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/80 self-start md:self-center">
            <button
              onClick={() => setActiveTab("migration")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === "migration"
                  ? "bg-gradient-to-r from-teal-500 to-[#00A2B9] text-white shadow-lg shadow-teal-500/30"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Panel Migrasi
            </button>
            <button
              onClick={() => {
                setActiveTab("logs");
                loadAuditLogs();
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === "logs"
                  ? "bg-gradient-to-r from-teal-500 to-[#00A2B9] text-white shadow-lg shadow-teal-500/30"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Riwayat Audit Log ({auditLogs.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "migration" ? (
        <>
          {/* Section 1: Database Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supabase Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white">SOURCE: SUPABASE</h3>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        Database Aktif
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {connStatus?.supabase?.details?.mode || "PostgreSQL REST/PG"}
                    </p>
                  </div>
                </div>

                <div>
                  {connStatus?.supabase?.success ? (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>CONNECTED ({connStatus.supabase.latencyMs}ms)</span>
                    </span>
                  ) : connStatus ? (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>DISCONNECTED</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Belum diuji</span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300">
                {connStatus?.supabase?.message || "Menunggu pengujian koneksi Supabase..."}
              </div>
            </div>

            {/* HyperCloudHost Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white">TARGET: HYPERCLOUDHOST</h3>
                      <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                        Database Tujuan
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      PostgreSQL `meysxysd_aphro`
                    </p>
                  </div>
                </div>

                <div>
                  {connStatus?.hypercloud?.success ? (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>CONNECTED ({connStatus.hypercloud.latencyMs}ms)</span>
                    </span>
                  ) : connStatus ? (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>BELUM TERHUBUNG</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Belum diuji</span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300">
                {connStatus?.hypercloud?.message || "Menunggu pengujian koneksi HyperCloudHost..."}
              </div>
            </div>
          </div>

          {/* Section 2: Filter & Configuration Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
            {/* Target Database Connection Settings Banner */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    PostgreSQL Target:
                  </span>
                  <code className="text-[11px] font-mono bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 truncate max-w-xs sm:max-w-md">
                    {targetDbUrl ? targetDbUrl.replace(/:([^:@]+)@/, ":•••••••@") : "Belum diatur"}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigPanel(!showConfigPanel)}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline self-start sm:self-auto flex items-center space-x-1"
                >
                  <span>{showConfigPanel ? "Tutup Form URL" : "Ubah / Test URL Target"}</span>
                </button>
              </div>

              {showConfigPanel && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      PostgreSQL Target Connection String (HyperCloudHost)
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={targetDbUrl}
                        onChange={(e) => setTargetDbUrl(e.target.value)}
                        placeholder="postgresql://user:password@host:5432/database"
                        className="flex-1 font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        disabled={isSavingConfig}
                        className="px-4 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center space-x-1.5 shadow-xs transition-colors shrink-0"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingConfig ? "Menyimpan..." : "Simpan & Test"}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    <strong>Default:</strong> <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200">postgresql://meysxysd:Aphro)51074Db@127.0.0.1:5432/meysxysd_aphro</code>.
                    Karakter password seperti kurung tutup <code className="bg-slate-200 dark:bg-slate-900 px-1 rounded font-mono">)</code> ditangani secara aman oleh engine migrasi.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-teal-600" />
                  <span>Konfigurasi & Parameter Sinkronisasi</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tentukan tabel, unit kerja, dan rentang tanggal data yang akan disinkronkan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnection()}
                  disabled={isTestingConn}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center space-x-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? "animate-spin text-teal-500" : ""}`} />
                  <span>Test Koneksi</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSql}
                  disabled={isExportingSql}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition-colors inline-flex items-center space-x-1.5 shadow-xs"
                >
                  <Download className={`w-3.5 h-3.5 ${isExportingSql ? "animate-bounce" : ""}`} />
                  <span>Unduh SQL Script</span>
                </button>
              </div>
            </div>

            {/* Filter Form Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. Table Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  1. Tabel Prioritas
                </label>
                <div className="space-y-2 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {["WORK_ORDER", "ABSENSI", "REALISASI"].map((tbl) => (
                    <label key={tbl} className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(tbl)}
                        onChange={() => toggleTable(tbl)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 dark:bg-slate-800"
                      />
                      <span>{tbl}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. Unit Filter */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  2. Filter Unit Kerja (Multi-Tenant)
                </label>
                <div className="space-y-2">
                  <select
                    value={unitFilter}
                    onChange={(e) => setUnitFilter(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ALL">Semua Unit (UL1 Padang & UL2 Bukittinggi)</option>
                    <option value="UL1">Hanya UL1 (Padang & Sekitarnya)</option>
                    <option value="UL2">Hanya UL2 (Bukittinggi & Sekitarnya)</option>
                  </select>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Engine menjamin data antar-unit tidak tertukar dan tidak mencampuradukkan record.
                  </p>
                </div>
              </div>

              {/* 3. Date Range Filter */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  3. Rentang Tanggal Data
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDateFilterType("18_SEPT")}
                      className={`text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                        dateFilterType === "18_SEPT"
                          ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      ≥ 18 Sept 2026
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilterType("ALL")}
                      className={`text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                        dateFilterType === "ALL"
                          ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Semua Waktu
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilterType("CUSTOM")}
                      className={`text-[11px] font-bold py-1.5 rounded-lg transition-all ${
                        dateFilterType === "CUSTOM"
                          ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Kustom
                    </button>
                  </div>

                  {dateFilterType === "CUSTOM" && (
                    <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
                      <input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        placeholder="Dari Tanggal"
                        className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        placeholder="Sampai Tanggal"
                        className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 text-teal-500 shrink-0" />
                <span>Tekan <strong>Cek Perbedaan</strong> untuk simulasi (Dry Run) tanpa mengubah database.</span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handlePreviewRealisasi}
                  disabled={isRealisasiPreviewing}
                  className="px-4 py-2.5 text-xs font-extrabold rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition-all inline-flex items-center space-x-2 shadow-xs"
                >
                  <Eye className={`w-4 h-4 text-cyan-600 ${isRealisasiPreviewing ? "animate-pulse" : ""}`} />
                  <span>{isRealisasiPreviewing ? "Memproses 11.981 Record..." : "PREVIEW REALISASI"}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePreviewDifferences}
                  disabled={isPreviewing}
                  className="px-4 py-2.5 text-xs font-extrabold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all inline-flex items-center space-x-2 shadow-xs"
                >
                  <Eye className={`w-4 h-4 text-teal-600 ${isPreviewing ? "animate-pulse" : ""}`} />
                  <span>{isPreviewing ? "Membandingkan..." : "CEK PERBEDAAN (PREVIEW)"}</span>
                </button>

                <button
                  type="button"
                  disabled={!!(fullPreview && (!fullPreview.isSyncAllowed || fullPreview.validationWarning))}
                  onClick={() => setIsSyncModalOpen(true)}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl transition-all inline-flex items-center space-x-2 shadow-lg ${
                    fullPreview && (!fullPreview.isSyncAllowed || fullPreview.validationWarning)
                      ? "bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-teal-500 to-[#00A2B9] text-white hover:from-teal-600 hover:to-[#008f9f] shadow-teal-500/20"
                  }`}
                >
                  <Play className="w-4 h-4" />
                  <span>SYNC DATA SEKARANG</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section: Dedicated REALISASI Preview Report */}
          {isRealisasiPreviewing && (
            <div className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800/60 rounded-3xl p-8 shadow-md space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 animate-pulse">
                    <Eye className="w-7 h-7" />
                  </div>
                  <RefreshCw className="w-5 h-5 text-cyan-500 animate-spin absolute -top-1 -right-1" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Membaca seluruh 11.981 ID REALISASI dari Supabase...
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Membandingkan ID dengan HyperCloudHost di server (Tanpa batas LIMIT 1000).
                  </p>
                </div>
              </div>
            </div>
          )}

          {realisasiPreview && !isRealisasiPreviewing && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-lg space-y-6 animate-in fade-in duration-300">
              {/* Banner Validation Status */}
              <div className={`p-4 rounded-2xl border flex items-start space-x-3 ${
                realisasiPreview.isExact555
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                  : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
              }`}>
                {realisasiPreview.isExact555 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold">Laporan Preview REALISASI</h4>
                  <p className="text-xs font-semibold leading-relaxed">
                    {realisasiPreview.validationMessage}
                  </p>
                  {!realisasiPreview.isExact555 && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      ⚠️ Sinkronisasi otomatis DITAHAN. Silakan periksa perbedaan data terlebih dahulu.
                    </p>
                  )}
                </div>
              </div>

              {/* Table Comparison Metrics Card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-cyan-600" />
                    <span>Perbandingan Table: REALISASI</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    Primary Key: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-teal-600 font-bold">ID</code>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Supabase Source</div>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {realisasiPreview.totalSource.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">HyperCloud Target</div>
                    <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 mt-1">
                      {realisasiPreview.totalTarget.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Ada di Kedua DB</div>
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
                      {realisasiPreview.inBothCount.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                    <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Hanya di Supabase</div>
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1">
                      {realisasiPreview.sourceOnlyCount.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Hanya di HyperCloud</div>
                    <div className="text-lg font-black text-slate-700 dark:text-slate-300 mt-1">
                      {realisasiPreview.targetOnlyCount.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Konflik ID</div>
                    <div className="text-lg font-black text-slate-700 dark:text-slate-300 mt-1">
                      {realisasiPreview.conflictCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Table of Source Only Records */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    DAFTAR RECORD REALISASI HANYA ADA DI SUPABASE ({realisasiPreview.sourceOnlyRecords.length} Items)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Kandidat yang belum tersalin ke HyperCloudHost
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-3">No</th>
                        <th className="p-3">ID</th>
                        <th className="p-3">WO_ID</th>
                        <th className="p-3">Nomor_WO</th>
                        <th className="p-3">ULP</th>
                        <th className="p-3">REGU_ROW</th>
                        <th className="p-3">PENYULANG</th>
                        <th className="p-3">NO_TIANG</th>
                        <th className="p-3">TANGGAL</th>
                        <th className="p-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                      {realisasiPreview.sourceOnlyRecords.map((item, idx) => (
                        <tr key={item.ID || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-sans text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-teal-600 dark:text-teal-400">{item.ID}</td>
                          <td className="p-3">{item.WO_ID}</td>
                          <td className="p-3 font-sans">{item.Nomor_WO}</td>
                          <td className="p-3 font-sans">{item.ULP}</td>
                          <td className="p-3 font-sans">{item.REGU_ROW}</td>
                          <td className="p-3 font-sans">{item.PENYULANG}</td>
                          <td className="p-3">{item.NO_TIANG}</td>
                          <td className="p-3 font-sans">{item.TANGGAL}</td>
                          <td className="p-3 font-sans text-slate-500">{item.Timestamp}</td>
                        </tr>
                      ))}
                      {realisasiPreview.sourceOnlyRecords.length === 0 && (
                        <tr>
                          <td colSpan={10} className="p-6 text-center font-sans text-slate-500">
                            Tidak ada record yang tertinggal di Supabase. Seluruh data REALISASI identik.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Data Comparison Summary Table */}
          {isPreviewing && (
            <div className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/60 rounded-3xl p-8 shadow-md space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/80 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 animate-pulse">
                    <Eye className="w-7 h-7" />
                  </div>
                  <RefreshCw className="w-5 h-5 text-teal-500 animate-spin absolute -top-1 -right-1" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Sedang Menganalisa Perbandingan Data...
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    Memeriksa primary key, timestamp, dan membandingkan record antara Supabase dan HyperCloudHost ({selectedTables.join(", ")}).
                  </p>
                </div>
                <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div className="w-full h-full bg-teal-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {!isPreviewing && !diffSummaries && (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  Pratinjau Selisih Data Belum Dimuat
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg mx-auto">
                  Tekan tombol di bawah untuk membandingkan jumlah data dan mendeteksi record baru (Insert), update, serta konflik antara Supabase dan HyperCloudHost.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePreviewDifferences}
                className="px-5 py-2.5 text-xs font-extrabold rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all inline-flex items-center space-x-2 shadow-sm"
              >
                <Eye className="w-4 h-4" />
                <span>MUAT PRATINJAU SELISIH SEKARANG</span>
              </button>
            </div>
          )}

          {!isPreviewing && diffSummaries && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-300">
              
              {/* Target DB Verification Box */}
              {fullPreview?.targetInfo && (
                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="w-5 h-5 text-teal-400" />
                      <span className="font-extrabold text-xs uppercase tracking-wider text-slate-200">
                        DATABASE TARGET HYPERCLOUD
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      fullPreview.targetInfo.connected
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}>
                      {fullPreview.targetInfo.connected ? "TERHUBUNG (VERIFIED)" : "TERPUTUS"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 font-mono">
                    <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase">Database</span>
                      <strong className="text-teal-300 text-xs">{fullPreview.targetInfo.database}</strong>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase">Schema</span>
                      <strong className="text-teal-300 text-xs">{fullPreview.targetInfo.schema}</strong>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase">WORK_ORDER DB Target</span>
                      <strong className="text-white text-xs">{fullPreview.targetInfo.counts.WORK_ORDER ?? 0}</strong>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase">REALISASI DB Target</span>
                      <strong className="text-white text-xs">{fullPreview.targetInfo.counts.REALISASI ?? 0}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Warning Banner */}
              {fullPreview?.validationWarning && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500/80 rounded-2xl p-4 text-amber-900 dark:text-amber-200 flex items-start space-x-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      STATUS PREVIEW DATABASE
                    </h4>
                    <p className="text-xs font-bold leading-relaxed">
                      {fullPreview.validationWarning}
                    </p>
                  </div>
                </div>
              )}

              {/* REALISASI ID Breakdown Card */}
              {fullPreview?.realisasiDetail && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-cyan-600" />
                    <span>REALISASI ID BREAKDOWN (SISTEM SERVER)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-extrabold">
                    <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      REALISASI ID hanya di Supabase = <span className="text-sm font-black ml-1">{fullPreview.realisasiDetail.sourceOnlyCount.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-200 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                      REALISASI ID hanya di HyperCloud = <span className="text-sm font-black ml-1">{fullPreview.realisasiDetail.targetOnlyCount.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                      REALISASI ID terdapat di kedua database = <span className="text-sm font-black ml-1">{fullPreview.realisasiDetail.inBothCount.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-teal-500" />
                    <span>HASIL PERBANDINGAN DATA DATABASE</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Rincian perbedaan record berdasarkan ID / Primary Key unik.
                  </p>
                </div>

                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Total Source: <span className="text-teal-600 font-extrabold">{totals.source}</span> | Target: <span className="text-cyan-600 font-extrabold">{totals.target}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Nama Tabel</th>
                      <th className="p-3 text-center">Supabase (Source)</th>
                      <th className="p-3 text-center">HyperCloud (Target)</th>
                      <th className="p-3 text-center text-emerald-600">Insert (+)</th>
                      <th className="p-3 text-center text-amber-600">Update (~)</th>
                      <th className="p-3 text-center text-slate-500">Skip (=)</th>
                      <th className="p-3 text-center text-rose-600">Conflict (!)</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {Object.entries(diffSummaries).map(([tblName, diff]) => (
                      <tr key={tblName} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>{tblName}</span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-200">
                          {diff.totalSource}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-200">
                          {diff.totalTarget}
                        </td>
                        <td className="p-3 text-center font-extrabold text-emerald-600 dark:text-emerald-400">
                          {diff.insertCount > 0 ? `+${diff.insertCount}` : "0"}
                        </td>
                        <td className="p-3 text-center font-extrabold text-amber-600 dark:text-amber-400">
                          {diff.updateCount > 0 ? `~${diff.updateCount}` : "0"}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-500 dark:text-slate-400">
                          {diff.skipCount}
                        </td>
                        <td className="p-3 text-center">
                          {diff.conflictCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedConflict(diff.conflicts[0] || null)}
                              className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold hover:underline"
                            >
                              !{diff.conflictCount} Periksa
                            </button>
                          ) : (
                            <span className="font-bold text-slate-400">0</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {diff.status === "VERIFIED" && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>VERIFIED</span>
                            </span>
                          )}
                          {diff.status === "DIFFERENT" && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                              <AlertCircle className="w-3 h-3" />
                              <span>PERLU SYNC</span>
                            </span>
                          )}
                          {diff.status === "CONFLICT" && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3" />
                              <span>CONFLICT</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-extrabold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800">
                    <tr>
                      <td className="p-3">TOTAL KESELURUHAN</td>
                      <td className="p-3 text-center">{totals.source}</td>
                      <td className="p-3 text-center">{totals.target}</td>
                      <td className="p-3 text-center text-emerald-600">+{totals.insert}</td>
                      <td className="p-3 text-center text-amber-600">~{totals.update}</td>
                      <td className="p-3 text-center text-slate-500">{totals.skip}</td>
                      <td className="p-3 text-center text-rose-600">!{totals.conflict}</td>
                      <td className="p-3 text-center">
                        {totals.conflict > 0 ? (
                          <span className="text-rose-600">CONFLICT</span>
                        ) : totals.insert > 0 || totals.update > 0 ? (
                          <span className="text-amber-600">PENDING</span>
                        ) : (
                          <span className="text-emerald-600">100% IDENTIK</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Section 4: Live Progress & Execution Monitor */}
          {activeSync && activeSync.status !== "IDLE" && (
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${activeSync.status === "RUNNING" ? "bg-teal-400 animate-ping" : activeSync.status === "COMPLETED" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                    STATUS SINKRONISASI: <span className="text-teal-400">{activeSync.status}</span> ({activeSync.syncId})
                  </h3>
                </div>

                <span className="text-xs text-slate-400">
                  Operator: <strong>{activeSync.operator}</strong>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Progres Tabel: <strong className="text-white">{activeSync.currentTable || "Menyiapkan..."}</strong></span>
                  <span>{activeSync.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, activeSync.percent)}%` }}
                  />
                </div>
              </div>

              {/* Live Terminal / Activity Log */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aktivitas Real-Time</p>
                <div className="bg-black/60 rounded-xl p-3 font-mono text-[11px] text-teal-300/90 max-h-36 overflow-y-auto space-y-1 border border-slate-800">
                  {activeSync.recentActivity?.map((act, i) => (
                    <div key={i} className="leading-relaxed">{act}</div>
                  ))}
                </div>
              </div>

              {/* Verification Badge */}
              {activeSync.status === "COMPLETED" && (
                <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-extrabold text-emerald-200 uppercase">SYNC SELESAI — 100% VERIFIED</h4>
                      <p className="text-[11px] text-emerald-400/90">
                        Seluruh record telah disinkronkan ke PostgreSQL HyperCloudHost secara aman tanpa menghapus data sumber.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSync(null)}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              )}

              {/* Partial Status Helper & Resolution Card */}
              {activeSync.status === "PARTIAL" && (
                <div className="p-5 bg-amber-950/70 border border-amber-800/80 rounded-2xl space-y-3">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-extrabold text-amber-200 uppercase">
                        STATUS: PARTIAL (Memerlukan Eksekusi Script SQL di Server Target)
                      </h4>
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">
                        Koneksi remote port 5432 ke PostgreSQL server HyperCloudHost dibatasi oleh firewall hosting (cPanel). Data berhasil disiapkan dan dianalisa, namun untuk memastikan seluruh 11.000+ data masuk secara 100% sempurna ke database tujuan, silakan gunakan berkas script SQL di bawah ini:
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-900/40 rounded-xl p-3 border border-amber-800/50 space-y-2 text-[11px] text-amber-200">
                    <div className="font-bold flex items-center space-x-1.5 text-amber-300">
                      <span>📌 Langkah Penyelesaian 100% Sukses:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                      <li>Klik tombol <strong>"Unduh Script Migrasi SQL (.sql)"</strong> di bawah.</li>
                      <li>Buka <strong>phpPgAdmin</strong> atau <strong>Terminal PostgreSQL</strong> di cPanel HyperCloudHost Anda.</li>
                      <li>Pilih database <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300 font-mono">meysxysd_aphro</code> lalu jalankan/import file SQL tersebut.</li>
                    </ol>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isExportingSql}
                      onClick={handleExportSql}
                      className="px-4 py-2 text-xs font-extrabold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all inline-flex items-center space-x-2 shadow-sm"
                    >
                      {isExportingSql ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>UNDUH SCRIPT MIGRASI LENGKAP (.SQL)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSync(null)}
                      className="px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                    >
                      Tutup Notifikasi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Section 5: Historical Audit Logs Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <History className="w-5 h-5 text-teal-600" />
                <span>Riwayat Audit Log Sinkronisasi Database</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pencatatan riwayat eksekusi migrasi Supabase → HyperCloudHost untuk kepatuhan & audit.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAuditLogs}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors inline-flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Belum ada log aktivitas sinkronisasi yang tercatat di sesi ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Sync ID & Tanggal</th>
                    <th className="p-3">Tabel</th>
                    <th className="p-3 text-center">Insert</th>
                    <th className="p-3 text-center">Update</th>
                    <th className="p-3 text-center">Skip</th>
                    <th className="p-3 text-center">Conflict</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                        <div>{log.sync_id}</div>
                        <div className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString()}</div>
                      </td>
                      <td className="p-3 font-extrabold text-teal-600">{log.table_name}</td>
                      <td className="p-3 text-center font-bold text-emerald-600">+{log.insert_count}</td>
                      <td className="p-3 text-center font-bold text-amber-600">~{log.update_count}</td>
                      <td className="p-3 text-center font-bold text-slate-500">{log.skip_count}</td>
                      <td className="p-3 text-center font-bold text-rose-600">!{log.conflict_count}</td>
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{log.operator}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          log.status === "COMPLETED" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" :
                          log.status === "PARTIAL" ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300" :
                          "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal Before Live Sync */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-teal-600 dark:text-teal-400">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950/60 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Konfirmasi Sinkronisasi Data
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supabase PostgreSQL → HyperCloudHost PostgreSQL
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-semibold">
                Sinkronisasi akan menambahkan (INSERT) dan memperbarui (UPDATE) data pada HyperCloudHost berdasarkan data Supabase.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                <li>Data pada <strong>Supabase TIDAK akan dihapus</strong>.</li>
                <li>Data target yang sudah ada dan identik akan di-<strong>SKIP</strong> secara otomatis.</li>
                <li>Primary key ID tetap dipertahankan tanpa perubahan format.</li>
                <li>Data konflik tidak akan ditimpa otomatis.</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <p className="text-[10px] uppercase font-bold text-emerald-600">Insert (+)</p>
                <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">+{totals.insert}</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-[10px] uppercase font-bold text-amber-600">Update (~)</p>
                <p className="text-base font-extrabold text-amber-700 dark:text-amber-300">~{totals.update}</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleStartLiveSync(false)}
                className="px-5 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-teal-500 to-[#00A2B9] text-white hover:from-teal-600 hover:to-[#008f9f] transition-all shadow-md shadow-teal-500/20"
              >
                Ya, Jalankan Sinkronisasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Details Inspection Modal */}
      {selectedConflict && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Rincian Konflik Data (CONFLICT)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ID: <strong className="font-mono text-rose-600">{selectedConflict.id}</strong> ({selectedConflict.tableName})
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold">
              {selectedConflict.conflictReason || "Terjadi ketidaksesuaian nilai pada field kritis."}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Perbedaan Nilai Antara Database:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedConflict.differences?.map((d, i) => (
                  <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="font-bold text-teal-600 dark:text-teal-400 uppercase">{d.field}</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-800 dark:text-emerald-300">
                        <strong>Supabase:</strong> {String(d.sourceVal ?? "NULL")}
                      </div>
                      <div className="p-2 bg-cyan-50 dark:bg-cyan-950/40 rounded-lg text-cyan-800 dark:text-cyan-300">
                        <strong>HyperCloud:</strong> {String(d.targetVal ?? "NULL")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedConflict(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
