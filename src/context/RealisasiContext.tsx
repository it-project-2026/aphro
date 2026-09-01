import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { Realisasi } from '../types';
import { INITIAL_REALISASI } from '../data/initialData';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { GASApiService } from '../services/gasApiService';
import { addToOfflineQueue } from '../services/offlineSyncQueue';
import { formatDriveViewUrl } from '../utils/driveUtils';
import { getLocalDateTimeString } from '../utils/dateUtils';

interface RealisasiContextType {
  realisasiList: Realisasi[];
  setRealisasiList: React.Dispatch<React.SetStateAction<Realisasi[]>>;
  addRealisasi: (rel: Omit<Realisasi, 'id' | 'createdAt'>) => Promise<Realisasi>;
  updateRealisasi: (id: string, updates: Partial<Realisasi>) => void;
  deleteRealisasi: (id: string) => void;
}

const RealisasiContext = React.createContext<RealisasiContextType | undefined>(undefined);

export function RealisasiProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [realisasiList, setRealisasiList] = usePersistState<Realisasi[]>('aphro_realisasi', INITIAL_REALISASI);

  const addRealisasi = React.useCallback(async (relData: Omit<Realisasi, 'id' | 'createdAt' | 'isSynced' | 'syncId'>) => {
    const syncId = `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRel: Realisasi = {
      ...relData,
      id: 'REL-' + Date.now(),
      createdAt: getLocalDateTimeString(),
      syncId,
      isSynced: false
    };
    
    // Always update local state optimistically so data is immediately saved on device
    setRealisasiList(prev => [newRel, ...prev]);

    const { photosSebelum, photosSesudah, ...gasRelData } = relData;
    const payloadToSave = {
      ...gasRelData,
      id: newRel.id,
      syncId: syncId, // Pass unique sync ID to GAS
      folderId: settings.photoFolderId || settings.driveFolderId || '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    };

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('REALISASI', payloadToSave);
      showToast(`⚡ Tersimpan di perangkat (Mode Offline). Akan disinkronkan otomatis.`, 'info');
    } else {
      try {
        const res = await GASApiService.saveRealisasi(settings.gasWebAppUrl, settings.spreadsheetId, payloadToSave);
        if (res.status === 'success') {
          showToast(`Realisasi WO ${relData.nomorWO} tersimpan di Spreadsheet!`, 'success');
          
          // Mark as synced locally
          setRealisasiList(prev => prev.map(item => {
            if (item.syncId === syncId) {
              return {
                ...item,
                isSynced: true,
                fotoSebelumUrl: res.fotoSebelumUrl ? formatDriveViewUrl(res.fotoSebelumUrl) : item.fotoSebelumUrl,
                fotoSesudahUrl: res.fotoSesudahUrl ? formatDriveViewUrl(res.fotoSesudahUrl) : item.fotoSesudahUrl,
              };
            }
            return item;
          }));
        } else {
          addToOfflineQueue('REALISASI', payloadToSave);
          showToast(`⚡ Gagal kirim ke Spreadsheet, masuk antrean sinkronisasi.`, 'warning');
        }
      } catch (err) {
        console.error('GAS Save Realisasi error:', err);
        addToOfflineQueue('REALISASI', payloadToSave);
        showToast('⚡ Data tersimpan di HP. Akan disinkronkan otomatis saat online.', 'warning');
      }
    }

    return newRel;
  }, [setRealisasiList, settings.gasWebAppUrl, settings.photoFolderId, settings.driveFolderId, showToast]);

  const updateRealisasi = React.useCallback(async (id: string, updates: Partial<Realisasi>) => {
    const existing = realisasiList.find(r => r.id === id);
    if (!existing) return;

    const updatedRel = { ...existing, ...updates };

    setRealisasiList(prev => prev.map(rel => {
      if (rel.id === id) {
        return updatedRel;
      }
      return rel;
    }));

    if (settings.gasWebAppUrl) {
      try {
        const res = await GASApiService.updateRealisasi(settings.gasWebAppUrl, settings.spreadsheetId, id, updatedRel);
        if (res.status === 'success') {
          showToast('Realisasi berhasil diperbarui di Spreadsheet', 'success');
        } else {
          showToast('Gagal sinkronisasi ke Spreadsheet, perubahan tersimpan lokal.', 'warning');
        }
      } catch (err) {
        showToast('Gagal sinkronisasi, perubahan tersimpan lokal.', 'warning');
      }
    }
  }, [realisasiList, setRealisasiList, settings.gasWebAppUrl, settings.spreadsheetId, showToast]);

  const deleteRealisasi = React.useCallback(async (id: string) => {
    setRealisasiList(prev => prev.filter(rel => rel.id !== id));

    if (settings.gasWebAppUrl) {
      try {
        const res = await GASApiService.deleteRealisasi(settings.gasWebAppUrl, id);
        if (res.status === 'success') {
          showToast('Realisasi berhasil dihapus dari Spreadsheet', 'success');
        } else {
          showToast('Gagal menghapus di Spreadsheet, terhapus lokal.', 'warning');
        }
      } catch (err) {
        showToast('Gagal menghapus di Spreadsheet, terhapus lokal.', 'warning');
      }
    }
  }, [setRealisasiList, settings.gasWebAppUrl, showToast]);

  return (
    <RealisasiContext.Provider value={{ realisasiList, setRealisasiList, addRealisasi, updateRealisasi, deleteRealisasi }}>
      {children}
    </RealisasiContext.Provider>
  );
}

export function useRealisasi() {
  const context = React.useContext(RealisasiContext);
  if (context === undefined) {
    throw new Error('useRealisasi must be used within a RealisasiProvider');
  }
  return context;
}
