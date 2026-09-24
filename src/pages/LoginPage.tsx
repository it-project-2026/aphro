import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useGASSync } from '../hooks/useGASSync';
import { useToast } from '../hooks/useToast';
import { APP_LOGO_URL } from '../data/initialData';
import { saveAndEmbedGasConfig } from '../config/gasConfig';
import { GASApiService } from '../services/gasApiService';
import { normalizeUser } from '../services/syncService';
import { InisiasiService, DEFAULT_UL_OPTIONS } from '../services/inisiasiService';
import { AuthService } from '../services/authService';
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  FileSpreadsheet,
  CheckCircle2,
  Eye,
  EyeOff,
  X,
  Radio,
  Building2,
  LogIn,
  WifiOff,
  Server,
  Database,
} from 'lucide-react';

interface LoginPageProps {
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const { login } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { setActiveTab } = useUI();
  const { isGasConnected, syncWithGAS } = useGASSync();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(navigator.onLine);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnlineState(true);
    const handleOffline = () => setIsOnlineState(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Quick GAS URL Config Modal state on Login Page
  const [showGasModal, setShowGasModal] = useState(false);
  const [tempGasUrl, setTempGasUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      showToast('Harap masukkan USERID / Username', 'warning');
      return;
    }
    setIsSubmitting(true);
    
    const safeUsername = (username || '').trim().toLowerCase();
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const activeUnitId = activeInisiasi.unitId;

    // 1. Try Direct HyperCloud PostgreSQL Login via AuthService (POST /api/login)
    if (navigator.onLine) {
      try {
        const hcRes = await AuthService.loginWithCredentials(username, password, activeUnitId);
        if (hcRes.success && hcRes.user) {
          const authenticatedUser = hcRes.user;
          if (!authenticatedUser.unitId) {
            authenticatedUser.unitId = activeUnitId;
          }
          login(authenticatedUser);

          // Trigger automatic background sync
          syncWithGAS(undefined, true).catch(() => {});

          const isAdm = (authenticatedUser.role || '').toUpperCase() === 'ADM' || (authenticatedUser.userName || authenticatedUser.nip || authenticatedUser.id || '').toLowerCase() === 'admbkt';
          if (isAdm) {
            setActiveTab('cetak_laporan');
          } else if ((authenticatedUser.role || '').toUpperCase() === 'USER') {
            setActiveTab('input_realisasi');
          } else {
            setActiveTab('dashboard');
          }
          showToast(`Selamat datang, ${authenticatedUser.name || authenticatedUser.userName}! [Unit: ${activeInisiasi.namaUL} (${activeUnitId}) - Role: ${authenticatedUser.role}]`, 'success');
          setIsSubmitting(false);
          return;
        } else if (hcRes.error && (hcRes.error.includes('Password') || hcRes.error.includes('Non-Aktif') || hcRes.error.includes('terdaftar') || hcRes.error.includes('sandi'))) {
          showToast(hcRes.error, 'error');
          setIsSubmitting(false);
          return;
        }
      } catch {
        // Fallback to next auth method
      }
    }

    // 2. Try Direct GAS Login Endpoint if GAS URL is configured and online
    if (settings.gasWebAppUrl && navigator.onLine) {
      try {
        const gasRes = await GASApiService.login(settings.gasWebAppUrl, username, password, activeUnitId);
        if (gasRes && gasRes.status === 'success' && (gasRes.user || gasRes.data)) {
          const rawUserObj = gasRes.user || gasRes.data;
          const authenticatedUser = normalizeUser(rawUserObj);
          if (!authenticatedUser.unitId) {
            authenticatedUser.unitId = activeUnitId;
          }
          
          login(authenticatedUser);
          
          if (settings.gasWebAppUrl && navigator.onLine) {
            syncWithGAS(undefined, true).catch(() => {});
          }

          const isAdm = (authenticatedUser.role || '').toUpperCase() === 'ADM' || (authenticatedUser.userName || authenticatedUser.nip || authenticatedUser.id || '').toLowerCase() === 'admbkt';
          if (isAdm) {
            setActiveTab('cetak_laporan');
          } else if ((authenticatedUser.role || '').toUpperCase() === 'USER') {
            setActiveTab('input_realisasi');
          } else {
            setActiveTab('dashboard');
          }
          showToast(`Selamat datang, ${authenticatedUser.name || authenticatedUser.userName}! [Unit: ${activeInisiasi.namaUL} (${activeUnitId}) - Role: ${authenticatedUser.role}]`, 'success');
          setIsSubmitting(false);
          return;
        } else if (gasRes && gasRes.status === 'error' && gasRes.message) {
          if (gasRes.message.toLowerCase().includes('password') || gasRes.message.toLowerCase().includes('sandi') || gasRes.message.toLowerCase().includes('user') || gasRes.message.toLowerCase().includes('unit')) {
            showToast(gasRes.message, 'error');
            setIsSubmitting(false);
            return;
          }
        }
      } catch {
        // Fall back gracefully
      }
    }

    // 3. Fallback for superadmin / admin / adm / user if offline or default roles
    if (safeUsername === 'superadmin' || safeUsername === 'admin' || safeUsername === 'user' || safeUsername === 'adm') {
      const expectedRole = safeUsername === 'superadmin' ? 'SuperAdmin' : safeUsername === 'adm' ? 'ADM' : safeUsername === 'admin' ? 'Admin' : 'User';
      const roleDisplayName = safeUsername === 'superadmin'
        ? `SuperAdmin ${activeInisiasi.namaUL}`
        : safeUsername === 'adm'
        ? `ADM ${activeInisiasi.namaUL}`
        : safeUsername === 'admin'
        ? `Admin ${activeInisiasi.namaUL}`
        : `Petugas Lapangan (${activeInisiasi.namaUL})`;

      login({
        id: `hardcoded-${safeUsername}-${activeUnitId.toLowerCase()}`,
        unitId: activeUnitId,
        unitName: activeInisiasi.namaUL,
        nip: username.toUpperCase(),
        userName: safeUsername,
        name: roleDisplayName,
        role: expectedRole as any,
        email: `${safeUsername}@pln.co.id`,
        ulpName: activeInisiasi.namaUL,
        status: 'Aktif'
      });
      if (settings.gasWebAppUrl && navigator.onLine) {
        syncWithGAS(undefined, true).catch(() => {});
      }
      if (expectedRole === 'ADM') {
        setActiveTab('cetak_laporan');
      } else if (expectedRole === 'User') {
        setActiveTab('input_realisasi');
      } else {
        setActiveTab('dashboard');
      }
      showToast(`Selamat datang, ${roleDisplayName}! [Unit: ${activeInisiasi.namaUL} (${activeUnitId})]`, 'success');
    } else {
      if (!navigator.onLine) {
        login({
          id: `offline-${Date.now()}`,
          unitId: activeUnitId,
          unitName: activeInisiasi.namaUL,
          nip: username.toUpperCase(),
          userName: safeUsername,
          name: username,
          role: 'User',
          email: `${safeUsername}@pln.co.id`,
          ulpName: activeInisiasi.namaUL,
          status: 'Aktif'
        });
        setActiveTab('input_realisasi');
        showToast(`Masuk sebagai ${username} [Unit: ${activeInisiasi.namaUL} (${activeUnitId})]`, 'success');
      } else {
        showToast(`Gagal autentikasi untuk Username "${username}" pada unit ${activeInisiasi.namaUL} (${activeUnitId}). Periksa kembali username dan password Anda.`, 'error');
      }
    }
    
    setIsSubmitting(false);
  };

