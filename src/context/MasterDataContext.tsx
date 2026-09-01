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
import { GASApiService } from '../services/gasApiService';

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
  const [ulpList, setUlpList] = usePersistState<ULP[]>('aphro_ulp', INITIAL_ULP);
  const [penyulangList, setPenyulangList] = usePersistState<Penyulang[]>('aphro_penyulang', INITIAL_PENYULANG);
  const [reguList, setReguList] = usePersistState<ReguROW[]>('aphro_regu', INITIAL_REGU);
  const [petugasList, setPetugasList] = usePersistState<Petugas[]>('aphro_ptg', INITIAL_PETUGAS);
  const [users, setUsers] = usePersistState<User[]>('aphro_synced_users', INITIAL_USERS);

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

  const { settings } = useSettings();

  const syncToGAS = React.useCallback(async (sheetName: any, action: 'save' | 'delete', itemOrId: any) => {
    if (!settings.gasWebAppUrl) return;
    
    try {
      if (action === 'save') {
        // Map common fields for GAS to match spreadsheet columns
        let mappedItem = { ...itemOrId };
        if (sheetName === 'PETUGAS') {
          mappedItem = {
            ...itemOrId,
            PetugasID: itemOrId.nip || itemOrId.id,
            Username: itemOrId.nip || '',
            NamaRegu: itemOrId.reguName || '',
            ULP: itemOrId.ulpName || '',
            NoHP: itemOrId.noHp || ''
          };
        } else if (sheetName === 'REGU_ROW') {
          mappedItem = {
            ...itemOrId,
            KodeRegu: itemOrId.kodeRegu,
            NamaRegu: itemOrId.namaRegu,
            ULP: itemOrId.ulpName
          };
        } else if (sheetName === 'USERS') {
          mappedItem = {
            ...itemOrId,
            UserID: itemOrId.nip || itemOrId.id,
            Username: itemOrId.userName || itemOrId.nip || '',
            Password: itemOrId.password || 'user123',
            NamaRegu: itemOrId.reguName,
            ULP: itemOrId.ulpName,
            nip: itemOrId.nip,
            name: itemOrId.name,
            email: itemOrId.email,
            phone: itemOrId.phone
          };
        }
        await GASApiService.saveMasterData(settings.gasWebAppUrl, settings.spreadsheetId, sheetName, mappedItem);
      } else {
        await GASApiService.deleteMasterData(settings.gasWebAppUrl, settings.spreadsheetId, sheetName, itemOrId);
      }
    } catch {
      // Graceful offline fallback
    }
  }, [settings.gasWebAppUrl, settings.spreadsheetId]);

  const addULP = React.useCallback(async (data: Omit<ULP, 'id'>) => {
    const newId = 'ULP-' + Date.now();
    const newItem = { ...data, id: newId };
    setUlpList(prev => [...prev, newItem]);
    await syncToGAS('ULP', 'save', newItem);
  }, [setUlpList, syncToGAS]);

  const updateULP = React.useCallback(async (id: string, data: Partial<ULP>) => {
    setUlpList(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...data } : item);
      const target = updated.find(i => i.id === id);
      if (target) syncToGAS('ULP', 'save', target);
      return updated;
    });
  }, [setUlpList, syncToGAS]);

  const deleteULP = React.useCallback(async (id: string) => {
    setUlpList(prev => prev.filter(item => item.id !== id));
    await syncToGAS('ULP', 'delete', id);
  }, [setUlpList, syncToGAS]);

  const addPenyulang = React.useCallback(async (data: Omit<Penyulang, 'id'>) => {
    const newId = 'PYL-' + Date.now();
    const newItem = { ...data, id: newId };
    setPenyulangList(prev => [...prev, newItem]);
    await syncToGAS('PENYULANG', 'save', newItem);
  }, [setPenyulangList, syncToGAS]);

  const updatePenyulang = React.useCallback(async (id: string, data: Partial<Penyulang>) => {
    setPenyulangList(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...data } : item);
      const target = updated.find(i => i.id === id);
      if (target) syncToGAS('PENYULANG', 'save', target);
      return updated;
    });
  }, [setPenyulangList, syncToGAS]);

  const deletePenyulang = React.useCallback(async (id: string) => {
    setPenyulangList(prev => prev.filter(item => item.id !== id));
    await syncToGAS('PENYULANG', 'delete', id);
  }, [setPenyulangList, syncToGAS]);

  const addRegu = React.useCallback(async (data: Omit<ReguROW, 'id'>) => {
    const newId = 'RGU-' + Date.now();
    const newItem = { ...data, id: newId };
    setReguList(prev => [...prev, newItem]);
    await syncToGAS('REGU_ROW', 'save', newItem);
  }, [setReguList, syncToGAS]);

  const updateRegu = React.useCallback(async (id: string, data: Partial<ReguROW>) => {
    setReguList(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...data } : item);
      const target = updated.find(i => i.id === id);
      if (target) syncToGAS('REGU_ROW', 'save', target);
      return updated;
    });
  }, [setReguList, syncToGAS]);

  const deleteRegu = React.useCallback(async (id: string) => {
    setReguList(prev => prev.filter(item => item.id !== id));
    await syncToGAS('REGU_ROW', 'delete', id);
  }, [setReguList, syncToGAS]);

  const addPetugas = React.useCallback(async (data: Omit<Petugas, 'id'>) => {
    const newId = 'PTG-' + Date.now();
    const newItem = { ...data, id: newId };
    setPetugasList(prev => [...prev, newItem]);
    await syncToGAS('PETUGAS', 'save', newItem);
  }, [setPetugasList, syncToGAS]);

  const updatePetugas = React.useCallback(async (id: string, data: Partial<Petugas>) => {
    setPetugasList(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...data } : item);
      const target = updated.find(i => i.id === id);
      if (target) syncToGAS('PETUGAS', 'save', target);
      return updated;
    });
  }, [setPetugasList, syncToGAS]);

  const deletePetugas = React.useCallback(async (id: string) => {
    setPetugasList(prev => prev.filter(item => item.id !== id));
    await syncToGAS('PETUGAS', 'delete', id);
  }, [setPetugasList, syncToGAS]);

  const addUser = React.useCallback(async (data: Omit<User, 'id'>) => {
    const newId = 'usr-' + Date.now();
    const newItem = { ...data, id: newId };
    setUsers(prev => [...prev, newItem]);
    await syncToGAS('USERS', 'save', newItem);
  }, [setUsers, syncToGAS]);

  const updateUser = React.useCallback(async (id: string, data: Partial<User>) => {
    setUsers(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...data } : item);
      const target = updated.find(i => i.id === id);
      if (target) syncToGAS('USERS', 'save', target);
      return updated;
    });
  }, [setUsers, syncToGAS]);

  const deleteUser = React.useCallback(async (id: string) => {
    setUsers(prev => prev.filter(item => item.id !== id));
    await syncToGAS('USERS', 'delete', id);
  }, [setUsers, syncToGAS]);

  return (
    <MasterDataContext.Provider value={{
      ulpList, penyulangList, reguList, petugasList, users,
      setMasterData,
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
