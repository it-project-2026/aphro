import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { WatermarkedPhoto, WOStatus } from '../types';
import { generateWatermarkedImage } from '../utils/watermark';
import { GASApiService } from '../services/gasApiService';
import { formatDriveViewUrl } from '../utils/driveUtils';
import {
  Camera,
  Upload,
  MapPin,
  Save,
  CheckCircle2,
  Navigation,
  Trash2,
  Eye,
  X,
  FileCheck2,
  Image as ImageIcon,
} from 'lucide-react';

export const InputRealisasiPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { workOrders } = useWorkOrders();
  const { addRealisasi } = useRealisasi();
  const { settings } = useSettings();
  const { setActiveTab, selectedWoIdForRealisasi, setSelectedWoIdForRealisasi } = useUI();
  const { showToast } = useToast();

  // Filter Work Orders for the current user's regu, unless admin
  const availableWorkOrders = workOrders
    .filter((wo) => {
      if (currentUser?.role !== 'User') return true;
      if (!currentUser) return false;
      
      const matchReguId = wo.reguId && currentUser.reguId && wo.reguId === currentUser.reguId;
      let matchReguName = false;
      if (wo.reguName && currentUser.reguName) {
        const woName = (wo.reguName || '').toLowerCase().trim();
        const uName = (currentUser.reguName || '').toLowerCase().trim();
        matchReguName = woName === uName || uName.includes(woName) || woName.includes(uName);
      }

      let matchPetugas = false;
      if (wo.petugasName && currentUser.name) {
        const pName = (wo.petugasName || '').toLowerCase().trim();
        const uName = (currentUser.name || '').toLowerCase().trim();
        matchPetugas = pName === uName || pName.includes(uName) || uName.includes(pName);
      }

      const matchPetugasId = wo.petugasId && currentUser.id && wo.petugasId === currentUser.id;
      const matchUlp = wo.ulpId === currentUser.ulpId || (wo.ulpName && currentUser.ulpName && (wo.ulpName || '').toLowerCase().trim() === (currentUser.ulpName || '').toLowerCase().trim());

      return matchReguId || matchReguName || matchPetugas || matchPetugasId || matchUlp;
    })
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.tanggal).getTime();
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.tanggal).getTime();
      return dateB - dateA;
    });

  const [selectedWoId, setSelectedWoId] = useState<string>(() => {
    if (selectedWoIdForRealisasi) return selectedWoIdForRealisasi;
    const defaultWo = availableWorkOrders.find((w) => w.status !== 'Selesai') || availableWorkOrders[0];
    return defaultWo?.id || '';
  });

  const selectedWO = availableWorkOrders.find((w) => w.id === selectedWoId);

  const [tanggalRealisasi, setTanggalRealisasi] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [petugasName, setPetugasName] = useState(currentUser?.name || 'Rahmat Hidayat');
  const [latitude, setLatitude] = useState(-0.9142);
  const [longitude, setLongitude] = useState(100.4631);
  const [keterangan, setKeterangan] = useState('TEBANG');
  const [noTiang, setNoTiang] = useState('');
  const [jenisTanaman, setJenisTanaman] = useState('Kelapa Sawit');
  const [pertumbuhanTanaman, setPertumbuhanTanaman] = useState('CEPAT');
  const [kendala, setKendala] = useState('Tidak Ada Kendala');

  // Handle direct selection from external tabs or after Spreadsheet sync
  // When work orders change (e.g. loaded asynchronously), ensure selectedWoId is valid
  useEffect(() => {
    if (availableWorkOrders.length === 0) return;

    if (selectedWoIdForRealisasi) {
      const wo = availableWorkOrders.find((w) => w.id === selectedWoIdForRealisasi);
      if (wo) {
        setSelectedWoId(wo.id);
        setLatitude(wo.latitude || latitude);
        setLongitude(wo.longitude || longitude);
        setSelectedWoIdForRealisasi(null);
        return;
      }
    }

    const exists = availableWorkOrders.some((w) => w.id === selectedWoId);
    if (!selectedWoId || !exists) {
      const defaultWo = availableWorkOrders.find((w) => w.status !== 'Selesai') || availableWorkOrders[0];
      if (defaultWo) {
        setSelectedWoId(defaultWo.id);
        if (defaultWo.latitude) setLatitude(defaultWo.latitude);
        if (defaultWo.longitude) setLongitude(defaultWo.longitude);
      }
    }
  }, [availableWorkOrders.length, selectedWoIdForRealisasi]);

  // Sync WO details when selectedWO changes
  useEffect(() => {
    if (selectedWO) {
      setLatitude(selectedWO.latitude);
      setLongitude(selectedWO.longitude);
    }
  }, [selectedWoId]);

  // Photo slots
  const [photosSebelum, setPhotosSebelum] = useState<WatermarkedPhoto[]>([]);
  const [photosSesudah, setPhotosSesudah] = useState<WatermarkedPhoto[]>([]);

  // Preview Modal
  const [previewPhoto, setPreviewPhoto] = useState<WatermarkedPhoto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle WO Change
  const handleWoChange = (id: string) => {
    setSelectedWoId(id);
    const wo = availableWorkOrders.find((w) => w.id === id);
    if (wo) {
      setLatitude(wo.latitude);
      setLongitude(wo.longitude);
    }
  };

  // GPS Auto Fetch
  const handleFetchGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          showToast('Koordinat GPS lokasi Anda berhasil diperoleh!', 'success');
        },
        (err) => {
          showToast(`Gagal membaca GPS: ${err.message}`, 'error');
        },
        { enableHighAccuracy: true }
      );
    } else {
      showToast('Perangkat tidak mendukung GPS', 'warning');
    }
  };

  // Upload and Watermark Handler
  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'sebelum' | 'sesudah',
    slotIndex: 1 | 2 | 3
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedWO) {
      showToast('Pilih Work Order terlebih dahulu', 'warning');
      return;
    }

    setIsProcessing(true);
    showToast('Sedang membubuhkan watermark otomatis pada foto...', 'info');

    try {
      const timestampStr = new Date().toLocaleString('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
      });

      const watermarkedBase64 = await generateWatermarkedImage({
        imageFile: file,
        userName: petugasName,
        ulpName: selectedWO.ulpName,
        nomorWO: selectedWO.nomorWO,
        noTiang,
        latitude,
        longitude,
        customTimestamp: timestampStr,
      });

      const photoObj: WatermarkedPhoto = {
        id: `pic-${Date.now()}-${slotIndex}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        slotIndex,
        dataUrl: watermarkedBase64,
        fileUrl: '', // Uploaded once during realisasi save
        originalName: file.name,
        timestamp: timestampStr,
        latitude,
        longitude,
        userName: petugasName,
        ulpName: selectedWO.ulpName,
      };

      if (type === 'sebelum') {
        setPhotosSebelum((prev) => [
          ...prev.filter((p) => p.slotIndex !== slotIndex),
          photoObj,
        ]);
      } else {
        setPhotosSesudah((prev) => [
          ...prev.filter((p) => p.slotIndex !== slotIndex),
          photoObj,
        ]);
      }

      showToast(`Foto ${type} slot ${slotIndex} berhasil diberi watermark!`, 'success');
    } catch (err: any) {
      showToast(`Gagal memproses watermark foto: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const removePhoto = (type: 'sebelum' | 'sesudah', slotIndex: 1 | 2 | 3) => {
    if (type === 'sebelum') {
      setPhotosSebelum((prev) => prev.filter((p) => p.slotIndex !== slotIndex));
    } else {
      setPhotosSesudah((prev) => prev.filter((p) => p.slotIndex !== slotIndex));
    }
    showToast('Foto dihapus', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWO) {
      showToast('Silakan pilih Work Order', 'warning');
      return;
    }

    if (photosSebelum.length === 0) {
      showToast('Mohon unggah minimal 1 foto kondisi Sebelum (Before)', 'warning');
      return;
    }

    setIsProcessing(true);
    showToast('Menyimpan realisasi & mengunggah foto ke Google Drive...', 'info');

    try {
      // Pass fileUrl if already uploaded or dataUrl for GAS to upload once
      const fotoSebelumRaw = photosSebelum[0]?.fileUrl || photosSebelum[0]?.dataUrl || '';
      const fotoSesudahRaw = photosSesudah[0]?.fileUrl || photosSesudah[0]?.dataUrl || '';
      const fotoSebelumUrl = photosSebelum[0]?.fileUrl ? formatDriveViewUrl(photosSebelum[0].fileUrl) : fotoSebelumRaw;
      const fotoSesudahUrl = photosSesudah[0]?.fileUrl ? formatDriveViewUrl(photosSesudah[0].fileUrl) : fotoSesudahRaw;

      await addRealisasi({
        workOrderId: selectedWO.id,
        nomorWO: selectedWO.nomorWO,
        ulpName: selectedWO.ulpName,
        reguName: selectedWO.reguName,
        penyulangName: selectedWO.penyulangName,
        noTiang,
        tanggalRealisasi,
        petugasId: currentUser?.id || 'usr-3',
        fotoSebelumUrl,
        fotoSesudahUrl,
        photosSebelum,
        photosSesudah,
        petugasName,
        jenisTanaman,
        keterangan,
        pertumbuhanTanaman,
        kendala,
        latitude,
        longitude,
        progressPercent: 100,
        status: 'Selesai',
      });

      // Reset Form to empty values for the same WO
      setNoTiang('');
      setKeterangan('TEBANG');
      setPertumbuhanTanaman('CEPAT');
      setJenisTanaman('Kelapa Sawit');
      setKendala('Tidak Ada Kendala');
      setPhotosSebelum([]);
      setPhotosSesudah([]);
      setTanggalRealisasi(new Date().toISOString().slice(0, 10));

      showToast('Realisasi berhasil diinput. Anda dapat menginput realisasi lain untuk WO ini.', 'success');
    } catch (err: any) {
      showToast(`Gagal menyimpan realisasi: ${err.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="flex items-center space-x-3 text-sky-600 dark:text-sky-400">
            <Camera className="w-6 h-6" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-display">
              Input Realisasi & Watermark Foto Lapangan
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Laporkan progress realisasi, lampirkan foto sebelum & sesudah secara otomatis terstempel timestamp, GPS, dan nama petugas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* WO Selection Card */}
          <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-800/80 space-y-3">
            <label className="block text-xs font-bold text-sky-900 dark:text-sky-300 uppercase tracking-wider">
              Pilih Work Order Yang Dikerjakan
            </label>
            <select
              value={selectedWoId || ''}
              onChange={(e) => handleWoChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-sky-500 shadow-2xs"
            >
              {availableWorkOrders.map((wo, wIdx) => (
                <option key={`${wo.id}-${wIdx}`} value={wo.id}>
                  {wo.nomorWO} - {wo.penyulangName} ({wo.ulpName}) - [{wo.status}]
                </option>
              ))}
            </select>

            {selectedWO && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-300 border-t border-sky-200/60 dark:border-sky-800/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">Pekerjaan:</span>
                  <span className="font-bold">{selectedWO.jenisPekerjaan}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Lokasi:</span>
                  <span className="font-bold truncate block">{selectedWO.lokasi}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Regu Assigned:</span>
                  <span className="font-bold">{selectedWO.reguName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Progress Sekarang:</span>
                  <span className="font-bold text-sky-600">{selectedWO.progressPercent}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Main Attributes Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                TANGGAL
              </label>
              <input
                type="text"
                readOnly
                value={tanggalRealisasi || ''}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ULP
              </label>
              <input
                type="text"
                readOnly
                value={selectedWO?.ulpName || 'Otomatis'}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                REGU_ROW
              </label>
              <input
                type="text"
                readOnly
                value={selectedWO?.reguName || 'Otomatis'}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                PENYULANG
              </label>
              <input
                type="text"
                readOnly
                value={selectedWO?.penyulangName || 'Otomatis'}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                NO TIANG
              </label>
              <input
                type="text"
                placeholder="Contoh: T.12 / T.05"
                value={noTiang || ''}
                onChange={(e) => setNoTiang(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                JENIS TANAMAN
              </label>
              <input
                type="text"
                placeholder="Contoh: Kelapa Sawit"
                value={jenisTanaman || ''}
                onChange={(e) => setJenisTanaman(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                KETERANGAN
              </label>
              <select
                value={keterangan || ''}
                onChange={(e) => setKeterangan(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
              >
                <option value="TEBANG">TEBANG</option>
                <option value="PANGKAS">PANGKAS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                PERTUMBUHAN TANAMAN
              </label>
              <select
                value={pertumbuhanTanaman || ''}
                onChange={(e) => setPertumbuhanTanaman(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
              >
                <option value="CEPAT">CEPAT</option>
                <option value="SEDANG">SEDANG</option>
                <option value="LAMBAT">LAMBAT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                KENDALA
              </label>
              <input
                type="text"
                placeholder="Kendala lapangan..."
                value={kendala || ''}
                onChange={(e) => setKendala(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-500" />
                    <span>LATITUDE LONGITUDE (Otomatis)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleFetchGPS}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors shadow-2xs"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Ambil GPS</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      readOnly
                      value={latitude || 0}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      readOnly
                      value={longitude || 0}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>
            </div>
          </div>

          {/* Upload Foto Sebelum (Before) Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 border-b border-rose-100 dark:border-rose-900/40 pb-2">
              <ImageIcon className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase tracking-wider">
                FOTO SEBELUM {noTiang ? `- NO TIANG: ${noTiang}` : ''}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {([1] as const).map((slot) => {
                const existing = photosSebelum.find((p) => p.slotIndex === slot);

                return (
                  <div
                    key={`sebelum-${slot}`}
                    className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center min-h-[160px] hover:border-sky-500 transition-colors"
                  >
                    {existing ? (
                      <div className="space-y-2 w-full">
                        <img
                          src={existing.dataUrl}
                          alt={`Sebelum ${slot}`}
                          className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-2xs"
                        />
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ Watermarked
                          </span>
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto(existing)}
                              className="p-1 text-slate-500 hover:text-sky-600"
                              title="Lihat Foto"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePhoto('sebelum', slot)}
                              className="p-1 text-slate-500 hover:text-rose-600"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 space-y-3">
                        <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                          <Camera className="w-6 h-6 animate-pulse" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Upload Foto Sebelum {noTiang ? `(Tiang ${noTiang})` : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Otomatis Watermark GPS, Waktu & Identitas Petugas
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 w-full max-w-xs">
                          <label className="w-full cursor-pointer py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-95">
                            <Camera className="w-4 h-4" />
                            <span>Kamera HP (Direct)</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handlePhotoUpload(e, 'sebelum', slot)}
                              className="hidden"
                            />
                          </label>
                          <label className="w-full cursor-pointer py-2.5 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95">
                            <Upload className="w-4 h-4" />
                            <span>Pilih Galeri</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handlePhotoUpload(e, 'sebelum', slot)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Foto Sesudah (After) Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-900/40 pb-2">
              <ImageIcon className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase tracking-wider">
                FOTO SESUDAH {noTiang ? `- NO TIANG: ${noTiang}` : ''}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {([1] as const).map((slot) => {
                const existing = photosSesudah.find((p) => p.slotIndex === slot);

                return (
                  <div
                    key={`sesudah-${slot}`}
                    className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center min-h-[160px] hover:border-emerald-500 transition-colors"
                  >
                    {existing ? (
                      <div className="space-y-2 w-full">
                        <img
                          src={existing.dataUrl}
                          alt={`Sesudah ${slot}`}
                          className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-2xs"
                        />
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ Watermarked
                          </span>
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto(existing)}
                              className="p-1 text-slate-500 hover:text-sky-600"
                              title="Lihat Foto"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePhoto('sesudah', slot)}
                              className="p-1 text-slate-500 hover:text-rose-600"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 space-y-3">
                        <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                          <Camera className="w-6 h-6 animate-pulse" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Upload Foto Sesudah {noTiang ? `(Tiang ${noTiang})` : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Otomatis Watermark GPS, Waktu & Identitas Petugas
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 w-full max-w-xs">
                          <label className="w-full cursor-pointer py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-95">
                            <Camera className="w-4 h-4" />
                            <span>Kamera HP (Direct)</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handlePhotoUpload(e, 'sesudah', slot)}
                              className="hidden"
                            />
                          </label>
                          <label className="w-full cursor-pointer py-2.5 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95">
                            <Upload className="w-4 h-4" />
                            <span>Pilih Galeri</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handlePhotoUpload(e, 'sesudah', slot)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-3">
            <button
              type="submit"
              disabled={isProcessing}
              className="inline-flex items-center space-x-2 px-8 py-3 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Save className="w-5 h-5" />
              <span>Simpan Realisasi Pekerjaan</span>
            </button>
          </div>
        </form>
      </div>

      {/* Photo Watermark Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-slate-900 rounded-3xl max-w-3xl w-full p-4 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-white border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Preview Watermark Foto - {previewPhoto.type.toUpperCase()}
              </span>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewPhoto.dataUrl}
              alt="Watermark Preview"
              className="w-full max-h-[70vh] object-contain rounded-2xl bg-black"
            />
            <div className="flex justify-between text-xs text-slate-400 pt-1">
              <span>👤 Petugas: {previewPhoto.userName}</span>
              <span>📍 GPS: {previewPhoto.latitude}, {previewPhoto.longitude}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
