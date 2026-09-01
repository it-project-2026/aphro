import React from 'react';
import { useGASSync } from '../../context/GASSyncContext';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Radio,
  ArrowUpRight,
  HardDrive,
} from 'lucide-react';

/**
 * Indikator Pengiriman Data dari Penyimpanan Perangkat (Local Storage Queue) ke Spreadsheet
 * HANYA muncul saat:
 * 1. Aplikasi mendeteksi sinyal internet / online, DAN
 * 2. Terdapat data di penyimpanan perangkat (Local Storage Queue) yang sedang dikirim ke Google Spreadsheet
 */
export const SyncStatusBanner: React.FC = () => {
  const {
    isSyncing,
    syncStage,
    syncProgress,
    syncMessage,
    lastSyncStats,
    showSyncBanner,
    dismissSyncBanner,
    processPendingQueue,
  } = useGASSync();

  // HANYA tampil jika sedang dalam proses sync queue atau baru saja menyelesaikan pengiriman queue
  if (!showSyncBanner) {
    return null;
  }

  // 1. Sedang Mengirim Data dari Local Storage Queue ke Google Spreadsheet
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
                  Sinyal Ditemukan
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

  // 2. Sukses Mengirim Seluruh Data Local Storage Queue ke Spreadsheet
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

  // 3. Terkendala / Sebagian Gagal
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
                {syncMessage || 'Sinyal tidak stabil. Data tetap aman di penyimpanan perangkat dan akan dikirim ulang saat sinyal stabil.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => processPendingQueue(undefined, true)}
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
