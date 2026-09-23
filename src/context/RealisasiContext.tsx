import * as React from 'react';
import { Realisasi } from '../types';
import { INITIAL_REALISASI } from '../data/initialData';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';
import { ApiService, FetchRealisasiParams, PaginationMeta } from '../services/apiService';
import { InisiasiService } from '../services/inisiasiService';
import { GASApiService } from '../services/gasApiService';
import { dexieDb, LocalRealisasi, LocalPhoto } from '../services/dexieDb';
import { offlineSyncQueue } from '../services/offlineSyncQueue';
import { getLocalDateTimeString, getWIBDateString } from '../utils/dateUtils';
import { ensureGoogleDrivePhotoUrl, isBase64Image } from '../utils/driveUtils';
import { auditRealisasiMutation } from '../utils/integrityLogger';

export interface RealisasiContextType {
  realisasiList: Realisasi[];
  setRealisasiList: React.Dispatch<React.SetStateAction<Realisasi[]>>;

  // Dataset khusus Dashboard:
  // mengambil seluruh data REALISASI dari HyperCloud,
  // tidak terbatas pada pagination History.
  dashboardRealisasiList: Realisasi[];
  fetchDashboardRealisasi: () => Promise<void>;

  pagination: PaginationMeta;
  isLoading: boolean;
  error: string | null;

  fetchRealisasiFromApi: (
    params?: FetchRealisasiParams
  ) => Promise<void>;

  addRealisasi: (
    rel: Omit<Realisasi, 'id' | 'createdAt'>
  ) => Promise<Realisasi>;

  addManualRealisasiAdmin: (
    relData: Partial<Realisasi> & {
      unitId: string;
      tanggalRealisasi: string;
      latitude: number;
      longitude: number;
      [key: string]: any;
    }
  ) => Promise<{
    success: boolean;
    data?: Realisasi;
    error?: string;
  }>;

  updateRealisasi: (
    id: string,
    updates: Partial<Realisasi>
  ) => void;

  updateRealisasiAdmin: (
    id: string,
    arg2:
      | string
      | (Partial<Realisasi> & {
          tanggal?: string;
          latitude?: number;
          longitude?: number;
          [key: string]: any;
        }),
    arg3?: number,
    arg4?: number
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;

  deleteRealisasi: (id: string) => void;

  refreshRealisasi: (
    force?: boolean
  ) => Promise<void>;
}

const RealisasiContext =
  React.createContext<RealisasiContextType | undefined>(undefined);

export function RealisasiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { showToast } = useToast();

  const activeUnitId = user?.unitId || InisiasiService.getSelectedUnitId() || 'UL2';

  const [realisasiList, setRealisasiList] = React.useState<Realisasi[]>([]);

  // ============================================================
  // DATA KHUSUS DASHBOARD
  // ============================================================
  const [dashboardRealisasiList, setDashboardRealisasiList] = React.useState<Realisasi[]>([]);

  const [
    pagination,
    setPagination,
  ] = React.useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [isLoading, setIsLoading] =
    React.useState<boolean>(false);

  const [error, setError] =
    React.useState<string | null>(null);

  const lastFetchParams =
    React.useRef<FetchRealisasiParams>({
      page: 1,
      limit: 20,
    });

  const lastFetchTime =
    React.useRef(0);

  // ============================================================
  // LOCAL DATA → UI
  // ============================================================

