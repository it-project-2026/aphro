import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { Absensi } from '../types';
import { INITIAL_ABSENSI } from '../data/initialData';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from '../hooks/useToast';
import { GASApiService } from '../services/gasApiService';
import { addToOfflineQueue } from '../services/offlineSyncQueue';
import { formatDriveViewUrl } from '../utils/driveUtils';

interface AbsensiContextType {
  absensiList: Absensi[];
  setAbsensiList: (list: Absensi[]) => void;
  addAbsensi: (abs: Omit<Absensi, 'id' | 'createdAt'>) => Promise<Absensi>;
  hasCheckedInToday: boolean;
}

const AbsensiContext = React.createContext<AbsensiContextType | undefined>(undefined);

export function AbsensiProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [absensiList, setAbsensiList] = usePersistState<Absensi[]>('aphro_absensi', INITIAL_ABSENSI);

  const addAbsensi = React.useCallback(async (absData: Omit<Absensi, 'id' | 'createdAt'>) => {
    const todayStr = absData.tanggal || new Date().toISOString().slice(0, 10);
    const nowStr = new Date().toLocaleString('id-ID');

    // Find existing entry for today & regu
    const existingIndex = absensiList.findIndex(a => 
      a && String(a.tanggal).slice(0, 10) === todayStr &&
      (a.reguName || '').trim().toLowerCase() === (absData.reguName || '').trim().toLowerCase()
    );

    let finalAbs: Absensi;

    if (existingIndex >= 0) {
      const existing = absensiList[existingIndex];
      finalAbs = {
        ...existing,
        ...absData,
        fotoMasuk: absData.fotoMasuk || existing.fotoMasuk,
        timestampMasuk: existing.timestampMasuk || (absData.fotoMasuk ? nowStr : undefined),
        fotoKeluar: absData.fotoKeluar || existing.fotoKeluar,
        timestampKeluar: absData.fotoKeluar ? (absData.timestampKeluar || nowStr) : existing.timestampKeluar,
      };
    } else {
      finalAbs = {
        ...absData,
        id: 'ABS-' + Date.now(),
        timestampMasuk: absData.fotoMasuk ? nowStr : undefined,
        timestampKeluar: absData.fotoKeluar ? nowStr : undefined,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
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

    // Sync to GAS if URL exists
    const payloadToSave = {
      ...finalAbs,
      folderId: settings.absensiFolderId || '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5',
    };

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('ABSENSI', payloadToSave);
      showToast('⚡ Absensi tersimpan di perangkat (Offline). Akan otomatis disinkronkan saat terhubung internet.', 'info');
    } else {
      try {
        const res = await GASApiService.saveAbsensi(settings.gasWebAppUrl, payloadToSave);
        
        if (res.status === 'success') {
          showToast('Absensi berhasil disinkronkan ke Spreadsheet!', 'success');
          if (res.fotoMasukUrl || res.fotoKeluarUrl) {
            setAbsensiList(prev => prev.map(item => {
              if (item.id === finalAbs.id) {
                return {
                  ...item,
                  fotoMasuk: res.fotoMasukUrl ? formatDriveViewUrl(res.fotoMasukUrl) : item.fotoMasuk,
                  fotoKeluar: res.fotoKeluarUrl ? formatDriveViewUrl(res.fotoKeluarUrl) : item.fotoKeluar,
                };
              }
              return item;
            }));
          }
        } else {
          addToOfflineQueue('ABSENSI', payloadToSave);
          showToast(`⚡ Tersimpan lokal. ${res.message || 'Gagal ke Spreadsheet, masuk antrean sinkronisasi.'}`, 'warning');
        }
      } catch (err) {
        console.error('Sync Absensi error:', err);
        addToOfflineQueue('ABSENSI', payloadToSave);
        showToast('⚡ Data tersimpan lokal di HP/Perangkat. Akan disinkronkan saat terhubung internet.', 'warning');
      }
    }

    return finalAbs;
  }, [absensiList, setAbsensiList, settings.gasWebAppUrl, settings.absensiFolderId, showToast]);

  const hasCheckedInToday = React.useMemo(() => {
    if (!user || (user.role || '').toUpperCase() !== 'USER') return true;
    
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

    const userReguClean = cleanStr(user.reguName);
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

      // Check date match for today
      const isToday = (
        absTanggal.startsWith(isoPrefix) ||
        absTanggal.includes(`${currentY}-${padStr(currentM + 1)}-${padStr(currentD)}`) ||
        absTanggal.includes(`${currentD}/${currentM + 1}/${currentY}`) ||
        absTanggal.includes(`${padStr(currentD)}/${padStr(currentM + 1)}/${currentY}`) ||
        absTanggal.includes(`${currentD}-${currentM + 1}-${currentY}`) ||
        absTanggal.includes(`${padStr(currentD)}-${padStr(currentM + 1)}-${currentY}`) ||
        (absTanggal.length >= 10 && !isNaN(Date.parse(absTanggal)) && new Date(absTanggal).toDateString() === now.toDateString())
      );

      if (!isToday) return false;

      // Extract Regu Name from ABSENSI sheet (Column Nama_Regu / NAMA_REGU / Regu)
      const absReguClean = cleanStr(abs.reguName || abs.NAMA_REGU || abs.Nama_Regu || abs.Regu);

      // 1. Direct match on Nama_Regu
      if (userReguClean && absReguClean) {
        if (
          userReguClean === absReguClean ||
          (userReguClean.length >= 2 && absReguClean.length >= 2 && (userReguClean.includes(absReguClean) || absReguClean.includes(userReguClean)))
        ) {
          return true;
        }
      }

      // 2. Candidate fallback match across petugas/username/NIP
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
    <AbsensiContext.Provider value={{ absensiList, setAbsensiList, addAbsensi, hasCheckedInToday }}>
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
