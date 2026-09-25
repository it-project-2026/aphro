import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FilePlus2,
  Calendar,
  MapPin,
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
  AlertCircle,
  AlertTriangle,
  Save,
  Loader2,
  HelpCircle,
  Clock,
  Sparkles,
  Search,
  CheckSquare,
  ShieldCheck,
  Compass,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useMasterData } from '../context/MasterDataContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../hooks/useToast';
import { getWIBDateString, getLocalDateTimeString } from '../utils/dateUtils';
import { generateWatermarkedImage } from '../utils/watermark';
import { formatDriveImageUrl, ensureGoogleDrivePhotoUrl } from '../utils/driveUtils';
import { extractExifFromPhoto, ExifPhotoMetadata } from '../utils/exifReader';
import { GASApiService } from '../services/gasApiService';
import { RekapHarianService, UL_PRESETS, resolveUserTimRowAndUlp } from '../services/rekapHarianService';
import { InisiasiService, DEFAULT_UL_OPTIONS } from '../services/inisiasiService';
import { ImagePreviewModal } from '../components/common/ImagePreviewModal';
import { Realisasi } from '../types';

interface InputManualRealisasiAdminPageProps {
  onSuccess?: (savedRecord: Realisasi) => void;
  onCancel?: () => void;
}

export const InputManualRealisasiAdminPage: React.FC<InputManualRealisasiAdminPageProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user: currentUser } = useAuth();
  const { addManualRealisasiAdmin } = useRealisasi();
  const { users, ulpList, reguList, penyulangList } = useMasterData();
  const { workOrders, displayedWorkOrders } = useWorkOrders();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const userTimInfo = useMemo(() => {
    return resolveUserTimRowAndUlp(currentUser, settings.namaUnitLayanan, users, ulpList, reguList);
  }, [currentUser, settings.namaUnitLayanan, users, ulpList, reguList]);

  const isUserRole = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase();
    return r === 'user';
  }, [currentUser]);

  // Determine available WOs for selection dropdown (Role 'User' gets WOs matching their REGU ROW)
  const availableWorkOrders = useMemo(() => {
    if (!isUserRole) {
      return workOrders;
    }

    const reguTarget = (userTimInfo.reguName || currentUser?.reguName || '').toLowerCase().trim();
    const userTarget = (currentUser?.name || currentUser?.userName || '').toLowerCase().trim();
    const userNip = (currentUser?.nip || '').toLowerCase().trim();
    const userId = String(currentUser?.id || '').toLowerCase().trim();

    const filtered = workOrders.filter((wo) => {
      // 1. Direct ID/NIP/Username match on wo.petugasId
      if (
        wo.petugasId &&
        (String(wo.petugasId).toLowerCase() === userId ||
         String(wo.petugasId).toLowerCase() === userNip ||
         String(wo.petugasId).toLowerCase() === userTarget)
      ) {
        return true;
      }

      // 2. Direct reguId match
      if (currentUser?.reguId && wo.reguId && String(currentUser.reguId) === String(wo.reguId)) {
        return true;
      }

      // 3. Regu Name match
      const woRegu = (wo.reguName || '').toLowerCase().trim();
      if (reguTarget && woRegu && (woRegu.includes(reguTarget) || reguTarget.includes(woRegu))) {
        return true;
      }

      // 4. Petugas Name match
      const woPetugas = (wo.petugasName || '').toLowerCase().trim();
      if (userTarget && woPetugas && (woPetugas.includes(userTarget) || userTarget.includes(woPetugas))) {
        return true;
      }

      return false;
    });

    if (filtered.length === 0 && displayedWorkOrders && displayedWorkOrders.length > 0) {
      return displayedWorkOrders;
    }

    return filtered;
  }, [isUserRole, workOrders, displayedWorkOrders, currentUser, userTimInfo]);

  // Role & Unit Authorization Check
  const isSuperAdmin = useMemo(() => {
    if (!currentUser) return true;
    const roleUpper = (currentUser.role || '').toUpperCase();
    const uName = (currentUser.userName || currentUser.name || '').toLowerCase();
    return (
      roleUpper === 'SUPERADMIN' ||
      roleUpper === 'SUPER_ADMIN' ||
      roleUpper === 'SUPER ADMIN' ||
      uName.includes('admbkt') ||
      currentUser.unitId === 'ALL'
    );
  }, [currentUser]);

  // Determine allowed units
  const allowedUnits = useMemo(() => {
    if (isSuperAdmin) {
      return DEFAULT_UL_OPTIONS.map((opt) => ({
        id: opt.id,
        nama: opt.namaUL,
        kode: opt.kodeUL,
      }));
    }

    const userUnitRaw = currentUser?.unitId || settings.namaUnitLayanan || 'UL1';
    const stdUnitId = InisiasiService.getStandardUnitId(userUnitRaw) || 'UL1';
    const matchedOpt = DEFAULT_UL_OPTIONS.find((o) => o.id === stdUnitId);
    return [
      {
        id: matchedOpt?.id || stdUnitId,
        nama: matchedOpt?.namaUL || `Unit Layanan (${stdUnitId})`,
        kode: matchedOpt?.kodeUL || stdUnitId,
      },
    ];
  }, [isSuperAdmin, currentUser, settings.namaUnitLayanan]);

  // 1. Identitas & Unit State
  const [unitId, setUnitId] = useState<string>(() => {
    if (isSuperAdmin) {
      return (
        InisiasiService.getStandardUnitId(settings.namaUnitLayanan || '') ||
        currentUser?.unitId ||
        'UL1'
      );
    }
    return InisiasiService.getStandardUnitId(currentUser?.unitId || settings.namaUnitLayanan || '') || 'UL1';
  });

  const [selectedWoPickerId, setSelectedWoPickerId] = useState<string>('');
  const [woId, setWoId] = useState<string>('');
  const [nomorWO, setNomorWO] = useState<string>('');
  const [customId, setCustomId] = useState<string>('');

  // 2. Unit & Jaringan
  const [ulpName, setUlpName] = useState<string>('');
  const [reguName, setReguName] = useState<string>('');
  const [penyulangName, setPenyulangName] = useState<string>('');

  // 3. Pekerjaan & Vegetasi
  const [noTiang, setNoTiang] = useState<string>('');
  const [tanggalRealisasi, setTanggalRealisasi] = useState<string>(getWIBDateString());
  const [petugasName, setPetugasName] = useState<string>(
    currentUser?.name || currentUser?.userName || 'Petugas Lapangan'
  );
  const [jenisTanaman, setJenisTanaman] = useState<string>('Kelapa Sawit');
  const [keterangan, setKeterangan] = useState<string>('TEBANG');
  const [pertumbuhanTanaman, setPertumbuhanTanaman] = useState<string>('CEPAT');
  const [kendala, setKendala] = useState<string>('Tidak Ada Kendala');
  const [lokasiKerja, setLokasiKerja] = useState<string>('');

  // 4. Lokasi & GPS
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  // 5. Foto & EXIF Metadata State
  const [fotoSebelumUrl, setFotoSebelumUrl] = useState<string>('');
  const [fotoSesudahUrl, setFotoSesudahUrl] = useState<string>('');
  const [exifSebelum, setExifSebelum] = useState<ExifPhotoMetadata | null>(null);
  const [exifSesudah, setExifSesudah] = useState<ExifPhotoMetadata | null>(null);

  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview Modal State
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [previewModalTitle, setPreviewModalTitle] = useState<string>('Pratinjau Foto');

  // Hidden File Input Refs
  const fileSebelumRef = useRef<HTMLInputElement>(null);
  const fileSesudahRef = useRef<HTMLInputElement>(null);
  const cameraSebelumRef = useRef<HTMLInputElement>(null);
  const cameraSesudahRef = useRef<HTMLInputElement>(null);

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

  // Auto-fill defaults when unit or user changes
  useEffect(() => {
    if (isUserRole && userTimInfo.reguName) {
      if (!reguName) setReguName(userTimInfo.reguName);
      if (!ulpName && userTimInfo.ulpName) setUlpName(userTimInfo.ulpName);
    } else if (unitId) {
      const matchedUnit = DEFAULT_UL_OPTIONS.find((u) => u.id === unitId);
      const presetKey = matchedUnit?.kodeUL === 'BKT' ? 'BUKITTINGGI' : matchedUnit?.kodeUL === 'PDG' ? 'PADANG' : matchedUnit?.kodeUL === 'SLK' ? 'SOLOK' : matchedUnit?.kodeUL === 'PYK' ? 'PAYAKUMBUH' : '';
      const preset = presetKey ? UL_PRESETS[presetKey] : undefined;
      if (preset && preset.rows && preset.rows.length > 0) {
        if (!ulpName) setUlpName(userTimInfo.ulpName || preset.rows[0].namaUlp || '');
        if (!reguName) setReguName(userTimInfo.reguName || preset.rows[0].timRow || '');
      }
    }
  }, [unitId, isUserRole, userTimInfo]);

  // Handle Work Order selection from list (Populates fields without locking them)
  const handleSelectWorkOrder = (selectedId: string) => {
    setSelectedWoPickerId(selectedId);
    if (!selectedId) return;

    const matchedWO =
      availableWorkOrders.find((w) => w.id === selectedId || w.nomorWO === selectedId) ||
      workOrders.find((w) => w.id === selectedId || w.nomorWO === selectedId) ||
      displayedWorkOrders.find((w) => w.id === selectedId || w.nomorWO === selectedId);

    if (matchedWO) {
      setWoId(matchedWO.id || '');
      setNomorWO(matchedWO.nomorWO || '');
      if (matchedWO.ulpName) setUlpName(matchedWO.ulpName);
      if (matchedWO.reguName) setReguName(matchedWO.reguName);
      if (matchedWO.penyulangName) setPenyulangName(matchedWO.penyulangName);
      if (matchedWO.lokasi) setLokasiKerja(matchedWO.lokasi);
      if (matchedWO.latitude) setLatitude(String(matchedWO.latitude));
      if (matchedWO.longitude) setLongitude(String(matchedWO.longitude));
      if (matchedWO.petugasName) setPetugasName(matchedWO.petugasName);

      showToast(`Data terisi dari Work Order ${matchedWO.nomorWO}. Semua field tetap dapat diedit.`, 'info');
    }
  };

  // GPS Device Realtime
  const handleFetchDeviceGPS = () => {
    if (!('geolocation' in navigator)) {
      showToast('Perangkat tidak mendukung GPS Geolocation.', 'warning');
      return;
    }

    showToast('Mengambil titik GPS perangkat saat ini...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        showToast('Titik koordinat GPS berhasil diterapkan.', 'success');
      },
      (err) => {
        showToast(`Gagal membaca GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Process and Watermark Photo with Client-Side EXIF Metadata Extraction
  const handlePhotoSelected = async (
    file: File,
    type: 'sebelum' | 'sesudah'
  ) => {
    if (!file) return;

    setIsProcessingPhoto(true);
    setErrorMessage(null);
    showToast(`Membaca metadata EXIF & memproses foto ${type}...`, 'info');

    try {
      // 1. CRITICAL: Read EXIF metadata directly from original raw file BEFORE any canvas compression / watermarking!
      const exifResult = await extractExifFromPhoto(file);

      if (type === 'sebelum') {
        setExifSebelum(exifResult);
      } else {
        setExifSesudah(exifResult);
      }

      // 2. Auto-detect and suggest values into form without locking
      if (exifResult.dateDetected && exifResult.dateISO) {
        setTanggalRealisasi(exifResult.dateISO);
      }

      if (exifResult.gpsDetected && exifResult.latitude !== undefined && exifResult.longitude !== undefined) {
        setLatitude(String(exifResult.latitude));
        setLongitude(String(exifResult.longitude));
      }

      // 3. Resolve coordinate and timestamp for the watermark stamp
      const finalLat =
        exifResult.latitude !== undefined
          ? exifResult.latitude
          : parseFloat(latitude) || -0.9142;
      const finalLng =
        exifResult.longitude !== undefined
          ? exifResult.longitude
          : parseFloat(longitude) || 100.4631;

      const timestampStr = exifResult.dateISO
        ? `${exifResult.dateISO} ${exifResult.timeStr || '12:00:00'}`
        : getLocalDateTimeString();

      // 4. Burn watermark into image
      const watermarkedBase64 = await generateWatermarkedImage({
        imageFile: file,
        userName: petugasName || currentUser?.name || 'Petugas ROW',
        ulpName: ulpName || 'PLN ULP',
        nomorWO: nomorWO || '-',
        noTiang: noTiang || '-',
        latitude: finalLat,
        longitude: finalLng,
        customTimestamp: timestampStr,
      });

      if (type === 'sebelum') {
        setFotoSebelumUrl(watermarkedBase64);
      } else {
        setFotoSesudahUrl(watermarkedBase64);
      }

      showToast(
        `Foto ${type} berhasil diproses! ${
          exifResult.hasExif
            ? `(EXIF: ${exifResult.dateDetected ? 'Tanggal ✓' : ''} ${exifResult.gpsDetected ? 'GPS ✓' : ''})`
            : '(Tanpa EXIF)'
        }`,
        'success'
      );

      // 5. Background sync to Google Drive if GAS is configured
      const gasUrl = settings.gasWebAppUrl || localStorage.getItem('aphro_gas_url') || '';
      if (gasUrl && navigator.onLine) {
        GASApiService.uploadPhoto(gasUrl, {
          base64Data: watermarkedBase64,
          nomorWO: nomorWO || 'WO-MANUAL',
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
      console.error('Error processing photo:', err);
      showToast(`Gagal memproses foto: ${err?.message || 'Format tidak didukung.'}`, 'error');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation: Unit
    if (!unitId || !unitId.trim()) {
      setErrorMessage('Unit Layanan wajib dipilih.');
      return;
    }

    // 2. Validation: Nomor WO
    if (!nomorWO || !nomorWO.trim()) {
      setErrorMessage('Nomor WO wajib diisi.');
      return;
    }

    // 3. Validation: Tanggal
    if (!tanggalRealisasi || !tanggalRealisasi.trim()) {
      setErrorMessage('Tanggal Realisasi wajib diisi.');
      return;
    }

    // 4. Validation: No Tiang
    if (!noTiang || !noTiang.trim()) {
      setErrorMessage('No Tiang / Span pekerjaan wajib diisi.');
      return;
    }

    // 5. Validation: Latitude
    const latNum = parseFloat(latitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setErrorMessage('Latitude harus berupa angka valid antara -90 dan 90.');
      return;
    }

    // 6. Validation: Longitude
    const lngNum = parseFloat(longitude);
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setErrorMessage('Longitude harus berupa angka valid antara -180 dan 180.');
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedId = customId.trim() || `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

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

      const payload = {
        id: generatedId,
        ID: generatedId,
        unitId: unitId.trim(),
        workOrderId: (woId || nomorWO).trim(),
        WO_ID: (woId || nomorWO).trim(),
        woId: (woId || nomorWO).trim(),
        nomorWO: nomorWO.trim(),
        Nomor_WO: nomorWO.trim(),
        ulpName: ulpName.trim(),
        reguName: reguName.trim(),
        penyulangName: penyulangName.trim(),
        noTiang: noTiang.trim(),
        tanggalRealisasi: tanggalRealisasi.trim(),
        petugasId: (currentUser?.userName || 'Admin').trim(),
        petugasName: (petugasName || currentUser?.name || 'Admin').trim(),
        jenisTanaman: jenisTanaman.trim(),
        keterangan: keterangan.trim(),
        pertumbuhanTanaman: pertumbuhanTanaman.trim(),
        kendala: kendala.trim(),
        lokasiKerja: lokasiKerja.trim(),
        latitude: latNum,
        longitude: lngNum,
        fotoSebelumUrl: finalSebUrl,
        fotoSesudahUrl: finalSesUrl,
        photosSebelum: fotoSebelumUrl
          ? [
              {
                id: `seb-${generatedId}`,
                type: 'sebelum' as const,
                slotIndex: 1 as const,
                dataUrl: fotoSebelumUrl,
                fileUrl: fotoSebelumUrl.startsWith('http') ? fotoSebelumUrl : undefined,
                originalName: `Foto_Sebelum_${nomorWO}.jpg`,
                timestamp: getLocalDateTimeString(),
                latitude: latNum,
                longitude: lngNum,
                userName: petugasName,
                ulpName: ulpName,
              },
            ]
          : [],
        photosSesudah: fotoSesudahUrl
          ? [
              {
                id: `ses-${generatedId}`,
                type: 'sesudah' as const,
                slotIndex: 1 as const,
                dataUrl: fotoSesudahUrl,
                fileUrl: fotoSesudahUrl.startsWith('http') ? fotoSesudahUrl : undefined,
                originalName: `Foto_Sesudah_${nomorWO}.jpg`,
                timestamp: getLocalDateTimeString(),
                latitude: latNum,
                longitude: lngNum,
                userName: petugasName,
                ulpName: ulpName,
              },
            ]
          : [],
      };

      const result = await addManualRealisasiAdmin(payload);

      if (result.success && result.data) {
        if (onSuccess) {
          onSuccess(result.data);
        }
      } else {
        setErrorMessage(result.error || 'Gagal menyimpan Realisasi Manual.');
      }
    } catch (err: any) {
      console.error('Submit Realisasi Manual error:', err);
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menyimpan data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedLatLngPreview = `${latitude.trim() || '0'}, ${longitude.trim() || '0'}`;

  // Unique suggestions from master data
  const availableUlps = Array.from(new Set(ulpList.map((u) => u.namaULP).filter(Boolean)));
  const availableRegus = Array.from(new Set(reguList.map((r) => r.namaRegu).filter(Boolean)));
  const availablePenyulangs = Array.from(new Set(penyulangList.map((p) => p.namaPenyulang).filter(Boolean)));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Page Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-teal-700/50">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-black tracking-wide border border-teal-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>INPUT MANUAL & EDITABLE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Input Manual Realisasi
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/80 max-w-2xl leading-relaxed">
              Formulir input administratif langsung ke database. Seluruh field terbuka penuh dan dapat diedit secara manual. Mendukung deteksi otomatis tanggal dan titik koordinat GPS dari metadata EXIF foto.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting || isProcessingPhoto}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                Batal / Kembali
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
        
        {/* Error Alert Box */}
        {errorMessage && (
          <div className="m-6 flex items-start space-x-3 p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-medium animate-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Gagal Menyimpan:</span>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-8">
          
          {/* SECTION 1: UNIT & IDENTITAS REALISASI */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center space-x-2.5 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base font-display">
                <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span>1. Unit Layanan & Identitas Realisasi</span>
              </div>
              <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800/60">
                100% Manual & Editable
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Unit Selector */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  UNIT LAYANAN (unitId) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                >
                  {allowedUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id} - {u.nama}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isSuperAdmin ? 'Super Admin: Bebas pilih UL1/UL2/UL3/UL4' : `Terkunci sesuai otorisasi Unit (${unitId})`}
                </p>
              </div>

              {/* Work Order Picker (Quick-Fill Helper) */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  PILIH DARI WO <span className="text-slate-400 font-normal">(OPSIONAL)</span>
                </label>
                <select
                  value={selectedWoPickerId}
                  onChange={(e) => handleSelectWorkOrder(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">
                    {isUserRole
                      ? `-- Pilih WO REGU ${userTimInfo.reguName || currentUser?.reguName || 'ROW'} --`
                      : '-- Ketik Manual atau Pilih WO --'}
                  </option>
                  {availableWorkOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.nomorWO} ({wo.penyulangName || wo.ulpName || 'WO'}) - {wo.reguName || 'Regu ROW'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isUserRole
                    ? `Menampilkan Work Order khusus REGU ROW (${userTimInfo.reguName || currentUser?.reguName || 'Petugas'}). Mengisi form otomatis tanpa mengunci field.`
                    : 'Mengisi form otomatis tanpa mengunci field.'}
                </p>
              </div>

              {/* Nomor WO (Manual Input) */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  NOMOR WO <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nomorWO}
                  onChange={(e) => setNomorWO(e.target.value)}
                  placeholder="Contoh: M01/BKT/01/2026 atau NOMOR-MANUAL-TEST"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Nilai disimpan persis tanpa tebakan otomatis.
                </p>
              </div>

              {/* WO ID / ID Realisasi Custom */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  ID REALISASI <span className="text-slate-400 font-normal">(AUTO / CUSTOM)</span>
                </label>
                <input
                  type="text"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  placeholder="Kosongkan untuk auto-generate ID"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-teal-500"
                />
              </div>

            </div>

            {/* Sub-grid: ULP, Regu, Penyulang */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              
              {/* ULP */}
              <div ref={ulpDropdownRef} className="relative">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
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
                    placeholder="Contoh: ULP BUKITTINGGI"
                    className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsUlpDropdownOpen(!isUlpDropdownOpen)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
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
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
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

              {/* Regu ROW */}
              <div ref={reguDropdownRef} className="relative">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
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
                    placeholder="Contoh: TIM ROW 1"
                    className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsReguDropdownOpen(!isReguDropdownOpen)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
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
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
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

              {/* Penyulang */}
              <div ref={pylDropdownRef} className="relative">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
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
                    placeholder="Contoh: BATANG ANAI / BASO"
                    className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPylDropdownOpen(!isPylDropdownOpen)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
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
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
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

          {/* SECTION 2: DETAIL EKSEKUSI & VEGETASI */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-100 dark:border-slate-700 pb-3 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base font-display">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>2. Detail Eksekusi & Atribut Pekerjaan</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Tanggal Realisasi */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  TANGGAL REALISASI <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={tanggalRealisasi}
                    onChange={(e) => setTanggalRealisasi(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Bebas diisi tanggal historis kapanpun.
                </p>
              </div>

              {/* No Tiang */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  NO TIANG / SPAN <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={noTiang}
                  onChange={(e) => setNoTiang(e.target.value)}
                  placeholder="Contoh: T.12 / T.05 - T.06"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Petugas ROW */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  PETUGAS ROW
                </label>
                <input
                  type="text"
                  value={petugasName}
                  onChange={(e) => setPetugasName(e.target.value)}
                  placeholder="Nama Petugas Lapangan"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Jenis Tanaman */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  JENIS TANAMAN
                </label>
                <input
                  type="text"
                  value={jenisTanaman}
                  onChange={(e) => setJenisTanaman(e.target.value)}
                  placeholder="Contoh: Kelapa Sawit, Bambu, Mahoni"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Keterangan */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  KETERANGAN (TINDAKAN)
                </label>
                <select
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="TEBANG">TEBANG</option>
                  <option value="PANGKAS">PANGKAS</option>
                  <option value="POTONG">POTONG</option>
                  <option value="RAMBAS">RAMBAS</option>
                </select>
              </div>

              {/* Pertumbuhan Tanaman */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  PERTUMBUHAN TANAMAN
                </label>
                <select
                  value={pertumbuhanTanaman}
                  onChange={(e) => setPertumbuhanTanaman(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="CEPAT">CEPAT</option>
                  <option value="SEDANG">SEDANG</option>
                  <option value="LAMBAT">LAMBAT</option>
                </select>
              </div>

              {/* Kendala */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  KENDALA
                </label>
                <input
                  type="text"
                  value={kendala}
                  onChange={(e) => setKendala(e.target.value)}
                  placeholder="Contoh: Tidak Ada Kendala / Tanam Tumbuh"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Lokasi Kerja */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  LOKASI KERJA
                </label>
                <input
                  type="text"
                  value={lokasiKerja}
                  onChange={(e) => setLokasiKerja(e.target.value)}
                  placeholder="Contoh: Jl. Raya Baso Km 12"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

            </div>
          </div>

          {/* SECTION 3: KOORDINAT LOKASI & GPS */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 gap-2">
              <div className="flex items-center space-x-2.5 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base font-display">
                <MapPin className="w-5 h-5 text-rose-500" />
                <span>3. Titik Koordinat Lokasi (Latitude, Longitude)</span>
              </div>
              <button
                type="button"
                onClick={handleFetchDeviceGPS}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-all shadow-2xs cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Ambil GPS Perangkat Saat Ini</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  LATITUDE (-90 s/d 90) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-0.914200"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  LONGITUDE (-180 s/d 180) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="100.463100"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Database Format Preview */}
            <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/50 rounded-2xl flex items-center space-x-3 text-xs text-teal-800 dark:text-teal-300">
              <Compass className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <div>
                <span className="font-bold">Format Kolom Database (`Latitude_Longitude`): </span>
                <span className="font-mono font-black">{formattedLatLngPreview}</span>
              </div>
            </div>
          </div>

          {/* SECTION 4: DOKUMENTASI FOTO DENGAN DETEKSI EXIF */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 gap-2">
              <div className="flex items-center space-x-2.5 text-slate-900 dark:text-white font-extrabold text-sm sm:text-base font-display">
                <ImageIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span>4. Dokumentasi Foto Lapangan & Deteksi EXIF</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/40">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Otomatis ekstrak Tanggal & GPS Foto</span>
              </div>
            </div>

            {/* EXIF Comparison Notification if both photos provide different metadata */}
            {exifSebelum && exifSesudah && (exifSebelum.hasExif || exifSesudah.hasExif) && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-xs">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500" />
                  <span>Metadata EXIF Terdeteksi dari Foto:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  
                  {/* Metadata Sebelum */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 text-[11px] block">
                      FOTO SEBELUM:
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      📅 Tanggal: {exifSebelum.formattedDate || exifSebelum.dateISO || 'Tidak tersedia'}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                      📍 GPS: {exifSebelum.formattedGps || 'Tidak tersedia'}
                    </p>
                    {exifSebelum.gpsDetected && (
                      <button
                        type="button"
                        onClick={() => {
                          if (exifSebelum.latitude && exifSebelum.longitude) {
                            setLatitude(String(exifSebelum.latitude));
                            setLongitude(String(exifSebelum.longitude));
                            showToast('Titik GPS Foto Sebelum diterapkan.', 'info');
                          }
                        }}
                        className="mt-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-[10px] font-bold hover:bg-rose-100"
                      >
                        Gunakan GPS Foto Sebelum
                      </button>
                    )}
                  </div>

                  {/* Metadata Sesudah */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="font-extrabold text-teal-600 dark:text-teal-400 text-[11px] block">
                      FOTO SESUDAH:
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      📅 Tanggal: {exifSesudah.formattedDate || exifSesudah.dateISO || 'Tidak tersedia'}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                      📍 GPS: {exifSesudah.formattedGps || 'Tidak tersedia'}
                    </p>
                    {exifSesudah.gpsDetected && (
                      <button
                        type="button"
                        onClick={() => {
                          if (exifSesudah.latitude && exifSesudah.longitude) {
                            setLatitude(String(exifSesudah.latitude));
                            setLongitude(String(exifSesudah.longitude));
                            showToast('Titik GPS Foto Sesudah diterapkan.', 'info');
                          }
                        }}
                        className="mt-1 px-2.5 py-1 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg text-[10px] font-bold hover:bg-teal-100"
                      >
                        Gunakan GPS Foto Sesudah
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SLOT FOTO SEBELUM */}
              <div className="border border-rose-200 dark:border-rose-900/60 rounded-3xl p-5 bg-rose-50/30 dark:bg-rose-950/20 space-y-4">
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-4 h-4" />
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Foto Sebelum (Before)
                    </span>
                  </div>
                  {fotoSebelumUrl && (
                    <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/60 px-2.5 py-0.5 rounded-full text-rose-800 dark:text-rose-300">
                      Foto Terpilih
                    </span>
                  )}
                </div>

                {/* Preview Thumbnail */}
                {fotoSebelumUrl ? (
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-video flex items-center justify-center shadow-inner">
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
                        className="p-2.5 bg-white/90 text-slate-800 rounded-full hover:bg-white shadow-lg transition-transform hover:scale-110"
                        title="Lihat Ukuran Penuh"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFotoSebelumUrl('');
                          setExifSebelum(null);
                        }}
                        className="p-2.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-lg transition-transform hover:scale-110"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-rose-200 dark:border-rose-800/80 rounded-2xl p-6 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center min-h-[140px]">
                    <Camera className="w-10 h-10 text-rose-300 dark:text-rose-700/60 mb-2" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Pilih Foto Sebelum</span>
                    <span className="text-[11px] text-slate-400">Kamera atau Galeri Foto Lapangan</span>
                  </div>
                )}

                {/* EXIF Feedback Badge for Foto Sebelum */}
                {exifSebelum && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                    {exifSebelum.dateDetected ? (
                      <p className="text-teal-700 dark:text-teal-300 font-medium flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                        <span>Tanggal terdeteksi EXIF: <b>{exifSebelum.formattedDate || exifSebelum.dateISO}</b></span>
                      </p>
                    ) : (
                      <p className="text-slate-400 flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Metadata tanggal tidak tersedia pada foto</span>
                      </p>
                    )}

                    {exifSebelum.gpsDetected ? (
                      <p className="text-teal-700 dark:text-teal-300 font-medium flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                        <span>GPS terdeteksi EXIF: <b className="font-mono">{exifSebelum.formattedGps}</b></span>
                      </p>
                    ) : (
                      <p className="text-slate-400 flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>GPS tidak tersedia pada foto</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Upload & Camera Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => cameraSebelumRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileSebelumRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Pilih Galeri</span>
                  </button>
                </div>

                {/* Direct URL Input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Link / URL Foto Sebelum (Manual / Drive):
                  </label>
                  <input
                    type="text"
                    value={fotoSebelumUrl}
                    onChange={(e) => setFotoSebelumUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={cameraSebelumRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoSelected(e.target.files[0], 'sebelum');
                      e.target.value = '';
                    }
                  }}
                />
                <input
                  ref={fileSebelumRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoSelected(e.target.files[0], 'sebelum');
                      e.target.value = '';
                    }
                  }}
                />
              </div>

              {/* SLOT FOTO SESUDAH */}
              <div className="border border-teal-200 dark:border-teal-900/60 rounded-3xl p-5 bg-teal-50/30 dark:bg-teal-950/20 space-y-4">
                <div className="flex items-center justify-between text-teal-700 dark:text-teal-400">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-4 h-4" />
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      Foto Sesudah (After)
                    </span>
                  </div>
                  {fotoSesudahUrl && (
                    <span className="text-[10px] font-bold bg-teal-100 dark:bg-teal-900/60 px-2.5 py-0.5 rounded-full text-teal-800 dark:text-teal-300">
                      Foto Terpilih
                    </span>
                  )}
                </div>

                {/* Preview Thumbnail */}
                {fotoSesudahUrl ? (
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-video flex items-center justify-center shadow-inner">
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
                        className="p-2.5 bg-white/90 text-slate-800 rounded-full hover:bg-white shadow-lg transition-transform hover:scale-110"
                        title="Lihat Ukuran Penuh"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFotoSesudahUrl('');
                          setExifSesudah(null);
                        }}
                        className="p-2.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-lg transition-transform hover:scale-110"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-teal-200 dark:border-teal-800/80 rounded-2xl p-6 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center min-h-[140px]">
                    <Camera className="w-10 h-10 text-teal-300 dark:text-teal-700/60 mb-2" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Pilih Foto Sesudah</span>
                    <span className="text-[11px] text-slate-400">Kamera atau Galeri Foto Lapangan</span>
                  </div>
                )}

                {/* EXIF Feedback Badge for Foto Sesudah */}
                {exifSesudah && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                    {exifSesudah.dateDetected ? (
                      <p className="text-teal-700 dark:text-teal-300 font-medium flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                        <span>Tanggal terdeteksi EXIF: <b>{exifSesudah.formattedDate || exifSesudah.dateISO}</b></span>
                      </p>
                    ) : (
                      <p className="text-slate-400 flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Metadata tanggal tidak tersedia pada foto</span>
                      </p>
                    )}

                    {exifSesudah.gpsDetected ? (
                      <p className="text-teal-700 dark:text-teal-300 font-medium flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                        <span>GPS terdeteksi EXIF: <b className="font-mono">{exifSesudah.formattedGps}</b></span>
                      </p>
                    ) : (
                      <p className="text-slate-400 flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>GPS tidak tersedia pada foto</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Upload & Camera Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => cameraSesudahRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileSesudahRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Pilih Galeri</span>
                  </button>
                </div>

                {/* Direct URL Input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Link / URL Foto Sesudah (Manual / Drive):
                  </label>
                  <input
                    type="text"
                    value={fotoSesudahUrl}
                    onChange={(e) => setFotoSesudahUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={cameraSesudahRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoSelected(e.target.files[0], 'sesudah');
                      e.target.value = '';
                    }
                  }}
                />
                <input
                  ref={fileSesudahRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoSelected(e.target.files[0], 'sesudah');
                      e.target.value = '';
                    }
                  }}
                />
              </div>

            </div>
          </div>

        </div>

        {/* Form Action Footer */}
        <div className="px-6 sm:px-8 py-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Data akan langsung disimpan ke Supabase Database (`public.REALISASI`).</span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting || isProcessingPhoto}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isProcessingPhoto}
              className="px-7 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-lg hover:shadow-xl transition-all flex items-center space-x-2.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Database...</span>
                </>
              ) : isProcessingPhoto ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Foto...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>SIMPAN REALISASI MANUAL</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>

      {/* Fullscreen Photo Preview Modal */}
      {previewModalUrl && (
        <ImagePreviewModal
          isOpen={!!previewModalUrl}
          onClose={() => setPreviewModalUrl(null)}
          imageUrl={previewModalUrl}
          title={previewModalTitle}
        />
      )}

    </div>
  );
};
