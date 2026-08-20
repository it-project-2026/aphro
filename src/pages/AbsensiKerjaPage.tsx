import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMasterData } from '../context/MasterDataContext';
import { useAbsensi } from '../context/AbsensiContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { formatDriveViewUrl, formatDriveImageUrl } from '../utils/driveUtils';
import { 
  UserCheck, 
  Calendar, 
  Users, 
  Camera, 
  CheckCircle2, 
  Trash2,
  Building2,
  LogOut,
  ExternalLink,
  Clock,
  Sparkles,
  Info,
  Plus,
  Eye,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { generateWatermarkedImage } from '../utils/watermark';
import { AbsensiPetugas } from '../types';
import { getLocalDateTimeString } from '../utils/dateUtils';

interface AbsensiKerjaPageProps {
  onSuccess: () => void;
}

export const AbsensiKerjaPage: React.FC<AbsensiKerjaPageProps> = ({ onSuccess }) => {
  const { user: currentUser, logout } = useAuth();
  const { petugasList, users } = useMasterData();
  const { absensiList, addAbsensi } = useAbsensi();
  const { setActiveTab } = useUI();
  const { showToast } = useToast();

  const todayStr = getLocalDateTimeString().slice(0, 10);
  const reguName = currentUser?.reguName || currentUser?.reguId || (currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin' ? 'Manajemen/Admin' : 'Belum Ada Regu');
  const ulpName = currentUser?.ulpName || currentUser?.ulpId || 'Belum Ada ULP';

  // Helper to normalize strings for comparison
  const cleanStr = (s?: string | null) => {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/^(regu|tim|petugas|kelompok|regu_row)\s+/gi, '')
      .replace(/[^a-z0-9]/gi, '');
  };

  const userReguClean = cleanStr(reguName);

  // Find today's existing Absensi record for this Regu
  const todayAbsensi = absensiList.find((a) => {
    if (!a) return false;
    const isToday = String(a.tanggal || '').slice(0, 10) === todayStr;
    const matchRegu = cleanStr(a.reguName) === userReguClean;
    const matchUser = cleanStr(a.userName) === cleanStr(currentUser?.userName || currentUser?.nip || currentUser?.id) || cleanStr(a.namaPetugas) === cleanStr(currentUser?.name);
    return isToday && (matchRegu || matchUser);
  });

  // Check if Absensi Masuk has already been done today
  const hasDoneAbsensiMasuk = Boolean(
    todayAbsensi && (todayAbsensi.fotoMasuk || (todayAbsensi.petugasList && todayAbsensi.petugasList.length > 0))
  );

  // Helper to get all Petugas members matching the active Regu
  const getReguMembersFromMaster = (): AbsensiPetugas[] => {
    // 1. Match from Petugas Master Data
    const matchedPetugas = petugasList.filter((p) => {
      if (!p || p.status === 'Non-Aktif') return false;
      const cleanPRegu = cleanStr(p.reguName);
      const isExactRegu = (p.reguName || '').trim().toLowerCase() === reguName.trim().toLowerCase();
      const isCleanMatch = userReguClean && cleanPRegu === userReguClean;
      const isIdMatch = Boolean(currentUser?.reguId && p.reguId && p.reguId === currentUser.reguId);
      return isExactRegu || isCleanMatch || isIdMatch;
    });

    if (matchedPetugas.length > 0) {
      return matchedPetugas.map((p) => ({
        nama: p.nama,
        keterangan: 'HADIR' as const,
      }));
    }

    // 2. Fallback: match from Users list
    const matchedUsers = users.filter((u) => {
      if (!u || u.status === 'Non-Aktif') return false;
      const cleanURegu = cleanStr(u.reguName);
      const isExactRegu = (u.reguName || '').trim().toLowerCase() === reguName.trim().toLowerCase();
      const isCleanMatch = userReguClean && cleanURegu === userReguClean;
      const isIdMatch = Boolean(currentUser?.reguId && u.reguId && u.reguId === currentUser.reguId);
      return isExactRegu || isCleanMatch || isIdMatch;
    });

    if (matchedUsers.length > 0) {
      return matchedUsers.map((u) => ({
        nama: u.name,
        keterangan: 'HADIR' as const,
      }));
    }

    // 3. Fallback: current logged-in user
    if (currentUser?.name) {
      return [{ nama: currentUser.name, keterangan: 'HADIR' as const }];
    }

    return [{ nama: '', keterangan: 'HADIR' as const }];
  };

  const [petugasRows, setPetugasRows] = useState<AbsensiPetugas[]>(() => {
    if (todayAbsensi && todayAbsensi.petugasList && todayAbsensi.petugasList.length > 0) {
      return todayAbsensi.petugasList.map((p) => ({
        nama: p.nama || '',
        keterangan: p.keterangan || 'HADIR',
      }));
    }
    return getReguMembersFromMaster();
  });

  useEffect(() => {
    if (todayAbsensi && todayAbsensi.petugasList && todayAbsensi.petugasList.length > 0) {
      setPetugasRows(
        todayAbsensi.petugasList.map((p) => ({
          nama: p.nama || '',
          keterangan: p.keterangan || 'HADIR',
        }))
      );
    } else {
      setPetugasRows(getReguMembersFromMaster());
    }
  }, [todayAbsensi, reguName, petugasList, users]);

  // Filter history strictly for the logged-in user's Regu
  const reguAbsensiHistory = useMemo(() => {
    return absensiList.filter((item) => {
      if (!item) return false;
      
      const itemReguClean = cleanStr(item.reguName);
      const isExactRegu = (item.reguName || '').trim().toLowerCase() === reguName.trim().toLowerCase();
      const isCleanMatch = Boolean(userReguClean && itemReguClean && itemReguClean === userReguClean);
      
      // Also match by userName / nip / id if reguName is not explicitly matching
      const itemUserClean = cleanStr(item.userName);
      const activeUserClean = cleanStr(currentUser?.userName || currentUser?.nip || currentUser?.id);
      const isUserMatch = Boolean(activeUserClean && itemUserClean && itemUserClean === activeUserClean);
      const isNipMatch = Boolean(currentUser?.nip && item.nip && item.nip === currentUser.nip);

      return isExactRegu || isCleanMatch || isUserMatch || isNipMatch;
    });
  }, [absensiList, reguName, userReguClean, currentUser]);

  const [fotoMasuk, setFotoMasuk] = useState<string>('');
  const [fotoKeluar, setFotoKeluar] = useState<string>('');
  const [currentCoords, setCurrentCoords] = useState<{lat: number; lon: number} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; driveUrl: string } | null>(null);

  const handlePetugasNameChange = (index: number, val: string) => {
    const updated = [...petugasRows];
    updated[index] = { ...updated[index], nama: val };
    setPetugasRows(updated);
  };

  const handlePetugasStatusChange = (index: number, status: 'HADIR' | 'TIDAK HADIR' | 'SAKIT' | 'IZIN') => {
    const updated = [...petugasRows];
    updated[index] = { ...updated[index], keterangan: status };
    setPetugasRows(updated);
  };

  const handleAddPetugas = () => {
    setPetugasRows((prev) => [
      ...prev,
      { nama: '', keterangan: 'HADIR' as const },
    ]);
  };

  const handleRemovePetugas = (index: number) => {
    if (petugasRows.length <= 1) {
      setPetugasRows([{ nama: '', keterangan: 'HADIR' as const }]);
      return;
    }
    setPetugasRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'masuk' | 'keluar') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    showToast('Sedang memproses foto dan membaca GPS (Akurat)...', 'info');

    const processPhoto = async (lat: number, lon: number) => {
      try {
        const timestampStr = new Date().toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'medium',
        });

        const watermarkedBase64 = await generateWatermarkedImage({
          imageFile: file,
          userName: currentUser?.name || 'Petugas',
          ulpName: ulpName || 'ULP',
          latitude: lat,
          longitude: lon,
          customTimestamp: timestampStr,
        });

        if (type === 'masuk') {
          setFotoMasuk(watermarkedBase64);
          setCurrentCoords({ lat, lon });
          showToast('Foto Masuk berhasil diambil & diberi watermark GPS!', 'success');
        } else {
          setFotoKeluar(watermarkedBase64);
          setCurrentCoords({ lat, lon });
          showToast('Foto Keluar berhasil diambil & diberi watermark GPS!', 'success');
        }
      } catch (err: any) {
        showToast(`Gagal memproses foto: ${err.message}`, 'error');
      } finally {
        setIsSubmitting(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => processPhoto(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          showToast(`Gagal membaca GPS untuk foto: ${err.message}. Menggunakan koordinat default (0,0).`, 'warning');
          processPhoto(0, 0); // fallback if gps fails but we still want the photo
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    } else {
      showToast('Browser tidak mendukung GPS, lokasi tidak terdeteksi', 'warning');
      processPhoto(0, 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasDoneAbsensiMasuk && !fotoMasuk) {
      showToast('Mohon lampirkan Foto Masuk (Kamera / File) terlebih dahulu!', 'warning');
      return;
    }

    if (hasDoneAbsensiMasuk && !fotoKeluar && !todayAbsensi?.fotoKeluar) {
      showToast('Mohon lampirkan Foto Keluar (Kamera / File) untuk absensi pulang!', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      // When doing "Absen Pulang" (Keluar), we only need to update the existing record
      const absensiPayload = {
        tanggal: todayStr,
        reguName: todayAbsensi?.reguName || reguName,
        penyulangName: todayAbsensi?.penyulangName || (currentUser as any)?.penyulangName || 'Penyulang Pauh Utama',
        ulpName: todayAbsensi?.ulpName || ulpName,
        userName: currentUser?.userName || currentUser?.nip || currentUser?.id,
        namaPetugas: currentUser?.name,
        nip: currentUser?.nip,
        petugasList: hasDoneAbsensiMasuk ? (todayAbsensi?.petugasList || petugasRows) : petugasRows,
        fotoMasuk: hasDoneAbsensiMasuk ? (todayAbsensi?.fotoMasuk || '') : fotoMasuk,
        fotoKeluar: hasDoneAbsensiMasuk ? fotoKeluar : '',
        latitude: currentCoords?.lat || todayAbsensi?.latitude,
        longitude: currentCoords?.lon || todayAbsensi?.longitude,
      };

      await addAbsensi(absensiPayload);

      showToast(
        !hasDoneAbsensiMasuk 
          ? 'Absensi Masuk berhasil disimpan!' 
          : 'Absensi Keluar berhasil disimpan!', 
        'success'
      );

      setActiveTab('monitoring_absensi');
      onSuccess();
    } catch (err: any) {
      showToast(`Gagal menyimpan absensi: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 sm:pb-10">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
              <UserCheck className="w-7 h-7 text-teal-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display uppercase tracking-tight">
                {!hasDoneAbsensiMasuk ? 'Form Absensi Masuk Regu Kerja' : 'Form Absensi Keluar (Jam Pulang)'}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {!hasDoneAbsensiMasuk
                ? 'Regu belum melakukan Absensi Masuk hari ini. Mohon lengkapi daftar hadir and unggah Foto Masuk.'
                : 'Absensi Masuk untuk hari ini sudah selesai. Gunakan form ini untuk mencatat Foto Keluar (Jam Pulang).'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-teal-500" />
              <span>Tanggal: {todayStr}</span>
            </div>
            <button
              onClick={() => logout()}
              type="button"
              className="p-2 sm:px-3.5 sm:py-2 flex items-center space-x-2 bg-white dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200 dark:border-rose-500/30 transition-all shadow-sm"
              title="Kembali ke Menu Login"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Logout</span>
            </button>
          </div>
        </div>

        {/* Existing Absensi Masuk Status Banner if already checked in */}
        {hasDoneAbsensiMasuk && todayAbsensi && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                  Absensi Masuk Hari Ini Sudah Tercatat
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Waktu Masuk: {todayAbsensi.timestampMasuk || todayAbsensi.createdAt}
                </p>
              </div>
            </div>

            {todayAbsensi.fotoMasuk && (
              <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-700 bg-black">
                  <img src={formatDriveImageUrl(todayAbsensi.fotoMasuk)} alt="Foto Masuk" className="w-full h-full object-cover" />
                </div>
                <a
                  href={formatDriveViewUrl(todayAbsensi.fotoMasuk)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Link Foto Masuk</span>
                </a>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Automatic Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nama Regu (Otomatis)</span>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-teal-500" />
                <span>{reguName}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unit Layanan Pelanggan (ULP)</span>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-teal-500" />
                <span>{ulpName}</span>
              </div>
            </div>
          </div>

          {/* Attendance Table for Regu Members */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Daftar Kehadiran Anggota Regu ({petugasRows.length} Petugas)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {hasDoneAbsensiMasuk 
                    ? 'Daftar kehadiran sudah dikunci setelah Absensi Masuk.' 
                    : `Daftar anggota untuk ${reguName}.`}
                </p>
              </div>

              {!hasDoneAbsensiMasuk && (
                <button
                  type="button"
                  onClick={handleAddPetugas}
                  className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center space-x-1.5 transition-all self-start sm:self-auto cursor-pointer shadow-xs"
                  title="Tambah baris anggota regu baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Petugas</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {petugasRows.map((petugas, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-all ${
                    hasDoneAbsensiMasuk 
                      ? 'bg-slate-100 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-80' 
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-800'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="w-7 h-7 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-xs shrink-0">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={petugas.nama}
                      disabled={hasDoneAbsensiMasuk}
                      onChange={(e) => handlePetugasNameChange(idx, e.target.value)}
                      placeholder={`Nama Petugas #${idx + 1}`}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:border-teal-500 focus:outline-none disabled:bg-transparent disabled:border-transparent disabled:font-bold"
                    />
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {(['HADIR', 'SAKIT', 'IZIN', 'TIDAK HADIR'] as const).map((status) => {
                      const isSelected = petugas.keterangan === status;
                      
                      // If locked and not selected, don't show the button at all on mobile to save space
                      if (hasDoneAbsensiMasuk && !isSelected) return null;

                      let activeStyle = 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
                      if (status === 'SAKIT') activeStyle = 'bg-amber-500 text-white border-amber-600 shadow-sm';
                      if (status === 'IZIN') activeStyle = 'bg-teal-500 text-white border-teal-600 shadow-sm';
                      if (status === 'TIDAK HADIR') activeStyle = 'bg-rose-500 text-white border-rose-600 shadow-sm';

                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={hasDoneAbsensiMasuk}
                          onClick={() => handlePetugasStatusChange(idx, status)}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? activeStyle
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          } disabled:opacity-100 disabled:shadow-none`}
                        >
                          {status}
                        </button>
                      );
                    })}

                    {petugasRows.length > 1 && !hasDoneAbsensiMasuk && (
                      <button
                        type="button"
                        onClick={() => handleRemovePetugas(idx)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Hapus baris petugas ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conditional Photo Input Section */}
          <div className="space-y-4 pt-2">
            {!hasDoneAbsensiMasuk ? (
              /* FOTO MASUK ONLY (When Absensi Masuk has not been completed) */
              <div className="p-5 rounded-3xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
                      <Camera className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>Input Foto Masuk *</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Unggah/Ambil Foto Absensi Masuk regu kerja saat mulai bertugas.
                    </p>
                  </div>
                  {fotoMasuk && (
                    <button
                      type="button"
                      onClick={() => setFotoMasuk('')}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {fotoMasuk ? (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-black max-w-md mx-auto">
                      <img src={formatDriveImageUrl(fotoMasuk)} alt="Foto Masuk" className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-emerald-600/90 text-white text-[10px] font-bold">
                        Terunggah (Foto Masuk)
                      </div>
                    </div>
                    {fotoMasuk.startsWith('http') && (
                      <div className="flex justify-center">
                        <a
                          href={formatDriveViewUrl(fotoMasuk)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-bold text-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Link URL Foto Masuk</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-teal-300 dark:border-teal-700 hover:border-teal-500 dark:hover:border-teal-400 rounded-2xl aspect-video max-w-md mx-auto flex flex-col items-center justify-center cursor-pointer p-6 transition-all bg-white dark:bg-slate-900 group">
                    <div className="p-3.5 rounded-2xl bg-teal-100 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform mb-2">
                      <Camera className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Buka Kamera / Pilih Foto Masuk
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Wajib diisi untuk Absensi Masuk (Format JPG/PNG)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'masuk')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            ) : (
              /* FOTO KELUAR ONLY (When Absensi Masuk has already been completed) */
              <div className="p-5 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
                      <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Input Foto Keluar (Absensi Pulang) *</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Unggah/Ambil Foto Absensi Keluar saat jam kerja/shift regu berakhir.
                    </p>
                  </div>
                  {(fotoKeluar || todayAbsensi?.fotoKeluar) && (
                    <button
                      type="button"
                      onClick={() => setFotoKeluar('')}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {fotoKeluar || todayAbsensi?.fotoKeluar ? (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video max-w-md mx-auto bg-black">
                      <img
                        src={fotoKeluar || todayAbsensi?.fotoKeluar}
                        alt="Foto Keluar"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-indigo-600/90 text-white text-[10px] font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Foto Keluar Terunggah</span>
                      </div>
                    </div>

                    {(fotoKeluar || todayAbsensi?.fotoKeluar)?.startsWith('http') && (
                      <div className="flex justify-center">
                        <a
                          href={fotoKeluar || todayAbsensi?.fotoKeluar}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-bold text-xs shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Link URL Foto Keluar</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl aspect-video max-w-md mx-auto flex flex-col items-center justify-center cursor-pointer p-6 transition-all bg-white dark:bg-slate-900 group">
                    <div className="p-3.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-2">
                      <Camera className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Buka Kamera / Pilih Foto Keluar
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Absensi Pulang Selesai Bertugas (Format JPG/PNG)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, 'keluar')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Submit Action Button */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center space-x-3 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {isSubmitting
                  ? 'Menyimpan & Menyinkronkan...'
                  : !hasDoneAbsensiMasuk
                  ? 'Kirim Absensi Masuk & Masuk Aplikasi'
                  : 'Kirim Absensi Keluar & Simpan'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* History Table displaying Foto Links for logged-in Regu */}
      {reguAbsensiHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-teal-500" />
              <span>Riwayat Absensi Regu {reguName} ({reguAbsensiHistory.length})</span>
            </h3>
            <span className="text-xs text-slate-400">Daftar riwayat absensi & link foto khusus untuk {reguName}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3 font-bold">Tanggal</th>
                  <th className="p-3 font-bold">Regu</th>
                  <th className="p-3 font-bold">ULP</th>
                  <th className="p-3 font-bold">Petugas (Hadir)</th>
                  <th className="p-3 font-bold">Foto Masuk</th>
                  <th className="p-3 font-bold">Foto Keluar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reguAbsensiHistory.slice(0, 15).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {item.tanggal}
                    </td>
                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.reguName}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">{item.ulpName}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {item.petugasList?.map((p, i) => (
                        <span key={i} className="inline-block mr-2 text-[11px]">
                          <strong className="text-slate-800 dark:text-slate-200">{p.nama}</strong> ({p.keterangan})
                        </span>
                      ))}
                    </td>
                    <td className="p-3">
                      {item.fotoMasuk ? (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: formatDriveImageUrl(item.fotoMasuk!),
                                title: `Foto Masuk - ${item.reguName} (${item.tanggal})`,
                                driveUrl: formatDriveViewUrl(item.fotoMasuk!),
                              })
                            }
                            className="relative group block w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer shadow-xs"
                            title="Klik untuk memperbesar foto masuk"
                          >
                            <img
                              src={formatDriveImageUrl(item.fotoMasuk)}
                              alt="Foto Masuk"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </button>
                          <a
                            href={formatDriveViewUrl(item.fotoMasuk)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950 transition-colors"
                            title="Buka di Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Belum Ada</span>
                      )}
                    </td>
                    <td className="p-3">
                      {item.fotoKeluar ? (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: formatDriveImageUrl(item.fotoKeluar!),
                                title: `Foto Keluar - ${item.reguName} (${item.tanggal})`,
                                driveUrl: formatDriveViewUrl(item.fotoKeluar!),
                              })
                            }
                            className="relative group block w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer shadow-xs"
                            title="Klik untuk memperbesar foto keluar"
                          >
                            <img
                              src={formatDriveImageUrl(item.fotoKeluar)}
                              alt="Foto Keluar"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </button>
                          <a
                            href={formatDriveViewUrl(item.fotoKeluar)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                            title="Buka di Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Belum Ada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox / Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-teal-400" />
                <h4 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                  {previewImage.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-center bg-black/50 min-h-[300px] max-h-[70vh] overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-lg"
              />
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <a
                href={previewImage.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-md cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Full di Google Drive</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};
