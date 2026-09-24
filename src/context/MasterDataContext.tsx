import * as React from 'react';
import { ULP, Penyulang, ReguROW, Petugas, User } from '../types';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { ApiService } from '../services/apiService';
import { InisiasiService } from '../services/inisiasiService';

interface MasterDataContextType {
  ulpList: ULP[];
  penyulangList: Penyulang[];
  reguList: ReguROW[];
  petugasList: Petugas[];
  users: User[];
  
  setMasterData: (data: {
    ulp?: ULP[];
    penyulang?: Penyulang[];
    regu?: ReguROW[];
    petugas?: Petugas[];
    users?: User[];
  }) => void;

  refreshMasterData: (forceRefresh?: boolean, filters?: { ulp?: string; regu?: string }) => Promise<void>;

  addULP: (ulp: Omit<ULP, 'id'>) => void;
  updateULP: (id: string, ulp: Partial<ULP>) => void;
  deleteULP: (id: string) => void;
  
  addPenyulang: (p: Omit<Penyulang, 'id'>) => void;
  updatePenyulang: (id: string, p: Partial<Penyulang>) => void;
  deletePenyulang: (id: string) => void;
  
  addRegu: (r: Omit<ReguROW, 'id'>) => void;
  updateRegu: (id: string, r: Partial<ReguROW>) => void;
  deleteRegu: (id: string) => void;
  
  addPetugas: (ptg: Omit<Petugas, 'id'>) => void;
  updatePetugas: (id: string, ptg: Partial<Petugas>) => void;
  deletePetugas: (id: string) => void;

  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
}

