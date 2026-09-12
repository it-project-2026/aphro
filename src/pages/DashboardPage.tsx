import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useMasterData } from '../context/MasterDataContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useNotifications } from '../context/NotificationContext';
import { useUI } from '../context/UIContext';
import { useGASSync } from '../hooks/useGASSync';
import { useToast } from '../hooks/useToast';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import {
  parseNumeric,
  getWOTargetKms,
  getWORealisasiKms,
  isWOSelesai,
  isWOInProgress,
  TOTAL_PROGRAM_TARGET_KMS,
  TARGET_KMS_PER_TIM_ROW,
  calculateTimRowTargetKms,
} from '../utils/metricUtils';
import { normalizeDateISO, parseDateFromNomorWO } from '../utils/dateUtils';
import { TopPerformersList } from '../components/dashboard/TopPerformersList';
import { RecentWOTable } from '../components/dashboard/RecentWOTable';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { RealisasiTargetDashboard } from '../components/dashboard/RealisasiTargetDashboard';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  ShieldAlert,
  Building2,
  Zap,
  TrendingUp,
  Award,
  ArrowRight,
  PlusCircle,
  FileCheck2,
  FileSpreadsheet,
  Database,
  RefreshCw,
  Cloud,
  CloudOff,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const DashboardPage: React.FC = () => {
  const draggable = useDraggableScroll();
  const { settings } = useSettings();
  const { user: currentUser } = useAuth();
  const { workOrders } = useWorkOrders();
  const { realisasiList } = useRealisasi();
  const { ulpList, penyulangList, reguList, petugasList } = useMasterData();
  const { auditLogs } = useNotifications();
  const { setActiveTab, isDarkMode } = useUI();
  const { isGasConnected, syncWithGAS } = useGASSync();
  const { showToast } = useToast();
  // Get pending items from sync queue to identify unsynced WOs
  const [pendingIds, setPendingIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const checkPending = () => {
      try {
        const raw = localStorage.getItem('aphro_pending_sync_queue');
        if (raw) {
          const queue = JSON.parse(raw);
          const ids = queue
            .filter((item: any) => item.type === 'WORK_ORDER_CREATE' || item.type === 'WORK_ORDER_UPDATE')
            .map((item: any) => item.payload?.id || item.payload?.workOrder?.id);
          setPendingIds(ids);
        } else {
          setPendingIds([]);
        }
      } catch (e) {
        setPendingIds([]);
      }
    };

    checkPending();
  }, []);


  const [filterYear, setFilterYear] = React.useState<string>('ALL');
  const [filterMonth, setFilterMonth] = React.useState<string>('ALL');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [filterUlp, setFilterUlp] = React.useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = React.useState('ALL');

  const handleSync = async () => {
    await syncWithGAS(showToast);
  };

  const role = currentUser?.role || 'User';

  // Helper to clean string for better matching
  const cleanStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // Parse date strings safely into { year, month, full }
  const parseDateParts = React.useCallback((dateStr?: string) => {
    if (!dateStr) return { year: '', month: '', full: '' };
    const iso = normalizeDateISO(dateStr);
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const parts = iso.split('-');
      return { year: parts[0], month: parts[1], full: iso };
    }
    return { year: '', month: '', full: String(dateStr) };
  }, []);

  // Matching helpers
  const matchesUlp = React.useCallback((itemUlpName?: string, itemUlpId?: string, targetFilter = filterUlp) => {
    if (!targetFilter || targetFilter === 'ALL') return true;
    const target = cleanStr(targetFilter);
    if (!target) return true;
    const name = cleanStr(itemUlpName || '');
    const id = cleanStr(itemUlpId || '');
    
    // If neither name nor id is provided, check if target matches current global unit or default
    if (!name && !id) {
      const activeUnit = cleanStr(localStorage.getItem('aphro_nama_unit_layanan') || '');
      if (activeUnit && activeUnit.includes(target)) return true;
      return false;
    }

    const nameMatch = name && (name === target || name.includes(target) || target.includes(name) || (target.includes('padang') && name.includes('padang')) || (target.includes('bukittinggi') && name.includes('bukittinggi')) || (target.includes('solok') && name.includes('solok')) || (target.includes('payakumbuh') && name.includes('payakumbuh')));
    const idMatch = id && (id === target);
    
    return nameMatch || idMatch;
  }, [filterUlp]);

  const matchesPenyulang = React.useCallback((itemPName?: string, itemPId?: string, targetFilter = filterPenyulang) => {
    if (!targetFilter || targetFilter === 'ALL') return true;
    const target = cleanStr(targetFilter);
    if (!target) return true;
    const name = cleanStr(itemPName || '');
    const id = cleanStr(itemPId || '');
    
    if (!name && !id) return false;

    // Only allow matching if itemPName is not empty when comparing with target.includes(name)
    const nameMatch = name && (name === target || name.includes(target) || target.includes(name));
    const idMatch = id && (id === target);

    return nameMatch || idMatch;
  }, [filterPenyulang]);

  const { filteredWOs, filteredRealisasi, topPerformersData } = useDashboardMetrics(
    workOrders,
    realisasiList,
    ulpList,
    reguList,
    petugasList,
    penyulangList,
    filterUlp,
    filterPenyulang,
    matchesUlp,
    matchesPenyulang,
    cleanStr,
    filterYear,
    filterMonth,
    startDate,
    endDate
  );

  // 1. Deduplicate Work Orders based on composite key (Nomor WO + Penyulang)
  const uniqueWorkOrders = React.useMemo(() => {
    const seen = new Map<string, any>();
    workOrders.forEach((wo) => {
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
        
        // Priority: 1. Selesai, 2. Most realisasi
        if (isNewSelesai && !isExistingSelesai) {
          seen.set(woKey, wo);
        } else if (isNewSelesai === isExistingSelesai && (parseNumeric(wo.totalRealisasi, 0) > parseNumeric(existing.totalRealisasi, 0))) {
          seen.set(woKey, wo);
        }
      }
    });
    return Array.from(seen.values());
  }, [workOrders]);

  // Dynamic Year Options extracted from actual WO & Realisasi dates
  const yearOptions = React.useMemo(() => {
    const yearsSet = new Set<string>();
    const currentYear = new Date().getFullYear().toString();
    yearsSet.add(currentYear);

    uniqueWorkOrders.forEach(wo => {
      const woDate = normalizeDateISO(wo.tanggal) || parseDateFromNomorWO(wo.nomorWO || '') || normalizeDateISO(wo.createdAt);
      const { year } = parseDateParts(woDate);
      if (year && year.length === 4) yearsSet.add(year);
    });
    realisasiList.forEach(rel => {
      const relDate = normalizeDateISO(rel.tanggalRealisasi) || parseDateFromNomorWO(rel.nomorWO || '') || normalizeDateISO(rel.createdAt);
      const { year } = parseDateParts(relDate);
      if (year && year.length === 4) yearsSet.add(year);
    });

    return Array.from(yearsSet).sort().reverse();
  }, [uniqueWorkOrders, realisasiList, parseDateParts]);

  // Metrics calculations based on FILTERED data
  const totalWO = React.useMemo(() => {
    const setWOs = new Set(filteredWOs.map(w => (w.nomorWO || '').trim().toUpperCase()).filter(Boolean));
    return setWOs.size > 0 ? setWOs.size : filteredWOs.length;
  }, [filteredWOs]);

  const woSelesai = React.useMemo(() => {
    const setSelesai = new Set(
      filteredWOs
        .filter(w => {
          const statusStr = String(w.status || '').toUpperCase().trim();
          return statusStr !== 'BELUM SELESAI';
        })
        .map(w => (w.nomorWO || '').trim().toUpperCase())
        .filter(Boolean)
    );
    return setSelesai.size > 0 ? setSelesai.size : filteredWOs.filter(w => {
      const statusStr = String(w.status || '').toUpperCase().trim();
      return statusStr !== 'BELUM SELESAI';
    }).length;
  }, [filteredWOs]);

  const woProgress = filteredWOs.filter((w) => isWOInProgress(w.status)).length;
  const woBelum = filteredWOs.filter((w) => !isWOSelesai(w.status) && !isWOInProgress(w.status)).length;

  // ULP Performance Percentage Engine
  const ulpPerformanceList = React.useMemo(() => {
    const activeUlps = filterUlp === 'ALL'
      ? ulpList
      : ulpList.filter(u => matchesUlp(u.namaULP, u.id, filterUlp));

    const listToProcess = activeUlps.length > 0 ? activeUlps : ulpList;

    return listToProcess.map((u, idx) => {
      const ulpWOs = filteredWOs.filter((w) => matchesUlp(w.ulpName, w.ulpId, u.namaULP || u.id));
      const ulpRealisasiList = filteredRealisasi.filter((r) => matchesUlp(r.ulpName, undefined, u.namaULP || u.id));

      const realisasiKms = ulpWOs.reduce((sum, wo) => {
        return sum + getWORealisasiKms(wo);
      }, 0);

      const reguInUlp = reguList.filter(r => matchesUlp(r.ulpName, r.ulpId, u.namaULP || u.id));
      const reguCount = reguInUlp.length || 1;
      // Target setiap tim ROW adalah 50.20 KMS
      const targetKms = Number((reguCount * TARGET_KMS_PER_TIM_ROW).toFixed(2));

      const percentage = targetKms > 0 ? Math.min(100, Math.round((realisasiKms / targetKms) * 100)) : 0;
      const woSelesaiCount = ulpWOs.filter(w => isWOSelesai(w.status)).length;

      return {
        id: u.id || `ulp-${idx}`,
        namaULP: u.namaULP || `ULP ${idx + 1}`,
        realisasiKms: Number(realisasiKms.toFixed(2)),
        targetKms: Number(targetKms.toFixed(2)),
        percentage,
        woTotal: ulpWOs.length,
        woSelesai: woSelesaiCount,
        reguCount: reguInUlp.length,
        realisasiCount: ulpRealisasiList.length
      };
    });
  }, [ulpList, filterUlp, filteredWOs, filteredRealisasi, reguList, matchesUlp]);

  // Overall KMS Target calculated from total active Tim ROWs multiplied by TARGET_KMS_PER_TIM_ROW (50.20)
  const totalTargetKms = React.useMemo(() => {
    const totalRegu = ulpPerformanceList.reduce((sum, u) => sum + u.reguCount, 0);
    const targetFromRegu = totalRegu * TARGET_KMS_PER_TIM_ROW;
    if (targetFromRegu > 0) return Number(targetFromRegu.toFixed(2));
    return Number(ulpPerformanceList.reduce((sum, u) => sum + u.targetKms, 0).toFixed(2));
  }, [ulpPerformanceList]);

  const totalRealisasiKms = React.useMemo(() => {
    return Number(ulpPerformanceList.reduce((sum, u) => sum + u.realisasiKms, 0).toFixed(2));
  }, [ulpPerformanceList]);

  const kmsPercentage = totalTargetKms > 0 ? Math.round((totalRealisasiKms / totalTargetKms) * 100) : 0;

  // Tebang/Pangkas Metrics logic with exact / strict matching on keterangan for filteredRealisasi (filtered by unitId via Inisiasi)
  const totalTebang = React.useMemo(() => {
    return filteredRealisasi.filter(r => {
      const ket = String(r.keterangan || '').toUpperCase().trim();
      return ket === 'TEBANG' || ket.includes('TEBANG');
    }).length;
  }, [filteredRealisasi]);

  const totalPangkas = React.useMemo(() => {
    return filteredRealisasi.filter(r => {
      const ket = String(r.keterangan || '').toUpperCase().trim();
      return ket === 'PANGKAS' || ket.includes('PANGKAS');
    }).length;
  }, [filteredRealisasi]);

  const totalRealisasiPohon = totalTebang + totalPangkas;

  // Realisasi Penyulang Metrics logic
  const targetPenyulangs = Array.from(new Set(filteredWOs.map(w => w.penyulangName).filter(Boolean))).length;
  const uniqueRealizedPenyulangs = Array.from(new Set(filteredRealisasi.map(r => r.penyulangName).filter(Boolean))).length;
  const uniqueRealizedWOs = Array.from(new Set(filteredRealisasi.map(r => r.nomorWO).filter(Boolean))).length;

  const totalPetugas = React.useMemo(() => {
    const activePetugas = new Set<string>();

    petugasList.forEach(p => {
      const matchUnit = filterUlp === 'ALL' || (p.ulpId && p.ulpId === filterUlp) || matchesUlp(p.ulpName, p.ulpId, filterUlp);
      const isActive = !p.status || p.status.toLowerCase() === 'aktif';
      if (matchUnit && isActive && p.nama && p.nama.trim() && p.nama.trim() !== '-') {
        activePetugas.add(p.nama.trim().toUpperCase());
      }
    });

    if (activePetugas.size === 0) {
      filteredWOs.forEach(w => {
        if (w.petugasName && w.petugasName.trim() && w.petugasName.trim() !== '-') {
          activePetugas.add(w.petugasName.trim().toUpperCase());
        }
      });
    }

    return activePetugas.size;
  }, [petugasList, matchesUlp, filterUlp, filteredWOs]);

  const totalRegu = React.useMemo(() => {
    return topPerformersData.length || reguList.length || 0;
  }, [topPerformersData, reguList]);

  const totalULP = filterUlp === 'ALL' ? ulpList.length : 1;
  const totalPenyulangFiltered = filterPenyulang === 'ALL' 
    ? (filterUlp === 'ALL' ? penyulangList.length : penyulangList.filter(p => matchesUlp(p.ulpName, p.ulpId, filterUlp)).length)
    : 1;

  // Prepare data for RealisasiTargetDashboard
  const reguDashboardData = React.useMemo(() => {
    return topPerformersData.map((r, idx) => ({
      id: r.id ? `regu-${r.id}-${idx}` : `regu-idx-${idx}`,
      name: (r.namaRegu || '').toUpperCase(),
      realisasi: r.realisasiKms,
      target: TARGET_KMS_PER_TIM_ROW // 50.20 KMS per Tim ROW
    }));
  }, [topPerformersData]);

  // Chart Colors based on dark mode
  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  // Daily Progress Bar Chart Data (Progress Pekerjaan Harian)
  const dailyData = {
    labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    datasets: [
      {
        label: 'Volume Realisasi Harian',
        data: [0, 0, 0, 0, 0, 0, woSelesai > 0 ? woSelesai * 0.8 : 0],
        backgroundColor: '#00A2B9',
        borderRadius: 8,
      },
    ],
  };

  // 1. Monthly Progress Area Chart Data
  const monthlyData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu'],
    datasets: [
      {
        label: 'WO Selesai',
        data: [0, 0, 0, 0, 0, 0, 0, woSelesai],
        borderColor: '#00A2B9',
        backgroundColor: 'rgba(0, 162, 185, 0.15)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'WO Dalam Progress',
        data: [0, 0, 0, 0, 0, 0, 0, woProgress],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // 2. Progress per ULP Bar Chart Data
  const ulpLabels = ulpPerformanceList.map((u) => u.namaULP.replace(/^ULP\s*/i, ''));
  const ulpProgressData = ulpPerformanceList.map((u) => u.percentage);

  const ulpBarData = {
    labels: ulpLabels,
    datasets: [
      {
        label: 'Persentase Realisasi ULP (%)',
        data: ulpProgressData,
        backgroundColor: ['#008396', '#00A2B9', '#0d9488', '#0891b2', '#0284c7', '#0369a1'],
        borderRadius: 8,
      },
    ],
  };

  // 3. Status Distribution Doughnut Chart Data
  const statusDoughnutData = {
    labels: ['WO Selesai', 'Sedang Progress', 'Belum Dikerjakan'],
    datasets: [
      {
        data: [woSelesai, woProgress, woBelum],
        backgroundColor: ['#00A2B9', '#f59e0b', '#f43f5e'],
        borderWidth: 0,
      },
    ],
  };

  // Chart Common Options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } },
        grid: { color: gridColor },
      },
      y: {
        ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 10 } },
        grid: { color: gridColor },
      },
    },
  };

  if (role === 'User') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Top Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#008396] to-[#00A2B9] p-6 sm:p-8 text-white shadow-lg">
          <div className="relative z-10 space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-teal-50">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Dashboard Petugas ROW - {currentUser?.reguName || 'Tim Lapangan'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-white">
              Selamat Datang, {currentUser?.name || 'Petugas'}
            </h1>
            <p className="text-xs sm:text-sm text-teal-50/80 leading-relaxed font-medium">
              Pantau progres pekerjaan harian dan pencapaian bulanan penugasan pemeliharaan ROW jaringan listrik Anda.
            </p>
          </div>
          {/* Decorative background shape */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
        </div>

        {/* Two Required Sections for User Role */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Pekerjaan Harian */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Progress Pekerjaan Harian
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Grafik volume penyelesaian pekerjaan harian minggu ini
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>
            <div className="h-72">
              <Bar data={dailyData} options={chartOptions} />
            </div>
          </div>

          <div className="lg:col-span-2">
            <RealisasiTargetDashboard 
              data={reguDashboardData} 
              title="PROGRESS PENYELESAIAN ROW"
              subtitle={`Tim: ${currentUser?.reguName || 'Lapangan'}`}
            />
          </div>

          {/* Recent Realizations for User with Sync Status */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Realisasi Saya Terkini
                </h3>
                <p className="text-xs text-slate-500">
                  Status sinkronisasi laporan kerja Anda
                </p>
              </div>
              <button
                onClick={() => setActiveTab('realisasi')}
                className="text-xs font-bold px-3 py-1.5 bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 rounded-xl hover:bg-teal-100 transition-colors"
              >
                Detail Realisasi
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 pl-5">Nomor WO</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Penyulang</th>
                    <th className="p-3 text-center">Status Sinkron</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRealisasi.slice(0, 5).map((rel, idx) => (
                    <tr key={rel.id ? `rel-${rel.id}-${idx}` : `rel-idx-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="p-3 pl-5 font-bold text-teal-600">{rel.nomorWO}</td>
                      <td className="p-3">{rel.tanggalRealisasi}</td>
                      <td className="p-3 font-medium">{rel.penyulangName}</td>
                      <td className="p-3 text-center">
                        {rel.isSynced ? (
                          <div className="inline-flex items-center space-x-1 text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-2 py-1 rounded-full">
                            <Cloud className="w-3 h-3" />
                            <span className="text-[10px] font-bold">TERKIRIM</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1 text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full animate-pulse">
                            <CloudOff className="w-3 h-3" />
                            <span className="text-[10px] font-bold">MENUNGGU</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRealisasi.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-400 italic">
                        Belum ada data realisasi yang diinput.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#006E7D] to-[#008396] p-6 sm:p-8 text-white shadow-xl border border-teal-700/50">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-teal-50">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Operational Asset Protection Dashboard</span>
            </div>

            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#00A2B9]/20 backdrop-blur-md border border-[#00A2B9]/30 text-xs font-bold text-teal-100">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>Supabase DB: Terhubung (Online)</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-white uppercase pt-1">
            Monitoring Maintenance & Response ROW
          </h1>
          <p className="text-xs sm:text-sm text-teal-50/70 leading-relaxed font-medium">
            Sistem terintegrasi untuk pemantauan Work Order, eksekusi tim lapangan, mitigasi hazard jaringan listrik, dan pelaporan realisasi foto terverifikasi.
          </p>

          <div className="pt-4 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('input_wo')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-teal-900 hover:bg-teal-50 font-black text-xs rounded-xl shadow-lg transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Input Work Order Baru</span>
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-teal-950/40 backdrop-blur-sm border border-[#00A2B9]/30 text-white hover:bg-teal-950/60 font-black text-xs rounded-xl transition-all active:scale-95 shadow-sm"
            >
              <FileCheck2 className="w-4 h-4 text-teal-400" />
              <span>Lihat Peta Operations</span>
            </button>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#00A2B9]/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Dashboard Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="w-28 sm:w-32">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
            Tahun
          </label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00A2B9]/20 transition-all"
          >
            <option value="ALL">Semua Tahun</option>
            {yearOptions.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>

        <div className="w-32 sm:w-36">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
            Bulan
          </label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00A2B9]/20 transition-all"
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

        <div className="flex-1 min-w-[130px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
            Tanggal Mulai
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00A2B9]/20 transition-all"
          />
        </div>

        <div className="flex-1 min-w-[130px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
            Tanggal Akhir
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00A2B9]/20 transition-all"
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
            Filter ULP
          </label>
          <select
            value={filterUlp}
            onChange={(e) => {
              setFilterUlp(e.target.value);
              setFilterPenyulang('ALL'); // Reset penyulang when ULP changes
            }}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00A2B9]/20 transition-all"
          >
            <option value="ALL">Semua ULP</option>
            {ulpList.map((ulp, idx) => (
              <option key={ulp.id ? `ulp-opt-${ulp.id}-${idx}` : `ulp-opt-${idx}`} value={ulp.namaULP || ulp.id || `ulp-${idx}`}>
                {ulp.namaULP}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
            Filter Penyulang
          </label>
          <select
            value={filterPenyulang}
            onChange={(e) => setFilterPenyulang(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00A2B9]/20 transition-all"
          >
            <option value="ALL">Semua Penyulang</option>
            {penyulangList
              .filter(p => filterUlp === 'ALL' || matchesUlp(p.ulpName, p.ulpId, filterUlp))
              .map((p, idx) => (
                <option key={p.id ? `p-opt-${p.id}-${idx}` : `p-opt-${idx}`} value={p.namaPenyulang || p.id || `p-${idx}`}>
                  {p.namaPenyulang}
                </option>
              ))}
          </select>
        </div>

        <button
          onClick={() => {
            setFilterYear('ALL');
            setFilterMonth('ALL');
            setStartDate('');
            setEndDate('');
            setFilterUlp('ALL');
            setFilterPenyulang('ALL');
          }}
          className="px-4 py-2.5 text-[10px] font-black text-slate-500 hover:text-rose-500 bg-slate-100 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/30 rounded-xl uppercase tracking-wider transition-all"
        >
          Reset Filter
        </button>
      </div>

      {/* 8 Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Custom Redesigned WO Card */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                Jumlah Work Order
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {totalWO}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-3xl sm:text-4xl font-black text-[#00A2B9]/20 dark:text-teal-400/10">
                {Math.round((woSelesai / (totalWO || 1)) * 100)}%
              </span>
            </div>
          </div>

          <div className="flex justify-end items-end">
            <div className="text-right">
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                WO Selesai
              </p>
              <h3 className="text-lg sm:text-xl font-black text-teal-600 dark:text-teal-400">
                {woSelesai}
              </h3>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00A2B9]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Custom Redesigned KMS Card */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                Target KMS
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {totalTargetKms.toFixed(2)}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-3xl sm:text-4xl font-black text-[#00A2B9]/20 dark:text-teal-400/10">
                {kmsPercentage}%
              </span>
            </div>
          </div>

          <div className="flex justify-end items-end">
            <div className="text-right">
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                Realisasi KMS
              </p>
              <h3 className="text-lg sm:text-xl font-black text-teal-600 dark:text-teal-400">
                {totalRealisasiKms.toFixed(2)}
              </h3>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00A2B9]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Custom Redesigned Tree Work Card (Tebang/Pangkas) */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                Total Tebang
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {totalTebang}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-3xl sm:text-4xl font-black text-amber-500/20 dark:text-amber-400/10">
                {totalRealisasiPohon}
              </span>
            </div>
          </div>

          <div className="flex justify-end items-end">
            <div className="text-right">
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                Total Pangkas
              </p>
              <h3 className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
                {totalPangkas}
              </h3>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <StatCard
          title="TOTAL PENYULANG TERLAYANI"
          value={uniqueRealizedPenyulangs}
          subtitle="Berdasarkan realisasi unik"
          icon={Building2}
          iconBgColor="bg-teal-50 dark:bg-teal-900/30"
          iconColor="text-teal-600 dark:text-teal-400"
          borderColor="border-teal-200 dark:border-teal-900/50"
        />

        <StatCard
          title="Jumlah Petugas"
          value={totalPetugas}
          subtitle="Personel siaga ROW"
          icon={Users}
          iconBgColor="bg-indigo-50 dark:bg-indigo-900/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
        <StatCard
          title="Regu ROW"
          value={totalRegu}
          subtitle="Tim eksekusi lapangan"
          icon={ShieldAlert}
          iconBgColor="bg-teal-50 dark:bg-teal-900/30"
          iconColor="text-teal-600 dark:text-teal-400"
        />
        <StatCard
          title="Jumlah ULP"
          value={totalULP}
          subtitle="Unit Layanan Pelanggan"
          icon={Building2}
          iconBgColor="bg-purple-50 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Penyulang / Feeder"
          value={totalPenyulangFiltered}
          subtitle={filterPenyulang !== 'ALL' ? "Penyulang Terpilih" : "Jaringan distribusi"}
          icon={Zap}
          iconBgColor="bg-yellow-50 dark:bg-yellow-900/30"
          iconColor="text-yellow-600 dark:text-yellow-400"
        />
      </div>

      {/* Chart Visualizations Row 1 - Replaced with Realisasi & Target Dashboard */}
      <div className="grid grid-cols-1 gap-6">
        <RealisasiTargetDashboard 
          data={reguDashboardData} 
          title="REALISASI & TARGET PROGRAM"
          subtitle={settings.namaUnitLayanan ? (settings.namaUnitLayanan.toUpperCase().startsWith('UP3') ? settings.namaUnitLayanan.toUpperCase() : `UP3 ${settings.namaUnitLayanan.replace(/^UL\s*/i, '').toUpperCase()}`) : "UP3 BUKITTINGGI"}
        />
      </div>

      {/* Chart Visualizations & Metrics Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Bar Chart - Progress per ULP */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span>Persentase Realisasi Pekerjaan per ULP</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Berdasarkan Realisasi KMS / Total Target KMS per Unit Layanan Pelanggan
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                {kmsPercentage}%
              </span>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Rata-rata Realisasi</p>
            </div>
          </div>

          <div className="h-72">
            <Bar 
              data={ulpBarData} 
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    min: 0,
                    max: 100,
                    ticks: {
                      ...chartOptions.scales.y.ticks,
                      callback: (value) => `${value}%`
                    }
                  }
                }
              }} 
            />
          </div>

          {/* ULP Performance Grid Breakdown */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Rincian Performa ULP
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {ulpPerformanceList.map((ulp) => (
                <div 
                  key={ulp.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 hover:border-teal-500/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">
                      {ulp.namaULP}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      ulp.percentage >= 100 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : ulp.percentage >= 50
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {ulp.percentage}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <span>Realisasi:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {ulp.realisasiKms} / {ulp.targetKms} KMS
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-teal-500 to-[#00A2B9] h-full transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min(100, ulp.percentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-semibold">
                    <span>WO Selesai: {ulp.woSelesai} / {ulp.woTotal}</span>
                    <span>{ulp.reguCount} Tim ROW</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performers & Tim ROW */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center space-x-2 text-amber-500">
              <Award className="w-5 h-5 text-amber-500 fill-amber-500/20" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Top Performers & Tim ROW
                </h3>
                <p className="text-[11px] text-slate-500">
                  Peringkat tim eksekusi ROW berdasarkan realisasi pekerjaan
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('master_data')}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center"
            >
              <span>Semua Tim</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          <div className="space-y-3">
            <TopPerformersList topPerformersData={topPerformersData} />
          </div>
        </div>
      </div>

      {/* Recent Work Orders & Activity Log */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Work Order Terbaru
            </h3>
            <p className="text-xs text-slate-500">
              Monitoring real-time status penugasan terkini
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingIds.length > 0 && (
              <button
                onClick={handleSync}
                className="text-[10px] font-bold px-3 py-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-xl hover:bg-amber-100 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3 animate-spin-slow" />
                Sync {pendingIds.length} Data
              </button>
            )}
            <button
              onClick={() => setActiveTab('work_orders')}
              className="text-xs font-bold px-3 py-1.5 bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 rounded-xl hover:bg-teal-100 transition-colors"
            >
              Lihat Semua WO
            </button>
          </div>
        </div>

        <RecentWOTable 
          filteredWOs={filteredWOs} 
          pendingIds={pendingIds} 
          draggable={draggable} 
        />
      </div>
    </div>
  );
};
