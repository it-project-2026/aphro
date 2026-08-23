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
import { SyncService } from '../services/syncService';
import { getActiveGasConfig } from '../config/gasConfig';
import {
  CalendarRange,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Filter,
  Save,
  CheckCircle2,
  RotateCcw,
  Database,
  Building2,
} from 'lucide-react';

export const RekapPekerjaanHarianPage: React.FC = () => {
  const { settings } = useSettings();
  const { realisasiList } = useRealisasi();
  const { workOrders } = useWorkOrders();
  const { ulpList, reguList, setMasterData } = useMasterData();
  const { showToast } = useToast();
  const { syncWithGAS, isSyncing: isGASSyncing } = useGASSync();

  // Unit Layanan (UL) Selection
  const [activeUL, setActiveUL] = useState<string>(() => {
    const fromSettings = settings.namaUnitLayanan || 'BUKITTINGGI';
    return RekapHarianService.normalizeUnitKey(fromSettings);
  });

  const selectedULKey = useMemo(() => activeUL, [activeUL]);

  // ULP Filter inside selected UL ('ALL' or specific ULP name)
  const [selectedUlpFilter, setSelectedUlpFilter] = useState<string>('ALL');

  // Date Selection State
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const d = new Date();
    return d.getFullYear();
  });
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(() => {
    const d = new Date();
    return d.getMonth();
  });

  const [rekapRows, setRekapRows] = useState<RekapItemData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncingMaster, setIsSyncingMaster] = useState<boolean>(false);
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

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll-fast factor
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Sync data with Realisasi & Work Order Context (Manual Trigger)
  const handleSyncData = async () => {
    try {
      setIsLoading(true);
      let currentRealisasi = realisasiList;
      let currentWorkOrders = workOrders;

      // 1. Ambil data terbaru dari Spreadsheet jika online
      if (navigator.onLine) {
        showToast('Mengambil data terbaru dari Spreadsheet...', 'info');
        const freshData = await syncWithGAS();
        if (freshData) {
          if (Array.isArray(freshData.realisasi)) currentRealisasi = freshData.realisasi;
          if (Array.isArray(freshData.workOrders)) currentWorkOrders = freshData.workOrders;
          
          // If we got fresh master data, update the context
          if (freshData.masterData) {
            setMasterData(freshData.masterData);
          }
        }
      }

      // 2. Jalankan sinkronisasi lokal menggunakan data terbaru
      // Kita ambil rows dari state yang paling mutakhir
      const updated = RekapHarianService.syncFromData(
        selectedYear,
        selectedMonthIdx,
        rekapRows,
        currentRealisasi,
        currentWorkOrders
      );
      
      setRekapRows(updated);
      RekapHarianService.saveRekapData(selectedULKey, selectedYear, selectedMonthIdx, updated);
      showToast('Data berhasil disinkronkan dan diperbarui!', 'success');
    } catch (err) {
      console.error('Manual sync error:', err);
      showToast('Gagal sinkronisasi data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const [editingRowConfig, setEditingRowConfig] = useState<{
    id: string;
    target: number;
    keterangan: string;
    timRow: string;
    namaUlp: string;
  } | null>(null);

  // Modal for adding custom row
  const [showAddRowModal, setShowAddRowModal] = useState<boolean>(false);
  const [newRowData, setNewRowData] = useState({
    namaUlp: '',
    timRow: '',
    target: 200,
  });

  // Calculate dynamic days in selected month with holiday detection
  const daysInMonth: DayDetail[] = useMemo(() => {
    return getDaysInMonth(selectedYear, selectedMonthIdx);
  }, [selectedYear, selectedMonthIdx]);

  const monthName = INDONESIAN_MONTHS[selectedMonthIdx];

  // Active UL display label
  const unitDisplayName = useMemo(() => {
    if (activeUL === 'PADANG') return 'UL PADANG';
    if (activeUL === 'PAYAKUMBUH') return 'UL PAYAKUMBUH';
    if (activeUL === 'SOLOK') return 'UL SOLOK';
    if (activeUL === 'BUKITTINGGI') return 'UL BUKITTINGGI';
    return `UL ${activeUL}`;
  }, [activeUL]);

  // Load Data when UL, Year, or Month changes
  useEffect(() => {
    setIsLoading(true);
    // Add a small delay to ensure contexts are settled
    const timer = setTimeout(() => {
      const data = RekapHarianService.loadRekapData(
        selectedULKey,
        selectedYear,
        selectedMonthIdx,
        realisasiList,
        ulpList,
        reguList,
        workOrders
      );
      setRekapRows(data);
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedULKey, selectedYear, selectedMonthIdx, realisasiList, ulpList, reguList, workOrders]);

  // Save changes to localStorage
  const handleSaveData = (updated: RekapItemData[]) => {
    // Re-index No. Urut sequentially 1..N
    const indexed = updated.map((r, idx) => ({
      ...r,
      noUrut: idx + 1,
    }));
    setRekapRows(indexed);
    RekapHarianService.saveRekapData(selectedULKey, selectedYear, selectedMonthIdx, indexed);
  };

  // Sync Master Data (ULP & Regu ROW) directly from Google Spreadsheet
  const handleSyncMasterSpreadsheet = async () => {
    try {
      setIsSyncingMaster(true);
      showToast('Menghubungi Google Spreadsheet untuk memuat Master ULP & Regu...', 'info');
      await syncWithGAS();
      showToast('Master data & Realisasi berhasil ditarik dari Spreadsheet!', 'success');
    } catch (err: any) {
      console.warn('Sync Master Spreadsheet error:', err);
      showToast('Gagal menarik data dari Spreadsheet.', 'error');
    } finally {
      setIsSyncingMaster(false);
    }
  };

  // Reset to default rows for the active Unit Layanan
  const handleResetToDefault = () => {
    if (window.confirm(`Kembalikan susunan tabel ke susunan master ULP & Regu untuk ${unitDisplayName}?`)) {
      const defaultRows = RekapHarianService.getDefaultRowsForUnit(selectedULKey, ulpList, reguList);
      const reset: RekapItemData[] = defaultRows.map((def, idx) => ({
        id: def.id,
        noUrut: idx + 1,
        kodeUnit: def.kodeUnit,
        namaUlp: def.namaUlp,
        timRow: def.timRow,
        target: def.target,
        keterangan: '',
        dailyValues: {},
      }));
      handleSaveData(reset);
      showToast(`Susunan tabel telah disesuaikan dengan Master Data ${unitDisplayName}.`, 'info');
    }
  };

  // Save row config (target & keterangan)
  const handleSaveRowConfig = () => {
    if (!editingRowConfig) return;
    const updated = rekapRows.map((row) => {
      if (row.id === editingRowConfig.id) {
        return {
          ...row,
          target: Number(editingRowConfig.target) || 0,
          keterangan: editingRowConfig.keterangan || '',
        };
      }
      return row;
    });
    handleSaveData(updated);
    setEditingRowConfig(null);
    showToast('Target dan Keterangan tim berhasil diperbarui.', 'success');
  };

  // Add new row
  const handleAddRow = () => {
    if (!newRowData.timRow || !newRowData.namaUlp) {
      showToast('Harap lengkapi nama ULP dan Tim ROW!', 'warning');
      return;
    }
    const newSeq = rekapRows.length + 1;
    const newRow: RekapItemData = {
      id: 'row-' + Date.now(),
      noUrut: newSeq,
      kodeUnit: '',
      namaUlp: newRowData.namaUlp.toUpperCase(),
      timRow: newRowData.timRow,
      target: Number(newRowData.target) || 200,
      keterangan: '',
      dailyValues: {},
    };
    handleSaveData([...rekapRows, newRow]);
    setShowAddRowModal(false);
    setNewRowData({ namaUlp: '', timRow: '', target: 200 });
    showToast(`Tim ${newRow.timRow} berhasil ditambahkan ke tabel!`, 'success');
  };

  // Delete a row
  const handleDeleteRow = (id: string, name: string) => {
    if (window.confirm(`Hapus baris ${name} dari rekap harian?`)) {
      const updated = rekapRows.filter((r) => r.id !== id);
      handleSaveData(updated);
      showToast(`Baris ${name} telah dihapus.`, 'info');
    }
  };

  // Unique list of ULPs currently in the table for filtering & adding
  const availableUlps = useMemo(() => {
    const set = new Set<string>();
    rekapRows.forEach((r) => {
      if (r.namaUlp) set.add(r.namaUlp);
    });
    return Array.from(set);
  }, [rekapRows]);

  // Filtered rows (by ULP dropdown and search query)
  const filteredRows = useMemo(() => {
    let result = rekapRows;
    if (selectedUlpFilter !== 'ALL') {
      result = result.filter((r) => r.namaUlp === selectedUlpFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.namaUlp.toLowerCase().includes(q) ||
          r.timRow.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rekapRows, selectedUlpFilter, searchQuery]);

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      showToast('Menyiapkan berkas Excel laporan rekap...', 'info');
      const summaryHeader = `UP3 ${selectedULKey}`;
      await exportRekapHarianToExcel(
        unitDisplayName,
        selectedYear,
        monthName,
        daysInMonth,
        filteredRows,
        summaryHeader,
        ''
      );
      showToast('File Excel Rekap Pekerjaan Harian berhasil diunduh!', 'success');
    } catch (err: any) {
      console.error('Export Excel failed:', err);
      showToast(`Gagal mengekspor Excel: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  // Compute Grand Totals across visible/filtered rows
  const grandTotalPerDay = useMemo(() => {
    const totals: Record<string, { targetKms: number; realisasiKms: number; tebang1: number; pangkas: number; tebang2: number; total: number }> = {};
    daysInMonth.forEach((d) => {
      let tk = 0;
      let rk = 0;
      let t1 = 0;
      let p = 0;
      let t2 = 0;
      let tot = 0;
      filteredRows.forEach((row) => {
        const v = row.dailyValues[d.dayFormatted] || { targetKms: 0, realisasiKms: 0, tebang1: 0, pangkas: 0, tebang2: 0 };
        tk += v.targetKms || 0;
        rk += v.realisasiKms || 0;
        t1 += v.tebang1 || 0;
        p += v.pangkas || 0;
        t2 += v.tebang2 || 0;
        tot += (v.tebang1 || 0) + (v.pangkas || 0); // Only sum tebang1 and pangkas as per request
      });
      totals[d.dayFormatted] = { targetKms: tk, realisasiKms: rk, tebang1: t1, pangkas: p, tebang2: t2, total: tot };
    });
    return totals;
  }, [daysInMonth, filteredRows]);

  const grandTotalsSummary = useMemo(() => {
    let grandVolume = 0;
    let grandTarget = 0;

    filteredRows.forEach((row) => {
      let rowTot = 0;
      daysInMonth.forEach((d) => {
        const v = row.dailyValues[d.dayFormatted] || { tebang1: 0, pangkas: 0, tebang2: 0 };
        rowTot += (v.tebang1 || 0) + (v.pangkas || 0) + (v.tebang2 || 0);
      });
      grandVolume += rowTot;
      grandTarget += row.target || 0;
    });

    const sisa = grandTarget > 0 ? Math.max(0, grandTarget - grandVolume) : 0;
    const percent = grandTarget > 0 ? Math.round((grandVolume / grandTarget) * 100) : 0;

    return {
      volume: grandVolume,
      target: grandTarget,
      sisa,
      percent,
    };
  }, [daysInMonth, filteredRows]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          
          {/* Title and Identification */}
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00A2B9]/10 dark:bg-teal-950/60 border border-[#00A2B9]/20 dark:border-teal-800/80 text-[#00A2B9] dark:text-teal-400 text-xs font-black uppercase tracking-wider">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Matriks Rekap Pekerjaan Harian</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              LAPORAN HARIAN TIM ROW {unitDisplayName.replace(/^UL\s+/i, '')}
            </h1>
            <p className="text-sm font-bold text-[#00A2B9] dark:text-teal-400 tracking-wide uppercase flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>PER TANGGAL {monthName} {selectedYear}</span>
            </p>
          </div>

          {/* Month & Year Selectors & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* UL Selection Dropdown */}
            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 shadow-sm">
              <Building2 className="w-4 h-4 text-[#00A2B9] dark:text-teal-400" />
              <select
                value={activeUL}
                onChange={(e) => {
                  setActiveUL(e.target.value);
                  setIsLoading(true);
                }}
                className="bg-transparent font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer text-sm"
              >
                <option value="BUKITTINGGI">UL BUKITTINGGI</option>
                <option value="PADANG">UL PADANG</option>
                <option value="PAYAKUMBUH">UL PAYAKUMBUH</option>
                <option value="SOLOK">UL SOLOK</option>
              </select>
            </div>

            {/* Month Dropdown */}
            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5">
              <button
                type="button"
                onClick={() => {
                  if (selectedMonthIdx > 0) {
                    setSelectedMonthIdx(selectedMonthIdx - 1);
                  } else {
                    setSelectedMonthIdx(11);
                    setSelectedYear(selectedYear - 1);
                  }
                }}
                className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonthIdx}
                onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
                className="bg-transparent text-xs sm:text-sm font-black text-slate-900 dark:text-white px-2 py-1 focus:outline-none cursor-pointer"
              >
                {INDONESIAN_MONTHS.map((m, idx) => (
                  <option key={idx} value={idx} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-xs sm:text-sm font-black text-slate-900 dark:text-white px-2 py-1 focus:outline-none cursor-pointer border-l border-slate-300 dark:border-slate-700"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (selectedMonthIdx < 11) {
                    setSelectedMonthIdx(selectedMonthIdx + 1);
                  } else {
                    setSelectedMonthIdx(0);
                    setSelectedYear(selectedYear + 1);
                  }
                }}
                className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Sync Data Button */}
            <button
              type="button"
              onClick={handleSyncData}
              disabled={isLoading || isGASSyncing}
              className="px-4 py-2.5 rounded-2xl bg-[#00A2B9] hover:bg-[#008396] text-white text-xs font-black flex items-center space-x-2 shadow-lg shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isGASSyncing ? 'animate-spin' : ''}`} />
              <span>{isGASSyncing ? 'SINKRONISASI GAS...' : 'SINKRONISASI DATA'}</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-2xl bg-[#008396] hover:bg-[#00A2B9] text-white text-xs sm:text-sm font-black flex items-center space-x-2 shadow-lg shadow-teal-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Mengekspor...' : 'Export Excel (.xlsx)'}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex items-center space-x-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>

        {/* Toolbar: ULP Filter, Realisasi Sync, Add Tim, Reset */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* ULP Filter and Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="font-bold text-slate-600 dark:text-slate-300">Filter ULP:</span>
              <select
                value={selectedUlpFilter}
                onChange={(e) => setSelectedUlpFilter(e.target.value)}
                className="bg-transparent font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  Semua ULP ({availableUlps.length} ULP)
                </option>
                {availableUlps.map((u) => (
                  <option key={u} value={u} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Legend Badge */}
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-red-600 text-white font-black text-[11px] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Sabtu, Minggu & Libur Nasional (Merah)</span>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncMasterSpreadsheet}
              disabled={isSyncingMaster}
              className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-300 dark:border-teal-800 text-[#00A2B9] dark:text-teal-300 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Sinkronkan susunan ULP & Tim ROW (Regu) langsung dari Google Spreadsheet"
            >
              <Database className={`w-3.5 h-3.5 ${isSyncingMaster ? 'animate-spin' : ''}`} />
              <span>{isSyncingMaster ? 'Memuat Master...' : 'Tarik Master ULP & Regu'}</span>
            </button>

            <button
              type="button"
              onClick={handleSyncData}
              className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 text-[#00A2B9] dark:text-teal-400 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Sinkronkan dengan data Realisasi Lapangan"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tarik Realisasi Lapangan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewRowData({
                  namaUlp: availableUlps[0] || `ULP ${selectedULKey}`,
                  timRow: `TIM ROW ${rekapRows.length + 1}`,
                  target: 200,
                });
                setShowAddRowModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Tim</span>
            </button>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
              title="Reset ke susunan master ULP & Regu"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Master</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Container (Spreadsheet Matrix) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        
        {/* Printable Title (visible in print mode) */}
        <div className="hidden print:block p-6 text-center space-y-1 border-b border-black">
          <h2 className="text-xl font-bold uppercase">LAPORAN HARIAN TIM ROW {unitDisplayName}</h2>
          <h3 className="text-base font-bold uppercase">PER TANGGAL {monthName} {selectedYear}</h3>
        </div>

        {/* Matrix Table with Horizontal & Vertical Scrolling */}
        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`overflow-x-auto overflow-y-auto max-h-[700px] select-none scrollbar-thin ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <table className="w-full border-collapse text-xs font-sans">
            {/* Multi-level Headers */}
            <thead className="sticky top-0 z-30 bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black shadow-md border-b-2 border-slate-400 dark:border-slate-700">
              {/* Header Row 1: Day Names */}
              <tr>
                <th
                  rowSpan={3}
                  className="sticky left-0 z-40 bg-slate-300 dark:bg-slate-800 px-3 py-2 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase tracking-wider min-w-[70px]"
                >
                  NO. URUT
                </th>
                <th
                  rowSpan={3}
                  className="sticky left-[70px] z-40 bg-slate-300 dark:bg-slate-800 px-4 py-2 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase tracking-wider min-w-[170px]"
                >
                  NAMA ULP
                </th>
                <th
                  rowSpan={3}
                  className="sticky left-[240px] z-40 bg-slate-300 dark:bg-slate-800 px-3 py-2 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase tracking-wider min-w-[190px]"
                >
                  TIM ROW (NAMA REGU)
                </th>

                {/* Day Name Columns */}
                {daysInMonth.map((d) => (
                  <th
                    key={`header-dayname-${d.dayFormatted}`}
                    colSpan={6}
                    className={`px-1 py-1.5 border-r border-b text-center font-black uppercase text-[11px] tracking-wider ${
                      d.isRedDay
                        ? 'bg-red-600 text-white border-red-700'
                        : 'border-slate-400 dark:border-slate-700'
                    }`}
                    title={d.holidayName || (d.isWeekend ? 'Akhir Pekan' : undefined)}
                  >
                    {d.dayName}
                  </th>
                ))}

                {/* Summary Headers */}
                <th
                  rowSpan={3}
                  className="px-3 py-2 bg-slate-300 dark:bg-slate-800 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase font-black min-w-[70px]"
                >
                  TOTAL
                </th>
                <th
                  rowSpan={3}
                  className="px-3 py-2 bg-slate-300 dark:bg-slate-800 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase font-black min-w-[65px]"
                >
                  SISA
                </th>
                <th
                  rowSpan={3}
                  className="px-3 py-2 bg-slate-300 dark:bg-slate-800 border-r border-b border-slate-400 dark:border-slate-700 text-center uppercase font-black min-w-[55px]"
                >
                  %
                </th>
                <th
                  rowSpan={3}
                  className="px-4 py-2 bg-slate-300 dark:bg-slate-800 border-b border-slate-400 dark:border-slate-700 text-center uppercase font-black min-w-[130px]"
                >
                  KET
                </th>
              </tr>

              {/* Header Row 2: Date Numbers (01, 02, 03, ...) */}
              <tr>
                {daysInMonth.map((d) => (
                  <th
                    key={`header-daynum-${d.dayFormatted}`}
                    colSpan={5}
                    className={`px-1 py-1 border-r border-b text-center font-black text-xs ${
                      d.isRedDay
                        ? 'bg-red-600 text-white border-red-700'
                        : 'border-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {d.dayFormatted}
                  </th>
                ))}
              </tr>

              {/* Header Row 3: Sub-columns (TARGET KMS | REALISASI KMS | TEBANG | PANGKAS | TEBANG | TOTAL) */}
              <tr>
                {daysInMonth.map((d) => (
                  <React.Fragment key={`header-subcols-${d.dayFormatted}`}>
                    <th
                      className={`px-1 py-1 border-r border-b text-center font-bold text-[8px] min-w-[38px] ${
                        d.isRedDay
                          ? 'bg-red-600 text-white border-red-700'
                          : 'border-slate-400 dark:border-slate-700 bg-slate-200 dark:bg-slate-850'
                      }`}
                    >
                      TARGET KMS
                    </th>
                    <th
                      className={`px-1 py-1 border-r border-b text-center font-bold text-[8px] min-w-[38px] ${
                        d.isRedDay
                          ? 'bg-red-600 text-white border-red-700'
                          : 'border-slate-400 dark:border-slate-700 bg-slate-200 dark:bg-slate-850'
                      }`}
                    >
                      REALISASI KMS
                    </th>
                    <th
                      className={`px-1 py-1 border-r border-b text-center font-bold text-[9px] min-w-[42px] ${
                        d.isRedDay
                          ? 'bg-red-600 text-white border-red-700'
                          : 'border-slate-400 dark:border-slate-700 bg-slate-200 dark:bg-slate-850'
                      }`}
                    >
                      TEBANG
                    </th>
                    <th
                      className={`px-1 py-1 border-r border-b text-center font-bold text-[9px] min-w-[42px] ${
                        d.isRedDay
                          ? 'bg-red-600 text-white border-red-700'
                          : 'border-slate-400 dark:border-slate-700 bg-slate-200 dark:bg-slate-850'
                      }`}
                    >
                      PANGKAS
                    </th>
                    <th
                      className={`px-1 py-1 border-r border-b text-center font-black text-[9px] min-w-[45px] ${
                        d.isRedDay
                          ? 'bg-red-700 text-white border-red-800'
                          : 'border-slate-400 dark:border-slate-700 bg-slate-300 dark:bg-slate-800 text-teal-700 dark:text-teal-300'
                      }`}
                    >
                      TOTAL
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRows.map((row, rIdx) => {
                // Calculate Total for this row
                let rowVolumeSum = 0;
                daysInMonth.forEach((d) => {
                  const val = row.dailyValues[d.dayFormatted] || { tebang1: 0, pangkas: 0, tebang2: 0 };
                  rowVolumeSum += (val.tebang1 || 0) + (val.pangkas || 0) + (val.tebang2 || 0);
                });

                const target = row.target || 0;
                const sisa = target > 0 ? Math.max(0, target - rowVolumeSum) : 0;
                const percent = target > 0 ? Math.round((rowVolumeSum / target) * 100) : 0;

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Sticky Left Column: NO. URUT */}
                    <td className="sticky left-0 z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-850 px-2 py-2 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {row.noUrut ?? (rIdx + 1)}
                    </td>

                    {/* Sticky Left Column: NAMA ULP */}
                    <td className="sticky left-[70px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-850 px-3 py-2 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {row.namaUlp}
                    </td>

                    {/* Sticky Left Column: TIM ROW (NAMA REGU) */}
                    <td className="sticky left-[240px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-850 px-3 py-2 border-r border-slate-200 dark:border-slate-800 font-extrabold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span>{row.timRow}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingRowConfig({
                              id: row.id,
                              target: row.target,
                              keterangan: row.keterangan || '',
                              timRow: row.timRow,
                              namaUlp: row.namaUlp,
                            })
                          }
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-400 hover:text-slate-200 transition-opacity cursor-pointer"
                          title="Ubah Target / Keterangan"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Daily Sub-columns */}
                    {daysInMonth.map((d) => {
                      const val = row.dailyValues[d.dayFormatted] || { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
                      const dayTotal = (val.tebang1 || 0) + (val.pangkas || 0); // User requested: TEBANG + PANGKAS

                      if (d.isRedDay) {
                        // MERAH Solid untuk Hari Libur & Akhir Pekan
                        return (
                          <React.Fragment key={`cell-${row.id}-${d.dayFormatted}`}>
                            <td
                              className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[10px]"
                            >
                              {val.targetKms > 0 ? val.targetKms : ''}
                            </td>
                            <td
                              className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[10px]"
                            >
                              {val.realisasiKms > 0 ? val.realisasiKms : ''}
                            </td>
                            <td
                              className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[11px]"
                              title={`${d.dayName}, ${d.dayFormatted} ${monthName}: ${d.holidayName || 'Hari Libur / Weekend'}`}
                            >
                              {val.tebang1 > 0 ? val.tebang1 : ''}
                            </td>
                            <td
                              className="px-1 py-1.5 border-r border-red-700 bg-red-600 text-white text-center font-bold text-[11px]"
                              title={`${d.dayName}, ${d.dayFormatted} ${monthName}: ${d.holidayName || 'Hari Libur / Weekend'}`}
                            >
                              {val.pangkas > 0 ? val.pangkas : ''}
                            </td>
                            <td
                              className="px-1 py-1.5 border-r border-red-800 bg-red-700 text-white text-center font-black text-[11px]"
                              title={`${d.dayName}, ${d.dayFormatted} ${monthName}: Total Libur`}
                            >
                              {dayTotal > 0 ? dayTotal : ''}
                            </td>
                          </React.Fragment>
                        );
                      }

                      // Hari Kerja Standar
                      return (
                        <React.Fragment key={`cell-${row.id}-${d.dayFormatted}`}>
                          <td
                            className="px-1 py-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-[#008396] dark:text-teal-400 font-bold text-[10px]"
                          >
                            {val.targetKms > 0 ? val.targetKms.toFixed(2) : ''}
                          </td>
                          <td
                            className={`px-1 py-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-[10px] ${
                              val.targetKms > 0 && val.realisasiKms < val.targetKms
                                ? 'text-red-600 dark:text-red-400'
                                : val.realisasiKms > 0 
                                  ? 'text-teal-600 dark:text-teal-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {val.realisasiKms > 0 ? val.realisasiKms.toFixed(2) : '0.00'}
                          </td>
                          <td
                            className="px-1 py-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-slate-800 dark:text-slate-200"
                          >
                            {val.tebang1 > 0 ? val.tebang1 : ''}
                          </td>
                          <td
                            className="px-1 py-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-slate-800 dark:text-slate-200"
                          >
                            {val.pangkas > 0 ? val.pangkas : ''}
                          </td>
                          <td
                            className="px-1 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-center font-mono font-bold text-teal-600 dark:text-teal-400"
                          >
                            {dayTotal > 0 ? dayTotal : ''}
                          </td>
                          </React.Fragment>
                      );
                    })}

                    {/* Summary Columns */}
                    <td className="px-2 py-2 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-850">
                      {rowVolumeSum > 0 ? rowVolumeSum : 0}
                    </td>

                    <td className="px-2 py-2 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-850">
                      {target > 0 ? sisa : '-'}
                    </td>

                    <td className="px-2 py-2 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold bg-slate-50 dark:bg-slate-850">
                      {target > 0 ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            percent >= 100
                              ? 'bg-teal-100 text-[#008396] dark:bg-teal-950 dark:text-teal-300'
                              : percent >= 75
                              ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {percent}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td className="px-3 py-2 border-slate-200 dark:border-slate-800 text-left text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[150px]">
                      {row.keterangan || '-'}
                    </td>
                  </tr>
                );
              })}

              {/* Bottom Summary Row (UP3 / UL Total Matrix) */}
              <tr className="bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-white font-black border-t-2 border-slate-400 dark:border-slate-700 shadow-inner">
                <td className="sticky left-0 z-20 bg-slate-300 dark:bg-slate-800 px-2 py-2.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono font-black">
                  -
                </td>

                <td
                  colSpan={2}
                  className="sticky left-[70px] z-20 bg-slate-300 dark:bg-slate-800 px-4 py-2.5 border-r border-slate-400 dark:border-slate-700 font-black tracking-wider uppercase"
                >
                  UP3 {selectedULKey}
                </td>

                {/* Day Summary Totals */}
                {daysInMonth.map((d) => {
                  const daySum = grandTotalPerDay[d.dayFormatted] || { targetKms: 0, realisasiKms: 0, tebang1: 0, pangkas: 0, tebang2: 0, total: 0 };
                  return (
                    <React.Fragment key={`sum-${d.dayFormatted}`}>
                      <td className="px-1 py-1.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono text-[9px] text-[#008396] dark:text-teal-400 font-bold">
                        {daySum.targetKms > 0 ? daySum.targetKms.toFixed(2) : '0'}
                      </td>
                      <td className="px-1 py-1.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono text-[9px] text-teal-600 dark:text-teal-400 font-bold">
                        {daySum.realisasiKms > 0 ? daySum.realisasiKms.toFixed(2) : '0'}
                      </td>
                      <td className="px-1 py-1.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono text-[10px]">
                        {daySum.tebang1}
                      </td>
                      <td className="px-1 py-1.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono text-[10px]">
                        {daySum.pangkas}
                      </td>
                      <td className="px-1 py-1.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono font-black text-[11px] bg-slate-400/40 dark:bg-slate-700">
                        {daySum.total}
                      </td>
                    </React.Fragment>
                  );
                })}

                {/* Grand Summary Columns */}
                <td className="px-2 py-2.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono font-black text-sm text-teal-700 dark:text-teal-300">
                  {grandTotalsSummary.volume}
                </td>
                <td className="px-2 py-2.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                  {grandTotalsSummary.sisa}
                </td>
                <td className="px-2 py-2.5 border-r border-slate-400 dark:border-slate-700 text-center font-mono font-black text-xs text-[#008396] dark:text-teal-400">
                  {grandTotalsSummary.percent}%
                </td>
                <td className="px-3 py-2.5 text-center text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-widest font-black">
                  TOTAL UP3
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit Target & Keterangan Row */}
      {editingRowConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
                  Pengaturan Tim & Target
                </h3>
                <p className="text-xs font-bold text-teal-600 dark:text-teal-400">
                  {editingRowConfig.timRow} &bull; {editingRowConfig.namaUlp}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingRowConfig(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Target Pekerjaan Bulanan (Batang)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingRowConfig.target || ''}
                  onChange={(e) =>
                    setEditingRowConfig({
                      ...editingRowConfig,
                      target: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="200"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Keterangan Tim (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={editingRowConfig.keterangan || ''}
                  onChange={(e) =>
                    setEditingRowConfig({
                      ...editingRowConfig,
                      keterangan: e.target.value,
                    })
                  }
                  placeholder="Catatan kendala, area khusus atau status..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  handleDeleteRow(editingRowConfig.id, editingRowConfig.timRow);
                  setEditingRowConfig(null);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Tim</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingRowConfig(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveRowConfig}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-[#00A2B9] text-white text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-teal-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Tim ROW */}
      {showAddRowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
                Tambah Tim ROW Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRowModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nama ULP
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newRowData.namaUlp}
                    onChange={(e) => setNewRowData({ ...newRowData, namaUlp: e.target.value })}
                    placeholder="Contoh: ULP BUKITTINGGI"
                    list="ulp-suggestions"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#00A2B9] uppercase"
                  />
                  <datalist id="ulp-suggestions">
                    {availableUlps.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nama Tim ROW / Regu
                </label>
                <input
                  type="text"
                  value={newRowData.timRow}
                  onChange={(e) => setNewRowData({ ...newRowData, timRow: e.target.value })}
                  placeholder="Contoh: TIM ROW 12 / Regu ROW Echo"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Target Bulanan (Batang)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newRowData.target}
                  onChange={(e) => setNewRowData({ ...newRowData, target: Number(e.target.value) || 0 })}
                  placeholder="200"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-[#00A2B9] text-white text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-teal-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambahkan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
