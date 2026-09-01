import * as React from 'react';
import { WorkOrder } from '../types';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { GASApiService } from '../services/gasApiService';
import { addToOfflineQueue } from '../services/offlineSyncQueue';
import { getLocalDateTimeString } from '../utils/dateUtils';

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  displayedWorkOrders: WorkOrder[];
  selectedWoIdForRealisasi: string | null;
  setSelectedWoIdForRealisasi: (id: string | null) => void;
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  addWorkOrder: (wo: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<WorkOrder>;
  updateWorkOrder: (id: string, wo: Partial<WorkOrder>) => Promise<void>;
  deleteWorkOrder: (id: string) => Promise<void>;
}

const WorkOrderContext = React.createContext<WorkOrderContextType | undefined>(undefined);

export function WorkOrderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  
  // Work Orders are initialized as empty and only populated from Spreadsheet sync
  const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
  const [selectedWoIdForRealisasi, setSelectedWoIdForRealisasi] = React.useState<string | null>(null);

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

      return workOrders.filter((wo) => {
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
    return workOrders;
  }, [workOrders, user]);

  const addWorkOrder = React.useCallback(async (woData: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const nowStr = getLocalDateTimeString();
    const newWo: WorkOrder = {
      ...woData,
      id: 'WO-' + Date.now(),
      createdAt: nowStr,
      updatedAt: nowStr,
    };
    
    // Optimistic local update with 'pending' status if needed
    // (In this app, we just add it to the state and try to sync)
    setWorkOrders(prev => [newWo, ...prev]);

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('WORK_ORDER_CREATE', newWo);
      showToast(`⚡ Work Order ${newWo.nomorWO} tersimpan lokal (Offline).`, 'info');
    } else {
      try {
        // Ensure we are using the latest settings URL and Spreadsheet ID
        const res = await GASApiService.createWorkOrder(settings.gasWebAppUrl, settings.spreadsheetId, newWo);
        
        if (res && res.status === 'success') {
          showToast(`Work Order ${newWo.nomorWO} tersimpan ke Spreadsheet!`, 'success');
        } else {
          console.error('GAS Save failed:', res?.message);
          addToOfflineQueue('WORK_ORDER_CREATE', newWo);
          showToast(`⚡ Work Order tersimpan lokal. Gagal sync ke Spreadsheet: ${res?.message || 'Unknown Error'}`, 'warning');
        }
      } catch (err) {
        console.error('Save WO error:', err);
        addToOfflineQueue('WORK_ORDER_CREATE', newWo);
        showToast(`⚡ Gagal terhubung ke Spreadsheet. Data disimpan lokal di perangkat.`, 'info');
      }
    }

    return newWo;
  }, [setWorkOrders, settings.gasWebAppUrl, showToast]);

  const updateWorkOrder = React.useCallback(async (id: string, updates: Partial<WorkOrder>) => {
    const nowStr = getLocalDateTimeString();
    const existingWo = workOrders.find(wo => wo.id === id);
    if (!existingWo) return;

    const updatedWo = { ...existingWo, ...updates, updatedAt: nowStr };
    
    // Update local state first (Optimistic)
    setWorkOrders(prev => prev.map(wo => wo.id === id ? updatedWo : wo));

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('WORK_ORDER_UPDATE', { id, workOrder: updatedWo });
      showToast('Work Order diperbarui secara lokal (Offline)', 'info');
    } else {
        try {
          const res = await GASApiService.updateWorkOrder(settings.gasWebAppUrl, settings.spreadsheetId, id, updatedWo);
          if (res.status === 'success') {
            showToast('Work Order berhasil diperbarui di Spreadsheet', 'success');
          } else {
            addToOfflineQueue('WORK_ORDER_UPDATE', { id, workOrder: updatedWo });
            showToast('Gagal sinkron, disimpan di antrean offline', 'warning');
          }
        } catch (err) {
          console.error('Update WO error:', err);
          addToOfflineQueue('WORK_ORDER_UPDATE', { id, workOrder: updatedWo });
          showToast('Koneksi bermasalah, disimpan di antrean offline', 'info');
        }
      }
  }, [setWorkOrders, settings.gasWebAppUrl, settings.spreadsheetId, showToast, workOrders]);

  const deleteWorkOrder = React.useCallback(async (id: string) => {
    // Save WO for potential undo or offline queue
    const woToDelete = workOrders.find(wo => wo.id === id);
    
    // Update local state (Optimistic)
    setWorkOrders(prev => prev.filter(wo => wo.id !== id));

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('WORK_ORDER_DELETE', { id });
      showToast('Work Order dihapus secara lokal (Offline)', 'info');
    } else {
      try {
        const res = await GASApiService.deleteWorkOrder(settings.gasWebAppUrl, id);
        if (res.status === 'success') {
          showToast('Work Order berhasil dihapus dari Spreadsheet', 'success');
        } else {
          addToOfflineQueue('WORK_ORDER_DELETE', { id });
          showToast('Gagal hapus di Spreadsheet, disimpan di antrean offline', 'warning');
        }
      } catch (err) {
        console.error('Delete WO error:', err);
        addToOfflineQueue('WORK_ORDER_DELETE', { id });
        showToast('Koneksi bermasalah, antrean hapus disimpan', 'info');
      }
    }
  }, [setWorkOrders, settings.gasWebAppUrl, workOrders, showToast]);

  return (
    <WorkOrderContext.Provider value={{
      workOrders,
      displayedWorkOrders,
      selectedWoIdForRealisasi,
      setSelectedWoIdForRealisasi,
      setWorkOrders,
      addWorkOrder,
      updateWorkOrder,
      deleteWorkOrder
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
