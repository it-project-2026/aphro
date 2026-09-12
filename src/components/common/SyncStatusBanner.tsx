import React from 'react';
import { useGASSync } from '../../context/GASSyncContext';
import { useToast } from '../../hooks/useToast';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  HardDrive,
  Zap,
} from 'lucide-react';

/**
 * Indikator & Kontrol Sinkronisasi Data Manual dari Perangkat ke Database.
 * Tampilan tenang, stabil (tidak berkedip-kedip), dan berjalan murni manual saat tombol ditekan.
 */
export const SyncStatusBanner: React.FC = () => {
  const {
    isSyncing,
    syncStage,
    syncProgress,
    syncMessage,
    lastSyncStats,
    pendingCount,
    showSyncBanner,
    dismissSyncBanner,
    processPendingQueue,
    syncWithGAS,
    isOnline,
  } = useGASSync();
  const { showToast } = useToast();

  const handleManualSyncClick = async () => {
    try {
      if (pendingCount > 0) {
        await processPendingQueue(showToast);
      }
      await syncWithGAS(showToast);
    } catch {
      showToast('Gagal menyinkronkan data dengan Database', 'error');
    }
  };

  // Hanya tampil jika ada data pending atau sedang proses sync atas permintaan user
  if (!showSyncBanner && pendingCount === 0) {
    return null;
  }

  // 1. STATE SINKRONISASI SEDANG BERJALAN (User menekan tombol Sinkron)
  if (isSyncing || syncStage === 'syncing') {
    return (
      <aside
        aria-label="Status Sinkronisasi Data"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[420px] bg-slate-900 text-white rounded-2xl shadow-2xl border border-teal-500/40 p-4 transition-opacity duration-300"
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 shrink-0">
            <RefreshCw className="w-5 h-5 text-teal-300 animate-spin" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Menyinkronkan
              </span>
              {syncProgress && syncProgress.total > 0 && (
                <span className="text-xs font-semibold text-teal-200">
                  {syncProgress.current} / {syncProgress.total} Data ({syncProgress.percent}%)
                </span>
              )}
            </div>
            <h4 className="text-xs font-bold text-slate-100 mt-1 flex items-center gap-1.5 truncate">
              <HardDrive className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Menyimpan ke Database PostgreSQL</span>
            </h4>
          </div>
        </div>

        {/* Progress Bar Halus */}
        <div className="mt-3">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-teal-500/20">
            <div
              className="bg-gradient-to-r from-teal-500 via-[#00A2B9] to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(syncProgress?.percent || 25, 15)}%` }}
            />
          </div>
        </div>

        {/* Detail status */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
          <p className="truncate font-medium flex-1 mr-2 text-teal-100">
            {syncProgress?.currentItemDescription || syncMessage || 'Menyimpan data perangkat ke Database...'}
          </p>
          <span className="font-mono font-bold text-teal-300 shrink-0">
            {syncProgress?.percent ? `${syncProgress.percent}%` : 'Sinkron...'}
          </span>
        </div>
      </aside>
    );
  }

  // 2. STATE SUKSES SINKRONISASI
  if (syncStage === 'success' && showSyncBanner) {
    const successCount = lastSyncStats?.successCount ?? 0;
    const failCount = lastSyncStats?.failCount ?? 0;
    const totalCount = lastSyncStats?.totalCount ?? (successCount + failCount);

    return (
      <aside
        aria-label="Status Sinkronisasi Selesai"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[440px] bg-slate-900 text-white rounded-2xl shadow-2xl border border-emerald-500/50 p-5 transition-opacity duration-300 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Sinkron Selesai
                </span>
                {lastSyncStats?.timestamp && (
                  <span className="text-[11px] text-emerald-200 opacity-90 font-mono">
                    {lastSyncStats.timestamp}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-black text-white mt-1">
                Hasil Sinkronisasi Perangkat ke Database
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissSyncBanner}
            className="p-1 rounded-lg hover:bg-slate-800 text-emerald-200 hover:text-white transition-colors shrink-0 cursor-pointer"
            title="Tutup Notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metering Summary Box */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300">Data Berhasil Masuk</span>
            <span className="text-xl font-black text-emerald-400 font-mono">{successCount}</span>
            <span className="block text-[10px] text-emerald-200/80 mt-0.5">Item tersimpan</span>
          </div>
          <div className={`rounded-xl p-3 text-center border ${failCount > 0 ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' : 'bg-slate-800/60 border-slate-700 text-slate-300'}`}>
            <span className="block text-[10px] font-bold uppercase tracking-wider">Data Gagal</span>
            <span className={`text-xl font-black font-mono ${failCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>{failCount}</span>
            <span className="block text-[10px] opacity-85 mt-0.5">Item tertunda</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 font-medium">
          {syncMessage || `Total ${totalCount} item diproses dari penyimpanan perangkat.`}
        </p>
      </aside>
    );
  }

  // 3. STATE ADA DATA PENDING DI PERANGKAT (Menunggu Tombol Sinkron ditekan manual)
  if (pendingCount > 0 && !isSyncing) {
    return (
      <aside
        aria-label="Notifikasi Sinkronisasi Data Manual"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[440px] bg-slate-900 text-white rounded-2xl shadow-2xl border border-amber-500/40 p-4 transition-opacity duration-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 shrink-0 mt-0.5">
              <HardDrive className="w-5 h-5 text-amber-400" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Data Perangkat
                </span>
                <span className="text-[11px] font-bold text-amber-200">
                  {pendingCount} Item
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-100 mt-1">
                Data Siap Disinkronkan ke Database
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Data tersimpan di memori HP. Tekan <strong className="text-amber-300">Tombol Sinkron</strong> saat siap mengirim ke Database.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissSyncBanner}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
            title="Sembunyikan Notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tombol Sinkron Manual */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">
            {isOnline ? '🟢 Online' : '🔴 Offline (Data tersimpan di perangkat)'}
          </span>
          <button
            type="button"
            onClick={handleManualSyncClick}
            disabled={!isOnline}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 via-[#00A2B9] to-[#008396] hover:from-amber-600 hover:to-[#006e7e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
            <span>Sinkron Sekarang ({pendingCount})</span>
          </button>
        </div>
      </aside>
    );
  }

  // 4. STATE TERKENDALA
  if (syncStage === 'error' && showSyncBanner) {
    return (
      <aside
        aria-label="Status Pengiriman Terkendala"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[420px] bg-slate-900 text-white rounded-2xl shadow-2xl border border-rose-500/40 p-4 transition-opacity duration-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-rose-100">
                Sinkronisasi Tertunda
              </h4>
              <p className="text-[11px] text-rose-200 mt-0.5">
                {syncMessage || 'Koneksi database tidak stabil. Data tetap aman di memori perangkat dan dapat disinkronkan kembali.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={handleManualSyncClick}
              className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Coba Lagi</span>
            </button>
            <button
              type="button"
              onClick={dismissSyncBanner}
              className="p-1 rounded-lg hover:bg-slate-800 text-rose-200 hover:text-white transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return null;
};

