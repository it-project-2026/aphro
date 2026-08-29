import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useToast } from '../hooks/useToast';
import { useGASSync } from '../context/GASSyncContext';
import {
  INDONESIAN_MONTHS,
  getDaysInMonth,
  DayDetail,
} from '../utils/holidaysIndonesia';
import {
  RekapHarianService,
} from '../services/rekapHarianService';
import {
  RekapItemData,
  exportRekapHarianToExcel,
} from '../utils/rekapExportService';
import {
  CalendarRange,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  Building2,
} from 'lucide-react';

export const RekapPenyulangHarianPage: React.FC = () => {
  const { settings } = useSettings();
  const { realisasiList } = useRealisasi();
  const { workOrders } = useWorkOrders();
  const { ulpList, penyulangList } = useMasterData();
  const { showToast } = useToast();
  const { syncWithGAS, isSyncing: isGASSyncing } = useGASSync();

  // ULP Filter inside selected UL
  const [selectedUlpFilter, setSelectedUlpFilter] = useState<string>('ALL');

  const selectedULKey = useMemo(() => {
    return RekapHarianService.normalizeUnitKey(settings.namaUnitLayanan || 'BUKITTINGGI');
  }, [settings.namaUnitLayanan]);

  // Date Selection State
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(() => new Date().getMonth());

  const [rekapRows, setRekapRows] = useState<RekapItemData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drag to scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Sync data
  const handleSyncData = async () => {
    try {
      setIsLoading(true);
      let currentRealisasi = realisasiList;
      let currentWorkOrders = workOrders;

      if (navigator.onLine) {
        showToast('Mengambil data terbaru dari Spreadsheet...', 'info');
        const freshData = await syncWithGAS();
        if (freshData) {
          if (Array.isArray(freshData.realisasi)) currentRealisasi = freshData.realisasi;
          if (Array.isArray(freshData.workOrders)) currentWorkOrders = freshData.workOrders;
        }
      }

      const updated = RekapHarianService.syncFromDataByPenyulang(
        selectedYear,
        selectedMonthIdx,
        rekapRows,
        currentRealisasi,
        currentWorkOrders
      );
      
      setRekapRows(updated);
      RekapHarianService.saveRekapPenyulangData(selectedULKey, selectedYear, selectedMonthIdx, updated);
      showToast('Data Rekap Penyulang diperbarui!', 'success');
    } catch (err) {
      console.error('Penyulang sync error:', err);
      showToast('Gagal sinkronisasi data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const daysInMonth: DayDetail[] = useMemo(() => {
    return getDaysInMonth(selectedYear, selectedMonthIdx);
  }, [selectedYear, selectedMonthIdx]);

  const monthName = INDONESIAN_MONTHS[selectedMonthIdx];

  const unitDisplayName = useMemo(() => `UL ${selectedULKey}`, [selectedULKey]);

  // Load Data
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const data = RekapHarianService.loadRekapPenyulangData(
        selectedULKey,
        selectedYear,
        selectedMonthIdx,
        realisasiList,
        ulpList,
        penyulangList,
        workOrders
      );
      setRekapRows(data);
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedULKey, selectedYear, selectedMonthIdx, realisasiList, ulpList, penyulangList, workOrders]);

  const availableUlps = useMemo(() => {
    const set = new Set<string>();
    rekapRows.forEach((r) => { if (r.namaUlp) set.add(r.namaUlp); });
    return Array.from(set);
  }, [rekapRows]);

  const filteredRows = useMemo(() => {
    let result = rekapRows;
    if (selectedUlpFilter !== 'ALL') {
      result = result.filter((r) => r.namaUlp === selectedUlpFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) => r.namaUlp.toLowerCase().includes(q) || r.timRow.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rekapRows, selectedUlpFilter, searchQuery]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      showToast('Menyiapkan Excel Rekap Penyulang...', 'info');
      await exportRekapHarianToExcel(
        `REKAP PENYULANG - ${unitDisplayName}`,
        selectedYear,
        monthName,
        daysInMonth,
        filteredRows,
        `UP3 ${selectedULKey}`,
        ''
      );
      showToast('Excel Rekap Penyulang berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast(`Gagal ekspor: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const grandTotalPerDay = useMemo(() => {
    const totals: Record<string, { targetKms: number; realisasiKms: number; tebang1: number; pangkas: number; total: number }> = {};
    daysInMonth.forEach((d) => {
      let tk = 0, rk = 0, t1 = 0, p = 0, tot = 0;
      filteredRows.forEach((row) => {
        const v = row.dailyValues[d.dayFormatted] || { targetKms: 0, realisasiKms: 0, tebang1: 0, pangkas: 0 };
        tk += v.targetKms || 0;
        rk += v.realisasiKms || 0;
        t1 += v.tebang1 || 0;
        p += v.pangkas || 0;
        tot += (v.tebang1 || 0) + (v.pangkas || 0);
      });
      totals[d.dayFormatted] = { targetKms: tk, realisasiKms: rk, tebang1: t1, pangkas: p, total: tot };
    });
    return totals;
  }, [daysInMonth, filteredRows]);

  const grandTotalsSummary = useMemo(() => {
    let grandVolume = 0, grandTarget = 0;
    filteredRows.forEach((row) => {
      let rowTot = 0;
      daysInMonth.forEach((d) => {
        const v = row.dailyValues[d.dayFormatted] || { realisasiKms: 0 };
        rowTot += (v.realisasiKms || 0);
      });
      grandVolume += rowTot;
      grandTarget += 50.20;
    });
    const sisa = grandTarget - grandVolume;
    const percent = grandTarget > 0 ? (grandVolume / grandTarget) * 100 : 0;
    return { volume: grandVolume, sisa, percent: Math.round(percent) };
  }, [daysInMonth, filteredRows]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 dark:bg-cyan-950/60 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-black uppercase tracking-wider">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Rekap Penyulang Harian</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              REKAP PENYULANG {unitDisplayName.replace(/^UL\s+/i, '')}
            </h1>
            <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 tracking-wide uppercase flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>PER TANGGAL {monthName} {selectedYear}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5">
              <button
                type="button"
                onClick={() => selectedMonthIdx > 0 ? setSelectedMonthIdx(selectedMonthIdx - 1) : (setSelectedMonthIdx(11), setSelectedYear(selectedYear - 1))}
                className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select value={selectedMonthIdx} onChange={(e) => setSelectedMonthIdx(Number(e.target.value))} className="bg-transparent text-sm font-black focus:outline-none cursor-pointer">
                {INDONESIAN_MONTHS.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
              </select>
              <button
                type="button"
                onClick={() => selectedMonthIdx < 11 ? setSelectedMonthIdx(selectedMonthIdx + 1) : (setSelectedMonthIdx(0), setSelectedYear(selectedYear + 1))}
                className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleSyncData}
              disabled={isLoading || isGASSyncing}
              className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isGASSyncing ? 'animate-spin' : ''}`} />
              <span>SINKRONISASI</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-600 dark:text-slate-300">Filter ULP:</span>
              <select
                value={selectedUlpFilter}
                onChange={(e) => setSelectedUlpFilter(e.target.value)}
                className="bg-transparent font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua ULP</option>
                {availableUlps.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-red-600 text-white font-black text-[11px] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Sabtu, Minggu & Libur Nasional (Merah)</span>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[700px] select-none scrollbar-thin cursor-grab"
             ref={scrollContainerRef}
             onMouseDown={handleMouseDown}
             onMouseLeave={handleMouseLeave}
             onMouseUp={handleMouseUp}
             onMouseMove={handleMouseMove}
        >
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-30 bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black shadow-md border-b-2 border-slate-400 dark:border-slate-700">
              <tr>
                <th rowSpan={3} className="sticky left-0 z-40 bg-slate-300 dark:bg-slate-800 px-3 py-2 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase min-w-[70px]">NO. URUT</th>
                <th rowSpan={3} className="sticky left-[70px] z-40 bg-slate-300 dark:bg-slate-800 px-4 py-2 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase min-w-[170px]">NAMA ULP</th>
                <th rowSpan={3} className="sticky left-[240px] z-40 bg-slate-300 dark:bg-slate-800 px-3 py-2 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase min-w-[190px]">NAMA PENYULANG</th>
                {daysInMonth.map((d) => (
                  <th key={`h-${d.dayFormatted}`} colSpan={5} className={`px-1 py-1.5 border-r border-b text-center uppercase text-[11px] ${d.isRedDay ? 'bg-red-600 text-white border-red-700' : 'border-slate-400 dark:border-slate-700'}`}>
                    {d.dayName}
                  </th>
                ))}
                <th rowSpan={3} className="px-3 py-2 bg-slate-300 dark:bg-slate-800 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase min-w-[70px]">TOTAL</th>
                <th rowSpan={3} className="px-3 py-2 bg-slate-300 dark:bg-slate-800 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase min-w-[65px]">SISA</th>
                <th rowSpan={3} className="px-3 py-2 bg-slate-300 dark:bg-slate-800 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase min-w-[55px]">%</th>
                <th rowSpan={3} className="px-4 py-2 bg-slate-300 dark:bg-slate-800 border-b border-slate-400 dark:border-slate-700 text-center uppercase min-w-[130px]">KET</th>
              </tr>
              <tr>
                {daysInMonth.map((d) => (
                  <th key={`hn-${d.dayFormatted}`} colSpan={5} className={`px-1 py-1 border-r border-b text-center text-xs ${d.isRedDay ? 'bg-red-600 text-white border-red-700' : 'border-slate-400 dark:border-slate-700'}`}>
                    {d.dayFormatted}
                  </th>
                ))}
              </tr>
              <tr>
                {daysInMonth.map((d) => (
                  <React.Fragment key={`hs-${d.dayFormatted}`}>
                    <th className={`px-1 py-1 border-r border-b text-center text-[8px] min-w-[38px] ${d.isRedDay ? 'bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-850'}`}>TARGET KMS</th>
                    <th className={`px-1 py-1 border-r border-b text-center text-[8px] min-w-[38px] ${d.isRedDay ? 'bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-850'}`}>REALISASI KMS</th>
                    <th className={`px-1 py-1 border-r border-b text-center text-[9px] min-w-[42px] ${d.isRedDay ? 'bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-850'}`}>TEBANG</th>
                    <th className={`px-1 py-1 border-r border-b text-center text-[9px] min-w-[42px] ${d.isRedDay ? 'bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-850'}`}>PANGKAS</th>
                    <th className={`px-1 py-1 border-r border-b text-center font-black text-[9px] min-w-[45px] ${d.isRedDay ? 'bg-red-700 text-white' : 'bg-slate-300 dark:bg-slate-800 text-cyan-600'}`}>TOTAL</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRows.map((row, rIdx) => {
                let rowVolumeSum = 0;
                daysInMonth.forEach((d) => {
                  const val = row.dailyValues[d.dayFormatted] || { realisasiKms: 0 };
                  rowVolumeSum += (val.realisasiKms || 0);
                });
                const target = 50.20;
                const sisa = target - rowVolumeSum;
                const percent = (rowVolumeSum / target) * 100;

                return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group">
                    <td className="sticky left-0 z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 px-2 py-2 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold">{row.noUrut ?? (rIdx + 1)}</td>
                    <td className="sticky left-[70px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 px-3 py-2 border-r border-slate-200 dark:border-slate-800 font-bold whitespace-nowrap">{row.namaUlp}</td>
                    <td className="sticky left-[240px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 px-3 py-2 border-r border-slate-200 dark:border-slate-800 font-extrabold text-cyan-600 whitespace-nowrap">{row.timRow}</td>
                    {daysInMonth.map((d) => {
                      const val = row.dailyValues[d.dayFormatted] || { tebang1: 0, pangkas: 0, targetKms: 0, realisasiKms: 0 };
                      const dayTotal = (val.tebang1 || 0) + (val.pangkas || 0);
                      if (d.isRedDay) {
                        return (
                          <React.Fragment key={`c-${row.id}-${d.dayFormatted}`}>
                            <td className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[10px]">{val.targetKms > 0 ? val.targetKms : ''}</td>
                            <td className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[10px]">{val.realisasiKms > 0 ? val.realisasiKms : ''}</td>
                            <td className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[11px]">{val.tebang1 > 0 ? val.tebang1 : ''}</td>
                            <td className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[11px]">{val.pangkas > 0 ? val.pangkas : ''}</td>
                            <td className="px-1 py-1.5 border-r border-red-800 bg-red-700 text-white text-center font-black text-[11px]">{dayTotal > 0 ? dayTotal : ''}</td>
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={`c-${row.id}-${d.dayFormatted}`}>
                          <td className="px-1 py-1.5 border-r border-slate-200 text-center font-mono text-cyan-600 font-bold text-[10px]">{val.targetKms > 0 ? val.targetKms.toFixed(2) : ''}</td>
                          <td className={`px-1 py-1.5 border-r border-slate-200 text-center font-mono font-bold text-[10px] ${val.targetKms > 0 && val.realisasiKms < val.targetKms ? 'text-red-600' : 'text-cyan-600'}`}>{val.realisasiKms > 0 ? val.realisasiKms.toFixed(2) : (val.targetKms > 0 ? '0.00' : '')}</td>
                          <td className="px-1 py-1.5 border-r border-slate-200 text-center font-mono">{val.tebang1 > 0 ? val.tebang1 : ''}</td>
                          <td className="px-1 py-1.5 border-r border-slate-200 text-center font-mono">{val.pangkas > 0 ? val.pangkas : ''}</td>
                          <td className="px-1 py-1.5 border-r border-slate-300 bg-slate-50 text-center font-mono font-bold text-cyan-600">{dayTotal > 0 ? dayTotal : ''}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-2 py-2 border-r border-slate-200 text-center font-mono font-black bg-slate-50">{rowVolumeSum.toFixed(2)}</td>
                    <td className="px-2 py-2 border-r border-slate-200 text-center font-mono font-bold bg-slate-50">{sisa.toFixed(2)}</td>
                    <td className="px-2 py-2 border-r border-slate-200 text-center font-mono font-bold bg-slate-50">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${percent >= 100 ? 'bg-cyan-100 text-cyan-700' : percent >= 75 ? 'bg-cyan-50 text-cyan-600' : 'bg-amber-100 text-amber-700'}`}>
                        {percent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-left text-[11px] truncate max-w-[150px]">{row.keterangan || '-'}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-white font-black border-t-2 border-slate-400">
                <td className="sticky left-0 z-20 bg-slate-300 px-2 py-2.5 border-r border-slate-400 text-center">-</td>
                <td colSpan={2} className="sticky left-[70px] z-20 bg-slate-300 px-4 py-2.5 border-r border-slate-400 uppercase">TOTAL UP3 {selectedULKey}</td>
                {daysInMonth.map((d) => {
                  const daySum = grandTotalPerDay[d.dayFormatted] || { targetKms: 0, realisasiKms: 0, tebang1: 0, pangkas: 0, total: 0 };
                  return (
                    <React.Fragment key={`s-${d.dayFormatted}`}>
                      <td className="px-1 py-1.5 border-r border-slate-400 text-center font-mono text-[9px] text-cyan-700 font-bold">{daySum.targetKms.toFixed(2)}</td>
                      <td className="px-1 py-1.5 border-r border-slate-400 text-center font-mono text-[9px] text-cyan-600 font-bold">{daySum.realisasiKms.toFixed(2)}</td>
                      <td className="px-1 py-1.5 border-r border-slate-400 text-center font-mono text-[10px]">{daySum.tebang1}</td>
                      <td className="px-1 py-1.5 border-r border-slate-400 text-center font-mono text-[10px]">{daySum.pangkas}</td>
                      <td className="px-1 py-1.5 border-r border-slate-400 text-center font-mono font-black text-[11px] bg-slate-400/40">{daySum.total}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-2 py-2.5 border-r border-slate-400 text-center font-mono font-black text-xs text-cyan-700">{grandTotalsSummary.volume.toFixed(2)} KMS</td>
                <td className="px-2 py-2.5 border-r border-slate-400 text-center font-mono font-bold text-xs text-slate-700">{grandTotalsSummary.sisa.toFixed(2)} KMS</td>
                <td className="px-2 py-2.5 border-r border-slate-400 text-center font-mono font-black text-xs text-cyan-700">{grandTotalsSummary.percent}%</td>
                <td className="px-4 py-2.5">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
