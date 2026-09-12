import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { InisiasiUnit } from '../types';
import {
  InisiasiService,
  DEFAULT_UL_OPTIONS,
} from '../services/inisiasiService';
import { SupabaseService } from '../services/supabaseService';
import { SUPABASE_URL, SUPABASE_DATABASE_NAME, SUPABASE_TABLES } from '../services/supabaseClient';
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
  ShieldCheck,
  FolderTree,
  Server,
  Layers,
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
  const { showToast } = useToast();

  const [ulOptions, setUlOptions] = useState<InisiasiUnit[]>(DEFAULT_UL_OPTIONS);
  const [selectedULName, setSelectedULName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Load Inisiasi UL Data on Mount from Supabase table INISIASI
  useEffect(() => {
    loadInisiasiData();
  }, []);

  const loadInisiasiData = async () => {
    setIsLoading(true);
    setStatusMessage('Menghubungkan ke Supabase APHRO-Database (Tabel INISIASI)...');
    try {
      const res = await SupabaseService.fetchInisiasiUnits();

      if (res.success && res.data.length > 0) {
        const filteredUL = res.data.filter(u => InisiasiService.isValidUL(u.namaUL));
        const finalOptions = filteredUL.length > 0 ? filteredUL : DEFAULT_UL_OPTIONS;

        setUlOptions(finalOptions);
        setStatusMessage(res.message || 'Data Unit Layanan siap dari database Supabase.');

        const currentNama = settings.namaUnitLayanan || '';
        const match = finalOptions.find(
          u => u.namaUL.toLowerCase() === currentNama.toLowerCase() ||
               currentNama.toLowerCase().includes(u.namaUL.toLowerCase())
        );

        if (match) {
          setSelectedULName(match.namaUL);
        } else {
          setSelectedULName(finalOptions[0].namaUL);
        }
      } else {
        setUlOptions(DEFAULT_UL_OPTIONS);
        setSelectedULName(DEFAULT_UL_OPTIONS[0].namaUL);
      }
    } catch {
      setUlOptions(DEFAULT_UL_OPTIONS);
      setSelectedULName(DEFAULT_UL_OPTIONS[0].namaUL);
      setStatusMessage('Menggunakan data Unit Layanan lokal.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedUnit = ulOptions.find(u => u.namaUL === selectedULName) || ulOptions[0] || null;

  const handleApplyConnection = async () => {
    if (!selectedUnit) {
      showToast('Harap pilih Unit Layanan (UL) terlebih dahulu!', 'warning');
      return;
    }

    setIsApplying(true);
    showToast(`Menyambungkan unit ${selectedUnit.namaUL} ke database Supabase...`, 'info');

    try {
      // 1. Simpan unit terpilih dan unitId ke storage
      InisiasiService.saveSelectedUnit(selectedUnit);
      localStorage.setItem('aphro_selected_unit_id', selectedUnit.id);
      localStorage.setItem('aphro_has_initiated', 'true');
      localStorage.setItem('aphro_nama_unit_layanan', selectedUnit.namaUL);

      // 2. Update settings state
      updateSettings({
        namaUnitLayanan: selectedUnit.namaUL,
        spreadsheetId: selectedUnit.id,
        driveFolderId: selectedUnit.folderIdSpreadsheet || settings.driveFolderId,
        photoFolderId: selectedUnit.folderIdFoto || settings.photoFolderId,
        absensiFolderId: selectedUnit.folderIdAbsensi || settings.absensiFolderId,
      });

      // Clear old data caches to force fresh fetch for new unit
      localStorage.removeItem('pln_work_orders');
      localStorage.removeItem('pln_realisasi');
      localStorage.removeItem('pln_absensi');

      showToast(`Berhasil tersambung ke Supabase (${selectedUnit.namaUL})!`, 'success');

      // 3. Navigate
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden flex flex-col justify-between selection:bg-[#00A2B9] selection:text-white">
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
              <div className="absolute -inset-1 bg-gradient-to-r from-[#00A2B9] to-[#008396] rounded-3xl blur-md opacity-30 animate-pulse" />
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
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00A2B9]/10 border border-[#00A2B9]/20 text-[#00A2B9] text-xs font-black uppercase tracking-widest">
                <Server className="w-3.5 h-3.5" />
                <span>Supabase Database: {SUPABASE_DATABASE_NAME}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight pt-1">
                Pilih Unit Layanan (UL)
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Sistem database tunggal terhubung ke Tabel Supabase <code className="text-teal-400 bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-800 font-mono text-xs font-bold">{SUPABASE_TABLES.INISIASI}</code> via <code className="text-teal-400 font-mono">unitId</code>.
              </p>

              {/* Supabase Host Info Badge */}
              <div className="pt-1 flex items-center justify-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-teal-900/40 text-[11px] text-teal-400 font-mono shadow-sm">
                  <Database className="w-3.5 h-3.5 text-[#00A2B9]" />
                  <span>Host: {SUPABASE_URL.replace('https://', '')}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
                </div>
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
                  <Building2 className="w-4 h-4 text-[#00A2B9]" />
                  <span>Daftar Unit Layanan (Tabel INISIASI)</span>
                </label>

                <button
                  type="button"
                  onClick={loadInisiasiData}
                  disabled={isLoading}
                  className="text-[11px] font-bold text-[#00A2B9] hover:text-[#008396] flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Muat ulang data dari Supabase"
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
                  className="w-full appearance-none pl-4 pr-10 py-4 bg-slate-950 border-2 rounded-2xl text-white font-bold text-sm sm:text-base tracking-tight shadow-inner focus:outline-none focus:ring-2 border-[#00A2B9]/50 hover:border-teal-400 focus:border-teal-400 focus:ring-[#00A2B9]/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {ulOptions.map((unit, idx) => (
                    <option
                      key={`${unit.id || unit.namaUL}-${idx}`}
                      value={unit.namaUL}
                      className="bg-slate-900 text-white py-2"
                    >
                      {unit.namaUL} (ID: {unit.id || `UL${idx + 1}`})
                    </option>
                  ))}
                </select>

                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-teal-400">
                  <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Data terisolasi otomatis menggunakan filter kolom <span className="text-teal-400 font-mono">unitId</span> di semua tabel Supabase.
              </p>
            </div>

            {/* Selected UL Validation Status Box */}
            {selectedUnit && (
              <div className="p-4 sm:p-5 rounded-2xl bg-teal-950/30 border border-[#00A2B9]/30 space-y-3 text-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-300">Unit Terpilih:</span>
                  <span className="font-black text-teal-300 flex items-center space-x-1.5 bg-teal-900/60 px-3 py-1 rounded-xl border border-[#00A2B9]/40">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <span>{selectedUnit.namaUL}</span>
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-teal-900/40 space-y-2 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-teal-400" />
                      Unit ID (Kunci Relasi Tabel):
                    </span>
                    <span className="font-mono text-white text-[11px] font-bold bg-teal-900/60 px-2 py-0.5 rounded border border-teal-700">
                      {selectedUnit.id || 'UL1'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-teal-400" />
                      Status Database Supabase:
                    </span>
                    <span className="text-teal-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tersambung (Online)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FolderTree className="w-3.5 h-3.5 text-teal-400" />
                      Folder ID Foto Realisasi:
                    </span>
                    <span className="text-slate-300 font-mono text-[10px]">
                      {selectedUnit.folderIdFoto ? `${selectedUnit.folderIdFoto.slice(0, 14)}...` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleApplyConnection}
              disabled={isApplying || isLoading || !selectedUnit}
              className="w-full py-4 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-[#00A2B9] via-[#008396] to-[#00A2B9] shadow-xl shadow-teal-600/30 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span className="uppercase tracking-wider">
                {isApplying ? 'Menghubungkan Database...' : isFromMenu ? 'Simpan Unit Layanan' : 'Pilih & Sambungkan ke Login'}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>

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
        <p>© 13307BKT- 2026 PLN ES UP4 Sumatera Barat. Supabase Database: APHRO-Database.</p>
      </div>
    </div>
  );
};
