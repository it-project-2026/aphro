import React, { useState, useEffect, useRef } from 'react';
import { Realisasi, WatermarkedPhoto } from '../../types';
import {
  X,
  Calendar,
  MapPin,
  AlertCircle,
  Save,
  Loader2,
  Camera,
  Upload,
  Trash2,
  Eye,
  Navigation,
  Image as ImageIcon,
  Building2,
  Users,
  Zap,
  Tag,
  CheckCircle2,
  FileText,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { normalizeDateISO, getWIBDateString, getLocalDateTimeString } from '../../utils/dateUtils';
import { useRealisasi } from '../../context/RealisasiContext';
import { useMasterData } from '../../context/MasterDataContext';
import { useWorkOrders } from '../../context/WorkOrderContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../hooks/useToast';
import { generateWatermarkedImage } from '../../utils/watermark';
import { formatDriveViewUrl, formatDriveImageUrl, ensureGoogleDrivePhotoUrl } from '../../utils/driveUtils';
import { GASApiService } from '../../services/gasApiService';
import { ImagePreviewModal } from './ImagePreviewModal';

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
  const { ulpList, reguList, penyulangList } = useMasterData();
  const { workOrders, displayedWorkOrders } = useWorkOrders();
  const { settings } = useSettings();
  const { showToast } = useToast();

  // Form Fields State
  const [tanggal, setTanggal] = useState('');
  const [nomorWO, setNomorWO] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [ulpName, setUlpName] = useState('');
  const [reguName, setReguName] = useState('');
  const [penyulangName, setPenyulangName] = useState('');
  const [noTiang, setNoTiang] = useState('');
  const [petugasName, setPetugasName] = useState('');
  const [jenisTanaman, setJenisTanaman] = useState('');
  const [keterangan, setKeterangan] = useState('TEBANG');
  const [pertumbuhanTanaman, setPertumbuhanTanaman] = useState('CEPAT');
  const [kendala, setKendala] = useState('Tidak Ada Kendala');
  const [lokasiKerja, setLokasiKerja] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Photos State
  const [fotoSebelumUrl, setFotoSebelumUrl] = useState('');
  const [fotoSesudahUrl, setFotoSesudahUrl] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Status & UI
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [previewModalTitle, setPreviewModalTitle] = useState<string>('Pratinjau Foto');

  const fileInputSebelumRef = useRef<HTMLInputElement>(null);
  const fileInputSesudahRef = useRef<HTMLInputElement>(null);
  const cameraInputSebelumRef = useRef<HTMLInputElement>(null);
  const cameraInputSesudahRef = useRef<HTMLInputElement>(null);

  const [isUlpDropdownOpen, setIsUlpDropdownOpen] = useState(false);
  const [isReguDropdownOpen, setIsReguDropdownOpen] = useState(false);
  const [isPylDropdownOpen, setIsPylDropdownOpen] = useState(false);

  const ulpDropdownRef = useRef<HTMLDivElement>(null);
  const reguDropdownRef = useRef<HTMLDivElement>(null);
  const pylDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (ulpDropdownRef.current && !ulpDropdownRef.current.contains(target)) {
        setIsUlpDropdownOpen(false);
      }
      if (reguDropdownRef.current && !reguDropdownRef.current.contains(target)) {
        setIsReguDropdownOpen(false);
      }
      if (pylDropdownRef.current && !pylDropdownRef.current.contains(target)) {
        setIsPylDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize form when realisasi prop changes or modal opens
  useEffect(() => {
    if (realisasi && isOpen) {
      // 1. Tanggal
      const rawDate =
        realisasi.tanggalRealisasi ||
        (realisasi as any).TANGGAL ||
        (realisasi as any).tanggal ||
        (realisasi as any).Tanggal ||
        '';
      const isoDate = normalizeDateISO(rawDate) || getWIBDateString();
      setTanggal(isoDate);

      // 2. Work Order & Basic Identifiers
      setNomorWO(realisasi.nomorWO || (realisasi as any).Nomor_WO || '');
      setWorkOrderId(realisasi.workOrderId || (realisasi as any).WO_ID || '');
      setUlpName(realisasi.ulpName || (realisasi as any).ULP || '');
      setReguName(realisasi.reguName || (realisasi as any).REGU_ROW || '');
      setPenyulangName(realisasi.penyulangName || (realisasi as any).PENYULANG || '');
      setNoTiang(realisasi.noTiang || (realisasi as any).NO_TIANG || '');
      setPetugasName(realisasi.petugasName || (realisasi as any).petugasId || '');

      // 3. Pekerjaan & Vegetasi
      setJenisTanaman(realisasi.jenisTanaman || (realisasi as any).Jenis_Tanaman || 'Kelapa Sawit');
      setKeterangan(realisasi.keterangan || (realisasi as any).Keterangan || 'TEBANG');
      setPertumbuhanTanaman(realisasi.pertumbuhanTanaman || (realisasi as any).Pertumbuhan_Tanaman || 'CEPAT');
      setKendala(realisasi.kendala || (realisasi as any).Kendala || 'Tidak Ada Kendala');
      setLokasiKerja(realisasi.lokasiKerja || (realisasi as any).Lokasi_kerja || '');

      // 4. Koordinat
      const latVal =
        realisasi.latitude !== undefined && realisasi.latitude !== null
          ? String(realisasi.latitude)
          : '';
      const lngVal =
        realisasi.longitude !== undefined && realisasi.longitude !== null
          ? String(realisasi.longitude)
          : '';
      setLatitude(latVal);
      setLongitude(lngVal);

      // 5. Foto Sebelum & Sesudah
      const initialFotoSebelum =
        realisasi.fotoSebelumUrl ||
        (realisasi as any).Foto_Sebelum ||
        (realisasi as any).FOTO_SEBELUM ||
        (realisasi.photosSebelum && realisasi.photosSebelum.length > 0
          ? realisasi.photosSebelum[0].fileUrl || realisasi.photosSebelum[0].dataUrl
          : '') ||
        '';

      const initialFotoSesudah =
        realisasi.fotoSesudahUrl ||
        (realisasi as any).Foto_Sesudah ||
        (realisasi as any).Foto_Setelah ||
        (realisasi as any).FOTO_SETELAH ||
        (realisasi as any).FOTO_PROSES ||
        (realisasi.photosSesudah && realisasi.photosSesudah.length > 0
          ? realisasi.photosSesudah[0].fileUrl || realisasi.photosSesudah[0].dataUrl
          : '') ||
        '';

      setFotoSebelumUrl(initialFotoSebelum);
      setFotoSesudahUrl(initialFotoSesudah);

      setErrorMsg(null);
    }
  }, [realisasi, isOpen]);

  if (!isOpen || !realisasi) return null;

  // GPS Fetch Realtime
  const handleFetchGPS = () => {
    if (!('geolocation' in navigator)) {
      showToast('Perangkat tidak mendukung geolokasi GPS.', 'warning');
      return;
    }

    showToast('Mengambil titik koordinat GPS terkini...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        showToast('Titik koordinat berhasil diperbarui dari GPS.', 'success');
      },
      (err) => {
        showToast(`Gagal membaca GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Process and Watermark Photo Upload/Capture
  const handleProcessPhoto = async (
    file: File,
    type: 'sebelum' | 'sesudah'
  ) => {
    if (!file) return;

    setIsProcessingPhoto(true);
    showToast(`Memproses & menambahkan watermark pada foto ${type}...`, 'info');

    try {
      const latNum = parseFloat(latitude) || -0.9142;
      const lngNum = parseFloat(longitude) || 100.4631;
      const timestampStr = new Date().toLocaleString('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
      });

      // Generate watermark directly
      const watermarkedBase64 = await generateWatermarkedImage({
        imageFile: file,
        userName: petugasName || 'Petugas ROW',
        ulpName: ulpName || 'PLN ULP',
        nomorWO: nomorWO || '-',
        noTiang: noTiang || '-',
        latitude: latNum,
        longitude: lngNum,
        customTimestamp: timestampStr,
      });

      // Update state immediately
      if (type === 'sebelum') {
        setFotoSebelumUrl(watermarkedBase64);
      } else {
        setFotoSesudahUrl(watermarkedBase64);
      }

      showToast(`Foto ${type} berhasil diberi watermark!`, 'success');

      // Optional background upload to Google Drive if GAS URL is active
      const gasUrl = settings.gasWebAppUrl || localStorage.getItem('aphro_gas_url') || '';
      if (gasUrl && navigator.onLine) {
        GASApiService.uploadPhoto(gasUrl, {
          base64Data: watermarkedBase64,
          nomorWO: nomorWO || 'WO',
          reguName: reguName || 'REGU',
          photoType: type === 'sebelum' ? 'Sebelum' : 'Sesudah',
        })
          .then((uploadRes) => {
            if (uploadRes && uploadRes.status === 'success' && uploadRes.fileUrl) {
              if (type === 'sebelum') {
                setFotoSebelumUrl(uploadRes.fileUrl);
              } else {
                setFotoSesudahUrl(uploadRes.fileUrl);
              }
            }
          })
          .catch((e) => {
            console.warn('Background Google Drive upload note:', e);
          });
      }
    } catch (err: any) {
      showToast(`Gagal memproses foto: ${err?.message || 'Coba lagi.'}`, 'error');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

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
      const finalSebUrl = await ensureGoogleDrivePhotoUrl(fotoSebelumUrl.trim(), {
        nomorWO: nomorWO.trim(),
        reguName: reguName.trim(),
        photoType: 'Realisasi_Sebelum',
      });
      const finalSesUrl = await ensureGoogleDrivePhotoUrl(fotoSesudahUrl.trim(), {
        nomorWO: nomorWO.trim(),
        reguName: reguName.trim(),
        photoType: 'Realisasi_Sesudah',
      });

      const updatePayload = {
        tanggal: tanggal.trim(),
        tanggalRealisasi: tanggal.trim(),
        latitude: latNum,
        longitude: lngNum,
        nomorWO: nomorWO.trim(),
        Nomor_WO: nomorWO.trim(),
        workOrderId: workOrderId.trim() || nomorWO.trim(),
        WO_ID: workOrderId.trim() || nomorWO.trim(),
        woId: workOrderId.trim() || nomorWO.trim(),
        ulpName: ulpName.trim(),
        reguName: reguName.trim(),
        penyulangName: penyulangName.trim(),
        noTiang: noTiang.trim(),
        petugasName: petugasName.trim(),
        jenisTanaman: jenisTanaman.trim(),
        keterangan: keterangan.trim(),
        pertumbuhanTanaman: pertumbuhanTanaman.trim(),
        kendala: kendala.trim(),
        lokasiKerja: lokasiKerja.trim(),
        fotoSebelumUrl: finalSebUrl,
        fotoSesudahUrl: finalSesUrl,
      };

      const res = await updateRealisasiAdmin(realisasi.id, updatePayload);
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

  // Unique options for master dropdowns
  const availableUlps = Array.from(new Set(ulpList.map((u) => u.namaULP).filter(Boolean)));
  const availableRegus = Array.from(new Set(reguList.map((r) => r.namaRegu).filter(Boolean)));
  const availablePenyulangs = Array.from(new Set(penyulangList.map((p) => p.namaPenyulang).filter(Boolean)));

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl my-8 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/70 shrink-0">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display tracking-tight">
                  EDIT REALISASI
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                  {realisasi.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Edit seluruh inputan data Realisasi dan Foto Kegiatan Lapangan
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isProcessingPhoto}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content Body (Scrollable) */}
          <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
            {errorMsg && (
              <div className="flex items-start space-x-3 p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* SECTION 1: INFORMASI WORK ORDER & UNIT */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700/60 pb-2">
                <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Informasi Work Order & Unit</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Nomor WO */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    NOMOR WO <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nomorWO}
                    onChange={(e) => setNomorWO(e.target.value)}
                    placeholder="Contoh: M01/BKT/01/2026"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                {/* ULP */}
                <div ref={ulpDropdownRef} className="relative">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    ULP
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={ulpName}
                      onChange={(e) => {
                        setUlpName(e.target.value);
                        setIsUlpDropdownOpen(true);
                      }}
                      onFocus={() => setIsUlpDropdownOpen(true)}
                      placeholder="Pilih atau ketik ULP"
                      className="w-full px-3 py-2 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsUlpDropdownOpen(!isUlpDropdownOpen)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isUlpDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isUlpDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {availableUlps.filter(u => 
                          !ulpName || u.toLowerCase().includes(ulpName.toLowerCase())
                        ).length > 0 ? (
                          availableUlps
                            .filter(u => !ulpName || u.toLowerCase().includes(ulpName.toLowerCase()))
                            .map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => {
                                  setUlpName(u);
                                  setIsUlpDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                {u}
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 italic">
                            Ketik untuk menambahkan baru...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* REGU ROW */}
                <div ref={reguDropdownRef} className="relative">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    REGU ROW
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={reguName}
                      onChange={(e) => {
                        setReguName(e.target.value);
                        setIsReguDropdownOpen(true);
                      }}
                      onFocus={() => setIsReguDropdownOpen(true)}
                      placeholder="Pilih atau ketik Regu"
                      className="w-full px-3 py-2 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsReguDropdownOpen(!isReguDropdownOpen)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isReguDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isReguDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {availableRegus.filter(r => 
                          !reguName || r.toLowerCase().includes(reguName.toLowerCase())
                        ).length > 0 ? (
                          availableRegus
                            .filter(r => !reguName || r.toLowerCase().includes(reguName.toLowerCase()))
                            .map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  setReguName(r);
                                  setIsReguDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                {r}
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 italic">
                            Ketik untuk menambahkan baru...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* PENYULANG */}
                <div ref={pylDropdownRef} className="relative">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    PENYULANG
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={penyulangName}
                      onChange={(e) => {
                        setPenyulangName(e.target.value);
                        setIsPylDropdownOpen(true);
                      }}
                      onFocus={() => setIsPylDropdownOpen(true)}
                      placeholder="Pilih atau ketik Penyulang"
                      className="w-full px-3 py-2 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPylDropdownOpen(!isPylDropdownOpen)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isPylDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isPylDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {availablePenyulangs.filter(p => 
                          !penyulangName || p.toLowerCase().includes(penyulangName.toLowerCase())
                        ).length > 0 ? (
                          availablePenyulangs
                            .filter(p => !penyulangName || p.toLowerCase().includes(penyulangName.toLowerCase()))
                            .map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  setPenyulangName(p);
                                  setIsPylDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                {p}
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 italic">
                            Ketik untuk menambahkan baru...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: DETAIL EKSEKUSI & ATRIBUT PEKERJAAN */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700/60 pb-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Detail Eksekusi & Atribut Pekerjaan</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Tanggal Realisasi */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    TANGGAL REALISASI <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* No Tiang */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    NO TIANG / SPAN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={noTiang}
                    onChange={(e) => setNoTiang(e.target.value)}
                    placeholder="Contoh: T.12 / T.05"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Petugas ROW */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    PETUGAS ROW
                  </label>
                  <input
                    type="text"
                    value={petugasName}
                    onChange={(e) => setPetugasName(e.target.value)}
                    placeholder="Nama Petugas Lapangan"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Jenis Tanaman */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    JENIS TANAMAN
                  </label>
                  <input
                    type="text"
                    value={jenisTanaman}
                    onChange={(e) => setJenisTanaman(e.target.value)}
                    placeholder="Contoh: Kelapa Sawit, Bambu"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Keterangan */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    KETERANGAN
                  </label>
                  <select
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="TEBANG">TEBANG</option>
                    <option value="PANGKAS">PANGKAS</option>
                    <option value="POTONG">POTONG</option>
                    <option value="RAMBAS">RAMBAS</option>
                  </select>
                </div>

                {/* Pertumbuhan Tanaman */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    PERTUMBUHAN TANAMAN
                  </label>
                  <select
                    value={pertumbuhanTanaman}
                    onChange={(e) => setPertumbuhanTanaman(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="CEPAT">CEPAT</option>
                    <option value="SEDANG">SEDANG</option>
                    <option value="LAMBAT">LAMBAT</option>
                  </select>
                </div>

                {/* Kendala */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    KENDALA
                  </label>
                  <input
                    type="text"
                    value={kendala}
                    onChange={(e) => setKendala(e.target.value)}
                    placeholder="Contoh: Tidak Ada Kendala"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Lokasi Kerja */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    LOKASI KERJA
                  </label>
                  <input
                    type="text"
                    value={lokasiKerja}
                    onChange={(e) => setLokasiKerja(e.target.value)}
                    placeholder="Contoh: Depan Kantor ULP / Desa X"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: KOORDINAT LOKASI */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>Koordinat Lokasi (Latitude, Longitude)</span>
                </div>
                <button
                  type="button"
                  onClick={handleFetchGPS}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors shadow-2xs"
                >
                  <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Ambil GPS Terkini</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Latitude (-90 s/d 90) <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="-0.914200"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Longitude (-180 s/d 180) <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="100.463100"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/50 rounded-xl flex items-center space-x-2 text-[11px] text-teal-800 dark:text-teal-300">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <div>
                  <span className="font-bold">Format Database (`Latitude_Longitude`): </span>
                  <span className="font-mono font-black">{formattedLatLngPreview}</span>
                </div>
              </div>
            </div>

            {/* SECTION 4: DOKUMENTASI FOTO SEBELUM & SESUDAH */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700/60 pb-2">
                <ImageIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Dokumentasi Foto Realisasi</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* SLOT FOTO SEBELUM */}
                <div className="border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                    <div className="flex items-center space-x-2">
                      <Camera className="w-4 h-4" />
                      <span className="text-xs font-extrabold uppercase tracking-wide">
                        Foto Sebelum (Before)
                      </span>
                    </div>
                    {fotoSebelumUrl && (
                      <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md text-rose-800 dark:text-rose-300">
                        Tersedia
                      </span>
                    )}
                  </div>

                  {/* Foto Preview if present */}
                  {fotoSebelumUrl ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-video flex items-center justify-center">
                      <img
                        src={formatDriveImageUrl(fotoSebelumUrl)}
                        alt="Foto Sebelum"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewModalTitle(`Foto Sebelum - ${nomorWO || 'Realisasi'}`);
                            setPreviewModalUrl(fotoSebelumUrl);
                          }}
                          className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white shadow-lg transition-transform hover:scale-110"
                          title="Lihat Ukuran Penuh"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFotoSebelumUrl('')}
                          className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-lg transition-transform hover:scale-110"
                          title="Hapus Foto Sebelum"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-rose-200 dark:border-rose-800 rounded-xl p-4 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center min-h-[120px]">
                      <Camera className="w-8 h-8 text-rose-300 dark:text-rose-700 mb-1" />
                      <span>Belum ada Foto Sebelum</span>
                    </div>
                  )}

                  {/* Controls to replace/capture photo */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputSebelumRef.current?.click()}
                      disabled={isProcessingPhoto}
                      className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputSebelumRef.current?.click()}
                      disabled={isProcessingPhoto}
                      className="flex-1 py-2 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Galeri / File</span>
                    </button>
                  </div>

                  {/* URL Text Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      URL Foto / Link Drive (Sebelum):
                    </label>
                    <input
                      type="text"
                      value={fotoSebelumUrl}
                      onChange={(e) => setFotoSebelumUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-mono text-slate-700 dark:text-slate-300"
                    />
                  </div>

                  {/* Hidden Inputs */}
                  <input
                    ref={cameraInputSebelumRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessPhoto(e.target.files[0], 'sebelum');
                        e.target.value = '';
                      }
                    }}
                  />
                  <input
                    ref={fileInputSebelumRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessPhoto(e.target.files[0], 'sebelum');
                        e.target.value = '';
                      }
                    }}
                  />
                </div>

                {/* SLOT FOTO SESUDAH */}
                <div className="border border-teal-200 dark:border-teal-900/60 rounded-2xl p-4 bg-teal-50/30 dark:bg-teal-950/20 space-y-3">
                  <div className="flex items-center justify-between text-teal-700 dark:text-teal-400">
                    <div className="flex items-center space-x-2">
                      <Camera className="w-4 h-4" />
                      <span className="text-xs font-extrabold uppercase tracking-wide">
                        Foto Sesudah (After)
                      </span>
                    </div>
                    {fotoSesudahUrl && (
                      <span className="text-[10px] font-bold bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-md text-teal-800 dark:text-teal-300">
                        Tersedia
                      </span>
                    )}
                  </div>

                  {/* Foto Preview if present */}
                  {fotoSesudahUrl ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-video flex items-center justify-center">
                      <img
                        src={formatDriveImageUrl(fotoSesudahUrl)}
                        alt="Foto Sesudah"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewModalTitle(`Foto Sesudah - ${nomorWO || 'Realisasi'}`);
                            setPreviewModalUrl(fotoSesudahUrl);
                          }}
                          className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white shadow-lg transition-transform hover:scale-110"
                          title="Lihat Ukuran Penuh"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFotoSesudahUrl('')}
                          className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-lg transition-transform hover:scale-110"
                          title="Hapus Foto Sesudah"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-teal-200 dark:border-teal-800 rounded-xl p-4 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center min-h-[120px]">
                      <Camera className="w-8 h-8 text-teal-300 dark:text-teal-700 mb-1" />
                      <span>Belum ada Foto Sesudah</span>
                    </div>
                  )}

                  {/* Controls to replace/capture photo */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputSesudahRef.current?.click()}
                      disabled={isProcessingPhoto}
                      className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputSesudahRef.current?.click()}
                      disabled={isProcessingPhoto}
                      className="flex-1 py-2 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Galeri / File</span>
                    </button>
                  </div>

                  {/* URL Text Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      URL Foto / Link Drive (Sesudah):
                    </label>
                    <input
                      type="text"
                      value={fotoSesudahUrl}
                      onChange={(e) => setFotoSesudahUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-[11px] font-mono text-slate-700 dark:text-slate-300"
                    />
                  </div>

                  {/* Hidden Inputs */}
                  <input
                    ref={cameraInputSesudahRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessPhoto(e.target.files[0], 'sesudah');
                        e.target.value = '';
                      }
                    }}
                  />
                  <input
                    ref={fileInputSesudahRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessPhoto(e.target.files[0], 'sesudah');
                        e.target.value = '';
                      }
                    }}
                  />
                </div>

              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isProcessingPhoto}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isProcessingPhoto}
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

      {/* Image Preview Modal */}
      {previewModalUrl && (
        <ImagePreviewModal
          isOpen={!!previewModalUrl}
          onClose={() => setPreviewModalUrl(null)}
          imageUrl={previewModalUrl}
          title={previewModalTitle}
        />
      )}
    </>
  );
};
