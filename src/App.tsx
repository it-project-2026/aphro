import * as React from 'react';
import { GlobalProvider } from './context/index';
import { useAuth } from './context/AuthContext';
import { useSettings } from './context/SettingsContext';
import { useAbsensi } from './context/AbsensiContext';
import { useUI } from './context/UIContext';
import { useToast } from './hooks/useToast';
import { useGASSync } from './hooks/useGASSync';
import { APP_LOGO_URL } from './data/initialData';
import { Navbar } from './components/layout/Navbar';
import { UserTodaySubHeader } from './components/layout/UserTodaySubHeader';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { Footer } from './components/layout/Footer';
import { ToastContainer } from './components/common/ToastContainer';
import { SyncStatusBanner } from './components/common/SyncStatusBanner';
import { VersionUpdateNotification } from './components/common/VersionUpdateNotification';
import { NotificationListener } from './components/layout/NotificationListener';
import { Database, Loader2 } from 'lucide-react';
import { logWIBDebug } from './utils/dateUtils';

import { LoginPage } from './pages/LoginPage';
import { InisiasiPage } from './pages/InisiasiPage';

function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default?: T; [key: string]: any }>,
  exportName?: string
): React.LazyExoticComponent<T> {
  return React.lazy<T>(async () => {
    const load = async () => {
      const m = await importer();
      const comp = (exportName ? m[exportName] : undefined) || m.default;
      if (!comp) {
        throw new Error(`Module export ${exportName || 'default'} not found`);
      }
      return { default: comp as T };
    };

    try {
      return await load();
    } catch (firstErr) {
      // Transient retry (e.g. Vite dev server dep re-optimization or brief network hiccup)
      await new Promise((r) => setTimeout(r, 350));
      try {
        return await load();
      } catch (secondErr) {
        const msg = String((secondErr as any)?.message || secondErr || '').toLowerCase();
        const isChunkError =
          msg.includes('failed to fetch dynamically imported module') ||
          msg.includes('importing a module script failed') ||
          msg.includes('loading chunk') ||
          msg.includes('error loading dynamically imported module');

        if (isChunkError && typeof window !== 'undefined') {
          const lastReload = Number(sessionStorage.getItem('aphro_chunk_reload_ts') || '0');
          if (Date.now() - lastReload > 15000) {
            sessionStorage.setItem('aphro_chunk_reload_ts', String(Date.now()));
            window.location.reload();
          }
        }
        throw secondErr;
      }
    }
  });
}

// Lazy Loaded Pages
const MaintenancePage = lazyWithRetry(() => import('./pages/MaintenancePage'));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'), 'DashboardPage');
const WorkOrderMainPage = lazyWithRetry(() => import('./pages/WorkOrderMainPage'), 'WorkOrderMainPage');
const RealisasiMainPage = lazyWithRetry(() => import('./pages/RealisasiMainPage'), 'RealisasiMainPage');
const MonitoringPage = lazyWithRetry(() => import('./pages/MonitoringPage'), 'MonitoringPage');
const CetakLaporanPage = lazyWithRetry(() => import('./pages/CetakLaporanPage'), 'CetakLaporanPage');
const MasterDataPage = lazyWithRetry(() => import('./pages/MasterDataPage'), 'MasterDataPage');
const AuditLogPage = lazyWithRetry(() => import('./pages/AuditLogPage'), 'AuditLogPage');
const UserWelcomePage = lazyWithRetry(() => import('./pages/UserWelcomePage'), 'UserWelcomePage');
const AbsensiKerjaPage = lazyWithRetry(() => import('./pages/AbsensiKerjaPage'), 'AbsensiKerjaPage');
const AbsensiMainPage = lazyWithRetry(() => import('./pages/AbsensiMainPage'), 'AbsensiMainPage');
const RekapPekerjaanHarianPage = lazyWithRetry(() => import('./pages/RekapPekerjaanHarianPage'), 'RekapPekerjaanHarianPage');
const RekapPenyulangHarianPage = lazyWithRetry(() => import('./pages/RekapPenyulangHarianPage'), 'RekapPenyulangHarianPage');
const SettingAplikasiPage = lazyWithRetry(() => import('./pages/SettingAplikasiPage'), 'SettingAplikasiPage');
const SinkronisasiPage = lazyWithRetry(() => import('./pages/SinkronisasiPage'), 'SinkronisasiPage');
const MigrasiDatabasePage = lazyWithRetry(() => import('./pages/MigrasiDatabasePage'), 'MigrasiDatabasePage');
const KinerjaPage = lazyWithRetry(() => import('./pages/KinerjaPage'), 'KinerjaPage');