  const mapLocalToUI = (
    allLocal: LocalRealisasi[]
  ): Realisasi[] => {
    return allLocal
      .map((loc) => ({
        id:
          loc.serverId ||
          loc.localId ||
          loc.id,

        unitId:
          (loc as any).unitId ||
          loc.ulpName ||
          '',

        workOrderId:
          loc.workOrderId || '',

        nomorWO:
          loc.nomorWO,

        ulpName:
          loc.ulpName,

        reguName:
          loc.reguName,

        penyulangName:
          loc.penyulangName,

        noTiang:
          loc.noTiang,

        tanggalRealisasi:
          loc.tanggalRealisasi,

        petugasId:
          loc.petugasId,

        petugasName:
          loc.petugasName,

        jenisTanaman:
          loc.jenisTanaman,

        pertumbuhanTanaman:
          loc.pertumbuhanTanaman,

        kendala:
          loc.kendala,

        lokasiKerja:
          loc.lokasiKerja,

        latitude:
          loc.latitude,

        longitude:
          loc.longitude,

        keterangan:
          loc.keterangan,

        progressPercent:
          loc.progressPercent || 100,

        status:
          loc.status || 'Selesai',

        photosSebelum:
          loc.photosSebelum || [],

        photosSesudah:
          loc.photosSesudah || [],

        fotoSebelumUrl:
          loc.fotoSebelumUrl,

        fotoSesudahUrl:
          loc.fotoSesudahUrl,

        createdAt:
          loc.createdAt,

        isSynced:
          loc.syncStatus === 'SYNCED',

        syncId:
          loc.idempotencyKey,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
  };

  // ============================================================
  // HISTORY / PAGINATION
  // ============================================================

  const fetchRealisasiFromApi =
    React.useCallback(
      async (
        params: FetchRealisasiParams = {}
      ) => {
        if (!user || !user.unitId) {
          console.log('[RealisasiContext] Skipping fetchRealisasiFromApi: User not authenticated.');
          return;
        }

        const token = ApiService.getAuthToken();
        if (!token) {
          console.log('[RealisasiContext] Skipping fetchRealisasiFromApi: Token missing.');
          return;
        }

        setIsLoading(true);
        setError(null);

        const unitId = user.unitId ? InisiasiService.getStandardUnitId(user.unitId) : InisiasiService.getSelectedUnitId();

        const newParams = {
          unitId,
          ...lastFetchParams.current,
          ...params,
        };

        lastFetchParams.current =
          newParams;

          try {
            const res = await ApiService.fetchRealisasi(newParams);

            if (res.status === 'success' || res.data) {
              const list = Array.isArray(res.data) ? res.data : [];
              setRealisasiList(list);

              if (res.pagination) {
                setPagination(res.pagination);
              }
              console.log(`[DB SOURCE] entity=REALISASI source=HYPERCLOUD unitId=${unitId} count=${list.length}`);
            } else {
              setError(res.message || 'Gagal mengambil data Realisasi');
              console.warn(`[DB SOURCE] entity=REALISASI source=AUTH_OR_API_ERROR unitId=${unitId}`);
            }
          } catch (err: any) {
          console.warn(
            '[DATABASE REALISASI FETCH WARNING]',
            err?.message || err
          );

          setError(
            err?.message ||
              'Gagal terhubung ke Database Realisasi'
          );

          const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
          if (!isOnline) {
            try {
              const localRecords =
                await dexieDb.realisasi.toArray();

              if (
                localRecords.length > 0
              ) {
                console.log(`[DB SOURCE] entity=REALISASI source=OFFLINE_DEXIE count=${localRecords.length}`);
                setRealisasiList(
                  mapLocalToUI(
                    localRecords
                  )
                );
              }
            } catch (dexErr) {
              console.warn(
                'Dexie fallback failed:',
                dexErr
              );
            }
          }
        } finally {
          setIsLoading(false);
        }
      },
      [setRealisasiList]
    );

  // ============================================================
  // DASHBOARD REALISASI
  // ============================================================
  // Mengambil seluruh data REALISASI dari HyperCloud.
  // Tidak menggunakan pagination History.
  const fetchDashboardRealisasi =
    React.useCallback(
      async () => {
        try {
          const res =
            await ApiService.fetchRealisasiDashboard();

          if (
            res.status === 'success' &&
            Array.isArray(res.data)
          ) {
            setDashboardRealisasiList(
              res.data
            );

            console.log(
              '[DASHBOARD REALISASI] Loaded from HyperCloud:',
              res.data.length
            );
          } else {
            console.warn(
              '[DASHBOARD REALISASI] Response tidak valid:',
              res
            );
          }
        } catch (err: any) {
          console.warn(
            '[DASHBOARD REALISASI] Gagal mengambil data:',
            err?.message || err
          );
        }
      },
      []
    );

  // ============================================================
  // REFRESH REALISASI
  // ============================================================

  const refreshRealisasi =
    React.useCallback(
      async (
        force: boolean = false
      ) => {
        const now =
          Date.now();

        if (
          !force &&
          now -
            lastFetchTime.current <
            2000
        ) {
          return;
        }

        lastFetchTime.current =
          now;

        await fetchRealisasiFromApi(
          lastFetchParams.current
        );
      },
      [fetchRealisasiFromApi]
    );

  // ============================================================
  // OFFLINE SYNC
  // ============================================================

  React.useEffect(() => {
    const unsubscribe =
      offlineSyncQueue.subscribe(
        (evt) => {
          if (
            evt.status ===
            'COMPLETED'
          ) {
            refreshRealisasi(
              true
            );

            // Refresh dataset Dashboard
            // setelah sinkronisasi selesai.
            fetchDashboardRealisasi();
          }
        }
      );

    return () =>
      unsubscribe();
  }, [
    refreshRealisasi,
    fetchDashboardRealisasi,
  ]);

  // ============================================================
  // ADD REALISASI
  // ============================================================

  const addRealisasi =
    React.useCallback(
      async (
        relData: Omit<
          Realisasi,
          | 'id'
          | 'createdAt'
          | 'isSynced'
          | 'syncId'
        >
      ) => {
        const timestamp =
          getLocalDateTimeString();

        const idempotencyKey =
          `REL-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`;

        const localId =
          idempotencyKey;

        const localPhotos: LocalPhoto[] =
          [];

        if (
          relData.photosSebelum &&
          Array.isArray(
            relData.photosSebelum
          )
        ) {
          relData.photosSebelum.forEach(
            (p, idx) => {
              localPhotos.push({
                id:
                  p.id ||
                  `photo-seb-${localId}-${idx + 1}`,

                realisasiId:
                  localId,

                woId:
                  relData.workOrderId ||
                  '',

                type:
                  'sebelum',

                slotIndex:
                  (idx + 1) as any,

                dataUrl:
                  p.dataUrl || '',

                fileUrl:
                  p.fileUrl,

                originalName:
                  p.originalName ||
                  `Foto_Sebelum_${idx + 1}.jpg`,

                timestamp:
                  p.timestamp ||
                  timestamp,

                latitude:
                  p.latitude ||
                  relData.latitude ||
                  0,

                longitude:
                  p.longitude ||
                  relData.longitude ||
                  0,

                userName:
                  p.userName ||
                  relData.petugasName ||
                  '',

                ulpName:
                  p.ulpName ||
                  relData.ulpName ||
                  '',

                syncStatus:
                  'PENDING',

                createdAt:
                  timestamp,
              });
            }
          );
        }

        if (
          relData.photosSesudah &&
          Array.isArray(
            relData.photosSesudah
          )
        ) {
          relData.photosSesudah.forEach(
            (p, idx) => {
              localPhotos.push({
                id:
                  p.id ||
                  `photo-ses-${localId}-${idx + 1}`,

                realisasiId:
                  localId,

                woId:
                  relData.workOrderId ||
                  '',

                type:
                  'sesudah',

                slotIndex:
                  (idx + 1) as any,

                dataUrl:
                  p.dataUrl || '',

                fileUrl:
                  p.fileUrl,

                originalName:
                  p.originalName ||
                  `Foto_Sesudah_${idx + 1}.jpg`,

                timestamp:
                  p.timestamp ||
                  timestamp,

                latitude:
                  p.latitude ||
                  relData.latitude ||
                  0,

                longitude:
                  p.longitude ||
                  relData.longitude ||
                  0,

                userName:
                  p.userName ||
                  relData.petugasName ||
                  '',

                ulpName:
                  p.ulpName ||
                  relData.ulpName ||
                  '',

                syncStatus:
                  'PENDING',

                createdAt:
                  timestamp,
              });
            }
          );
        }

        const targetUnitId =
          relData.unitId ||
          InisiasiService.getSelectedUnitId() || 'UL2';

        const localRecord: LocalRealisasi =
          {
            ...relData,

            unitId:
              targetUnitId,

            localId,

            idempotencyKey,

            syncStatus:
              'PENDING',

            updatedAt:
              timestamp,

            createdAt:
              timestamp,

            id:
              localId,

            progressPercent:
              100,

            status:
              'Selesai',
          };

        const newRelUI: Realisasi =
          {
            ...relData,

            unitId:
              targetUnitId,

            id:
              localId,

            createdAt:
              timestamp,

            syncId:
              idempotencyKey,

            isSynced:
              false,
          };

        // 1. ONLINE-FIRST logic
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const saveRes = await ApiService.saveRealisasi(newRelUI);

            if (saveRes && saveRes.success) {
              // 1.1 Persist local copy in Dexie with SYNCED status (so offline view is ready without queuing)
              try {
                await dexieDb.realisasi.put({
                  ...localRecord,
                  syncStatus: 'SYNCED',
                  serverId: saveRes.serverId || localId,
                  updatedAt: timestamp,
                });
                for (const p of localPhotos) {
                  await dexieDb.photos.put({
                    ...p,
                    syncStatus: 'SYNCED',
                  });
                }
                await dexieDb.sync_queue.delete(idempotencyKey);
              } catch (e) {
                console.warn('[RealisasiContext] Dexie cache save error:', e);
              }

              console.log(`[DATA FLOW]\nmode=ONLINE\nentity=REALISASI\naction=CREATE\nsource=HYPERCLOUD\nunitId=${newRelUI.unitId || activeUnitId}\nstatus=SUCCESS\nid=${saveRes.serverId || localId}`);
              showToast('✓ Data Realisasi berhasil disimpan ke HyperCloud.', 'success');
              
              // Immediate UI update
              setRealisasiList((prev) => [newRelUI, ...prev]);

              await refreshRealisasi(true);
              await fetchDashboardRealisasi();
              return newRelUI;
            } else {
              console.warn('[RealisasiContext] API save returned error, falling back to offline queue:', saveRes?.message);
            }
          } catch (directErr) {
            console.warn('[RealisasiContext] Direct save exception:', directErr);
          }
        }

        // 2. OFFLINE FALLBACK (Offline or API failed)
        console.log(`[DATA FLOW]\nmode=OFFLINE\nentity=REALISASI\naction=CREATE\nsource=DEXIE\nstatus=QUEUED\nid=${localId}`);
        setRealisasiList((prev) => [newRelUI, ...prev]);
        await offlineSyncQueue.enqueueRealisasi(localRecord, localPhotos);
        
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          showToast('⚠ Tidak ada koneksi Internet. Data tersimpan sementara di perangkat dan akan disinkronkan saat koneksi tersedia.', 'info');
        } else {
          showToast('⚠ HyperCloud tidak dapat dihubungi. Data disimpan sementara dan menunggu sinkronisasi.', 'warning');
        }
        return newRelUI;
      },
      [
        setRealisasiList,
        showToast,
        fetchRealisasiFromApi,
        fetchDashboardRealisasi,
        refreshRealisasi,
      ]
    );