  const handleSaveGasUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempGasUrl.trim()) {
      showToast('URL Google Apps Script tidak boleh kosong', 'warning');
      return;
    }

    const cleanUrl = tempGasUrl.trim();
    saveAndEmbedGasConfig({ gasWebAppUrl: cleanUrl });
    updateSettings({ gasWebAppUrl: cleanUrl });

    showToast('Menghubungkan ke Spreadsheet...', 'info');
    setShowGasModal(false);
    
    setTimeout(() => {
      syncWithGAS(showToast);
    }, 300);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-teal-50 overflow-hidden font-sans">
      {/* Background Image - Clean and Clear */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: `url(${
            settings.loginBgUrl ||
            'https://lh3.googleusercontent.com/d/1GdbvOn9MIRGeyhdzjpdIeM68Ka0giF_K'
          })`,
        }}
      />

      <div className="relative z-10 w-full max-w-lg space-y-4 my-6">
        {/* Branding Title / Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mx-auto mb-2 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#00A2B9]/10 to-[#00A2B9]/10 rounded-full blur-2xl pointer-events-none"></div>
            <img
              src={APP_LOGO_URL}
              alt="Logo"
              className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-xl relative z-10"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.failed) {
                  target.dataset.failed = 'true';
                  target.src = 'https://drive.google.com/uc?export=view&id=1V2zz3q_3umHCaTqeJN6u7kbhGdLrK4NE';
                }
              }}
            />
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/80 text-black border border-teal-200 shadow-sm backdrop-blur-sm">
                <Building2 className="w-3.5 h-3.5 text-black" />
                <span>{settings.namaUnitLayanan}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/90 backdrop-blur-2xl border border-teal-100 rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-teal-900/5 space-y-6">
          {/* Active Inisiasi Scope Banner */}
          <div className="p-3.5 rounded-2xl bg-cyan-50/90 border border-cyan-200/80 text-cyan-950 flex items-center justify-between shadow-xs gap-3">
            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
              <div className="p-2 bg-cyan-600 text-white rounded-xl shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-xs min-w-0 flex-1 space-y-0.5">
                <span className="text-[9px] uppercase font-black text-cyan-800 tracking-wider block">Pilih Inisiasi Unit Layanan</span>
                <select
                  value={InisiasiService.getActiveInisiasiUnit().unitId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    InisiasiService.saveSelectedUnit(selectedId);
                    const newActive = InisiasiService.getActiveInisiasiUnit();
                    showToast(`Inisiasi Unit beralih ke: ${newActive.namaUL} (${newActive.unitId})`, 'info');
                  }}
                  className="w-full font-bold text-cyan-950 text-xs bg-white border border-cyan-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs cursor-pointer"
                >
                  {DEFAULT_UL_OPTIONS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.namaUL} ({u.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-cyan-600 text-white shadow-xs shrink-0 self-center">
              {InisiasiService.getActiveInisiasiUnit().unitId}
            </span>
          </div>

          {/* Offline / No-Signal Status Alert Banner */}
          {!isOnlineState && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start space-x-3 shadow-xs">
              <div className="p-1.5 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                <WifiOff className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5 min-w-0">
                <p className="font-bold text-amber-900 flex items-center space-x-1.5">
                  <span>Mode Offline (Tanpa Sinyal) Aktif</span>
                  <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-black uppercase">Offline Ready</span>
                </p>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  Aplikasi tetap dapat digunakan 100% untuk Login, Absensi Regu, Foto Kamera, dan Input Realisasi. Semua data tersimpan aman di perangkat dan otomatis tersinkron saat sinyal pulih.
                </p>
              </div>
            </div>
          )}

          {/* Supabase & Backend Connection Indicator Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 flex items-center justify-between shadow-inner">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className={`p-2 rounded-xl shrink-0 ${isOnlineState ? 'bg-emerald-600 text-white' : 'bg-rose-100 text-rose-600'}`}>
                <Server className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">Database: HyperCloud</span>
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                      isOnlineState
                        ? 'bg-emerald-600 text-white border border-emerald-600'
                        : 'bg-rose-100 text-rose-600 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOnlineState
                          ? 'bg-white animate-pulse'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span>{isOnlineState ? 'TERHUBUNG (APHRO-DB)' : 'OFFLINE'}</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                  Autentikasi Aman via PostgreSQL HyperCloud API
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center space-x-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-black" />
                  <span>USERNAME <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[9px] text-black font-bold bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded">Kolom: Username / UserID</span>
              </div>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-teal-50 text-black group-focus-within:text-black transition-colors">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan Username Anda..."
                  required
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border border-teal-100 text-black text-sm focus:outline-none focus:border-[#00A2B9] focus:ring-1 focus:ring-[#00A2B9]/30 transition-all placeholder:text-black/30 shadow-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>PASSWORD <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[9px] text-rose-600 font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">Kolom: Password</span>
              </div>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-teal-50 text-black group-focus-within:text-black transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password akun Anda..."
                  required
                  className="w-full pl-12 pr-12 py-3 rounded-2xl bg-white border border-teal-100 text-black text-sm focus:outline-none focus:border-[#00A2B9] focus:ring-1 focus:ring-[#00A2B9]/30 transition-all placeholder:text-black/30 shadow-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-full text-base font-black text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-[#00A2B9] hover:brightness-110 shadow-xl shadow-teal-900/20 flex items-center justify-center space-x-4 transition-all active:scale-[0.98] group mt-6 disabled:opacity-50 cursor-pointer border-b-2 border-black/20"
            >
              <LogIn className="w-6 h-6" />
              <span className="uppercase tracking-[0.2em]">{isSubmitting ? 'MEMPROSES...' : 'MASUK KE APLIKASI'}</span>
            </button>
          </form>
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-black font-black uppercase tracking-widest opacity-60">
            © 13307BKT- 2026 PLN ES UP4 Sumatera Barat. All rights reserved.
          </p>
          <div className="flex items-center justify-center space-x-3 text-[9px] text-black/40 font-black uppercase tracking-widest">
            <span>VER {settings.versiAplikasi}</span>
            <span className="w-1 h-1 rounded-full bg-teal-200" />
            <span className="flex items-center space-x-1">
               <ShieldCheck className="w-3 h-3 text-[#00A2B9]" />
               <span>Secured Access</span>
            </span>
          </div>
        </div>
      </div>

      {/* Quick GAS Web App URL Config Modal */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-[#00A2B9]/10 text-[#00A2B9] border border-[#00A2B9]/20">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Konfigurasi Google Apps Script URL</h3>
                  <p className="text-[11px] text-slate-400">Hubungkan aplikasi APHRO ke Google Spreadsheet Backend</p>
                </div>
              </div>
              <button
                onClick={() => setShowGasModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGasUrl} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  Web App Exec Deployment URL (Google Apps Script):
                </label>
                <input
                  type="url"
                  value={tempGasUrl}
                  onChange={(e) => setTempGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-teal-300 font-mono text-xs focus:outline-none focus:border-[#00A2B9] focus:ring-1 focus:ring-[#00A2B9]"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 text-slate-400">
                <div className="flex items-center space-x-2 text-[#00A2B9] font-bold">
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>Status Koneksi Saat Ini:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isGasConnected ? 'bg-[#00A2B9]/20 text-teal-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {isGasConnected ? 'TERHUBUNG' : 'STANDBY'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pastikan Web App di Google Apps Script telah diset ke <strong>"Execute as: Me"</strong> dan <strong>"Who has access: Anyone"</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGasModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#00A2B9] hover:bg-[#008396] transition-colors shadow-lg shadow-teal-900/30 flex items-center space-x-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan & Hubungkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
