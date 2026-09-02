import * as React from 'react';
import { syncManager, HealthCheckResult } from '../services/syncManager';
import { idbService } from '../services/indexedDbService';
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
  lastUpdatedText: string;
  showSyncBanner: boolean;
  setShowSyncBanner: (show: boolean) => void;
  dismissSyncBanner: () => void;
  syncWithGAS: (showToast?: (msg: string, type?: any) => void, isSilent?: boolean) => Promise<any>;
  processPendingQueue: (showToast?: (msg: string, type?: any) => void, isAuto?: boolean) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  healthCheck: () => Promise<HealthCheckResult>;
  refreshPendingCount: () => void;
  triggerActivitySync: (isSilent?: boolean) => Promise<void>;
}

const GASSyncContext = React.createContext<GASSyncContextType | undefined>(undefined);

export function GASSyncProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { setMasterData } = useMasterData();
  const { setWorkOrders } = useWorkOrders();
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
  const [lastUpdatedText, setLastUpdatedText] = React.useState('Belum diperbarui');

  const autoDismissTimerRef = React.useRef<any>(null);

  // Configure syncManager whenever settings change
  React.useEffect(() => {
    syncManager.configure(settings.gasWebAppUrl, settings.spreadsheetId);
  }, [settings.gasWebAppUrl, settings.spreadsheetId]);

  const dismissSyncBanner = React.useCallback(() => {
    setShowSyncBanner(false);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  const refreshPendingCount = React.useCallback(async () => {
    const ops = await idbService.getPendingOperations();
    setPendingCount(ops.length);
    return ops.length;
  }, []);

  const healthCheck = React.useCallback(async () => {
    const result = await syncManager.healthCheck();
    setIsGasConnected(result.database === 'ONLINE');
    return result;
  }, []);

  const checkConnection = React.useCallback(async () => {
    const res = await healthCheck();
    return res.database === 'ONLINE';
  }, [healthCheck]);

  // Initial load from IndexedDB (< 1s render)
  React.useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const { cachedData, lastUpdatedText: text, pendingCount: pCount } = await syncManager.initialize();
        if (!isMounted) return;

        setLastUpdatedText(text);
        setPendingCount(pCount);

        if (cachedData) {
          if (cachedData.WORK_ORDER) setWorkOrders(cachedData.WORK_ORDER);
          if (cachedData.REALISASI) setRealisasiList(cachedData.REALISASI);
          if (cachedData.ABSENSI) setAbsensiList(cachedData.ABSENSI);

          setMasterData({
            ulp: cachedData.ULP,
            penyulang: cachedData.PENYULANG,
            regu: cachedData.REGU_ROW,
            petugas: cachedData.PETUGAS,
            users: cachedData.USERS,
          });
        }
      } catch (err) {
        console.warn('SyncManager initial cache load warning:', err);
      }
    }

    init();

    // Subscribe to SyncManager updates
    const unsubscribe = syncManager.subscribe((event) => {
      if (!isMounted) return;

      if (event.lastUpdatedText) {
        setLastUpdatedText(event.lastUpdatedText);
      }

      if (event.type === 'DATA_UPDATED' && event.tableName && event.data) {
        const tName = event.tableName;
        const data = event.data;

        if (tName === 'WORK_ORDER' || tName === 'WORK_ORDERS') setWorkOrders(data);
        else if (tName === 'REALISASI') setRealisasiList(data);
        else if (tName === 'ABSENSI') setAbsensiList(data);
        else if (['ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS', 'USERS'].includes(tName)) {
          const key = tName === 'REGU_ROW' ? 'regu' : (tName.toLowerCase() as 'ulp' | 'penyulang' | 'petugas' | 'users');
          setMasterData({
            [key]: data,
          });
        }
      } else if (event.type === 'PENDING_QUEUE_CHANGED') {
        const ops = Array.isArray(event.data) ? event.data : [];
        setPendingCount(ops.length);
      } else if (event.type === 'SYNC_STATUS_CHANGED') {
        if (event.status === 'SYNCHRONIZING' || event.status === 'PROCESSING_QUEUE') {
          setIsSyncing(true);
        } else if (event.status === 'IDLE') {
          setIsSyncing(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [setMasterData, setWorkOrders, setRealisasiList, setAbsensiList]);

  // Process offline pending queue
  const processPendingQueue = React.useCallback(async (
    showToast?: (msg: string, type?: any) => void,
    isAuto = false
  ) => {
    if (!navigator.onLine) {
      refreshPendingCount();
      return;
    }

    setIsSyncing(true);
    setSyncStage('syncing');
    setShowSyncBanner(true);
    setSyncMessage('Memproses antrean transaksi offline...');

    try {
      const processedCount = await syncManager.processPendingOperations();
      await refreshPendingCount();

      if (processedCount > 0) {
        setSyncStage('success');
        setSyncMessage(`✅ Berhasil menyinkronkan ${processedCount} data transaksi ke database.`);
        if (showToast) showToast(`✅ ${processedCount} data offline berhasil disinkronkan!`, 'success');
      } else {
        setSyncStage('idle');
      }
    } catch {
      setSyncStage('error');
      setSyncMessage('Gagal memproses transaksi offline.');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  // Main sync function (version-based via SyncManager)
  const syncWithGAS = React.useCallback(async (
    showToast?: (msg: string, type?: any) => void,
    isSilent = false
  ) => {
    if (isSyncing) return null;

    if (!settings.gasWebAppUrl) {
      if (showToast && !isSilent) showToast('GAS Web App URL belum dikonfigurasi', 'warning');
      setIsGasConnected(false);
      return null;
    }

    if (!navigator.onLine) {
      if (showToast && !isSilent) showToast('Mode Offline. Menggunakan data cache lokal.', 'warning');
      setIsGasConnected(false);
      return null;
    }

    setIsSyncing(true);
    setSyncStage('syncing');
    if (!isSilent) setShowSyncBanner(true);
    setSyncMessage('Memeriksa versi database...');

    try {
      // 1. Process pending operations first
      await syncManager.processPendingOperations();
      await refreshPendingCount();

      // 2. Perform version check & sync changed tables
      const syncedTables = await syncManager.syncAllRequired();

      setIsGasConnected(true);
      setSyncStage('success');
      setSyncMessage('Data terbaru berhasil diperbarui.');
      setLastUpdatedText(syncManager.getLastUpdatedText());

      if (showToast && !isSilent) {
        showToast('Data berhasil diperbarui!', 'success');
      }

      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = setTimeout(() => {
        if (!isSilent) setShowSyncBanner(false);
        setSyncStage('idle');
      }, 4000);

      return syncedTables;
    } catch (err) {
      console.error('syncWithGAS error:', err);
      setSyncStage('error');
      setSyncMessage('Gagal menyinkronkan data.');
      if (showToast && !isSilent) showToast('Gagal terhubung ke database.', 'error');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, settings.gasWebAppUrl, refreshPendingCount]);

  // Network status listeners
  React.useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      checkConnection().catch(() => {});
      syncManager.processPendingOperations().then(() => {
        refreshPendingCount();
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsGasConnected(false);
      setSyncStage('idle');
      setSyncMessage('Mode Offline (Tanpa Koneksi). Menggunakan cache lokal.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkConnection().catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection, refreshPendingCount]);

  const triggerActivitySync = React.useCallback(async (isSilent = true) => {
    if (!navigator.onLine || !settings.gasWebAppUrl) return;
    await syncManager.processPendingOperations();
    await syncManager.syncAllRequired();
  }, [settings.gasWebAppUrl]);

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
        lastUpdatedText,
        showSyncBanner,
        setShowSyncBanner,
        dismissSyncBanner,
        syncWithGAS,
        processPendingQueue,
        checkConnection,
        healthCheck,
        refreshPendingCount,
        triggerActivitySync,
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