  // ============================================================
  // UPDATE REALISASI
  // ============================================================

  const updateRealisasi =
    React.useCallback(
      async (
        id: string,
        updates: Partial<Realisasi>
      ) => {
        const existing =
          realisasiList.find(
            (r) =>
              r.id === id ||
              r.syncId === id
          );

        if (!existing) return;

        const updatedRel = {
          ...existing,
          ...updates,
          updatedAt: getLocalDateTimeString(),
        };

        setRealisasiList(
          (prev) =>
            prev.map(
              (rel) =>
                rel.id === id ||
                rel.syncId === id
                  ? updatedRel
                  : rel
            )
        );

        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

        if (isOnline) {
          try {
            const apiRes = await ApiService.updateRealisasi(id, updatedRel);
            if (apiRes && apiRes.success) {
              await dexieDb.realisasi.update(id, {
                ...updates,
                syncStatus: 'SYNCED',
                updatedAt: getLocalDateTimeString(),
              }).catch(() => {});
              showToast('✓ Realisasi berhasil diperbarui di HyperCloud', 'success');
              return;
            }
          } catch (e) {
            console.warn('[RealisasiContext] Online update failed:', e);
          }
        }

        // Offline or API error fallback
        try {
          await dexieDb.realisasi.update(
            id,
            {
              ...updates,
              syncStatus: 'PENDING',
              updatedAt: getLocalDateTimeString(),
            }
          );

          if (!isOnline) {
            showToast('⚠ Tidak ada koneksi Internet. Perubahan disimpan di perangkat.', 'info');
          } else {
            showToast('⚠ Server tidak dapat dihubungi. Perubahan disimpan di antrean lokal.', 'warning');
          }
        } catch (err) {
          console.warn('Update Dexie Realisasi error:', err);
        }
      },
      [
        realisasiList,
        setRealisasiList,
        showToast,
      ]
    );

