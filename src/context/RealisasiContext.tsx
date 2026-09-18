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
import { getLocalDateTimeString, getWIBDateString, normalizeDateISO, parseDateFromNomorWO } from '../utils/dateUtils';
import { ensureGoogleDrivePhotoUrl, isBase64Image, formatDriveViewUrl } from '../utils/driveUtils';
import { auditRealisasiMutation } from '../utils/integrityLogger';

interface RealisasiContextType {
  realisasiList: Realisasi[];
  setRealisasiList: React.Dispatch<React.SetStateAction<Realisasi[]>>;
  addRealisasi: (rel: Omit<Realisasi, 'id' | 'createdAt'>) => Promise<Realisasi>;
  addManualRealisasiAdmin: (
    relData: Partial<Realisasi> & {
      unitId: string;
      tanggalRealisasi: string;
      latitude: number;
      longitude: number;
      [key: string]: any;
    }
  ) => Promise<{ success: boolean; data?: Realisasi; error?: string }>;
  updateRealisasi: (id: string, updates: Partial<Realisasi>) => void;
  updateRealisasiAdmin: (
    id: string,
    arg2: string | (Partial<Realisasi> & { tanggal?: string; latitude?: number; longitude?: number; [key: string]: any }),
    arg3?: number,
    arg4?: number
  ) => Promise<{ success: boolean; error?: string }>;
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

      // 2. BACKGROUND / FULL SYNC: Fetch Supabase asynchronously without blocking UI
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const unitId = SupabaseService.getActiveUnitId();
        // If force is true or local cache is empty, do a full fetch (lastSyncTime = undefined)
        const syncTimeToUse = (force || localRecords.length === 0) ? undefined : lastSyncRef.current;
        
        SupabaseService.fetchRealisasi(unitId, 0, 200, syncTimeToUse, false).then(async (res) => {
          if (res.success && res.data) {
            if (res.data.length > 0) {
              const existingLocalList = await dexieDb.realisasi.toArray();
              const existingLocalMap = new Map(existingLocalList.map((r) => [r.id || r.localId, r]));

              const verifiedRemoteItems = res.data.map((item) => {
                const itemId = item.id || item.syncId || `REL-${Date.now()}`;
                const existing = existingLocalMap.get(itemId);
                let finalNomorWo = item.nomorWO;
                let finalWoId = item.workOrderId;

                if (existing) {
                  const isValid = auditRealisasiMutation(
                    existing,
                    item,
                    'RealisasiContext.refreshRealisasi',
                    'Background Supabase Delta Fetch'
                  );
                  if (!isValid) {
                    finalNomorWo = existing.nomorWO || item.nomorWO;
                    finalWoId = existing.workOrderId || item.workOrderId;
                  }
                }

                return {
                  id: itemId,
                  localId: itemId,
                  serverId: item.id,
                  idempotencyKey: item.syncId || item.id,
                  unitId: item.unitId || unitId || '',
                  nomorWO: finalNomorWo,
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
                  workOrderId: finalWoId,
                };
              });

              // Bulk Put remote records into Dexie
              await dexieDb.realisasi.bulkPut(verifiedRemoteItems);

              // Update UI with newly merged local + remote records
              const updatedAll = await dexieDb.realisasi.toArray();
              console.log(`[REALISASI CONTEXT] Loaded ${updatedAll.length} records into Dexie and React state.`);
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

    const targetUnitId = relData.unitId || SupabaseService.getActiveUnitId();

    const localRecord: LocalRealisasi = {
      ...relData,
      unitId: targetUnitId,
      localId,
      idempotencyKey,
      syncStatus: 'PENDING',
      updatedAt: timestamp,
      createdAt: timestamp,
      id: localId,
      progressPercent: 100,
      status: 'Selesai',
    };

    const newRelUI: Realisasi = {
      ...relData,
      unitId: targetUnitId,
      id: localId,
      createdAt: timestamp,
      syncId: idempotencyKey,
      isSynced: false,
    };

    // 1. Immediate Optimistic UI Update in React state & local Dexie DB
    setRealisasiList((prev) => [newRelUI, ...prev]);

    // 2. Try direct Supabase insertion if online for near-zero latency
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        // Save initial pending state to Dexie first
        await dexieDb.realisasi.put({
          ...localRecord,
          syncStatus: 'SYNCING',
        });

        const saveRes = await SupabaseService.saveRealisasi(targetUnitId, {
          ...newRelUI,
          id: localId,
        });

        if (saveRes && saveRes.success) {
          const finalItem = saveRes.data || newRelUI;
          // Mark as SYNCED in Dexie
          await dexieDb.realisasi.put({
            ...localRecord,
            id: finalItem.id || localId,
            serverId: finalItem.id,
            syncStatus: 'SYNCED',
            updatedAt: getLocalDateTimeString(),
          });

          // Save photos in Dexie as SYNCED
          for (const photo of localPhotos) {
            await dexieDb.photos.put({
              ...photo,
              syncStatus: 'SYNCED',
            });
          }

          // Update UI state with real synced flag
          setRealisasiList((prev) =>
            prev.map((item) =>
              item.id === localId || item.syncId === idempotencyKey
                ? { ...finalItem, isSynced: true, syncId: idempotencyKey }
                : item
            )
          );

          showToast('Data Realisasi berhasil tersimpan langsung ke Supabase.', 'success');
          return { ...finalItem, isSynced: true, syncId: idempotencyKey };
        } else {
          // If direct save failed, fallback to offlineSyncQueue
          console.warn('[RealisasiContext] Direct Supabase save returned error, enqueuing to sync queue:', saveRes?.error);
          await offlineSyncQueue.enqueueRealisasi(localRecord, localPhotos);
          showToast('Realisasi tersimpan lokal dan masuk antrean sinkronisasi.', 'info');
        }
      } catch (directErr) {
        console.warn('[RealisasiContext] Direct save failed, falling back to sync queue:', directErr);
        await offlineSyncQueue.enqueueRealisasi(localRecord, localPhotos);
        showToast('Realisasi tersimpan lokal dan masuk antrean sinkronisasi.', 'info');
      }
    } else {
      // Offline mode: enqueue in Offline Sync Queue
      await offlineSyncQueue.enqueueRealisasi(localRecord, localPhotos);
      showToast('Realisasi tersimpan di perangkat (Mode Offline).', 'info');
    }

    return newRelUI;
  }, [setRealisasiList, showToast]);