import { useNotifications } from './hooks/useNotifications';

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-12 space-y-4">
    <Loader2 className="w-8 h-8 text-[#00A2B9] animate-spin" />
    <p className="text-xs font-bold text-slate-400">
      Memuat Halaman...
    </p>
  </div>
);

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  useNotifications();

  const { activeTab, setActiveTab } = useUI();

  const { settings } = useSettings();

  const {
    hasCheckedInToday,
    isLoading: isAbsensiLoading,
    absensiList,
    hasVerifiedWithServer,
    absensiVerificationStatus,
  } = useAbsensi();

  const {
    isSyncing,
    syncWithGAS,
    isGasConnected,
    triggerActivitySync,
  } = useGASSync();

  React.useEffect(() => {
    logWIBDebug('APHRO GLOBAL WIB INITIALIZATION');
  }, []);

  const [
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  ] = React.useState(false);

  const [
    showAbsensiForm,
    setShowAbsensiForm,
  ] = React.useState(false);

  /*
   * =========================================================
   * FIX UTAMA ABSENSI
   * =========================================================
   *
   * State ini memastikan setelah ABSENSI berhasil,
   * user tidak dikembalikan lagi ke halaman ABSENSI
   * walaupun hasCheckedInToday melakukan render ulang.
   */
  const [
    attendanceCompleted,
    setAttendanceCompleted,
  ] = React.useState(false);

  // Reset attendance state when user logs out
  React.useEffect(() => {
    if (!user) {
      setAttendanceCompleted(false);
      setShowAbsensiForm(false);
    }
  }, [user]);

  const [
    isInitialLoading,
    setIsInitialLoading,
  ] = React.useState(true);

  const [
    isInitiated,
    setIsInitiated,
  ] = React.useState<boolean>(() => {
    return (
      localStorage.getItem(
        'aphro_has_initiated'
      ) === 'true'
    );
  });

  /*
   * =========================================================
   * ROLE ADM
   * =========================================================
   */
  const isAdmRole =
    user &&
    (
      (user.role || '')
        .toUpperCase() === 'ADM' ||
      (user.userName || '')
        .toLowerCase() === 'admbkt' ||
      (user.nip || '')
        .toLowerCase() === 'admbkt' ||
      (user.id || '')
        .toLowerCase() === 'admbkt'
    );

  const userRoleClean = (user?.role || '').toString().trim().toUpperCase();
  const isUserRole = userRoleClean === 'USER';
  const isAdminRole = userRoleClean === 'ADMIN' || userRoleClean === 'SUPERADMIN' || userRoleClean === 'ADM' || isAdmRole;

  /*
   * =========================================================
   * INITIAL LOADING
   * =========================================================
   */
  React.useEffect(() => {
    const timer = setTimeout(
      () => setIsInitialLoading(false),
      1500
    );

    return () => clearTimeout(timer);
  }, []);

  /*
   * =========================================================
   * RESET ATTENDANCE STATE SAAT USER BERGANTI
   * =========================================================
   *
   * Jika logout/login dengan akun berbeda,
   * state attendanceCompleted harus kembali false.
   */
  React.useEffect(() => {
    setAttendanceCompleted(false);
    setShowAbsensiForm(false);
  }, [user?.id]);

  React.useEffect(() => {
    if (user) {
      console.log('[APP ABSENSI GATE]', {
        hasCheckedInToday,
        absensiVerificationStatus,
        userUnitId: user?.unitId,
        userRegu: user?.reguName,
        activeTab
      });
    }
  }, [user, hasCheckedInToday, absensiVerificationStatus, activeTab]);

  React.useEffect(() => {
    if (
      isUserRole &&
      !isAdminRole
    ) {
      if (!activeTab || activeTab === 'dashboard' || activeTab === 'welcome') {
        console.log('[APP USER REDIRECT]', {
          from: activeTab,
          to: 'input_realisasi',
          reason: 'Role USER lands directly on Input Realisasi'
        });
        setActiveTab('input_realisasi');
      }
    }
  }, [
    isUserRole,
    isAdminRole,
    activeTab,
    setActiveTab,
  ]);

  /*
   * =========================================================
   * ADM DEFAULT MENU
   * =========================================================
   */
  React.useEffect(() => {
    if (
      isAdmRole &&
      ![
        'cetak_laporan',
        'realisasi_main',
        'input_realisasi',
        'rekap_harian',
        'rekap_penyulang',
        'monitoring_absensi',
        'settings',
      ].includes(activeTab)
    ) {
      setActiveTab('cetak_laporan');
    }
  }, [
    isAdmRole,
    activeTab,
    setActiveTab,
  ]);

  /*
   * =========================================================
   * RENDER ACTIVE PAGE
   * =========================================================
   */
  const renderActivePage = () => {
    /*
     * -------------------------------------------------------
     * ADM
     * -------------------------------------------------------
     */
    if (isAdmRole) {
      switch (activeTab) {
        case 'riwayat_realisasi':
        case 'realisasi_main':
        case 'input_realisasi':
          return (
            <RealisasiMainPage
              initialSubTab="history"
            />
          );

        case 'rekap_harian':
          return (
            <RekapPekerjaanHarianPage />
          );

        case 'rekap_penyulang':
          return (
            <RekapPenyulangHarianPage />
          );

        case 'monitoring_absensi':
          return (
            <AbsensiMainPage
              initialSubTab="monitoring_absensi"
            />
          );

        case 'migrasi_database':
          return (
            <MigrasiDatabasePage />
          );

        case 'settings':
        case 'setting':
          return (
            <SettingAplikasiPage />
          );

        case 'cetak_laporan':
        default:
          return (
            <CetakLaporanPage />
          );
      }
    }

    /*
     * -------------------------------------------------------
     * USER / ADMIN / SUPERADMIN
     * -------------------------------------------------------
     */
    switch (activeTab) {
      case 'dashboard':
        if (
          (user?.role || '')
            .toUpperCase() === 'USER'
        ) {
          return (
            <RealisasiMainPage
              initialSubTab="input"
            />
          );
        }

        return (
          <DashboardPage />
        );

      case 'work_orders':
        return (
          <WorkOrderMainPage
            initialSubTab="list"
          />
        );

      case 'input_wo':
        return (
          <WorkOrderMainPage
            initialSubTab="input"
          />
        );

      case 'riwayat_realisasi':
        return (
          <RealisasiMainPage
            initialSubTab="history"
          />
        );

      /*
       * =====================================================
       * INPUT REALISASI
       * =====================================================
       *
       * Setelah ABSENSI berhasil,
       * activeTab akan menjadi input_realisasi
       * dan halaman ini yang dibuka.
       */
      case 'realisasi_main':
      case 'input_realisasi':
        return (
          <RealisasiMainPage
            initialSubTab="input"
          />
        );

      case 'input_realisasi_manual':
        return (
          <RealisasiMainPage
            initialSubTab="manual_admin"
          />
        );

      case 'absensi_masuk':
        return (
          <AbsensiKerjaPage
            onSuccess={() => {
              setActiveTab('input_realisasi');
            }}
          />
        );

      case 'absensi':
      case 'absensi_pulang':
        return (
          <AbsensiMainPage
            initialSubTab="absensi_pulang"
          />
        );

      case 'monitoring_absensi':
        return (
          <AbsensiMainPage
            initialSubTab="monitoring_absensi"
          />
        );

      case 'monitoring':
        return (
          <MonitoringPage />
        );

      case 'kinerja':
        if (!isUserRole || isAdminRole) {
          return (
            <DashboardPage />
          );
        }
        return (
          <KinerjaPage />
        );

      case 'cetak_laporan':
        return (
          <CetakLaporanPage />
        );

      case 'rekap_harian':
        if (
          (user?.role || '')
            .toUpperCase() === 'USER'
        ) {
          return (
            <DashboardPage />
          );
        }

        return (
          <RekapPekerjaanHarianPage />
        );

      case 'rekap_penyulang':
        if (
          (user?.role || '')
            .toUpperCase() === 'USER'
        ) {
          return (
            <DashboardPage />
          );
        }

        return (
          <RekapPenyulangHarianPage />
        );

      case 'master_data':
        return (
          <MasterDataPage />
        );

      case 'migrasi_database':
        return (
          <MigrasiDatabasePage />
        );

      case 'settings':
      case 'setting':
        if (
          user?.role !==
          'SuperAdmin'
        ) {
          return (
            <DashboardPage />
          );
        }

        return (
          <SettingAplikasiPage />
        );

      case 'logs':
        return (
          <AuditLogPage />
        );

      case 'inisiasi':
        return (
          <InisiasiPage
            isFromMenu={true}
          />
        );

      case 'sinkronisasi':
        return (
          <SinkronisasiPage />
        );

      default:
        return (
          <DashboardPage />
        );
    }
  };

  /*
   * =========================================================
   * INITIAL LOADING SCREEN
   * =========================================================
   */
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
                const target =
                  e.target as HTMLImageElement;

                if (
                  !target.dataset.failed
                ) {
                  target.dataset.failed =
                    'true';

                  target.src =
                    'https://drive.google.com/uc?export=view&id=1V2zz3q_3umHCaTqeJN6u7kbhGdLrK4NE';
                }
              }}
            />

          </div>

          <div className="space-y-1">

            <p className="text-xs font-extrabold text-teal-400 tracking-widest uppercase">
              {settings.namaUnitLayanan ||
                'UL BUKITTINGGI'}
            </p>

          </div>

          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-3">

            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-teal-400">

              <Database className="w-4 h-4 animate-bounce" />

              <span>
                Menghubungkan ke HyperCloud APHRO-Database...
              </span>

            </div>

            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">

              <div className="bg-gradient-to-r from-[#00A2B9] via-teal-400 to-[#00A2B9] h-1.5 rounded-full animate-pulse w-3/4 mx-auto" />

            </div>

            <p className="text-[11px] text-slate-400">
              Memuat data USERS, Work Order, Realisasi & Absensi dari HyperCloud PostgreSQL...
            </p>

          </div>

        </div>

      </div>
    );
  }

  /*
   * =========================================================
   * USER SUDAH LOGIN
   * =========================================================
   */
  if (user) {
    const userRoleClean = (user.role || '').toString().trim().toUpperCase();
    const isUserRole = userRoleClean === 'USER';
    const isAdminRole = userRoleClean === 'ADMIN' || userRoleClean === 'SUPERADMIN' || userRoleClean === 'ADM' || isAdmRole;

    /*
     * =======================================================
     * GATE ABSENSI
     * =======================================================
     *
     * HANYA berlaku untuk role USER biasa.
     * Akun Admin, SuperAdmin, dan Adm TIDAK WAJIB Melakukan Absensi.
     */
    /*
     * =======================================================
     * LAYOUT UTAMA APHRO
     * =======================================================
     * Role USER langsung masuk ke layout utama dengan tab aktif input_realisasi.
     * Absensi Masuk tetap dapat diakses melalui Menu Utama.
     */
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 pb-20 lg:pb-0">

        <NotificationListener />

        <div className="sticky top-0 z-40">
          <Navbar
            onToggleSidebar={() =>
              setIsMobileSidebarOpen(
                !isMobileSidebarOpen
              )
            }
          />

          {isUserRole && !isAdminRole && <UserTodaySubHeader />}
        </div>

        <SyncStatusBanner />

        <div className="flex-1 flex max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 gap-6">

          <Sidebar
            isOpen={
              isMobileSidebarOpen
            }
            onCloseMobile={() =>
              setIsMobileSidebarOpen(
                false
              )
            }
          />

          <main className="flex-1 min-w-0">

            <React.Suspense
              fallback={
                <LoadingFallback />
              }
            >
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

  /*
   * =========================================================
   * BELUM LOGIN - INISIASI
   * =========================================================
   */
  if (!isInitiated) {
    return (
      <React.Suspense
        fallback={
          <LoadingFallback />
        }
      >

        <InisiasiPage
          onInitiationComplete={() =>
            setIsInitiated(
              true
            )
          }
        />

        <ToastContainer />

      </React.Suspense>
    );
  }

  /*
   * =========================================================
   * MAINTENANCE
   * =========================================================
   */
  if (
    window.location.href ===
    'https://aphro-plum.vercel.app/'
  ) {
    return (
      <React.Suspense
        fallback={
          <LoadingFallback />
        }
      >
        <MaintenancePage />
      </React.Suspense>
    );
  }

  /*
   * =========================================================
   * LOGIN
   * =========================================================
   */
  return (
    <React.Suspense
      fallback={
        <LoadingFallback />
      }
    >

      <LoginPage />

      <ToastContainer />

    </React.Suspense>
  );
};

/*
 * ===========================================================
 * ROOT APP
 * ===========================================================
 */
export default function App() {
  return (
    <GlobalProvider>

      <AppContent />

      <VersionUpdateNotification />

    </GlobalProvider>
  );
}