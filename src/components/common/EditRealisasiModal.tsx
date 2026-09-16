import React, { useState, useEffect } from 'react';
import { Realisasi } from '../../types';
import { X, Calendar, MapPin, AlertCircle, Save, Loader2 } from 'lucide-react';
import { normalizeDateISO } from '../../utils/dateUtils';
import { useRealisasi } from '../../context/RealisasiContext';

interface EditRealisasiModalProps {
  realisasi: Realisasi | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditRealisasiModal: React.FC<EditRealisasiModalProps> = ({
  realisasi,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateRealisasiAdmin } = useRealisasi();

  const [tanggal, setTanggal] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (realisasi) {
      // Normalize date string for HTML5 date input (YYYY-MM-DD)
      const rawDate = realisasi.tanggalRealisasi || (realisasi as any).TANGGAL || (realisasi as any).tanggal || '';
      const isoDate = normalizeDateISO(rawDate) || new Date().toISOString().split('T')[0];
      setTanggal(isoDate);

      // Extract numeric latitude and longitude
      const latVal = realisasi.latitude !== undefined && realisasi.latitude !== null
        ? String(realisasi.latitude)
        : '';
      const lngVal = realisasi.longitude !== undefined && realisasi.longitude !== null
        ? String(realisasi.longitude)
        : '';

      setLatitude(latVal);
      setLongitude(lngVal);
      setErrorMsg(null);
    }
  }, [realisasi, isOpen]);

  if (!isOpen || !realisasi) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validate Tanggal
    if (!tanggal || !tanggal.trim()) {
      setErrorMsg('Tanggal realisasi tidak boleh kosong.');
      return;
    }

    // 2. Parse & Validate Latitude
    const latNum = parseFloat(latitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setErrorMsg('Latitude tidak valid. Harus berupa angka antara -90 dan 90.');
      return;
    }

    // 3. Parse & Validate Longitude
    const lngNum = parseFloat(longitude);
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setErrorMsg('Longitude tidak valid. Harus berupa angka antara -180 dan 180.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await updateRealisasiAdmin(realisasi.id, tanggal, latNum, lngNum);
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Data Realisasi gagal diperbarui.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Data Realisasi gagal diperbarui.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedLatLngPreview = `${latitude.trim() || '0'}, ${longitude.trim() || '0'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white font-display tracking-tight">
              EDIT REALISASI
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Koreksi data Tanggal dan Koordinat Lokasi Realisasi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start space-x-3 p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Read Only Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                ID REALISASI <span className="text-slate-400 font-normal">(READ ONLY)</span>
              </label>
              <input
                type="text"
                value={realisasi.id}
                disabled
                readOnly
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                NOMOR WO <span className="text-slate-400 font-normal">(READ ONLY)</span>
              </label>
              <input
                type="text"
                value={realisasi.nomorWO || '-'}
                disabled
                readOnly
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Tanggal Field (Editable) */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              TANGGAL REALISASI <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* Latitude & Longitude Fields (Editable) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              KOORDINAT LOKASI (LATITUDE, LONGITUDE) <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Latitude (-90 s/d 90)
                </span>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-0.914200"
                  required
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Longitude (-180 s/d 180)
                </span>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="100.463100"
                  required
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>
            </div>

            {/* Format Database Preview */}
            <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/50 rounded-xl flex items-center space-x-2 text-[11px] text-teal-800 dark:text-teal-300">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <span className="font-bold">Format Database (`Latitude_Longitude`): </span>
                <span className="font-mono font-black">{formattedLatLngPreview}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
