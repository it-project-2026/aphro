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

// Pages
import { LoginPage } from './pages/LoginPage';
import MaintenancePage from './pages/MaintenancePage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkOrderMainPage } from './pages/WorkOrderMainPage';
import { RealisasiMainPage } from './pages/RealisasiMainPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { CetakLaporanPage } from './pages/CetakLaporanPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { UserWelcomePage } from './pages/UserWelcomePage';
import { AbsensiKerjaPage } from './pages/AbsensiKerjaPage';
import { AbsensiMainPage } from './pages/AbsensiMainPage';
import { InisiasiPage } from './pages/InisiasiPage';
import { RekapPekerjaanHarianPage } from './pages/RekapPekerjaanHarianPage';
import { RekapPenyulangHarianPage } from './pages/RekapPenyulangHarianPage';
import { SettingAplikasiPage } from './pages/SettingAplikasiPage';
import { SinkronisasiPage } from './pages/SinkronisasiPage';
import { MigrasiDatabasePage } from './pages/MigrasiDatabasePage';

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
  const { user } = useAuth();

  useNotifications();

  const { activeTab, setActiveTab } = useUI();

  const { settings } = useSettings();

  const { hasCheckedInToday } = useAbsensi();

  const {
    isSyncing,
    syncWithGAS,
    isGasConnected,
    triggerActivitySync,
  } = useGASSync();

  const { showToast } = useToast();

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
        'riwayat_realisasi',
        'realisasi_main',
        'input_realisasi',
        'rekap_harian',
        'rekap_penyulang',
        'monitoring_absensi',
        'settings',
        'migrasi_database',
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
            <WorkOrderMainPage />
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
    const isUserRole =
      (user.role || '')
        .toUpperCase() ===
      'USER';

    /*
     * =======================================================
     * GATE ABSENSI
     * =======================================================
     *
     * FIX:
     *
     * Sebelumnya:
     *
     * !hasCheckedInToday
     *
     * menyebabkan user bisa kembali ke ABSENSI
     * setelah render ulang.
     *
     * Sekarang:
     *
     * !hasCheckedInToday &&
     * !attendanceCompleted
     *
     * Setelah onSuccess() -> attendanceCompleted = true
     * sehingga gerbang ABSENSI langsung dilewati.
     */
    if (
      isUserRole &&
      !isAdmRole &&
      !hasCheckedInToday &&
      !attendanceCompleted
    ) {
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
      <MaintenancePage />
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