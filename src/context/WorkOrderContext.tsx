import React, { createContext, useContext, ReactNode, useState, useMemo, useCallback } from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { WorkOrder } from '../types';
import { INITIAL_WORK_ORDERS } from '../data/initialData';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { GASApiService } from '../services/gasApiService';
import { addToOfflineQueue } from '../services/offlineSyncQueue';

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  displayedWorkOrders: WorkOrder[];
  selectedWoIdForRealisasi: string | null;
  setSelectedWoIdForRealisasi: (id: string | null) => void;
  setWorkOrders: (orders: WorkOrder[]) => void;
  addWorkOrder: (wo: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => WorkOrder;
  updateWorkOrder: (id: string, wo: Partial<WorkOrder>) => void;
  deleteWorkOrder: (id: string) => void;
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [workOrders, setWorkOrders] = usePersistState<WorkOrder[]>('aphro_wo', INITIAL_WORK_ORDERS);
  const [selectedWoIdForRealisasi, setSelectedWoIdForRealisasi] = useState<string | null>(null);

  const displayedWorkOrders = useMemo(() => {
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

  const addWorkOrder = useCallback((woData: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newWo: WorkOrder = {
      ...woData,
      id: 'WO-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkOrders(prev => [newWo, ...prev]);

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('WORK_ORDER_CREATE', newWo);
      showToast(`⚡ Work Order ${newWo.nomorWO} tersimpan lokal (Offline).`, 'info');
    } else {
      GASApiService.createWorkOrder(settings.gasWebAppUrl, newWo)
        .then(res => {
          if (res.status === 'success') {
            showToast(`Work Order ${newWo.nomorWO} tersimpan ke Spreadsheet!`, 'success');
          } else {
            addToOfflineQueue('WORK_ORDER_CREATE', newWo);
            showToast(`⚡ Work Order tersimpan lokal. Gagal sync ke Spreadsheet.`, 'warning');
          }
        })
        .catch(err => {
          console.error('Save WO error:', err);
          addToOfflineQueue('WORK_ORDER_CREATE', newWo);
          showToast(`⚡ Work Order tersimpan lokal di perangkat.`, 'info');
        });
    }

    return newWo;
  }, [setWorkOrders, settings.gasWebAppUrl, showToast]);

  const updateWorkOrder = useCallback((id: string, updates: Partial<WorkOrder>) => {
    let updatedWo: WorkOrder | undefined;
    setWorkOrders(prev => prev.map(wo => {
      if (wo.id === id) {
        updatedWo = { ...wo, ...updates, updatedAt: new Date().toISOString() };
        return updatedWo;
      }
      return wo;
    }));

    if (updatedWo) {
      if (!navigator.onLine || !settings.gasWebAppUrl) {
        addToOfflineQueue('WORK_ORDER_UPDATE', { id, workOrder: updatedWo });
      } else {
        GASApiService.updateWorkOrder(settings.gasWebAppUrl, id, updatedWo)
          .catch(err => {
            console.error('Update WO error:', err);
            if (updatedWo) addToOfflineQueue('WORK_ORDER_UPDATE', { id, workOrder: updatedWo });
          });
      }
    }
  }, [setWorkOrders, settings.gasWebAppUrl]);

  const deleteWorkOrder = useCallback((id: string) => {
    setWorkOrders(prev => prev.filter(wo => wo.id !== id));

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('WORK_ORDER_DELETE', { id });
    } else {
      GASApiService.deleteWorkOrder(settings.gasWebAppUrl, id)
        .catch(err => {
          console.error('Delete WO error:', err);
          addToOfflineQueue('WORK_ORDER_DELETE', { id });
        });
    }
  }, [setWorkOrders, settings.gasWebAppUrl]);

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
  const context = useContext(WorkOrderContext);
  if (context === undefined) {
    throw new Error('useWorkOrders must be used within a WorkOrderProvider');
  }
  return context;
}
