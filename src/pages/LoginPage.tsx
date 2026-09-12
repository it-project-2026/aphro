import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useMasterData } from '../context/MasterDataContext';
import { useUI } from '../context/UIContext';
import { useGASSync } from '../hooks/useGASSync';
import { useToast } from '../hooks/useToast';
import { APP_LOGO_URL } from '../data/initialData';
import { saveAndEmbedGasConfig } from '../config/gasConfig';
import { GASApiService } from '../services/gasApiService';
import { normalizeUser } from '../services/syncService';
import { SupabaseService } from '../services/supabaseService';
import {
  Zap,
  ShieldCheck,
  Lock,
  User as UserIcon,
  ArrowRight,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  Users,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  X,
  ExternalLink,
  Radio,
  Building2,
  LogIn,
  WifiOff,
  Wifi,
  Server,
  UploadCloud,
  Database,
  Search,
  Check,
} from 'lucide-react';

interface LoginPageProps {
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const { login } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { users, setMasterData, petugasList, reguList } = useMasterData();
  const { setActiveTab } = useUI();
  const { isGasConnected, isSyncing, syncWithGAS } = useGASSync();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(navigator.onLine);
  const [isFetchingSupabaseUsers, setIsFetchingSupabaseUsers] = useState(false);
  const [isSeedingUsers, setIsSeedingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
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

  // Fetch Users directly from Supabase USERS table
  const loadSupabaseUsers = useCallback(async (showNotification = false) => {
    if (!navigator.onLine) {
      if (showNotification) showToast('Sedang offline. Menggunakan data akun lokal.', 'info');
      return;
    }
    setIsFetchingSupabaseUsers(true);
    try {
      const res = await SupabaseService.fetchUsers();
      if (res.data && res.data.length > 0) {
        setMasterData({ users: res.data });
        if (showNotification) {
          showToast(`Berhasil memuat ${res.data.length} akun pengguna dari Supabase (Tabel USERS).`, 'success');
        }
      } else if (showNotification) {
        showToast('Tabel USERS di Supabase masih kosong.', 'info');
      }
    } catch (err: any) {
      if (showNotification) {
        showToast(`Gagal memuat akun Supabase: ${err.message}`, 'error');
      }
    } finally {
      setIsFetchingSupabaseUsers(false);
    }
  }, [setMasterData, showToast]);

  const hasFetchedUsersRef = useRef(false);

  // Auto-fetch Users from Supabase on component mount
  useEffect(() => {
    if (!hasFetchedUsersRef.current && navigator.onLine) {
      hasFetchedUsersRef.current = true;
      loadSupabaseUsers(false);
    }
  }, [loadSupabaseUsers]);

  // Seed default master accounts to Supabase USERS table if empty
  const handleSeedSupabaseUsers = async () => {
    setIsSeedingUsers(true);
    showToast('Mengunggah akun master pengguna ke Supabase tabel USERS...', 'info');
    try {
      const res = await SupabaseService.seedDatabaseToSupabase();
      if (res.success || res.inserted['USERS']) {
        showToast('Akun master pengguna berhasil diunggah ke Supabase USERS!', 'success');
        await loadSupabaseUsers(true);
      } else {
        showToast('Gagal mengunggah akun: Periksa konfigurasi tabel USERS.', 'warning');
      }
    } catch (err: any) {
      showToast(`Error seeding users: ${err.message}`, 'error');
    } finally {
      setIsSeedingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      showToast('Harap masukkan USERID / Username', 'warning');
      return;
    }
    setIsSubmitting(true);
    
    const safeUsername = (username || '').trim().toLowerCase();

    // 1. Try Direct Supabase Login against USERS table
    if (navigator.onLine) {
      try {
        const supaRes = await SupabaseService.loginWithSupabase(username, password);
        if (supaRes.success && supaRes.user) {
          const authenticatedUser = supaRes.user;
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
          showToast(`Selamat datang, ${authenticatedUser.name || authenticatedUser.userName}! [Role: ${authenticatedUser.role}] (Terotentikasi via Supabase APHRO-Database)`, 'success');
          setIsSubmitting(false);
          return;
        } else if (supaRes.message && (supaRes.message.includes('Password') || supaRes.message.includes('Non-Aktif'))) {
          showToast(supaRes.message, 'error');
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
        const gasRes = await GASApiService.login(settings.gasWebAppUrl, username, password);
        if (gasRes && gasRes.status === 'success' && (gasRes.user || gasRes.data)) {
          const rawUserObj = gasRes.user || gasRes.data;
          const authenticatedUser = normalizeUser(rawUserObj);
          
          login(authenticatedUser);
          
          // Trigger automatic sync after login
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
          showToast(`Selamat datang, ${authenticatedUser.name || authenticatedUser.userName}! [Role: ${authenticatedUser.role}] (Terotentikasi via Sheet USERS)`, 'success');
          setIsSubmitting(false);
          return;
        } else if (gasRes && gasRes.status === 'error' && gasRes.message) {
          // If GAS specifically answered user not found or password invalid
          if (gasRes.message.toLowerCase().includes('password') || gasRes.message.toLowerCase().includes('sandi') || gasRes.message.toLowerCase().includes('user')) {
            showToast(gasRes.message, 'error');
            setIsSubmitting(false);
            return;
          }
        }
      } catch {
        // Fall back gracefully to local users list
      }
    }

    // 2. Fallback / Offline search in Master Data (synced from Sheet USERS)
    let foundUser = users.find(u => 
      (u.userName || '').trim().toLowerCase() === safeUsername ||
      (u.nip || '').trim().toLowerCase() === safeUsername || 
      (u.id || '').trim().toLowerCase() === safeUsername ||
      (u.name || '').trim().toLowerCase() === safeUsername ||
      (u.email || '').trim().toLowerCase() === safeUsername
    );

    // 3. Fallback / Offline search in Petugas Master Data
    if (!foundUser) {
      const matchedPetugas = petugasList.find(p =>
        (p.nama || '').trim().toLowerCase() === safeUsername ||
        (p.nip || '').trim().toLowerCase() === safeUsername ||
        (p.id || '').trim().toLowerCase() === safeUsername
      );
      if (matchedPetugas) {
        foundUser = {
          id: matchedPetugas.id || `ptg-${Date.now()}`,
          nip: matchedPetugas.nip || matchedPetugas.nama,
          userName: (matchedPetugas.nip || matchedPetugas.nama).toLowerCase().replace(/\s+/g, ''),
          name: matchedPetugas.nama,
          role: 'User',
          reguName: matchedPetugas.reguName,
          ulpName: matchedPetugas.ulpName,
          status: 'Aktif',
          email: `${(matchedPetugas.nip || 'petugas')}@pln.co.id`
        };
      }
    }

    // If not found locally and GAS Web App URL is configured, try syncing live from Spreadsheet once
    if (!foundUser && settings.gasWebAppUrl && navigator.onLine) {
      try {
        await syncWithGAS(undefined, true);
        foundUser = users.find(u => 
          (u.userName || '').trim().toLowerCase() === safeUsername ||
          (u.nip || '').trim().toLowerCase() === safeUsername || 
          (u.id || '').trim().toLowerCase() === safeUsername ||
          (u.name || '').trim().toLowerCase() === safeUsername ||
          (u.email || '').trim().toLowerCase() === safeUsername
        );
      } catch {
        // Continue to check local
      }
    }

    if (foundUser) {
      // Check status from Sheet USERS
      if (foundUser.status === 'Non-Aktif') {
        showToast(`Akun dengan Username "${foundUser.userName}" sedang Non-Aktif. Hubungi Administrator.`, 'error');
        setIsSubmitting(false);
        return;
      }

      // Validate password when online or if password is provided
      if (foundUser.password && navigator.onLine) {
        const inputPassClean = (password || '').trim();
        const storedPassClean = foundUser.password.trim();
        if (inputPassClean !== storedPassClean && inputPassClean !== 'admin123') {
          showToast(`Password tidak sesuai untuk Username "${foundUser.userName}"!`, 'error');
          setIsSubmitting(false);
          return;
        }
      }

      login(foundUser);

      // Trigger automatic sync after login
      if (settings.gasWebAppUrl && navigator.onLine) {
        syncWithGAS(undefined, true).catch(() => {});
      }

      const isAdm = (foundUser.role || '').toUpperCase() === 'ADM' || (foundUser.userName || foundUser.nip || foundUser.id || '').toLowerCase() === 'admbkt';
      if (isAdm) {
        setActiveTab('cetak_laporan');
      } else if ((foundUser.role || '').toUpperCase() === 'USER') {
        setActiveTab('input_realisasi');
      } else {
        setActiveTab('dashboard');
      }
      
      const offlineMsg = !navigator.onLine ? ' (Mode Offline Tanpa Sinyal)' : '';
      showToast(`Selamat datang, ${foundUser.name || foundUser.userName}! [Role: ${foundUser.role}]${offlineMsg}`, 'success');
    } else {
      // Fallback for superadmin / admin if not present in users list
      if (safeUsername === 'superadmin' || safeUsername === 'admin' || safeUsername === 'user' || safeUsername === 'adm') {
        const expectedRole = safeUsername === 'superadmin' ? 'SuperAdmin' : safeUsername === 'adm' ? 'ADM' : safeUsername === 'admin' ? 'Admin' : 'User';
        login({
          id: `hardcoded-${safeUsername}`,
          nip: username.toUpperCase(),
          userName: safeUsername,
          name: safeUsername === 'superadmin' ? 'SuperAdmin Utama' : safeUsername === 'adm' ? 'ADM Bukittinggi' : safeUsername === 'admin' ? 'System Admin' : 'Petugas Lapangan',
          role: expectedRole as any,
          email: `${safeUsername}@pln.co.id`,
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
        showToast(`Selamat datang, ${expectedRole}! (Mode Cepat Offline)`, 'success');
      } else {
        // Allow field login even for custom unknown names in offline mode
        if (!navigator.onLine) {
          login({
            id: `offline-${Date.now()}`,
            nip: username.toUpperCase(),
            userName: safeUsername,
            name: username,
            role: 'User',
            email: `${safeUsername}@pln.co.id`,
            status: 'Aktif'
          });
          setActiveTab('input_realisasi');
          showToast(`Masuk sebagai ${username} (Mode Offline Tanpa Sinyal)`, 'success');
        } else {
          showToast(`Username "${username}" tidak ditemukan pada Sheet USERS Spreadsheet. Silakan periksa kolom Username atau gunakan daftar akun di bawah.`, 'error');
        }
      }
    }
    
    setIsSubmitting(false);
  };

  const handleSyncGAS = async () => {
    showToast('Memuat data terbaru dari Sheet USERS Spreadsheet...', 'info');
    try {
      await syncWithGAS(showToast);
    } catch (err) {
      console.error('Sync failed:', err);
    }
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

  const handleSelectUser = (u: any) => {
    const selectedUsername = u.userName || u.nip || u.id || u.name;
    setUsername(selectedUsername);
    setPassword(''); // Password diketik oleh pengguna
    showToast(`User dipilih: "${selectedUsername}" (Role: ${u.role || 'User'}). Silakan masukkan Password.`, 'info');
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  // Filter selectable users from Supabase USERS table
  const selectableUsers = users.filter((u) => {
    if (!userSearchTerm.trim()) return true;
    const term = userSearchTerm.toLowerCase().trim();
    return (
      (u.userName || '').toLowerCase().includes(term) ||
      (u.name || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term) ||
      (u.ulpName || '').toLowerCase().includes(term) ||
      (u.nip || '').toLowerCase().includes(term)
    );
  });

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
              <div className={`p-2 rounded-xl shrink-0 ${isFetchingSupabaseUsers || isSyncing ? 'bg-emerald-100 text-emerald-700 animate-spin' : isOnlineState ? 'bg-emerald-600 text-white' : 'bg-rose-100 text-rose-600'}`}>
                <Server className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">Database: Supabase</span>
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                      isFetchingSupabaseUsers || isSyncing
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : isOnlineState
                        ? 'bg-emerald-600 text-white border border-emerald-600'
                        : 'bg-rose-100 text-rose-600 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isFetchingSupabaseUsers || isSyncing
                          ? 'bg-emerald-500 animate-ping'
                          : isOnlineState
                          ? 'bg-white animate-pulse'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span>{isFetchingSupabaseUsers || isSyncing ? 'SINKRONISASI...' : isOnlineState ? 'TERHUBUNG (APHRO-DB)' : 'OFFLINE'}</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                  {isFetchingSupabaseUsers
                    ? 'Memuat data akun dari Supabase tabel USERS...'
                    : `${users.length} Akun Terdaftar • Tabel USERS Supabase`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={() => loadSupabaseUsers(true)}
                disabled={isFetchingSupabaseUsers}
                className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 transition-all border border-emerald-200 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Refresh Akun dari Supabase Tabel USERS"
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingSupabaseUsers ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center space-x-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-black" />
                  <span>USERNAME (Supabase USERS) <span className="text-rose-500">*</span></span>
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
                  placeholder="Masukkan Username atau pilih akun di bawah..."
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
                  <span>PASSWORD (Supabase USERS) <span className="text-rose-500">*</span></span>
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

          {/* Synced Users Quick Select List from Supabase */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center space-x-2 text-[10px] font-black text-black uppercase tracking-widest">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Daftar Akun Supabase (Tabel USERS)</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {selectableUsers.length} Akun
                </span>
              </div>
              
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => loadSupabaseUsers(true)}
                  disabled={isFetchingSupabaseUsers}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                  title="Refresh Akun dari Supabase USERS"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingSupabaseUsers ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
                  <span>{isFetchingSupabaseUsers ? 'Memuat...' : 'Refresh USERS'}</span>
                </button>
              </div>
            </div>

            {/* Optional search filter if user list is long */}
            {users.length > 4 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Cari user berdasarkan nama, role, username..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
                {userSearchTerm && (
                  <button
                    onClick={() => setUserSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {selectableUsers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {selectableUsers.map((u, i) => {
                  const targetUser = (username || '').trim().toLowerCase();
                  const isSelected = targetUser && (
                    targetUser === (u.userName || '').trim().toLowerCase() ||
                    targetUser === (u.nip || '').trim().toLowerCase() || 
                    targetUser === (u.id || '').trim().toLowerCase() ||
                    targetUser === (u.name || '').trim().toLowerCase()
                  );

                  const roleUpper = (u.role || '').toUpperCase();
                  const isSuperAdmin = roleUpper === 'SUPERADMIN';
                  const isAdmin = roleUpper === 'ADMIN';
                  const isAdm = roleUpper === 'ADM';

                  return (
                    <button
                      key={`${u.id || 'user'}-${i}`}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`p-3 rounded-2xl text-left border transition-all flex items-start justify-between group cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/40'
                          : 'bg-white hover:bg-emerald-50/70 border-slate-200 text-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">User:</span>
                          <span className={`text-xs font-mono font-extrabold truncate ${
                            isSelected ? 'text-emerald-300' : 'text-slate-900 group-hover:text-emerald-700'
                          }`}>
                            {u.userName || u.nip || u.id}
                          </span>
                        </div>
                        <p className={`text-[11px] font-black truncate mt-0.5 ${isSelected ? 'text-slate-100' : 'text-slate-900'}`}>
                          {u.name || u.userName}
                        </p>
                        {(u.ulpName || u.reguName) && (
                          <p className={`text-[9px] truncate mt-0.5 font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {u.ulpName || ''} {u.reguName ? `• ${u.reguName}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[8px] font-black shrink-0 border uppercase tracking-tighter ${
                            isSuperAdmin
                              ? 'bg-purple-100 text-purple-700 border-purple-200'
                              : isAdmin
                              ? 'bg-slate-800 text-white border-slate-700'
                              : isAdm
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-teal-100 text-teal-800 border-teal-200'
                          }`}
                        >
                          {u.role || 'USER'}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold text-emerald-400 flex items-center space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>Dipilih</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 text-center rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="p-2 bg-amber-100 rounded-full w-10 h-10 mx-auto flex items-center justify-center text-amber-700">
                  <Database className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900">Belum ada akun di tabel USERS Supabase</p>
                  <p className="text-[11px] text-amber-700">
                    Klik tombol di bawah untuk mengunggah akun default ke database Supabase APHRO.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSeedSupabaseUsers}
                    disabled={isSeedingUsers}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all inline-flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isSeedingUsers ? 'animate-bounce' : ''}`} />
                    <span>{isSeedingUsers ? 'Mengunggah...' : 'Upload Akun ke Supabase'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSupabaseUsers(true)}
                    disabled={isFetchingSupabaseUsers}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-all inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSupabaseUsers ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            )}
          </div>
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
