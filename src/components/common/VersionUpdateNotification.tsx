import React, { useEffect, useState, useRef } from 'react';
import { APP_VERSION } from '../../config/version';
import {
  checkApplicationVersion,
  performAppUpdate,
  isUserBusyWithForm,
  VersionCheckResult,
} from '../../services/versionService';
import { RefreshCw, Sparkles, X, AlertTriangle, ShieldAlert, AlertCircle } from 'lucide-react';

export const VersionUpdateNotification: React.FC = () => {
  const [checkResult, setCheckResult] = useState<VersionCheckResult | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [confirmFormBusy, setConfirmFormBusy] = useState<boolean>(false);

  // Throttle timestamp to avoid rapid duplicate checks on tab switching
  const lastCheckTimeRef = useRef<number>(0);

  const runVersionCheck = async () => {
    const now = Date.now();
    // Throttle: don't check more frequently than once every 20 seconds
    if (now - lastCheckTimeRef.current < 20000) {
      return;
    }
    lastCheckTimeRef.current = now;

    try {
      const result = await checkApplicationVersion(APP_VERSION);
      setCheckResult(result);
    } catch (err) {
      console.warn('[APP VERSION CHECK ERROR]', err);
    }
  };

  useEffect(() => {
    // 1. Immediate startup check
    runVersionCheck();

    // 2. Window focus & visibility change check (when returning from background/screen-off)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runVersionCheck();
      }
    };

    const handleFocus = () => {
      runVersionCheck();
    };

    // 3. Online event check (e.g. signal recovered in the field)
    const handleOnline = () => {
      runVersionCheck();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // 4. Periodic polling every 3 minutes
    const interval = setInterval(() => {
      runVersionCheck();
    }, 3 * 60 * 1000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  const handleTriggerUpdate = async (ignoreFormBusy = false) => {
    if (!checkResult?.latestVersion) return;

    // Rule 10: Check if user is actively filling a form (Realisasi, Absensi, WO)
    if (!ignoreFormBusy && isUserBusyWithForm()) {
      setConfirmFormBusy(true);
      return;
    }

    setConfirmFormBusy(false);
    setIsUpdating(true);

    try {
      await performAppUpdate(checkResult.latestVersion);
    } catch (e) {
      console.error('[APP VERSION] Update execution error:', e);
      setIsUpdating(false);
    }
  };

  // If no update is available or not checked yet, render nothing
  if (!checkResult || (!checkResult.updateAvailable && !checkResult.forceUpdateRequired)) {
    return null;
  }

  // =========================================================================
  // SCENARIO 1: FORCE UPDATE REQUIRED (currentVersion < minimumVersion)
  // Blocking modal overlay to prevent data incompatibility
  // =========================================================================
  if (checkResult.forceUpdateRequired) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white animate-in fade-in zoom-in duration-200">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="p-3 bg-red-500/20 text-red-400 rounded-xl shrink-0">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Pembaruan Aplikasi Wajib
              </h3>
              <p className="text-xs text-red-300 font-medium">
                Versi aplikasi Anda sudah tidak didukung
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 text-xs text-slate-300">
            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
              <span className="text-slate-400">Versi Saat Ini:</span>
              <span className="font-mono text-red-400 font-semibold">v{checkResult.currentVersion}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
              <span className="text-slate-400">Versi Minimum Diperlukan:</span>
              <span className="font-mono text-emerald-400 font-semibold">v{checkResult.minimumVersion}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Versi Terbaru Tersedia:</span>
              <span className="font-mono text-amber-400 font-semibold">v{checkResult.latestVersion}</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs text-cyan-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>PENTING:</strong> Data offline, antrean Realisasi, dan riwayat pekerjaan Anda tetap aman di perangkat. Hanya asset sistem yang akan diperbarui.
            </span>
          </div>

          {confirmFormBusy && (
            <div className="mt-4 p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-200">
              <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
                <AlertTriangle className="w-4 h-4" />
                Peringatan Form Sedang Aktif
              </div>
              <p>
                Anda terdeteksi sedang mengisi data. Mohon pastikan data telah disimpan agar tidak hilang sebelum aplikasi dimuat ulang.
              </p>
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => setConfirmFormBusy(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                >
                  Batal / Simpan Dulu
                </button>
                <button
                  onClick={() => handleTriggerUpdate(true)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                >
                  Tetap Perbarui Sekarang
                </button>
              </div>
            </div>
          )}

          {!confirmFormBusy && (
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => handleTriggerUpdate(false)}
                disabled={isUpdating}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-[0.98] transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'MEMPERBARUI ASSET APLIKASI...' : 'PERBARUI APLIKASI SEKARANG'}
              </button>
              {checkResult.loopDetected && (
                <p className="text-[11px] text-amber-300 text-center mt-1">
                  Pembaruan telah dicoba. Jika versi belum berganti, silakan lakukan refresh browser manual (Ctrl+F5) atau bersihkan cache browser.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCENARIO 2: OPTIONAL UPDATE AVAILABLE (latest > current, current >= minimum)
  // Non-blocking toast notification banner
  // =========================================================================
  if (dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9999] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900/95 border border-amber-500/40 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          title="Tutup pemberitahuan"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="pr-5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
              Versi Terbaru APHRO Tersedia!
              <span className="text-xs bg-amber-500/30 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                v{checkResult.latestVersion}
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Pembaruan sistem telah dirilis (Versi aktif Anda: <span className="font-mono text-slate-400">v{checkResult.currentVersion}</span>). Perbarui untuk menerapkan perbaikan terbaru.
            </p>
          </div>
        </div>

        {confirmFormBusy && (
          <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-200">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Anda sedang membuka form
            </div>
            <p className="text-[11px] leading-relaxed">
              Pastikan input Anda sudah disimpan terlebih dahulu agar tidak hilang saat reload.
            </p>
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => setConfirmFormBusy(false)}
                className="px-2.5 py-1 bg-slate-800 text-white rounded text-xs"
              >
                Simpan Dulu
              </button>
              <button
                onClick={() => handleTriggerUpdate(true)}
                className="px-2.5 py-1 bg-amber-600 text-slate-950 font-bold rounded text-xs"
              >
                Tetap Perbarui
              </button>
            </div>
          </div>
        )}

        {!confirmFormBusy && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            {checkResult.loopDetected ? (
              <span className="text-[11px] text-amber-400 mr-auto">
                Cache perangkat menahan versi lama. Lakukan hard refresh browser.
              </span>
            ) : null}
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Nanti saja
            </button>
            <button
              onClick={() => handleTriggerUpdate(false)}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-95 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Memperbarui...' : 'UPDATE SEKARANG'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
