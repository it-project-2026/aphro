import React, { createContext, useContext, ReactNode, useCallback } from 'react';
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
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [ulpList, setUlpList] = usePersistState<ULP[]>('aphro_ulp', INITIAL_ULP);
  const [penyulangList, setPenyulangList] = usePersistState<Penyulang[]>('aphro_penyulang', INITIAL_PENYULANG);
  const [reguList, setReguList] = usePersistState<ReguROW[]>('aphro_regu', INITIAL_REGU);
  const [petugasList, setPetugasList] = usePersistState<Petugas[]>('aphro_ptg', INITIAL_PETUGAS);
  const [users, setUsers] = usePersistState<User[]>('aphro_synced_users', INITIAL_USERS);

  const setMasterData = useCallback((data: {
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

  const addULP = useCallback((data: Omit<ULP, 'id'>) => {
    setUlpList(prev => [...prev, { ...data, id: 'ULP-' + Date.now() }]);
  }, [setUlpList]);

  const updateULP = useCallback((id: string, data: Partial<ULP>) => {
    setUlpList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setUlpList]);

  const deleteULP = useCallback((id: string) => {
    setUlpList(prev => prev.filter(item => item.id !== id));
  }, [setUlpList]);

  // Similar for others... (skipped for brevity but should be implemented)
  const addPenyulang = useCallback((data: Omit<Penyulang, 'id'>) => {
    setPenyulangList(prev => [...prev, { ...data, id: 'PYL-' + Date.now() }]);
  }, [setPenyulangList]);

  const updatePenyulang = useCallback((id: string, data: Partial<Penyulang>) => {
    setPenyulangList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setPenyulangList]);

  const deletePenyulang = useCallback((id: string) => {
    setPenyulangList(prev => prev.filter(item => item.id !== id));
  }, [setPenyulangList]);

  const addRegu = useCallback((data: Omit<ReguROW, 'id'>) => {
    setReguList(prev => [...prev, { ...data, id: 'RGU-' + Date.now() }]);
  }, [setReguList]);

  const updateRegu = useCallback((id: string, data: Partial<ReguROW>) => {
    setReguList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setReguList]);

  const deleteRegu = useCallback((id: string) => {
    setReguList(prev => prev.filter(item => item.id !== id));
  }, [setReguList]);

  const addPetugas = useCallback((data: Omit<Petugas, 'id'>) => {
    setPetugasList(prev => [...prev, { ...data, id: 'PTG-' + Date.now() }]);
  }, [setPetugasList]);

  const updatePetugas = useCallback((id: string, data: Partial<Petugas>) => {
    setPetugasList(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  }, [setPetugasList]);

  const deletePetugas = useCallback((id: string) => {
    setPetugasList(prev => prev.filter(item => item.id !== id));
  }, [setPetugasList]);

  return (
    <MasterDataContext.Provider value={{
      ulpList, penyulangList, reguList, petugasList, users,
      setMasterData,
      addULP, updateULP, deleteULP,
      addPenyulang, updatePenyulang, deletePenyulang,
      addRegu, updateRegu, deleteRegu,
      addPetugas, updatePetugas, deletePetugas
    }}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
}