  // ============================================================
  // ADD MANUAL REALISASI ADMIN
  // ============================================================

  const addManualRealisasiAdmin =
    React.useCallback(
      async (
        relData: Partial<Realisasi> & {
          unitId: string;
          tanggalRealisasi: string;
          latitude: number;
          longitude: number;
          [key: string]: any;
        }
      ): Promise<{
        success: boolean;
        data?: Realisasi;
        error?: string;
      }> => {
        const timestamp =
          getLocalDateTimeString();

        const targetId =
          relData.id?.trim() ||
          `REL-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 7)}`;

        const targetUnitId =
          relData.unitId ||
          InisiasiService.getSelectedUnitId() || 'UL2';

        const fotoSebDrive =
          await ensureGoogleDrivePhotoUrl(
            relData.fotoSebelumUrl ||
              relData.photosSebelum?.[0]
                ?.dataUrl,
            {
              nomorWO:
                relData.nomorWO,

              reguName:
                relData.reguName ||
                'ROW',

              photoType:
                'Realisasi_Sebelum',
            }
          );

        const fotoSesDrive =
          await ensureGoogleDrivePhotoUrl(
            relData.fotoSesudahUrl ||
              relData.photosSesudah?.[0]
                ?.dataUrl,
            {
              nomorWO:
                relData.nomorWO,

              reguName:
                relData.reguName ||
                'ROW',

              photoType:
                'Realisasi_Sesudah',
            }
          );

        const fullRealisasi: Realisasi =
          {
            id:
              targetId,

            unitId:
              targetUnitId,

            workOrderId:
              (
                relData.workOrderId ||
                relData.nomorWO ||
                ''
              ).trim(),

            nomorWO:
              (
                relData.nomorWO ||
                ''
              ).trim(),

            ulpName:
              (
                relData.ulpName ||
                ''
              ).trim(),

            reguName:
              (
                relData.reguName ||
                ''
              ).trim(),

            penyulangName:
              (
                relData.penyulangName ||
                ''
              ).trim(),

            noTiang:
              (
                relData.noTiang ||
                ''
              ).trim(),

            tanggalRealisasi:
              (
                relData.tanggalRealisasi ||
                getWIBDateString()
              ).trim(),

            petugasId:
              (
                relData.petugasId ||
                user?.userName ||
                'Admin'
              ).trim(),

            petugasName:
              (
                relData.petugasName ||
                user?.name ||
                'Admin'
              ).trim(),

            jenisTanaman:
              (
                relData.jenisTanaman ||
                'Kelapa Sawit'
              ).trim(),

            keterangan:
              (
                relData.keterangan ||
                'TEBANG'
              ).trim(),

            pertumbuhanTanaman:
              (
                relData.pertumbuhanTanaman ||
                'CEPAT'
              ).trim(),

            kendala:
              (
                relData.kendala ||
                'Tidak Ada Kendala'
              ).trim(),

            lokasiKerja:
              (
                relData.lokasiKerja ||
                ''
              ).trim(),

            latitude:
              Number(
                relData.latitude ||
                  0
              ),

            longitude:
              Number(
                relData.longitude ||
                  0
              ),

            progressPercent:
              100,

            status:
              'Selesai',

            photosSebelum:
              relData.photosSebelum ||
              [],

            photosSesudah:
              relData.photosSesudah ||
              [],

            fotoSebelumUrl:
              fotoSebDrive ||
              (
                isBase64Image(
                  relData.fotoSebelumUrl
                )
                  ? ''
                  : relData.fotoSebelumUrl ||
                    ''
              ),

            fotoSesudahUrl:
              fotoSesDrive ||
              (
                isBase64Image(
                  relData.fotoSesudahUrl
                )
                  ? ''
                  : relData.fotoSesudahUrl ||
                    ''
              ),

            createdAt:
              relData.createdAt ||
              timestamp,

            isSynced:
              true,

            syncId:
              targetId,
          };

        const saveRes =
          await ApiService.saveRealisasi(
            fullRealisasi
          );

        if (!saveRes.success) {
          showToast(
            saveRes.message ||
              'Gagal menyimpan Realisasi Manual ke Database HyperCloud.',
            'error'
          );

          return {
            success: false,
            error:
              saveRes.message,
          };
        }

        const savedRecord = {
          ...fullRealisasi,
          ...(saveRes.serverId ? { id: saveRes.serverId, syncId: saveRes.serverId } : {}),
        };

        setRealisasiList(
          (prev) => [
            savedRecord,
            ...prev.filter(
              (item) =>
                item.id !==
                savedRecord.id
            ),
          ]
        );

        try {
          const localDexieRow:
            LocalRealisasi = {
              ...savedRecord,

              localId:
                savedRecord.id,

              idempotencyKey:
                targetId,

              syncStatus:
                'SYNCED',

              updatedAt:
                timestamp,
            };

          await dexieDb.realisasi.put(
            localDexieRow
          );
        } catch (dexieErr) {
          console.warn(
            'Manual Realisasi Dexie save warning:',
            dexieErr
          );
        }

        auditRealisasiMutation(
          null,
          savedRecord,
          'addManualRealisasiAdmin',
          `Input manual oleh Admin untuk Unit ${targetUnitId}, WO: ${savedRecord.nomorWO}, Tanggal: ${savedRecord.tanggalRealisasi}`
        );

        showToast(
          'Data Realisasi Manual berhasil disimpan ke Database.',
          'success'
        );

        await fetchRealisasiFromApi(
          lastFetchParams.current
        );

        await fetchDashboardRealisasi();

        return {
          success: true,
          data: savedRecord,
        };
      },
      [
        user,
        setRealisasiList,
        showToast,
        fetchRealisasiFromApi,
        fetchDashboardRealisasi,
      ]
    );

