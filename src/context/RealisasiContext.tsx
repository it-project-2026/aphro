import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { Realisasi } from '../types';
import { INITIAL_REALISASI } from '../data/initialData';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { GASApiService } from '../services/gasApiService';
import { addToOfflineQueue } from '../services/offlineSyncQueue';
import { formatDriveViewUrl } from '../utils/driveUtils';

interface RealisasiContextType {
  realisasiList: Realisasi[];
  setRealisasiList: (list: Realisasi[]) => void;
  addRealisasi: (rel: Omit<Realisasi, 'id' | 'createdAt'>) => Promise<Realisasi>;
}

const RealisasiContext = React.createContext<RealisasiContextType | undefined>(undefined);

export function RealisasiProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [realisasiList, setRealisasiList] = usePersistState<Realisasi[]>('aphro_realisasi', INITIAL_REALISASI);

  const addRealisasi = React.useCallback(async (relData: Omit<Realisasi, 'id' | 'createdAt'>) => {
    const newRel: Realisasi = {
      ...relData,
      id: 'REL-' + Date.now(),
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    
    // Always update local state optimistically so data is immediately saved on device
    setRealisasiList(prev => [newRel, ...prev]);

    const { photosSebelum, photosSesudah, ...gasRelData } = relData;
    const payloadToSave = {
      ...gasRelData,
      id: newRel.id,
      folderId: settings.photoFolderId || settings.driveFolderId || '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    };

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('REALISASI', payloadToSave);
      showToast(`⚡ Realisasi WO ${relData.nomorWO} tersimpan lokal di perangkat. Akan otomatis disinkronkan saat terhubung internet.`, 'info');
    } else {
      try {
        const res = await GASApiService.saveRealisasi(settings.gasWebAppUrl, payloadToSave);
        if (res.status === 'success') {
          showToast(`Realisasi WO ${relData.nomorWO} tersimpan di Spreadsheet!`, 'success');
          if (res.fotoSebelumUrl || res.fotoSesudahUrl) {
            setRealisasiList(prev => prev.map(item => {
              if (item.id === newRel.id) {
                return {
                  ...item,
                  fotoSebelumUrl: res.fotoSebelumUrl ? formatDriveViewUrl(res.fotoSebelumUrl) : item.fotoSebelumUrl,
                  fotoSesudahUrl: res.fotoSesudahUrl ? formatDriveViewUrl(res.fotoSesudahUrl) : item.fotoSesudahUrl,
                };
              }
              return item;
            }));
          }
        } else {
          addToOfflineQueue('REALISASI', payloadToSave);
          showToast(`⚡ Tersimpan lokal di HP. Gagal kirim ke Spreadsheet, masuk antrean sinkronisasi.`, 'warning');
        }
      } catch (err) {
        console.error('GAS Save Realisasi error:', err);
        addToOfflineQueue('REALISASI', payloadToSave);
        showToast('⚡ Data Realisasi tersimpan di HP/Perangkat. Akan disinkronkan saat terhubung internet.', 'warning');
      }
    }

    return newRel;
  }, [setRealisasiList, settings.gasWebAppUrl, settings.photoFolderId, settings.driveFolderId, showToast]);

  return (
    <RealisasiContext.Provider value={{ realisasiList, setRealisasiList, addRealisasi }}>
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
