import React from 'react';
import { useGASSync } from '../../context/GASSyncContext';
import { useToast } from '../../hooks/useToast';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Radio,
  HardDrive,
  Zap,
} from 'lucide-react';

/**
 * Indikator & Kontrol Pengiriman Data dari Penyimpanan Perangkat (Local Storage Queue) ke Spreadsheet.
 * Sekarang mendukung mode SINKRONISASI MANUAL dengan menekan Tombol Sync Data.
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
      showToast('Gagal menyinkronkan data dengan Google Spreadsheet', 'error');
    }
  };

  // HANYA tampil jika ada data pending atau sedang proses sync atau ada notifikasi hasil sync
  if (!showSyncBanner && pendingCount === 0) {
    return null;
  }

  // 1. STATE MANUAL PROMPT: Ada data di penyimpanan lokal perangkat yang menunggu untuk disinkronkan manual
  if (pendingCount > 0 && !isSyncing && syncStage !== 'success') {
    return (
      <aside
        aria-label="Notifikasi Sinkronisasi Data Manual"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[440px] bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-amber-500/60 p-4 animate-in slide-in-from-bottom-5 duration-300 ring-1 ring-amber-500/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3 min-w-0">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 shrink-0 mt-0.5">
              <HardDrive className="w-5 h-5 text-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping absolute -top-1 -right-1" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
                  Penyimpanan Perangkat
                </span>
                <span className="text-[11px] font-extrabold text-amber-200">
                  {pendingCount} Data Antrean
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-100 mt-1">
                Data Siap Disinkronkan ke Spreadsheet
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                Terdapat data baru tersimpan di memori perangkat. Tekan tombol <strong className="text-amber-300">Sync Data</strong> untuk mengirim ke Google Spreadsheet.
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

        {/* Tombol Sync Data Manual */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400 italic">
            {isOnline ? '🟢 Sinyal Online Tersedia' : '🔴 Sedang Offline (Data Aman di HP)'}
          </span>
          <button
            type="button"
            onClick={handleManualSyncClick}
            disabled={!isOnline}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 via-[#00A2B9] to-[#008396] hover:from-amber-600 hover:to-[#006e7e] text-white rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
            <span>Tombol Sync Data ({pendingCount})</span>
          </button>
        </div>
      </aside>
    );
  }

  // 2. Sedang Mengirim Data dari Local Storage Queue ke Google Spreadsheet
  if (isSyncing || syncStage === 'syncing') {
    return (
      <aside
        aria-label="Status Pengiriman Data Offline"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[420px] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-teal-500/50 p-4 animate-in slide-in-from-bottom-5 duration-300 ring-1 ring-teal-500/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Animasi Ikon Sinyal & Upload */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 shrink-0">
              <Radio className="w-5 h-5 text-teal-300 animate-pulse" />
              <RefreshCw className="w-4 h-4 text-emerald-300 animate-spin absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping mr-1.5" />
                  Menyinkronkan
                </span>
                {syncProgress && syncProgress.total > 0 && (
                  <span className="text-xs font-bold text-teal-200">
                    {syncProgress.current} / {syncProgress.total} Data ({syncProgress.percent}%)
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-100 mt-1 flex items-center gap-1.5 truncate">
                <HardDrive className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Kirim dari Perangkat ke Spreadsheet</span>
              </h4>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-teal-500/30">
            <div
              className="bg-gradient-to-r from-teal-500 via-[#00A2B9] to-emerald-400 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(syncProgress?.percent || 15, 10)}%` }}
            />
          </div>
        </div>

        {/* Detail Item yang Sedang Dikirim */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-300">
          <p className="truncate font-medium flex-1 mr-2 text-teal-100">
            {syncProgress?.currentItemDescription || syncMessage || 'Mengirim antrean data ke Google Spreadsheet...'}
          </p>
          <span className="font-mono font-bold text-teal-300 shrink-0">
            {syncProgress?.percent ? `${syncProgress.percent}%` : 'Sinkron...'}
          </span>
        </div>
      </aside>
    );
  }

  // 3. Sukses Mengirim Seluruh Data Local Storage Queue ke Spreadsheet
  if (syncStage === 'success' && lastSyncStats && lastSyncStats.totalCount > 0) {
    return (
      <aside
        aria-label="Status Pengiriman Selesai"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[420px] bg-emerald-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-emerald-400/50 p-4 animate-in slide-in-from-bottom-5 duration-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Sinkron Selesai
                </span>
                <span className="text-[11px] text-emerald-200 opacity-90">
                  {lastSyncStats.timestamp}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white mt-1">
                Data Perangkat Sukses Terkirim
              </h4>
              <p className="text-[11px] text-emerald-100 mt-0.5 truncate">
                {lastSyncStats.successCount} data dari penyimpanan perangkat berhasil disimpan ke Google Spreadsheet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissSyncBanner}
            className="p-1 rounded-lg hover:bg-emerald-800/60 text-emerald-200 hover:text-white transition-colors shrink-0"
            title="Tutup Notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  // 4. Terkendala / Sebagian Gagal
  if (syncStage === 'error' && lastSyncStats && lastSyncStats.totalCount > 0) {
    return (
      <aside
        aria-label="Status Pengiriman Terkendala"
        className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-md w-[calc(100vw-1.5rem)] sm:w-[420px] bg-rose-950/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-rose-500/50 p-4 animate-in slide-in-from-bottom-5 duration-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-rose-100">
                Pengiriman Data Tertunda
              </h4>
              <p className="text-[11px] text-rose-200 mt-0.5">
                {syncMessage || 'Sinyal tidak stabil. Data tetap aman di penyimpanan perangkat dan dapat disinkronkan kembali dengan menekan tombol Sync Data.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={handleManualSyncClick}
              className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Coba Lagi</span>
            </button>
            <button
              type="button"
              onClick={dismissSyncBanner}
              className="p-1 rounded-lg hover:bg-rose-800/60 text-rose-200 hover:text-white transition-colors"
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
