import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { Realisasi } from '../types';
import { INITIAL_REALISASI } from '../data/initialData';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';
import { SupabaseService } from '../services/supabaseService';
import { syncManager } from '../services/syncManager';
import { getLocalDateTimeString, normalizeDateISO, parseDateFromNomorWO } from '../utils/dateUtils';

interface RealisasiContextType {
  realisasiList: Realisasi[];
  setRealisasiList: React.Dispatch<React.SetStateAction<Realisasi[]>>;
  addRealisasi: (rel: Omit<Realisasi, 'id' | 'createdAt'>) => Promise<Realisasi>;
  updateRealisasi: (id: string, updates: Partial<Realisasi>) => void;
  deleteRealisasi: (id: string) => void;
  refreshRealisasi: () => Promise<void>;
}

const RealisasiContext = React.createContext<RealisasiContextType | undefined>(undefined);

export function RealisasiProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [realisasiList, setRealisasiList] = usePersistState<Realisasi[]>('aphro_realisasi', INITIAL_REALISASI);

  const lastFetchTime = React.useRef(0);

  const refreshRealisasi = React.useCallback(async (force: boolean = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTime.current < 2000) return; // Limit to once every 2 seconds unless forced
    lastFetchTime.current = now;

    try {
      const unitId = SupabaseService.getActiveUnitId();
      const res = await SupabaseService.fetchRealisasi(unitId);
      if (res.success && res.data) {
        setRealisasiList(prev => {
          const map = new Map<string, Realisasi>();
          res.data.forEach(item => {
            const woDate = parseDateFromNomorWO(item.nomorWO);
            const isNullOrEmpty = !item.tanggalRealisasi || 
                                  item.tanggalRealisasi === 'null' || 
                                  item.tanggalRealisasi === 'undefined' || 
                                  String(item.tanggalRealisasi).trim() === '';
            const normalized = normalizeDateISO(item.tanggalRealisasi);
            if (normalized) {
              item.tanggalRealisasi = normalized;
            } else if (woDate && isNullOrEmpty) {
              item.tanggalRealisasi = woDate;
            }
            const key = item.id || item.syncId || `${item.nomorWO || ''}-${item.noTiang || ''}`;
            map.set(key, item);
          });
          // Preserve only unsynced offline records from previous state for the same unit
          prev.forEach(item => {
            if (item.isSynced === false && (!item.unitId || item.unitId === unitId)) {
              const key = item.id || item.syncId || `${item.nomorWO || ''}-${item.noTiang || ''}`;
              if (!map.has(key)) {
                map.set(key, item);
              }
            }
          });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.warn('Error loading Realisasi from Supabase:', err);
    }
  }, [setRealisasiList]);

  React.useEffect(() => {
    refreshRealisasi(true);
  }, [refreshRealisasi, settings.namaUnitLayanan, settings.spreadsheetId, user]);

  const addRealisasi = React.useCallback(async (relData: Omit<Realisasi, 'id' | 'createdAt' | 'isSynced' | 'syncId'>) => {
    const syncId = `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRel: Realisasi = {
      ...relData,
      id: 'REL-' + Date.now(),
      createdAt: getLocalDateTimeString(),
      syncId,
      isSynced: false // Default to false until synced to Supabase
    };
    
    // Optimistic UI Update
    setRealisasiList(prev => [newRel, ...prev]);

    const unitId = SupabaseService.getActiveUnitId();
    
    try {
      const res = await syncManager.executeMutation({
        type: 'CREATE',
        tableName: 'REALISASI',
        payload: newRel,
        apiCall: async () => {
          const result = await SupabaseService.saveRealisasi(unitId, newRel);
          return { 
            status: result.success ? 'success' : 'error', 
            message: result.error 
          };
        }
      });

      if (!res.offline) {
        showToast(`Realisasi WO ${relData.nomorWO || ''} berhasil disinkronkan!`, 'success');
        // Update local status to synced
        setRealisasiList(prev => prev.map(r => r.syncId === syncId ? { ...r, isSynced: true } : r));
      } else {
        showToast(`Realisasi tersimpan secara offline.`, 'info');
      }
    } catch (err) {
      console.warn('Sync execution error:', err);
      showToast('Tersimpan di antrean offline.', 'info');
    }

    return newRel;
  }, [setRealisasiList, showToast]);

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

    const unitId = SupabaseService.getActiveUnitId();
    try {
      await syncManager.executeMutation({
        type: 'UPDATE',
        tableName: 'REALISASI',
        payload: updatedRel,
        apiCall: async () => {
          const result = await SupabaseService.saveRealisasi(unitId, updatedRel);
          return { status: result.success ? 'success' : 'error', message: result.error };
        }
      });
      showToast('Realisasi berhasil diperbarui', 'success');
    } catch (err) {
      showToast('Perubahan tersimpan lokal.', 'info');
    }
  }, [realisasiList, setRealisasiList, showToast]);

  const deleteRealisasi = React.useCallback(async (id: string) => {
    const existing = realisasiList.find(r => r.id === id);
    setRealisasiList(prev => prev.filter(rel => rel.id !== id));
    
    if (existing) {
      const unitId = SupabaseService.getActiveUnitId();
      try {
        await syncManager.executeMutation({
          type: 'DELETE',
          tableName: 'REALISASI',
          payload: { id },
          apiCall: async () => {
            const result = await SupabaseService.deleteRealisasi(unitId, id);
            return { status: result.success ? 'success' : 'error', message: result.error };
          }
        });
      } catch (e) {
        console.warn('Delete Realisasi offline queue error:', e);
      }
    }
    
    showToast('Realisasi dihapus', 'info');
  }, [realisasiList, setRealisasiList, showToast]);

  return (
    <RealisasiContext.Provider value={{ realisasiList, setRealisasiList, addRealisasi, updateRealisasi, deleteRealisasi, refreshRealisasi }}>
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
