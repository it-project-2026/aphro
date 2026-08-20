import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';
import { useGASSync } from '../../hooks/useGASSync';
import { useToast } from '../../hooks/useToast';
import { APP_LOGO_URL } from '../../data/initialData';
import {
  LayoutDashboard,
  ClipboardList,
  FilePlus,
  CheckSquare,
  MapPin,
  Printer,
  Database,
  Settings,
  History,
  X,
  Zap,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  LogOut,
  Clock,
  CalendarCheck,
  Building2,
  CalendarRange,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const { user: currentUser } = useAuth();
  const { settings } = useSettings();
  const { activeTab, setActiveTab } = useUI();
  const { isGasConnected, syncWithGAS } = useGASSync();
  const { showToast } = useToast();
  
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSidebarSync = async () => {
    setIsSyncing(true);
    showToast('Menyinkronkan data dari Google Spreadsheet...', 'info');
    try {
      await syncWithGAS();
    } finally {
      setIsSyncing(false);
    }
  };

  const role = currentUser?.role || 'User';

  const isAdmRole = currentUser && (
    (currentUser.role || '').toUpperCase() === 'ADM' ||
    (currentUser.userName || '').toLowerCase() === 'admbkt' ||
    (currentUser.nip || '').toLowerCase() === 'admbkt' ||
    (currentUser.id || '').toLowerCase() === 'admbkt'
  );

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Utama',
      icon: LayoutDashboard,
      roles: ['SuperAdmin', 'Admin'],
    },
    {
      id: 'work_orders',
      label: role === 'User' ? 'Work Order Saya' : 'Daftar Work Order',
      icon: ClipboardList,
      roles: ['SuperAdmin', 'Admin', 'User'],
    },
    {
      id: 'input_wo',
      label: 'Input Work Order',
      icon: FilePlus,
      roles: ['SuperAdmin', 'Admin'],
    },
    {
      id: 'input_realisasi',
      label: 'Input Realisasi',
      icon: CheckSquare,
      roles: ['SuperAdmin', 'Admin', 'User'],
    },
    {
      id: 'absensi_pulang',
      label: 'Absensi Pulang',
      icon: LogOut,
      roles: ['SuperAdmin', 'Admin', 'User'],
    },
    {
      id: 'monitoring_absensi',
      label: 'Monitoring Absensi',
      icon: Clock,
      roles: ['SuperAdmin', 'Admin', 'Adm', 'User'],
    },
    {
      id: 'monitoring',
      label: role === 'User' ? 'Monitoring' : 'Monitoring & Peta Maps',
      icon: MapPin,
      roles: ['SuperAdmin', 'Admin', 'User'],
    },
    {
      id: 'cetak_laporan',
      label: 'Cetak Laporan',
      icon: Printer,
      roles: ['SuperAdmin', 'Admin', 'Adm'],
    },
    {
      id: 'rekap_harian',
      label: 'Rekap Pekerjaan Harian',
      icon: CalendarRange,
      roles: ['SuperAdmin', 'Admin', 'Adm'],
    },
    {
      id: 'master_data',
      label: 'Master Data',
      icon: Database,
      roles: ['SuperAdmin', 'Admin'],
    },
    {
      id: 'settings',
      label: 'Setting Aplikasi',
      icon: Settings,
      roles: ['SuperAdmin'],
    },
    {
      id: 'inisiasi',
      label: 'Inisiasi Unit Layanan',
      icon: Building2,
      roles: ['SuperAdmin', 'Admin', 'User'],
    },
    {
      id: 'logs',
      label: 'Audit Log & Activity',
      icon: History,
      roles: ['SuperAdmin', 'Admin'],
    },
  ];

  const allowedItems = isAdmRole
    ? navItems.filter((item) => item.id === 'cetak_laporan' || item.id === 'rekap_harian' || item.id === 'monitoring_absensi')
    : navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation Panel */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Header Mobile Close */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 lg:hidden">
            <div className="flex items-center space-x-2">
              <img
                src={APP_LOGO_URL}
                alt="APHRO Logo"
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://drive.google.com/uc?export=view&id=1V2zz3q_3umHCaTqeJN6u7kbhGdLrK4NE';
                }}
              />
              <span className="font-extrabold text-slate-900 dark:text-white">APHRO Menu</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Status Card Badge */}
          <div className="p-4">
            <div className="p-3 rounded-2xl bg-sky-50 dark:bg-slate-800/60 border border-sky-100 dark:border-slate-700/60 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-400">
                Akses Terotentikasi
              </p>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                {currentUser?.name}
              </p>
              <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-600 text-white shadow-xs">
                {role === 'User' ? 'Petugas ROW' : role}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 flex-1 py-2">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Menu Utama
            </p>

            {allowedItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={`${item.id}-${idx}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600 text-white font-bold shadow-md shadow-sky-600/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50/80 dark:hover:bg-slate-800/80 hover:text-sky-700 dark:hover:text-sky-300'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400 group-hover:text-sky-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Spreadsheet Database Connection Card Widget */}
          <div className="px-3 py-2">
            <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-black text-emerald-950 dark:text-emerald-200 uppercase font-display tracking-tight">
                    Spreadsheet DB
                  </span>
                </div>
                <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isGasConnected ? 'ONLINE' : 'ACTIVE'}</span>
                </span>
              </div>
              <p className="text-[10px] text-emerald-800 dark:text-emerald-300/80 font-medium line-clamp-1">
                APHRO_DATABASE_ENTERPRISE
              </p>
              <button
                type="button"
                onClick={handleSidebarSync}
                disabled={isSyncing}
                className="w-full py-1.5 px-2 bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 hover:from-sky-700 hover:to-cyan-600 text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-all shadow-md disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sinkronisasi...' : 'Sync Data'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Version Tag */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
            {settings.namaUnitLayanan}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {settings.versiAplikasi}
          </p>
        </div>
      </aside>
    </>
  );
};
