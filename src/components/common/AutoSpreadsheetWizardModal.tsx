import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useGASSync } from '../../hooks/useGASSync';
import { useToast } from '../../hooks/useToast';
import { GAS_BACKEND_CODE } from '../../utils/gasBackendCode';
import { GASApiService } from '../../services/gasApiService';
import { saveAndEmbedGasConfig } from '../../config/gasConfig';
import {
  FileSpreadsheet,
  Check,
  Copy,
  ExternalLink,
  Code2,
  Database,
  X,
  Play,
  Folder,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface AutoSpreadsheetWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutoSpreadsheetWizardModal: React.FC<AutoSpreadsheetWizardModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useSettings();
  const { syncWithGAS, isGasConnected } = useGASSync();
  const { showToast } = useToast();

  const [gasUrlInput, setGasUrlInput] = useState(settings.gasWebAppUrl || '');
  const [isCopied, setIsCopied] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [createdSsId, setCreatedSsId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_CODE);
    setIsCopied(true);
    showToast('Kode Script Google Apps Script (Code.gs) berhasil disalin!', 'success');
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleRunAutoInit = async () => {
    const cleanUrl = (gasUrlInput || '').trim();
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      showToast('Masukkan Web App URL hasil Deploy Google Apps Script!', 'warning');
      return;
    }

    setIsInitializing(true);
    showToast('Menghubungi Google Apps Script untuk membuat Spreadsheet otomatis...', 'info');

    try {
      // 1. Save and embed settings URL
      saveAndEmbedGasConfig(cleanUrl);
      updateSettings({ gasWebAppUrl: cleanUrl });

      // 2. Call initDatabase
      const res = await GASApiService.initDatabase(cleanUrl);

      if (res.status === 'success') {
        setCreatedSsId(res.spreadsheetId || 'APHRO_DATABASE_ENTERPRISE');
        showToast(
          `BERHASIL! Google Spreadsheet 'APHRO_DATABASE_ENTERPRISE' dengan 10 Sheet telah dibuat otomatis!`,
          'success'
        );
        await syncWithGAS();
      } else {
        showToast(`Gagal: ${res.message || 'Pastikan izin deployment diset ke Anyone (Siapa Saja)'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsInitializing(false);
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
                Wizard Auto-Spreadsheet Generator
              </h2>
              <p className="text-xs text-teal-100">
                Membuat Google Spreadsheet 'APHRO_DATABASE_ENTERPRISE' + 10 Sheet Otomatis
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
          {/* Target Folders Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-1">
              <div className="flex items-center justify-between font-bold text-teal-900 dark:text-teal-300">
                <span className="flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                  <span>Folder Spreadsheet DB</span>
                </span>
                <a
                  href="https://drive.google.com/drive/folders/1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv"
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-600 hover:underline flex items-center space-x-0.5 text-[11px]"
                >
                  <span>Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ID Folder: <code className="font-mono text-teal-700 dark:text-teal-300">1boNO8nAA...</code>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-1">
              <div className="flex items-center justify-between font-bold text-[#008396] dark:text-teal-300">
                <span className="flex items-center space-x-1.5">
                  <Folder className="w-4 h-4 text-[#00A2B9]" />
                  <span>Folder Storage Foto Drive</span>
                </span>
                <a
                  href="https://drive.google.com/drive/folders/1idu8U3COKEqdcCewdWntu9X06ZMnzskr"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00A2B9] hover:underline flex items-center space-x-0.5 text-[11px]"
                >
                  <span>Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ID Folder: <code className="font-mono text-[#00A2B9] dark:text-teal-300">1idu8U3C...</code>
              </p>
            </div>
          </div>

          {/* 3 Step Instructions */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              3 Langkah Mudah Inisialisasi Otomatis:
            </h3>

            {/* Step 1 */}
            <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="w-7 h-7 rounded-xl bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Salin Script Backend Google Apps Script (Code.gs)
                </p>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300">
                  <span className="font-bold">⚠️ PERHATIAN:</span> Google Apps Script tidak mendukung kata <code>export</code>. Jangan menempel file TypeScript. Klik tombol di bawah ini atau unduh file <strong>Code.gs</strong> murni.
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kode ini berisi instruksi otomatis untuk membuat Spreadsheet & 10 Sheet (USERS, WORK_ORDERS, REALISASI, ULP, PENYULANG, REGU_ROW, PETUGAS, ABSENSI, SETTING, LOG_ACTIVITY, NOTIFICATION).
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-teal-300" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'Kode Disalin ke Clipboard!' : 'Salin Kode Backend Code.gs'}</span>
                  </button>
                  <a
                    href="/Code.gs"
                    download="Code.gs"
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Unduh File Code.gs</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="w-7 h-7 rounded-xl bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Paste & Deploy di Google Apps Script
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  1. Buka <a href="https://script.google.com/home/start" target="_blank" rel="noreferrer" className="text-teal-600 font-bold underline inline-flex items-center space-x-0.5"><span>script.google.com</span><ExternalLink className="w-3 h-3"/></a> &gt; Klik <b>New Project</b>.<br />
                  2. Paste kode yang disalin ke <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">Code.gs</code>.<br />
                  3. Klik <b>Deploy</b> &gt; <b>New Deployment</b> &gt; Jenis: <b>Web App</b>.<br />
                  4. Set <i>Execute as</i>: <b>Me</b>, <i>Who has access</i>: <b>Anyone (Siapa Saja)</b>.<br />
                  5. Salin <b>Web App URL</b> yang dihasilkan.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800">
              <div className="w-7 h-7 rounded-xl bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-3 flex-1">
                <p className="text-xs font-bold text-teal-950 dark:text-teal-200">
                  Paste Web App URL & Jalankan Auto-Inisialisasi
                </p>
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    value={gasUrlInput}
                    onChange={(e) => setGasUrlInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-teal-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={handleRunAutoInit}
                    disabled={isInitializing}
                    className="w-full py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-[#008396] hover:bg-[#00A2B9] transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isInitializing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>
                      {isInitializing
                        ? 'Membuat Spreadsheet & 10 Sheet...'
                        : 'Buat & Inisialisasi Spreadsheet Otomatis Sekarang'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Success Box */}
          {createdSsId && (
            <div className="p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-[#008396] dark:text-teal-200 space-y-2 animate-in zoom-in-95">
              <div className="flex items-center space-x-2 font-bold text-xs text-[#00A2B9] dark:text-teal-400">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span>Spreadsheet Database Berhasil Dibuat dan Terhubung!</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                File <code className="font-mono font-bold text-[#00A2B9] dark:text-teal-300">APHRO_DATABASE_ENTERPRISE</code> telah otomatis disimpan di Folder Google Drive ID: <code className="font-mono font-bold">1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv</code>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            {isGasConnected ? (
              <span className="flex items-center space-x-1 text-teal-600 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Status: Terhubung</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-600 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>Status: Belum Terhubung</span>
              </span>
            )}
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
