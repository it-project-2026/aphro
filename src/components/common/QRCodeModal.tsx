import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { WorkOrder } from '../../types';
import { X, Printer, Download, QrCode } from 'lucide-react';

interface QRCodeModalProps {
  workOrder: WorkOrder | null;
  onClose: () => void;
  unitName: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  workOrder,
  onClose,
  unitName,
}) => {
  if (!workOrder) return null;

  const qrData = JSON.stringify({
    app: 'APHRO-PLN',
    woNo: workOrder.nomorWO,
    date: workOrder.tanggal,
    ulp: workOrder.ulpName,
    feeder: workOrder.penyulangName,
    coords: `${workOrder.latitude},${workOrder.longitude}`,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400">
            <QrCode className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              QR Code Work Order
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Area */}
        <div className="text-center space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div className="flex justify-center p-3 bg-white rounded-xl shadow-xs inline-block">
            <QRCodeSVG value={qrData} size={180} level="H" includeMargin={true} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 rounded-full">
              {workOrder.nomorWO}
            </span>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 pt-1">
              {unitName}
            </p>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
              {workOrder.penyulangName} - {workOrder.ulpName}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              📍 {workOrder.lokasi}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak QR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
