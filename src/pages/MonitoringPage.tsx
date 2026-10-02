import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useGASSync } from '../context/GASSyncContext';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { WorkOrder } from '../types';
import { formatDateDisplay, getWIBDateString, getLocalDateTimeString, normalizeDateISO, parseDateFromNomorWO } from '../utils/dateUtils';
import { getStandardUnitId, InisiasiService } from '../services/inisiasiService';
import {
  getWOTargetKms,
  getWORealisasiKms,
  isWOSelesai,
  isWOInProgress,
  parseNumeric,
  TARGET_KMS_PER_TIM_ROW
} from '../utils/metricUtils';
import {
  Search,
  Calendar,
  Scissors,
  TreeDeciduous,
  Table as TableIcon,
  BarChart3,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  RotateCcw,
  Users
} from 'lucide-react';

export const MonitoringPage: React.FC = () => {
  const draggable1 = useDraggableScroll();
  
  const { user: currentUser } = useAuth();
  const { workOrders, displayedWorkOrders, refreshWorkOrders } = useWorkOrders();
  const { realisasiList, dashboardRealisasiList, refreshRealisasi } = useRealisasi();
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { settings } = useSettings();
  const { syncWithGAS } = useGASSync();

  const isUserRole = currentUser?.role === 'User';
  const activeUnitId = getStandardUnitId(currentUser?.unitId || settings.namaUnitLayanan || InisiasiService.getSelectedUnitId() || 'UL1');

  // 10-second active polling when Monitoring is open
  const isFetchingPollingRef = React.useRef(false);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isFetchingPollingRef.current || !navigator.onLine) return;
      try {
        isFetchingPollingRef.current = true;
        await Promise.all([
          refreshWorkOrders(0),
          refreshRealisasi(true),
        ]);
      } catch (err) {
        // silent
      } finally {
        isFetchingPollingRef.current = false;
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshWorkOrders, refreshRealisasi]);

  // Default to current year and current month
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');

  const [filterYear, setFilterYear] = useState<string>(currentYearStr);
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthStr);
  const [filterDate, setFilterDate] = useState('');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Helper to normalize strings for robust matching
  const cleanStr = (s?: string | null) => {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/gi, '');
  };

  // Unit scoping matcher
  const matchesUnit = React.useCallback((itemUnitId?: string, itemUlpName?: string) => {
    if (!activeUnitId || activeUnitId === 'ALL') return true;
    const stdItem = getStandardUnitId(itemUnitId);
    if (stdItem) return stdItem === activeUnitId;

    if (itemUlpName && ulpList && ulpList.length > 0) {
      const cleanItemUlp = cleanStr(itemUlpName);
      if (!cleanItemUlp) return true;
      const matchedUlp = ulpList.find(u => {
        const cleanName = cleanStr(u.namaULP || '');
        return cleanName && (cleanName.includes(cleanItemUlp) || cleanItemUlp.includes(cleanName));
      });
      if (matchedUlp && matchedUlp.unitId) {
        return getStandardUnitId(matchedUlp.unitId) === activeUnitId;
      }
    }
    return true;
  }, [activeUnitId, ulpList]);

  const activeRealisasiList = useMemo(() => {
    return dashboardRealisasiList.length > 0 ? dashboardRealisasiList : realisasiList;
  }, [dashboardRealisasiList, realisasiList]);

  // 1. Deduplicate Work Orders based on composite key (Nomor WO + Penyulang) scoped to unit
  const uniqueWorkOrders = useMemo(() => {
    const baseList = displayedWorkOrders.filter(wo => matchesUnit(wo.unitId, wo.ulpName));
    const seen = new Map<string, WorkOrder>();

    baseList.forEach((wo) => {
      if (!wo) return;
      const woNo = (wo.nomorWO || '').trim().toUpperCase();
      const penyulang = (wo.penyulangName || '').trim().toUpperCase();
      const woKey = woNo && penyulang ? `${woNo}___${penyulang}` : (wo.id || '').trim().toUpperCase();
      if (!woKey) return;

      if (!seen.has(woKey)) {
        seen.set(woKey, wo);
      } else {
        const existing = seen.get(woKey)!;
        const isNewSelesai = isWOSelesai(wo.status);
        const isExistingSelesai = isWOSelesai(existing.status);

        const merged: WorkOrder = {
          ...existing,
          ...wo,
          ulpName: wo.ulpName || existing.ulpName,
          penyulangName: wo.penyulangName || existing.penyulangName,
          reguName: wo.reguName || existing.reguName,
          petugasName: wo.petugasName || existing.petugasName,
          status: (isNewSelesai || isExistingSelesai) ? 'Selesai' : (wo.status || existing.status),
          latitude: wo.latitude || existing.latitude,
          longitude: wo.longitude || existing.longitude,
          totalRealisasi: Math.max(parseNumeric(wo.totalRealisasi, 0), parseNumeric(existing.totalRealisasi, 0)),
        };
        seen.set(woKey, merged);
      }
    });

    // Also include synthetic Work Orders from Realisasi records matching unit
    activeRealisasiList.forEach((r) => {
      if (!r || !matchesUnit(r.unitId, r.ulpName)) return;
      const rWoNo = (r.nomorWO || '').trim().toUpperCase();
      const rPenyulang = (r.penyulangName || '').trim().toUpperCase();
      const rKey = rWoNo && rPenyulang ? `${rWoNo}___${rPenyulang}` : (r.workOrderId || '').trim().toUpperCase();
      if (!rKey) return;

      if (!seen.has(rKey)) {
        seen.set(rKey, {
          id: r.workOrderId || `wo-syn-${rKey}`,
          nomorWO: r.nomorWO || rKey,
          tanggal: r.tanggalRealisasi || r.createdAt || getWIBDateString(),
          unitId: r.unitId || activeUnitId,
          ulpId: '',
          ulpName: r.ulpName || '-',
          penyulangId: '',
          penyulangName: r.penyulangName || '-',
          reguId: '',
          reguName: r.reguName || '-',
          status: r.status || 'Selesai',
          progressPercent: 100,
          createdAt: r.createdAt || getLocalDateTimeString(),
        });
      }
    });

    return Array.from(seen.values());
  }, [displayedWorkOrders, activeRealisasiList, matchesUnit, activeUnitId]);

  // 2. Filter Work Orders accurately by Date/Month/Year, ULP, Penyulang, Regu, Status, and Search
  const filteredWOs = useMemo(() => {
    return uniqueWorkOrders.filter((wo) => {
      const matchesUlp = filterUlp === 'ALL' || cleanStr(wo.ulpId) === cleanStr(filterUlp) || cleanStr(wo.ulpName) === cleanStr(filterUlp);
      const matchesPenyulang = filterPenyulang === 'ALL' || cleanStr(wo.penyulangId) === cleanStr(filterPenyulang) || cleanStr(wo.penyulangName) === cleanStr(filterPenyulang);
      const matchesRegu = filterRegu === 'ALL' || cleanStr(wo.reguName) === cleanStr(filterRegu);
      
      const statusUpper = String(wo.status || '').toUpperCase().trim();
      let matchesStatus = true;
      if (filterStatus === 'Selesai') {
        matchesStatus = isWOSelesai(statusUpper);
      } else if (filterStatus === 'Sedang Dikerjakan') {
        matchesStatus = isWOInProgress(statusUpper);
      } else if (filterStatus === 'Belum Dikerjakan') {
        matchesStatus = !isWOSelesai(statusUpper) && !isWOInProgress(statusUpper);
      }

      // Date matching by Year, Month, or exact Date
      const woDateIso = normalizeDateISO(wo.tanggal) || parseDateFromNomorWO(wo.nomorWO || '') || normalizeDateISO(wo.createdAt) || '';
      let matchesDate = true;

      if (filterDate) {
        matchesDate = woDateIso === filterDate || Boolean(wo.tanggal && String(wo.tanggal).includes(filterDate));
      } else {
        if (woDateIso && /^\d{4}-\d{2}/.test(woDateIso)) {
          const [y, m] = woDateIso.split('-');
          if (filterYear && filterYear !== 'ALL' && y !== filterYear) {
            matchesDate = false;
          }
          if (filterMonth && filterMonth !== 'ALL' && m !== filterMonth.padStart(2, '0')) {
            matchesDate = false;
          }
        }
      }

      const query = debouncedSearch.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (wo.nomorWO || '').toLowerCase().includes(query) ||
        (wo.ulpName || '').toLowerCase().includes(query) ||
        (wo.penyulangName || '').toLowerCase().includes(query) ||
        (wo.reguName || '').toLowerCase().includes(query) ||
        (wo.petugasName || '').toLowerCase().includes(query) ||
        (wo.jenisPekerjaan || '').toLowerCase().includes(query);

      return matchesUlp && matchesPenyulang && matchesRegu && matchesStatus && matchesDate && matchesSearch;
    });
  }, [uniqueWorkOrders, filterUlp, filterPenyulang, filterRegu, filterStatus, filterDate, filterYear, filterMonth, debouncedSearch]);

  // 3. Build Detailed Monitoring Rows
  const woMonitoringRows = useMemo(() => {
    return filteredWOs.map((wo) => {
      const woNomorClean = (wo.nomorWO || '').trim().toUpperCase();

      const matchedRealisasi = activeRealisasiList.filter((r) => {
        if (!r) return false;
        const matchId = r.workOrderId && (r.workOrderId === wo.id || (wo as any).WO_ID === r.workOrderId);
        const rNoWoClean = (r.nomorWO || (r as any).Nomor_WO || '').trim().toUpperCase();
        const matchNoWo = Boolean(woNomorClean && rNoWoClean && rNoWoClean === woNomorClean);
        if (!matchId && !matchNoWo) return false;

        if (filterDate) {
          const rDateIso = normalizeDateISO(r.tanggalRealisasi || r.createdAt);
          return rDateIso === filterDate;
        } else if (filterYear !== 'ALL' || filterMonth !== 'ALL') {
          const rDateIso = normalizeDateISO(r.tanggalRealisasi || r.createdAt);
          if (rDateIso && /^\d{4}-\d{2}/.test(rDateIso)) {
            const [y, m] = rDateIso.split('-');
            if (filterYear !== 'ALL' && y !== filterYear) return false;
            if (filterMonth !== 'ALL' && m !== filterMonth.padStart(2, '0')) return false;
          }
        }
        return true;
      });

      // Deduplicate realisasi items
      const seenRel = new Set<string>();
      const uniqueRelList = matchedRealisasi.filter((r) => {
        const key = r.id || `${r.nomorWO}-${r.createdAt || ''}-${r.fotoSebelumUrl}-${r.fotoSesudahUrl}-${r.noTiang || ''}-${r.keterangan || ''}`;
        if (seenRel.has(key)) return false;
        seenRel.add(key);
        return true;
      });

      const totalTebang = uniqueRelList.filter((r) => {
        const ket = (r.keterangan || '').toUpperCase();
        return ket.includes('TEBANG');
      }).length;

      const totalPotong = uniqueRelList.filter((r) => {
        const ket = (r.keterangan || '').toUpperCase();
        return ket.includes('POTONG') || ket.includes('PANGKAS');
      }).length;

      const totalRealisasiTitik = Math.max(uniqueRelList.length, totalTebang + totalPotong);
      const targetKms = getWOTargetKms(wo);
      const realisasiKms = getWORealisasiKms(wo);

      return {
        workOrder: wo,
        nomorWO: wo.nomorWO,
        tanggal: wo.tanggal,
        ulpName: wo.ulpName || '-',
        penyulangName: wo.penyulangName || '-',
        reguName: wo.reguName || wo.petugasName || 'TIM ROW',
        status: wo.status || 'Belum Dikerjakan',
        targetKms,
        realisasiKms,
        totalRealisasiTitik,
        totalTebang,
        totalPotong,
      };
    });
  }, [filteredWOs, activeRealisasiList, filterDate, filterYear, filterMonth]);

  // Dynamic Year Options from WO & Realisasi records
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const thisYear = new Date().getFullYear().toString();
    years.add(thisYear);

    uniqueWorkOrders.forEach(wo => {
      const d = normalizeDateISO(wo.tanggal) || parseDateFromNomorWO(wo.nomorWO || '');
      if (d && /^\d{4}/.test(d)) years.add(d.substring(0, 4));
    });
    return Array.from(years).sort().reverse();
  }, [uniqueWorkOrders]);

  // Aggregate Metrics
  const totalWOCount = woMonitoringRows.length;
  const woSelesaiCount = woMonitoringRows.filter(r => isWOSelesai(r.status)).length;
  const woProgressCount = woMonitoringRows.filter(r => isWOInProgress(r.status)).length;
  const grandTotalRealisasiTitik = useMemo(
    () => woMonitoringRows.reduce((acc, row) => acc + row.totalRealisasiTitik, 0),
    [woMonitoringRows]
  );
  const grandTotalRealisasiKms = useMemo(
    () => Number(woMonitoringRows.reduce((acc, row) => acc + row.realisasiKms, 0).toFixed(2)),
    [woMonitoringRows]
  );
  const grandTotalTargetKms = useMemo(
    () => Number(woMonitoringRows.reduce((acc, row) => acc + row.targetKms, 0).toFixed(2)),
    [woMonitoringRows]
  );
  const grandTotalTebang = useMemo(
    () => woMonitoringRows.reduce((acc, row) => acc + row.totalTebang, 0),
    [woMonitoringRows]
  );
  const grandTotalPotong = useMemo(
    () => woMonitoringRows.reduce((acc, row) => acc + row.totalPotong, 0),
    [woMonitoringRows]
  );

  const resetFilters = () => {
    setFilterYear(currentYearStr);
    setFilterMonth(currentMonthStr);
    setFilterDate('');
    setFilterUlp('ALL');
    setFilterPenyulang('ALL');
    setFilterRegu('ALL');
    setFilterStatus('ALL');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-transparent p-6 rounded-3xl border-2 border-teal-500/20 shadow-xs no-print">
        <div>
          <div className="flex items-center space-x-2.5 text-[#00A2B9] dark:text-teal-400">
            <BarChart3 className="w-6 h-6" />
            <h1 className="text-2xl font-black text-slate-900 dark:text-white font-display">
              Monitoring Realisasi Pekerjaan ROW
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Pemantauan akurat progres Work Order, Realisasi KMS, Tebang, dan Pangkas pohon secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl border border-teal-200 dark:border-teal-800 shadow-xs flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Unit: {settings.namaUnitLayanan || activeUnitId}
            </span>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 no-print">
        {/* Total Work Orders */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Work Order
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display flex items-baseline gap-1.5">
            {totalWOCount} <span className="text-xs font-bold text-slate-400">WO</span>
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{woSelesaiCount} Selesai</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-amber-500">{woProgressCount} Progress</span>
          </div>
        </div>

        {/* Realisasi KMS */}
        <div className="p-4 rounded-2xl bg-[#00A2B9]/10 dark:bg-teal-950/50 border border-[#00A2B9]/30 dark:border-teal-700 shadow-xs space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-[#008396] dark:text-teal-300 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Realisasi KMS</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-teal-900 dark:text-teal-100 font-display flex items-baseline gap-1.5">
            {grandTotalRealisasiKms} <span className="text-xs font-bold text-[#00A2B9]">KMS</span>
          </div>
          <div className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
            Target: {grandTotalTargetKms > 0 ? `${grandTotalTargetKms} KMS` : '50.20 KMS'}
          </div>
        </div>

        {/* Total Realisasi Titik */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Realisasi Titik
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display flex items-baseline gap-1.5">
            {grandTotalRealisasiTitik} <span className="text-xs font-bold text-slate-400">Titik</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            Total eksekusi lapangan
          </div>
        </div>

        {/* Total Tebang */}
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 shadow-xs space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <TreeDeciduous className="w-3 h-3" />
            <span>Total Tebang</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-900 dark:text-rose-200 font-display flex items-baseline gap-1.5">
            {grandTotalTebang} <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Pohon</span>
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
            Penebangan tuntas
          </div>
        </div>

        {/* Total Pangkas */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 shadow-xs space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Scissors className="w-3 h-3" />
            <span>Total Pangkas</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-200 font-display flex items-baseline gap-1.5">
            {grandTotalPotong} <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Titik/Pohon</span>
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            Pemangkasan dahan
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Cari Work Order / Petugas
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Nomor WO, Feeder, Regu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
              />
            </div>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Tahun
            </label>
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setFilterDate('');
              }}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
            >
              <option value="ALL">Semua Tahun</option>
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Bulan
            </label>
            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setFilterDate('');
              }}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
            >
              <option value="ALL">Semua Bulan</option>
              <option value="01">Januari</option>
              <option value="02">Februari</option>
              <option value="03">Maret</option>
              <option value="04">April</option>
              <option value="05">Mei</option>
              <option value="06">Juni</option>
              <option value="07">Juli</option>
              <option value="08">Agustus</option>
              <option value="09">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
            </select>
          </div>

          {/* Specific Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Tanggal Spesifik
            </label>
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
              />
            </div>
          </div>

          {/* ULP Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Filter ULP
            </label>
            <select
              value={filterUlp}
              onChange={(e) => {
                setFilterUlp(e.target.value);
                setFilterPenyulang('ALL');
                setFilterRegu('ALL');
              }}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
            >
              <option value="ALL">Semua ULP</option>
              {ulpList
                .filter(u => matchesUnit(u.unitId, u.namaULP))
                .map((u, idx) => (
                  <option key={`${u.id}-${idx}`} value={u.namaULP || u.id}>
                    {u.namaULP}
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Status WO
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
            >
              <option value="ALL">Semua Status</option>
              <option value="Selesai">Selesai</option>
              <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
              <option value="Belum Dikerjakan">Belum Dikerjakan</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-700/60">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Menampilkan <span className="font-bold text-slate-800 dark:text-slate-200">{woMonitoringRows.length}</span> Work Order
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/30 rounded-xl flex items-center space-x-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <TableIcon className="w-5 h-5 text-[#00A2B9] dark:text-teal-400" />
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              Tabel Monitoring Realisasi per Work Order ({woMonitoringRows.length})
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Terhubung HyperCloud & Offline Storage
          </span>
        </div>

        <div 
          ref={draggable1.ref}
          onMouseDown={draggable1.onMouseDown}
          onMouseUp={draggable1.onMouseUp}
          onMouseLeave={draggable1.onMouseLeave}
          onMouseMove={draggable1.onMouseMove}
          className="overflow-x-auto"
          style={draggable1.style}
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Nama Work Order</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">ULP & Feeder</th>
                <th className="py-3.5 px-4">Tim ROW / Petugas</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Realisasi KMS</th>
                <th className="py-3.5 px-4 text-center">Total Realisasi</th>
                <th className="py-3.5 px-4 text-center">Total Tebang</th>
                <th className="py-3.5 px-4 text-center">Total Pangkas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {woMonitoringRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                    Tidak ada data Work Order yang sesuai dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                woMonitoringRows.map((row, idx) => {
                  const isDone = isWOSelesai(row.status);
                  const inProgress = isWOInProgress(row.status);

                  return (
                    <tr
                      key={`${row.workOrder.id}-${idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {/* Nomor WO */}
                      <td className="py-3.5 px-4 font-bold text-[#008396] dark:text-teal-400">
                        <div className="flex flex-col">
                          <span className="text-xs font-black">{row.nomorWO}</span>
                          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {row.workOrder.jenisPekerjaan || 'Pemangkasan Pohon (ROW)'}
                          </span>
                        </div>
                      </td>

                      {/* Tanggal */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatDateDisplay(row.tanggal)}
                      </td>

                      {/* ULP & Feeder */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{row.ulpName}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">{row.penyulangName}</span>
                        </div>
                      </td>

                      {/* Regu / Petugas */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold">
                          <Users className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          {row.reguName}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            SELESAI
                          </span>
                        ) : inProgress ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <Clock className="w-3 h-3" />
                            PROGRESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600">
                            BELUM
                          </span>
                        )}
                      </td>

                      {/* Realisasi KMS */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-black text-[#008396] dark:text-teal-300 text-xs">
                          {row.realisasiKms.toFixed(2)} KMS
                        </span>
                        {row.targetKms > 0 && (
                          <span className="block text-[9px] text-slate-400">
                            Target: {row.targetKms.toFixed(2)} KMS
                          </span>
                        )}
                      </td>

                      {/* Realisasi Titik */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-[#00A2B9]/10 dark:bg-teal-950/80 text-[#008396] dark:text-teal-300 border border-[#00A2B9]/20 dark:border-teal-800">
                          {row.totalRealisasiTitik} Titik
                        </span>
                      </td>

                      {/* Total Tebang */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          {row.totalTebang} Pohon
                        </span>
                      </td>

                      {/* Total Pangkas */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                          {row.totalPotong} Titik/Pohon
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {woMonitoringRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-black border-t-2 border-slate-200 dark:border-slate-700">
                  <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                    Total Keseluruhan :
                  </td>
                  <td className="py-3.5 px-4 text-center text-[#008396] dark:text-teal-300">
                    {grandTotalRealisasiKms} KMS
                  </td>
                  <td className="py-3.5 px-4 text-center text-[#00A2B9] dark:text-teal-400">
                    {grandTotalRealisasiTitik} Titik
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-600 dark:text-rose-400">
                    {grandTotalTebang} Pohon
                  </td>
                  <td className="py-3.5 px-4 text-center text-amber-600 dark:text-amber-400">
                    {grandTotalPotong} Titik/Pohon
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
