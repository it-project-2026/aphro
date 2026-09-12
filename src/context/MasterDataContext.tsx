import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { ULP, Penyulang, ReguROW, Petugas, User } from '../types';
import { 
  INITIAL_ULP, 
  INITIAL_PENYULANG, 
  INITIAL_REGU, 
  INITIAL_PETUGAS,
  INITIAL_USERS
} from '../data/initialData';
import { useSettings } from './SettingsContext';
import { SupabaseService } from '../services/supabaseService';

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

  refreshMasterData: (forceRefresh?: boolean) => Promise<void>;

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
  const [ulpList, setUlpList] = usePersistState<ULP[]>('aphro_ulp', INITIAL_ULP);
  const [penyulangList, setPenyulangList] = usePersistState<Penyulang[]>('aphro_penyulang', INITIAL_PENYULANG);
  const [reguList, setReguList] = usePersistState<ReguROW[]>('aphro_regu', INITIAL_REGU);
  const [petugasList, setPetugasList] = usePersistState<Petugas[]>('aphro_ptg', INITIAL_PETUGAS);
  const [users, setUsers] = usePersistState<User[]>('aphro_synced_users', INITIAL_USERS);

  const refreshMasterData = React.useCallback(async (forceRefresh = false) => {
    // Check if we need to refresh based on timestamp (1 hour cache)
    const lastSync = localStorage.getItem('aphro_master_data_sync_time');
    if (!forceRefresh && lastSync && (Date.now() - parseInt(lastSync, 10) < 3600000)) {
      return; // Data is still fresh
    }

    try {
      const unitId = SupabaseService.getActiveUnitId();
      const res = await SupabaseService.fetchMasterData(unitId);
      if (res) {
        if (res.ulp?.length > 0) setUlpList(res.ulp);
        if (res.penyulang?.length > 0) setPenyulangList(res.penyulang);
        if (res.regu?.length > 0) setReguList(res.regu);
        if (res.petugas?.length > 0) setPetugasList(res.petugas);
        if (res.users?.length > 0) setUsers(res.users);

        // Update sync timestamp
        localStorage.setItem('aphro_master_data_sync_time', Date.now().toString());
      }
    } catch (err) {
      console.warn('Error loading Master Data from Supabase:', err);
    }
  }, [setUlpList, setPenyulangList, setReguList, setPetugasList, setUsers]);

  React.useEffect(() => {
    refreshMasterData();
  }, [refreshMasterData, settings.namaUnitLayanan]);

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
    if (data.users) setUsers(data.users);
  }, [setUlpList, setPenyulangList, setReguList, setPetugasList, setUsers]);

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
      SupabaseService.saveRegu(newItem).catch(() => {});
    }
  }, [setReguList]);

  const updateRegu = React.useCallback((id: string, data: Partial<ReguROW>) => {
    setReguList(prev => prev.map(item => {
      if (item.id === id || item.kodeRegu === id || item.namaRegu === id) {
        const updated = { ...item, ...data };
        if (navigator.onLine) {
          SupabaseService.saveRegu(updated).catch(() => {});
        }
        return updated;
      }
      return item;
    }));
  }, [setReguList]);

  const deleteRegu = React.useCallback((id: string) => {
    setReguList(prev => prev.filter(item => item.id !== id && item.kodeRegu !== id && item.namaRegu !== id));
    if (navigator.onLine) {
      SupabaseService.deleteRegu(id).catch(() => {});
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
      SupabaseService.saveUser(newItem).catch((err) => {
        console.warn('Failed to save user to Supabase:', err);
      });
    }
  }, [setUsers]);

  const updateUser = React.useCallback((id: string, data: Partial<User>) => {
    setUsers(prev => {
      const updatedList = prev.map(item => {
        if (item.id === id || item.userName === id || item.nip === id) {
          const updatedItem = { ...item, ...data };
          if (navigator.onLine) {
            SupabaseService.saveUser(updatedItem).catch(() => {});
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
      SupabaseService.deleteUser(id).catch(() => {});
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
