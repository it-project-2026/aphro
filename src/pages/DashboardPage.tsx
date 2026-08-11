import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useMasterData } from '../context/MasterDataContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useNotifications } from '../context/NotificationContext';
import { useUI } from '../context/UIContext';
import { useGASSync } from '../hooks/useGASSync';
import { useToast } from '../hooks/useToast';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
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
  RefreshCw,
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
  const { user: currentUser } = useAuth();
  const { workOrders } = useWorkOrders();
  const { ulpList, penyulangList, reguList, petugasList } = useMasterData();
  const { auditLogs } = useNotifications();
  const { setActiveTab, isDarkMode } = useUI();
  const { isGasConnected, syncWithGAS } = useGASSync();
  const { showToast } = useToast();

  const handleSync = async () => {
    await syncWithGAS(showToast);
  };

  const role = currentUser?.role || 'User';

  // Metrics calculations
  const totalWO = workOrders.length;
  const woSelesai = workOrders.filter((w) => w.status === 'Selesai').length;
  const woProgress = workOrders.filter((w) => w.status === 'Sedang Dikerjakan').length;
  const woBelum = workOrders.filter((w) => w.status === 'Belum Dikerjakan').length;

  const totalPetugas = petugasList.length;
  const totalRegu = reguList.length;
  const totalULP = ulpList.length;
  const totalPenyulang = penyulangList.length;

  // Chart Colors based on dark mode
  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  // Daily Progress Bar Chart Data (Progress Pekerjaan Harian)
  const dailyData = {
    labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    datasets: [
      {
        label: 'Volume Realisasi Harian',
        data: [1.2, 2.5, 1.8, 3.0, 2.2, 1.5, woSelesai > 0 ? woSelesai * 0.8 : 2.0],
        backgroundColor: '#10b981',
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
        data: [12, 19, 15, 25, 22, 30, 28, woSelesai],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'WO Dalam Progress',
        data: [5, 8, 12, 10, 14, 9, 11, woProgress],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // 2. Progress per ULP Bar Chart Data
  const ulpLabels = ulpList.map((u) => (u.namaULP || '').replace('ULP ', ''));
  const ulpProgressData = ulpList.map((u) => {
    const ulpWOs = workOrders.filter((w) => w.ulpId === u.id);
    if (ulpWOs.length === 0) return 0;
    const finished = ulpWOs.filter((w) => w.status === 'Selesai').length;
    return Math.round((finished / ulpWOs.length) * 100);
  });

  const ulpBarData = {
    labels: ulpLabels,
    datasets: [
      {
        label: 'Persentase Penyelesaian ULP (%)',
        data: ulpProgressData,
        backgroundColor: ['#0284c7', '#06b6d4', '#10b981', '#6366f1'],
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
        backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-900 via-sky-800 to-cyan-900 p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-cyan-300">
              <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
              <span>Dashboard Petugas ROW - {currentUser?.reguName || 'Tim Lapangan'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
              Selamat Datang, {currentUser?.name || 'Petugas'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Pantau progres pekerjaan harian dan pencapaian bulanan penugasan pemeliharaan ROW jaringan listrik Anda.
            </p>
          </div>
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
              <span className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>
            <div className="h-72">
              <Bar data={dailyData} options={chartOptions} />
            </div>
          </div>

          {/* Progress Pekerjaan per Bulan */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Progress Pekerjaan per Bulan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tren akumulasi penyelesaian Work Order sepanjang tahun
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-600">
                <TrendingUp className="w-5 h-5" />
              </span>
            </div>
            <div className="h-72">
              <Line data={monthlyData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-900 via-sky-800 to-cyan-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-cyan-300">
              <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
              <span>Operational Asset Protection Dashboard</span>
            </div>

            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 text-xs font-bold text-emerald-200">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Spreadsheet DB: {isGasConnected ? 'Terhubung (Online)' : 'Aktif (Connected)'}</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
            Monitoring Maintenance & Response ROW
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            Sistem terintegrasi untuk pemantauan Work Order, eksekusi tim lapangan, mitigasi hazard jaringan listrik, dan pelaporan realisasi foto terverifikasi.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('input_wo')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-sky-900 hover:bg-sky-50 font-extrabold text-xs rounded-xl shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4 text-sky-600" />
              <span>Input Work Order Baru</span>
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-sky-800/80 hover:bg-sky-700 text-white font-bold text-xs rounded-xl border border-sky-600/50 transition-all"
            >
              <FileCheck2 className="w-4 h-4 text-cyan-300" />
              <span>Lihat Peta Operations</span>
            </button>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-cyan-500/20 to-transparent pointer-events-none" />
      </div>

      {/* 8 Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Jumlah Work Order"
          value={totalWO}
          subtitle="Total diterbitkan"
          icon={ClipboardList}
          iconBgColor="bg-sky-50 dark:bg-sky-900/30"
          iconColor="text-sky-600 dark:text-sky-400"
          trend={{ text: '+12% m/m', isUp: true }}
        />
        <StatCard
          title="WO Selesai (Hijau)"
          value={woSelesai}
          subtitle="Realisasi 100%"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          borderColor="border-emerald-200 dark:border-emerald-900/50"
          trend={{ text: `${Math.round((woSelesai / (totalWO || 1)) * 100)}%`, isUp: true }}
        />
        <StatCard
          title="WO Progress (Kuning)"
          value={woProgress}
          subtitle="Sedang dikerjakan"
          icon={Clock}
          iconBgColor="bg-amber-50 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          borderColor="border-amber-200 dark:border-amber-900/50"
        />
        <StatCard
          title="WO Belum (Merah)"
          value={woBelum}
          subtitle="Menunggu antrean"
          icon={AlertTriangle}
          iconBgColor="bg-rose-50 dark:bg-rose-900/30"
          iconColor="text-rose-600 dark:text-rose-400"
          borderColor="border-rose-200 dark:border-rose-900/50"
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
          iconBgColor="bg-cyan-50 dark:bg-cyan-900/30"
          iconColor="text-cyan-600 dark:text-cyan-400"
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
          value={totalPenyulang}
          subtitle="Jaringan distribusi"
          icon={Zap}
          iconBgColor="bg-yellow-50 dark:bg-yellow-900/30"
          iconColor="text-yellow-600 dark:text-yellow-400"
        />
      </div>

      {/* Chart Visualizations Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line / Area Chart - Monthly Progress */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Progress Pekerjaan per Bulan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tren penyelesaian WO dan status progress sepanjang tahun
              </p>
            </div>
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-600">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="h-64">
            <Line data={monthlyData} options={chartOptions} />
          </div>
        </div>

        {/* Doughnut Chart - Status Distribution */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Distribusi Status Work Order
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Persentase penyelesaian WO aktif
            </p>
          </div>
          <div className="h-56 relative flex items-center justify-center">
            <Doughnut
              data={statusDoughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: textColor, font: { size: 10 } },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Chart Visualizations Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Progress per ULP */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Persentase Realisasi Pekerjaan per ULP
          </h3>
          <div className="h-60">
            <Bar data={ulpBarData} options={chartOptions} />
          </div>
        </div>

        {/* Top Performers & High Priority List */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center space-x-2 text-amber-500">
              <Award className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Top Performers & Tim ROW
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('master_data')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center"
            >
              <span>Lihat Tim</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          <div className="space-y-3">
            {reguList.slice(0, 3).map((regu, idx) => (
              <div
                key={`${regu.id}-${idx}`}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60"
              >
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300 text-xs font-black flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      {regu.namaRegu}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      PJ: {regu.penanggungJawab} ({regu.jumlahAnggota} Personel)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Aktif Siaga
                </span>
              </div>
            ))}
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
          <button
            onClick={() => setActiveTab('work_orders')}
            className="text-xs font-bold px-3 py-1.5 bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 rounded-xl hover:bg-sky-100 transition-colors"
          >
            Lihat Semua WO
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 pl-5">Nomor WO</th>
                <th className="p-3.5">Penyulang & ULP</th>
                <th className="p-3.5">Lokasi</th>
                <th className="p-3.5">Regu / Petugas</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-5">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {workOrders.slice(0, 5).map((wo, idx) => (
                <tr
                  key={`${wo.id}-${idx}`}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="p-3.5 pl-5 font-bold text-sky-600 dark:text-sky-400">
                    {wo.nomorWO}
                  </td>
                  <td className="p-3.5">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {wo.penyulangName}
                    </p>
                    <p className="text-[11px] text-slate-400">{wo.ulpName}</p>
                  </td>
                  <td className="p-3.5 max-w-xs truncate text-slate-600 dark:text-slate-300">
                    {wo.lokasi}
                  </td>
                  <td className="p-3.5">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {wo.petugasName}
                    </p>
                    <p className="text-[11px] text-slate-400">{wo.reguName}</p>
                  </td>
                  <td className="p-3.5">
                    <StatusBadge status={wo.status} size="sm" />
                  </td>
                  <td className="p-3.5 pr-5">
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-sky-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${wo.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {wo.progressPercent}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
