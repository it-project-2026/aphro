import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMasterData } from '../context/MasterDataContext';
import { useAbsensi } from '../context/AbsensiContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { formatDriveViewUrl, formatDriveImageUrl } from '../utils/driveUtils';
import { generateWatermarkedImage } from '../utils/watermark';
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
  Table as TableIcon,
  Search,
  Filter,
  FileSpreadsheet,
  Eye,
  X,
  Image as ImageIcon,
} from 'lucide-react';

interface AbsensiMainPageProps {
  initialSubTab?: 'absensi_pulang' | 'monitoring_absensi';
}

function formatHariTanggal(dateStr: string) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const hari = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const tgl = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${hari}, ${tgl}`;
  } catch {
    return dateStr;
  }
}

export const AbsensiMainPage: React.FC<AbsensiMainPageProps> = ({ initialSubTab = 'absensi_pulang' }) => {
  const { user: currentUser } = useAuth();
  const { absensiList, addAbsensi } = useAbsensi();
  const { ulpList, reguList } = useMasterData();
  const { showToast } = useToast();

  const isAdmRole = (currentUser?.role || '').toUpperCase() === 'ADM' || (currentUser?.userName || '').toLowerCase() === 'admbkt';

  const [activeSubTab, setActiveSubTab] = useState<'absensi_pulang' | 'monitoring_absensi'>(
    isAdmRole ? 'monitoring_absensi' : initialSubTab
  );

  useEffect(() => {
    if (isAdmRole) {
      setActiveSubTab('monitoring_absensi');
    } else {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, isAdmRole]);

  const todayStr = new Date().toISOString().slice(0, 10);
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

  // Find today's existing Absensi record
  const todayAbsensi = absensiList.find((a) => {
    if (!a) return false;
    const isToday = String(a.tanggal || '').slice(0, 10) === todayStr;
    const matchRegu = cleanStr(a.reguName) === userReguClean;
    const matchUser =
      cleanStr(a.userName) === cleanStr(currentUser?.userName || currentUser?.nip || currentUser?.id) ||
      cleanStr(a.namaPetugas) === cleanStr(currentUser?.name);
    return isToday && (matchRegu || matchUser);
  });

  // State for Foto Pulang upload
  const [fotoKeluar, setFotoKeluar] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; driveUrl: string } | null>(null);

  // Filters for Monitoring Absensi Table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');

  // Dynamic unique regu options
  const allReguOptions = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(reguList)) {
      reguList.forEach((r) => {
        if (r?.namaRegu && r.namaRegu.trim()) set.add(r.namaRegu.trim());
      });
    }
    if (Array.isArray(absensiList)) {
      absensiList.forEach((a) => {
        if (a?.reguName && a.reguName.trim()) set.add(a.reguName.trim());
      });
    }
    return Array.from(set).sort();
  }, [reguList, absensiList]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        setFotoKeluar(watermarkedBase64);
        showToast('Foto Pulang berhasil diambil & diberi watermark GPS!', 'success');
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

  const handleSubmitFotoPulang = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fotoKeluar && !todayAbsensi?.fotoKeluar) {
      showToast('Mohon lampirkan Foto Pulang (Kamera / File) terlebih dahulu!', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      await addAbsensi({
        tanggal: todayStr,
        reguName: todayAbsensi?.reguName || reguName,
        penyulangName: todayAbsensi?.penyulangName || (currentUser as any)?.penyulangName || 'Penyulang Pauh Utama',
        ulpName: todayAbsensi?.ulpName || ulpName,
        userName: currentUser?.userName || currentUser?.nip || currentUser?.id,
        namaPetugas: currentUser?.name,
        nip: currentUser?.nip,
        petugasList: todayAbsensi?.petugasList || [],
        fotoMasuk: todayAbsensi?.fotoMasuk || '',
        fotoKeluar: fotoKeluar || todayAbsensi?.fotoKeluar || '',
      });

      showToast('Absensi Pulang (Foto Pulang) berhasil disimpan & disinkronkan!', 'success');
      setFotoKeluar('');
      
      // Auto redirect to Monitoring Absensi after checkout
      setActiveSubTab('monitoring_absensi');
    } catch (err: any) {
      showToast(`Gagal menyimpan Foto Pulang: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUserRole = (currentUser?.role || 'User').toUpperCase() === 'USER';

  // Filtered Absensi List for Monitoring Table
  const filteredAbsensiList = useMemo(() => {
    // 1. Basic filter based on user role and search query
    const baseList = absensiList.filter((item) => {
      if (!item) return false;

      // Role-based user filter: if role === 'USER', only show entries for the logged-in user's Regu / account
      if (isUserRole) {
        const itemReguClean = cleanStr(item.reguName);
        const itemUserClean = cleanStr(item.userName);
        const activeUserClean = cleanStr(currentUser?.userName || currentUser?.nip || currentUser?.id);
        const activeNameClean = cleanStr(currentUser?.name);

        const isExactRegu = (item.reguName || '').trim().toLowerCase() === reguName.trim().toLowerCase();
        const isCleanReguMatch = Boolean(userReguClean && itemReguClean && itemReguClean === userReguClean);
        const isUserMatch = Boolean(activeUserClean && itemUserClean && itemUserClean === activeUserClean);
        const isNameMatch = Boolean(activeNameClean && cleanStr(item.namaPetugas) === activeNameClean);
        const isNipMatch = Boolean(currentUser?.nip && item.nip && item.nip === currentUser.nip);
        const isPetugasMemberMatch = Boolean(
          activeNameClean &&
          Array.isArray(item.petugasList) &&
          item.petugasList.some((p: any) => cleanStr(p.nama) === activeNameClean)
        );

        const belongsToUser = isExactRegu || isCleanReguMatch || isUserMatch || isNameMatch || isNipMatch || isPetugasMemberMatch;
        if (!belongsToUser) return false;
      }

      // ULP Filter
      const matchesUlp = filterUlp === 'ALL' || (item.ulpName || '').toLowerCase().includes(filterUlp.toLowerCase());

      // Regu Filter
      const matchesRegu = filterRegu === 'ALL' || cleanStr(item.reguName) === cleanStr(filterRegu);

      // Search Query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (item.tanggal || '').toLowerCase().includes(query) ||
        (item.ulpName || '').toLowerCase().includes(query) ||
        (item.reguName || '').toLowerCase().includes(query) ||
        item.petugasList?.some((p) => (p.nama || '').toLowerCase().includes(query));

      return matchesUlp && matchesRegu && matchesSearch;
    });

    // 2. Deduplicate: Ensure only one row per (Tanggal + Regu)
    // This addresses the user request: "update existing row instead of creating a new row"
    // even if the backend might have sent multiple rows.
    const uniqueMap = new Map<string, typeof baseList[0]>();
    
    // Sort by updatedAt descending so we keep the freshest one
    const sorted = [...baseList].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    for (const item of sorted) {
      const datePart = (item.tanggal || '').slice(0, 10);
      const reguPart = cleanStr(item.reguName);
      const key = `${datePart}_${reguPart}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      } else {
        // Merge entries if one has fotoMasuk and other has fotoKeluar
        const existing = uniqueMap.get(key)!;
        uniqueMap.set(key, {
          ...existing,
          fotoMasuk: existing.fotoMasuk || item.fotoMasuk,
          fotoKeluar: existing.fotoKeluar || item.fotoKeluar,
          petugasList: (existing.petugasList && existing.petugasList.length > 0) ? existing.petugasList : item.petugasList,
          timestampMasuk: existing.timestampMasuk || item.timestampMasuk,
          timestampKeluar: existing.timestampKeluar || item.timestampKeluar,
        });
      }
    }

    return Array.from(uniqueMap.values());
  }, [absensiList, isUserRole, reguName, userReguClean, currentUser, filterUlp, filterRegu, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Sub-tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
            <UserCheck className="w-6 h-6" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
              {isAdmRole ? 'Monitoring Absensi Setiap Nama Regu' : 'Halaman Absensi Regu'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmRole
              ? 'Monitoring riwayat dan status absensi kehadiran setiap Nama Regu operasional.'
              : 'Pilih menu Absensi Pulang untuk kirim foto pulang atau Monitoring Absensi untuk melihat data absensi.'}
          </p>
        </div>

        {/* Tab Buttons (hidden if isAdmRole to ensure exclusive access to Monitoring) */}
        {!isAdmRole && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveSubTab('absensi_pulang')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                activeSubTab === 'absensi_pulang'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>ABSENSI PULANG</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('monitoring_absensi')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                activeSubTab === 'monitoring_absensi'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>MONITORING ABSENSI</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: ABSENSI PULANG */}
      {activeSubTab === 'absensi_pulang' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-2">
                  <LogOut className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Absensi Pulang (Foto Pulang)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Unggah/Ambil Foto Pulang saat jam kerja shift regu berakhir.
                </p>
              </div>

              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 self-start sm:self-center">
                <Calendar className="w-4 h-4" />
                <span>Tanggal: {todayStr}</span>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nama Regu</span>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>{reguName}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ULP Kerja</span>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <span>{ulpName}</span>
                </div>
              </div>
            </div>

            {/* Status Foto Pulang Terunggah */}
            {todayAbsensi?.fotoKeluar && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                      Foto Pulang Hari Ini Sudah Terunggah
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Waktu Keluar: {todayAbsensi.timestampKeluar || todayAbsensi.createdAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-700 bg-black">
                    <img
                      src={formatDriveImageUrl(todayAbsensi.fotoKeluar)}
                      alt="Foto Pulang"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <a
                    href={formatDriveViewUrl(todayAbsensi.fotoKeluar)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Lihat Foto Pulang</span>
                  </a>
                </div>
              </div>
            )}

            {/* Upload Form for Foto Pulang */}
            <form onSubmit={handleSubmitFotoPulang} className="space-y-6">
              <div className="p-5 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
                      <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Input Foto Pulang *</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Silakan ambil foto selfie / regu saat jam pulang kerja.
                    </p>
                  </div>
                  {(fotoKeluar || todayAbsensi?.fotoKeluar) && (
                    <button
                      type="button"
                      onClick={() => setFotoKeluar('')}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Ganti Foto"
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
                        alt="Foto Pulang"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-indigo-600/90 text-white text-[10px] font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Foto Pulang Siap Disimpan</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl aspect-video max-w-md mx-auto flex flex-col items-center justify-center cursor-pointer p-6 transition-all bg-white dark:bg-slate-900 group">
                    <div className="p-3.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-2">
                      <Camera className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Buka Kamera / Pilih Foto Pulang
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Format foto JPG / PNG
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isSubmitting ? 'Menyimpan Foto Pulang...' : 'Kirim Foto Pulang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: MONITORING ABSENSI TABLE */}
      {activeSubTab === 'monitoring_absensi' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-2">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Tabel Monitoring Absensi {isUserRole ? `- ${reguName} ` : ''}({filteredAbsensiList.length})
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isUserRole
                  ? `Menampilkan riwayat absensi khusus untuk ${reguName} (${currentUser?.name || currentUser?.userName || 'Petugas'}).`
                  : 'Data kehadiran regu, status Petugas 1 s.d 5, serta Foto Masuk & Foto Keluar.'}
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-52">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Tanggal / Regu / Petugas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              <select
                value={filterUlp}
                onChange={(e) => setFilterUlp(e.target.value)}
                className="w-full sm:w-36 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              >
                <option value="ALL">Semua ULP</option>
                {ulpList.map((u, idx) => (
                  <option key={`${u.id}-${idx}`} value={u.namaULP}>
                    {u.namaULP}
                  </option>
                ))}
              </select>

              {!isUserRole && (
                <select
                  value={filterRegu}
                  onChange={(e) => setFilterRegu(e.target.value)}
                  className="w-full sm:w-44 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
                >
                  <option value="ALL">Semua Nama Regu</option>
                  {allReguOptions.map((r, idx) => (
                    <option key={`${r}-${idx}`} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Table Container with Horizontal Scroll */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700">Hari / Tanggal</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700">ULP</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700">Penyulang</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700">Nama Regu</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-sky-50 dark:bg-sky-950/40">
                    Nama Petugas 1
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-sky-50 dark:bg-sky-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-950/40">
                    Nama Petugas 2
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/40">
                    Nama Petugas 3
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/40">
                    Nama Petugas 4
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-950/40">
                    Nama Petugas 5
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">Foto Masuk</th>
                  <th className="p-3 text-center">Foto Keluar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-medium text-slate-800 dark:text-slate-200">
                {filteredAbsensiList.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="p-8 text-center text-slate-400 text-xs">
                      Belum ada data Absensi yang terekam
                    </td>
                  </tr>
                ) : (
                  filteredAbsensiList.map((item, idx) => {
                    const getPetugasFromItem = (itemData: any, index: number) => {
                      const idxOneBased = index + 1;
                      if (
                        Array.isArray(itemData.petugasList) &&
                        itemData.petugasList[index] &&
                        itemData.petugasList[index].nama &&
                        itemData.petugasList[index].nama !== '-'
                      ) {
                        return {
                          nama: itemData.petugasList[index].nama,
                          keterangan: itemData.petugasList[index].keterangan || 'HADIR',
                        };
                      }

                      const namaVal =
                        itemData[`PETUGAS_${idxOneBased}`] ||
                        itemData[`Petugas_${idxOneBased}`] ||
                        itemData[`NAMA_PETUGAS_${idxOneBased}`] ||
                        itemData[`nama_petugas_${idxOneBased}`] ||
                        itemData[`petugas_${idxOneBased}`];

                      const ketVal =
                        itemData[`KETERANGAN_${idxOneBased}`] ||
                        itemData[`Keterangan_${idxOneBased}`] ||
                        itemData[`STATUS_${idxOneBased}`] ||
                        itemData[`Status_${idxOneBased}`] ||
                        itemData[`keterangan_${idxOneBased}`] ||
                        'HADIR';

                      if (namaVal && String(namaVal).trim() !== '-' && String(namaVal).trim() !== '') {
                        return {
                          nama: String(namaVal),
                          keterangan: String(ketVal),
                        };
                      }

                      if (index === 0 && itemData.namaPetugas && itemData.namaPetugas !== '-') {
                        return {
                          nama: String(itemData.namaPetugas),
                          keterangan: 'HADIR',
                        };
                      }

                      return {
                        nama: '-',
                        keterangan: '-',
                      };
                    };

                    const p1 = getPetugasFromItem(item, 0);
                    const p2 = getPetugasFromItem(item, 1);
                    const p3 = getPetugasFromItem(item, 2);
                    const p4 = getPetugasFromItem(item, 3);
                    const p5 = getPetugasFromItem(item, 4);

                    const ulpVal = item.ulpName || (item as any).ULP || (item as any).namaULP || '-';
                    const penyulangVal = item.penyulangName || (item as any).PENYULANG || (item as any).Penyulang || (item as any).namaPenyulang || '-';
                    const reguVal = item.reguName || (item as any).NAMA_REGU || (item as any).Nama_Regu || (item as any).Regu || '-';

                    const renderStatusBadge = (ket?: string) => {
                      if (!ket || ket === '-') return <span className="text-slate-400 text-[10px]">-</span>;
                      let badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                      if (ket === 'SAKIT') badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                      if (ket === 'IZIN') badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
                      if (ket === 'TIDAK HADIR') badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';

                      return (
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${badgeClass}`}>
                          {ket}
                        </span>
                      );
                    };

                    return (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="p-3 font-bold border-r border-slate-200 dark:border-slate-700">
                          {formatHariTanggal(item.tanggal)}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                          {ulpVal}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                          {penyulangVal}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                          {reguVal}
                        </td>

                        {/* Petugas 1 */}
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                          {p1.nama}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                          {renderStatusBadge(p1.keterangan)}
                        </td>

                        {/* Petugas 2 */}
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                          {p2.nama}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                          {renderStatusBadge(p2.keterangan)}
                        </td>

                        {/* Petugas 3 */}
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                          {p3.nama}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                          {renderStatusBadge(p3.keterangan)}
                        </td>

                        {/* Petugas 4 */}
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                          {p4.nama}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                          {renderStatusBadge(p4.keterangan)}
                        </td>

                        {/* Petugas 5 */}
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                          {p5.nama}
                        </td>
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700">
                          {renderStatusBadge(p5.keterangan)}
                        </td>

                        {/* Foto Masuk */}
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">
                          {item.fotoMasuk ? (
                            <div className="inline-flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    url: formatDriveImageUrl(item.fotoMasuk!),
                                    title: `Foto Masuk - ${item.reguName} (${item.tanggal})`,
                                    driveUrl: formatDriveViewUrl(item.fotoMasuk!),
                                  })
                                }
                                className="relative group block w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:scale-105 transition-transform bg-slate-100 dark:bg-slate-900 cursor-pointer"
                                title="Klik untuk memperbesar Foto Masuk"
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
                                className="p-1 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950 transition-colors"
                                title="Buka di Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Foto Keluar */}
                        <td className="p-3 text-center">
                          {item.fotoKeluar ? (
                            <div className="inline-flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    url: formatDriveImageUrl(item.fotoKeluar!),
                                    title: `Foto Keluar - ${item.reguName} (${item.tanggal})`,
                                    driveUrl: formatDriveViewUrl(item.fotoKeluar!),
                                  })
                                }
                                className="relative group block w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:scale-105 transition-transform bg-slate-100 dark:bg-slate-900 cursor-pointer"
                                title="Klik untuk memperbesar Foto Keluar"
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
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                                title="Buka di Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
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
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-md cursor-pointer"
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
  );
};
