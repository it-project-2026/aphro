import React, { useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useSettings } from '../context/SettingsContext';
import { useGASSync } from '../context/GASSyncContext';
import { useToast } from '../hooks/useToast';
import { APP_LOGO_URL } from '../data/initialData';
import { 
  Sun, 
  Sunrise, 
  Sunset, 
  Moon, 
  Calendar, 
  MapPin, 
  FileText, 
  ArrowRight,
  Clock,
  UserCheck,
  LogOut,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface UserWelcomePageProps {
  onStartAbsensi: () => void;
}

export const UserWelcomePage: React.FC<UserWelcomePageProps> = ({ onStartAbsensi }) => {
  const { user: currentUser, logout } = useAuth();
  const { workOrders } = useWorkOrders();
  const { settings } = useSettings();
  const { syncWithGAS, isSyncing } = useGASSync();
  const { showToast } = useToast();

  const hasSyncedRef = React.useRef(false);

  // Auto sync when Welcome Page loads to ensure latest WORK_ORDER data from Spreadsheet
  useEffect(() => {
    if (settings.gasWebAppUrl && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      syncWithGAS().catch((err) => {
        console.warn('Auto sync error on welcome page:', err);
      });
    }
  }, [settings.gasWebAppUrl, syncWithGAS]);

  const handleRefreshWO = async () => {
    try {
      showToast('Memuat data Work Order terbaru dari Spreadsheet...', 'info');
      await syncWithGAS();
      showToast('Berhasil memperbarui data Work Order!', 'success');
    } catch {
      showToast('Gagal memuat data dari Spreadsheet', 'error');
    }
  };

  // Determine time of day greeting
  const currentHour = new Date().getHours();
  let greeting = 'Selamat Pagi';
  let GreetingIcon = Sunrise;
  let gradientBg = 'from-amber-500/15 via-sky-500/10 to-blue-600/20';
  let iconColor = 'text-amber-500';

  if (currentHour >= 11 && currentHour < 15) {
    greeting = 'Selamat Siang';
    GreetingIcon = Sun;
    gradientBg = 'from-amber-400/20 via-orange-500/10 to-yellow-600/20';
    iconColor = 'text-amber-500';
  } else if (currentHour >= 15 && currentHour < 19) {
    greeting = 'Selamat Sore';
    GreetingIcon = Sunset;
    gradientBg = 'from-orange-500/25 via-pink-500/10 to-purple-600/20';
    iconColor = 'text-orange-500';
  } else if (currentHour >= 19 || currentHour < 4) {
    greeting = 'Selamat Malam';
    GreetingIcon = Moon;
    gradientBg = 'from-indigo-950/40 via-slate-900/30 to-blue-950/40';
    iconColor = 'text-indigo-400';
  }

  // Today's date string
  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const todayIso = new Date().toISOString().slice(0, 10);

  // Filter work orders strictly matching current logged-in user
  const userMatchedWorkOrders = useMemo(() => {
    if (!currentUser) return [];

    const cleanStr = (s?: string | null) => {
      if (!s) return '';
      return String(s)
        .toLowerCase()
        .replace(/^(regu|tim|petugas)\s+/gi, '')
        .replace(/[^a-z0-9]/gi, '');
    };

    const userReguCandidates = [
      cleanStr(currentUser.reguName),
      cleanStr(currentUser.userName),
      cleanStr(currentUser.name),
      cleanStr(currentUser.nip),
      cleanStr(currentUser.id),
    ].filter(Boolean);

    return workOrders.filter((wo) => {
      // SuperAdmin sees all
      if (currentUser.role === 'SuperAdmin') return true;

      // Admin sees all in their ULP or all if no ULP
      if (currentUser.role === 'Admin' || currentUser.role === 'Adm') {
        if (!currentUser.ulpId && !currentUser.ulpName) return true;
        if (currentUser.ulpId && wo.ulpId && currentUser.ulpId === wo.ulpId) return true;
        if (currentUser.ulpName && wo.ulpName) {
          const u1 = cleanStr(currentUser.ulpName);
          const u2 = cleanStr(wo.ulpName);
          if (u1 && u2 && (u1.includes(u2) || u2.includes(u1))) return true;
        }
        return true;
      }

      // Regular User (Petugas Lapangan / Regu)
      // 1. Direct ID matches
      if (currentUser.reguId && wo.reguId && currentUser.reguId === wo.reguId) return true;
      if (currentUser.id && wo.petugasId && currentUser.id === wo.petugasId) return true;

      // 2. Regu Name / NAMA_REGU match
      const woReguClean = cleanStr(wo.reguName);
      if (woReguClean) {
        for (const uCand of userReguCandidates) {
          if (
            woReguClean === uCand ||
            (woReguClean.length >= 3 && uCand.length >= 3 && (woReguClean.includes(uCand) || uCand.includes(woReguClean)))
          ) {
            return true;
          }
        }
      }

      // 3. Petugas Name match
      const woPetugasClean = cleanStr(wo.petugasName);
      if (woPetugasClean) {
        for (const uCand of userReguCandidates) {
          if (
            woPetugasClean === uCand ||
            (woPetugasClean.length >= 3 && uCand.length >= 3 && (woPetugasClean.includes(uCand) || uCand.includes(woPetugasClean)))
          ) {
            return true;
          }
        }
      }

      // 4. ULP match as fallback
      if (currentUser.ulpId && wo.ulpId && currentUser.ulpId === wo.ulpId) return true;
      if (currentUser.ulpName && wo.ulpName) {
        const u1 = cleanStr(currentUser.ulpName);
        const u2 = cleanStr(wo.ulpName);
        if (u1 && u2 && (u1.includes(u2) || u2.includes(u1))) return true;
      }

      return false;
    });
  }, [workOrders, currentUser]);

  // Today's Work Orders (or active assigned work orders if none specifically dated today)
  const todaysWorkOrders = useMemo(() => {
    const todayMatches = userMatchedWorkOrders.filter((wo) => {
      const isToday = wo.tanggal === todayIso || wo.createdAt?.startsWith(todayIso);
      const isActive = wo.status !== 'Selesai' && wo.status !== 'SELESAI';
      return isToday || isActive;
    });

    return todayMatches.length > 0 ? todayMatches : userMatchedWorkOrders;
  }, [userMatchedWorkOrders, todayIso]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className={`absolute inset-0 bg-gradient-to-tr ${gradientBg} opacity-80 pointer-events-none`} />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full mx-auto space-y-6">
        {/* Top Header Branding */}
        <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-md border border-slate-800 px-6 py-4 rounded-2xl shadow-xl">
          <div className="flex items-center space-x-3">
            <img
              src={settings.logoInstansiUrl || APP_LOGO_URL}
              alt="PLN Logo"
              className="w-10 h-10 object-contain drop-shadow"
              onError={(e) => {
                (e.target as HTMLImageElement).src = APP_LOGO_URL;
              }}
            />
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-cyan-400">
                {settings.namaUnitLayanan || 'PLN ES UP4 Sumatera Barat UP3 Padang'}
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                APHRO - Asset Protection & Hazard Response Operations
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>{todayStr}</span>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 sm:px-3 sm:py-1.5 flex items-center space-x-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl border border-rose-500/30 transition-all"
              title="Kembali ke Menu Login"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-bold">Logout</span>
            </button>
          </div>
        </div>

        {/* Welcome Greeting Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className={`p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 ${iconColor} shadow-inner`}>
                <GreetingIcon className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">
                  {greeting}, Petugas Lapangan!
                </p>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentUser?.name || currentUser?.userName || currentUser?.nip || 'Petugas Regu ROW'}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-300">
                  {currentUser?.reguName && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                      {currentUser.reguName}
                    </span>
                  )}
                  {currentUser?.ulpName && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                      {currentUser.ulpName}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 uppercase">
                    Role: {currentUser?.role || 'User'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left sm:text-right w-full sm:w-auto">
              <div className="flex items-center space-x-2 sm:justify-end text-amber-400 text-xs font-bold mb-1">
                <Clock className="w-4 h-4" />
                <span>Absensi Belum Dilakukan</span>
              </div>
              <p className="text-[11px] text-slate-300 max-w-[220px]">
                Anda wajib mengisi Absensi Kerja & Foto Masuk sebelum memulai penugasan hari ini.
              </p>
            </div>
          </div>

          {/* Call to Action Absensi Button */}
          <div className="pt-2">
            <button
              onClick={onStartAbsensi}
              className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 p-px font-bold shadow-xl shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-700 text-white transition-all group-hover:bg-opacity-90">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                    <UserCheck className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">
                      Verifikasi Kehadiran Tim
                    </div>
                    <div className="text-base sm:text-lg font-black tracking-wide">
                      LAKUKAN ABSENSI MASUK SEKARANG
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-cyan-200 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          </div>
        </div>

        {/* Today's Work Order Details Table Preview */}
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 text-cyan-400">
              <FileText className="w-5 h-5" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-white">
                Detail Work Order Hari Ini ({todaysWorkOrders.length})
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-400 font-medium truncate">
                Ditugaskan ke: <strong className="text-cyan-300">{currentUser?.reguName || currentUser?.name || currentUser?.ulpName || 'User Login'}</strong>
              </span>
              <button
                type="button"
                onClick={handleRefreshWO}
                disabled={isSyncing}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-all disabled:opacity-50"
                title="Refresh Work Order dari Spreadsheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {todaysWorkOrders.length === 0 ? (
            <div className="text-center py-10 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500/80 mx-auto" />
              <p className="text-xs text-slate-300 font-semibold">
                Tidak ada Work Order yang sesuai dengan unit / regu ({currentUser?.reguName || currentUser?.ulpName || currentUser?.name}) untuk hari ini.
              </p>
              <p className="text-[10px] text-slate-500">
                Silakan pastikan data Work Order di Google Spreadsheet sudah terdaftar untuk regu/ULP ini.
              </p>
              <button
                type="button"
                onClick={handleRefreshWO}
                disabled={isSyncing}
                className="mt-2 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all hover:bg-cyan-500/30 inline-flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Dari Spreadsheet</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {todaysWorkOrders.map((wo, index) => {
                const isFinished = wo.status === 'Selesai' || wo.status === 'SELESAI';
                const isProgress = wo.status === 'Sedang Dikerjakan';

                return (
                  <div
                    key={`${wo.id}-${index}`}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5 group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800/60">
                          {wo.nomorWO}
                        </span>
                        {wo.pekerjaan && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            wo.pekerjaan === 'GOROW'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {wo.pekerjaan}
                          </span>
                        )}
                      </div>

                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full border flex items-center space-x-1 ${
                        isFinished
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : isProgress
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        {isFinished ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>{wo.status || 'Belum Dikerjakan'}</span>
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">
                        {wo.jenisPekerjaan || 'Pemangkasan Pohon (ROW)'} {wo.penyulangName ? `• ${wo.penyulangName}` : ''}
                      </p>
                      {wo.deskripsi && (
                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {wo.deskripsi}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-900 text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{wo.lokasi || wo.ulpName || 'Lokasi Padang'}</span>
                      </div>

                      <div className="flex items-center space-x-1.5 truncate">
                        <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Tanggal: {wo.tanggal}</span>
                      </div>

                      {wo.volumePekerjaan ? (
                        <div className="flex items-center space-x-1.5 sm:justify-end text-cyan-300 font-mono font-bold">
                          <span>Vol: {wo.volumePekerjaan} {wo.satuan || 'KMS'}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center text-[11px] text-slate-500 pb-4">
          © 13307BKT- 2026 PLN ES UP4 Sumatera Barat. All rights reserved.
        </div>
      </div>
    </div>
  );
};

