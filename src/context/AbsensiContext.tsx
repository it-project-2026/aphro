import * as React from 'react';
import { Absensi } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';
import { ApiService } from '../services/apiService';
import { InisiasiService } from '../services/inisiasiService';
import { syncManager } from '../services/syncManager';
import {
  getLocalDateTimeString,
  getWIBDateString,
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
  isLoading: boolean;
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
    user?.unitId ||
    InisiasiService.getSelectedUnitId() ||
    'UL2';

  const [absensiList, setAbsensiList] =
    React.useState<Absensi[]>([]);

  const [isLoading, setIsLoading] =
    React.useState(false);

  /*
   * =========================================================
   * NORMALIZE DATE
   * =========================================================
   */
  const normalizeDate = React.useCallback(
    (value: unknown): string => {
      if (!value) return '';

      const s = String(value).trim();

      // YYYY-MM-DD atau ISO timestamp
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.substring(0, 10);
      }

      // DD/MM/YYYY atau DD-MM-YYYY
      const match = s.match(
        /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/
      );

      if (match) {
        return `${match[3]}-${match[2].padStart(
          2,
          '0'
        )}-${match[1].padStart(2, '0')}`;
      }

      // Fallback Date parser
      const parsed = new Date(s);

      if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(
          2,
          '0'
        );
        const d = String(parsed.getDate()).padStart(
          2,
          '0'
        );

        return `${y}-${m}-${d}`;
      }

      return '';
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
      return;
    }

    const token = ApiService.getAuthToken();
    if (!token) {
      console.log('[AbsensiContext] Skipping refreshAbsensi: Token missing.');
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
                0
            ).getTime();

            const dateB = new Date(
              b.TANGGAL ||
                b.tanggal ||
                0
            ).getTime();

            return dateB - dateA;
          }
        );

        setAbsensiList(sortedData);
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
    }
  }, [user?.unitId]);

  /*
   * =========================================================
   * INITIAL LOAD
   * =========================================================
   */
  React.useEffect(() => {
    if (!user) {
      setAbsensiList([]);
      return;
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

        const updatedAbs = {
          ...absensiList[
            existingIndex
          ],
          ...absData,
          updatedAt:
            getLocalDateTimeString(),
        };

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
                id
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
            payload: { id },

            apiCall:
              async () => {
                const result =
                  await ApiService.deleteAbsensi(
                    id
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
   * Ini adalah bagian terpenting.
   *
   * Untuk USER:
   * - tanggal harus hari ini
   * - unitId harus sesuai
   * - ULP harus sesuai jika tersedia
   * - regu harus sesuai jika tersedia
   *
   * Untuk ADM / ADMIN / SUPERADMIN:
   * tidak diwajibkan absensi.
   */
  const hasCheckedInToday =
    React.useMemo(() => {
      if (
        !user ||
        (user.role || '')
          .toUpperCase() !==
          'USER'
      ) {
        return true;
      }

      const todayISO =
        getWIBDateString();

      const userUnitId =
        normalizeText(
          user.unitId
        );

      const userULP =
        normalizeText(
          user.ulpName || (user as any).ulp
        );

      const userRegu =
        normalizeText(
          user.reguName
        );

      console.log(
        '[ABSENSI TRACE] Checking today attendance:',
        {
          todayISO,
          userUnitId,
          userULP,
          userRegu,
          records:
            absensiList.length,
        }
      );

      const found =
        absensiList.some(
          (abs: any) => {
            const absDate =
              normalizeDate(
                abs.tanggal ??
                  abs.TANGGAL ??
                  abs.Tanggal
              );

            if (
              absDate !== todayISO
            ) {
              return false;
            }

            /*
             * UNIT
             */
            const absUnitId =
              normalizeText(
                abs.unitId ??
                  abs.UNIT_ID
              );

            if (
              userUnitId &&
              absUnitId &&
              absUnitId !==
                userUnitId
            ) {
              return false;
            }

            /*
             * ULP
             */
            const absULP =
              normalizeText(
                abs.ulp ??
                  abs.ULP
              );

            if (
              userULP &&
              absULP &&
              absULP !==
                userULP
            ) {
              return false;
            }

            /*
             * REGU
             */
            const absRegu =
              normalizeText(
                abs.reguName ??
                  abs.NAMA_REGU ??
                  abs.Nama_Regu ??
                  abs.Regu
              );

            if (
              userRegu &&
              absRegu
            ) {
              const reguMatch =
                userRegu ===
                  absRegu ||
                userRegu.includes(
                  absRegu
                ) ||
                absRegu.includes(
                  userRegu
                );

              if (!reguMatch) {
                return false;
              }
            }

            console.log(
              '[ABSENSI TRACE] ATTENDANCE FOUND:',
              {
                date: absDate,
                unitId:
                  absUnitId,
                ULP: absULP,
                regu: absRegu,
              }
            );

            return true;
          }
        );

      console.log(
        '[ABSENSI TRACE] hasCheckedInToday =',
        found
      );

      return found;
    }, [
      absensiList,
      user,
      normalizeDate,
      normalizeText,
    ]);

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
        isLoading,
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
