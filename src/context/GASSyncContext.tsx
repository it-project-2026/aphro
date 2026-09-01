import * as React from 'react';
import { SyncService } from '../services/syncService';
import { GASApiService } from '../services/gasApiService';
import { processOfflineSyncQueue, getOfflineQueue, getItemReadableDescription } from '../services/offlineSyncQueue';
import { useSettings } from './SettingsContext';
import { useMasterData } from './MasterDataContext';
import { useWorkOrders } from './WorkOrderContext';
import { useRealisasi } from './RealisasiContext';
import { useAbsensi } from './AbsensiContext';

export type SyncStage = 'idle' | 'detecting' | 'syncing' | 'success' | 'error';

export interface SyncProgressInfo {
  current: number;
  total: number;
  percent: number;
  currentItemDescription?: string;
}

export interface LastSyncStats {
  successCount: number;
  failCount: number;
  totalCount: number;
  timestamp: string;
  isAutoSync?: boolean;
}

interface GASSyncContextType {
  isSyncing: boolean;
  syncStage: SyncStage;
  syncProgress: SyncProgressInfo | null;
  syncMessage: string | null;
  lastSyncStats: LastSyncStats | null;
  isGasConnected: boolean;
  isOnline: boolean;
  pendingCount: number;
  showSyncBanner: boolean;
  setShowSyncBanner: (show: boolean) => void;
  dismissSyncBanner: () => void;
  syncWithGAS: (showToast?: (msg: string, type?: any) => void, isSilent?: boolean) => Promise<any>;
  processPendingQueue: (showToast?: (msg: string, type?: any) => void, isAuto?: boolean) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  refreshPendingCount: () => void;
}

const GASSyncContext = React.createContext<GASSyncContextType | undefined>(undefined);