  // ============================================================
  // UPDATE REALISASI ADMIN
  // ============================================================

  const updateRealisasiAdmin =
    React.useCallback(
      async (
        id: string,
        arg2:
          | string
          | (Partial<Realisasi> & {
              tanggal?: string;
              latitude?: number;
              longitude?: number;
            }),
        arg3?: number,
        arg4?: number
      ): Promise<{
        success: boolean;
        error?: string;
      }> => {
        let updatePayload:
          | Partial<Realisasi> & {
              tanggal?: string;
              latitude?: number;
              longitude?: number;
            };

        if (
          typeof arg2 ===
            'object' &&
          arg2 !== null
        ) {
          updatePayload = {
            ...arg2,
          };
        } else {
          updatePayload = {
            tanggal:
              String(
                arg2 || ''
              ),

            tanggalRealisasi:
              String(
                arg2 || ''
              ),

            latitude:
              Number(
                arg3 || 0
              ),

            longitude:
              Number(
                arg4 || 0
              ),
          };
        }

        const finalTanggal =
          updatePayload.tanggal ||
          updatePayload.tanggalRealisasi ||
          '';

        if (
          updatePayload.fotoSebelumUrl &&
          isBase64Image(
            updatePayload.fotoSebelumUrl
          )
        ) {
          updatePayload.fotoSebelumUrl =
            await ensureGoogleDrivePhotoUrl(
              updatePayload.fotoSebelumUrl,
              {
                nomorWO:
                  updatePayload.nomorWO,

                reguName:
                  updatePayload.reguName ||
                  'ROW',

                photoType:
                  'Realisasi_Sebelum',
              }
            );
        }

        if (
          updatePayload.fotoSesudahUrl &&
          isBase64Image(
            updatePayload.fotoSesudahUrl
          )
        ) {
          updatePayload.fotoSesudahUrl =
            await ensureGoogleDrivePhotoUrl(
              updatePayload.fotoSesudahUrl,
              {
                nomorWO:
                  updatePayload.nomorWO,

                reguName:
                  updatePayload.reguName ||
                  'ROW',

                photoType:
                  'Realisasi_Sesudah',
              }
            );
        }

        const res =
          await ApiService.updateRealisasi(
            id,
            updatePayload
          );

        if (!res.success) {
          showToast(
            res.message ||
              'Data Realisasi gagal diperbarui di HyperCloud.',
            'error'
          );

          return {
            success: false,
            error:
              res.message,
          };
        }

        setRealisasiList(
          (prev) =>
            prev.map(
              (rel) =>
                rel.id === id ||
                rel.syncId === id
                  ? {
                      ...rel,
                      ...updatePayload,

                      tanggalRealisasi:
                        finalTanggal ||
                        rel.tanggalRealisasi,

                      latitude:
                        updatePayload.latitude !==
                        undefined
                          ? updatePayload.latitude
                          : rel.latitude,

                      longitude:
                        updatePayload.longitude !==
                        undefined
                          ? updatePayload.longitude
                          : rel.longitude,
                    }
                  : rel
            )
        );

        try {
          const dexieUpdates:
            Record<string, any> = {
              ...updatePayload,
              updatedAt:
                getLocalDateTimeString(),
            };

          if (finalTanggal) {
            dexieUpdates.tanggalRealisasi =
              finalTanggal;
          }

          await dexieDb.realisasi
            .where('id')
            .equals(id)
            .or('localId')
            .equals(id)
            .or('serverId')
            .equals(id)
            .modify(
              dexieUpdates
            );
        } catch (err) {
          console.warn(
            'Update Dexie Realisasi Admin error:',
            err
          );
        }

        showToast(
          'Data Realisasi berhasil diperbarui.',
          'success'
        );

        await fetchRealisasiFromApi(
          lastFetchParams.current
        );

        await fetchDashboardRealisasi();

        return {
          success: true,
        };
      },
      [
        setRealisasiList,
        showToast,
        fetchRealisasiFromApi,
        fetchDashboardRealisasi,
      ]
    );

