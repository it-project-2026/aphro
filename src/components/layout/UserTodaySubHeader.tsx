import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useWorkOrders } from '../../context/WorkOrderContext';
import { useRealisasi } from '../../context/RealisasiContext';
import { useMasterData } from '../../context/MasterDataContext';
import { useUI } from '../../context/UIContext';
import { InisiasiService, getStandardUnitId } from '../../services/inisiasiService';
import { deduplicateWorkOrders } from '../../services/rekapHarianService';
import { formatDateDisplay, getWIBDateString } from '../../utils/dateUtils';
import {
  computeUserTodayMetrics,
  filterRealisasiForLoggedInUser,
  isStrictUserRoleAccount,
  matchesLoggedInUserWO,
  resolveStrictUserIdentity,
} from '../../utils/userKinerjaUtils';
import { Activity, Axe, Clock, Scissors } from 'lucide-react';

export const UserTodaySubHeader: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { settings } = useSettings();
  const { workOrders, displayedWorkOrders } = useWorkOrders();
  const { realisasiList, dashboardRealisasiList } = useRealisasi();
  const { users, ulpList, reguList } = useMasterData();
  const { setActiveTab } = useUI();

  const isStrictUser = isStrictUserRoleAccount(currentUser);

  const activeUnitId = useMemo(() => {
    return (
      getStandardUnitId(
        currentUser?.unitId ||
          settings.namaUnitLayanan ||
          InisiasiService.getSelectedUnitId() ||
          'UL1'
      ) || 'UL1'
    );
  }, [currentUser?.unitId, settings.namaUnitLayanan]);

  const activeUnitName = useMemo(() => {
    return (
      settings.namaUnitLayanan ||
      localStorage.getItem('aphro_nama_unit_layanan') ||
      InisiasiService.getActiveInisiasiUnit().namaUL
    );
  }, [settings.namaUnitLayanan]);

  const userIdentity = useMemo(() => {
    return resolveStrictUserIdentity(currentUser, activeUnitName, users, ulpList, reguList);
  }, [currentUser, activeUnitName, users, ulpList, reguList]);

  const todayWIB = getWIBDateString();

  const todayMetrics = useMemo(() => {
    if (!isStrictUser || !currentUser) {
      return {
        totalRealisasiHariIni: 0,
        totalTebangHariIni: 0,
        totalPangkasHariIni: 0,
      };
    }

    const strictWOs = [...displayedWorkOrders, ...workOrders].filter((wo) =>
      matchesLoggedInUserWO(
        wo,
        currentUser,
        activeUnitId,
        userIdentity.reguName,
        activeUnitName,
        userIdentity
      )
    );
    const userWOs = deduplicateWorkOrders(strictWOs);

    const combinedRealisasi = [
      ...(dashboardRealisasiList || []),
      ...(realisasiList || []),
    ];

    const userRealisasi = filterRealisasiForLoggedInUser(
      combinedRealisasi,
      userWOs,
      currentUser,
      activeUnitId,
      userIdentity.reguName,
      activeUnitName,
      userIdentity
    );

    return computeUserTodayMetrics(userRealisasi, todayWIB);
  }, [
    isStrictUser,
    currentUser,
    displayedWorkOrders,
    workOrders,
    dashboardRealisasiList,
    realisasiList,
    activeUnitId,
    activeUnitName,
    userIdentity,
    todayWIB,
  ]);

  if (!isStrictUser) return null;

  return (
    <section
      aria-label="SubHeader Kinerja Hari Ini"
      className="relative z-10 bg-gradient-to-r from-teal-50/95 via-white/95 to-teal-50/95 dark:from-slate-900/95 dark:via-slate-900/95 dark:to-slate-800/95 backdrop-blur-md border-b border-teal-200/80 dark:border-slate-800 shadow-sm transition-colors duration-200"
    >
      <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          {/* Left Identity & Date Label */}
          <div className="flex items-center justify-between lg:justify-start gap-2 min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-[#008396] dark:text-teal-400 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-teal-900 dark:text-teal-300 truncate">
                  Kinerja Hari Ini • {formatDateDisplay(todayWIB)}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {userIdentity.reguName || currentUser?.reguName || currentUser?.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('kinerja')}
              className="lg:hidden px-2.5 py-1 rounded-lg bg-teal-600/10 hover:bg-teal-600/20 text-[#008396] dark:text-teal-300 text-[10px] font-extrabold uppercase tracking-tight shrink-0 transition-colors"
            >
              Detail Kinerja
            </button>
          </div>

          {/* 3 Today Metric Boxes */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:flex lg:items-center">
            <button
              type="button"
              onClick={() => setActiveTab('kinerja')}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white dark:bg-slate-800/90 border border-teal-200/80 dark:border-slate-700 hover:border-[#00A2B9] shadow-2xs transition-all text-left"
              title="Buka Halaman Kinerja"
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                <Activity className="w-3.5 h-3.5 text-[#00A2B9] shrink-0" />
                <span className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-tight text-slate-600 dark:text-slate-300 leading-tight">
                  TOTAL REALISASI HARI INI
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white shrink-0">
                {todayMetrics.totalRealisasiHariIni}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kinerja')}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white dark:bg-slate-800/90 border border-rose-200/80 dark:border-slate-700 hover:border-rose-400 shadow-2xs transition-all text-left"
              title="Buka Halaman Kinerja"
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                <Axe className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-tight text-slate-600 dark:text-slate-300 leading-tight">
                  TOTAL TEBANG HARI INI
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 shrink-0">
                {todayMetrics.totalTebangHariIni}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kinerja')}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white dark:bg-slate-800/90 border border-emerald-200/80 dark:border-slate-700 hover:border-emerald-400 shadow-2xs transition-all text-left"
              title="Buka Halaman Kinerja"
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                <Scissors className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-tight text-slate-600 dark:text-slate-300 leading-tight">
                  TOTAL PANGKAS HARI INI
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                {todayMetrics.totalPangkasHariIni}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
