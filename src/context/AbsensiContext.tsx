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
  setAbsensiList: React.Dispatch<React.SetStateAction<Absensi[]>>;
  addAbsensi: (abs: Omit<Absensi, 'id' | 'createdAt'>) => Promise<Absensi>;
  updateAbsensi: (id: string, absData: Partial<Absensi>) => Promise<boolean>;
  deleteAbsensi: (id: string) => Promise<boolean>;
  hasCheckedInToday: boolean;
}

const AbsensiContext = React.createContext<AbsensiContextType | undefined>(undefined);

export function AbsensiProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [absensiList, setAbsensiList] = usePersistState<Absensi[]>('aphro_absensi', INITIAL_ABSENSI);

  const addAbsensi = React.useCallback(async (absData: Omit<Absensi, 'id' | 'createdAt'>) => {
    const todayStr = absData.tanggal || (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'));
    const nowStr = new Date().toLocaleString('id-ID');

    // Helper to normalize date for comparison
    const normalizeDate = (d: any) => {
      if (!d) return '';
      const s = String(d).trim();
      // ISO YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      // Indo DD-MM-YYYY or DD/MM/YYYY
      const match = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (match) {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
      return s.slice(0, 10);
    };

    const targetDate = normalizeDate(todayStr);

    // Find existing entry for today & regu
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
        // Strict clock-out update: only update clock-out fields and metadata
        finalAbs = {
          ...existing,
          fotoKeluar: absData.fotoKeluar,
          timestampKeluar: absData.timestampKeluar || nowStr,
          latitude: absData.latitude || existing.latitude,
          longitude: absData.longitude || existing.longitude,
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        };
      } else {
        // Normal update or re-clock-in (though usually shouldn't happen same day)
        finalAbs = {
          ...existing,
          ...absData,
          fotoMasuk: absData.fotoMasuk || existing.fotoMasuk,
          timestampMasuk: existing.timestampMasuk || (absData.fotoMasuk ? nowStr : undefined),
          fotoKeluar: absData.fotoKeluar || existing.fotoKeluar,
          timestampKeluar: absData.fotoKeluar ? (absData.timestampKeluar || nowStr) : existing.timestampKeluar,
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        };
      }
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
      isAbsenPulang: Boolean(absData.fotoKeluar),
      folderId: settings.absensiFolderId || '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5',
    };

    if (!navigator.onLine || !settings.gasWebAppUrl) {
      addToOfflineQueue('ABSENSI', payloadToSave);
      showToast('⚡ Absensi tersimpan di perangkat (Offline). Tekan tombol Sync Data untuk mengirim ke Spreadsheet.', 'info');
    } else {
      try {
        const res = await GASApiService.saveAbsensi(settings.gasWebAppUrl, settings.spreadsheetId, payloadToSave);
        
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
          showToast(`⚡ Tersimpan di perangkat. Tekan tombol Sync Data untuk mengirim ke Spreadsheet.`, 'warning');
        }
      } catch (err) {
        console.error('Sync Absensi error:', err);
        addToOfflineQueue('ABSENSI', payloadToSave);
        showToast('⚡ Data tersimpan di perangkat. Tekan tombol Sync Data untuk mengirim ke Spreadsheet.', 'warning');
      }
    }

    return finalAbs;
  }, [absensiList, setAbsensiList, settings.gasWebAppUrl, settings.spreadsheetId, settings.absensiFolderId, showToast]);

  const updateAbsensi = React.useCallback(async (id: string, absData: Partial<Absensi>) => {
    const existingIndex = absensiList.findIndex(a => a.id === id);
    if (existingIndex === -1) return false;

    const updatedAbs = {
      ...absensiList[existingIndex],
      ...absData,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    // Update local state
    const newList = [...absensiList];
    newList[existingIndex] = updatedAbs;
    setAbsensiList(newList);

    if (settings.gasWebAppUrl) {
      try {
        const res = await GASApiService.saveAbsensi(settings.gasWebAppUrl, settings.spreadsheetId, updatedAbs);
        if (res.status === 'success') {
          showToast('Perubahan absensi berhasil disinkronkan!', 'success');
          return true;
        }
        showToast('Gagal sinkronisasi ke Spreadsheet, perubahan tersimpan lokal.', 'warning');
      } catch (err) {
        showToast('Gagal sinkronisasi, perubahan tersimpan lokal.', 'warning');
      }
    }
    return true;
  }, [absensiList, setAbsensiList, settings.gasWebAppUrl, settings.spreadsheetId, showToast]);

  const deleteAbsensi = React.useCallback(async (id: string) => {
    // Update local state
    const newList = absensiList.filter(a => a.id !== id);
    setAbsensiList(newList);

    if (settings.gasWebAppUrl) {
      try {
        const res = await GASApiService.deleteAbsensi(settings.gasWebAppUrl, settings.spreadsheetId, id);
        if (res.status === 'success') {
          showToast('Absensi berhasil dihapus dari Spreadsheet!', 'success');
          return true;
        }
        showToast('Gagal menghapus di Spreadsheet, terhapus lokal.', 'warning');
      } catch (err) {
        showToast('Gagal menghapus di Spreadsheet, terhapus lokal.', 'warning');
      }
    }
    return true;
  }, [absensiList, setAbsensiList, settings.gasWebAppUrl, settings.spreadsheetId, showToast]);

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
    <AbsensiContext.Provider value={{ absensiList, setAbsensiList, addAbsensi, updateAbsensi, deleteAbsensi, hasCheckedInToday }}>
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
