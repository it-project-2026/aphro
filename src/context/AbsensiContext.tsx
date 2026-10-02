import * as React from 'react';
import { Absensi } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';
import { ApiService } from '../services/apiService';
import { InisiasiService } from '../services/inisiasiService';
import { syncManager } from '../services/syncManager';
import { idbService } from '../services/indexedDbService';
import { resolveUserTimRowAndUlp } from '../services/rekapHarianService';
import {
  getLocalDateTimeString,
  getWIBDateString,
  normalizeDateISO,
} from '../utils/dateUtils';

interface AbsensiContextType {
  absensiList: Absensi[];
  setAbsensiList: React.Dispatch<React.SetStateAction<Absensi[]>>;
  addAbsensi: (
    abs: Omit<Absensi, 'id' | 'createdAt'>
  ) => Promise<Absensi>;
  updateAbsensi: (
    id: string,
    absData: Partial<Absensi>
  ) => Promise<boolean>;
  deleteAbsensi: (id: string) => Promise<boolean>;
  refreshAbsensi: () => Promise<void>;
  hasCheckedInToday: boolean;
  sudahMasuk: boolean;
  sudahKeluar: boolean;
  todayAbsensiRecord: Absensi | null;
  isLoading: boolean;
  hasVerifiedWithServer: boolean;
}

const AbsensiContext =
  React.createContext<AbsensiContextType | undefined>(undefined);

