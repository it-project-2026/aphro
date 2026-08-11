import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
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
  syncWithGAS: (showToast?: (msg: string, type?: any) => void) => Promise<void>;
  processPendingQueue: (showToast?: (msg: string, type?: any) => void) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  refreshPendingCount: () => void;
}

const GASSyncContext = createContext<GASSyncContextType | undefined>(undefined);

export function GASSyncProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { setMasterData } = useMasterData();
  const { setWorkOrders } = useWorkOrders();
  const { setRealisasiList } = useRealisasi();
  const { setAbsensiList } = useAbsensi();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isGasConnected, setIsGasConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getOfflineQueue().length);
  }, []);

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine || !settings.gasWebAppUrl) {
      setIsGasConnected(false);
      return false;
    }

    const connected = await GASApiService.testConnection(settings.gasWebAppUrl);
    setIsGasConnected(connected);
    return connected;
  }, [settings.gasWebAppUrl]);

  const processPendingQueue = useCallback(async (showToast?: (msg: string, type?: any) => void) => {
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

  const syncWithGAS = useCallback(async (showToast?: (msg: string, type?: any) => void) => {
    if (!settings.gasWebAppUrl) {
      if (showToast) showToast('GAS Web App URL belum dikonfigurasi', 'warning');
      setIsGasConnected(false);
      return;
    }

    if (!navigator.onLine) {
      if (showToast) showToast('Perangkat dalam mode Offline. Data tersimpan di perangkat.', 'warning');
      setIsGasConnected(false);
      return;
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
          ulp: data.masterData.ulp && data.masterData.ulp.length > 0 ? data.masterData.ulp : undefined,
          penyulang: data.masterData.penyulang && data.masterData.penyulang.length > 0 ? data.masterData.penyulang : undefined,
          regu: data.masterData.regu && data.masterData.regu.length > 0 ? data.masterData.regu : undefined,
          petugas: data.masterData.petugas && data.masterData.petugas.length > 0 ? data.masterData.petugas : undefined,
          users: data.masterData.users && data.masterData.users.length > 0 ? data.masterData.users : undefined,
        });
      }

      if (data.workOrders && data.workOrders.length > 0) setWorkOrders(data.workOrders);
      if (data.realisasi && data.realisasi.length > 0) setRealisasiList(data.realisasi);
      if (data.absensi && data.absensi.length > 0) setAbsensiList(data.absensi);

      setIsGasConnected(true);

      if (showToast) {
        if (data.errors.length > 0) {
          showToast(`Sinkronisasi parsial. ${data.errors.length} sumber gagal.`, 'warning');
        } else {
          showToast('Data berhasil disinkronkan dengan Google Spreadsheet!', 'success');
        }
      }
    } catch (error) {
      console.error('GAS Sync error:', error);
      if (showToast) showToast('Gagal terhubung ke Google Spreadsheet Web App', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [settings.gasWebAppUrl, setMasterData, setWorkOrders, setRealisasiList, setAbsensiList, refreshPendingCount]);

  useEffect(() => {
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
  const context = useContext(GASSyncContext);
  if (context === undefined) {
    throw new Error('useGASSync must be used within a GASSyncProvider');
  }
  return context;
}