  /**
   * Admin Manual Realisasi Insertion
   * Inserts complete manual Realisasi record directly without auto-generating/guessing WO or dates.
   * Performs direct save to Supabase, updates local Dexie cache, and updates React state.
   */
  const addManualRealisasiAdmin = React.useCallback(async (
    relData: Partial<Realisasi> & {
      unitId: string;
      tanggalRealisasi: string;
      latitude: number;
      longitude: number;
      [key: string]: any;
    }
  ): Promise<{ success: boolean; data?: Realisasi; error?: string }> => {
    const timestamp = getLocalDateTimeString();
    const targetId = relData.id?.trim() || `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const targetUnitId = relData.unitId || SupabaseService.getActiveUnitId();

    const fotoSebDrive = await ensureGoogleDrivePhotoUrl(relData.fotoSebelumUrl || relData.photosSebelum?.[0]?.dataUrl, {
      nomorWO: relData.nomorWO,
      reguName: relData.reguName || 'ROW',
      photoType: 'Realisasi_Sebelum',
    });
    const fotoSesDrive = await ensureGoogleDrivePhotoUrl(relData.fotoSesudahUrl || relData.photosSesudah?.[0]?.dataUrl, {
      nomorWO: relData.nomorWO,
      reguName: relData.reguName || 'ROW',
      photoType: 'Realisasi_Sesudah',
    });

    const fullRealisasi: Realisasi = {
      id: targetId,
      unitId: targetUnitId,
      workOrderId: (relData.workOrderId || relData.nomorWO || '').trim(),
      nomorWO: (relData.nomorWO || '').trim(),
      ulpName: (relData.ulpName || '').trim(),
      reguName: (relData.reguName || '').trim(),
      penyulangName: (relData.penyulangName || '').trim(),
      noTiang: (relData.noTiang || '').trim(),
      tanggalRealisasi: (relData.tanggalRealisasi || getWIBDateString()).trim(),
      petugasId: (relData.petugasId || user?.userName || 'Admin').trim(),
      petugasName: (relData.petugasName || user?.name || 'Admin').trim(),
      jenisTanaman: (relData.jenisTanaman || 'Kelapa Sawit').trim(),
      keterangan: (relData.keterangan || 'TEBANG').trim(),
      pertumbuhanTanaman: (relData.pertumbuhanTanaman || 'CEPAT').trim(),
      kendala: (relData.kendala || 'Tidak Ada Kendala').trim(),
      lokasiKerja: (relData.lokasiKerja || '').trim(),
      latitude: Number(relData.latitude || 0),
      longitude: Number(relData.longitude || 0),
      progressPercent: 100,
      status: 'Selesai',
      photosSebelum: relData.photosSebelum || [],
      photosSesudah: relData.photosSesudah || [],
      fotoSebelumUrl: fotoSebDrive || (isBase64Image(relData.fotoSebelumUrl) ? '' : relData.fotoSebelumUrl || ''),
      fotoSesudahUrl: fotoSesDrive || (isBase64Image(relData.fotoSesudahUrl) ? '' : relData.fotoSesudahUrl || ''),
      createdAt: relData.createdAt || timestamp,
      isSynced: true,
      syncId: targetId,
    };

    // 1. Direct Save to Supabase (public.REALISASI)
    const saveRes = await SupabaseService.saveRealisasi(targetUnitId, fullRealisasi);

    if (!saveRes.success) {
      showToast(saveRes.error || 'Gagal menyimpan Realisasi Manual ke Database Supabase.', 'error');
      return { success: false, error: saveRes.error };
    }

    const savedRecord = saveRes.data || fullRealisasi;

    // 2. Direct Local State Update (No full table reload / No N+1 fetch)
    setRealisasiList((prev) => [savedRecord, ...prev.filter((item) => item.id !== savedRecord.id)]);

    // 3. Direct Dexie Local Storage Update
    try {
      const localDexieRow: LocalRealisasi = {
        ...savedRecord,
        localId: savedRecord.id,
        idempotencyKey: targetId,
        syncStatus: 'SYNCED',
        updatedAt: timestamp,
      };
      await dexieDb.realisasi.put(localDexieRow);
    } catch (dexieErr) {
      console.warn('Manual Realisasi Dexie save warning:', dexieErr);
    }

    // 4. Audit Log
    auditRealisasiMutation(
      null,
      savedRecord,
      'addManualRealisasiAdmin',
      `Input manual oleh Admin untuk Unit ${targetUnitId}, WO: ${savedRecord.nomorWO}, Tanggal: ${savedRecord.tanggalRealisasi}`
    );

    showToast('Data Realisasi Manual berhasil disimpan ke Database.', 'success');
    return { success: true, data: savedRecord };
  }, [user, setRealisasiList, showToast]);

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

  const updateRealisasiAdmin = React.useCallback(async (
    id: string,
    arg2: string | (Partial<Realisasi> & { tanggal?: string; latitude?: number; longitude?: number }),
    arg3?: number,
    arg4?: number
  ): Promise<{ success: boolean; error?: string }> => {
    let updatePayload: Partial<Realisasi> & { tanggal?: string; latitude?: number; longitude?: number };
    if (typeof arg2 === 'object' && arg2 !== null) {
      updatePayload = { ...arg2 };
    } else {
      updatePayload = {
        tanggal: String(arg2 || ''),
        tanggalRealisasi: String(arg2 || ''),
        latitude: Number(arg3 || 0),
        longitude: Number(arg4 || 0),
      };
    }

    const finalTanggal = updatePayload.tanggal || updatePayload.tanggalRealisasi || '';

    if (updatePayload.fotoSebelumUrl && isBase64Image(updatePayload.fotoSebelumUrl)) {
      updatePayload.fotoSebelumUrl = await ensureGoogleDrivePhotoUrl(updatePayload.fotoSebelumUrl, {
        nomorWO: updatePayload.nomorWO,
        reguName: updatePayload.reguName || 'ROW',
        photoType: 'Realisasi_Sebelum',
      });
    }
    if (updatePayload.fotoSesudahUrl && isBase64Image(updatePayload.fotoSesudahUrl)) {
      updatePayload.fotoSesudahUrl = await ensureGoogleDrivePhotoUrl(updatePayload.fotoSesudahUrl, {
        nomorWO: updatePayload.nomorWO,
        reguName: updatePayload.reguName || 'ROW',
        photoType: 'Realisasi_Sesudah',
      });
    }

    // 1. UPDATE to Supabase Database
    const res = await SupabaseService.updateRealisasiAdmin(id, updatePayload);

    if (!res.success) {
      showToast(res.error || 'Data Realisasi gagal diperbarui di Supabase.', 'error');
      return { success: false, error: res.error };
    }

    // 2. Direct Local State Update
    setRealisasiList((prev) =>
      prev.map((rel) =>
        rel.id === id || rel.syncId === id
          ? {
              ...rel,
              ...updatePayload,
              tanggalRealisasi: finalTanggal || rel.tanggalRealisasi,
              latitude: updatePayload.latitude !== undefined ? updatePayload.latitude : rel.latitude,
              longitude: updatePayload.longitude !== undefined ? updatePayload.longitude : rel.longitude,
            }
          : rel
      )
    );

    // 3. Direct Local Dexie Database Update by ID
    try {
      const dexieUpdates: Record<string, any> = {
        ...updatePayload,
        updatedAt: getLocalDateTimeString(),
      };
      if (finalTanggal) {
        dexieUpdates.tanggalRealisasi = finalTanggal;
      }

      await dexieDb.realisasi
        .where('id')
        .equals(id)
        .or('localId')
        .equals(id)
        .or('serverId')
        .equals(id)
        .modify(dexieUpdates);
    } catch (err) {
      console.warn('Update Dexie Realisasi Admin error:', err);
    }

    showToast('Data Realisasi berhasil diperbarui.', 'success');
    return { success: true };
  }, [setRealisasiList, showToast]);

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
    <RealisasiContext.Provider value={{ realisasiList, setRealisasiList, addRealisasi, addManualRealisasiAdmin, updateRealisasi, updateRealisasiAdmin, deleteRealisasi, refreshRealisasi }}>
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
