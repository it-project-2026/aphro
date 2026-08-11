import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useNotifications } from '../context/NotificationContext';
import { useGASSync } from '../hooks/useGASSync';
import { useToast } from '../hooks/useToast';
import { useMasterData } from '../context/MasterDataContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useAbsensi } from '../context/AbsensiContext';
import { useAuth } from '../context/AuthContext';
import { GAS_BACKEND_CODE } from '../utils/gasBackendCode';
import { GASApiService } from '../services/gasApiService';
import { AutoSpreadsheetWizardModal } from '../components/common/AutoSpreadsheetWizardModal';
import { saveAndEmbedGasConfig } from '../config/gasConfig';
import {
  Settings,
  Save,
  Building,
  Image as ImageIcon,
  Phone,
  History,
  Database,
  Link,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Folder,
  FileSpreadsheet,
  RefreshCw,
  Code2,
  Sparkles,
} from 'lucide-react';

export const SettingAplikasiPage: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { auditLogs, notifications } = useNotifications();
  const { isGasConnected, syncWithGAS } = useGASSync();
  const { showToast } = useToast();
  const { users, ulpList, penyulangList, reguList, petugasList } = useMasterData();
  const { workOrders } = useWorkOrders();
  const { realisasiList } = useRealisasi();
  const { absensiList } = useAbsensi();

  const [namaUnitLayanan, setNamaUnitLayanan] = useState(settings.namaUnitLayanan);
  const [logoAplikasiUrl, setLogoAplikasiUrl] = useState(settings.logoAplikasiUrl);
  const [logoInstansiUrl, setLogoInstansiUrl] = useState(settings.logoInstansiUrl);
  const [loginBgUrl, setLoginBgUrl] = useState(settings.loginBgUrl);
  const [themeColor, setThemeColor] = useState(settings.themeColor);
  const [footerText, setFooterText] = useState(settings.footerText);
  const [versiAplikasi, setVersiAplikasi] = useState(settings.versiAplikasi);
  const [gasWebAppUrl, setGasWebAppUrl] = useState(settings.gasWebAppUrl || '');

  const [whatsapp, setWhatsapp] = useState(settings.kontakAdmin.whatsapp);
  const [email, setEmail] = useState(settings.kontakAdmin.email);
  const [alamat, setAlamat] = useState(settings.kontakAdmin.alamat);

  const [isTestingGas, setIsTestingGas] = useState(false);
  const [isCopiedGasCode, setIsCopiedGasCode] = useState(false);
  const [showGasScriptModal, setShowGasScriptModal] = useState(false);
  const [showAutoWizard, setShowAutoWizard] = useState(false);

  const handleTestGas = async () => {
    if (!gasWebAppUrl) {
      showToast('Masukkan URL Web App Google Apps Script terlebih dahulu!', 'warning');
      return;
    }
    setIsTestingGas(true);
    showToast('Menghubungi server Google Apps Script...', 'info');

    try {
      const isOk = await GASApiService.testConnection(gasWebAppUrl);
      if (isOk) {
        showToast('Koneksi ke Google Apps Script REST API Berhasil!', 'success');
        syncWithGAS();
      } else {
        showToast('Gagal terhubung ke Google Apps Script URL. Pastikan akses diset ke "Anyone" (Siapa Saja).', 'error');
      }
    } catch (err: any) {
      showToast(`Error koneksi GAS: ${err.message}`, 'error');
    } finally {
      setIsTestingGas(false);
    }
  };

  const handleInitDatabaseGAS = async () => {
    if (!gasWebAppUrl) {
      showToast('Masukkan URL Web App GAS terlebih dahulu', 'warning');
      return;
    }
    setIsTestingGas(true);
    showToast('Menginisialisasi Spreadsheet APHRO & 11 Sheet Otomatis...', 'info');

    try {
      const res = await GASApiService.initDatabase(gasWebAppUrl);
      if (res.status === 'success') {
        showToast(`Spreadsheet Database Berhasil Dibuat! ID: ${res.spreadsheetId}`, 'success');
        syncWithGAS();
      } else {
        showToast(`Gagal inisialisasi: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsTestingGas(false);
    }
  };

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_CODE);
    setIsCopiedGasCode(true);
    showToast('Script Code.gs berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setIsCopiedGasCode(false), 3000);
  };

  const handleEmbedGasConfig = () => {
    const cleanGasUrl = (gasWebAppUrl || '').trim();
    if (!cleanGasUrl || !cleanGasUrl.startsWith('http')) {
      showToast('Masukkan Web App URL yang valid terlebih dahulu!', 'warning');
      return;
    }
    saveAndEmbedGasConfig(cleanGasUrl);
    updateSettings({ gasWebAppUrl: cleanGasUrl });
    showToast('BERHASIL! Konfigurasi GAS Web App telah tertanam permanen di Aplikasi!', 'success');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanGasUrl = (gasWebAppUrl || '').trim();
    if (cleanGasUrl) {
      saveAndEmbedGasConfig(cleanGasUrl);
    }

    updateSettings({
      namaUnitLayanan,
      logoAplikasiUrl,
      logoInstansiUrl,
      loginBgUrl,
      themeColor,
      footerText,
      versiAplikasi,
      gasWebAppUrl: cleanGasUrl,
      kontakAdmin: {
        whatsapp,
        email,
        alamat,
      },
    });
    showToast('Pengaturan aplikasi & URL Spreadsheet GAS berhasil ditanamkan!', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
        <div className="flex items-center space-x-3 text-sky-600 dark:text-sky-400">
          <Settings className="w-6 h-6" />
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
            Setting & Konfigurasi Aplikasi (SuperAdmin)
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Atur koneksi Google Spreadsheet & Google Drive, Nama Unit Layanan (UL), logo, background login, warna tema, dan kontak admin.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* GAS Backend Integration Section */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-sky-200 dark:border-sky-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center space-x-2 text-sky-600 font-bold">
              <Database className="w-5 h-5 text-sky-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                1. Database Google Spreadsheet & Storage Google Drive (GAS REST API)
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              {isGasConnected ? (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>GAS Connected</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Offline / Standalone</span>
                </span>
              )}
            </div>
          </div>

          {/* Featured Auto Spreadsheet Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h4 className="font-extrabold text-sm font-display">
                  Buat Otomatis Spreadsheet 'APHRO_DATABASE_ENTERPRISE'
                </h4>
              </div>
              <p className="text-xs text-sky-100">
                Otomatis membuat Spreadsheet baru + 11 Sheet (USERS, WORK_ORDER, REALISASI, dll) lengkap dengan format header & default user.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAutoWizard(true)}
              className="px-5 py-2.5 bg-white text-sky-700 hover:bg-sky-50 font-extrabold text-xs rounded-xl shadow-sm transition-all shrink-0 flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Buka Wizard Otomatis</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Database Folder Info */}
            <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 space-y-2">
              <div className="flex items-center justify-between text-sky-900 dark:text-sky-200 font-bold">
                <span className="flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                  <span>Folder Database Spreadsheet</span>
                </span>
                <a
                  href="https://drive.google.com/drive/folders/1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv?usp=drive_link"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-sky-600 hover:underline font-semibold"
                >
                  <span>Buka Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lokasi tempat menyimpan file Spreadsheet <code className="font-mono text-sky-700 dark:text-sky-300 font-bold">APHRO_DATABASE_ENTERPRISE</code> berisi 11 Sheet (USERS, WORK_ORDER, REALISASI, ULP, dll).
              </p>
            </div>

            {/* Photo Storage Folder Info */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-200 font-bold">
                <span className="flex items-center space-x-1.5">
                  <Folder className="w-4 h-4 text-emerald-600" />
                  <span>Folder Media Foto Google Drive</span>
                </span>
                <a
                  href="https://drive.google.com/drive/folders/1idu8U3COKEqdcCewdWntu9X06ZMnzskr?usp=drive_link"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-emerald-600 hover:underline font-semibold"
                >
                  <span>Buka Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Struktur hirarki otomatis: <code className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">FOTO/Tahun/Bulan/WO_ID/</code> dengan format penamaan <code className="font-mono font-bold">WOID_JenisFoto_Timestamp.jpg</code>.
              </p>
            </div>

            {/* FOTO_ABSENSI Folder Info */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2 md:col-span-2">
              <div className="flex items-center justify-between text-indigo-900 dark:text-indigo-200 font-bold">
                <span className="flex items-center space-x-1.5">
                  <Folder className="w-4 h-4 text-indigo-600" />
                  <span>Folder FOTO_ABSENSI Google Drive</span>
                </span>
                <a
                  href="https://drive.google.com/drive/folders/1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5?usp=sharing"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-indigo-600 hover:underline font-semibold"
                >
                  <span>Buka Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lokasi penyimpanan untuk Foto Masuk & Foto Keluar. File terpusat pada satu folder.
              </p>
            </div>
          </div>

          {/* GAS Web App URL Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              URL Web App Google Apps Script (GAS REST API Endpoint)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  value={gasWebAppUrl}
                  onChange={(e) => setGasWebAppUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleTestGas}
                  disabled={isTestingGas}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-2xs whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingGas ? 'animate-spin' : ''}`} />
                  <span>Tes Koneksi</span>
                </button>

                <button
                  type="button"
                  onClick={handleInitDatabaseGAS}
                  disabled={isTestingGas}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/60 dark:hover:bg-sky-800 rounded-xl transition-colors whitespace-nowrap"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Inisialisasi 11 Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleEmbedGasConfig}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-2xs whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Tanamkan URL di Aplikasi</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              URL ini dihasilkan setelah Anda men-deploy Script Google Apps Script sebagai <span className="font-semibold text-slate-600 dark:text-slate-300">Web App (Execute as: Me, Who has access: Anyone)</span>.
            </p>
          </div>

          {/* 11-Sheet Realtime Sync Monitor */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                <span>Status Sinkronisasi 11 Sheet Google Spreadsheet:</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  showToast('Menyinkronkan semua 11 sheet dari Google Spreadsheet...', 'info');
                  await syncWithGAS();
                  showToast('Sinkronisasi 11 Sheet Berhasil Selesai!', 'success');
                }}
                className="inline-flex items-center space-x-1 px-3 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sinkronkan Semua Sheet</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-6 gap-2 text-xs">
              {[
                { name: 'USERS', label: 'Pengguna', count: users.length },
                { name: 'WORK_ORDER', label: 'Work Order', count: workOrders.length },
                { name: 'REALISASI', label: 'Realisasi', count: realisasiList.length },
                { name: 'ABSENSI', label: 'Absensi', count: absensiList.length },
                { name: 'ULP', label: 'Data ULP', count: ulpList.length },
                { name: 'PENYULANG', label: 'Penyulang', count: penyulangList.length },
                { name: 'REGU_ROW', label: 'Regu ROW', count: reguList.length },
                { name: 'PETUGAS', label: 'Petugas', count: petugasList.length },
                { name: 'SETTING', label: 'Setting App', count: 1 },
                { name: 'LOG_ACTIVITY', label: 'Audit Logs', count: auditLogs.length },
                { name: 'NOTIFICATION', label: 'Notifikasi', count: notifications.length },
              ].map((sheet, idx) => (
                <div key={`${sheet.name}-${idx}`} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-[10px] text-sky-600 dark:text-sky-400">{sheet.name}</span>
                    <span className={`w-2 h-2 rounded-full ${isGasConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">{sheet.label}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5">{sheet.count} data</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Bar for Script Code.gs */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
              <Code2 className="w-4 h-4 text-sky-600" />
              <span className="font-semibold">Script Google Apps Script (Code.gs) Siap Dideploy:</span>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setShowGasScriptModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-sky-500" />
                <span>Lihat Script Code.gs</span>
              </button>

              <button
                type="button"
                onClick={handleCopyGasCode}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-2xs"
              >
                {isCopiedGasCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopiedGasCode ? 'Tersalin!' : 'Salin Script GAS'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Unit Name Section */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-sky-600 font-bold border-b border-slate-100 dark:border-slate-700 pb-3">
            <Building className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              2. Identitas Unit Layanan (UL)
            </h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Unit Layanan (Muncul di Header, Footer, PDF Report, Watermark)
            </label>
            <input
              type="text"
              required
              value={namaUnitLayanan}
              onChange={(e) => setNamaUnitLayanan(e.target.value)}
              className="w-full px-4 py-3 text-sm font-extrabold rounded-2xl border border-sky-300 dark:border-sky-700 bg-sky-50/50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200 focus:outline-none focus:border-sky-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Contoh: <span className="font-semibold text-slate-600">PLN UP3 Padang - ULP Kuranji</span>
            </p>
          </div>
        </div>

        {/* Branding & Visual Theme */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-sky-600 font-bold border-b border-slate-100 dark:border-slate-700 pb-3">
            <ImageIcon className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              3. Branding Visual & Background Login
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                URL Logo Aplikasi
              </label>
              <input
                type="text"
                value={logoAplikasiUrl}
                onChange={(e) => setLogoAplikasiUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                URL Logo Instansi (PLN)
              </label>
              <input
                type="text"
                value={logoInstansiUrl}
                onChange={(e) => setLogoInstansiUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                URL Gambar Background Login Page
              </label>
              <input
                type="text"
                value={loginBgUrl}
                onChange={(e) => setLoginBgUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Aksen Warna Tema
              </label>
              <select
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold"
              >
                <option value="PLN Blue">PLN Blue Enterprise (#00529C)</option>
                <option value="Cyan">Cyan Electric (#00A3E0)</option>
                <option value="Emerald">Emerald Field (#10B981)</option>
                <option value="Royal Indigo">Royal Indigo (#6366F1)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Versi Aplikasi
              </label>
              <input
                type="text"
                value={versiAplikasi}
                onChange={(e) => setVersiAplikasi(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Admin Contact Details */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-sky-600 font-bold border-b border-slate-100 dark:border-slate-700 pb-3">
            <Phone className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              4. Kontak Admin & Helpdesk Operations
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nomor WhatsApp Hotline
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="6281234567890"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Customer Support
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Kantor Utama
              </label>
              <input
                type="text"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Teks Footer Copyright
              </label>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center space-x-2 px-8 py-3 text-sm font-extrabold text-white bg-sky-600 hover:bg-sky-700 rounded-2xl shadow-lg shadow-sky-600/30 transition-all"
          >
            <Save className="w-5 h-5" />
            <span>Simpan Seluruh Pengaturan</span>
          </button>
        </div>
      </form>

      {/* Audit Log Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center space-x-2 text-sky-600 font-bold">
            <History className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              System Audit Log & Riwayat Aktivitas
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            {auditLogs.length} Aktivitas
          </span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
          {auditLogs.map((log, idx) => (
            <div key={`${log.id}-${idx}`} className="pt-2 text-xs flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  [{log.action}] {log.details}
                </p>
                <p className="text-[11px] text-slate-400">
                  Oleh: {log.actorName} ({log.actorRole})
                </p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Wizard Modal */}
      <AutoSpreadsheetWizardModal
        isOpen={showAutoWizard}
        onClose={() => setShowAutoWizard(false)}
      />

      {/* Code Modal */}
      {showGasScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full p-6 border border-slate-700 space-y-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-white">
              <span className="text-sm font-bold flex items-center space-x-2 text-sky-400">
                <Code2 className="w-5 h-5" />
                <span>Script Code.gs - Google Apps Script (GAS) Backend REST API</span>
              </span>
              <button
                onClick={() => setShowGasScriptModal(false)}
                className="px-3 py-1 text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {/* Warning banner regarding export keyword */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-200">
                  PERHATIAN PENTING - MENGHINDARI "SyntaxError: Unexpected token 'export'":
                </p>
                <p className="mt-0.5 text-[11px] text-amber-300/90 leading-normal">
                  Google Apps Script (<strong>Code.gs</strong>) tidak mendukung kata <code>export</code>.
                  Jangan menempelkan file TypeScript frontend (<code>gasBackendCode.ts</code>). Gunakan tombol <strong>"Salin Semua Kode"</strong> di bawah ini atau unduh file <strong>Code.gs</strong> murni.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] bg-slate-950 p-4 rounded-xl text-slate-300 leading-relaxed border border-slate-800">
              <pre>{GAS_BACKEND_CODE}</pre>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                Langkah: Buka <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-sky-400 underline font-bold">script.google.com</a> &gt; Hapus isi default Code.gs &gt; Paste kode di atas &gt; Deploy as Web App.
              </span>
              <div className="flex items-center space-x-2">
                <a
                  href="/Code.gs"
                  download="Code.gs"
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                  <span>Unduh File Code.gs</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyGasCode}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
                >
                  {isCopiedGasCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopiedGasCode ? 'Tersalin!' : 'Salin Semua Kode'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
