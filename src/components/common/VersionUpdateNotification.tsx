import React, { useEffect, useState } from 'react';
import { APP_VERSION } from '../../config/version';
import { RefreshCw, Sparkles, X } from 'lucide-react';

interface VersionInfo {
  version: string;
  build?: string;
  updatedAt?: string;
}

export const VersionUpdateNotification: React.FC = () => {
  const [newVersionAvailable, setNewVersionAvailable] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const checkVersion = async () => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (response.ok) {
        const data: VersionInfo = await response.json();
        if (data && data.version && data.version !== APP_VERSION) {
          console.log(`[VersionCheck] New version detected! Current: ${APP_VERSION}, Server: ${data.version}`);
          setLatestVersion(data.version);
          setNewVersionAvailable(true);
        }
      }
    } catch (err) {
      console.warn('[VersionCheck] Unable to fetch version.json:', err);
    }
  };

  useEffect(() => {
    // Check version on mount
    checkVersion();

    // Check on window focus / visibility change
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    // Check on network online
    const handleOnline = () => {
      checkVersion();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('online', handleOnline);

    // Periodic check every 3 minutes
    const interval = setInterval(checkVersion, 3 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    try {
      // 1. Tell Service Worker to skip waiting if active
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }

      // 2. Clear caches to ensure clean refresh
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
    } catch (e) {
      console.warn('Error clearing caches during update:', e);
    } finally {
      // 3. Force hard reload from server
      window.location.reload();
    }
  };

  if (!newVersionAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9999] animate-bounce-short">
      <div className="bg-slate-900 border border-amber-500/40 text-white rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          title="Tutup pemberitahuan"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              Versi Terbaru APHRO Tersedia!
              <span className="text-xs bg-amber-500/30 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                v{latestVersion}
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Aplikasi telah diperbarui dengan peningkatan terbaru (Versi saat ini: <span className="font-mono text-slate-400">v{APP_VERSION}</span>). Silakan perbarui untuk menerapkan perubahan.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
          >
            Nanti saja
          </button>
          <button
            onClick={handleUpdateNow}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg shadow-md hover:shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Memperbarui...' : 'UPDATE SEKARANG'}
          </button>
        </div>
      </div>
    </div>
  );
};
