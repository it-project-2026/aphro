import * as React from 'react';
import { GlobalProvider } from './context/index';
import { useAuth } from './context/AuthContext';
import { useSettings } from './context/SettingsContext';
import { useWorkOrders } from './context/WorkOrderContext';
import { useAbsensi } from './context/AbsensiContext';
import { useUI } from './context/UIContext';
import { useToast } from './hooks/useToast';
import { useGASSync } from './hooks/useGASSync';
import { APP_LOGO_URL } from './data/initialData';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { Footer } from './components/layout/Footer';
import { ToastContainer } from './components/common/ToastContainer';
import { SyncStatusBanner } from './components/common/SyncStatusBanner';
import { NotificationListener } from './components/layout/NotificationListener';
import { Database, Loader2 } from 'lucide-react';

// Lazy Load Pages for Performance (P3 Poin 13)
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const WorkOrderMainPage = React.lazy(() => import('./pages/WorkOrderMainPage').then(m => ({ default: m.WorkOrderMainPage })));
const RealisasiMainPage = React.lazy(() => import('./pages/RealisasiMainPage').then(m => ({ default: m.RealisasiMainPage })));
const MonitoringPage = React.lazy(() => import('./pages/MonitoringPage').then(m => ({ default: m.MonitoringPage })));
const CetakLaporanPage = React.lazy(() => import('./pages/CetakLaporanPage').then(m => ({ default: m.CetakLaporanPage })));
const MasterDataPage = React.lazy(() => import('./pages/MasterDataPage').then(m => ({ default: m.MasterDataPage })));
const AuditLogPage = React.lazy(() => import('./pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const UserWelcomePage = React.lazy(() => import('./pages/UserWelcomePage').then(m => ({ default: m.UserWelcomePage })));
const AbsensiKerjaPage = React.lazy(() => import('./pages/AbsensiKerjaPage').then(m => ({ default: m.AbsensiKerjaPage })));
const AbsensiMainPage = React.lazy(() => import('./pages/AbsensiMainPage').then(m => ({ default: m.AbsensiMainPage })));
const InisiasiPage = React.lazy(() => import('./pages/InisiasiPage').then(m => ({ default: m.InisiasiPage })));
const RekapPekerjaanHarianPage = React.lazy(() => import('./pages/RekapPekerjaanHarianPage').then(m => ({ default: m.RekapPekerjaanHarianPage })));
const RekapPenyulangHarianPage = React.lazy(() => import('./pages/RekapPenyulangHarianPage').then(m => ({ default: m.RekapPenyulangHarianPage })));
const SettingAplikasiPage = React.lazy(() => import('./pages/SettingAplikasiPage').then(m => ({ default: m.SettingAplikasiPage })));

import { useNotifications } from './hooks/useNotifications';

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-12 space-y-4">
    <Loader2 className="w-8 h-8 text-[#00A2B9] animate-spin" />
    <p className="text-xs font-bold text-slate-400">Memuat Halaman...</p>
  </div>
);

const AppContent: React.FC = () => {
  const { user } = useAuth();
  useNotifications();
  const { activeTab, setActiveTab } = useUI();
  const { settings } = useSettings();
  const { hasCheckedInToday } = useAbsensi();
  const { isSyncing, syncWithGAS, isGasConnected, triggerActivitySync } = useGASSync();
  const { showToast } = useToast();
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [showAbsensiForm, setShowAbsensiForm] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isInitiated, setIsInitiated] = React.useState<boolean>(() => {
    return localStorage.getItem('aphro_has_initiated') === 'true';
  });




  const isAdmRole = user && (
    (user.role || '').toUpperCase() === 'ADM' ||
    (user.userName || '').toLowerCase() === 'admbkt' ||
    (user.nip || '').toLowerCase() === 'admbkt' ||
    (user.id || '').toLowerCase() === 'admbkt'
  );

  React.useEffect(() => {
    // Just handle splash screen timing
    const timer = setTimeout(() => setIsInitialLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (isAdmRole && !['cetak_laporan', 'rekap_harian', 'rekap_penyulang', 'monitoring_absensi', 'settings'].includes(activeTab)) {
      setActiveTab('cetak_laporan');
    }
  }, [isAdmRole, activeTab, setActiveTab]);

  const renderActivePage = () => {
    if (isAdmRole) {
      switch (activeTab) {
        case 'rekap_harian':
          return <RekapPekerjaanHarianPage />;
        case 'rekap_penyulang':
          return <RekapPenyulangHarianPage />;
        case 'monitoring_absensi':
          return <AbsensiMainPage initialSubTab="monitoring_absensi" />;
        case 'settings':
        case 'setting':
          return <SettingAplikasiPage />;
        case 'cetak_laporan':
        default:
          return <CetakLaporanPage />;
      }
    }

    switch (activeTab) {
      case 'dashboard': 
        if ((user?.role || '').toUpperCase() === 'USER') {
          return <WorkOrderMainPage />;
        }
        return <DashboardPage />;
      case 'work_orders': return <WorkOrderMainPage initialSubTab="list" />;
      case 'input_wo': return <WorkOrderMainPage initialSubTab="input" />;
      case 'realisasi_main':
      case 'input_realisasi': return <RealisasiMainPage initialSubTab="input" />;
      case 'absensi':
      case 'absensi_pulang': return <AbsensiMainPage initialSubTab="absensi_pulang" />;
      case 'monitoring_absensi': return <AbsensiMainPage initialSubTab="monitoring_absensi" />;
      case 'monitoring': return <MonitoringPage />;
      case 'cetak_laporan': return <CetakLaporanPage />;
      case 'rekap_harian': 
        if ((user?.role || '').toUpperCase() === 'USER') return <DashboardPage />;
        return <RekapPekerjaanHarianPage />;
      case 'rekap_penyulang': 
        if ((user?.role || '').toUpperCase() === 'USER') return <DashboardPage />;
        return <RekapPenyulangHarianPage />;
      case 'master_data': return <MasterDataPage />;
      case 'settings':
      case 'setting': return <SettingAplikasiPage />;
      case 'logs': return <AuditLogPage />;
      case 'inisiasi': return <InisiasiPage isFromMenu={true} />;
      default: return <DashboardPage />;
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-teal-950 via-slate-900 to-teal-950 opacity-90" />
        <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative inline-flex items-center justify-center mx-auto">
            <img
              src={APP_LOGO_URL}
              alt="Logo"
              className="w-48 h-48 sm:w-60 sm:h-60 object-contain animate-pulse drop-shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.failed) {
                  target.dataset.failed = 'true';
                  target.src = 'https://drive.google.com/uc?export=view&id=1V2zz3q_3umHCaTqeJN6u7kbhGdLrK4NE';
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-extrabold text-teal-400 tracking-widest uppercase">
              {settings.namaUnitLayanan || 'UL BUKITTINGGI'}
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-teal-400">
              <Database className="w-4 h-4 animate-bounce" />
              <span>Menghubungkan ke Supabase APHRO-Database...</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
              <div className="bg-gradient-to-r from-[#00A2B9] via-teal-400 to-[#00A2B9] h-1.5 rounded-full animate-pulse w-3/4 mx-auto" />
            </div>
            <p className="text-[11px] text-slate-400">
              Memuat data USERS, Work Order, Realisasi & Absensi dari Supabase...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. CRITICAL: JIKA USERS SUDAH LOGIN, TIDAK LAGI MASUK KE HALAMAN INISIASI!
  if (user) {
    const isUserRole = (user.role || '').toUpperCase() === 'USER';
    if (isUserRole && !isAdmRole && !hasCheckedInToday) {
      return (
        <React.Suspense fallback={<LoadingFallback />}>
          <NotificationListener />
          <SyncStatusBanner />
          {showAbsensiForm ? (
            <AbsensiKerjaPage onSuccess={() => {
              setShowAbsensiForm(false);
              setActiveTab('monitoring_absensi');
            }} />
          ) : (
            <UserWelcomePage onStartAbsensi={() => setShowAbsensiForm(true)} />
          )}
          <ToastContainer />
        </React.Suspense>
      );
    }

    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 pb-20 lg:pb-0">
        <NotificationListener />
        <Navbar onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} />
        <SyncStatusBanner />

        <div className="flex-1 flex max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 gap-6">
          <Sidebar
            isOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          <main className="flex-1 min-w-0">
            <React.Suspense fallback={<LoadingFallback />}>
              {renderActivePage()}
            </React.Suspense>
          </main>
        </div>

        <Footer />
        <MobileBottomNav />
        <ToastContainer />
      </div>
    );
  }

  // 3. JIKA BELUM LOGIN: Cek apakah perlu inisiasi awal atau langsung ke Halaman Login
  if (!isInitiated) {
    return (
      <React.Suspense fallback={<LoadingFallback />}>
        <InisiasiPage onInitiationComplete={() => setIsInitiated(true)} />
        <ToastContainer />
      </React.Suspense>
    );
  }

  // 4. Halaman Login (Belum login & sudah inisiasi)
  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <LoginPage />
      <ToastContainer />
    </React.Suspense>
  );
};

export default function App() {
  return (
    <GlobalProvider>
      <AppContent />
    </GlobalProvider>
  );
}
