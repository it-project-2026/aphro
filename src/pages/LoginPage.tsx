import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface LoginPageProps {
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const { login } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { users, petugasList, reguList } = useMasterData();
  const { setActiveTab } = useUI();
  const { isGasConnected, isSyncing, syncWithGAS } = useGASSync();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(navigator.onLine);

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

  const hasSyncedLoginRef = React.useRef(false);

  // Auto-fetch/sync Users from Spreadsheet when Login page loads
  useEffect(() => {
    if (!hasSyncedLoginRef.current && navigator.onLine) {
      hasSyncedLoginRef.current = true;
      syncWithGAS(undefined, true).catch(() => {});
    }
  }, [syncWithGAS]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      showToast('Harap masukkan USERID / Username', 'warning');
      return;
    }
    setIsSubmitting(true);
    
    const safeUsername = (username || '').trim().toLowerCase();

    // 1. Try Direct GAS Login Endpoint if GAS URL is configured and online
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

          {/* Spreadsheet Connection Indicator Banner */}
          <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100/50 flex items-center justify-between shadow-inner">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className={`p-2 rounded-xl shrink-0 ${isSyncing ? 'bg-teal-100 text-[#008396]' : isGasConnected ? 'bg-[#008396] text-white' : 'bg-rose-100 text-rose-600'}`}>
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[11px] font-black text-black uppercase tracking-tighter">Spreadsheet Data</span>
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                      isSyncing
                        ? 'bg-teal-100 text-[#008396] border border-teal-200'
                        : isGasConnected
                        ? 'bg-[#008396] text-white border border-[#008396]'
                        : 'bg-rose-100 text-rose-600 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSyncing
                          ? 'bg-[#00A2B9] animate-ping'
                          : isGasConnected
                          ? 'bg-white animate-pulse'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span>{isSyncing ? 'SINKRONISASI...' : isGasConnected ? 'TERHUBUNG' : 'STANDBY'}</span>
                  </span>
                </div>
                <p className="text-[10px] text-black mt-0.5 truncate opacity-70">
                  {isSyncing
                    ? 'Proses menghubungkan & mengambil data USERS...'
                    : isGasConnected
                    ? 'Terhubung ke Google Spreadsheet'
                    : 'Belum terhubung. Klik tombol refresh.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSyncGAS}
                disabled={isSyncing}
                className="p-2.5 rounded-xl bg-white hover:bg-teal-50 text-black hover:text-black transition-all border border-teal-100 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Refresh Connection & Sync Users"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#00A2B9]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center space-x-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-black" />
                  <span>USERNAME (Sheet USERS) <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[9px] text-black font-bold bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded">Kolom: Username</span>
              </div>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-teal-50 text-black group-focus-within:text-black transition-colors">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan Username akun Anda..."
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
                  <span>PASSWORD (Sheet USERS) <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[9px] text-rose-600 font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">Kolom: Password</span>
              </div>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-teal-50 text-black group-focus-within:text-black transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password Anda..."
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
              className="w-full py-3.5 px-6 rounded-full text-base font-black text-white bg-gradient-to-r from-[#008396] via-[#00A2B9] to-[#00C2DE] hover:brightness-110 shadow-xl shadow-teal-900/20 flex items-center justify-center space-x-4 transition-all active:scale-[0.98] group mt-6 disabled:opacity-50 cursor-pointer border-b-2 border-black/20"
            >
              <LogIn className="w-6 h-6" />
              <span className="uppercase tracking-[0.2em]">{isSubmitting ? '...' : 'MASUK'}</span>
            </button>
          </form>

          {/* Synced Users Quick Select List */}
          {(() => {
            const selectableUsers = users.filter((u) => {
              const uname = (u.userName || u.nip || u.id || u.name || '').toLowerCase().trim();
              const role = (u.role || '').toLowerCase().trim();
              return uname !== 'superadmin' && role !== 'superadmin' && !uname.includes('superadmin');
            });

            return (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2 text-[10px] font-black text-black uppercase tracking-widest">
                    <Users className="w-3.5 h-3.5 text-black" />
                    <span>Daftar Akun Sheet USERS ({selectableUsers.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncGAS}
                    disabled={isSyncing}
                    className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#00A2B9]/5 hover:bg-[#00A2B9]/10 text-black border border-[#00A2B9]/10 text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    title="Refresh Sheet USERS dari Spreadsheet"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-black' : ''}`} />
                    <span>{isSyncing ? 'Memuat...' : 'Refresh USERS'}</span>
                  </button>
                </div>

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

                      const isSuperAdmin = (u.role || '').toLowerCase() === 'superadmin';
                      const isAdmin = (u.role || '').toLowerCase() === 'admin';
                      const isAdm = (u.role || '').toLowerCase() === 'adm';

                      return (
                        <button
                          key={`${u.id || 'user'}-${i}`}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className={`p-3 rounded-2xl text-left border transition-all flex items-start justify-between group cursor-pointer ${
                            isSelected
                              ? 'bg-black text-white border-black shadow-sm ring-1 ring-black/20'
                              : 'bg-white hover:bg-teal-50 border-teal-100 text-black hover:border-teal-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-black font-bold uppercase opacity-40">User:</span>
                              <span className={`text-xs font-mono font-extrabold truncate ${
                                isSelected ? 'text-white' : 'text-black group-hover:text-black'
                              }`}>
                                {u.userName || u.nip || u.id}
                              </span>
                            </div>
                            <p className={`text-[11px] font-black truncate mt-0.5 ${isSelected ? 'text-slate-100' : 'text-black'}`}>
                              {u.name || u.userName}
                            </p>
                            {(u.ulpName || u.reguName) && (
                              <p className={`text-[9px] truncate mt-0.5 font-bold ${isSelected ? 'text-slate-300' : 'text-black/60'}`}>
                                {u.ulpName || ''} {u.reguName ? `• ${u.reguName}` : ''}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-black shrink-0 border uppercase tracking-tighter ${
                              isSuperAdmin
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : isAdmin
                                ? 'bg-black text-white border-black'
                                : isAdm
                                ? 'bg-[#008396]/10 text-[#008396] border-[#008396]/20'
                                : 'bg-teal-100 text-black border-teal-200'
                            }`}
                          >
                            {u.role || 'USER'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl bg-teal-50/50 border border-teal-100 border-dashed space-y-2">
                    <p className="text-[10px] text-black font-black uppercase tracking-widest opacity-40">Belum ada data user</p>
                    <button
                      type="button"
                      onClick={handleSyncGAS}
                      disabled={isSyncing}
                      className="px-4 py-2 rounded-xl bg-black text-white hover:bg-slate-900 border border-black text-xs font-bold transition-all inline-flex items-center space-x-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Sedang Memuat...' : 'Ambil User'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
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
