import * as React from 'react';
import { WorkOrder } from '../types';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { SupabaseService } from '../services/supabaseService';
import { dexieDb } from '../services/dexieDb';
import { INITIAL_WORK_ORDERS } from '../data/initialData';
import { syncManager } from '../services/syncManager';
import { getLocalDateTimeString, parseDateFromNomorWO } from '../utils/dateUtils';
import { UL_PRESETS, RekapHarianService, resolveUserTimRowAndUlp } from '../services/rekapHarianService';

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

  // Auto-fetch Work Orders from Dexie DB & Supabase
  const refreshWorkOrders = React.useCallback(async (page: number = 0) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // 1. INSTANT LOCAL-FIRST: Load local offline Work Orders from Dexie DB (< 50-100ms)
      const cachedLocals = await dexieDb.work_orders.toArray();
      if (cachedLocals.length > 0 && page === 0) {
        setWorkOrders(cachedLocals);
        setIsLoading(false); // Instantly unblock UI
      } else if (page === 0) {
        setIsLoading(true);
      }

      // 2. BACKGROUND DELTA SYNC: Fetch remote Work Orders from Supabase if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const unitId = SupabaseService.getActiveUnitId();
        const res = await SupabaseService.fetchWorkOrders(unitId, page, 200, page === 0 ? undefined : lastSyncRef.current);

        if (res.success && res.data) {
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

          if (corrected.length > 0) {
            // Save into Dexie DB
            await dexieDb.work_orders.bulkPut(
              corrected.map((wo) => ({
                ...wo,
                syncStatus: 'SYNCED',
                updatedAt: wo.updatedAt || getLocalDateTimeString(),
              }))
            );

            setWorkOrders((prev) => (page === 0 ? corrected : [...prev, ...corrected]));
          } else if (page === 0 && cachedLocals.length === 0) {
            // Only set INITIAL_WORK_ORDERS if BOTH remote and local Dexie are empty
            setWorkOrders(INITIAL_WORK_ORDERS);
          }

          if (page === 0) {
            lastSyncRef.current = getLocalDateTimeString();
          }
        }
      }
    } catch (err) {
      console.warn('Error loading Work Orders from Dexie/Supabase:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    lastSyncRef.current = undefined;
    refreshWorkOrders(0);
  }, [refreshWorkOrders, settings.namaUnitLayanan, user]);

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
    const activeUnitName = settings.namaUnitLayanan || localStorage.getItem('aphro_nama_unit_layanan') || 'UL BUKITTINGGI';
    const activeUnitKey = RekapHarianService.normalizeUnitKey(activeUnitName);
    const activeUnitId = SupabaseService.getActiveUnitId();

    const cleanStr = (s?: string | null) => {
      if (!s) return '';
      return String(s)
        .toLowerCase()
        .replace(/^(regu|tim|petugas)\s+/gi, '')
        .replace(/[^a-z0-9]/gi, '');
    };

    // Helper: Verify if Work Order matches active Inisiasi / Unit Layanan
    const matchesActiveInisiasi = (wo: WorkOrder): boolean => {
      if (!wo) return false;

      // 1. Check unitId if specified
      if (wo.unitId) {
        const uId = String(wo.unitId).trim().toUpperCase();
        if (uId === 'UL1' || uId.includes('PADANG') || uId.includes('PDG')) {
          if (activeUnitKey !== 'PADANG' && activeUnitId !== 'UL1') return false;
        } else if (uId === 'UL2' || uId.includes('BUKITTINGGI') || uId.includes('BKT')) {
          if (activeUnitKey !== 'BUKITTINGGI' && activeUnitId !== 'UL2') return false;
        } else if (uId === 'UL3' || uId === 'UL4' || uId.includes('PAYAKUMBUH') || uId.includes('PYK')) {
          if (activeUnitKey !== 'PAYAKUMBUH' && activeUnitId !== 'UL3' && activeUnitId !== 'UL4') return false;
        }
      }

      // 2. Check namaUnitLayanan or unitName
      const woUnit = (wo as any).namaUnitLayanan || (wo as any).unitName || (wo as any).unit_name;
      if (woUnit) {
        const woKey = RekapHarianService.normalizeUnitKey(woUnit);
        if (woKey !== activeUnitKey) return false;
      }

      // 3. Check ULP name against UL_PRESETS
      if (wo.ulpName) {
        const woUlpClean = cleanStr(wo.ulpName);
        const activePreset = UL_PRESETS[activeUnitKey];
        if (activePreset && activePreset.rows) {
          const isInActivePreset = activePreset.rows.some(r => {
            const pUlp = cleanStr(r.namaUlp);
            return woUlpClean.includes(pUlp) || pUlp.includes(woUlpClean);
          });

          // Check if ULP belongs to another preset
          let belongsToOtherPreset = false;
          for (const [presetKey, presetData] of Object.entries(UL_PRESETS)) {
            if (presetKey !== activeUnitKey) {
              const inOther = presetData.rows.some(r => {
                const pUlp = cleanStr(r.namaUlp);
                return woUlpClean.includes(pUlp) || pUlp.includes(woUlpClean);
              });
              if (inOther && !isInActivePreset) {
                belongsToOtherPreset = true;
                break;
              }
            }
          }

          if (belongsToOtherPreset) return false;
        }
      }

      return true;
    };

    // 1. First filter Work Orders by active Inisiasi
    const inisiasiWorkOrders = correctedWorkOrders.filter(matchesActiveInisiasi);

    if (!user) return inisiasiWorkOrders;

    // 2. Check Admin / Management permissions
    const isAdmbktUser = (user.userName || user.name || '').toLowerCase() === 'admbkt';
    const roleLower = (user.role || '').toLowerCase();
    const isAdminOrManagement =
      isAdmbktUser ||
      roleLower.includes('admin') ||
      roleLower.includes('super') ||
      roleLower.includes('adm') ||
      roleLower.includes('manager') ||
      roleLower.includes('spv') ||
      roleLower.includes('supervisor');

    // Admin / Management roles can see all Work Orders in the active Inisiasi
    if (isAdminOrManagement) {
      return inisiasiWorkOrders;
    }

    // Regular officers / users ONLY see Work Orders assigned to them or their team
    const userTimInfo = resolveUserTimRowAndUlp(user, activeUnitName);
    const userCandidates = [
      cleanStr(userTimInfo.reguName),
      cleanStr(user.reguName),
      cleanStr(user.userName),
      cleanStr(user.name),
      cleanStr(user.nip),
      cleanStr(user.id),
    ].filter(Boolean);

    return inisiasiWorkOrders.filter((wo) => {
      // Direct petugasId match (ID, NIP, Username)
      if (
        user.id && wo.petugasId &&
        (String(user.id) === String(wo.petugasId) ||
         String(user.nip) === String(wo.petugasId) ||
         String(user.userName) === String(wo.petugasId))
      ) {
        return true;
      }

      // Direct reguId match
      if (user.reguId && wo.reguId && String(user.reguId) === String(wo.reguId)) {
        return true;
      }

      // Match petugasName against user candidates
      const woPetugasClean = cleanStr(wo.petugasName);
      if (woPetugasClean) {
        for (const uCand of userCandidates) {
          if (
            woPetugasClean === uCand ||
            (woPetugasClean.length >= 3 && uCand.length >= 3 && (woPetugasClean.includes(uCand) || uCand.includes(woPetugasClean)))
          ) {
            return true;
          }
        }
      }

      // Match reguName against user candidates
      const woReguClean = cleanStr(wo.reguName);
      if (woReguClean) {
        for (const uCand of userCandidates) {
          if (
            woReguClean === uCand ||
            (woReguClean.length >= 3 && uCand.length >= 3 && (woReguClean.includes(uCand) || uCand.includes(woReguClean)))
          ) {
            return true;
          }
        }
      }

      return false;
    });
  }, [correctedWorkOrders, user, settings.namaUnitLayanan]);

  const addWorkOrder = React.useCallback(async (woData: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const cleanStr = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    const isDuplicate = correctedWorkOrders.some((wo) => {
      const woNoWO = cleanStr(wo.nomorWO);
      const dataNoWO = cleanStr(woData.nomorWO);
      const woPenyulang = cleanStr(wo.penyulangName);
      const dataPenyulang = cleanStr(woData.penyulangName);

      const hasValidNoWO = woNoWO.length > 2 && dataNoWO.length > 2;
      const hasValidPenyulang = woPenyulang.length > 2 && dataPenyulang.length > 2;

      return hasValidNoWO && hasValidPenyulang && woNoWO === dataNoWO && woPenyulang === dataPenyulang;
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

    // Save to Dexie DB
    await dexieDb.work_orders.put({
      ...newWo,
      syncStatus: 'PENDING',
    });

    setWorkOrders((prev) => [newWo, ...prev]);

    const unitId = SupabaseService.getActiveUnitId();
    try {
      const res = await syncManager.executeMutation({
        type: 'CREATE',
        tableName: 'WORK_ORDER',
        payload: newWo,
        apiCall: async () => {
          const result = await SupabaseService.saveWorkOrder(unitId, newWo);
          return { status: result.success ? 'success' : 'error', message: result.error };
        },
      });

      if (!res.offline) {
        showToast(`Work Order ${newWo.nomorWO} berhasil tersimpan ke Database!`, 'success');
        await dexieDb.work_orders.update(newWo.id, { syncStatus: 'SYNCED' });
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
    const existingWo = workOrders.find((wo) => wo.id === id);
    if (!existingWo) return;

    const updatedWo = { ...existingWo, ...updates, updatedAt: nowStr };

    setWorkOrders((prev) => prev.map((wo) => (wo.id === id ? updatedWo : wo)));

    await dexieDb.work_orders.update(id, {
      ...updates,
      syncStatus: 'PENDING',
      updatedAt: nowStr,
    });

    const unitId = SupabaseService.getActiveUnitId();
    try {
      const res = await syncManager.executeMutation({
        type: 'UPDATE',
        tableName: 'WORK_ORDER',
        payload: updatedWo,
        apiCall: async () => {
          const result = await SupabaseService.updateWorkOrder(unitId, id, updatedWo);
          return { status: result.success ? 'success' : 'error', message: result.error };
        },
      });

      if (!res.offline) {
        showToast('Work Order berhasil diperbarui', 'success');
        await dexieDb.work_orders.update(id, { syncStatus: 'SYNCED' });
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

    setWorkOrders((prev) => prev.filter((wo) => wo.id !== cleanId && wo.nomorWO !== cleanNomor));

    try {
      await dexieDb.work_orders.delete(cleanId);
    } catch (e) {
      console.warn('Delete Dexie WO error:', e);
    }

    const unitId = SupabaseService.getActiveUnitId();
    try {
      await syncManager.executeMutation({
        type: 'DELETE',
        tableName: 'WORK_ORDER',
        payload: { id: cleanId, nomorWO: cleanNomor },
        apiCall: async () => {
          const result = await SupabaseService.deleteWorkOrder(unitId, cleanId, cleanNomor);
          return { status: result.success ? 'success' : 'error', message: result.error };
        },
      });

      showToast('Work Order dihapus', 'info');
    } catch (err) {
      showToast('Hapus tersimpan (offline).', 'info');
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
