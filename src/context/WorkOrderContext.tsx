import * as React from 'react';
import { WorkOrder } from '../types';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { SupabaseService } from '../services/supabaseService';
import { syncManager } from '../services/syncManager';
import { getLocalDateTimeString, parseDateFromNomorWO } from '../utils/dateUtils';

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  displayedWorkOrders: WorkOrder[];
  selectedWoIdForRealisasi: string | null;
  isLoading: boolean;
  setSelectedWoIdForRealisasi: (id: string | null) => void;
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  addWorkOrder: (wo: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<WorkOrder>;
  updateWorkOrder: (id: string, wo: Partial<WorkOrder>) => Promise<void>;
  deleteWorkOrder: (id: string, nomorWO?: string) => Promise<void>;
  refreshWorkOrders: () => Promise<void>;
}

const WorkOrderContext = React.createContext<WorkOrderContextType | undefined>(undefined);

export function WorkOrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  
  const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
  const lastSyncRef = React.useRef<string | undefined>(undefined);
  const [selectedWoIdForRealisasi, setSelectedWoIdForRealisasi] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const isFetchingRef = React.useRef(false);

  // Auto-fetch Work Orders from Supabase on mount and whenever unit settings change
  const refreshWorkOrders = React.useCallback(async (page: number = 0) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const unitId = SupabaseService.getActiveUnitId();
      const res = await SupabaseService.fetchWorkOrders(unitId, page, 1000, page === 0 ? undefined : lastSyncRef.current);
      if (res.success && res.data) {
        // Detect and fix any mismatches or NULL dates between nomorWO and tanggal
        const corrected = res.data.map((wo) => {
          const parsedDate = parseDateFromNomorWO(wo.nomorWO);
          const isNullOrEmpty = !wo.tanggal || 
                                wo.tanggal === 'null' || 
                                wo.tanggal === 'undefined' || 
                                String(wo.tanggal).trim() === '';
          if (parsedDate && (isNullOrEmpty || wo.tanggal !== parsedDate)) {
            return { ...wo, tanggal: parsedDate };
          }
          return wo;
        });

        // For first page, replace; for subsequent pages, append
        setWorkOrders(prev => page === 0 ? corrected : [...prev, ...corrected]);
        
        // Update sync time only on first page fetch
        if (page === 0) {
          lastSyncRef.current = getLocalDateTimeString();
        }
      }
    } catch (err) {
      console.warn('Error loading Work Orders from Supabase:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    lastSyncRef.current = undefined;
    refreshWorkOrders(0);
  }, [refreshWorkOrders, settings.namaUnitLayanan, settings.spreadsheetId, user]);

  const correctedWorkOrders = React.useMemo(() => {
    return workOrders.map((wo) => {
      const parsedDate = parseDateFromNomorWO(wo.nomorWO);
      const isNullOrEmpty = !wo.tanggal || 
                            wo.tanggal === 'null' || 
                            wo.tanggal === 'undefined' || 
                            String(wo.tanggal).trim() === '';
      if (parsedDate && (isNullOrEmpty || wo.tanggal !== parsedDate)) {
        return { ...wo, tanggal: parsedDate };
      }
      return wo;
    });
  }, [workOrders]);

  const displayedWorkOrders = React.useMemo(() => {
    if (user && user.role === 'User') {
      const cleanStr = (s?: string | null) => {
        if (!s) return '';
        return String(s)
          .toLowerCase()
          .replace(/^(regu|tim|petugas)\s+/gi, '')
          .replace(/[^a-z0-9]/gi, '');
      };

      const userReguCandidates = [
        cleanStr(user.reguName),
        cleanStr(user.userName),
        cleanStr(user.name),
        cleanStr(user.nip),
        cleanStr(user.id),
      ].filter(Boolean);

      return correctedWorkOrders.filter((wo) => {
        // Direct Regu ID match
        if (user.reguId && wo.reguId && user.reguId === wo.reguId) return true;
        if (user.id && wo.petugasId && user.id === wo.petugasId) return true;

        // Regu Name / NAMA_REGU match
        const woReguClean = cleanStr(wo.reguName);
        if (woReguClean) {
          for (const uCand of userReguCandidates) {
            if (
              woReguClean === uCand ||
              (woReguClean.length >= 3 && uCand.length >= 3 && (woReguClean.includes(uCand) || uCand.includes(woReguClean)))
            ) {
              return true;
            }
          }
        }

        // Petugas Name match
        const woPetugasClean = cleanStr(wo.petugasName);
        if (woPetugasClean) {
          for (const uCand of userReguCandidates) {
            if (
              woPetugasClean === uCand ||
              (woPetugasClean.length >= 3 && uCand.length >= 3 && (woPetugasClean.includes(uCand) || uCand.includes(woPetugasClean)))
            ) {
              return true;
            }
          }
        }

        // ULP Match as fallback if user has ULP
        if (user.ulpId && wo.ulpId && user.ulpId === wo.ulpId) return true;
        if (user.ulpName && wo.ulpName) {
          const u1 = cleanStr(user.ulpName);
          const u2 = cleanStr(wo.ulpName);
          if (u1 && u2 && (u1.includes(u2) || u2.includes(u1))) return true;
        }

        return false;
      });
    }
    return correctedWorkOrders;
  }, [correctedWorkOrders, user]);

  const addWorkOrder = React.useCallback(async (woData: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const cleanStr = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    // Prevent creation of duplicate Work Orders (Same Nomor WO AND Same Penyulang)
    const isDuplicate = correctedWorkOrders.some(wo => {
      const woNoWO = cleanStr(wo.nomorWO);
      const dataNoWO = cleanStr(woData.nomorWO);
      const woPenyulang = cleanStr(wo.penyulangName);
      const dataPenyulang = cleanStr(woData.penyulangName);

      const hasValidNoWO = woNoWO.length > 2 && dataNoWO.length > 2;
      const hasValidPenyulang = woPenyulang.length > 2 && dataPenyulang.length > 2;

      // Match same Nomor WO AND same Penyulang (Only if both have valid, non-empty values)
      const matchNoWOAndPenyulang = hasValidNoWO && 
                                    hasValidPenyulang && 
                                    woNoWO === dataNoWO && 
                                    woPenyulang === dataPenyulang;

      return matchNoWOAndPenyulang;
    });

    if (isDuplicate) {
      showToast(`Work Order "${woData.nomorWO || ''}" pada penyulang "${woData.penyulangName || ''}" ganda! Pembuatan dibatalkan.`, 'error');
      throw new Error(`Work Order ${woData.nomorWO} ganda pada penyulang ${woData.penyulangName}.`);
    }

    const nowStr = getLocalDateTimeString();
    const newWo: WorkOrder = {
      ...woData,
      id: 'WO-' + Date.now(),
      createdAt: nowStr,
      updatedAt: nowStr,
    };
    
    // Optimistic local update & cache update
    setWorkOrders(prev => {
      const next = [newWo, ...prev];
      try {
        const unitId = SupabaseService.getActiveUnitId();
        localStorage.setItem(`aphro_workorders_${unitId}`, JSON.stringify(next));
        localStorage.setItem('aphro_work_orders', JSON.stringify(next));
      } catch (e) {
        console.warn('Cache error:', e);
      }
      return next;
    });

    const unitId = SupabaseService.getActiveUnitId();
    try {
      const res = await syncManager.executeMutation({
        type: 'CREATE',
        tableName: 'WORK_ORDER',
        payload: newWo,
        apiCall: async () => {
          const result = await SupabaseService.saveWorkOrder(unitId, newWo);
          return { status: result.success ? 'success' : 'error', message: result.error };
        }
      });

      if (!res.offline) {
        showToast(`Work Order ${newWo.nomorWO} berhasil tersimpan ke Database!`, 'success');
      } else {
        showToast(`Work Order tersimpan (offline).`, 'info');
      }
    } catch (err) {
      console.warn('Save WO error:', err);
      showToast(`Tersimpan di antrean offline.`, 'info');
    }

    return newWo;
  }, [correctedWorkOrders, showToast]);

  const updateWorkOrder = React.useCallback(async (id: string, updates: Partial<WorkOrder>) => {
    const nowStr = getLocalDateTimeString();
    const existingWo = workOrders.find(wo => wo.id === id);
    if (!existingWo) return;

    const updatedWo = { ...existingWo, ...updates, updatedAt: nowStr };
    
    // Update local state first (Optimistic)
    setWorkOrders(prev => prev.map(wo => wo.id === id ? updatedWo : wo));

    const unitId = SupabaseService.getActiveUnitId();
    try {
      const res = await syncManager.executeMutation({
        type: 'UPDATE',
        tableName: 'WORK_ORDER',
        payload: updatedWo,
        apiCall: async () => {
          const result = await SupabaseService.updateWorkOrder(unitId, id, updatedWo);
          return { status: result.success ? 'success' : 'error', message: result.error };
        }
      });

      if (!res.offline) {
        showToast('Work Order berhasil diperbarui', 'success');
      } else {
        showToast('Tersimpan di antrean offline.', 'info');
      }
    } catch (err) {
      console.warn('Update WO error:', err);
      showToast('Koneksi terputus, tersimpan di antrean offline.', 'info');
    }
  }, [workOrders, showToast]);

  const deleteWorkOrder = React.useCallback(async (id: string, nomorWO?: string) => {
    const cleanId = (id || '').trim();
    const cleanNomor = (nomorWO || '').trim();

    // Optimistic Delete
    setWorkOrders(prev => prev.filter(wo => {
      const woId = (wo.id || '').trim();
      const woNomor = (wo.nomorWO || '').trim();
      if (cleanId && (woId === cleanId || woNomor === cleanId)) return false;
      if (cleanNomor && (woNomor === cleanNomor || woId === cleanNomor)) return false;
      return true;
    }));

    const unitId = SupabaseService.getActiveUnitId();
    try {
      const res = await syncManager.executeMutation({
        type: 'DELETE',
        tableName: 'WORK_ORDER',
        payload: { id: cleanId, nomorWO: cleanNomor },
        apiCall: async () => {
          const result = await SupabaseService.deleteWorkOrder(unitId, cleanId, cleanNomor);
          return { status: result.success ? 'success' : 'error', message: result.error };
        }
      });

      if (!res.offline) {
        showToast('Work Order berhasil dihapus', 'success');
      } else {
        showToast('Hapus tersimpan (offline).', 'info');
      }
    } catch (err) {
      console.warn('Delete WO error:', err);
      showToast('Koneksi terputus, tersimpan di antrean offline.', 'info');
    }
  }, [showToast]);

  return (
    <WorkOrderContext.Provider value={{
      workOrders: correctedWorkOrders,
      displayedWorkOrders,
      selectedWoIdForRealisasi,
      isLoading,
      setSelectedWoIdForRealisasi,
      setWorkOrders,
      addWorkOrder,
      updateWorkOrder,
      deleteWorkOrder,
      refreshWorkOrders: (page?: number) => refreshWorkOrders(page)
    }}>
      {children}
    </WorkOrderContext.Provider>
  );
}

export function useWorkOrders() {
  const context = React.useContext(WorkOrderContext);
  if (context === undefined) {
    throw new Error('useWorkOrders must be used within a WorkOrderProvider');
  }
  return context;
}