const MasterDataContext = React.createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { user, isAuthenticated } = useAuth();
  const activeUnitId = user?.unitId || InisiasiService.getSelectedUnitId();

  const [ulpList, setUlpList] = React.useState<ULP[]>([]);
  const [penyulangList, setPenyulangList] = React.useState<Penyulang[]>([]);
  const [reguList, setReguList] = React.useState<ReguROW[]>([]);
  const [petugasList, setPetugasList] = React.useState<Petugas[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);

  const activeRequestIdRef = React.useRef<string>('');

  const authUserId = user?.id || '';
  const authUserUnit = user?.unitId || '';

  const refreshMasterData = React.useCallback(async (forceRefresh = false, filters: { ulp?: string; regu?: string } = {}) => {
    // GUARD #1: Do not execute fetchMasterData if user is not authenticated or token is missing!
    if (!isAuthenticated || !authUserId) {
      console.log('[MasterDataContext] Skipping refreshMasterData: User not authenticated.');
      return;
    }

    const token = ApiService.getAuthToken();
    if (!token) {
      console.log('[MasterDataContext] Skipping refreshMasterData: JWT Token missing.');
      return;
    }

    const unitId = authUserUnit ? InisiasiService.getStandardUnitId(authUserUnit) : InisiasiService.getSelectedUnitId();
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    activeRequestIdRef.current = requestId;

    console.log(`[MASTER DATA TRACE]\naction=REFRESH_START\nunitId=${unitId}`);

    try {
      console.log(`[AUTH TRACE] authenticated=true tokenPresent=true unitId=${unitId}`);
      console.log(`[MASTER DATA REQUEST]\nrequestId=${requestId}\nunitId=${unitId}\nsource=HYPERCLOUD`);

      const res = await ApiService.fetchMasterData(unitId, filters);

      // Check if this request is still the active one (prevent race condition / stale overwrites)
      if (activeRequestIdRef.current !== requestId) {
        console.warn(`[MASTER DATA TRACE]\naction=STALE_RESPONSE_IGNORED\nunitId=${unitId}`);
        console.warn(`[MASTER DATA STALE RESPONSE IGNORED]\nrequestId=${requestId}`);
        return;
      }

      if (res.isAuthError || res.status === 401 || res.status === 403) {
        console.warn(`[MASTER DATA TRACE]\naction=REFRESH_FAILED\nsource=HYPERCLOUD\nunitId=${unitId}\nstatus=${res.status || 401}`);
        console.warn(`[DB SOURCE] entity=MASTER_DATA source=AUTH_ERROR unitId=${unitId}`);
        return;
      }

      if (res && res.status !== 500 && res.status !== 502 && res.status !== 503 && res.status !== 404) {
        const hasValidUsers = Array.isArray(res.users);
        const usersArray = hasValidUsers ? res.users : [];
        const totalCounts = (res.ulp?.length || 0) + (res.penyulang?.length || 0) + (res.regu?.length || 0) + (res.petugas?.length || 0) + usersArray.length;
        
        console.log(`[MASTER DATA TRACE]\naction=REFRESH_SUCCESS\nsource=HYPERCLOUD\nunitId=${unitId}\nusersCount=${usersArray.length}`);
        console.log(`[MASTER DATA RESPONSE]\nrequestId=${requestId}\ncount=${totalCounts}`);

        if (Array.isArray(res.ulp)) setUlpList(res.ulp);
        if (Array.isArray(res.penyulang)) setPenyulangList(res.penyulang);
        if (Array.isArray(res.regu)) setReguList(res.regu);
        if (Array.isArray(res.petugas)) setPetugasList(res.petugas);
        
        // Only update users if valid array is returned, preserving existing valid users if response is malformed
        if (hasValidUsers) {
          setUsers(usersArray);
          console.log(`[USERS STATE]\nsource=HYPERCLOUD\ncount=${usersArray.length}`);
        } else {
          console.log(`[MASTER DATA TRACE]\naction=REFRESH_INVALID_RESPONSE\nsource=HYPERCLOUD\nunitId=${unitId}`);
        }

        console.log(`[MASTER DATA STATE APPLY]\nrequestId=${requestId}`);
        const sourceLabel = totalCounts > 0 ? 'HYPERCLOUD_SUCCESS' : 'HYPERCLOUD_EMPTY';

        console.log(`[DB SOURCE] entity=MASTER_DATA source=${sourceLabel} unitId=${unitId} counts: ULP=${res.ulp?.length || 0}, Penyulang=${res.penyulang?.length || 0}, Regu=${res.regu?.length || 0}, Petugas=${res.petugas?.length || 0}, Users=${usersArray.length}`);
      } else {
        console.warn(`[MASTER DATA TRACE]\naction=REFRESH_FAILED\nsource=HYPERCLOUD\nunitId=${unitId}\nstatus=${res?.status || 500}`);
      }
    } catch (err: any) {
      console.warn(`[MASTER DATA TRACE]\naction=REFRESH_FAILED\nsource=HYPERCLOUD\nunitId=${unitId}\nstatus=500`);
      console.warn('Error loading Master Data from HyperCloud:', err);
    }
  }, [isAuthenticated, authUserId, authUserUnit]);

  React.useEffect(() => {
    if (isAuthenticated && authUserId && authUserUnit) {
      refreshMasterData(true);
    } else {
      setUlpList([]);
      setPenyulangList([]);
      setReguList([]);
      setPetugasList([]);
      setUsers([]);
    }
  }, [refreshMasterData, isAuthenticated, authUserId, authUserUnit, settings.namaUnitLayanan, activeUnitId]);

  const setMasterData = React.useCallback((data: {
    ulp?: ULP[];
    penyulang?: Penyulang[];
    regu?: ReguROW[];
    petugas?: Petugas[];
    users?: User[];
  }) => {
    if (data.ulp) setUlpList(data.ulp);
    if (data.penyulang) setPenyulangList(data.penyulang);
    if (data.regu) setReguList(data.regu);
    if (data.petugas) setPetugasList(data.petugas);
    if (Array.isArray(data.users)) setUsers(data.users);
  }, []);

  const addULP = React.useCallback((data: Omit<ULP, 'id'>) => {
    const newId = 'ULP-' + Date.now();
    const newItem = { ...data, id: newId };
    setUlpList(prev => [...prev, newItem]);
  }, [setUlpList]);

  const updateULP = React.useCallback((id: string, data: Partial<ULP>) => {
    setUlpList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setUlpList]);

  const deleteULP = React.useCallback((id: string) => {
    setUlpList(prev => prev.filter(item => item.id !== id));
  }, [setUlpList]);

  const addPenyulang = React.useCallback((data: Omit<Penyulang, 'id'>) => {
    const newId = 'PYL-' + Date.now();
    const newItem = { ...data, id: newId };
    setPenyulangList(prev => [...prev, newItem]);
  }, [setPenyulangList]);

  const updatePenyulang = React.useCallback((id: string, data: Partial<Penyulang>) => {
    setPenyulangList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setPenyulangList]);

  const deletePenyulang = React.useCallback((id: string) => {
    setPenyulangList(prev => prev.filter(item => item.id !== id));
  }, [setPenyulangList]);

  const addRegu = React.useCallback((data: Omit<ReguROW, 'id'>) => {
    const newId = 'RGU-' + Date.now();
    const newItem = { ...data, id: newId };
    setReguList(prev => [...prev, newItem]);

    if (navigator.onLine) {
      ApiService.saveRegu(newItem).catch(() => {});
    }
  }, [setReguList]);

  const updateRegu = React.useCallback((id: string, data: Partial<ReguROW>) => {
    setReguList(prev => prev.map(item => {
      if (item.id === id || item.kodeRegu === id || item.namaRegu === id) {
        const updated = { ...item, ...data };
        if (navigator.onLine) {
          ApiService.saveRegu(updated).catch(() => {});
        }
        return updated;
      }
      return item;
    }));
  }, [setReguList]);

  const deleteRegu = React.useCallback((id: string) => {
    setReguList(prev => prev.filter(item => item.id !== id && item.kodeRegu !== id && item.namaRegu !== id));
    if (navigator.onLine) {
      ApiService.deleteRegu(id).catch(() => {});
    }
  }, [setReguList]);

  const addPetugas = React.useCallback((data: Omit<Petugas, 'id'>) => {
    const newId = 'PTG-' + Date.now();
    const newItem = { ...data, id: newId };
    setPetugasList(prev => [...prev, newItem]);
  }, [setPetugasList]);

  const updatePetugas = React.useCallback((id: string, data: Partial<Petugas>) => {
    setPetugasList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setPetugasList]);

  const deletePetugas = React.useCallback((id: string) => {
    setPetugasList(prev => prev.filter(item => item.id !== id));
  }, [setPetugasList]);

  const addUser = React.useCallback((data: Omit<User, 'id'>) => {
    const newId = data.userName || data.nip || ('usr-' + Date.now());
    const newItem: User = { ...data, id: newId };
    setUsers(prev => [...prev, newItem]);

    if (navigator.onLine) {
      ApiService.saveUser(newItem).catch((err) => {
        console.warn('Failed to save user to HyperCloud:', err);
      });
    }
  }, [setUsers]);

  const updateUser = React.useCallback((id: string, data: Partial<User>) => {
    setUsers(prev => {
      const updatedList = prev.map(item => {
        if (item.id === id || item.userName === id || item.nip === id) {
          const updatedItem = { ...item, ...data };
          if (navigator.onLine) {
            ApiService.saveUser(updatedItem).catch(() => {});
          }
          return updatedItem;
        }
        return item;
      });
      return updatedList;
    });
  }, [setUsers]);

  const deleteUser = React.useCallback((id: string) => {
    setUsers(prev => prev.filter(item => item.id !== id && item.userName !== id && item.nip !== id));
    if (navigator.onLine) {
      ApiService.deleteUser(id).catch(() => {});
    }
  }, [setUsers]);

  return (
    <MasterDataContext.Provider value={{
      ulpList, penyulangList, reguList, petugasList, users,
      setMasterData,
      refreshMasterData,
      addULP, updateULP, deleteULP,
      addPenyulang, updatePenyulang, deletePenyulang,
      addRegu, updateRegu, deleteRegu,
      addPetugas, updatePetugas, deletePetugas,
      addUser, updateUser, deleteUser
    }}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const context = React.useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
}