export function AbsensiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();

  /*
   * USER.unitId adalah sumber unit yang sebenarnya.
   * Tidak menggunakan unitId dari form ABSENSI.
   */
  const activeUnitId =
    (user?.unitId ? InisiasiService.getStandardUnitId(user.unitId) : '') ||
    InisiasiService.getSelectedUnitId() ||
    'UL2';

  const [absensiList, setAbsensiList] =
    React.useState<Absensi[]>([]);

  const [hasVerifiedWithServer, setHasVerifiedWithServer] =
    React.useState(false);

  const [isLoading, setIsLoading] =
    React.useState<boolean>(() => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const storedUser = typeof localStorage !== 'undefined' ? (localStorage.getItem('pln_mobile_user') || localStorage.getItem('aphro_user')) : null;
      return Boolean(isOnline && storedUser);
    });

  /*
   * =========================================================
   * NORMALIZE DATE
   * =========================================================
   */
  const normalizeDate = React.useCallback(
    (value: unknown): string => {
      if (!value) return '';
      return normalizeDateISO(value);
    },
    []
  );

  /*
   * =========================================================
   * NORMALIZE TEXT
   * =========================================================
   */
  const normalizeText = React.useCallback(
    (value: unknown): string => {
      return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    },
    []
  );

  /*
   * =========================================================
   * REFRESH ABSENSI
   * =========================================================
   *
   * HyperCloud PostgreSQL adalah sumber data utama.
   */
  const refreshAbsensi = React.useCallback(async () => {
    if (!user || !user.unitId) {
      console.log('[AbsensiContext] Skipping refreshAbsensi: User not authenticated.');
      setIsLoading(false);
      setHasVerifiedWithServer(true);
      return;
    }

    const token = ApiService.getAuthToken();
    if (!token) {
      console.log('[AbsensiContext] Skipping refreshAbsensi: Token missing.');
      setIsLoading(false);
      setHasVerifiedWithServer(true);
      return;
    }

    const unitId = user.unitId ? InisiasiService.getStandardUnitId(user.unitId) : InisiasiService.getSelectedUnitId();

    console.log(
      `[ABSENSI TRACE] refreshAbsensi triggered. UnitId: ${unitId}`
    );

    try {
      setIsLoading(true);

      const res =
        await ApiService.fetchAbsensi(unitId);

      if (
        res.success &&
        Array.isArray(res.data)
      ) {
        console.log(
          `[ABSENSI TRACE] fetchAbsensi SUCCESS. Received ${res.data.length} records.`
        );

        const sortedData = [...res.data].sort(
          (a: any, b: any) => {
            const dateA = new Date(
              a.TANGGAL ||
                a.tanggal ||
                a.createdAt ||
                0
            ).getTime();

            const dateB = new Date(
              b.TANGGAL ||
                b.tanggal ||
                b.createdAt ||
                0
            ).getTime();

            return dateB - dateA;
          }
        );

        setAbsensiList(sortedData);
        // Persist fresh server state to IndexedDB cache so GASSyncProvider doesn't restore stale data
        idbService.saveTable('ABSENSI', sortedData).catch((e) => console.warn('Failed to cache ABSENSI to idb:', e));
      } else {
        console.warn(
          '[ABSENSI TRACE] fetchAbsensi FAILED:',
          res.message
        );
      }
    } catch (err) {
      console.error(
        '[ABSENSI TRACE] refreshAbsensi EXCEPTION:',
        err
      );
    } finally {
      setIsLoading(false);
      setHasVerifiedWithServer(true);
    }
  }, [user]);

  /*
   * =========================================================
   * INITIAL LOAD (IndexedDB Cache + Server Fetch)
   * =========================================================
   */
  React.useEffect(() => {
    let isMounted = true;
    async function loadCachedAbsensi() {
      try {
        const cached = await idbService.getTable<Absensi>('ABSENSI');
        if (cached && cached.length > 0 && isMounted) {
          console.log(`[AbsensiContext] Loaded ${cached.length} cached absensi from IndexedDB`);
          setAbsensiList((prev) => (prev.length === 0 ? cached : prev));
        }
      } catch (err) {
        console.warn('[AbsensiContext] Error loading cached absensi:', err);
      }
    }

    loadCachedAbsensi();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!user) {
      setAbsensiList([]);
      setIsLoading(false);
      setHasVerifiedWithServer(false);
      return;
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isOnline) {
      setIsLoading(true);
    }
    refreshAbsensi();
  }, [
    user,
    activeUnitId,
    refreshAbsensi,
  ]);

  /*
   * =========================================================
   * ADD ABSENSI
   * =========================================================
   */
  const addAbsensi = React.useCallback(
    async (
      absData: Omit<
        Absensi,
        'id' | 'createdAt'
      >
    ) => {
      console.log(
        '[ABSENSI TRACE 4] addAbsensi called.',
        {
          regu: absData.reguName,
          tanggal:
            absData.tanggal,
        }
      );

      const todayStr =
        absData.tanggal ||
        getWIBDateString();

      const nowStr =
        getLocalDateTimeString();

      const targetDate =
        normalizeDate(todayStr);

      /*
       * Cari absensi hari yang sama + regu yang sama.
       */
      const existingIndex =
        absensiList.findIndex(
          (a: any) => {
            const rowDate =
              normalizeDate(
                a.tanggal ||
                  a.TANGGAL
              );

            const rowRegu =
              normalizeText(
                a.reguName ||
                  a.NAMA_REGU
              );

            const targetRegu =
              normalizeText(
                absData.reguName
              );

            return (
              rowDate === targetDate &&
              rowRegu === targetRegu
            );
          }
        );

      let finalAbs: Absensi;

      /*
       * UPDATE ABSENSI YANG SUDAH ADA
       */
      if (existingIndex >= 0) {
        const existing =
          absensiList[
            existingIndex
          ];

        const isClockingOut =
          Boolean(
            absData.fotoKeluar
          );

        if (isClockingOut) {
          finalAbs = {
            ...existing,

            fotoKeluar:
              absData.fotoKeluar,

            timestampKeluar:
              absData.timestampKeluar ||
              nowStr,

            latitude:
              absData.latitude ??
              existing.latitude,

            longitude:
              absData.longitude ??
              existing.longitude,

            updatedAt:
              getLocalDateTimeString(),
          };
        } else {
          finalAbs = {
            ...existing,
            ...absData,

            fotoMasuk:
              absData.fotoMasuk ||
              existing.fotoMasuk,

            timestampMasuk:
              existing.timestampMasuk ||
              (absData.fotoMasuk
                ? nowStr
                : undefined),

            fotoKeluar:
              absData.fotoKeluar ||
              existing.fotoKeluar,

            timestampKeluar:
              absData.fotoKeluar
                ? absData.timestampKeluar ||
                  nowStr
                : existing.timestampKeluar,

            updatedAt:
              getLocalDateTimeString(),
          };
        }
      } else {
        /*
         * ABSENSI BARU
         */
        finalAbs = {
          unitId:
            absData.unitId ||
            activeUnitId,

          userName:
            absData.userName ||
            user?.userName ||
            user?.nip ||
            user?.id,

          namaPetugas:
            absData.namaPetugas ||
            user?.name ||
            user?.userName,

          nip:
            absData.nip ||
            user?.nip ||
            user?.id,

          ...absData,

          id:
            'ABS-' +
            Date.now(),

          timestampMasuk:
            absData.fotoMasuk
              ? nowStr
              : undefined,

          timestampKeluar:
            absData.fotoKeluar
              ? nowStr
              : undefined,

          createdAt:
            getLocalDateTimeString(),
        };
      }

      /*
       * =====================================================
       * ONLINE-FIRST
       * =====================================================
       */
      const isOnline =
        typeof navigator !== 'undefined'
          ? navigator.onLine
          : true;

      if (isOnline) {
        console.log(
          '[ABSENSI TRACE 4] ONLINE MODE. Saving to HyperCloud...'
        );

        try {
          const result =
            existingIndex >= 0
              ? await ApiService.updateAbsensi(
                  finalAbs.id,
                  finalAbs
                )
              : await ApiService.saveAbsensi(
                  finalAbs
                );

          if (result.success) {
            console.log(
              '[ABSENSI TRACE 4] API SUCCESS.',
              result
            );

            /*
             * Update UI langsung.
             */
            setAbsensiList(
              (prev) => {
                const next = [
                  ...prev,
                ];

                const index =
                  next.findIndex(
                    (item) =>
                      item.id ===
                      finalAbs.id
                  );

                if (index >= 0) {
                  next[index] =
                    finalAbs;
                } else {
                  next.unshift(
                    finalAbs
                  );
                }

                return next;
              }
            );

            showToast(
              'Absensi berhasil tersimpan ke Database HyperCloud!',
              'success'
            );

            /*
             * PENTING:
             * Ambil ulang dari HyperCloud.
             * Database menjadi sumber kebenaran.
             */
            console.log(
              '[ABSENSI TRACE 4] Refreshing from HyperCloud...'
            );

            await refreshAbsensi();

            console.log(
              '[ABSENSI TRACE 4] Refresh completed.'
            );

            return finalAbs;
          }

          console.error(
            '[ABSENSI TRACE 4] API FAILED:',
            result.message
          );

          showToast(
            `Gagal menyimpan ke server: ${
              result.message ||
              'Unknown error'
            }`,
            'error'
          );

          return finalAbs;
        } catch (err) {
          console.error(
            '[ABSENSI TRACE 4] API Exception:',
            err
          );
        }
      }

      /*
       * =====================================================
       * OFFLINE FALLBACK
       * =====================================================
       */
      try {
        await syncManager.executeMutation({
          type:
            existingIndex >= 0
              ? 'UPDATE'
              : 'CREATE',

          tableName:
            'ABSENSI',

          payload:
            finalAbs,

          apiCall:
            async () => {
              const result =
                existingIndex >= 0
                  ? await ApiService.updateAbsensi(
                      finalAbs.id,
                      finalAbs
                    )
                  : await ApiService.saveAbsensi(
                      finalAbs
                    );

              return {
                status:
                  result.success
                    ? 'success'
                    : 'error',

                message:
                  result.message,
              };
            },
        });

        setAbsensiList(
          (prev) => {
            const next = [
              ...prev,
            ];

            const index =
              next.findIndex(
                (item) =>
                  item.id ===
                  finalAbs.id
              );

            if (index >= 0) {
              next[index] =
                finalAbs;
            } else {
              next.unshift(
                finalAbs
              );
            }

            return next;
          }
        );

        showToast(
          'Koneksi terganggu. Absensi disimpan di antrean offline.',
          'info'
        );
      } catch (err) {
        console.error(
          '[ABSENSI TRACE] Offline sync error:',
          err
        );

        showToast(
          'Gagal sinkronisasi absensi.',
          'error'
        );
      }

      return finalAbs;
    },
    [
      absensiList,
      activeUnitId,
      normalizeDate,
      normalizeText,
      refreshAbsensi,
      showToast,
    ]
  );

  /*
   * =========================================================
   * UPDATE ABSENSI
   * =========================================================
   */
  const updateAbsensi =
    React.useCallback(
      async (
        id: string,
        absData: Partial<Absensi>
      ) => {
        const existingIndex =
          absensiList.findIndex(
            (a) => a.id === id
          );

        if (
          existingIndex === -1
        ) {
          return false;
        }

        const currentRecord = absensiList[existingIndex] as any;
        const updatedAbs = {
          ...currentRecord,
          ...absData,
          updatedAt:
            getLocalDateTimeString(),
        };

        // If petugasList is being updated, clean out root PETUGAS_i/KET_i so they don't override the edited petugasList
        if (Array.isArray(absData.petugasList) && absData.petugasList.length > 0) {
          for (let i = 1; i <= 20; i++) {
            delete (updatedAbs as any)[`PETUGAS_${i}`];
            delete (updatedAbs as any)[`KET_${i}`];
            delete (updatedAbs as any)[`Petugas_${i}`];
            delete (updatedAbs as any)[`Ket_${i}`];
          }
        }

        const isOnline =
          typeof navigator !==
          'undefined'
            ? navigator.onLine
            : true;

        if (isOnline) {
          try {
            const result =
              await ApiService.updateAbsensi(
                id,
                updatedAbs
              );

            if (result.success) {
              setAbsensiList(
                (prev) => {
                  const next = [
                    ...prev,
                  ];

                  const index =
                    next.findIndex(
                      (item) =>
                        item.id ===
                        id
                    );

                  if (index >= 0) {
                    next[index] =
                      updatedAbs;
                  }

                  return next;
                }
              );

              await refreshAbsensi();

              showToast(
                'Perubahan absensi tersimpan ke Database.',
                'success'
              );

              return true;
            }

            showToast(
              `Gagal menyimpan: ${
                result.message ||
                'Unknown error'
              }`,
              'error'
            );

            return false;
          } catch (err) {
            console.error(
              '[ABSENSI TRACE] update exception:',
              err
            );
          }
        }

        /*
         * Offline fallback
         */
        try {
          await syncManager.executeMutation({
            type: 'UPDATE',
            tableName: 'ABSENSI',
            payload: updatedAbs,

            apiCall:
              async () => {
                const result =
                  await ApiService.updateAbsensi(
                    id,
                    updatedAbs
                  );

                return {
                  status:
                    result.success
                      ? 'success'
                      : 'error',

                  message:
                    result.message,
                };
              },
          });

          setAbsensiList(
            (prev) => {
              const next = [
                ...prev,
              ];

              const index =
                next.findIndex(
                  (item) =>
                    item.id === id
                );

              if (index >= 0) {
                next[index] =
                  updatedAbs;
              }

              return next;
            }
          );

          showToast(
            'Perubahan tersimpan di antrean offline.',
            'info'
          );

          return true;
        } catch (err) {
          console.error(
            '[ABSENSI TRACE] update offline error:',
            err
          );

          showToast(
            'Perubahan gagal disimpan.',
            'error'
          );

          return false;
        }
      },
      [
        absensiList,
        refreshAbsensi,
        showToast,
      ]
    );

  /*
   * =========================================================
   * DELETE ABSENSI
   * =========================================================
   */
  const deleteAbsensi =
    React.useCallback(
      async (id: string) => {
        const isOnline =
          typeof navigator !==
          'undefined'
            ? navigator.onLine
            : true;

        if (isOnline) {
          try {
            const result =
              await ApiService.deleteAbsensi(
                id,
                activeUnitId
              );

            if (result.success) {
              setAbsensiList(
                (prev) =>
                  prev.filter(
                    (a) =>
                      a.id !== id
                  )
              );

              await refreshAbsensi();

              showToast(
                'Absensi berhasil dihapus dari Database.',
                'success'
              );

              return true;
            }

            showToast(
              `Gagal menghapus: ${
                result.message ||
                'Unknown error'
              }`,
              'error'
            );
          } catch (err) {
            console.error(
              '[ABSENSI TRACE] delete exception:',
              err
            );
          }
        }

        /*
         * Offline fallback
         */
        try {
          await syncManager.executeMutation({
            type: 'DELETE',
            tableName: 'ABSENSI',
            payload: { id, unitId: activeUnitId },

            apiCall:
              async () => {
                const result =
                  await ApiService.deleteAbsensi(
                    id,
                    activeUnitId
                  );

                return {
                  status:
                    result.success
                      ? 'success'
                      : 'error',

                  message:
                    result.message,
                };
              },
          });

          setAbsensiList(
            (prev) =>
              prev.filter(
                (a) =>
                  a.id !== id
              )
          );

          showToast(
            'Penghapusan disimpan di antrean offline.',
            'info'
          );

          return true;
        } catch (err) {
          console.error(
            '[ABSENSI TRACE] delete offline error:',
            err
          );

          showToast(
            'Gagal menghapus absensi.',
            'error'
          );

          return false;
        }
      },
      [
        refreshAbsensi,
        showToast,
      ]
    );

  /*
   * =========================================================
   * CHECK ABSENSI HARI INI
   * =========================================================
   *
   * Untuk USER:
   * - tanggal harus hari ini (WIB / Local)
   * - REGU ROW atau Petugas harus sesuai dengan yang sudah tercatat
   *
   * Untuk ADM / ADMIN / SUPERADMIN:
   * tidak diwajibkan absensi.
   */
  /*
   * =========================================================
   * CHECK ABSENSI HARI INI & RECORD HARI INI
   * =========================================================
   *
   * Untuk USER:
   * - tanggal harus hari ini (WIB / Asia/Jakarta)
   * - unitId + REGU ROW atau Petugas harus sesuai
   *
   * Untuk ADM / ADMIN / SUPERADMIN:
   * tidak diwajibkan absensi.
   */
  const todayAbsensiRecord = React.useMemo(() => {
    if (!user) return null;

    const cleanStr = (s?: string | null) => {
      if (!s) return '';
      return String(s)
        .toLowerCase()
        .trim()
        .replace(/^(regu_row|regu|tim|petugas|kelompok|row|ulp)\s+/gi, '')
        .replace(/[^a-z0-9]/gi, '');
    };

    const extractRowNumber = (s?: string | null): number | null => {
      if (!s) return null;
      const str = String(s).trim();
      const m = str.match(/(?:row|users|user|usr|tim)[-_\s]*0?(\d+)/i) || str.match(/\b0?(\d+)\b/);
      return m ? parseInt(m[1], 10) : null;
    };

    const todayISO = getWIBDateString();
    const todayStr = getLocalDateTimeString().slice(0, 10);

    const userUnitStd = InisiasiService.getStandardUnitId(user.unitId);
    const activeUnitName =
      user.unitName ||
      userUnitStd ||
      user.unitId ||
      localStorage.getItem('aphro_selected_unit_id') ||
      localStorage.getItem('aphro_nama_unit_layanan') ||
      'UL PADANG';

    const resolved = resolveUserTimRowAndUlp(user, activeUnitName);
    const userReguClean = cleanStr(resolved.reguName || user.reguName || (user as any).namaGroupWO || (user as any).groupWO || (user as any).Nama_Regu || user.name);
    const userRowNumber = extractRowNumber(resolved.reguName) ?? extractRowNumber(user.userName) ?? extractRowNumber(user.name) ?? extractRowNumber(user.reguName);
    const userIdentifierClean = cleanStr(user.userName || user.nip || user.id || user.name);

    return absensiList.find((abs: any) => {
      if (!abs) return false;

      const rawDate = abs.tanggal ?? abs.TANGGAL ?? abs.Tanggal ?? abs.createdAt;
      const absDate = normalizeDate(rawDate);
      const isToday =
        absDate === todayISO ||
        String(rawDate || '').slice(0, 10) === todayStr ||
        normalizeDateISO(rawDate) === todayISO ||
        normalizeDateISO(rawDate) === todayStr;

      if (!isToday) return false;

      // 0. Unit Check
      const absUnitStd = InisiasiService.getStandardUnitId(abs.unitId || abs.UnitId);
      if (absUnitStd && userUnitStd && absUnitStd !== userUnitStd && userUnitStd !== 'ALL') {
        return false;
      }

      // 1. REGU Match
      const reguVal = abs.reguName ?? abs.NAMA_REGU ?? abs.REGU_ROW ?? abs.Nama_Regu ?? abs.Regu ?? '';
      const absReguClean = cleanStr(reguVal);
      const absRowNumber = extractRowNumber(reguVal);

      let isReguMatch = false;
      if (userReguClean && absReguClean) {
        if (
          userReguClean === absReguClean ||
          userReguClean.includes(absReguClean) ||
          absReguClean.includes(userReguClean)
        ) {
          isReguMatch = true;
        }
      }
      if (!isReguMatch && userRowNumber !== null && absRowNumber !== null && userRowNumber === absRowNumber) {
        isReguMatch = true;
      }

      // 2. USER / PETUGAS Match
      const userVal = abs.userName ?? abs.USER_NAME ?? abs.userId ?? abs.UserID ?? '';
      const petugasVal = abs.namaPetugas ?? abs.NAMA_PETUGAS ?? abs.nama ?? '';
      const nipVal = abs.nip ?? abs.NIP ?? '';
      
      let isUserMatch = false;
      if (userIdentifierClean) {
        const uClean = cleanStr(userVal);
        const pClean = cleanStr(petugasVal);
        const nClean = cleanStr(nipVal);
        if (
          (uClean && (uClean === userIdentifierClean || uClean.includes(userIdentifierClean) || userIdentifierClean.includes(uClean))) ||
          (pClean && (pClean === userIdentifierClean || pClean.includes(userIdentifierClean) || userIdentifierClean.includes(pClean))) ||
          (nClean && nClean === userIdentifierClean)
        ) {
          isUserMatch = true;
        }
      }

      // 3. PETUGAS LIST Match
      let isMemberMatch = false;
      if (Array.isArray(abs.petugasList) && abs.petugasList.length > 0) {
        isMemberMatch = abs.petugasList.some((p: any) => {
          const pNama = cleanStr(p?.nama || p?.name);
          return Boolean(pNama && userIdentifierClean && (pNama === userIdentifierClean || userIdentifierClean.includes(pNama) || pNama.includes(userIdentifierClean)));
        });
      }
      if (!isMemberMatch) {
        for (let i = 1; i <= 20; i++) {
          const pField = cleanStr(abs[`PETUGAS_${i}`] || abs[`Petugas_${i}`] || abs[`petugas_${i}`]);
          if (pField && userIdentifierClean && (pField === userIdentifierClean || userIdentifierClean.includes(pField) || pField.includes(userIdentifierClean))) {
            isMemberMatch = true;
            break;
          }
        }
      }

      return isReguMatch || isUserMatch || isMemberMatch;
    }) ?? null;
  }, [absensiList, user, normalizeDate]);

  const sudahMasuk = React.useMemo(() => {
    if (!user || (user.role || '').toUpperCase() !== 'USER') return true;
    if (!todayAbsensiRecord) return false;
    const fotoMasuk = todayAbsensiRecord.fotoMasuk || (todayAbsensiRecord as any).FOTO_MASUK || (todayAbsensiRecord as any).foto_masuk;
    const tsMasuk =
      todayAbsensiRecord.timestampMasuk ||
      (todayAbsensiRecord as any).TIMESTAMP_MASUK ||
      (todayAbsensiRecord as any).timestamp_masuk ||
      (todayAbsensiRecord as any)['TIMESTAMP MASUK'] ||
      (todayAbsensiRecord as any).Timestamp ||
      todayAbsensiRecord.createdAt ||
      (todayAbsensiRecord as any).CREATED_AT ||
      (todayAbsensiRecord as any).Created_At;
    return Boolean(fotoMasuk || tsMasuk);
  }, [user, todayAbsensiRecord]);

  const sudahKeluar = React.useMemo(() => {
    if (!user || (user.role || '').toUpperCase() !== 'USER') return true;
    if (!todayAbsensiRecord) return false;
    const fotoKeluar = todayAbsensiRecord.fotoKeluar || (todayAbsensiRecord as any).FOTO_KELUAR || (todayAbsensiRecord as any).foto_keluar;
    const tsKeluar =
      todayAbsensiRecord.timestampKeluar ||
      (todayAbsensiRecord as any).TIMESTAMP_KELUAR ||
      (todayAbsensiRecord as any).timestamp_keluar ||
      (todayAbsensiRecord as any)['TIMESTAMP KELUAR'];
    return Boolean(fotoKeluar || tsKeluar);
  }, [user, todayAbsensiRecord]);

  const hasCheckedInToday = React.useMemo(() => {
    if (!user || (user.role || '').toUpperCase() !== 'USER') return true;
    return sudahMasuk;
  }, [user, sudahMasuk]);

  React.useEffect(() => {
    if (user) {
      console.log('[ABSENSI DEBUG]', {
        unitId: user.unitId,
        NAMA_REGU: user.reguName || (user as any).groupWO || user.name,
        'Tanggal WIB': getWIBDateString(),
        'Record ditemukan': Boolean(todayAbsensiRecord),
        'TIMESTAMP MASUK': todayAbsensiRecord?.timestampMasuk || (todayAbsensiRecord as any)?.TIMESTAMP_MASUK || '-',
        'TIMESTAMP KELUAR': todayAbsensiRecord?.timestampKeluar || (todayAbsensiRecord as any)?.TIMESTAMP_KELUAR || '-',
        sudahMasuk,
        sudahKeluar,
      });
    }
  }, [user, todayAbsensiRecord, sudahMasuk, sudahKeluar]);

  /*
   * =========================================================
   * PROVIDER
   * =========================================================
   */
  return (
    <AbsensiContext.Provider
      value={{
        absensiList,
        setAbsensiList,
        addAbsensi,
        updateAbsensi,
        deleteAbsensi,
        refreshAbsensi,
        hasCheckedInToday,
        sudahMasuk,
        sudahKeluar,
        todayAbsensiRecord,
        isLoading,
        hasVerifiedWithServer,
      }}
    >
      {children}
    </AbsensiContext.Provider>
  );
}

export function useAbsensi() {
  const context =
    React.useContext(
      AbsensiContext
    );

  if (
    context === undefined
  ) {
    throw new Error(
      'useAbsensi must be used within an AbsensiProvider'
    );
  }

  return context;
}
