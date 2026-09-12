import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { Absensi } from '../types';
import { INITIAL_ABSENSI } from '../data/initialData';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { SupabaseService } from '../services/supabaseService';
import { syncManager } from '../services/syncManager';
import { getLocalDateTimeString, getWIBDateString, normalizeDateISO } from '../utils/dateUtils';

interface AbsensiContextType {
  absensiList: Absensi[];
  setAbsensiList: React.Dispatch<React.SetStateAction<Absensi[]>>;
  addAbsensi: (abs: Omit<Absensi, 'id' | 'createdAt'>) => Promise<Absensi>;
  updateAbsensi: (id: string, absData: Partial<Absensi>) => Promise<boolean>;
  deleteAbsensi: (id: string) => Promise<boolean>;
  refreshAbsensi: () => Promise<void>;
  hasCheckedInToday: boolean;
}

const AbsensiContext = React.createContext<AbsensiContextType | undefined>(undefined);

export function AbsensiProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [absensiList, setAbsensiList] = usePersistState<Absensi[]>('aphro_absensi', INITIAL_ABSENSI);

  const refreshAbsensi = React.useCallback(async () => {
    try {
      const unitId = SupabaseService.getActiveUnitId();
      const res = await SupabaseService.fetchAbsensi(unitId);
      if (res.success && res.data) {
        setAbsensiList(res.data);
      }
    } catch (err) {
      console.warn('Error loading Absensi from Supabase:', err);
    }
  }, [setAbsensiList]);

  React.useEffect(() => {
    if (user) {
      refreshAbsensi();
    }
  }, [refreshAbsensi, settings.namaUnitLayanan, user]);

  const addAbsensi = React.useCallback(async (absData: Omit<Absensi, 'id' | 'createdAt'>) => {
    const todayStr = absData.tanggal || getWIBDateString();
    const nowStr = getLocalDateTimeString();

    const normalizeDate = (d: any) => {
      if (!d) return '';
      const s = String(d).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const match = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (match) {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
      return s.slice(0, 10);
    };

    const targetDate = normalizeDate(todayStr);

    const existingIndex = absensiList.findIndex(a => {
      if (!a) return false;
      const rowDate = normalizeDate(a.tanggal);
      const rowRegu = (a.reguName || '').trim().toLowerCase();
      const targetRegu = (absData.reguName || '').trim().toLowerCase();
      return rowDate === targetDate && rowRegu === targetRegu;
    });

    let finalAbs: Absensi;

    if (existingIndex >= 0) {
      const existing = absensiList[existingIndex];
      const isClockingOut = Boolean(absData.fotoKeluar);
      
      if (isClockingOut) {
        finalAbs = {
          ...existing,
          fotoKeluar: absData.fotoKeluar,
          timestampKeluar: absData.timestampKeluar || nowStr,
          latitude: absData.latitude || existing.latitude,
          longitude: absData.longitude || existing.longitude,
          updatedAt: getLocalDateTimeString(),
        };
      } else {
        finalAbs = {
          ...existing,
          ...absData,
          fotoMasuk: absData.fotoMasuk || existing.fotoMasuk,
          timestampMasuk: existing.timestampMasuk || (absData.fotoMasuk ? nowStr : undefined),
          fotoKeluar: absData.fotoKeluar || existing.fotoKeluar,
          timestampKeluar: absData.fotoKeluar ? (absData.timestampKeluar || nowStr) : existing.timestampKeluar,
          updatedAt: getLocalDateTimeString(),
        };
      }
    } else {
      finalAbs = {
        ...absData,
        id: 'ABS-' + Date.now(),
        timestampMasuk: absData.fotoMasuk ? nowStr : undefined,
        timestampKeluar: absData.fotoKeluar ? nowStr : undefined,
        createdAt: getLocalDateTimeString(),
      };
    }

    // Update local state optimistically
    const newList = [...absensiList];
    if (existingIndex >= 0) {
      newList[existingIndex] = finalAbs;
    } else {
      newList.unshift(finalAbs);
    }
    setAbsensiList(newList);

    const unitId = SupabaseService.getActiveUnitId();
    try {
      const res = await syncManager.executeMutation({
        type: existingIndex >= 0 ? 'UPDATE' : 'CREATE',
        tableName: 'ABSENSI',
        payload: finalAbs,
        apiCall: async () => {
          const result = await SupabaseService.saveAbsensi(unitId, finalAbs);
          return { status: result.success ? 'success' : 'error', message: result.error };
        }
      });

      if (!res.offline) {
        showToast('Absensi berhasil disinkronkan ke Supabase!', 'success');
      } else {
        showToast('Absensi tersimpan (offline).', 'info');
      }
    } catch (err) {
      console.warn('Sync Absensi error:', err);
      showToast('Absensi tersimpan di perangkat.', 'info');
    }

    return finalAbs;
  }, [absensiList, setAbsensiList, showToast]);

  const updateAbsensi = React.useCallback(async (id: string, absData: Partial<Absensi>) => {
    const existingIndex = absensiList.findIndex(a => a.id === id);
    if (existingIndex === -1) return false;

    const updatedAbs = {
      ...absensiList[existingIndex],
      ...absData,
      updatedAt: getLocalDateTimeString(),
    };

    const newList = [...absensiList];
    newList[existingIndex] = updatedAbs;
    setAbsensiList(newList);

    const unitId = SupabaseService.getActiveUnitId();
    try {
      await syncManager.executeMutation({
        type: 'UPDATE',
        tableName: 'ABSENSI',
        payload: updatedAbs,
        apiCall: async () => {
          const result = await SupabaseService.saveAbsensi(unitId, updatedAbs);
          return { status: result.success ? 'success' : 'error', message: result.error };
        }
      });
      showToast('Perubahan absensi tersimpan', 'success');
    } catch {
      showToast('Perubahan tersimpan lokal.', 'info');
    }
    return true;
  }, [absensiList, setAbsensiList, showToast]);

  const deleteAbsensi = React.useCallback(async (id: string) => {
    const existing = absensiList.find(a => a.id === id);
    const newList = absensiList.filter(a => a.id !== id);
    setAbsensiList(newList);

    if (existing) {
      const unitId = SupabaseService.getActiveUnitId();
      try {
        await syncManager.executeMutation({
          type: 'DELETE',
          tableName: 'ABSENSI',
          payload: { id },
          apiCall: async () => {
            const result = await SupabaseService.deleteAbsensi(unitId, id);
            return { status: result.success ? 'success' : 'error', message: result.error };
          }
        });
      } catch (e) {
        console.warn('Delete Absensi offline error:', e);
      }
    }

    showToast('Absensi dihapus', 'info');
    return true;
  }, [absensiList, setAbsensiList, showToast]);

  const hasCheckedInToday = React.useMemo(() => {
    if (!user || (user.role || '').toUpperCase() !== 'USER') return true;
    
    const todayISO = getWIBDateString();
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth();
    const currentD = now.getDate();
    
    const padStr = (num: number) => String(num).padStart(2, '0');
    const isoPrefix = `${currentY}-${padStr(currentM + 1)}-${padStr(currentD)}`;
    
    const cleanStr = (s?: string | null) => {
      if (!s) return '';
      return String(s)
        .toLowerCase()
        .trim()
        .replace(/^(regu|tim|petugas)\s+/gi, '')
        .replace(/[^a-z0-9]/gi, '');
    };

    const extractRowNo = (s?: string | null): number | null => {
      if (!s) return null;
      const match = String(s).match(/row\s*0?(\d+)/i) || String(s).match(/(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };

    const userReguClean = cleanStr(user.reguName);
    const userRowNo = extractRowNo(user.reguName) ?? extractRowNo(user.userName);
    const userCandidates = [
      userReguClean,
      cleanStr(user.userName),
      cleanStr(user.name),
      cleanStr(user.nip),
      cleanStr(user.id),
    ].filter(Boolean);

    return absensiList.some((abs: any) => {
      const absTanggal = String(abs.tanggal || abs.TANGGAL || abs.Tanggal || '');
      if (!absTanggal) return false;

      const normDate = normalizeDateISO(absTanggal);
      const isToday = (
        normDate === todayISO ||
        absTanggal.startsWith(isoPrefix) ||
        absTanggal.includes(`${currentY}-${padStr(currentM + 1)}-${padStr(currentD)}`) ||
        absTanggal.includes(`${currentD}/${currentM + 1}/${currentY}`) ||
        absTanggal.includes(`${padStr(currentD)}/${padStr(currentM + 1)}/${currentY}`) ||
        absTanggal.includes(`${currentD}-${currentM + 1}-${currentY}`) ||
        absTanggal.includes(`${padStr(currentD)}-${padStr(currentM + 1)}-${currentY}`) ||
        (absTanggal.length >= 10 && !isNaN(Date.parse(absTanggal)) && new Date(absTanggal).toDateString() === now.toDateString())
      );

      if (!isToday) return false;

      const absReguClean = cleanStr(abs.reguName || abs.NAMA_REGU || abs.Nama_Regu || abs.Regu);
      const absRowNo = extractRowNo(abs.reguName || abs.NAMA_REGU || abs.Nama_Regu || abs.Regu);

      if (userRowNo !== null && absRowNo !== null && userRowNo === absRowNo) {
        return true;
      }

      if (userReguClean && absReguClean) {
        if (
          userReguClean === absReguClean ||
          (userReguClean.length >= 2 && absReguClean.length >= 2 && (userReguClean.includes(absReguClean) || absReguClean.includes(userReguClean)))
        ) {
          return true;
        }
      }

      const absCandidates = [
        absReguClean,
        cleanStr(abs.userName || abs.USER_NAME || abs.Username),
        cleanStr(abs.namaPetugas || abs.NAMA_PETUGAS || abs.Nama_Petugas || abs.Petugas),
        cleanStr(abs.nip || abs.NIP),
        cleanStr(abs.userId || abs.USER_ID || abs.id),
      ].filter(Boolean);

      if (Array.isArray(abs.petugasList)) {
        for (const p of abs.petugasList) {
          if (p && p.nama) absCandidates.push(cleanStr(p.nama));
        }
      }

      for (let i = 1; i <= 5; i++) {
        const pVal = abs[`PETUGAS_${i}`] || abs[`Petugas_${i}`] || abs[`petugas_${i}`];
        if (pVal) absCandidates.push(cleanStr(pVal));
      }

      for (const uCand of userCandidates) {
        for (const aCand of absCandidates) {
          if (
            uCand === aCand ||
            (uCand.length >= 3 && aCand.length >= 3 && (uCand.includes(aCand) || aCand.includes(uCand)))
          ) {
            return true;
          }
        }
      }

      return false;
    });
  }, [absensiList, user]);

  return (
    <AbsensiContext.Provider value={{ absensiList, setAbsensiList, addAbsensi, updateAbsensi, deleteAbsensi, refreshAbsensi, hasCheckedInToday }}>
      {children}
    </AbsensiContext.Provider>
  );
}

export function useAbsensi() {
  const context = React.useContext(AbsensiContext);
  if (context === undefined) {
    throw new Error('useAbsensi must be used within a AbsensiProvider');
  }
  return context;
}
