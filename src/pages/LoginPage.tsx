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
  Radio
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { users } = useMasterData();
  const { setActiveTab } = useUI();
  const { isGasConnected, isSyncing, syncWithGAS } = useGASSync();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick GAS URL Config Modal state on Login Page
  const [showGasModal, setShowGasModal] = useState(false);
  const [tempGasUrl, setTempGasUrl] = useState('');

  const hasSyncedLoginRef = React.useRef(false);

  // Auto-fetch/sync Users from Spreadsheet when Login page loads
  useEffect(() => {
    if (!hasSyncedLoginRef.current) {
      hasSyncedLoginRef.current = true;
      syncWithGAS().catch((err) => {
        console.warn('Login auto sync error:', err);
      });
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
          const isAdmbkt = (authenticatedUser.userName || authenticatedUser.nip || authenticatedUser.id || '').toLowerCase() === 'admbkt';
          if (isAdmbkt) {
            setActiveTab('cetak_laporan');
          } else if ((authenticatedUser.role || '').toUpperCase() === 'USER') {
            setActiveTab('input_realisasi');
          } else {
            setActiveTab('dashboard');
          }
          showToast(`Selamat datang, ${authenticatedUser.name}! (Terotentikasi via Sheet USERS)`, 'success');
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
      } catch (err) {
        console.warn('Direct GAS login call error, falling back to synced local users:', err);
      }
    }

    // 2. Fallback / Offline search in Master Data (synced from Sheet USERS)
    let foundUser = users.find(u => 
      (u.nip || '').toLowerCase() === safeUsername || 
      (u.id || '').toLowerCase() === safeUsername ||
      (u.userName || '').toLowerCase() === safeUsername ||
      (u.name || '').toLowerCase() === safeUsername ||
      (u.email || '').toLowerCase() === safeUsername
    );

    // If not found locally and GAS Web App URL is configured, try syncing live from Spreadsheet once
    if (!foundUser && settings.gasWebAppUrl && navigator.onLine) {
      try {
        await syncWithGAS();
        foundUser = users.find(u => 
          (u.nip || '').toLowerCase() === safeUsername || 
          (u.id || '').toLowerCase() === safeUsername ||
          (u.userName || '').toLowerCase() === safeUsername ||
          (u.name || '').toLowerCase() === safeUsername ||
          (u.email || '').toLowerCase() === safeUsername
        );
      } catch (err) {
        console.warn('Live sync during login failed:', err);
      }
    }

    if (foundUser) {
      // Validate password if user has a password configured in sheet USERS
      if (foundUser.password) {
        if (!password || password.trim() !== foundUser.password.trim()) {
          showToast('Kata sandi tidak sesuai! Harap periksa kembali.', 'error');
          setIsSubmitting(false);
          return;
        }
      }

      login(foundUser);
      const isAdmbkt = (foundUser.userName || foundUser.nip || foundUser.id || '').toLowerCase() === 'admbkt';
      if (isAdmbkt) {
        setActiveTab('cetak_laporan');
      } else if ((foundUser.role || '').toUpperCase() === 'USER') {
        setActiveTab('input_realisasi');
      } else {
        setActiveTab('dashboard');
      }
      showToast(`Selamat datang, ${foundUser.name}!`, 'success');
    } else {
      // Fallback for superadmin / admin if not present in users list
      if (safeUsername === 'superadmin' || safeUsername === 'admin') {
        const expectedRole = safeUsername === 'superadmin' ? 'SuperAdmin' : 'Admin';
        if (password && password.trim() === 'admin123') {
          login({
            id: `hardcoded-${safeUsername}`,
            nip: username.toUpperCase(),
            userName: safeUsername,
            name: safeUsername === 'superadmin' ? 'SuperAdmin Utama' : 'System Admin',
            role: expectedRole as any,
            email: `${safeUsername}@pln.co.id`
          });
          setActiveTab('dashboard');
          showToast(`Selamat datang, ${expectedRole}!`, 'success');
        } else {
          showToast('Kata sandi salah! Gunakan "admin123" atau daftarkan akun di Sheet USERS Master Data.', 'error');
        }
      } else {
        showToast(`USERID "${username}" tidak ditemukan di sheet USERS Spreadsheet. Silakan hubungi Admin atau tekan Refresh USERS.`, 'error');
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
    saveAndEmbedGasConfig(cleanUrl);
    updateSettings({ gasWebAppUrl: cleanUrl });

    showToast('Menghubungkan ke Spreadsheet...', 'info');
    setShowGasModal(false);
    
    setTimeout(() => {
      syncWithGAS(showToast);
    }, 300);
  };

  const handleSelectUser = (u: any) => {
    const userid = u.nip || u.userName || u.id || u.name;
    setUsername(userid);
    setPassword(''); // Password harus dimasukkan secara manual demi keamanan
    showToast(`User dipilih: ${u.name || userid}. Silakan masukkan kata sandi Anda.`, 'info');
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-900 overflow-hidden font-sans">
      {/* Background Image with Dark Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 scale-105 filter blur-xs transition-all duration-700"
        style={{
          backgroundImage: `url(${
            settings.loginBgUrl ||
            'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1600&q=80'
          })`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/95 to-slate-900/80" />

      {/* Decorative Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg space-y-4 my-6">
        {/* Branding Title / Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mx-auto mb-2">
            <img
              src={APP_LOGO_URL}
              alt="Logo"
              className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.failed) {
                  target.dataset.failed = 'true';
                  target.src = 'https://drive.google.com/uc?export=view&id=1V2zz3q_3umHCaTqeJN6u7kbhGdLrK4NE';
                }
              }}
            />
          </div>
          <div className="flex flex-col items-center justify-center space-y-1">
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">APHRO</h1>
            <p className="text-[10px] text-sky-400 font-bold tracking-[0.2em] uppercase">
              Asset Protection & Hazard Response Operations
            </p>
            <span className="mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-sky-950/80 text-sky-300 border border-sky-800 shadow-lg">
              {settings.namaUnitLayanan}
            </span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/90 backdrop-blur-2xl border border-slate-700/80 rounded-[2rem] p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Spreadsheet Connection Indicator Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-700/60 flex items-center justify-between shadow-inner">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className={`p-2 rounded-xl shrink-0 ${isSyncing ? 'bg-sky-950/60 text-sky-400' : isGasConnected ? 'bg-emerald-950/60 text-emerald-400' : 'bg-amber-950/60 text-amber-400'}`}>
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[11px] font-black text-slate-200 uppercase tracking-tighter">Spreadsheet Data</span>
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                      isSyncing
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : isGasConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSyncing
                          ? 'bg-sky-400 animate-ping'
                          : isGasConnected
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span>{isSyncing ? 'SINKRONISASI...' : isGasConnected ? 'TERHUBUNG' : 'STANDBY'}</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {isSyncing
                    ? 'Proses menghubungkan & mengambil data USERS...'
                    : isGasConnected
                    ? 'Terhubung ke Google Spreadsheet (Sheet USERS & Work Order)'
                    : 'Belum terhubung. Klik tombol refresh untuk menyambungkan.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSyncGAS}
                disabled={isSyncing}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Refresh Connection & Sync Users"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempGasUrl(settings.gasWebAppUrl || '');
                  setShowGasModal(true);
                }}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all border border-slate-700 shadow-xs cursor-pointer"
                title="Atur URL Google Apps Script"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                USERID / USERNAME
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-slate-800 text-slate-400 group-focus-within:text-sky-400 transition-colors">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan NIP atau UserID..."
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                KATA SANDI
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-slate-800 text-slate-400 group-focus-within:text-sky-400 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ketik kata sandi Anda..."
                  required
                  className="w-full pl-12 pr-12 py-3 rounded-2xl bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 shadow-xl shadow-sky-600/20 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] group mt-6 disabled:opacity-50"
            >
              <span className="uppercase tracking-widest">{isSubmitting ? 'Authentikasi...' : 'Masuk Aplikasi'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Synced Users Quick Select List */}
          {(() => {
            const selectableUsers = users.filter(u => {
              const role = (u.role || '').toLowerCase();
              const uname = (u.userName || u.nip || u.id || u.name || '').toLowerCase();
              return role !== 'superadmin' && uname !== 'superadmin';
            });

            return (
              <div className="pt-4 border-t border-slate-700/50 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Pilih User Spreadsheet ({selectableUsers.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncGAS}
                    disabled={isSyncing}
                    className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    title="Refresh Sheet USERS dari Spreadsheet"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{isSyncing ? 'Memuat...' : 'Refresh USERS'}</span>
                  </button>
                </div>

                {selectableUsers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                    {selectableUsers.map((u, i) => {
                      const targetUser = (username || '').trim().toLowerCase();
                      const isSelected = targetUser && (
                        targetUser === (u.nip || '').trim().toLowerCase() || 
                        targetUser === (u.id || '').trim().toLowerCase() ||
                        targetUser === (u.userName || '').trim().toLowerCase() ||
                        targetUser === (u.name || '').trim().toLowerCase()
                      );

                      return (
                        <button
                          key={`${u.id || 'user'}-${i}`}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className={`p-3 rounded-2xl text-left border transition-all flex items-center justify-between group ${
                            isSelected
                              ? 'bg-sky-500/15 border-sky-500 text-white shadow-lg shadow-sky-500/10'
                              : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-700/50 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className={`text-xs font-bold truncate ${
                              isSelected ? 'text-sky-400' : 'text-slate-200 group-hover:text-white'
                            }`}>
                              {u.name || u.userName || u.nip || 'Unnamed User'}
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate uppercase flex items-center space-x-1">
                              <span>ID:</span>
                              <span className="text-cyan-400 font-bold">{u.nip || u.userName || u.id || '-'}</span>
                            </p>
                            {(u.ulpName || u.reguName) && (
                              <p className="text-[8px] text-slate-400 truncate mt-0.5 font-medium">
                                {u.ulpName} {u.reguName ? `• ${u.reguName}` : ''}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-black shrink-0 border uppercase tracking-tighter ${
                              u.role === 'Admin'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {u.role || 'USER'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl bg-slate-900/40 border border-slate-700/50 border-dashed space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Belum ada data user dari Sheet USERS</p>
                    <button
                      type="button"
                      onClick={handleSyncGAS}
                      disabled={isSyncing}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 text-xs font-bold transition-all inline-flex items-center space-x-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Sedang Memuat Data...' : 'Ambil User Dari Spreadsheet'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Config link */}
          <div className="flex items-center justify-end pt-1 text-[9px] text-slate-500">
             <button
               type="button"
               onClick={() => {
                 setTempGasUrl(settings.gasWebAppUrl || '');
                 setShowGasModal(true);
               }}
               className="font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest cursor-pointer flex items-center space-x-1"
             >
               <span>Gas Web App URL</span>
               <ExternalLink className="w-2.5 h-2.5" />
             </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center space-y-1">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {settings.footerText}
          </p>
          <div className="flex items-center justify-center space-x-3 text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            <span>VER {settings.versiAplikasi}</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="flex items-center space-x-1">
               <ShieldCheck className="w-3 h-3 text-emerald-600" />
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
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
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
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sky-300 font-mono text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 text-slate-400">
                <div className="flex items-center space-x-2 text-sky-400 font-bold">
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>Status Koneksi Saat Ini:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isGasConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
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
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition-colors shadow-lg shadow-sky-900/30 flex items-center space-x-2 cursor-pointer"
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