export function GASSyncProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { setMasterData } = useMasterData();
  const { workOrders, setWorkOrders } = useWorkOrders();
  const { setRealisasiList } = useRealisasi();
  const { setAbsensiList } = useAbsensi();

  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncStage, setSyncStage] = React.useState<SyncStage>('idle');
  const [syncProgress, setSyncProgress] = React.useState<SyncProgressInfo | null>(null);
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);
  const [lastSyncStats, setLastSyncStats] = React.useState<LastSyncStats | null>(null);
  const [showSyncBanner, setShowSyncBanner] = React.useState(false);

  const [isGasConnected, setIsGasConnected] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = React.useState(0);

  const autoDismissTimerRef = React.useRef<any>(null);

  const dismissSyncBanner = React.useCallback(() => {
    setShowSyncBanner(false);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  const refreshPendingCount = React.useCallback(() => {
    const count = getOfflineQueue().length;
    setPendingCount(count);
    return count;
  }, []);

  const checkConnection = React.useCallback(async () => {
    if (!navigator.onLine || !settings.gasWebAppUrl) {
      setIsGasConnected(false);
      return false;
    }

    const connected = await GASApiService.testConnection(settings.gasWebAppUrl);
    setIsGasConnected(connected);
    return connected;
  }, [settings.gasWebAppUrl]);

  const processPendingQueue = React.useCallback(async (
    showToast?: (msg: string, type?: any) => void,
    isAuto = false
  ) => {
    if (!settings.gasWebAppUrl || !navigator.onLine) {
      refreshPendingCount();
      return;
    }

    const currentQueue = getOfflineQueue();
    if (currentQueue.length === 0) {
      refreshPendingCount();
      return;
    }

    setIsSyncing(true);
    setSyncStage('syncing');
    setShowSyncBanner(true);
    setSyncProgress({
      current: 1,
      total: currentQueue.length,
      percent: 0,
      currentItemDescription: getItemReadableDescription(currentQueue[0]),
    });
    setSyncMessage(
      isAuto
        ? `📡 Sinyal Terdeteksi! Menyinkronkan ${currentQueue.length} data offline ke Spreadsheet...`
        : `Menyinkronkan ${currentQueue.length} data offline ke Spreadsheet...`
    );

    if (showToast) {
      showToast(
        isAuto
          ? `📡 Sinyal ditemukan! Mengirim ${currentQueue.length} data ke Spreadsheet...`
          : `Menyinkronkan ${currentQueue.length} data offline ke Spreadsheet...`,
        'info'
      );
    }

    try {
      const res = await processOfflineSyncQueue(
        settings.gasWebAppUrl,
        settings.spreadsheetId,
        (prog) => {
          setSyncProgress({
            current: prog.current,
            total: prog.total,
            percent: prog.percent,
            currentItemDescription: prog.description,
          });
          setSyncMessage(`Mengirim data ${prog.current} dari ${prog.total}: ${prog.description}`);
        }
      );

      refreshPendingCount();

      // Update local state to mark items as synced to prevent re-syncing or duplicate display
      if (res.syncedItems && res.syncedItems.length > 0) {
        res.syncedItems.forEach(item => {
          if (item.type === 'REALISASI') {
            setRealisasiList(prev => prev.map(rel => {
              if (rel.syncId === item.syncId || rel.id === item.payloadId) {
                return { ...rel, isSynced: true };
              }
              return rel;
            }));
          }
        });
      }

      const stats: LastSyncStats = {
        successCount: res.successCount,
        failCount: res.failCount,
        totalCount: currentQueue.length,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isAutoSync: isAuto,
      };
      setLastSyncStats(stats);

      if (res.successCount > 0 && res.failCount === 0) {
        setSyncStage('success');
        setSyncMessage(`✅ ${res.successCount} data offline berhasil dikirim ke Google Spreadsheet!`);
        setIsGasConnected(true);

        if (showToast) {
          showToast(`✅ ${res.successCount} data offline berhasil disinkronkan ke Spreadsheet!`, 'success');
        }

        // Auto dismiss banner after 6 seconds
        if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = setTimeout(() => {
          setShowSyncBanner(false);
          setSyncStage('idle');
        }, 6000);
      } else if (res.successCount > 0 && res.failCount > 0) {
        setSyncStage('error');
        setSyncMessage(`Sinkronisasi parsial: ${res.successCount} berhasil, ${res.failCount} gagal.`);
        if (showToast) {
          showToast(`Sinkronisasi parsial: ${res.successCount} berhasil, ${res.failCount} gagal.`, 'warning');
        }
      } else if (res.failCount > 0) {
        setSyncStage('error');
        setSyncMessage(`Gagal menyinkronkan data offline: ${res.errors[0] || 'Periksa koneksi'}`);
        if (showToast) {
          showToast(`Gagal menyinkronkan data offline: ${res.errors[0] || 'Periksa koneksi'}`, 'error');
        }
      }
    } catch (err: any) {
      setSyncStage('error');
      setSyncMessage('Terjadi kendala saat menyinkronkan data.');
    } finally {
      setIsSyncing(false);
    }
  }, [settings.gasWebAppUrl, settings.spreadsheetId, setRealisasiList, refreshPendingCount]);

  const syncWithGAS = React.useCallback(async (showToast?: (msg: string, type?: any) => void, isSilent = false) => {
    if (isSyncing) return null;
    
    if (!settings.gasWebAppUrl) {
      if (showToast && !isSilent) showToast('GAS Web App URL belum dikonfigurasi', 'warning');
      setIsGasConnected(false);
      return null;
    }

    if (!navigator.onLine) {
      if (showToast && !isSilent) showToast('Perangkat dalam mode Offline. Data tersimpan di perangkat.', 'warning');
      setIsGasConnected(false);
      return null;
    }

    setIsSyncing(true);
    const initialPendingCount = getOfflineQueue().length;
    if (initialPendingCount > 0) {
      setSyncStage('syncing');
      setShowSyncBanner(true);
      setSyncMessage(`Mengirim ${initialPendingCount} data dari perangkat ke Spreadsheet...`);
    } else {
      setSyncMessage('Menyinkronkan data dengan Google Spreadsheet...');
    }
    if (showToast && !isSilent) showToast('Menghubungkan ke Spreadsheet...', 'info');

    try {
      // 1. Process pending offline queue first
      const queueRes = await processOfflineSyncQueue(
        settings.gasWebAppUrl,
        settings.spreadsheetId,
        (prog) => {
          setSyncProgress({
            current: prog.current,
            total: prog.total,
            percent: prog.percent,
            currentItemDescription: prog.description,
          });
          setSyncMessage(`Mengirim data offline (${prog.current}/${prog.total}): ${prog.description}`);
        }
      );
      refreshPendingCount();

      // Update local state to mark items as synced from queue
      if (queueRes.syncedItems && queueRes.syncedItems.length > 0) {
        queueRes.syncedItems.forEach(item => {
          if (item.type === 'REALISASI') {
            setRealisasiList(prev => prev.map(rel => {
              if (rel.syncId === item.syncId || rel.id === item.payloadId) {
                return { ...rel, isSynced: true };
              }
              return rel;
            }));
          }
        });
      }

      setSyncMessage('Memuat data terbaru dari Google Spreadsheet...');

      // 2. Fetch full updated dataset
      const data = await SyncService.fetchAllData(settings.gasWebAppUrl, settings.spreadsheetId);

      if (data.masterData) {
        setMasterData({
          ulp: Array.isArray(data.masterData.ulp) ? data.masterData.ulp : undefined,
          penyulang: Array.isArray(data.masterData.penyulang) ? data.masterData.penyulang : undefined,
          regu: Array.isArray(data.masterData.regu) ? data.masterData.regu : undefined,
          petugas: Array.isArray(data.masterData.petugas) ? data.masterData.petugas : undefined,
          users: Array.isArray(data.masterData.users) ? data.masterData.users : undefined,
        });
      }

      // Helper for normalization
      const clean = (s?: string | null) => (s || '').trim().toUpperCase();

      let finalWOs = workOrders;
      let finalRealisasi = [];
      let finalAbsensi = [];

      if (Array.isArray(data.workOrders)) {
        finalWOs = data.workOrders.filter((wo: any) => wo && wo.nomorWO);
        setWorkOrders(finalWOs);
      }

      if (Array.isArray(data.realisasi)) {
        const uniqueRel = new Map<string, any>();
        data.realisasi.forEach((rel: any) => {
          if (!rel) return;
          const key = `${rel.id}_${rel.workOrderId}_${rel.tanggalRealisasi}_${rel.latitude}_${rel.longitude}_${clean(rel.keterangan)}`;
          uniqueRel.set(key, rel);
        });
        finalRealisasi = Array.from(uniqueRel.values());
        setRealisasiList(finalRealisasi);
      }

      if (Array.isArray(data.absensi)) {
        const uniqueAbs = new Map<string, any>();
        data.absensi.forEach((abs: any) => {
          if (!abs) return;
          const datePart = (abs.tanggal || '').slice(0, 10);
          const key = `${datePart}_${clean(abs.reguName)}`;
          if (!uniqueAbs.has(key)) {
            uniqueAbs.set(key, abs);
          } else {
            const existing = uniqueAbs.get(key);
            uniqueAbs.set(key, {
              ...existing,
              fotoMasuk: existing.fotoMasuk || abs.fotoMasuk,
              fotoKeluar: existing.fotoKeluar || abs.fotoKeluar,
              petugasList: (existing.petugasList && existing.petugasList.length > 0) ? existing.petugasList : abs.petugasList,
              timestampMasuk: existing.timestampMasuk || abs.timestampMasuk,
              timestampKeluar: existing.timestampKeluar || abs.timestampKeluar,
            });
          }
        });
        finalAbsensi = Array.from(uniqueAbs.values());
        setAbsensiList(finalAbsensi);
      }

      // 3. Cache the full dataset for instantaneous future loads
      try {
        localStorage.setItem('aphro_cached_synced_data', JSON.stringify({
          masterData: data.masterData,
          realisasi: finalRealisasi,
          absensi: finalAbsensi,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        console.warn('Failed to cache synced data:', e);
      }

      setIsGasConnected(true);
      setSyncStage('success');
      setSyncMessage('Data berhasil disinkronkan dengan Google Spreadsheet!');

      if (showToast && !isSilent) {
        if (data.errors.length > 0) {
          showToast(`Sinkronisasi parsial. ${data.errors.length} sumber gagal.`, 'warning');
        } else {
          showToast('Data berhasil disinkronkan dengan Google Spreadsheet!', 'success');
        }
      }

      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = setTimeout(() => {
        if (!isSilent) setShowSyncBanner(false);
        setSyncStage('idle');
      }, 5000);
      
      return data;
    } catch (error) {
      console.error('GAS Sync error:', error);
      setSyncStage('error');
      setSyncMessage('Gagal terhubung ke Google Spreadsheet');
      if (showToast && !isSilent) showToast('Gagal terhubung ke Google Spreadsheet Web App', 'error');
      return null;
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [isSyncing, settings.gasWebAppUrl, settings.spreadsheetId, setMasterData, workOrders, setWorkOrders, setRealisasiList, setAbsensiList, refreshPendingCount]);

  React.useEffect(() => {
    // 0. Load cached data from local storage immediately
    try {
      const cachedStr = localStorage.getItem('aphro_cached_synced_data');
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached.masterData) {
          setMasterData({
            ulp: Array.isArray(cached.masterData.ulp) ? cached.masterData.ulp : undefined,
            penyulang: Array.isArray(cached.masterData.penyulang) ? cached.masterData.penyulang : undefined,
            regu: Array.isArray(cached.masterData.regu) ? cached.masterData.regu : undefined,
            petugas: Array.isArray(cached.masterData.petugas) ? cached.masterData.petugas : undefined,
            users: Array.isArray(cached.masterData.users) ? cached.masterData.users : undefined,
          });
        }
        if (Array.isArray(cached.realisasi)) setRealisasiList(cached.realisasi);
        if (Array.isArray(cached.absensi)) setAbsensiList(cached.absensi);
      }
    } catch (e) {
      console.warn('Failed to load cached sync data:', e);
    }

    refreshPendingCount();

    // AUTO-SYNC ON SIGNAL RESTORATION (from no-signal to connected)
    const handleOnline = () => {
      setIsOnline(true);
      checkConnection().catch(() => {});
      
      const count = getOfflineQueue().length;
      if (settings.gasWebAppUrl && count > 0) {
        // Automatic sync when finding signal
        processPendingQueue(undefined, true).catch(() => {});
      } else if (settings.gasWebAppUrl) {
        // Light refresh
        syncWithGAS(undefined, true).catch(() => {});
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsGasConnected(false);
      setSyncStage('idle');
      setSyncMessage('Perangkat dalam mode Offline (Tanpa Sinyal). Data tersimpan di HP.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkConnection().catch(() => {});

    if (settings.autoSyncOnStart && settings.gasWebAppUrl && navigator.onLine) {
      syncWithGAS(undefined, true).catch(() => {});
    }

    const interval = setInterval(() => {
      if (navigator.onLine) {
        checkConnection().catch(() => {});
        const count = getOfflineQueue().length;
        if (count > 0 && settings.gasWebAppUrl) {
          processPendingQueue(undefined, true).catch(() => {});
        }
      } else {
        setIsOnline(false);
        setIsGasConnected(false);
      }
    }, 2 * 60 * 1000); // Check every 2 minutes

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection, processPendingQueue, refreshPendingCount, settings.autoSyncOnStart, settings.gasWebAppUrl, syncWithGAS, setMasterData, setRealisasiList, setAbsensiList]);

  return (
    <GASSyncContext.Provider
      value={{
        isSyncing,
        syncStage,
        syncProgress,
        syncMessage,
        lastSyncStats,
        isGasConnected,
        isOnline,
        pendingCount,
        showSyncBanner,
        setShowSyncBanner,
        dismissSyncBanner,
        syncWithGAS,
        processPendingQueue,
        checkConnection,
        refreshPendingCount,
      }}
    >
      {children}
    </GASSyncContext.Provider>
  );
}

export function useGASSync() {
  const context = React.useContext(GASSyncContext);
  if (context === undefined) {
    throw new Error('useGASSync must be used within a GASSyncProvider');
  }
  return context;
}

