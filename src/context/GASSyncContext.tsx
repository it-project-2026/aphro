import * as React from 'react';
import { SyncService } from '../services/syncService';
import { GASApiService } from '../services/gasApiService';
import { processOfflineSyncQueue, getOfflineQueue } from '../services/offlineSyncQueue';
import { useSettings } from './SettingsContext';
import { useMasterData } from './MasterDataContext';
import { useWorkOrders } from './WorkOrderContext';
import { useRealisasi } from './RealisasiContext';
import { useAbsensi } from './AbsensiContext';

interface GASSyncContextType {
  isSyncing: boolean;
  isGasConnected: boolean;
  isOnline: boolean;
  pendingCount: number;
  syncWithGAS: (showToast?: (msg: string, type?: any) => void) => Promise<any>;
  processPendingQueue: (showToast?: (msg: string, type?: any) => void) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  refreshPendingCount: () => void;
}

const GASSyncContext = React.createContext<GASSyncContextType | undefined>(undefined);

export function GASSyncProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { setMasterData } = useMasterData();
  const { setWorkOrders } = useWorkOrders();
  const { setRealisasiList } = useRealisasi();
  const { setAbsensiList } = useAbsensi();

  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isGasConnected, setIsGasConnected] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = React.useState(0);

  const refreshPendingCount = React.useCallback(() => {
    setPendingCount(getOfflineQueue().length);
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

  const processPendingQueue = React.useCallback(async (showToast?: (msg: string, type?: any) => void) => {
    if (!settings.gasWebAppUrl || !navigator.onLine) {
      refreshPendingCount();
      return;
    }

    const currentQueue = getOfflineQueue();
    if (currentQueue.length === 0) {
      refreshPendingCount();
      return;
    }

    if (showToast) showToast(`Menyinkronkan ${currentQueue.length} data offline ke Spreadsheet...`, 'info');

    const res = await processOfflineSyncQueue(settings.gasWebAppUrl);
    refreshPendingCount();

    if (showToast) {
      if (res.successCount > 0 && res.failCount === 0) {
        showToast(`✅ ${res.successCount} data offline berhasil disinkronkan ke Spreadsheet!`, 'success');
      } else if (res.successCount > 0 && res.failCount > 0) {
        showToast(`Sinkronisasi parsial: ${res.successCount} berhasil, ${res.failCount} gagal.`, 'warning');
      } else if (res.failCount > 0) {
        showToast(`Gagal menyinkronkan data offline: ${res.errors[0] || 'Periksa koneksi'}`, 'error');
      }
    }
  }, [settings.gasWebAppUrl, refreshPendingCount]);

  const syncWithGAS = React.useCallback(async (showToast?: (msg: string, type?: any) => void) => {
    if (!settings.gasWebAppUrl) {
      if (showToast) showToast('GAS Web App URL belum dikonfigurasi', 'warning');
      setIsGasConnected(false);
      return null;
    }

    if (!navigator.onLine) {
      if (showToast) showToast('Perangkat dalam mode Offline. Data tersimpan di perangkat.', 'warning');
      setIsGasConnected(false);
      return null;
    }

    setIsSyncing(true);
    if (showToast) showToast('Menghubungkan ke Spreadsheet...', 'info');

    try {
      // 1. Process pending offline queue first
      await processOfflineSyncQueue(settings.gasWebAppUrl);
      refreshPendingCount();

      // 2. Fetch full updated dataset
      const data = await SyncService.fetchAllData(settings.gasWebAppUrl);

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

      if (Array.isArray(data.workOrders)) {
        // Deduplicate Work Orders by (nomorWO + penyulangName)
        const uniqueWOs = new Map<string, any>();
        data.workOrders.forEach((wo: any) => {
          if (!wo) return;
          const key = `${clean(wo.nomorWO)}_${clean(wo.penyulangName)}`;
          if (!uniqueWOs.has(key)) {
            uniqueWOs.set(key, wo);
          } else {
            // Keep the one with more realisasi info or later timestamp
            const existing = uniqueWOs.get(key);
            if ((Number(wo.totalRealisasi) || 0) > (Number(existing.totalRealisasi) || 0)) {
              uniqueWOs.set(key, wo);
            }
          }
        });
        setWorkOrders(Array.from(uniqueWOs.values()));
      }

      if (Array.isArray(data.realisasi)) {
        // Deduplicate Realisasi by (workOrderId + latitude + longitude + timestamp) or unique field if any
        // Since Realisasi often has multiple entries per WO, we use a broader key or just trust unique records from GAS
        // If GAS has duplicates, we filter them here
        const uniqueRel = new Map<string, any>();
        data.realisasi.forEach((rel: any) => {
          if (!rel) return;
          const key = `${rel.id}_${rel.workOrderId}_${rel.tanggalRealisasi}_${rel.latitude}_${rel.longitude}_${clean(rel.keterangan)}`;
          uniqueRel.set(key, rel);
        });
        setRealisasiList(Array.from(uniqueRel.values()));
      }

      if (Array.isArray(data.absensi)) {
        // Deduplicate Absensi by (tanggal + reguName)
        const uniqueAbs = new Map<string, any>();
        data.absensi.forEach((abs: any) => {
          if (!abs) return;
          const datePart = (abs.tanggal || '').slice(0, 10);
          const key = `${datePart}_${clean(abs.reguName)}`;
          
          if (!uniqueAbs.has(key)) {
            uniqueAbs.set(key, abs);
          } else {
            // Merge fotoMasuk and fotoKeluar if they are in different rows
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
        setAbsensiList(Array.from(uniqueAbs.values()));
      }

      setIsGasConnected(true);

      if (showToast) {
        if (data.errors.length > 0) {
          showToast(`Sinkronisasi parsial. ${data.errors.length} sumber gagal.`, 'warning');
        } else {
          showToast('Data berhasil disinkronkan dengan Google Spreadsheet!', 'success');
        }
      }
      
      return data;
    } catch (error) {
      console.error('GAS Sync error:', error);
      if (showToast) showToast('Gagal terhubung ke Google Spreadsheet Web App', 'error');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [settings.gasWebAppUrl, setMasterData, setWorkOrders, setRealisasiList, setAbsensiList, refreshPendingCount]);

  React.useEffect(() => {
    // 0. Load cached data from local storage immediately for instantaneous startup
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
        if (Array.isArray(cached.workOrders)) setWorkOrders(cached.workOrders);
        if (Array.isArray(cached.realisasi)) setRealisasiList(cached.realisasi);
        if (Array.isArray(cached.absensi)) setAbsensiList(cached.absensi);
      }
    } catch (e) {
      console.warn('Failed to load cached sync data:', e);
    }

    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      checkConnection().catch(() => {});
      if (settings.gasWebAppUrl) {
        processPendingQueue().catch(() => {});
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsGasConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkConnection().catch(() => {});

    if (settings.autoSyncOnStart && settings.gasWebAppUrl && navigator.onLine) {
      syncWithGAS().catch(() => {});
    }

    const interval = setInterval(() => {
      if (navigator.onLine) {
        checkConnection().catch(() => {});
        processPendingQueue().catch(() => {});
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
  }, [checkConnection, processPendingQueue, refreshPendingCount, settings.autoSyncOnStart, settings.gasWebAppUrl, syncWithGAS]);

  return (
    <GASSyncContext.Provider
      value={{
        isSyncing,
        isGasConnected,
        isOnline,
        pendingCount,
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
