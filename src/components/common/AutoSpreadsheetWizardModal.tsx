import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useGASSync } from '../../hooks/useGASSync';
import { useToast } from '../../hooks/useToast';
import { SupabaseService } from '../../services/supabaseService';
import {
  Database,
  Check,
  Copy,
  ExternalLink,
  X,
  Play,
  Folder,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Server,
  Layers,
} from 'lucide-react';

interface AutoSpreadsheetWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutoSpreadsheetWizardModal: React.FC<AutoSpreadsheetWizardModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const { syncWithGAS } = useGASSync();

  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResults, setSupabaseTestResults] = useState<any>(null);
  const [isSeedingSupabase, setIsSeedingSupabase] = useState(false);

  if (!isOpen) return null;

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    showToast('Memeriksa koneksi 9 tabel di Supabase APHRO-Database...', 'info');
    try {
      const res = await SupabaseService.testAllTables();
      setSupabaseTestResults(res);
      if (res.isOnline) {
        showToast(`Koneksi Supabase Berhasil! Total ${res.totalRows} baris ditemukan.`, 'success');
        syncWithGAS();
      } else {
        showToast('Tabel Supabase belum terinisialisasi.', 'warning');
      }
    } catch (err: any) {
      showToast(`Error Supabase: ${err.message}`, 'error');
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSeedSupabase = async () => {
    setIsSeedingSupabase(true);
    showToast('Mengunggah master data awal ke tabel Supabase...', 'info');
    try {
      const res = await SupabaseService.seedDatabaseToSupabase();
      if (res.success) {
        const countSummary = Object.entries(res.inserted).map(([tbl, c]) => `${tbl}: ${c}`).join(', ');
        showToast(`Master data berhasil diunggah ke Supabase! (${countSummary})`, 'success');
        await handleTestSupabase();
      } else {
        showToast(`Beberapa tabel gagal diisi: ${Object.values(res.errors).join(', ')}`, 'warning');
      }
    } catch (err: any) {
      showToast(`Gagal seeding Supabase: ${err.message}`, 'error');
    } finally {
      setIsSeedingSupabase(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-teal-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-teal-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-black font-display tracking-tight">
                Wizard Database Supabase APHRO
              </h2>
              <p className="text-xs text-teal-100">
                Pemeriksaan & Inisialisasi 9 Tabel Utama Database Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Supabase Status Box */}
          <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
            <div className="flex items-center justify-between font-bold text-teal-900 dark:text-teal-200 text-xs">
              <span className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Supabase Database Endpoint</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-500/20 text-teal-700 dark:text-teal-300">
                PostgreSQL Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
              URL: https://...supabase.co
            </p>
          </div>

          {/* Action Steps */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Pengujian & Inisialisasi Data:
            </h3>

            {/* Step 1: Test Connection */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-teal-600" />
                    <span>1. Uji Koneksi 9 Tabel Supabase</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Mengecek status ketersediaan tabel: USERS, WORK_ORDER, REALISASI, ABSENSI, ULP, PENYULANG, REGU_ROW, PETUGAS, INISIASI_UNIT.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={isTestingSupabase}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isTestingSupabase ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Uji Koneksi</span>
                </button>
              </div>

              {supabaseTestResults && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                  {Object.entries(supabaseTestResults.tables || {}).map(([table, details]: [string, any]) => (
                    <div
                      key={table}
                      className={`p-2 rounded-xl border flex items-center justify-between ${
                        details.ok
                          ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 text-teal-800 dark:text-teal-300'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      <span className="font-bold">{table}</span>
                      <span>{details.ok ? `${details.count} baris` : 'Error'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Seed Initial Data */}
            <div className="p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-600" />
                    <span>2. Tanamkan Master Data Awal (Seeding)</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Mengisi data awal unit ULP, Penyulang, Regu, User default, dan Work Order awal ke dalam Supabase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedSupabase}
                  disabled={isSeedingSupabase}
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-[#00A2B9] hover:from-teal-700 hover:to-[#008396] text-white rounded-xl text-xs font-black transition-all shadow-md disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSeedingSupabase ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Seed Supabase Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 text-teal-600 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Database Status: Supabase Active</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl transition-colors"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
