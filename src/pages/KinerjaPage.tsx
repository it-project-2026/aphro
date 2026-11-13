import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useMasterData } from '../context/MasterDataContext';
import { useToast } from '../hooks/useToast';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { ApiService } from '../services/apiService';
import { InisiasiService, getStandardUnitId } from '../services/inisiasiService';
import {
  classifyRealisasiAction,
  deduplicateWorkOrders,
  getRealisasiPohonCount,
} from '../services/rekapHarianService';
import {
  formatDateDisplay,
  getItemDateISO,
  getWIBDateString,
  parseDateFromNomorWO,
} from '../utils/dateUtils';
import {
  TARGET_KMS_PER_TIM_ROW,
  getWORealisasiKms,
  getWOTargetKms,
  isWOSelesai,
} from '../utils/metricUtils';
import {
  cleanToken,
  filterRealisasiForLoggedInUser,
  isStrictUserRoleAccount,
  matchesLoggedInUserWO,
  resolveStrictUserIdentity,
} from '../utils/userKinerjaUtils';
import { WorkOrder } from '../types';
import {
  Award,
  Axe,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Percent,
  RefreshCw,
  Scissors,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

interface KinerjaTableRow {
  key: string;
  tanggalISO: string;
  nomorWO: string;
  penyulangName: string;
  status: string;
  targetKms: number;
  realisasiKms: number;
  tebang: number;
  pangkas: number;
}

export const KinerjaPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { settings } = useSettings();
  const { workOrders, displayedWorkOrders, hasMore, refreshWorkOrders } = useWorkOrders();
  const {
    realisasiList,
    dashboardRealisasiList,
    fetchDashboardRealisasi,
    refreshRealisasi,
  } = useRealisasi();
  const { users, ulpList, reguList } = useMasterData();
  const { showToast } = useToast();
  const draggable = useDraggableScroll();

  const [extraWorkOrders, setExtraWorkOrders] = useState<WorkOrder[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'MONTH' | 'TODAY'>('MONTH');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const isStrictUserRole = isStrictUserRoleAccount(currentUser);

  const activeUnitId = useMemo(() => {
    return (
      getStandardUnitId(
        currentUser?.unitId ||
          settings.namaUnitLayanan ||
          InisiasiService.getSelectedUnitId() ||
          'UL1'
      ) || 'UL1'
    );
  }, [currentUser?.unitId, settings.namaUnitLayanan]);

  const activeUnitName = useMemo(() => {
    return (
      settings.namaUnitLayanan ||
      localStorage.getItem('aphro_nama_unit_layanan') ||
      InisiasiService.getActiveInisiasiUnit().namaUL
    );
  }, [settings.namaUnitLayanan]);

  const userIdentity = useMemo(() => {
    return resolveStrictUserIdentity(currentUser, activeUnitName, users, ulpList, reguList);
  }, [currentUser, activeUnitName, users, ulpList, reguList]);

  // Clear cross-user cached extraWorkOrders whenever user or active unit changes
  useEffect(() => {
    setExtraWorkOrders([]);
  }, [currentUser?.id, currentUser?.userName, activeUnitId]);

  useEffect(() => {
    if (!isStrictUserRole) return;
    let isCancelled = false;

    const loadFullUserData = async () => {
      try {
        await fetchDashboardRealisasi(activeUnitId);

        if (hasMore && navigator.onLine && ApiService.getAuthToken()) {
          const allPages: WorkOrder[] = [];
          let page = 2;
          let keepGoing = true;
          while (keepGoing && page <= 15 && !isCancelled) {
            const res = await ApiService.fetchWorkOrders(activeUnitId, page, 100);
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              const normalized = res.data.map((row: any) => {
                const wo = ApiService.normalizeWorkOrderRow(row);
                if (!wo.tanggal || wo.tanggal === 'null' || wo.tanggal === 'undefined') {
                  const parsed = parseDateFromNomorWO(wo.nomorWO);
                  if (parsed) return { ...wo, tanggal: parsed };
                }
                return wo;
              });
              allPages.push(...normalized);
              const nextMore = res.pagination ? res.pagination.hasMore : res.data.length === 100;
              keepGoing = Boolean(nextMore);
              page += 1;
            } else {
              keepGoing = false;
            }
          }
          if (!isCancelled && allPages.length > 0) {
            setExtraWorkOrders(allPages);
          }
        }
      } catch (err) {
        console.warn('[KinerjaPage] Load additional data warning:', err);
      }
    };

    loadFullUserData();

    const handleDataUpdated = () => {
      refreshWorkOrders(1, true);
      refreshRealisasi(true);
      fetchDashboardRealisasi(activeUnitId);
    };

    window.addEventListener('aphro:data_updated', handleDataUpdated);
    window.addEventListener('aphro_data_updated', handleDataUpdated);
    return () => {
      isCancelled = true;
      window.removeEventListener('aphro:data_updated', handleDataUpdated);
      window.removeEventListener('aphro_data_updated', handleDataUpdated);
    };
  }, [isStrictUserRole, activeUnitId, hasMore, fetchDashboardRealisasi, refreshWorkOrders, refreshRealisasi]);

  const handleManualSync = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshWorkOrders(1, true),
        refreshRealisasi(true),
        fetchDashboardRealisasi(activeUnitId),
      ]);
      showToast('Data kinerja berhasil disinkronkan.', 'success');
    } catch {
      showToast('Gagal menyinkronkan data kinerja.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const userWorkOrders = useMemo(() => {
    if (!isStrictUserRole || !currentUser) return [];
    const combined = [
      ...displayedWorkOrders,
      ...workOrders,
      ...extraWorkOrders,
    ].filter((wo) =>
      matchesLoggedInUserWO(
        wo,
        currentUser,
        activeUnitId,
        userIdentity.reguName,
        activeUnitName,
        userIdentity
      )
    );
    return deduplicateWorkOrders(combined);
  }, [
    isStrictUserRole,
    currentUser,
    displayedWorkOrders,
    workOrders,
    extraWorkOrders,
    activeUnitId,
    activeUnitName,
    userIdentity,
  ]);

  const userRealisasi = useMemo(() => {
    if (!isStrictUserRole || !currentUser) return [];
    const combinedRaw = [
      ...(dashboardRealisasiList || []),
      ...(realisasiList || []),
    ];
    return filterRealisasiForLoggedInUser(
      combinedRaw,
      userWorkOrders,
      currentUser,
      activeUnitId,
      userIdentity.reguName,
      activeUnitName,
      userIdentity
    );
  }, [
    isStrictUserRole,
    currentUser,
    dashboardRealisasiList,
    realisasiList,
    userWorkOrders,
    activeUnitId,
    activeUnitName,
    userIdentity,
  ]);

  const todayWIB = getWIBDateString();
  const currentMonthPrefix = todayWIB.slice(0, 7);
  const normalizedSearch = searchQuery.trim().toUpperCase();

  const filteredWOs = useMemo(() => {
    return userWorkOrders.filter((wo) => {
      const woDate = getItemDateISO(wo);
      if (periodFilter === 'TODAY' && woDate !== todayWIB) return false;
      if (periodFilter === 'MONTH' && !woDate.startsWith(currentMonthPrefix)) return false;

      if (normalizedSearch) {
        const noWo = String(wo.nomorWO || wo.Nomor_WO || '').toUpperCase();
        const peny = String(wo.penyulangName || '').toUpperCase();
        if (!noWo.includes(normalizedSearch) && !peny.includes(normalizedSearch)) {
          return false;
        }
      }
      return true;
    });
  }, [userWorkOrders, periodFilter, todayWIB, currentMonthPrefix, normalizedSearch]);

  const filteredWoIds = useMemo(() => {
    const ids = new Set<string>();
    const nomors = new Set<string>();
    filteredWOs.forEach((wo) => {
      const id = String(wo.id || wo.WO_ID || '').trim().toLowerCase();
      const no = String(wo.nomorWO || wo.Nomor_WO || '').trim().toUpperCase();
      if (id) ids.add(id);
      if (no) nomors.add(no);
    });
    return { ids, nomors };
  }, [filteredWOs]);

  const filteredRealisasi = useMemo(() => {
    return userRealisasi.filter((rel) => {
      const relDate = getItemDateISO(rel);
      if (periodFilter === 'TODAY' && relDate !== todayWIB) return false;
      if (periodFilter === 'MONTH' && !relDate.startsWith(currentMonthPrefix)) return false;

      if (normalizedSearch) {
        const relWoId = String(rel.workOrderId || rel.WO_ID || rel.woId || '').trim().toLowerCase();
        const relNoWo = String(rel.nomorWO || rel.Nomor_WO || '').toUpperCase();
        const relPeny = String(rel.penyulangName || '').toUpperCase();
        const matchedWo = filteredWoIds.ids.has(relWoId) || filteredWoIds.nomors.has(relNoWo);
        if (!matchedWo && !relNoWo.includes(normalizedSearch) && !relPeny.includes(normalizedSearch)) {
          return false;
        }
      }
      return true;
    });
  }, [userRealisasi, periodFilter, todayWIB, currentMonthPrefix, normalizedSearch, filteredWoIds]);

  const { cardsMetrics, tableRows } = useMemo(() => {
    const rows: KinerjaTableRow[] = [];
    const rowIndexById = new Map<string, number>();
    const rowsByNomor = new Map<string, number[]>();

    let totalWorkOrderKms = 0;
    let totalRealisasiKms = 0;
    let completedWoCount = 0;

    filteredWOs.forEach((wo, idx) => {
      const targetKms = getWOTargetKms(wo);
      const realKms = getWORealisasiKms(wo);
      const tanggalISO = getItemDateISO(wo);
      const nomorWO = String(wo.nomorWO || wo.Nomor_WO || '-').trim();

      totalWorkOrderKms += targetKms;
      totalRealisasiKms += realKms;
      if (isWOSelesai(wo.status)) completedWoCount += 1;

      const rowIdx = rows.length;
      rows.push({
        key: String(wo.id || wo.WO_ID || `${nomorWO}-${idx}`),
        tanggalISO,
        nomorWO,
        penyulangName: wo.penyulangName || '-',
        status: wo.status || 'Belum Dikerjakan',
        targetKms,
        realisasiKms: realKms,
        tebang: 0,
        pangkas: 0,
      });

      const idKey = String(wo.id || wo.WO_ID || '').trim().toLowerCase();
      if (idKey) rowIndexById.set(idKey, rowIdx);

      const noKey = nomorWO.toUpperCase();
      if (noKey && noKey !== '-') {
        const list = rowsByNomor.get(noKey) || [];
        list.push(rowIdx);
        rowsByNomor.set(noKey, list);
      }
    });

    const orphanMap = new Map<string, KinerjaTableRow>();
    let totalTebang = 0;
    let totalPangkas = 0;

    filteredRealisasi.forEach((rel) => {
      const pohonCount = getRealisasiPohonCount(rel);
      const action = classifyRealisasiAction(rel);

      if (action === 'TEBANG') totalTebang += pohonCount;
      else totalPangkas += pohonCount;

      const relWoId = String(rel.workOrderId || rel.WO_ID || rel.woId || '').trim().toLowerCase();
      const relNoWo = String(rel.nomorWO || rel.Nomor_WO || '').trim().toUpperCase();

      let matchedIdx: number | undefined;
      if (relWoId && rowIndexById.has(relWoId)) {
        matchedIdx = rowIndexById.get(relWoId);
      } else if (relNoWo && rowsByNomor.has(relNoWo)) {
        const candidates = rowsByNomor.get(relNoWo)!;
        if (candidates.length === 1) {
          matchedIdx = candidates[0];
        } else {
          const relPenyClean = cleanToken(rel.penyulangName);
          const penyMatch = candidates.find(
            (cIdx) => cleanToken(rows[cIdx].penyulangName) === relPenyClean
          );
          matchedIdx = penyMatch ?? candidates[0];
        }
      }

      if (matchedIdx !== undefined) {
        if (action === 'TEBANG') rows[matchedIdx].tebang += pohonCount;
        else rows[matchedIdx].pangkas += pohonCount;
      } else {
        const relDate = getItemDateISO(rel);
        const displayNo = String(rel.nomorWO || rel.Nomor_WO || 'Tanpa Nomor WO').trim();
        const orphanKey = `${relDate}___${displayNo.toUpperCase()}`;
        if (!orphanMap.has(orphanKey)) {
          orphanMap.set(orphanKey, {
            key: `orphan-${orphanKey}`,
            tanggalISO: relDate,
            nomorWO: displayNo,
            penyulangName: rel.penyulangName || '-',
            status: rel.status || 'Realisasi',
            targetKms: 0,
            realisasiKms: 0,
            tebang: 0,
            pangkas: 0,
          });
        }
        const orphanRow = orphanMap.get(orphanKey)!;
        if (action === 'TEBANG') orphanRow.tebang += pohonCount;
        else orphanRow.pangkas += pohonCount;
      }
    });

    const combinedRows = [...rows, ...Array.from(orphanMap.values())].sort((a, b) => {
      if (a.tanggalISO !== b.tanggalISO) {
        return b.tanggalISO.localeCompare(a.tanggalISO);
      }
      return b.nomorWO.localeCompare(a.nomorWO);
    });

    const uniqueMonths = new Set<string>();
    filteredWOs.forEach((wo) => {
      const d = getItemDateISO(wo);
      if (d && d.length >= 7) uniqueMonths.add(d.slice(0, 7));
    });
    filteredRealisasi.forEach((rel) => {
      const d = getItemDateISO(rel);
      if (d && d.length >= 7) uniqueMonths.add(d.slice(0, 7));
    });
    const activeMonthCount = Math.max(1, uniqueMonths.size);

    const effectiveTotalWorkOrderKms =
      periodFilter === 'MONTH'
        ? TARGET_KMS_PER_TIM_ROW
        : periodFilter === 'ALL'
          ? activeMonthCount * TARGET_KMS_PER_TIM_ROW
          : totalWorkOrderKms;

    const totalWorkOrderRounded = Number(effectiveTotalWorkOrderKms.toFixed(2));
    const totalRealisasiRounded = Number(totalRealisasiKms.toFixed(2));
    const totalSisaKms = Number(Math.max(0, totalWorkOrderRounded - totalRealisasiRounded).toFixed(2));
    const persentase =
      totalWorkOrderRounded > 0
        ? Number(((totalRealisasiRounded / totalWorkOrderRounded) * 100).toFixed(1))
        : 0;

    return {
      cardsMetrics: {
        totalWorkOrderKms: totalWorkOrderRounded,
        totalWorkOrderCount: filteredWOs.length,
        activeMonthCount,
        completedWoCount,
        totalRealisasiKms: totalRealisasiRounded,
        totalRealisasiCount: filteredRealisasi.length,
        totalSisaKms,
        totalTebang,
        totalPangkas,
        persentase,
      },
      tableRows: combinedRows,
    };
  }, [filteredWOs, filteredRealisasi, periodFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [periodFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tableRows.slice(start, start + pageSize);
  }, [tableRows, currentPage]);

  if (!isStrictUserRole) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
          Akses Terbatas
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Halaman Kinerja hanya tersedia untuk Role User (Petugas ROW) dan menampilkan data milik akun yang sedang login.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* HEADER HALAMAN KINERJA */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 bg-gradient-to-r from-[#006e7e] via-[#008396] to-[#00A2B9] text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/20 shadow-inner">
                <Award className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase font-display">
                    KINERJA
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white border border-white/25">
                    {userIdentity.reguName || currentUser?.reguName || 'Petugas ROW'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-teal-50/90 mt-1 font-medium">
                  {currentUser?.name || currentUser?.userName || 'Petugas ROW'} • {userIdentity.ulpName || activeUnitName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs sm:text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Menyinkronkan...' : 'Sinkron Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER PERIODE & PENCARIAN */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
            <Calendar className="w-4 h-4 text-[#00A2B9]" />
            <span>Periode:</span>
          </div>
          {(
            [
              { id: 'MONTH', label: 'Bulan Ini' },
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'ALL', label: 'Semua Data' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriodFilter(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                periodFilter === opt.id
                  ? 'bg-[#00A2B9] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Nomor Work Order / Penyulang..."
            className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
          />
        </div>
      </div>

      {/* KARTU RINGKASAN KINERJA: 3-3-1 LAYOUT */}
      <div className="space-y-4">
        {/* Baris 1: TOTAL WORK ORDER, TOTAL REALISASI KMS, TOTAL SISA KMS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-2xl p-5 border border-sky-200/90 dark:border-sky-800/60 bg-gradient-to-br from-sky-50 via-white to-blue-50/70 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-sky-950/30 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-sky-700 dark:text-sky-300 uppercase tracking-tight">
                  TOTAL WORK ORDER
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {cardsMetrics.totalWorkOrderKms.toFixed(2)} KMS
                </h3>
                <p className="text-xs font-medium text-sky-700/80 dark:text-sky-300/80 pt-1">
                  {periodFilter === 'MONTH'
                    ? `Target 50,20 KMS/Bulan • ${cardsMetrics.totalWorkOrderCount} WO`
                    : periodFilter === 'ALL'
                      ? `Target ${cardsMetrics.activeMonthCount} Bulan (50,20/Bln) • ${cardsMetrics.totalWorkOrderCount} WO`
                      : `${cardsMetrics.totalWorkOrderCount} Dokumen Work Order`}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300 group-hover:scale-110 transition-transform duration-300">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-sky-400 opacity-75" />
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 border border-teal-200/90 dark:border-teal-800/60 bg-gradient-to-br from-teal-50 via-white to-cyan-50/70 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-teal-950/30 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-teal-700 dark:text-teal-300 uppercase tracking-tight">
                  TOTAL REALISASI KMS
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {cardsMetrics.totalRealisasiKms.toFixed(2)} KMS
                </h3>
                <p className="text-xs font-medium text-teal-700/80 dark:text-teal-300/80 pt-1">
                  {cardsMetrics.completedWoCount} Work Order Selesai
                </p>
              </div>
              <div className="p-3 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300 group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-[#00A2B9] to-cyan-400 opacity-75" />
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 border border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 via-white to-orange-50/70 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-amber-950/30 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-tight">
                  TOTAL SISA KMS
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {cardsMetrics.totalSisaKms.toFixed(2)} KMS
                </h3>
                <p className="text-xs font-medium text-amber-700/80 dark:text-amber-300/80 pt-1">
                  Sisa Target Pekerjaan
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 opacity-75" />
          </div>
        </div>

        {/* Baris 2: TOTAL REALISASI, TOTAL TEBANG, TOTAL PANGKAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-2xl p-5 border border-indigo-200/90 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50 via-white to-violet-50/70 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-indigo-950/30 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-tight">
                  TOTAL REALISASI
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {cardsMetrics.totalRealisasiCount}
                </h3>
                <p className="text-xs font-medium text-indigo-700/80 dark:text-indigo-300/80 pt-1">
                  Total Titik / Laporan Realisasi
                </p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 group-hover:scale-110 transition-transform duration-300">
                <FileCheck2 className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-400 opacity-75" />
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 border border-rose-200/90 dark:border-rose-800/60 bg-gradient-to-br from-rose-50 via-white to-pink-50/70 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-rose-950/30 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-tight">
                  TOTAL TEBANG
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {cardsMetrics.totalTebang}
                </h3>
                <p className="text-xs font-medium text-rose-700/80 dark:text-rose-300/80 pt-1">
                  Total Pohon Ditebang
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300 group-hover:scale-110 transition-transform duration-300">
                <Axe className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 via-pink-500 to-rose-400 opacity-75" />
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 border border-emerald-200/90 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 via-white to-green-50/70 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-emerald-950/30 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-tight">
                  TOTAL PANGKAS
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {cardsMetrics.totalPangkas}
                </h3>
                <p className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80 pt-1">
                  Total Pohon Dipangkas
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 group-hover:scale-110 transition-transform duration-300">
                <Scissors className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-400 opacity-75" />
          </div>
        </div>

        {/* Baris 3: Full Kolom (PERSENTASE) */}
        <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-[#006e7e] via-[#008396] to-emerald-600 text-white shadow-md border border-teal-400/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3.5 rounded-2xl bg-white/15 border border-white/25 shadow-inner shrink-0">
                <Percent className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-teal-100">
                  PERSENTASE CAPAIAN KINERJA
                </p>
                <div className="flex items-baseline gap-3 mt-0.5">
                  <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                    {cardsMetrics.persentase.toFixed(1)}%
                  </h3>
                  <span className="text-xs sm:text-sm font-semibold text-teal-100/90">
                    ({cardsMetrics.totalRealisasiKms.toFixed(2)} / {cardsMetrics.totalWorkOrderKms.toFixed(2)} KMS)
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-1/2 lg:w-5/12 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-teal-50">
                <span>Progress Realisasi KMS vs Total Work Order</span>
                <span>{Math.min(100, Math.max(0, cardsMetrics.persentase)).toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950/30 overflow-hidden p-0.5 border border-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 via-emerald-300 to-white transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, cardsMetrics.persentase))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABEL RINCIAN KINERJA PER WORK ORDER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Rincian Kinerja Work Order
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Menampilkan {tableRows.length} data milik {userIdentity.reguName || currentUser?.name}
            </p>
          </div>
          {totalPages > 1 && (
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Halaman {currentPage} dari {totalPages}
            </span>
          )}
        </div>

        <div
          ref={draggable.ref}
          onMouseDown={draggable.onMouseDown}
          onMouseMove={draggable.onMouseMove}
          onMouseUp={draggable.onMouseUp}
          onMouseLeave={draggable.onMouseLeave}
          className="overflow-x-auto cursor-grab active:cursor-grabbing"
        >
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <th className="py-3.5 px-4 sm:px-6 whitespace-nowrap">TANGGAL</th>
                <th className="py-3.5 px-4 sm:px-6 whitespace-nowrap">Nomor Work Order</th>
                <th className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right">KMS</th>
                <th className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right">Tebang</th>
                <th className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right">Pangkas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center text-slate-400 dark:text-slate-500">
                    Belum ada data Work Order atau Realisasi untuk periode yang dipilih.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={row.key}
                    className="hover:bg-teal-50/40 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                      {row.tanggalISO ? formatDateDisplay(row.tanggalISO) : '-'}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {row.nomorWO}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{row.penyulangName}</span>
                        <span>•</span>
                        <span
                          className={
                            isWOSelesai(row.status)
                              ? 'text-teal-600 dark:text-teal-400 font-semibold'
                              : 'text-amber-600 dark:text-amber-400 font-semibold'
                          }
                        >
                          {row.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right font-bold text-slate-900 dark:text-white">
                      <span>{row.realisasiKms.toFixed(2)}</span>
                      <span className="text-slate-400 dark:text-slate-500 font-medium text-xs">
                        {' '}
                        / {row.targetKms.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right font-extrabold text-rose-600 dark:text-rose-400">
                      {row.tebang}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      {row.pangkas}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot>
                <tr className="bg-teal-50/80 dark:bg-slate-800/90 border-t-2 border-teal-200 dark:border-slate-700 text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  <td colSpan={2} className="py-3.5 px-4 sm:px-6 uppercase tracking-wider">
                    TOTAL KESELURUHAN
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                    <span>{cardsMetrics.totalRealisasiKms.toFixed(2)}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-bold text-xs">
                      {' '}
                      / {cardsMetrics.totalWorkOrderKms.toFixed(2)} KMS
                    </span>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap text-rose-600 dark:text-rose-400">
                    {cardsMetrics.totalTebang}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                    {cardsMetrics.totalPangkas}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              Hal {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KinerjaPage;
