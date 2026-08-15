import React, { useState } from 'react';
import { Workflow, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { VisioExportOptions, exportMapsToVisio, VisioExportParams } from '../services/visioExportService';

interface ExportVisioModalProps extends Omit<VisioExportParams, 'options' | 'onProgress'> {
  triggerButtonClassName?: string;
  buttonLabel?: string;
}

export const ExportVisioModal: React.FC<ExportVisioModalProps> = ({
  triggerButtonClassName = 'inline-flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95',
  buttonLabel = '📐 Export to Visio',
  ...exportParams
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pageSize, setPageSize] = useState<VisioExportOptions['pageSize']>('A3 Landscape');
  const [includeBackgroundMap, setIncludeBackgroundMap] = useState(true);
  const [includeFeederLines, setIncludeFeederLines] = useState(true);
  const [includePoles, setIncludePoles] = useState(true);
  const [includeWorkOrders, setIncludeWorkOrders] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleStartExport = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProgressMessage('Mempersiapkan data...');

    try {
      await exportMapsToVisio({
        ...exportParams,
        options: {
          pageSize,
          includeBackgroundMap,
          includeFeederLines,
          includePoles,
          includeWorkOrders,
          includeLabels,
          includeLegend,
        },
        onProgress: (msg) => {
          setProgressMessage(msg);
        },
      });

      setSuccessMessage('File Visio (.vsdx) berhasil dibuat dan diunduh!');
      setTimeout(() => {
        setIsExporting(false);
        setIsOpen(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      console.error('Export Visio error:', err);
      const rawMsg = err?.message || String(err);
      if (rawMsg.includes('Export Visio gagal')) {
        setErrorMessage(rawMsg);
      } else {
        setErrorMessage(
          `Export Visio gagal.\n\nPenyebab:\n${rawMsg}\n\nPeriksa data latitude dan longitude pada objek peta.`
        );
      }
      setIsExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setSuccessMessage(null);
          setIsOpen(true);
        }}
        className={triggerButtonClassName}
        title="Export Skema Diagram Peta GIS ke Microsoft Visio (.vsdx)"
      >
        <Workflow className="w-4 h-4" />
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Export Maps ke Visio
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Format Vektor Microsoft Visio (.vsdx) dengan GPS Nyata
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isExporting && setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
                disabled={isExporting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Page Size Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Ukuran Kanvas Diagram
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as any)}
                  disabled={isExporting}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="A3 Landscape">A3 Landscape (Recommended)</option>
                  <option value="A4 Landscape">A4 Landscape</option>
                  <option value="A4 Portrait">A4 Portrait</option>
                  <option value="Letter Landscape">Letter Landscape</option>
                </select>
              </div>

              {/* Layer Toggles */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Layer Elemen Visio (Urutan Z-Index)
                </label>
                <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBackgroundMap}
                      onChange={(e) => setIncludeBackgroundMap(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Background Maps</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeFeederLines}
                      onChange={(e) => setIncludeFeederLines(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Jaringan Penyulang</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePoles}
                      onChange={(e) => setIncludePoles(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Tiang</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeWorkOrders}
                      onChange={(e) => setIncludeWorkOrders(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Work Order</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLabels}
                      onChange={(e) => setIncludeLabels(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Label</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLegend}
                      onChange={(e) => setIncludeLegend(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Legend</span>
                  </label>
                </div>
              </div>

              {/* Progress or Status messages */}
              {isExporting && (
                <div className="flex items-center space-x-3 p-3.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-800 dark:text-indigo-300 text-xs font-bold animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin shrink-0 text-indigo-600" />
                  <span>{progressMessage || 'Mempersiapkan data...'}</span>
                </div>
              )}

              {successMessage && (
                <div className="flex items-center space-x-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-mono whitespace-pre-line space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-rose-900 dark:text-rose-200 font-sans">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Export Visio Gagal</span>
                  </div>
                  <p>{errorMessage}</p>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isExporting}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleStartExport}
                disabled={isExporting}
                className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Visio...</span>
                  </>
                ) : (
                  <>
                    <Workflow className="w-4 h-4" />
                    <span>Export Visio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
