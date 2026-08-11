import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';
import { useNotifications } from '../../context/NotificationContext';
import { useGASSync } from '../../hooks/useGASSync';
import { useToast } from '../../hooks/useToast';
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  Shield,
  UserCheck,
  Zap,
  Menu,
  ChevronDown,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { UserRole } from '../../types';
import { APP_LOGO_URL } from '../../data/initialData';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user: currentUser, logout, loginAsRole } = useAuth();
  const { settings } = useSettings();
  const { isDarkMode, toggleDarkMode } = useUI();
  const { notifications, markNotificationAsRead } = useNotifications();
  const { isGasConnected, isOnline, pendingCount, syncWithGAS, processPendingQueue } = useGASSync();
  const { showToast } = useToast();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showGasPopover, setShowGasPopover] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      if (pendingCount > 0) {
        await processPendingQueue(showToast);
      }
      await syncWithGAS(showToast);
    } catch {
      showToast('Gagal sinkronisasi dengan Google Spreadsheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200">
      <div className="flex items-center justify-between px-2.5 sm:px-6 py-2 sm:py-3">
        {/* Left Section: Mobile Menu + Branding */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden shrink-0"
            title="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo & Dynamic Unit Name */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
            <div className="flex items-center shrink-0">
              <img
                src={APP_LOGO_URL}
                alt="Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.failed) {
                    target.dataset.failed = 'true';
                    target.src = 'https://drive.google.com/uc?export=view&id=1V2zz3q_3umHCaTqeJN6u7kbhGdLrK4NE';
                  }
                }}
              />
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            {/* Dynamic Unit Name Header Tag */}
            <div className="flex items-center space-x-1.5 px-2 sm:px-3 py-1 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-full min-w-0">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold text-sky-900 dark:text-sky-300 truncate max-w-[100px] xs:max-w-[140px] sm:max-w-xs">
                {settings.namaUnitLayanan}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Spreadsheet Connection Badge, Dark Mode, Notifications, User */}
        <div className="flex items-center space-x-1 sm:space-x-2.5 shrink-0">
          {/* SPREADSHEET DATABASE CONNECTION & OFFLINE SYNC BADGE */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGasPopover(!showGasPopover)}
              className={`inline-flex items-center space-x-1 sm:space-x-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all border shadow-2xs ${
                !isOnline
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 hover:bg-rose-100'
                  : pendingCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
                  : isGasConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title="Status Koneksi & Offline Sync"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    !isOnline
                      ? 'bg-rose-400'
                      : pendingCount > 0
                      ? 'bg-amber-400'
                      : isGasConnected
                      ? 'bg-emerald-400'
                      : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    !isOnline
                      ? 'bg-rose-500'
                      : pendingCount > 0
                      ? 'bg-amber-500'
                      : isGasConnected
                      ? 'bg-emerald-500'
                      : 'bg-slate-500'
                  }`}
                />
              </span>
              <span className="hidden md:inline font-display">
                {!isOnline
                  ? `Offline (${pendingCount} Antrean)`
                  : pendingCount > 0
                  ? `Sync ${pendingCount} Data`
                  : isGasConnected
                  ? 'Spreadsheet: Terhubung'
                  : 'Spreadsheet: Standby'}
              </span>
              <span className="md:hidden font-display text-[10px]">
                {!isOnline ? `Offline` : pendingCount > 0 ? `Sync(${pendingCount})` : isGasConnected ? 'Online' : 'Standby'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 hidden sm:block" />
            </button>

            {/* Connection Status Popover Dropdown */}
            {showGasPopover && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-display">
                      Status Koneksi & Database
                    </h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      !isOnline
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : pendingCount > 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : isGasConnected
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {!isOnline ? 'MODE OFFLINE' : pendingCount > 0 ? `${pendingCount} DATA PENDING` : isGasConnected ? 'ONLINE & SYNCED' : 'STANDBY'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 space-y-1">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>Koneksi Internet:</span>
                      <span className={`font-bold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isOnline ? 'Aktif / Terhubung' : 'Terputus (Offline)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>Antrean Sync Offline:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {pendingCount} item belum disinkron
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>Driver Backend:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        Google Apps Script
                      </span>
                    </div>
                  </div>

                  {!isOnline ? (
                    <div className="flex items-start space-x-2 text-rose-700 dark:text-rose-300 text-[11px] bg-rose-50/80 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>
                        Aplikasi dalam mode <strong>Offline</strong>. Semua data input tetap tersimpan aman di perangkat dan akan disinkronkan otomatis saat internet aktif kembali.
                      </span>
                    </div>
                  ) : pendingCount > 0 ? (
                    <div className="flex items-start space-x-2 text-amber-700 dark:text-amber-300 text-[11px] bg-amber-50/80 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                      <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        Terdapat {pendingCount} data offline yang siap disinkronkan ke Google Spreadsheet. Klik tombol Sync di bawah.
                      </span>
                    </div>
                  ) : isGasConnected ? (
                    <div className="flex items-start space-x-2 text-emerald-700 dark:text-emerald-300 text-[11px] bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                      <span>
                        Aplikasi terhubung ke Google Spreadsheet. Data Work Order, Absensi, & Realisasi telah tersinkronisasi.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start space-x-2 text-amber-700 dark:text-amber-300 text-[11px] bg-amber-50/80 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        Sistem menggunakan konfigurasi bawaan. Klik tombol di bawah untuk menyegarkan koneksi.
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : pendingCount > 0 ? `Sync ${pendingCount} Data Offline` : 'Sync / Refresh Data'}</span>
                  </button>
                  <a
                    href="https://drive.google.com/drive/folders/1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
                    title="Buka Folder Drive Database"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            )}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Notifikasi"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in duration-150">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Notifikasi Operations
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                    {unreadCount} Baru
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                  {notifications.map((n, idx) => (
                    <div
                      key={`${n.id}-${idx}`}
                      onClick={() => markNotificationAsRead(n.id)}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                        !n.read ? 'bg-sky-50/40 dark:bg-sky-950/20 font-medium' : 'opacity-75'
                      }`}
                    >
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {n.title}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {n.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
              alt={currentUser?.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-sky-500/30"
            />
            <div className="hidden xl:block text-left">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {currentUser?.name}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {currentUser?.role === 'User' ? 'Petugas ROW' : currentUser?.role}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ml-1"
              title="Keluar / Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
