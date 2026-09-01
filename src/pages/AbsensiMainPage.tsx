import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMasterData } from '../context/MasterDataContext';
import { useAbsensi } from '../context/AbsensiContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { formatDriveViewUrl, formatDriveImageUrl } from '../utils/driveUtils';
import { generateWatermarkedImage } from '../utils/watermark';
import { normalizeDateISO, getLocalDateTimeString } from '../utils/dateUtils';
import { ImagePreviewModal } from '../components/common/ImagePreviewModal';
import {
  UserCheck,
  Calendar,
  Users,
  Camera,
  CheckCircle2,
  Trash2,
  Pencil,
  Plus,
  Building2,
  LogOut,
  Clock,
  Table as TableIcon,
  Search,
  Filter,
  FileSpreadsheet,
  Eye,
} from 'lucide-react';

interface AbsensiMainPageProps {
  initialSubTab?: 'absensi_pulang' | 'monitoring_absensi' | 'rekap_absensi';
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
  const draggable1 = useDraggableScroll();
  const draggable2 = useDraggableScroll();

  const { user: currentUser } = useAuth();
  const { absensiList, addAbsensi, updateAbsensi, deleteAbsensi } = useAbsensi();
  const { ulpList, reguList, petugasList } = useMasterData();
  const { showToast } = useToast();

  const [editingAbsensi, setEditingAbsensi] = useState<any | null>(null);

  const isAdmRole = (currentUser?.role || '').toUpperCase() === 'ADM' || (currentUser?.role || '').toUpperCase() === 'ADMIN' || (currentUser?.userName || '').toLowerCase() === 'admbkt';

  const [activeSubTab, setActiveSubTab] = useState<'absensi_pulang' | 'monitoring_absensi' | 'rekap_absensi'>(
    initialSubTab !== 'absensi_pulang' ? initialSubTab : (isAdmRole ? 'monitoring_absensi' : 'absensi_pulang')
  );

