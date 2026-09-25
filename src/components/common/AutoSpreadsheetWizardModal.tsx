import React, { useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { ApiService, API_BASE_URL } from '../../services/apiService';
import {
  Database,
  Check,
  X,
  Play,
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

  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  if (!isOpen) return null;

  const handleTestDatabase = async () => {
    setIsTesting(true);
    showToast('Memeriksa koneksi 10 tabel di PostgreSQL HyperCloudHost...', 'info');
    try {
      const res = await ApiService.getDatabaseStatus();
      setTestResults(res);
      if (res.connected || res.status === 'success') {
        showToast(`Koneksi Database Berhasil! Database meysxysd_aphro aktif.`, 'success');
      } else {
        showToast('Tabel database merespons: ' + (res.message || 'Periksa koneksi'), 'warning');
      }
    } catch (err: any) {
      showToast(`Error Database: ${err.message}`, 'error');
    } finally {
      setIsTesting(false);
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
                Wizard Database PostgreSQL HyperCloudHost
              </h2>
              <p className="text-xs text-teal-100">
                Pemeriksaan Status 10 Tabel Utama Database HyperCloudHost
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
          {/* Status Box */}
          <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
            <div className="flex items-center justify-between font-bold text-teal-900 dark:text-teal-200 text-xs">
              <span className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Database HyperCloudHost Endpoint</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-500/20 text-teal-700 dark:text-teal-300">
                PostgreSQL Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
              Gateway: {API_BASE_URL}
            </p>
          </div>

          {/* Action Steps */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Pengujian Status Database:
            </h3>

            {/* Step 1: Test Connection */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-teal-600" />
                    <span>Uji Status 10 Tabel HyperCloudHost</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Mengecek status ketersediaan tabel: USERS, WORK_ORDER, REALISASI, ABSENSI, ULP, PENYULANG, REGU_ROW, PETUGAS, INISIASI, LOG_ACTIVITY.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={isTesting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Uji Koneksi</span>
                </button>
              </div>

              {testResults && testResults.tables && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                  {Object.entries(testResults.tables || {}).map(([table, count]: [string, any]) => (
                    <div
                      key={table}
                      className="p-2 rounded-xl border flex items-center justify-between bg-teal-50 dark:bg-teal-950/30 border-teal-200 text-teal-800 dark:text-teal-300"
                    >
                      <span className="font-bold">{table}</span>
                      <span>{count} baris</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 text-teal-600 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Database Status: HyperCloudHost Active</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
