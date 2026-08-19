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

  const addULP = React.useCallback((data: Omit<ULP, 'id'>) => {
    setUlpList(prev => [...prev, { ...data, id: 'ULP-' + Date.now() }]);
  }, [setUlpList]);

  const updateULP = React.useCallback((id: string, data: Partial<ULP>) => {
    setUlpList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setUlpList]);

  const deleteULP = React.useCallback((id: string) => {
    setUlpList(prev => prev.filter(item => item.id !== id));
  }, [setUlpList]);

  // Similar for others... (skipped for brevity but should be implemented)
  const addPenyulang = React.useCallback((data: Omit<Penyulang, 'id'>) => {
    setPenyulangList(prev => [...prev, { ...data, id: 'PYL-' + Date.now() }]);
  }, [setPenyulangList]);

  const updatePenyulang = React.useCallback((id: string, data: Partial<Penyulang>) => {
    setPenyulangList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setPenyulangList]);

  const deletePenyulang = React.useCallback((id: string) => {
    setPenyulangList(prev => prev.filter(item => item.id !== id));
  }, [setPenyulangList]);

  const addRegu = React.useCallback((data: Omit<ReguROW, 'id'>) => {
    setReguList(prev => [...prev, { ...data, id: 'RGU-' + Date.now() }]);
  }, [setReguList]);

  const updateRegu = React.useCallback((id: string, data: Partial<ReguROW>) => {
    setReguList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setReguList]);

  const deleteRegu = React.useCallback((id: string) => {
    setReguList(prev => prev.filter(item => item.id !== id));
  }, [setReguList]);

  const addPetugas = React.useCallback((data: Omit<Petugas, 'id'>) => {
    setPetugasList(prev => [...prev, { ...data, id: 'PTG-' + Date.now() }]);
  }, [setPetugasList]);

  const updatePetugas = React.useCallback((id: string, data: Partial<Petugas>) => {
    setPetugasList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setPetugasList]);

  const deletePetugas = React.useCallback((id: string) => {
    setPetugasList(prev => prev.filter(item => item.id !== id));
  }, [setPetugasList]);

  const addUser = React.useCallback((data: Omit<User, 'id'>) => {
    setUsers(prev => [...prev, { ...data, id: 'usr-' + Date.now() }]);
  }, [setUsers]);

  const updateUser = React.useCallback((id: string, data: Partial<User>) => {
    setUsers(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setUsers]);

  const deleteUser = React.useCallback((id: string) => {
    setUsers(prev => prev.filter(item => item.id !== id));
  }, [setUsers]);

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