  useEffect(() => {
    if (isAdmRole) {
      setActiveSubTab('monitoring_absensi');
    } else {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, isAdmRole]);

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

  // State for Rekap Absensi
  const [rekapMonth, setRekapMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [rekapYear, setRekapYear] = useState(new Date().getFullYear());

  // Filters for Monitoring & Rekap Absensi Table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');

  // Logic to calculate days and presence for Rekap Absensi
  const rekapData = useMemo(() => {
    const daysInMonth = new Date(rekapYear, rekapMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Group absensi by date and officer
    // Map: YYYY-MM-DD -> OfficerName -> Status
    const presenceMap = new Map<string, Map<string, string>>();

    // Helper to normalize names for robust matching
    const normalizeName = (name: string) => {
      if (!name) return '';
      // Remove all non-alphanumeric characters and lowercase for strict comparison
      return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const cleanCompare = (s1: string, s2: string) => {
      return (s1 || '').trim().toLowerCase() === (s2 || '').trim().toLowerCase();
    };

    absensiList.forEach((abs) => {
      // Filter by ULP/Regu if needed
      const matchesUlp = filterUlp === 'ALL' || cleanCompare(abs.ulpName, filterUlp);
      const matchesRegu = filterRegu === 'ALL' || cleanCompare(abs.reguName, filterRegu);
      
      if (!matchesUlp || !matchesRegu) return;

      const dateStr = normalizeDateISO(abs.tanggal);
      if (dateStr.startsWith(`${rekapYear}-${String(rekapMonth).padStart(2, '0')}`)) {
        if (!presenceMap.has(dateStr)) {
          presenceMap.set(dateStr, new Map());
        }
        const officerStatuses = presenceMap.get(dateStr)!;
        
        if (Array.isArray(abs.petugasList)) {
          abs.petugasList.forEach((p) => {
            if (p.nama && p.nama !== '-') {
              const key = normalizeName(p.nama);
              if (key) {
                officerStatuses.set(key, p.keterangan || 'HADIR');
              }
            }
          });
        }
      }
    });

    // Get unique officers
    const officerSet = new Map<string, { nama: string; reguName: string }>();
    
    // Add from master data (Sheet PETUGAS)
    petugasList.forEach(p => {
      // ONLY include active officers if requested, but at least ensure they match ULP/Regu
      const matchesUlp = filterUlp === 'ALL' || cleanCompare(p.ulpName, filterUlp);
      const matchesRegu = filterRegu === 'ALL' || cleanCompare(p.reguName, filterRegu);
      
      // We only show officers from master data that match current filters
      if (p.nama && p.nama.trim() !== '' && p.nama.trim() !== '-' && matchesUlp && matchesRegu) {
        const key = normalizeName(p.nama);
        if (key) {
          officerSet.set(key, { nama: p.nama.trim(), reguName: p.reguName || 'Tanpa Regu' });
        }
      }
    });

    const officers = Array.from(officerSet.values()).sort((a, b) => {
      const reguComp = a.reguName.localeCompare(b.reguName);
      if (reguComp !== 0) return reguComp;
      return a.nama.localeCompare(b.nama);
    });

    return { days, officers, presenceMap };
  }, [absensiList, petugasList, rekapMonth, rekapYear, filterUlp, filterRegu]);

  // Filters for Monitoring Absensi Table (Already declared above now)

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
        timestampMasuk: todayAbsensi?.timestampMasuk || '',
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

      const itemDateNormalized = normalizeDateISO(item.tanggal);

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
      const matchesUlp = filterUlp === 'ALL' || (item.ulpName || '').trim().toLowerCase() === filterUlp.trim().toLowerCase();

      // Regu Filter
      const matchesRegu = filterRegu === 'ALL' || (item.reguName || '').trim().toLowerCase() === filterRegu.trim().toLowerCase();

      // Search Query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        itemDateNormalized.includes(query) ||
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
      const datePart = normalizeDateISO(item.tanggal);
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

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const dateA = new Date(a.tanggal || 0).getTime();
      const dateB = new Date(b.tanggal || 0).getTime();
      return dateB - dateA;
    });
  }, [absensiList, isUserRole, reguName, userReguClean, currentUser, filterUlp, filterRegu, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Sub-tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00A2B9] dark:text-teal-400">
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

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          {!isAdmRole && (
            <button
              type="button"
              onClick={() => setActiveSubTab('absensi_pulang')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                activeSubTab === 'absensi_pulang'
                  ? 'bg-[#00A2B9] text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" />
              <span>ABSENSI PULANG</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveSubTab('monitoring_absensi')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
              activeSubTab === 'monitoring_absensi'
                ? 'bg-[#00A2B9] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>MONITORING ABSENSI</span>
          </button>
          {isAdmRole && (
            <button
              type="button"
              onClick={() => setActiveSubTab('rekap_absensi')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                activeSubTab === 'rekap_absensi'
                  ? 'bg-[#00A2B9] text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>REKAP ABSENSI</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: ABSENSI PULANG */}
      {activeSubTab === 'absensi_pulang' && !isAdmRole && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-2">
                  <LogOut className="w-5 h-5 text-[#00A2B9] dark:text-teal-400" />
                  <span>Absensi Pulang (Foto Pulang)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Unggah/Ambil Foto Pulang saat jam kerja shift regu berakhir.
                </p>
              </div>

              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-xs font-bold text-[#008396] dark:text-teal-300 self-start sm:self-center">
                <Calendar className="w-4 h-4" />
                <span>Tanggal: {todayStr}</span>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nama Regu</span>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#00A2B9]" />
                  <span>{reguName}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ULP Kerja</span>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-[#00A2B9]" />
                  <span>{ulpName}</span>
                </div>
              </div>
            </div>

            {/* Status Foto Pulang Terunggah */}
            {todayAbsensi?.fotoKeluar && (
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-[#00A2B9] text-white shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#008396] dark:text-teal-200">
                      Foto Pulang Hari Ini Sudah Terunggah
                    </h4>
                    <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">
                      Waktu Keluar: {todayAbsensi.timestampKeluar || todayAbsensi.createdAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-center shrink-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-teal-300 dark:border-teal-700 bg-black cursor-pointer" onClick={() => setPreviewImage({
                      url: formatDriveImageUrl(todayAbsensi.fotoKeluar),
                      title: `Foto Pulang - ${reguName} (${todayStr})`,
                      driveUrl: formatDriveViewUrl(todayAbsensi.fotoKeluar)
                    })}>
                    <img
                      src={formatDriveImageUrl(todayAbsensi.fotoKeluar)}
                      alt="Foto Pulang"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Upload Form for Foto Pulang */}
            <form onSubmit={handleSubmitFotoPulang} className="space-y-6">
              <div className="p-5 rounded-3xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
                      <Camera className="w-4 h-4 text-[#00A2B9] dark:text-teal-400" />
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
                      <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-[#00A2B9]/90 text-white text-[10px] font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Foto Pulang Siap Disimpan</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-teal-300 dark:border-teal-700 hover:border-[#00A2B9] dark:hover:border-teal-400 rounded-2xl aspect-video max-w-md mx-auto flex flex-col items-center justify-center cursor-pointer p-6 transition-all bg-white dark:bg-slate-900 group">
                    <div className="p-3.5 rounded-2xl bg-teal-100 dark:bg-teal-950/80 text-[#00A2B9] dark:text-teal-400 group-hover:scale-110 transition-transform mb-2">
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
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#00A2B9] hover:bg-[#008396] text-white font-extrabold text-sm shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isSubmitting ? 'Menyimpan Foto Pulang...' : 'Kirim Foto Pulang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 3: REKAP ABSENSI MONTHLY GRID */}
      {activeSubTab === 'rekap_absensi' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-6 space-y-6 print:p-0 print:border-none print:shadow-none print-content">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; }
              table { border-collapse: collapse !important; width: 100% !important; }
              th, td { border: 1px solid black !important; color: black !important; }
              .bg-[#0070C0] { background-color: #0070C0 !important; color: white !important; -webkit-print-color-adjust: exact; }
              .bg-[#005a9c] { background-color: #005a9c !important; color: white !important; -webkit-print-color-adjust: exact; }
            }
          ` }} />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4 no-print">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-[#00A2B9] dark:text-teal-400" />
                <span>Rekap Absensi Bulanan</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rekapitulasi kehadiran personil regu dalam satu bulan penuh.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={filterUlp}
                  onChange={(e) => setFilterUlp(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
                >
                  <option value="ALL">Semua ULP</option>
                  {ulpList.map(u => (
                    <option key={u.id} value={u.namaULP}>{u.namaULP}</option>
                  ))}
                </select>
                <select
                  value={filterRegu}
                  onChange={(e) => setFilterRegu(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
                >
                  <option value="ALL">Semua Regu</option>
                  {reguList.filter(r => filterUlp === 'ALL' || r.ulpName === filterUlp).map(r => (
                    <option key={r.id} value={r.namaRegu}>{r.namaRegu}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={rekapMonth}
                  onChange={(e) => setRekapMonth(Number(e.target.value))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
                >
                  {[
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                  ].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={rekapYear}
                  onChange={(e) => setRekapYear(Number(e.target.value))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#00A2B9] text-white hover:bg-[#008396] shadow-md flex items-center space-x-2 transition-all text-xs font-bold"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Cetak Laporan</span>
              </button>
            </div>
          </div>

          {/* Print Header */}
          <div className="hidden print:block text-center mb-6 border-b-2 border-slate-900 pb-4">
            <h1 className="text-xl font-bold uppercase">REKAPITULASI ABSENSI PERSONIL</h1>
            <h2 className="text-lg font-bold uppercase">BULAN: {[
              'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
              'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ][rekapMonth - 1]} {rekapYear}</h2>
            {filterUlp !== 'ALL' && <p className="text-sm font-bold uppercase">UNIT: {filterUlp}</p>}
          </div>

          <div 
            ref={draggable1.ref}
            onMouseDown={draggable1.onMouseDown}
            onMouseUp={draggable1.onMouseUp}
            onMouseLeave={draggable1.onMouseLeave}
            onMouseMove={draggable1.onMouseMove}
            className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl print:border-none"
            style={draggable1.style}
          >
            <table className="w-full text-[10px] border-collapse min-w-[1200px] print:min-w-full">
              <thead>
                <tr className="bg-[#0070C0] text-white">
                  <th rowSpan={2} className="p-2 border border-slate-300 dark:border-slate-600 text-center w-10">No. Urut</th>
                  <th rowSpan={2} className="p-2 border border-slate-300 dark:border-slate-600 text-center min-w-[120px]">Nama Regu</th>
                  <th rowSpan={2} className="p-2 border border-slate-300 dark:border-slate-600 text-center min-w-[150px]">Nama Petugas</th>
                  <th colSpan={rekapData.days.length} className="p-1 border border-slate-300 dark:border-slate-600 text-center bg-[#005a9c]">
                    Tanggal Pekerjaan (Bulan: {[
                      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                    ][rekapMonth - 1]} {rekapYear})
                  </th>
                  <th colSpan={4} className="p-2 border border-slate-300 dark:border-slate-600 text-center">Rekapitulasi</th>
                </tr>
                <tr className="bg-[#0070C0] text-white">
                  {rekapData.days.map(d => {
                    const date = new Date(rekapYear, rekapMonth - 1, d);
                    const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });
                    return (
                      <th key={d} className="p-1 border border-slate-300 dark:border-slate-600 text-center w-8">
                        <div className="text-[8px] opacity-80 uppercase">{dayName.slice(0, 3)}</div>
                        <div>{d}</div>
                      </th>
                    );
                  })}
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-teal-600">Hadir</th>
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-amber-600">Izin</th>
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-rose-600">Sakit</th>
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-slate-600">Alfa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                {rekapData.officers.length === 0 ? (
                  <tr>
                    <td colSpan={rekapData.days.length + 6} className="p-8 text-center text-slate-400 italic">
                      Data petugas tidak ditemukan untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  rekapData.officers.map((officer, idx) => {
                    let totalHadir = 0;
                    let totalIzin = 0;
                    let totalSakit = 0;
                    let totalAlfa = 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">{officer.reguName}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white sticky left-0 bg-inherit shadow-sm">{officer.nama}</td>
                        
                        {rekapData.days.map(d => {
                          const dateKey = `${rekapYear}-${String(rekapMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          // Helper to normalize names for robust matching (must match logic in useMemo)
                          const normalizeName = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                          const status = rekapData.presenceMap.get(dateKey)?.get(normalizeName(officer.nama));
                          
                          let cellText = '-';
                          let cellClass = 'text-slate-300 dark:text-slate-600';
                          
                          const statusUpper = (status || '').toUpperCase().trim();
                          
                          if (statusUpper === 'HADIR' || statusUpper.startsWith('HADIR')) {
                            cellText = 'H';
                            cellClass = 'text-teal-600 dark:text-teal-400 font-black';
                            totalHadir++;
                          } else if (statusUpper === 'IZIN' || statusUpper.startsWith('IZIN')) {
                            cellText = 'I';
                            cellClass = 'text-amber-600 dark:text-amber-400 font-black';
                            totalIzin++;
                          } else if (statusUpper === 'SAKIT' || statusUpper.startsWith('SAKIT')) {
                            cellText = 'S';
                            cellClass = 'text-rose-600 dark:text-rose-400 font-black';
                            totalSakit++;
                          } else if (statusUpper.includes('TIDAK HADIR') || statusUpper.includes('ALPHA') || statusUpper.includes('ALFA')) {
                            cellText = 'A';
                            cellClass = 'text-slate-400 dark:text-slate-500 font-black';
                            totalAlfa++;
                          } else if (statusUpper && statusUpper !== '-') {
                            // Custom status: show first letter
                            cellText = statusUpper.charAt(0);
                            cellClass = 'text-violet-600 dark:text-violet-400 font-black';
                            totalHadir++; 
                          }

                          return (
                            <td key={d} className={`p-1 border border-slate-200 dark:border-slate-700 text-center ${cellClass}`}>
                              {cellText}
                            </td>
                          );
                        })}

                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-teal-600">{totalHadir}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-amber-600">{totalIzin}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-rose-600">{totalSakit}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-slate-500">{totalAlfa}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-teal-100 dark:bg-teal-900 border border-teal-600 rounded-xs flex items-center justify-center text-teal-600 font-black">H</div>
              <span>Hadir</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-amber-100 dark:bg-amber-900 border border-amber-600 rounded-xs flex items-center justify-center text-amber-600 font-black">I</div>
              <span>Izin</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-rose-100 dark:bg-rose-900 border border-rose-600 rounded-xs flex items-center justify-center text-rose-600 font-black">S</div>
              <span>Sakit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-slate-100 dark:bg-slate-800 border border-slate-400 rounded-xs flex items-center justify-center text-slate-400 font-black">A</div>
              <span>Alpha / Tidak Hadir</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MONITORING ABSENSI TABLE */}
      {activeSubTab === 'monitoring_absensi' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-2">
                <Clock className="w-5 h-5 text-[#00A2B9] dark:text-teal-400" />
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

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {!isUserRole && (
                <button
                  onClick={() => setEditingAbsensi({
                    tanggal: todayStr,
                    ulpName: ulpList[0]?.namaULP || '',
                    reguName: '',
                    petugasList: [],
                    isManual: true
                  })}
                  className="flex items-center gap-2 px-4 py-2 bg-[#005a9c] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:bg-[#004a80] transition-all w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Manual
                </button>
              )}
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
          <div 
            ref={draggable2.ref}
            onMouseDown={draggable2.onMouseDown}
            onMouseUp={draggable2.onMouseUp}
            onMouseLeave={draggable2.onMouseLeave}
            onMouseMove={draggable2.onMouseMove}
            className="overflow-x-auto"
            style={draggable2.style}
          >
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700">Hari / Tanggal</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700">ULP</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700">Nama Regu</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Nama Petugas 1
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Nama Petugas 2
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Nama Petugas 3
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Nama Petugas 4
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-teal-50 dark:bg-teal-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-950/40">
                    Nama Petugas 5
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-950/40">
                    Keterangan
                  </th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">Foto Masuk</th>
                  <th className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">Foto Keluar</th>
                  <th className="p-3 text-center sticky right-0 bg-slate-100 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] z-10">Aksi</th>
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
                      const ketUpper = ket.toUpperCase();
                      let badgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                      
                      if (ketUpper === 'HADIR') badgeClass = 'bg-teal-100 text-[#008396] dark:bg-teal-950 dark:text-teal-300';
                      else if (ketUpper === 'SAKIT') badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                      else if (ketUpper === 'IZIN') badgeClass = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
                      else if (ketUpper === 'TIDAK HADIR' || ketUpper === 'ALFA' || ketUpper === 'ALPHA') badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
                      else if (ketUpper !== 'HADIR') badgeClass = 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300';

                      return (
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] whitespace-normal ${badgeClass}`}>
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
                            <div className="inline-flex items-center justify-center">
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
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Foto Keluar */}
                        <td className="p-3 border-r border-slate-200 dark:border-slate-700 text-center">
                          {item.fotoKeluar ? (
                            <div className="inline-flex items-center justify-center">
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
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setEditingAbsensi(item)}
                              className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors dark:bg-teal-900/30 dark:text-teal-400"
                              title="Edit Status"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={async () => {
                                if (window.confirm('Hapus data absensi ini? Perubahan akan langsung sinkron ke Spreadsheet.')) {
                                  await deleteAbsensi(item.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors dark:bg-rose-900/30 dark:text-rose-400"
                              title="Hapus Absensi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Edit/Add Absensi Modal */}
      {editingAbsensi && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {editingAbsensi.isManual ? (
                  <Plus className="w-4 h-4 text-teal-500" />
                ) : (
                  <Pencil className="w-4 h-4 text-[#005a9c]" />
                )}
                {editingAbsensi.isManual ? 'Tambah Absensi Manual' : 'Edit Status Absensi Manual'}
              </h3>
              <button onClick={() => setEditingAbsensi(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <LogOut className="w-5 h-5 rotate-90" />
              </button>
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingAbsensi.isManual && !editingAbsensi.reguName) {
                  showToast('Harap pilih Regu terlebih dahulu', 'warning');
                  return;
                }
                setIsSubmitting(true);
                if (editingAbsensi.isManual) {
                  const { isManual, ...data } = editingAbsensi;
                  await addAbsensi(data);
                } else {
                  await updateAbsensi(editingAbsensi.id, { petugasList: editingAbsensi.petugasList });
                }
                setIsSubmitting(false);
                setEditingAbsensi(null);
              }}
              className="flex flex-col h-full"
            >
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-slate-400 mb-1">Tanggal <span className="text-red-500">*</span></p>
                    {editingAbsensi.isManual ? (
                      <input 
                        type="date"
                        required
                        value={editingAbsensi.tanggal}
                        onChange={(e) => setEditingAbsensi({...editingAbsensi, tanggal: e.target.value})}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 font-bold outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    ) : (
                      <p className="font-bold text-slate-700 dark:text-slate-200">{editingAbsensi.tanggal}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">ULP <span className="text-red-500">*</span></p>
                    {editingAbsensi.isManual ? (
                      <select
                        required
                        value={editingAbsensi.ulpName}
                        onChange={(e) => setEditingAbsensi({...editingAbsensi, ulpName: e.target.value, reguName: '', petugasList: []})}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-1 font-bold outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="">Pilih ULP</option>
                        {ulpList.map(u => <option key={u.id} value={u.namaULP}>{u.namaULP}</option>)}
                      </select>
                    ) : (
                      <p className="font-bold text-slate-700 dark:text-slate-200">{editingAbsensi.ulpName}</p>
                    )}
                  </div>
                </div>

                {editingAbsensi.isManual && (
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-slate-400 mb-1 text-xs font-bold uppercase tracking-tighter">Pilih Regu <span className="text-red-500">*</span></p>
                    <select
                      required
                      value={editingAbsensi.reguName}
                      onChange={(e) => {
                        const selectedReguName = e.target.value;
                        const members = petugasList
                          .filter(p => p.reguName === selectedReguName)
                          .map(p => ({
                            nama: p.nama,
                            keterangan: 'HADIR'
                          }));
                        setEditingAbsensi({
                          ...editingAbsensi, 
                          reguName: selectedReguName,
                          petugasList: members
                        });
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 font-bold text-xs outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="">-- Pilih Regu --</option>
                      {reguList
                        .filter(r => !editingAbsensi.ulpName || r.ulpName === editingAbsensi.ulpName)
                        .map(r => (
                          <option key={r.id} value={r.namaRegu}>{r.namaRegu}</option>
                        ))
                      }
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Daftar Petugas & Status</p>
                  {(editingAbsensi.petugasList || []).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic text-center py-2">Pilih Regu terlebih dahulu</p>
                  )}
                  {(editingAbsensi.petugasList || []).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.nama}</span>
                      <select
                        required
                        value={p.keterangan || 'HADIR'}
                        onChange={(e) => {
                          const newList = [...(editingAbsensi.petugasList || [])];
                          newList[i] = { ...newList[i], keterangan: e.target.value };
                          setEditingAbsensi({ ...editingAbsensi, petugasList: newList });
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold focus:ring-2 focus:ring-[#005a9c] outline-none"
                      >
                        <option value="HADIR">HADIR</option>
                        <option value="SAKIT">SAKIT</option>
                        <option value="IZIN">IZIN</option>
                        <option value="TIDAK HADIR">TIDAK HADIR</option>
                        <option value="CUTI">CUTI</option>
                        <option value="DINAS LUAR">DINAS LUAR</option>
                        <option value="ALFA">ALFA</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAbsensi(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#005a9c] text-white font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-[#004a80] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : (editingAbsensi.isManual ? 'Tambah Absensi' : 'Simpan Perubahan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || ''}
        title={previewImage?.title}
      />
    </div>
  );
};
