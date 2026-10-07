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
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { Footer } from './components/layout/Footer';
import { ToastContainer } from './components/common/ToastContainer';
import { SyncStatusBanner } from './components/common/SyncStatusBanner';
import { VersionUpdateNotification } from './components/common/VersionUpdateNotification';
import { NotificationListener } from './components/layout/NotificationListener';
import { Database, Loader2 } from 'lucide-react';
import { logWIBDebug } from './utils/dateUtils';

// Lazy Loaded Pages
const LoginPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/LoginPage').then((m: any) => ({ default: m.default || m.LoginPage }))
);
const MaintenancePage = React.lazy<React.ComponentType<any>>(() => import('./pages/MaintenancePage'));
const DashboardPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/DashboardPage').then((m: any) => ({ default: m.default || m.DashboardPage }))
);
const WorkOrderMainPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/WorkOrderMainPage').then((m: any) => ({ default: m.default || m.WorkOrderMainPage }))
);
const RealisasiMainPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/RealisasiMainPage').then((m: any) => ({ default: m.default || m.RealisasiMainPage }))
);
const MonitoringPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/MonitoringPage').then((m: any) => ({ default: m.default || m.MonitoringPage }))
);
const CetakLaporanPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/CetakLaporanPage').then((m: any) => ({ default: m.default || m.CetakLaporanPage }))
);
const MasterDataPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/MasterDataPage').then((m: any) => ({ default: m.default || m.MasterDataPage }))
);
const AuditLogPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/AuditLogPage').then((m: any) => ({ default: m.default || m.AuditLogPage }))
);
const UserWelcomePage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/UserWelcomePage').then((m: any) => ({ default: m.default || m.UserWelcomePage }))
);
const AbsensiKerjaPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/AbsensiKerjaPage').then((m: any) => ({ default: m.default || m.AbsensiKerjaPage }))
);
const AbsensiMainPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/AbsensiMainPage').then((m: any) => ({ default: m.default || m.AbsensiMainPage }))
);
const InisiasiPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/InisiasiPage').then((m: any) => ({ default: m.default || m.InisiasiPage }))
);
const RekapPekerjaanHarianPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/RekapPekerjaanHarianPage').then((m: any) => ({ default: m.default || m.RekapPekerjaanHarianPage }))
);
const RekapPenyulangHarianPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/RekapPenyulangHarianPage').then((m: any) => ({ default: m.default || m.RekapPenyulangHarianPage }))
);
const SettingAplikasiPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/SettingAplikasiPage').then((m: any) => ({ default: m.default || m.SettingAplikasiPage }))
);
const SinkronisasiPage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/SinkronisasiPage').then((m: any) => ({ default: m.default || m.SinkronisasiPage }))
);
const MigrasiDatabasePage = React.lazy<React.ComponentType<any>>(() =>
  import('./pages/MigrasiDatabasePage').then((m: any) => ({ default: m.default || m.MigrasiDatabasePage }))
);

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
      !isAdminRole &&
      (hasCheckedInToday || attendanceCompleted)
    ) {
      if (activeTab === 'dashboard' || activeTab === 'absensi' || activeTab === 'welcome') {
        console.log('[APP ABSENSI REDIRECT]', {
          from: activeTab,
          to: 'input_realisasi',
          reason: 'hasCheckedInToday=true'
        });
        setActiveTab('input_realisasi');
      }
    }
  }, [
    isUserRole,
    isAdminRole,
    hasCheckedInToday,
    attendanceCompleted,
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
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    console.log(`[APP ABSENSI GATE]
hasCheckedInToday: ${hasCheckedInToday}
absensiVerificationStatus: ${absensiVerificationStatus}
user.unitId: ${user?.unitId}
user.reguName: ${user?.reguName || (user as any)?.groupWO}
activeTab: ${activeTab}`);

    if (
      isUserRole &&
      !isAdminRole &&
      (absensiVerificationStatus === 'loading')
    ) {
      return <LoadingFallback />;
    }

    if (
      isUserRole &&
      !isAdminRole &&
      !hasCheckedInToday &&
      !attendanceCompleted
    ) {
      console.log('[APP ABSENSI GATE] REDIRECT -> VERIFIKASI ABSENSI');
      return (
        <React.Suspense
          fallback={
            <LoadingFallback />
          }
        >

          <NotificationListener />

          <SyncStatusBanner />

          {showAbsensiForm ? (

            <AbsensiKerjaPage
              onSuccess={() => {
                console.log(
                  '[ABSENSI TRACE APP] Absensi berhasil. Membuka INPUT REALISASI.'
                );

                /*
                 * =================================================
                 * FIX UTAMA
                 * =================================================
                 *
                 * Tandai bahwa ABSENSI sudah selesai
                 * pada sesi login ini.
                 */
                setAttendanceCompleted(
                  true
                );

                /*
                 * Tutup form ABSENSI.
                 */
                setShowAbsensiForm(
                  false
                );

                /*
                 * Langsung arahkan ke INPUT REALISASI.
                 */
                setActiveTab(
                  'input_realisasi'
                );
              }}
            />

          ) : (

            <UserWelcomePage
              onStartAbsensi={() =>
                setShowAbsensiForm(
                  true
                )
              }
            />

          )}

          <ToastContainer />

        </React.Suspense>
      );
    }

    /*
     * =======================================================
     * USER SUDAH ABSENSI / ATTENDANCE COMPLETED
     * =======================================================
     */
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 pb-20 lg:pb-0">

        <NotificationListener />

        <Navbar
          onToggleSidebar={() =>
            setIsMobileSidebarOpen(
              !isMobileSidebarOpen
            )
          }
        />

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