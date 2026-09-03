import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, CheckCircle, MapPin } from 'lucide-react';
import { getWIBDateString } from '../utils/dateUtils';

interface MapPreviewModalProps {
  isOpen: boolean;
  mapImage: string | null;
  ulpName: string;
  penyulangName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const MapPreviewModal: React.FC<MapPreviewModalProps> = ({
  isOpen,
  mapImage,
  ulpName,
  penyulangName,
  onClose,
  onConfirm,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const safeUlp = ulpName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeFeeder = penyulangName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = getWIBDateString();
  const fileName = `Peta_Pohon_ROW_${safeUlp}_${safeFeeder}_${dateStr}.pdf`;

  const handleConfirmClick = () => {
    setIsDownloading(true);
    setTimeout(() => {
      onConfirm();
      setIsDownloading(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00A2B9]/10 text-teal-600 rounded-2xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Preview Peta Laporan ROW
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                File: {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar for Zoom */}
        <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Periksa peta dengan seksama sebelum konfirmasi unduh:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              title="Perkecil (Zoom Out)"
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700 dark:text-slate-300 min-w-[50px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="Perbesar (Zoom In)"
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset Zoom"
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition ml-1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Container (Scrollable & Zoomable) */}
        <div className="flex-1 overflow-auto p-6 bg-slate-900/5 dark:bg-slate-950/40 flex items-center justify-center min-h-[380px] max-h-[55vh]">
          {mapImage ? (
            <div className="transition-transform duration-200 ease-out shadow-2xl rounded-2xl overflow-hidden border-2 border-slate-900 bg-white inline-block">
              <img
                src={mapImage}
                alt="Preview Peta Laporan"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                className="max-w-full object-contain transition-transform duration-200"
              />
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">
              <p>Memuat tangkapan layar peta...</p>
            </div>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isDownloading}
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-lg shadow-[#00A2B9]/25 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Mengunduh PDF...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Konfirmasi & Download PDF
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