  // ============================================================
  // DELETE REALISASI
  // ============================================================

  const deleteRealisasi =
    React.useCallback(
      async (id: string) => {
        setRealisasiList(
          (prev) =>
            prev.filter(
              (rel) =>
                rel.id !== id &&
                rel.syncId !== id
            )
        );

        try {
          await dexieDb.realisasi
            .where('id')
            .equals(id)
            .or('localId')
            .equals(id)
            .or('serverId')
            .equals(id)
            .or('idempotencyKey')
            .equals(id)
            .delete();

          await dexieDb.realisasi.delete(
            id
          );

          await dexieDb.photos
            .where('realisasiId')
            .equals(id)
            .delete();
        } catch (e) {
          console.warn(
            'Delete Dexie Realisasi error:',
            e
          );
        }

        if (
          typeof navigator !==
            'undefined' &&
          navigator.onLine
        ) {
          try {
            const res =
              await ApiService.deleteRealisasi(
                id
              );

            if (res.success) {
              showToast(
                'Data realisasi berhasil dihapus permanen dari Database',
                'success'
              );
            } else {
              showToast(
                'Realisasi dihapus di perangkat (Server: ' +
                  (res.message ||
                    'Pending') +
                ')',
                'info'
              );
            }

            await fetchRealisasiFromApi(
              lastFetchParams.current
            );

            await fetchDashboardRealisasi();
          } catch (err) {
            console.warn(
              'Delete HyperCloud Realisasi error:',
              err
            );

            showToast(
              'Data realisasi dihapus dari perangkat',
              'info'
            );
          }
        } else {
          try {
            await offlineSyncQueue.enqueueDeleteRealisasi(
              id
            );
          } catch (e) {
            console.warn(
              'Enqueue delete error:',
              e
            );
          }

          showToast(
            'Realisasi dihapus dari perangkat (Akan disinkron ke database saat online)',
            'info'
          );
        }
      },
      [
        setRealisasiList,
        showToast,
        settings.gasWebAppUrl,
        settings.spreadsheetId,
        fetchRealisasiFromApi,
        fetchDashboardRealisasi,
      ]
    );

  // ============================================================
  // PROVIDER
  // ============================================================

  return (
    <RealisasiContext.Provider
      value={{
        realisasiList,
        setRealisasiList,

        dashboardRealisasiList,
        fetchDashboardRealisasi,

        pagination,
        isLoading,
        error,

        fetchRealisasiFromApi,
        addRealisasi,
        addManualRealisasiAdmin,
        updateRealisasi,
        updateRealisasiAdmin,
        deleteRealisasi,
        refreshRealisasi,
      }}
    >
      {children}
    </RealisasiContext.Provider>
  );
}

export function useRealisasi() {
  const context =
    React.useContext(
      RealisasiContext
    );

  if (
    context === undefined
  ) {
    throw new Error(
      'useRealisasi must be used within a RealisasiProvider'
    );
  }

  return context;
}

