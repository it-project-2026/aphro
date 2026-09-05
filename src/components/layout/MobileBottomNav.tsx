import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useGASSync } from '../../context/GASSyncContext';
import {
  LayoutDashboard,
  ClipboardList,
  Camera,
  LogOut,
  MapPin,
  RefreshCw,
  Clock,
  PlusCircle,
  Printer,
  CalendarRange,
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const { activeTab, setActiveTab } = useUI();
  const { pendingCount, isSyncing, syncWithGAS } = useGASSync();

  if (!user) return null;

  const role = user.role || 'User';

  const isAdmRole = user && (
    (user.role || '').toUpperCase() === 'ADM' ||
    (user.userName || '').toLowerCase() === 'admbkt' ||
    (user.nip || '').toLowerCase() === 'admbkt' ||
    (user.id || '').toLowerCase() === 'admbkt'
  );

  // Navigation tabs optimized for mobile HP usage
  const mobileTabs = isAdmRole
    ? [
        {
          id: 'cetak_laporan',
          label: 'Cetak Laporan',
          icon: Printer,
          highlight: true,
        },
        {
          id: 'rekap_harian',
          label: 'Rekap Harian',
          icon: CalendarRange,
        },
        {
          id: 'rekap_penyulang',
          label: 'Rekap Penyulang',
          icon: CalendarRange,
        },
        {
          id: 'monitoring_absensi',
          label: 'Monitoring Absensi',
          icon: Clock,
        },
      ]
    : [
        {
          id: 'dashboard',
          label: 'Beranda',
          icon: LayoutDashboard,
        },
        {
          id: 'work_orders',
          label: 'WO Saya',
          icon: ClipboardList,
        },
        {
          id: 'input_realisasi',
          label: 'Realisasi',
          icon: Camera,
          highlight: true, // Special center action button for mobile
        },
        {
          id: 'absensi_pulang',
          label: 'Absensi',
          icon: LogOut,
        },
        {
          id: 'monitoring',
          label: 'Monitoring',
          icon: MapPin,
        },
      ];

  // Extra filter to explicitly remove absensi_pulang for Admin even in non-isAdmRole branch
  const finalTabs = mobileTabs.filter(tab => {
    if (tab.id === 'absensi_pulang') {
      const uRole = (user?.role || '').toUpperCase();
      return uRole !== 'ADMIN' && uRole !== 'ADM';
    }
    return true;
  });

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg pb-safe">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto relative">
        {finalTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative -top-4 flex flex-col items-center justify-center"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 ${
                    isActive
                      ? 'bg-gradient-to-tr from-[#008396] via-[#00A2B9] to-[#00C2DE] text-white ring-4 ring-teal-100 dark:ring-teal-950 scale-105'
                      : 'bg-gradient-to-tr from-[#008396] to-[#00A2B9] text-white shadow-[#00A2B9]/30'
                  }`}
                >
                  <Camera className="w-7 h-7" />
                </div>
                <span
                  className={`text-[10px] font-extrabold mt-0.5 ${
                    isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                {tab.id === 'work_orders' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-display truncate max-w-[64px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
