import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Database, 
  CloudUpload, 
  HardDrive, 
  ShieldCheck,
  Zap,
  RotateCcw
} from 'lucide-react';
import { offlineSyncQueue } from '../services/offlineSyncQueue';
import { syncManager } from '../services/syncManager';
import { idbService } from '../services/indexedDbService';
import { dexieDb } from '../services/dexieDb';
import { useToast } from '../hooks/useToast';
import { getLocalDateTimeString } from '../utils/dateUtils';

export const SinkronisasiPage: React.FC = () => {
  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<string>('');

  const [stats, setStats] = useState<{
    pendingCount: number;
    syncingCount: number;
    syncedCount: number;
    failedCount: number;
    lastSyncAt: string | null;
    totalWoCount: number;
    totalPhotoCount: number;
    absensiPending: number;
  }>({
    pendingCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    failedCount: 0,
    lastSyncAt: null,
    totalWoCount: 0,
    totalPhotoCount: 0,
    absensiPending: 0,
  });

  const loadStats = async () => {
    try {
      const summary = await offlineSyncQueue.getQueueSummary();
      const totalWoCount = await dexieDb.work_orders.count();
      const totalPhotoCount = await dexieDb.photos.count();
      
      const pendingOps = await idbService.getPendingOperations();
      const absensiPending = pendingOps.filter(op => op.tableName === 'ABSENSI').length;
      const otherPending = pendingOps.filter(op => op.tableName !== 'ABSENSI').length;

      setStats({
        ...summary,
        pendingCount: summary.pendingCount + otherPending + absensiPending,
        totalWoCount,
        totalPhotoCount,
        absensiPending,
      });
    } catch (err) {
      console.warn('Error loading sync stats:', err);
    }
  };

  useEffect(() => {
    loadStats();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = offlineSyncQueue.subscribe((evt) => {
      if (evt.status === 'SYNCING') {
        setIsSyncing(true);
        setSyncProgress(evt.message || 'Menyinkronkan data...');
      } else if (evt.status === 'COMPLETED' || evt.status === 'ERROR') {
        setIsSyncing(false);
        setSyncProgress(evt.message || '');
        loadStats();
      }
    });

    const interval = setInterval(() => {
      loadStats();
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      showToast('Perangkat sedang OFFLINE. Hubungkan internet untuk menyinkronkan data.', 'warning');
      return;
    }

    setIsSyncing(true);
    showToast('Memulai sinkronisasi data ke server HyperCloud...', 'info');

    try {
      // 1. Process Realisasi & WO Delete Queue
      const relResult = await offlineSyncQueue.processQueue();
      
      // 2. Process General Operations (Absensi, WO Create, etc.)
      const genResult = await syncManager.processPendingOperations();
      
      const totalSynced = relResult.synced + genResult.successCount;
      const totalFailed = relResult.failed + genResult.failCount;

      if (totalFailed === 0) {
        showToast(`Sinkronisasi selesai! ${totalSynced} item berhasil terkirim.`, 'success');
      } else {
        showToast(`Sinkronisasi selesai dengan beberapa kendala: ${totalSynced} berhasil, ${totalFailed} gagal.`, 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Terjadi kesalahan saat sinkronisasi.', 'error');
    } finally {
      setIsSyncing(false);
      loadStats();
    }
  };

  const handleClearLocalData = async () => {
    if (window.confirm('Hapus semua data antrean dan cache lokal yang masih tertahan di perangkat?')) {
      try {
        await offlineSyncQueue.clearLocalData();
        await idbService.clearAll();
        showToast('Semua data tertahan di penyimpanan lokal berhasil dihapus.', 'success');
        loadStats();
      } catch (err: any) {
        showToast('Gagal membersihkan data lokal: ' + err.message, 'error');
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-teal-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-black uppercase tracking-wider mb-3">
              <Zap className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              <span>APHRO Offline-First Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Pusat Sinkronisasi Data Lapangan
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Aplikasi dapat bekerja 100% offline di lokasi tanpa sinyal. Data Realisasi, Foto, & GPS tersimpan aman di perangkat dan disinkronkan otomatis saat ada internet.
            </p>
          </div>

          <div className="flex flex-col items-end w-full sm:w-auto">
            <div className={`px-4 py-2.5 rounded-2xl flex items-center space-x-2.5 font-bold text-xs shadow-md border ${
              isOnline 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              {isOnline ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span>ONLINE — Terhubung ke Server</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <WifiOff className="w-4 h-4 text-amber-400" />
                  <span>OFFLINE — Mode Perangkat Lokal</span>
                </>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              Last Sync: <span className="text-white font-bold">{stats.lastSyncAt || 'Belum pernah'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Sync Status Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Pending Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Menunggu (Pending)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white font-display">
            {stats.pendingCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Realisasi tersimpan lokal & siap diupload
          </p>
        </div>

        {/* Syncing Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sedang Upload
            </span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <CloudUpload className={`w-5 h-5 ${isSyncing ? 'animate-bounce' : ''}`} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white font-display">
            {stats.syncingCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Item sedang dikirim bertahap
          </p>
        </div>

        {/* Synced Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tersinkron (Synced)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white font-display">
            {stats.syncedCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Realisasi sukses masuk database server
          </p>
        </div>

        {/* Failed Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gagal (Failed)
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black font-display text-rose-600 dark:text-rose-400">
            {stats.failedCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Akan dicoba ulang otomatis (Retry backoff)
          </p>
        </div>
      </div>

      {/* Main Action Control Panel */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span>Status Local Database (Dexie IndexedDB)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Penyimpanan lokal perangkat untuk memastikan tidak ada data yang hilang saat koneksi terputus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClearLocalData}
              disabled={isSyncing}
              className="px-4 py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs sm:text-sm rounded-2xl border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center space-x-2"
              title="Hapus data antrean dan cache lokal yang tertahan di browser"
            >
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Hapus Data Lokal</span>
            </button>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="px-6 py-3 bg-gradient-to-r from-teal-700 via-teal-600 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-teal-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan Data...' : 'Sinkronkan Sekarang'}</span>
            </button>
          </div>
        </div>

        {/* Sync Progress Status Banner */}
        {syncProgress && (
          <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 text-xs font-bold flex items-center space-x-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400" />
            <span>{syncProgress}</span>
          </div>
        )}

        {/* Local Storage Stats List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Work Orders Ter-cache</span>
              <p className="text-xl font-black text-slate-900 dark:text-white font-display">
                {stats.totalWoCount} WO
              </p>
            </div>
            <Database className="w-7 h-7 text-slate-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Foto Tersimpan Lokal</span>
              <p className="text-xl font-black text-slate-900 dark:text-white font-display">
                {stats.totalPhotoCount} Foto
              </p>
            </div>
            <CloudUpload className="w-7 h-7 text-slate-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Keamanan Transaction ID</span>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 mt-1">
                <ShieldCheck className="w-4 h-4" />
                <span>UUID Anti-Duplikasi</span>
              </p>
            </div>
          </div>
        </div>

        {/* Workflow Information Box */}
        <div className="p-5 rounded-2xl bg-slate-950 text-slate-300 text-xs space-y-3 border border-slate-800">
          <p className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
            <Zap className="w-4 h-4 text-teal-400" />
            <span>Alur Sinkronisasi Lapangan (Offline-First Workflow)</span>
          </p>
          <ul className="space-y-2 list-disc list-inside text-slate-400 font-medium">
            <li><strong className="text-white">Input Realisasi Offline:</strong> Petugas mengisi WO, mengambil foto sebelum & sesudah, watermark, dan lokasi GPS saat berada di daerah blank spot.</li>
            <li><strong className="text-white">Penyimpanan Lokal:</strong> Data langsung tersimpan di database IndexedDB perangkat dan langsung tampil di halaman Realisasi dengan status <span className="text-amber-400">⏳ Menunggu Sinkronisasi</span>.</li>
            <li><strong className="text-white">Sinkronisasi Otomatis:</strong> Begitu HP mendapatkan jaringan internet, Sync Engine mengirim antrean data bertahap ke server PostgreSQL tanpa membuat record ganda.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
