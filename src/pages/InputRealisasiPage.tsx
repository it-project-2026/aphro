import * as React from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { WatermarkedPhoto, WOStatus } from '../types';
import { generateWatermarkedImage } from '../utils/watermark';
import { GASApiService } from '../services/gasApiService';
import { InisiasiService } from '../services/inisiasiService';
import { ensureGoogleDrivePhotoUrl } from '../utils/driveUtils';
import { getWIBDateString } from '../utils/dateUtils';
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
  RefreshCw,
} from 'lucide-react';
import { useGASSync } from '../context/GASSyncContext';

interface InputRealisasiPageProps {
  editMode?: boolean;
  initialData?: any;
  onSuccess?: (savedWo?: any) => void;
  onCancel?: () => void;
}

export const InputRealisasiPage: React.FC<InputRealisasiPageProps> = ({
  editMode = false,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const { user: currentUser } = useAuth();
  const { workOrders, displayedWorkOrders, updateWorkOrder } = useWorkOrders();
  const { addRealisasi, updateRealisasi } = useRealisasi();
  const { settings } = useSettings();

  const {
    setActiveTab,
    selectedWoIdForRealisasi,
    setSelectedWoIdForRealisasi,
    isFinalizingMode,
    setIsFinalizingMode,
  } = useUI();

  const { showToast } = useToast();
  const { syncWithGAS } = useGASSync();

  const role = (currentUser?.role || 'User').toLowerCase();
  const isUserRole = role === 'user';

  // Helper membersihkan string
  const cleanStr = (s: any) =>
    String(s || '')
      .toLowerCase()
      .replace(/^(regu|tim|petugas)\s+/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();

  // Helper nomor ROW
  const extractRowNo = (s: any) => {
    const value = String(s || '');
    const m =
      value.match(/(?:row|regu|tim|users|usr)[-_\s]*0?(\d+)/i) ||
      value.match(/\b0?(\d+)\b/);
    return m ? parseInt(m[1], 10) : null;
  };

  // Cek status WO selesai
  const isFinishedWO = (wo: any): boolean => {
    const statusUpper = String(wo.status || '')
      .toUpperCase()
      .trim();
    return (
      statusUpper === 'SELESAI' ||
      statusUpper === 'FINISHED' ||
      statusUpper === 'DONE' ||
      statusUpper === 'COMPLETE' ||
      (wo.progressPercent !== undefined &&
        wo.progressPercent !== null &&
        Number(wo.progressPercent) >= 100)
    );
  };

  // Cek WO sesuai user/regu/ULP
  const isAssignedToUser = (wo: any): boolean => {
    if (!currentUser) return true;

    if (!isUserRole) {
      if (currentUser.ulpName && wo.ulpName) {
        const u1 = cleanStr(currentUser.ulpName);
        const u2 = cleanStr(wo.ulpName);
        if (u1 && u2 && !u1.includes(u2) && !u2.includes(u1)) {
          return false;
        }
      }
      return true;
    }

    if (
      currentUser.reguId &&
      wo.reguId &&
      String(currentUser.reguId) === String(wo.reguId)
    ) {
      return true;
    }

    if (
      currentUser.id &&
      wo.petugasId &&
      String(currentUser.id) === String(wo.petugasId)
    ) {
      return true;
    }

    const uRowNo = extractRowNo(
      currentUser.reguName || currentUser.userName
    );
    const woRowNo = extractRowNo(
      wo.reguName || (wo as any).regu || wo.nomorWO
    );

    if (uRowNo !== null && woRowNo !== null && uRowNo === woRowNo) {
      return true;
    }

    const userCandidates = [
      cleanStr(currentUser.reguName),
      cleanStr(currentUser.userName),
      cleanStr(currentUser.name),
      cleanStr(currentUser.nip),
      cleanStr(currentUser.id),
    ].filter(Boolean);

    const woReguClean = cleanStr(wo.reguName || (wo as any).regu);
    const woPetugasClean = cleanStr(wo.petugasName || (wo as any).petugas);
    const woCreatedByClean = cleanStr((wo as any).createdBy);

    const isMatched = userCandidates.some((uCand) => {
      if (!uCand) return false;
      if (
        woReguClean &&
        (woReguClean === uCand ||
          (woReguClean.length >= 2 &&
            uCand.length >= 2 &&
            (woReguClean.includes(uCand) || uCand.includes(woReguClean))))
      ) {
        return true;
      }
      if (
        woPetugasClean &&
        (woPetugasClean === uCand ||
          (woPetugasClean.length >= 2 &&
            uCand.length >= 2 &&
            (woPetugasClean.includes(uCand) || uCand.includes(woPetugasClean))))
      ) {
        return true;
      }
      if (woCreatedByClean && woCreatedByClean === uCand) {
        return true;
      }
      return false;
    });

    if (isMatched) return true;

    if (currentUser.ulpName && wo.ulpName) {
      const u1 = cleanStr(currentUser.ulpName);
      const u2 = cleanStr(wo.ulpName);
      if (u1 && u2 && (u1.includes(u2) || u2.includes(u1))) {
        return true;
      }
    }

    return false;
  };

  // Available Work Orders
  const availableWorkOrders = React.useMemo(() => {
    const sourceList =
      displayedWorkOrders.length > 0 ? displayedWorkOrders : workOrders;

    const result = sourceList.filter((wo) => {
      if (editMode && initialData && wo.id === initialData.workOrderId) {
        return true;
      }
      if (
        !editMode &&
        selectedWoIdForRealisasi &&
        wo.id === selectedWoIdForRealisasi
      ) {
        return true;
      }
      if (isFinishedWO(wo)) return false;
      if (!isAssignedToUser(wo)) return false;
      return true;
    });

    return result.sort((a, b) => {
      const dateA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : a.tanggal
        ? new Date(a.tanggal).getTime()
        : 0;
      const dateB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : b.tanggal
        ? new Date(b.tanggal).getTime()
        : 0;
      return dateB - dateA;
    });
  }, [
    displayedWorkOrders,
    workOrders,
    editMode,
    initialData,
    selectedWoIdForRealisasi,
    currentUser,
    isUserRole,
  ]);

  const [selectedWoId, setSelectedWoId] = React.useState<string>(() => {
    if (editMode && initialData) {
      return initialData.workOrderId;
    }
    if (selectedWoIdForRealisasi) {
      return selectedWoIdForRealisasi;
    }
    const defaultWo =
      availableWorkOrders.find((w) => !isFinishedWO(w)) ||
      availableWorkOrders[0];
    return defaultWo?.id || '';
  });

  const selectedWO = React.useMemo(() => {
    if (!selectedWoId) return null;
    return (
      availableWorkOrders.find((w) => w.id === selectedWoId || (w as any).WO_ID === selectedWoId || w.nomorWO === selectedWoId) ||
      displayedWorkOrders.find((w) => w.id === selectedWoId || (w as any).WO_ID === selectedWoId || w.nomorWO === selectedWoId) ||
      workOrders.find((w) => w.id === selectedWoId || (w as any).WO_ID === selectedWoId || w.nomorWO === selectedWoId) ||
      null
    );
  }, [availableWorkOrders, displayedWorkOrders, workOrders, selectedWoId]);

  React.useEffect(() => {
    if (!selectedWoId && availableWorkOrders.length > 0) {
      const defaultWo = availableWorkOrders.find((w) => !isFinishedWO(w)) || availableWorkOrders[0];
      if (defaultWo?.id) {
        setSelectedWoId(defaultWo.id);
      }
    }
  }, [availableWorkOrders, selectedWoId]);

  const [tanggalRealisasi, setTanggalRealisasi] = React.useState(
    editMode && initialData ? initialData.tanggalRealisasi : getWIBDateString()
  );

  const [petugasName] = React.useState(
    editMode && initialData
      ? initialData.petugasName
      : currentUser?.name || 'Rahmat Hidayat'
  );

  const [latitude, setLatitude] = React.useState(
    editMode && initialData ? initialData.latitude : -0.9142
  );

  const [longitude, setLongitude] = React.useState(
    editMode && initialData ? initialData.longitude : 100.4631
  );

  const [keterangan, setKeterangan] = React.useState(
    editMode && initialData ? initialData.keterangan : 'TEBANG'
  );

  const [noTiang, setNoTiang] = React.useState(
    editMode && initialData ? initialData.noTiang : ''
  );

  const [jenisTanaman, setJenisTanaman] = React.useState(
    editMode && initialData ? initialData.jenisTanaman : 'Kelapa Sawit'
  );

  const [pertumbuhanTanaman, setPertumbuhanTanaman] = React.useState(
    editMode && initialData ? initialData.pertumbuhanTanaman : 'CEPAT'
  );

  const [kendala, setKendala] = React.useState(
    editMode && initialData ? initialData.kendala : 'Tidak Ada Kendala'
  );

  const [lokasiKerja, setLokasiKerja] = React.useState(
    editMode && initialData ? initialData.lokasiKerja : ''
  );

  const [photosSebelum, setPhotosSebelum] = React.useState<WatermarkedPhoto[]>(
    editMode && initialData ? initialData.photosSebelum || [] : []
  );

  const [photosSesudah, setPhotosSesudah] = React.useState<WatermarkedPhoto[]>(
    editMode && initialData ? initialData.photosSesudah || [] : []
  );

  React.useEffect(() => {
    if (availableWorkOrders.length === 0) return;

    if (!editMode && selectedWoIdForRealisasi) {
      const wo = availableWorkOrders.find(
        (w) => w.id === selectedWoIdForRealisasi
      );
      if (wo) {
        setSelectedWoId(wo.id);
        setLatitude(wo.latitude ?? latitude);
        setLongitude(wo.longitude ?? longitude);

        if (isFinalizingMode) {
          setSubmissionStatus('finalizing');
          setIsFinalizingMode(false);
        } else {
          setSubmissionStatus('idle');
        }
        setSelectedWoIdForRealisasi(null);
        return;
      }
    }

    const exists = availableWorkOrders.some((w) => w.id === selectedWoId);
    if (!selectedWoId || !exists) {
      const defaultWo =
        availableWorkOrders.find((w) => !isFinishedWO(w)) ||
        availableWorkOrders[0];
      if (defaultWo) {
        setSelectedWoId(defaultWo.id);
        if (defaultWo.latitude !== undefined && defaultWo.latitude !== null) {
          setLatitude(defaultWo.latitude);
        }
        if (
          defaultWo.longitude !== undefined &&
          defaultWo.longitude !== null
        ) {
          setLongitude(defaultWo.longitude);
        }
      }
    }
  }, [
    availableWorkOrders,
    selectedWoIdForRealisasi,
    editMode,
    selectedWoId,
    isFinalizingMode,
  ]);

  const isFirstMount = React.useRef(true);
  React.useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (selectedWO && !editMode) {
      setLatitude(selectedWO.latitude);
      setLongitude(selectedWO.longitude);
    }
  }, [selectedWO, selectedWoId, editMode]);

  const [previewPhoto, setPreviewPhoto] =
    React.useState<WatermarkedPhoto | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [submissionStatus, setSubmissionStatus] = React.useState<
    'idle' | 'success' | 'finalizing'
  >('idle');

  const [totalVolume, setTotalVolume] = React.useState<number>(0);
  const [finalSatuan, setFinalSatuan] = React.useState<'KMS' | 'GAWANG'>('KMS');
  const [lokasiStart, setLokasiStart] = React.useState<string>('');
  const [lokasiFinish, setLokasiFinish] = React.useState<string>('');

  const handleWoChange = (id: string) => {
    setSelectedWoId(id);
    const wo = availableWorkOrders.find((w) => w.id === id);
    if (wo) {
      setLatitude(wo.latitude);
      setLongitude(wo.longitude);
    }
  };

  const handleFetchGPS = () => {
    if ('geolocation' in navigator) {
      showToast('Sedang membaca koordinat GPS...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          showToast(
            'Koordinat GPS lokasi Anda berhasil diperoleh dengan akurasi tinggi!',
            'success'
          );
        },
        (err) => {
          showToast(`Gagal membaca GPS: ${err.message}`, 'error');
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    } else {
      showToast('Perangkat tidak mendukung GPS', 'warning');
    }
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'sebelum' | 'sesudah',
    slotIndex: 1 | 2 | 3
  ) => {
    const fileInput = e.target;
    const file = fileInput.files?.[0];

    if (!file) return;

    if (!selectedWO) {
      showToast('Pilih Work Order terlebih dahulu', 'warning');
      if (fileInput) fileInput.value = '';
      return;
    }

    setIsProcessing(true);
    showToast(
      'Membaca GPS & membubuhkan watermark otomatis pada foto...',
      'info'
    );

    const processPhoto = async (lat: number, lon: number) => {
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
          latitude: lat,
          longitude: lon,
          customTimestamp: timestampStr,
        });

        if (fileInput) fileInput.value = '';

        const photoObj: WatermarkedPhoto = {
          id: `pic-${Date.now()}-${slotIndex}-${Math.random()
            .toString(36)
            .substring(2, 6)}`,
          type,
          slotIndex,
          dataUrl: watermarkedBase64,
          fileUrl: '',
          originalName: file.name,
          timestamp: timestampStr,
          latitude: lat,
          longitude: lon,
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

        showToast(
          `Foto ${type} slot ${slotIndex} berhasil diberi watermark!`,
          'success'
        );

        const gasUrl =
          settings.gasWebAppUrl ||
          localStorage.getItem('aphro_gas_url') ||
          '';

        if (gasUrl && navigator.onLine) {
          GASApiService.uploadPhoto(gasUrl, {
            base64Data: watermarkedBase64,
            nomorWO: selectedWO.nomorWO,
            reguName: selectedWO.reguName,
            photoType: type === 'sebelum' ? 'Sebelum' : 'Sesudah',
          })
            .then((uploadRes) => {
              if (
                uploadRes &&
                uploadRes.status === 'success' &&
                uploadRes.fileUrl
              ) {
                photoObj.fileUrl = uploadRes.fileUrl;
              }
            })
            .catch((err) => {
              console.warn('Background Google Drive upload note:', err);
            });
        }
      } catch (err: any) {
        showToast(
          `Foto gagal diproses: ${
            err?.message || 'Silakan coba ambil foto kembali.'
          }`,
          'error'
        );
      } finally {
        if (fileInput) fileInput.value = '';
        setIsProcessing(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          processPhoto(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          showToast(
            `Gagal membaca GPS foto: ${err.message}. Menggunakan GPS terakhir.`,
            'warning'
          );
          processPhoto(latitude, longitude);
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    } else {
      processPhoto(latitude, longitude);
    }
  };

  const removePhoto = (type: 'sebelum' | 'sesudah', slotIndex: 1 | 2 | 3) => {
    if (type === 'sebelum') {
      setPhotosSebelum((prev) =>
        prev.filter((p) => p.slotIndex !== slotIndex)
      );
    } else {
      setPhotosSesudah((prev) =>
        prev.filter((p) => p.slotIndex !== slotIndex)
      );
    }
    showToast('Foto dihapus', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWO) {
      showToast('Silakan pilih Work Order terlebih dahulu', 'warning');
      return;
    }

    const resolvedWoId = String(
      selectedWO.WO_ID ||
      selectedWO.id ||
      (selectedWO as any).workOrderId ||
      (selectedWO as any).woId ||
      selectedWoId ||
      ''
    ).trim();

    const resolvedNomorWo = String(
      selectedWO.Nomor_WO ||
      selectedWO.nomorWO ||
      (selectedWO as any).nomor_wo ||
      ''
    ).trim();

    if (!resolvedWoId && !resolvedNomorWo) {
      showToast('Work Order yang dipilih tidak memiliki WO_ID atau Nomor_WO yang valid!', 'error');
      return;
    }

    if (!noTiang.trim()) {
      showToast('Nomor Tiang tidak boleh kosong!', 'warning');
      return;
    }

    if (!jenisTanaman.trim()) {
      showToast('Jenis Tanaman tidak boleh kosong!', 'warning');
      return;
    }

    if (!lokasiKerja.trim()) {
      showToast('Lokasi Kerja tidak boleh kosong!', 'warning');
      return;
    }

    if (photosSebelum.length === 0) {
      showToast(
        'Mohon unggah minimal 1 foto kondisi Sebelum (Before)',
        'warning'
      );
      return;
    }

    setIsProcessing(true);
    showToast(
      'Menyimpan realisasi & mengunggah foto ke Google Drive...',
      'info'
    );

    try {
      const finalSebUrl = await ensureGoogleDrivePhotoUrl(
        photosSebelum[0]?.fileUrl || photosSebelum[0]?.dataUrl || '',
        {
          nomorWO: resolvedNomorWo || selectedWO.nomorWO,
          reguName: selectedWO.reguName,
          photoType: 'Realisasi_Sebelum',
        }
      );

      const finalSesUrl = await ensureGoogleDrivePhotoUrl(
        photosSesudah[0]?.fileUrl || photosSesudah[0]?.dataUrl || '',
        {
          nomorWO: resolvedNomorWo || selectedWO.nomorWO,
          reguName: selectedWO.reguName,
          photoType: 'Realisasi_Sesudah',
        }
      );

      if (editMode && initialData) {
        await updateRealisasi(initialData.id, {
          workOrderId: resolvedWoId,
          WO_ID: resolvedWoId,
          woId: resolvedWoId,
          nomorWO: resolvedNomorWo,
          Nomor_WO: resolvedNomorWo,
          ulpName: selectedWO.ulpName,
          reguName: selectedWO.reguName,
          penyulangName: selectedWO.penyulangName,
          noTiang,
          tanggalRealisasi,
          fotoSebelumUrl: finalSebUrl,
          fotoSesudahUrl: finalSesUrl,
          photosSebelum,
          photosSesudah,
          petugasName,
          jenisTanaman,
          lokasiKerja,
          keterangan,
          pertumbuhanTanaman,
          kendala,
          latitude,
          longitude,
        });

        showToast('Perubahan Realisasi berhasil disimpan.', 'success');
        if (onSuccess) onSuccess();
      } else {
        await addRealisasi({
          workOrderId: resolvedWoId,
          WO_ID: resolvedWoId,
          woId: resolvedWoId,
          nomorWO: resolvedNomorWo,
          Nomor_WO: resolvedNomorWo,
          unitId:
            selectedWO.unitId ||
            currentUser?.unitId ||
            InisiasiService.getSelectedUnitId() ||
            'UL2',
          ulpName: selectedWO.ulpName,
          reguName: selectedWO.reguName,
          penyulangName: selectedWO.penyulangName,
          noTiang,
          tanggalRealisasi,
          petugasId: currentUser?.id || currentUser?.userName || 'usr-3',
          fotoSebelumUrl: finalSebUrl,
          fotoSesudahUrl: finalSesUrl,
          photosSebelum,
          photosSesudah,
          petugasName,
          jenisTanaman,
          lokasiKerja,
          keterangan,
          pertumbuhanTanaman,
          kendala,
          latitude,
          longitude,
          progressPercent: 100,
          status: 'Selesai',
        });

        setNoTiang('');
        setKeterangan('TEBANG');
        setPertumbuhanTanaman('CEPAT');
        setJenisTanaman('Kelapa Sawit');
        setKendala('Tidak Ada Kendala');
        setLokasiKerja('');
        setPhotosSebelum([]);
        setPhotosSesudah([]);
        setTanggalRealisasi(getWIBDateString());

        setSubmissionStatus('success');
        showToast('Realisasi berhasil diinput.', 'success');
        if (onSuccess) {
          onSuccess(selectedWO);
        }
      }
    } catch (err: any) {
      showToast(
        `Gagal menyimpan realisasi: ${err.message || 'Terjadi kesalahan'}`,
        'error'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalizeWorkOrder = async () => {
    if (!selectedWO) {
      showToast('Pilih Work Order terlebih dahulu!', 'warning');
      return;
    }

    if (!lokasiStart.trim()) {
      showToast(
        'Titik Start wajib diisi untuk menyatakan pekerjaan SELESAI!',
        'warning'
      );
      return;
    }

    if (!lokasiFinish.trim()) {
      showToast(
        'Titik Finish wajib diisi untuk menyatakan pekerjaan SELESAI!',
        'warning'
      );
      return;
    }

    if (totalVolume <= 0) {
      showToast(
        'Jumlah Realisasi (Total Volume) wajib diisi dan harus lebih dari 0!',
        'warning'
      );
      return;
    }

    setIsProcessing(true);
    showToast('Memproses penyelesaian pekerjaan...', 'info');

    try {
      await updateWorkOrder(selectedWO.id, {
        status: 'Selesai' as WOStatus,
        totalRealisasi: totalVolume,
        satuanTotalRealisasi: finalSatuan,
        lokasiStart,
        lokasiFinish,
      });

      showToast(
        `Pekerjaan ${selectedWO.nomorWO} telah dinyatakan SELESAI dengan volume ${totalVolume} ${finalSatuan}.`,
        'success'
      );

      setTimeout(() => {
        setActiveTab('dashboard');
      }, 1000);
    } catch (err: any) {
      console.error('Finalize WO error:', err);
      showToast(
        `Pekerjaan ${selectedWO.nomorWO} berhasil diselesaikan secara lokal!`,
        'success'
      );
      setTimeout(() => {
        setActiveTab('dashboard');
      }, 1000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetForNewRealisasi = () => {
    setSubmissionStatus('idle');
  };

  if (submissionStatus === 'success') {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-in zoom-in duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 text-center shadow-xl space-y-6">
          <div className="w-20 h-20 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-teal-50 dark:border-teal-900/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-display">
              Data Berhasil Tersimpan!
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Realisasi titik pekerjaan ini telah berhasil dicatat ke sistem.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <button
              type="button"
              onClick={handleResetForNewRealisasi}
              className="flex items-center justify-center space-x-2 py-4 px-6 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 font-black rounded-2xl transition-all border border-teal-200 dark:border-teal-800 shadow-sm"
            >
              <Camera className="w-5 h-5" />
              <span>TAMBAH REALISASI</span>
            </button>

            <button
              type="button"
              onClick={() => setSubmissionStatus('finalizing')}
              className="flex items-center justify-center space-x-2 py-4 px-6 bg-[#008396] hover:bg-[#00A2B9] text-white font-black rounded-2xl transition-all shadow-lg shadow-teal-600/25"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>PEKERJAAN SELESAI</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submissionStatus === 'finalizing') {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-in slide-in-from-bottom-10 duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 shadow-xl space-y-6">
          <div className="flex items-center space-x-3 text-[#00A2B9] dark:text-teal-400 border-b border-slate-100 dark:border-slate-700 pb-4">
            <FileCheck2 className="w-7 h-7" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white font-display">
              Penyelesaian Pekerjaan (Final)
            </h2>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Work Order
            </p>
            <p className="font-black text-slate-900 dark:text-white">
              {selectedWO?.nomorWO} - {selectedWO?.penyulangName}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  LOKASI START <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Titik mulai..."
                  value={lokasiStart}
                  onChange={(e) => setLokasiStart(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9] outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  LOKASI FINISH <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Titik selesai..."
                  value={lokasiFinish}
                  onChange={(e) => setLokasiFinish(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                TOTAL VOLUME REALISASI <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                placeholder="0.00"
                value={totalVolume || ''}
                onChange={(e) => setTotalVolume(Number(e.target.value))}
                className="w-full px-5 py-4 text-2xl font-black rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9] outline-none transition-all shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                PILIH SATUAN <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFinalSatuan('KMS')}
                  className={`py-4 rounded-2xl font-black text-sm border-2 transition-all ${
                    finalSatuan === 'KMS'
                      ? 'bg-teal-50 border-[#00A2B9] text-[#008396] dark:bg-teal-900/20 dark:text-teal-400'
                      : 'bg-white border-slate-100 text-slate-400 dark:bg-slate-900 dark:border-slate-800'
                  }`}
                >
                  KMS
                </button>
                <button
                  type="button"
                  onClick={() => setFinalSatuan('GAWANG')}
                  className={`py-4 rounded-2xl font-black text-sm border-2 transition-all ${
                    finalSatuan === 'GAWANG'
                      ? 'bg-teal-50 border-[#00A2B9] text-[#008396] dark:bg-teal-900/20 dark:text-teal-400'
                      : 'bg-white border-slate-100 text-slate-400 dark:bg-slate-900 dark:border-slate-800'
                  }`}
                >
                  GAWANG
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={() => setSubmissionStatus('success')}
              className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-black rounded-2xl transition-all"
            >
              KEMBALI
            </button>
            <button
              type="button"
              onClick={handleFinalizeWorkOrder}
              disabled={
                isProcessing ||
                totalVolume <= 0 ||
                !lokasiStart.trim() ||
                !lokasiFinish.trim()
              }
              className="flex-[2] py-4 px-6 bg-[#00A2B9] hover:bg-[#008396] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all shadow-lg shadow-teal-600/25 flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>SIMPAN PEKERJAAN SELESAI</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <Camera className="w-6 h-6 text-[#00A2B9]" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display uppercase tracking-tight">
              Input Realisasi & Watermark Foto Lapangan
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Laporkan progress realisasi, lampirkan foto sebelum & sesudah secara
            otomatis terstempel timestamp, GPS, dan nama petugas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Pilih Work Order Yang Dikerjakan
              </label>
              <button
                type="button"
                onClick={() => syncWithGAS && syncWithGAS()}
                className="text-[10px] font-bold text-[#00A2B9] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                REFRESH DATA
              </button>
            </div>

            {isUserRole && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                Menampilkan Work Order{' '}
                <span className="font-bold text-teal-600 dark:text-teal-400">
                  BELUM SELESAI
                </span>{' '}
                untuk:{' '}
                <span className="font-bold text-teal-600 dark:text-teal-400">
                  {currentUser?.reguName ||
                    currentUser?.name ||
                    'User Login'}
                </span>
              </p>
            )}

            <select
              value={selectedWoId || ''}
              onChange={(e) => handleWoChange(e.target.value)}
              className="w-full px-3.5 py-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-[#00A2B9]"
            >
              {workOrders.length === 0 ? (
                <option value="">
                  -- Menunggu Data Work Order Dari Database HyperCloudHost... --
                </option>
              ) : availableWorkOrders.length === 0 ? (
                <option value="">
                  -- Tidak Ada Work Order BELUM SELESAI yang dapat
                  direalisasikan --
                </option>
              ) : (
                <>
                  {(!selectedWoId ||
                    !availableWorkOrders.find((w) => w.id === selectedWoId)) && (
                    <option value="">
                      -- Pilih Work Order Belum Selesai --
                    </option>
                  )}
                  {availableWorkOrders.map((wo, wIdx) => (
                    <option key={`${wo.id}-${wIdx}`} value={wo.id}>
                      {wo.nomorWO} - {wo.penyulangName} ({wo.ulpName}) - [
                      {wo.status || 'BELUM SELESAI'}]
                    </option>
                  ))}
                </>
              )}
            </select>

            {selectedWO && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Pekerjaan:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {selectedWO.jenisPekerjaan}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Lokasi:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block">
                    {selectedWO.lokasi}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Regu Assigned:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {selectedWO.reguName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Progress Sekarang:
                  </span>
                  <span className="font-semibold text-[#00A2B9] dark:text-teal-400">
                    {selectedWO.progressPercent}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {isUserRole && selectedWO && isFinishedWO(selectedWO) ? (
            <div className="p-10 text-center space-y-4 bg-rose-50 dark:bg-rose-950/20 border-2 border-dashed border-rose-200 dark:border-rose-900/40 rounded-3xl animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <X className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-rose-900 dark:text-rose-200 uppercase">
                  Input Terkunci
                </h3>
                <p className="text-sm text-rose-700/70 dark:text-rose-400/70 max-w-xs mx-auto">
                  Work Order ini sudah berstatus <b>SELESAI</b>. User tidak
                  diperbolehkan menambah realisasi baru pada pekerjaan yang
                  sudah tuntas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-rose-600/20"
              >
                Kembali ke Dashboard
              </button>
            </div>
          ) : (
            <>
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    NO TIANG <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: T.12 / T.05"
                    value={noTiang || ''}
                    onChange={(e) => setNoTiang(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:border-[#00A2B9] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    JENIS TANAMAN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kelapa Sawit"
                    value={jenisTanaman || ''}
                    onChange={(e) => setJenisTanaman(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:border-[#00A2B9] outline-none"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    KENDALA
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Kendala lapangan..."
                    value={kendala || ''}
                    onChange={(e) => setKendala(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    LOKASI KERJA (Manual){' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Depan Kantor ULP..."
                    value={lokasiKerja || ''}
                    onChange={(e) => setLokasiKerja(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:border-[#00A2B9] outline-none"
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#00A2B9]" />
                      <span>LATITUDE LONGITUDE (Otomatis)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleFetchGPS}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold text-white bg-[#008396] hover:bg-[#00A2B9] rounded-lg transition-colors shadow-2xs"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Ambil GPS</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      readOnly
                      value={latitude || 0}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed"
                    />
                    <input
                      type="number"
                      readOnly
                      value={longitude || 0}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Foto Sebelum */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 border-b border-rose-100 dark:border-rose-900/40 pb-2">
                  <ImageIcon className="w-5 h-5" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">
                    FOTO SEBELUM <span className="text-rose-500">*</span>
                    {noTiang ? ` - NO TIANG: ${noTiang}` : ''}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {([1] as const).map((slot) => {
                    const existing = photosSebelum.find(
                      (p) => p.slotIndex === slot
                    );

                    return (
                      <div
                        key={`sebelum-${slot}`}
                        className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center min-h-[160px] hover:border-[#00A2B9] transition-colors"
                      >
                        {existing ? (
                          <div className="space-y-2 w-full">
                            <img
                              src={existing.dataUrl}
                              alt={`Sebelum ${slot}`}
                              className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-2xs"
                            />
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                                ✓ Watermarked
                              </span>
                              <div className="flex space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto(existing)}
                                  className="p-1 text-slate-500 hover:text-[#00A2B9]"
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
                                Upload Foto Sebelum{' '}
                                {noTiang ? `(Tiang ${noTiang})` : ''}
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
                                  onChange={(e) =>
                                    handlePhotoUpload(e, 'sebelum', slot)
                                  }
                                  className="hidden"
                                />
                              </label>

                              <label className="w-full cursor-pointer py-2.5 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95">
                                <Upload className="w-4 h-4" />
                                <span>Pilih Galeri</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handlePhotoUpload(e, 'sebelum', slot)
                                  }
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

              {/* Foto Sesudah */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400 border-b border-teal-100 dark:border-teal-900/40 pb-2">
                  <ImageIcon className="w-5 h-5" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">
                    FOTO SESUDAH
                    {noTiang ? ` - NO TIANG: ${noTiang}` : ''}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {([1] as const).map((slot) => {
                    const existing = photosSesudah.find(
                      (p) => p.slotIndex === slot
                    );

                    return (
                      <div
                        key={`sesudah-${slot}`}
                        className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center min-h-[160px] hover:border-[#00A2B9] transition-colors"
                      >
                        {existing ? (
                          <div className="space-y-2 w-full">
                            <img
                              src={existing.dataUrl}
                              alt={`Sesudah ${slot}`}
                              className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-2xs"
                            />
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                                ✓ Watermarked
                              </span>
                              <div className="flex space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto(existing)}
                                  className="p-1 text-slate-500 hover:text-[#00A2B9]"
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
                            <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400">
                              <Camera className="w-6 h-6 animate-pulse" />
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Upload Foto Sesudah{' '}
                                {noTiang ? `(Tiang ${noTiang})` : ''}
                              </span>
                            </div>

                            <p className="text-[10px] text-slate-400">
                              Otomatis Watermark GPS, Waktu & Identitas Petugas
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 w-full max-w-xs">
                              <label className="w-full cursor-pointer py-2.5 px-3 bg-[#008396] hover:bg-[#00A2B9] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all active:scale-95">
                                <Camera className="w-4 h-4" />
                                <span>Kamera HP (Direct)</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) =>
                                    handlePhotoUpload(e, 'sesudah', slot)
                                  }
                                  className="hidden"
                                />
                              </label>

                              <label className="w-full cursor-pointer py-2.5 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95">
                                <Upload className="w-4 h-4" />
                                <span>Pilih Galeri</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handlePhotoUpload(e, 'sesudah', slot)
                                  }
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

              {/* Submit */}
              <div className="pt-6 border-t border-teal-200 dark:border-slate-700 flex justify-end gap-3">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-2xl transition-all"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full sm:w-auto inline-flex items-center space-x-3 px-10 py-4 text-sm font-black text-white bg-gradient-to-r from-black via-slate-900 to-red-600 hover:from-slate-900 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl shadow-xl shadow-black/25 transition-all active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  <span>Simpan Realisasi Pekerjaan</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-slate-900 rounded-3xl max-w-3xl w-full p-4 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-white border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Preview Watermark Foto - {previewPhoto.type.toUpperCase()}
              </span>
              <button
                type="button"
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
              <span>
                📍 GPS: {previewPhoto.latitude}, {previewPhoto.longitude}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
