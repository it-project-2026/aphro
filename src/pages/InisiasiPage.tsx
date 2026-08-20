import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useGASSync } from '../hooks/useGASSync';
import { useToast } from '../hooks/useToast';
import { InisiasiUnit } from '../types';
import {
  InisiasiService,
  DEFAULT_INISIASI_SPREADSHEET_ID,
  DEFAULT_INISIASI_SPREADSHEET_URL,
  DEFAULT_INISIASI_SHEET_NAME,
  DEFAULT_UL_OPTIONS,
} from '../services/inisiasiService';
import { saveAndEmbedGasConfig } from '../config/gasConfig';
import { APP_LOGO_URL } from '../data/initialData';
import {
  Building2,
  RefreshCw,
  ArrowRight,
  Database,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Zap,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  FileSpreadsheet,
  FolderTree,
  Lock,
} from 'lucide-react';

interface InisiasiPageProps {
  isFromMenu?: boolean;
  onInitiationComplete?: () => void;
}

export const InisiasiPage: React.FC<InisiasiPageProps> = ({
  isFromMenu = false,
  onInitiationComplete,
}) => {
  const { settings, updateSettings } = useSettings();
  const { setActiveTab } = useUI();
  const { syncWithGAS } = useGASSync();
  const { showToast } = useToast();

  const [ulOptions, setUlOptions] = useState<InisiasiUnit[]>(DEFAULT_UL_OPTIONS);
  const [selectedULName, setSelectedULName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Load Inisiasi UL Data on Mount
  useEffect(() => {
    loadInisiasiData();
  }, []);

  const loadInisiasiData = async () => {
    setIsLoading(true);
    setStatusMessage('Membaca data Unit Layanan dari Google Spreadsheet Master Inisiasi...');
    try {
      const res = await InisiasiService.fetchInisiasiUnits(
        DEFAULT_INISIASI_SPREADSHEET_ID,
        DEFAULT_INISIASI_SHEET_NAME
      );

      if (res.success && res.data.length > 0) {
        // Filter out any ULP items to be 100% compliant with "tanpa menampilkan ULP"
        const filteredUL = res.data.filter(u => InisiasiService.isValidUL(u.namaUL));
        const finalOptions = filteredUL.length > 0 ? filteredUL : DEFAULT_UL_OPTIONS;

        setUlOptions(finalOptions);
        setStatusMessage(res.message || '');

        // Auto select current setting or default to first configured UL
        const currentNama = settings.namaUnitLayanan || '';
        const match = finalOptions.find(
          u => u.namaUL.toLowerCase() === currentNama.toLowerCase() ||
               currentNama.toLowerCase().includes(u.namaUL.toLowerCase())
        );

        if (match) {
          setSelectedULName(match.namaUL);
        } else {
          // Prefer selecting first configured unit
          const firstConfigured = finalOptions.find(u => InisiasiService.isConfigured(u));
          setSelectedULName(firstConfigured ? firstConfigured.namaUL : finalOptions[0].namaUL);
        }
      } else {
        setUlOptions(DEFAULT_UL_OPTIONS);
        setSelectedULName(DEFAULT_UL_OPTIONS[0].namaUL);
      }
    } catch (err: any) {
      console.warn('Error loading inisiasi UL options:', err);
      setUlOptions(DEFAULT_UL_OPTIONS);
      setSelectedULName(DEFAULT_UL_OPTIONS[0].namaUL);
      setStatusMessage('Menggunakan data Unit Layanan lokal.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedUnit = ulOptions.find(u => u.namaUL === selectedULName) || ulOptions[0] || null;
  const isConfigured = InisiasiService.isConfigured(selectedUnit);
  const missingConfigs = InisiasiService.getMissingConfigs(selectedUnit);

  const handleApplyConnection = async () => {
    if (!selectedUnit) {
      showToast('Harap pilih Unit Layanan (UL) terlebih dahulu!', 'warning');
      return;
    }

    // STRICT VALIDATION: Jika UL belum memiliki konfigurasi url spreadsheet dll, maka system akan MENOLAK
    if (!isConfigured) {
      showToast(
        `AKSES DITOLAK! Unit Layanan "${selectedUnit.namaUL}" belum memiliki konfigurasi ID Spreadsheet & URL GAS di Master Sheet Inisiasi.`,
        'error'
      );
      return;
    }

    setIsApplying(true);
    showToast(`Menyambungkan konfigurasi ${selectedUnit.namaUL}...`, 'info');

    try {
      // 1. Simpan konfigurasi GAS
      if (selectedUnit.urlGas) {
        saveAndEmbedGasConfig(selectedUnit.urlGas);
      }

      // 2. Tandai inisiasi selesai & simpan unit terpilih
      InisiasiService.saveSelectedUnit(selectedUnit);
      localStorage.setItem('aphro_has_initiated', 'true');

      // 3. Update settings state secara menyeluruh
      updateSettings({
        namaUnitLayanan: selectedUnit.namaUL,
        spreadsheetId: selectedUnit.idSpreadsheet || settings.spreadsheetId,
        gasWebAppUrl: selectedUnit.urlGas || settings.gasWebAppUrl,
        driveFolderId: selectedUnit.folderIdSpreadsheet || settings.driveFolderId,
        photoFolderId: selectedUnit.folderIdFoto || settings.photoFolderId,
        absensiFolderId: selectedUnit.folderIdAbsensi || settings.absensiFolderId,
      });

      // 4. Background live sync
      if (selectedUnit.urlGas && navigator.onLine) {
        try {
          await syncWithGAS();
        } catch (e) {
          console.warn('Sync after inisiasi warning:', e);
        }
      }

      showToast(`Berhasil tersambung ke database ${selectedUnit.namaUL}!`, 'success');

      // 5. Navigate to Login or Dashboard
      if (onInitiationComplete) {
        onInitiationComplete();
      } else if (isFromMenu) {
        setActiveTab('dashboard');
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      showToast(`Terjadi kesalahan inisiasi: ${err.message}`, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-tr from-teal-950/30 via-slate-950 to-teal-950/30 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        {/* Card Frame */}
        <div className="bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Header Section */}
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="relative inline-flex items-center justify-center mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-teal-500 rounded-3xl blur-md opacity-30 animate-pulse" />
              <div className="relative p-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
                <img
                  src={APP_LOGO_URL}
                  alt="Logo APHRO PLN"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.dataset.failed) {
                      target.dataset.failed = 'true';
                      target.src = 'https://drive.google.com/uc?export=view&id=1V2zz3q_3umHCaTqeJN6u7kbhGdLrK4NE';
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-black uppercase tracking-widest">
                <Building2 className="w-3.5 h-3.5" />
                <span>Inisiasi Sistem APHRO</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight pt-1">
                Pilih Unit Layanan (UL)
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Silakan pilih Unit Layanan operasional. Data dibaca langsung dari Spreadsheet Master Inisiasi.
              </p>

              {/* Master Spreadsheet Info Badge */}
              <div className="pt-1 flex items-center justify-center gap-2">
                <a
                  href={DEFAULT_INISIASI_SPREADSHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-teal-500/50 text-[11px] text-slate-400 hover:text-teal-300 transition-colors"
                  title="Buka Master Google Spreadsheet Inisiasi"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono">Master Sheet: inisiasi</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                </a>
              </div>
            </div>
          </div>

          {/* Form ScrollDown / Dropdown Selection */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ul-scrolldown-select"
                  className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center space-x-2"
                >
                  <Building2 className="w-4 h-4 text-teal-400" />
                  <span>Daftar Unit Layanan (UL)</span>
                </label>

                <button
                  type="button"
                  onClick={loadInisiasiData}
                  disabled={isLoading}
                  className="text-[11px] font-bold text-teal-400 hover:text-teal-300 flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Muat ulang data dari Master Spreadsheet"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Membaca...' : 'Tarik Ulang'}</span>
                </button>
              </div>

              {/* ScrollDown Dropdown Selector */}
              <div className="relative">
                <select
                  id="ul-scrolldown-select"
                  value={selectedULName}
                  onChange={(e) => setSelectedULName(e.target.value)}
                  disabled={isLoading || isApplying}
                  className={`w-full appearance-none pl-4 pr-10 py-4 bg-slate-950 border-2 rounded-2xl text-white font-bold text-sm sm:text-base tracking-tight shadow-inner focus:outline-none focus:ring-2 transition-all cursor-pointer disabled:opacity-50 ${
                    isConfigured
                      ? 'border-teal-500/50 hover:border-teal-400 focus:border-teal-400 focus:ring-teal-500/30'
                      : 'border-rose-500/60 hover:border-rose-400 focus:border-rose-400 focus:ring-rose-500/30'
                  }`}
                >
                  {ulOptions.map((unit, idx) => {
                    const unitConfigured = InisiasiService.isConfigured(unit);
                    return (
                      <option
                        key={`${unit.id || unit.namaUL}-${idx}`}
                        value={unit.namaUL}
                        className="bg-slate-900 text-white py-2"
                      >
                        {unit.namaUL} {unitConfigured ? '✓ [Terkonfigurasi]' : '⚠️ [Belum Dikonfigurasi]'}
                      </option>
                    );
                  })}
                </select>

                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-teal-400">
                  <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Menampilkan pilihan Unit Layanan (UL) murni sesuai data Sheet inisiasi.
              </p>
            </div>

            {/* Selected UL Validation Status Box */}
            {selectedUnit && (
              <div className="space-y-3">
                {isConfigured ? (
                  /* KONDISI 1: TERKONFIGURASI DENGAN BAIK */
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-3 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-300">Unit Terpilih:</span>
                      <span className="font-black text-emerald-300 flex items-center space-x-1.5 bg-emerald-900/60 px-3 py-1 rounded-xl border border-emerald-500/40">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>{selectedUnit.namaUL}</span>
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40 space-y-2 text-[11px] text-slate-300">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-teal-400" />
                          ID Spreadsheet:
                        </span>
                        <span className="font-mono text-white text-[11px] font-bold">
                          {selectedUnit.idSpreadsheet ? `${selectedUnit.idSpreadsheet.slice(0, 16)}...` : '-'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          Web App GAS:
                        </span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tersedia & Aktif
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-teal-400" />
                          Folder Drive:
                        </span>
                        <span className="text-slate-300 font-mono text-[10px]">
                          {selectedUnit.folderIdSpreadsheet ? `${selectedUnit.folderIdSpreadsheet.slice(0, 12)}...` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* KONDISI 2: REJECTION NOTICE - BELUM MEMILIKI KONFIGURASI */
                  <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/40 border-2 border-rose-500/50 space-y-3 text-xs animate-in shake duration-300">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-rose-900/60 border border-rose-700/60 text-rose-400 shrink-0">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-rose-300 text-xs sm:text-sm uppercase tracking-wide">
                            Sistem Menolak Inisiasi
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-rose-900/80 text-rose-200 text-[10px] font-bold border border-rose-700">
                            Konfigurasi Belum Ada
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-200/90 leading-relaxed">
                          Unit Layanan <strong className="text-white underline">{selectedUnit.namaUL}</strong> belum memiliki konfigurasi ID Spreadsheet dan URL Google Apps Script pada Master Sheet Inisiasi.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/90 border border-rose-900/60 space-y-1.5">
                      <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Parameter yang belum lengkap:
                      </p>
                      <ul className="space-y-1 text-[11px] text-slate-300 pl-1">
                        {missingConfigs.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1.5 text-rose-300 font-medium">
                            <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>{item} (masih kosong)</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-[10px] text-slate-400 italic">
                      Silakan pilih Unit Layanan lain yang sudah memiliki status [Terkonfigurasi] atau hubungi Administrator untuk melengkapi data di Google Spreadsheet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Primary Action Button */}
            {isConfigured ? (
              <button
                type="button"
                onClick={handleApplyConnection}
                disabled={isApplying || isLoading || !selectedUnit}
                className="w-full py-4 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-teal-600 via-teal-500 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-xl shadow-teal-600/30 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span className="uppercase tracking-wider">
                  {isApplying ? 'Menghubungkan Database...' : isFromMenu ? 'Simpan Unit Layanan' : 'Pilih & Sambungkan ke Login'}
                </span>
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyConnection}
                disabled={false}
                className="w-full py-4 rounded-2xl font-black text-sm sm:text-base text-rose-300 bg-rose-950/70 hover:bg-rose-900/80 border-2 border-rose-700/60 shadow-xl shadow-rose-950/50 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] cursor-pointer"
                title="Akses Ditolak karena konfigurasi belum lengkap"
              >
                <Lock className="w-5 h-5 text-rose-400" />
                <span className="uppercase tracking-wider">
                  Akses Ditolak: Konfigurasi Belum Lengkap
                </span>
              </button>
            )}

            {isFromMenu && (
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Kembali ke Dashboard
              </button>
            )}
          </div>

          {/* Status Message Footer */}
          {statusMessage && (
            <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-800/60">
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* App Footer */}
      <div className="relative z-10 p-4 text-center text-[11px] text-slate-500 space-y-0.5">
        <p className="font-bold tracking-widest uppercase text-slate-400">
          APHRO - Asset Protection & Hazard Response Operations
        </p>
        <p>© 13307BKT- 2026 PLN ES UP4 Sumatera Barat. All rights reserved.</p>
      </div>
    </div>
  );
};
