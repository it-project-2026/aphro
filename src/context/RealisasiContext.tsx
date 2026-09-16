import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { Realisasi } from '../types';
import { INITIAL_REALISASI } from '../data/initialData';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';
import { SupabaseService } from '../services/supabaseService';
import { GASApiService } from '../services/gasApiService';
import { dexieDb, LocalRealisasi, LocalPhoto } from '../services/dexieDb';
import { offlineSyncQueue } from '../services/offlineSyncQueue';
import { getLocalDateTimeString, normalizeDateISO, parseDateFromNomorWO } from '../utils/dateUtils';

interface RealisasiContextType {
  realisasiList: Realisasi[];
  setRealisasiList: React.Dispatch<React.SetStateAction<Realisasi[]>>;
  addRealisasi: (rel: Omit<Realisasi, 'id' | 'createdAt'>) => Promise<Realisasi>;
  updateRealisasi: (id: string, updates: Partial<Realisasi>) => void;
  deleteRealisasi: (id: string) => void;
  refreshRealisasi: () => Promise<void>;
}

const RealisasiContext = React.createContext<RealisasiContextType | undefined>(undefined);

export function RealisasiProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [realisasiList, setRealisasiList] = usePersistState<Realisasi[]>('aphro_realisasi', INITIAL_REALISASI);

  const lastFetchTime = React.useRef(0);
  const lastSyncRef = React.useRef<string | undefined>(undefined);

  const mapLocalToUI = (allLocal: LocalRealisasi[]): Realisasi[] => {
    return allLocal.map((loc) => ({
      id: loc.serverId || loc.localId || loc.id,
      unitId: (loc as any).unitId || loc.ulpName || '',
      workOrderId: loc.workOrderId || '',
      nomorWO: loc.nomorWO,
      ulpName: loc.ulpName,
      reguName: loc.reguName,
      penyulangName: loc.penyulangName,
      noTiang: loc.noTiang,
      tanggalRealisasi: loc.tanggalRealisasi,
      petugasId: loc.petugasId,
      petugasName: loc.petugasName,
      jenisTanaman: loc.jenisTanaman,
      pertumbuhanTanaman: loc.pertumbuhanTanaman,
      kendala: loc.kendala,
      lokasiKerja: loc.lokasiKerja,
      latitude: loc.latitude,
      longitude: loc.longitude,
      keterangan: loc.keterangan,
      progressPercent: loc.progressPercent || 100,
      status: loc.status || 'Selesai',
      photosSebelum: loc.photosSebelum || [],
      photosSesudah: loc.photosSesudah || [],
      fotoSebelumUrl: loc.fotoSebelumUrl,
      fotoSesudahUrl: loc.fotoSesudahUrl,
      createdAt: loc.createdAt,
      isSynced: loc.syncStatus === 'SYNCED',
      syncId: loc.idempotencyKey,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const refreshRealisasi = React.useCallback(async (force: boolean = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTime.current < 2000) return;
    lastFetchTime.current = now;

    try {
      // 1. INSTANT LOCAL-FIRST: Load from Dexie & render to UI immediately (< 50-100 ms)
      const localRecords = await dexieDb.realisasi.toArray();
      if (localRecords.length > 0) {
        setRealisasiList(mapLocalToUI(localRecords));
      }

      // 2. BACKGROUND DELTA SYNC: Check Supabase asynchronously without blocking UI
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const unitId = SupabaseService.getActiveUnitId();
        SupabaseService.fetchRealisasi(unitId, 0, 100, lastSyncRef.current, false).then(async (res) => {
          if (res.success && res.data) {
            if (res.data.length > 0) {
              // Bulk Put remote records into Dexie
              await dexieDb.realisasi.bulkPut(
                res.data.map((item) => ({
                  id: item.id || item.syncId || `REL-${Date.now()}`,
                  localId: item.id || `REL-${Date.now()}`,
                  serverId: item.id,
                  idempotencyKey: item.syncId || item.id,
                  unitId: item.unitId || '',
                  nomorWO: item.nomorWO,
                  ulpName: item.ulpName || '',
                  reguName: item.reguName || '',
                  penyulangName: item.penyulangName || '',
                  petugasId: item.petugasId || '',
                  petugasName: item.petugasName || '',
                  noTiang: item.noTiang || '',
                  tanggalRealisasi: item.tanggalRealisasi,
                  jenisTanaman: item.jenisTanaman || '',
                  keterangan: item.keterangan || '',
                  pertumbuhanTanaman: item.pertumbuhanTanaman || '',
                  kendala: item.kendala || '',
                  latitude: item.latitude || 0,
                  longitude: item.longitude || 0,
                  createdAt: item.createdAt || getLocalDateTimeString(),
                  updatedAt: getLocalDateTimeString(),
                  syncStatus: 'SYNCED' as const,
                  progressPercent: 100,
                  status: item.status || 'Selesai',
                  fotoSebelumUrl: item.fotoSebelumUrl,
                  fotoSesudahUrl: item.fotoSesudahUrl,
                  photosSebelum: item.photosSebelum || [],
                  photosSesudah: item.photosSesudah || [],
                  workOrderId: item.workOrderId,
                }))
              );

              // Update UI with newly merged local + remote records
              const updatedAll = await dexieDb.realisasi.toArray();
              setRealisasiList(mapLocalToUI(updatedAll));
            }
            lastSyncRef.current = getLocalDateTimeString();
          }
        }).catch((fetchErr) => {
          console.warn('Background Supabase fetchRealisasi error:', fetchErr);
        });
      }
    } catch (err) {
      console.warn('Error loading Realisasi from Dexie:', err);
    }
  }, [setRealisasiList]);

  React.useEffect(() => {
    refreshRealisasi(true);

    // Subscribe to Offline Sync Queue changes to refresh state automatically
    const unsubscribe = offlineSyncQueue.subscribe((evt) => {
      if (evt.status === 'COMPLETED' || evt.status === 'SYNCING') {
        refreshRealisasi(false);
      }
    });

    return () => unsubscribe();
  }, [refreshRealisasi, settings.namaUnitLayanan, user]);

  const addRealisasi = React.useCallback(async (relData: Omit<Realisasi, 'id' | 'createdAt' | 'isSynced' | 'syncId'>) => {
    const timestamp = getLocalDateTimeString();
    const idempotencyKey = `REL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const localId = idempotencyKey;

    // Extract photos for local IndexedDB store
    const localPhotos: LocalPhoto[] = [];
    if (relData.photosSebelum && Array.isArray(relData.photosSebelum)) {
      relData.photosSebelum.forEach((p, idx) => {
        localPhotos.push({
          id: p.id || `photo-seb-${localId}-${idx + 1}`,
          realisasiId: localId,
          woId: relData.workOrderId || '',
          type: 'sebelum',
          slotIndex: (idx + 1) as any,
          dataUrl: p.dataUrl || '',
          fileUrl: p.fileUrl,
          originalName: p.originalName || `Foto_Sebelum_${idx + 1}.jpg`,
          timestamp: p.timestamp || timestamp,
          latitude: p.latitude || relData.latitude || 0,
          longitude: p.longitude || relData.longitude || 0,
          userName: p.userName || relData.petugasName || '',
          ulpName: p.ulpName || relData.ulpName || '',
          syncStatus: 'PENDING',
          createdAt: timestamp,
        });
      });
    }

    if (relData.photosSesudah && Array.isArray(relData.photosSesudah)) {
      relData.photosSesudah.forEach((p, idx) => {
        localPhotos.push({
          id: p.id || `photo-ses-${localId}-${idx + 1}`,
          realisasiId: localId,
          woId: relData.workOrderId || '',
          type: 'sesudah',
          slotIndex: (idx + 1) as any,
          dataUrl: p.dataUrl || '',
          fileUrl: p.fileUrl,
          originalName: p.originalName || `Foto_Sesudah_${idx + 1}.jpg`,
          timestamp: p.timestamp || timestamp,
          latitude: p.latitude || relData.latitude || 0,
          longitude: p.longitude || relData.longitude || 0,
          userName: p.userName || relData.petugasName || '',
          ulpName: p.ulpName || relData.ulpName || '',
          syncStatus: 'PENDING',
          createdAt: timestamp,
        });
      });
    }

    const localRecord: LocalRealisasi = {
      ...relData,
      localId,
      idempotencyKey,
      syncStatus: 'PENDING',
      updatedAt: timestamp,
      createdAt: timestamp,
      id: localId,
      progressPercent: 100,
      status: 'Selesai',
    };

    // 1. Enqueue in Offline Sync Queue & Dexie DB
    await offlineSyncQueue.enqueueRealisasi(localRecord, localPhotos);

    const newRelUI: Realisasi = {
      ...relData,
      id: localId,
      createdAt: timestamp,
      syncId: idempotencyKey,
      isSynced: false,
    };

    // 2. Immediate Optimistic UI Update from Local DB
    setRealisasiList((prev) => [newRelUI, ...prev]);

    // 3. User feedback message
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Realisasi tersimpan di perangkat dan menunggu sinkronisasi.', 'info');
    } else {
      showToast('Realisasi tersimpan di perangkat. Memulai sinkronisasi...', 'info');
    }

    return newRelUI;
  }, [setRealisasiList, showToast]);

  const updateRealisasi = React.useCallback(async (id: string, updates: Partial<Realisasi>) => {
    const existing = realisasiList.find((r) => r.id === id || r.syncId === id);
    if (!existing) return;

    const updatedRel = { ...existing, ...updates };

    setRealisasiList((prev) => prev.map((rel) => (rel.id === id || rel.syncId === id ? updatedRel : rel)));

    try {
      await dexieDb.realisasi.update(id, {
        ...updates,
        syncStatus: 'PENDING',
        updatedAt: getLocalDateTimeString(),
      });
      showToast('Realisasi berhasil diperbarui di perangkat', 'info');
    } catch (err) {
      console.warn('Update Dexie Realisasi error:', err);
    }
  }, [realisasiList, setRealisasiList, showToast]);

  const deleteRealisasi = React.useCallback(async (id: string) => {
    // 1. Immediate optimistic state update
    setRealisasiList((prev) => prev.filter((rel) => rel.id !== id && rel.syncId !== id));

    // 2. Clear from Dexie local database & photos
    try {
      await dexieDb.realisasi.where('id').equals(id).or('localId').equals(id).or('serverId').equals(id).or('idempotencyKey').equals(id).delete();
      await dexieDb.realisasi.delete(id);
      await dexieDb.photos.where('realisasiId').equals(id).delete();
    } catch (e) {
      console.warn('Delete Dexie Realisasi error:', e);
    }

    // 3. Remote deletion from Supabase Database or Offline Sync Queue
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const unitId = SupabaseService.getActiveUnitId();
        const res = await SupabaseService.deleteRealisasi(unitId, id);
        
        // Also trigger GAS deletion in background if configured
        if (settings.gasWebAppUrl && settings.spreadsheetId) {
          GASApiService.deleteRealisasi(settings.gasWebAppUrl, settings.spreadsheetId, id).catch((gasErr) => {
            console.warn('GAS deleteRealisasi background sync error:', gasErr);
          });
        }

        if (res.success) {
          showToast('Data realisasi berhasil dihapus permanen dari Database', 'success');
        } else {
          showToast('Realisasi dihapus di perangkat (Server: ' + (res.error || 'Pending') + ')', 'info');
        }
      } catch (err) {
        console.warn('Delete Supabase Realisasi error:', err);
        showToast('Data realisasi dihapus dari perangkat', 'info');
      }
    } else {
      try {
        await offlineSyncQueue.enqueueDeleteRealisasi(id);
      } catch (e) {
        console.warn('Enqueue delete error:', e);
      }
      showToast('Realisasi dihapus dari perangkat (Akan disinkron ke database saat online)', 'info');
    }
  }, [setRealisasiList, showToast, settings.gasWebAppUrl, settings.spreadsheetId]);

  return (
    <RealisasiContext.Provider value={{ realisasiList, setRealisasiList, addRealisasi, updateRealisasi, deleteRealisasi, refreshRealisasi }}>
      {children}
    </RealisasiContext.Provider>
  );
}

export function useRealisasi() {
  const context = React.useContext(RealisasiContext);
  if (context === undefined) {
    throw new Error('useRealisasi must be used within a RealisasiProvider');
  }
  return context;
}
