import React from 'react';
import { useGASSync } from '../../context/GASSyncContext';
import { useToast } from '../../hooks/useToast';
import {
  FileSpreadsheet,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  X,
  Zap,
  ArrowUpRight,
  Database,
} from 'lucide-react';

export const SyncStatusBanner: React.FC = () => {
  const {
    isSyncing,
    syncStage,
    syncProgress,
    syncMessage,
    lastSyncStats,
    isOnline,
    pendingCount,
    isGasConnected,
    showSyncBanner,
    setShowSyncBanner,
    dismissSyncBanner,
    processPendingQueue,
  } = useGASSync();

  const { showToast } = useToast();

  // If everything is normal and idle without pending items or active banner, render nothing
  if (!isSyncing && !showSyncBanner && isOnline && pendingCount === 0) {
    return null;
  }

  // 1. ACTIVE SYNCING STATE (Auto-syncing or manual sync)
  if (isSyncing || syncStage === 'syncing') {
    return (
      <div className="sticky top-0 z-50 px-3 sm:px-6 py-2 bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white shadow-xl border-b border-teal-500/40 animate-in slide-in-from-top duration-200">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Left: Icon & Status Text */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/40 shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-teal-300 animate-pulse" />
              <RefreshCw className="w-3.5 h-3.5 text-teal-200 animate-spin absolute -bottom-1 -right-1" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping mr-1.5" />
                  Sinkronisasi Spreadsheet
                </span>
                {syncProgress && syncProgress.total > 0 && (
                  <span className="text-[11px] font-bold text-teal-300">
                    ({syncProgress.current} / {syncProgress.total}) • {syncProgress.percent}%
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-100 truncate mt-0.5">
                {syncMessage || 'Sedang mengirim data offline ke Google Spreadsheet...'}
              </p>
            </div>
          </div>

          {/* Right: Progress bar & Live Indicator */}
          <div className="flex items-center space-x-3 sm:max-w-xs w-full sm:w-auto shrink-0">
            <div className="w-full sm:w-48 bg-slate-800 rounded-full h-2 overflow-hidden border border-teal-500/30">
              <div
                className="bg-gradient-to-r from-[#00A2B9] via-teal-300 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(syncProgress?.percent || 25, 10)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-teal-300 whitespace-nowrap font-bold">
              {syncProgress?.percent ? `${syncProgress.percent}%` : 'Sync...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. SUCCESS NOTIFICATION (Just finished syncing)
  if (syncStage === 'success' && showSyncBanner) {
    return (
      <div className="sticky top-0 z-50 px-3 sm:px-6 py-2 bg-emerald-600 text-white shadow-lg border-b border-emerald-500 animate-in slide-in-from-top duration-200">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-xs font-bold text-white truncate">
                  {lastSyncStats?.isAutoSync
                    ? '✅ Sinyal Terhubung & Sinkronisasi Otomatis Berhasil!'
                    : '✅ Data Berhasil Disinkronkan ke Spreadsheet!'}
                </p>
                {lastSyncStats?.timestamp && (
                  <span className="text-[10px] text-emerald-100 hidden sm:inline opacity-90">
                    pukul {lastSyncStats.timestamp}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-100 truncate">
                {lastSyncStats && lastSyncStats.successCount > 0
                  ? `${lastSyncStats.successCount} data offline telah sukses tersimpan di Google Spreadsheet.`
                  : syncMessage || 'Seluruh data Work Order, Absensi, dan Realisasi telah terupdate.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissSyncBanner}
            className="p-1 rounded-lg hover:bg-emerald-700 text-emerald-100 hover:text-white transition-colors shrink-0"
            title="Tutup Pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 3. ERROR NOTIFICATION (Failed sync)
  if (syncStage === 'error' && showSyncBanner) {
    return (
      <div className="sticky top-0 z-50 px-3 sm:px-6 py-2.5 bg-rose-600 text-white shadow-lg border-b border-rose-700 animate-in slide-in-from-top duration-200">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Sinkronisasi Spreadsheet Terkendala
              </p>
              <p className="text-[11px] text-rose-100 truncate">
                {syncMessage || 'Koneksi jaringan terputus. Data tetap tersimpan aman di HP.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => processPendingQueue(showToast)}
              className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Coba Lagi</span>
            </button>
            <button
              type="button"
              onClick={dismissSyncBanner}
              className="p-1 rounded-lg hover:bg-rose-700 text-rose-100 hover:text-white transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. OFFLINE MODE WITH PENDING DATA (User in no-signal area)
  if (!isOnline && pendingCount > 0) {
    return (
      <div className="sticky top-0 z-40 px-3 sm:px-6 py-2 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white shadow-md border-b border-amber-500">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-amber-900/40 border border-amber-400/40 flex items-center justify-center shrink-0">
              <WifiOff className="w-3.5 h-3.5 text-amber-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-900/60 text-amber-100 border border-amber-400/40">
                  Mode Tanpa Sinyal
                </span>
                <p className="text-xs font-bold text-white truncate">
                  {pendingCount} Data Tersimpan di HP (Offline)
                </p>
              </div>
              <p className="text-[11px] text-amber-100 truncate mt-0.5">
                Data akan <strong>otomatis terkirim ke Spreadsheet</strong> begitu perangkat menemukan sinyal internet.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
            <span className="text-[11px] text-amber-200 bg-amber-900/50 px-2.5 py-1 rounded-lg border border-amber-400/30 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse mr-1" />
              Menunggu Sinyal...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 5. ONLINE WITH PENDING ITEMS READY TO BE SYNCED (If auto-sync hasn't triggered yet)
  if (isOnline && pendingCount > 0) {
    return (
      <div className="sticky top-0 z-40 px-3 sm:px-6 py-2 bg-gradient-to-r from-sky-600 via-teal-600 to-teal-700 text-white shadow-md border-b border-teal-500">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Sinyal Ditemukan! {pendingCount} Data Siap Dikirim ke Spreadsheet
              </p>
              <p className="text-[11px] text-teal-100 truncate">
                Klik tombol di samping untuk segera mengirim antrean data ke Spreadsheet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => processPendingQueue(showToast, true)}
            className="px-3 py-1 bg-white hover:bg-teal-50 text-[#008396] rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kirim Sekarang</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
