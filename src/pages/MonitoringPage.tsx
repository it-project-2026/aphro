import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useAbsensi } from '../context/AbsensiContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useGASSync } from '../context/GASSyncContext';
import { useUI } from '../context/UIContext';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { StatusBadge } from '../components/common/StatusBadge';
import { WorkOrder, Realisasi } from '../types';
import { getLocalDateTimeString, formatDateDisplay } from '../utils/dateUtils';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Filter,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Scissors,
  TreeDeciduous,
  Table as TableIcon,
  Map as MapIcon,
  Eye,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

// Custom Marker Icon Generator using SVG
function createCustomMarkerIcon(status: string) {
  let color = '#64748b'; // Slate Belum
  if (status === 'Selesai') color = '#00A2B9'; // Teal Selesai
  else if (status === 'Sedang Dikerjakan') color = '#00C2DE'; // Teal Progress
  else if (status === 'Regu') color = '#EF4444'; // Red for Regu

  const svg = status === 'Regu' ? `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="8" height="12">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <path d="M12 7c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#ffffff" />
    </svg>
  ` : `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff" />
    </svg>
  `;

  return L.divIcon({
    className: `custom-leaflet-marker ${status === 'Regu' ? 'marker-blink' : ''}`,
    html: svg,
    iconSize: status === 'Regu' ? [8, 12] : [28, 42],
    iconAnchor: status === 'Regu' ? [4, 12] : [14, 42],
    popupAnchor: [0, -24],
  });
}

export const MonitoringPage: React.FC = () => {
  const draggable1 = useDraggableScroll();
  const draggable2 = useDraggableScroll();
  
  const { user: currentUser } = useAuth();
  const { workOrders, displayedWorkOrders } = useWorkOrders();
  const { realisasiList } = useRealisasi();
  const { absensiList } = useAbsensi();
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { settings } = useSettings();
  const { syncWithGAS } = useGASSync();
  const { setActiveTab } = useUI();

  const isUserRole = currentUser?.role === 'User';

  const [activeTab, setActiveTabMenu] = useState<'monitoring' | 'rekap_absensi'>('monitoring');
  const [activeViewMode, setActiveViewMode] = useState<'table' | 'map'>(
    isUserRole ? 'table' : 'table'
  );

  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // State for Rekap Absensi
  const [rekapMonth, setRekapMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [rekapYear, setRekapYear] = useState(new Date().getFullYear());

  const isAdmRole = (currentUser?.role || '').toUpperCase() === 'ADM' || (currentUser?.role || '').toUpperCase() === 'ADMIN' || (currentUser?.userName || '').toLowerCase() === 'admbkt';

  const { petugasList } = useMasterData();

  // Logic for Rekap Absensi
  const rekapData = useMemo(() => {
    const daysInMonth = new Date(rekapYear, rekapMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const presenceMap = new Map<string, Map<string, string>>();

    absensiList.forEach((abs) => {
      const matchesUlp = filterUlp === 'ALL' || abs.ulpName === filterUlp;
      const matchesRegu = filterRegu === 'ALL' || abs.reguName === filterRegu;
      if (!matchesUlp || !matchesRegu) return;

      const dateStr = String(abs.tanggal || '').slice(0, 10);
      if (dateStr.startsWith(`${rekapYear}-${String(rekapMonth).padStart(2, '0')}`)) {
        if (!presenceMap.has(dateStr)) presenceMap.set(dateStr, new Map());
        const officerStatuses = presenceMap.get(dateStr)!;
        
        if (Array.isArray(abs.petugasList)) {
          abs.petugasList.forEach((p) => {
            if (p.nama && p.nama !== '-') {
              officerStatuses.set(p.nama.trim().toLowerCase(), p.keterangan || 'HADIR');
            }
          });
        }
      }
    });

    const officerSet = new Map<string, { nama: string; reguName: string }>();
    petugasList.forEach(p => {
      const matchesUlp = filterUlp === 'ALL' || p.ulpName === filterUlp;
      const matchesRegu = filterRegu === 'ALL' || p.reguName === filterRegu;
      if (p.status === 'Aktif' && matchesUlp && matchesRegu) {
        officerSet.set(p.nama.trim().toLowerCase(), { nama: p.nama, reguName: p.reguName });
      }
    });

    const officers = Array.from(officerSet.values()).sort((a, b) => {
      const reguComp = a.reguName.localeCompare(b.reguName);
      if (reguComp !== 0) return reguComp;
      return a.nama.localeCompare(b.nama);
    });

    return { days, officers, presenceMap };
  }, [absensiList, petugasList, rekapMonth, rekapYear, filterUlp, filterRegu]);

  // 1. Deduplicate Work Orders to ensure each Nomor WO only appears once
  const uniqueWorkOrders = useMemo(() => {
    const baseList = isUserRole ? displayedWorkOrders : workOrders;
    const seen = new Map<string, WorkOrder>();

    baseList.forEach((wo) => {
      if (!wo) return;
      const woKey = (wo.nomorWO || '').trim().toUpperCase() || (wo.id || '').trim().toUpperCase();
      if (!woKey) return;

      if (!seen.has(woKey)) {
        seen.set(woKey, wo);
      } else {
        // Merge duplicate work orders taking the most complete details
        const existing = seen.get(woKey)!;
        const merged: WorkOrder = {
          ...existing,
          ...wo,
          ulpName: wo.ulpName || existing.ulpName,
          penyulangName: wo.penyulangName || existing.penyulangName,
          reguName: wo.reguName || existing.reguName,
          petugasName: wo.petugasName || existing.petugasName,
          status: (wo.status === 'Selesai' || existing.status === 'Selesai') ? 'Selesai' : (wo.status || existing.status),
          latitude: wo.latitude || existing.latitude,
          longitude: wo.longitude || existing.longitude,
        };
        seen.set(woKey, merged);
      }
    });

    return Array.from(seen.values());
  }, [isUserRole, displayedWorkOrders, workOrders]);

  // 2. Filtered unique WOs
  const filteredWOs = useMemo(() => {
    return uniqueWorkOrders.filter((wo) => {
      const matchesUlp = filterUlp === 'ALL' || wo.ulpId === filterUlp || wo.ulpName === filterUlp;
      const matchesPenyulang = filterPenyulang === 'ALL' || wo.penyulangId === filterPenyulang || wo.penyulangName === filterPenyulang;
      const matchesStatus = filterStatus === 'ALL' || wo.status === filterStatus;
      const matchesDate = !filterDate || (wo.tanggal && wo.tanggal.includes(filterDate));
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (wo.nomorWO || '').toLowerCase().includes(query) ||
        (wo.ulpName || '').toLowerCase().includes(query) ||
        (wo.penyulangName || '').toLowerCase().includes(query) ||
        (wo.jenisPekerjaan || '').toLowerCase().includes(query);

      return matchesUlp && matchesPenyulang && matchesStatus && matchesDate && matchesSearch;
    });
  }, [uniqueWorkOrders, filterUlp, filterPenyulang, filterStatus, filterDate, searchQuery]);

  // 3. Calculate totals across filtered WOs with deduplicated realisasi items
  const woMonitoringRows = useMemo(() => {
    return filteredWOs.map((wo) => {
      const woNomorClean = (wo.nomorWO || '').trim().toUpperCase();

      const matchedRealisasi = realisasiList.filter((r) => {
        if (!r) return false;
        const matchId = r.workOrderId && r.workOrderId === wo.id;
        const rNoWoClean = (r.nomorWO || '').trim().toUpperCase();
        const matchNoWo = Boolean(woNomorClean && rNoWoClean && rNoWoClean === woNomorClean);
        return matchId || matchNoWo;
      });

      // Deduplicate realisasi items to prevent double counting
      const seenRel = new Set<string>();
      const uniqueRelList = matchedRealisasi.filter((r) => {
        // Use ID if available, otherwise combine fields including createdAt to ensure uniqueness
        const key = r.id || `${r.nomorWO}-${r.createdAt || ''}-${r.fotoSebelumUrl}-${r.fotoSesudahUrl}-${r.noTiang || ''}-${r.keterangan || ''}`;
        if (seenRel.has(key)) return false;
        seenRel.add(key);
        return true;
      });

      const totalTebang = uniqueRelList.filter((r) => {
        const ket = (r.keterangan || '').toUpperCase();
        return ket.includes('TEBANG');
      }).length;

      const totalPotong = uniqueRelList.filter((r) => {
        const ket = (r.keterangan || '').toUpperCase();
        return ket.includes('POTONG') || ket.includes('PANGKAS');
      }).length;

      // TOTAL REALISASI should at least be the count of unique records
      const totalRealisasiCount = Math.max(uniqueRelList.length, totalTebang + totalPotong);

      return {
        workOrder: wo,
        nomorWO: wo.nomorWO,
        tanggal: wo.tanggal,
        ulpName: wo.ulpName || '-',
        penyulangName: wo.penyulangName || '-',
        totalRealisasiCount,
        totalTebang,
        totalPotong,
      };
    });
  }, [filteredWOs, realisasiList]);

  const grandTotalRealisasi = useMemo(
    () => woMonitoringRows.reduce((acc, row) => acc + row.totalRealisasiCount, 0),
    [woMonitoringRows]
  );
  const grandTotalTebang = useMemo(
    () => woMonitoringRows.reduce((acc, row) => acc + row.totalTebang, 0),
    [woMonitoringRows]
  );
  const grandTotalPotong = useMemo(
    () => woMonitoringRows.reduce((acc, row) => acc + row.totalPotong, 0),
    [woMonitoringRows]
  );

  // Map Center (Padang, West Sumatra default)
  const mapCenter: [number, number] = [-0.92, 100.4];

  const mapPolylinePositions: [number, number][] = useMemo(() => {
    return filteredWOs
      .filter((wo) => wo.latitude && wo.longitude)
      .map((wo) => [wo.latitude as number, wo.longitude as number]);
  }, [filteredWOs]);

  const activeReguLocations = useMemo(() => {
    // Sesuai Tanggal saat Login (Today)
    const today = getLocalDateTimeString().slice(0, 10);
    
    // For ADMIN, show latest from REALISASI for ALL regus
    if (currentUser?.role === 'Admin') {
      const reguNamesFromRealisasi = Array.from(new Set(realisasiList.map(r => r.reguName)));
      return reguNamesFromRealisasi.map(name => {
        const latestRel = realisasiList
          .filter(r => r.reguName === name && r.latitude && r.longitude)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        if (latestRel) {
          return {
            name,
            lat: latestRel.latitude,
            lon: latestRel.longitude,
            lastUpdate: latestRel.createdAt,
            type: 'Realisasi'
          };
        }
        return null;
      }).filter(Boolean);
    }

    // For USER/OTHERS: Get active regu based on today's attendance
    let todayAbsensi = absensiList.filter(a => a.tanggal && formatDateDisplay(a.tanggal) === today);
    
    // Filter by Unit Layanan (Inisiasi)
    const effectiveUlpFilter = filterUlp;

    if (effectiveUlpFilter !== 'ALL') {
      todayAbsensi = todayAbsensi.filter(a => {
        const reguInfo = reguList.find(r => r.namaRegu === a.reguName);
        return reguInfo?.ulpName === effectiveUlpFilter || a.ulpName === effectiveUlpFilter;
      });
    }
    
    // Unique regus that have checked in today
    const activeReguNames = Array.from(new Set(todayAbsensi.map(a => a.reguName)));
    
    return activeReguNames.map(name => {
      // Find latest activity for this regu
      const reguRealisasi = realisasiList
        .filter(r => r.reguName === name && formatDateDisplay(r.tanggalRealisasi || r.createdAt) === today)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const latestRel = reguRealisasi[0];
      const reguAbsen = todayAbsensi.find(a => a.reguName === name);

      // Explicitly compare timestamps to find the absolute last known location
      const absTime = reguAbsen ? new Date(reguAbsen.createdAt).getTime() : 0;
      const relTime = latestRel ? new Date(latestRel.createdAt).getTime() : 0;

      const isRelLatest = latestRel && relTime >= absTime;
      const latestData = isRelLatest ? latestRel : reguAbsen;

      if (latestData?.latitude && latestData?.longitude) {
        return {
          name,
          lat: latestData.latitude,
          lon: latestData.longitude,
          lastUpdate: latestData.createdAt,
          type: isRelLatest ? 'Realisasi' : 'Absensi'
        };
      }
      return null;
    }).filter(Boolean);
  }, [absensiList, realisasiList, filterUlp, reguList, currentUser, settings.namaUnitLayanan]);

  // Helper component to handle map bounds/zoom
  const MapBoundsHandler = ({ locations }: { locations: any[] }) => {
    const map = useMap();
    
    useEffect(() => {
      if (locations.length > 0) {
        const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lon]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }, [locations, map]);
    
    return null;
  };

  // Auto-refresh coordinates every 5 minutes when page is active
  useEffect(() => {
    if (!navigator.onLine || !settings.gasWebAppUrl) return;

    const interval = setInterval(() => {
      syncWithGAS();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [syncWithGAS, settings.gasWebAppUrl]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#00A2B9]/5 backdrop-blur-sm p-6 rounded-3xl border-2 border-[#00A2B9]/10 shadow-sm no-print">
        <div>
          <div className="flex items-center space-x-2 text-[#00A2B9] dark:text-teal-400">
            <BarChart3 className="w-6 h-6" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
              {activeTab === 'monitoring' ? 'Monitoring Realisasi Pekerjaan' : 'Rekapitulasi Absensi Personil'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'monitoring' 
              ? 'Ringkasan & Tabel Isi Realisasi per Work Order (Total Realisasi, Tebang, dan Pangkas).'
              : 'Rekapitulasi kehadiran personil regu dalam satu bulan penuh.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTabMenu('monitoring')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
              activeTab === 'monitoring'
                ? 'bg-[#00A2B9] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Monitoring Pekerjaan</span>
          </button>
          {isAdmRole && (
            <button
              type="button"
              onClick={() => setActiveTabMenu('rekap_absensi')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                activeTab === 'rekap_absensi'
                  ? 'bg-[#00A2B9] text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Rekap Absensi</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'monitoring' ? (
        <>
          {/* View Mode Toggle (Table / Map) */}
          {!isUserRole && (
            <div className="flex justify-end no-print">
              <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveViewMode('table')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                    activeViewMode === 'table'
                      ? 'bg-[#00A2B9]/10 text-[#008396] border border-[#00A2B9]/20'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <TableIcon className="w-4 h-4" />
                  <span>Tabel Realisasi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('map')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                    activeViewMode === 'map'
                      ? 'bg-[#00A2B9]/10 text-[#008396] border border-[#00A2B9]/20'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  <span>Peta GIS Field</span>
                </button>
              </div>
            </div>
          )}

          {/* Overview Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Work Order</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display">
                {woMonitoringRows.length} <span className="text-xs font-bold text-slate-400">WO</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#00A2B9]/5 dark:bg-teal-950/40 border border-[#00A2B9]/20 dark:border-teal-800 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#00A2B9] dark:text-teal-400 uppercase tracking-wider">Total Realisasi</span>
              <div className="text-xl sm:text-2xl font-black text-teal-900 dark:text-teal-200 font-display">
                {grandTotalRealisasi} <span className="text-xs font-bold text-[#00A2B9] dark:text-teal-400">Titik</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#00A2B9]/5 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#008396] dark:text-teal-400 uppercase tracking-wider flex items-center space-x-1">
                <TreeDeciduous className="w-3.5 h-3.5" />
                <span>Total Tebang</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-teal-900 dark:text-teal-200 font-display">
                {grandTotalTebang} <span className="text-xs font-bold text-[#008396] dark:text-teal-400">Pohon</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Scissors className="w-3.5 h-3.5" />
                <span>Total Pangkas</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-display">
                {grandTotalPotong} <span className="text-xs font-bold text-slate-400">Titik/Pohon</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 no-print">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Cari Work Order</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nomor WO, ULP, Penyulang..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter Tanggal</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter ULP</label>
                <select
                  value={filterUlp}
                  onChange={(e) => {
                    setFilterUlp(e.target.value);
                    setFilterPenyulang('ALL');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                >
                  <option value="ALL">Semua ULP</option>
                  {ulpList.map((u, idx) => (
                    <option key={`${u.id}-${idx}`} value={u.namaULP || u.id}>
                      {u.namaULP}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter Penyulang</label>
                <select
                  value={filterPenyulang}
                  onChange={(e) => setFilterPenyulang(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                >
                  <option value="ALL">Semua Penyulang</option>
                  {penyulangList
                    .filter(p => filterUlp === 'ALL' || p.ulpName === filterUlp || p.ulpId === filterUlp)
                    .map((p, idx) => (
                    <option key={`${p.id}-${idx}`} value={p.namaPenyulang || p.id}>
                      {p.namaPenyulang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter Status WO</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                >
                  <option value="ALL">Semua Status WO</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
                  <option value="Belum Dikerjakan">Belum Dikerjakan</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          {activeViewMode === 'table' ? (
            /* TABLE REALISASI PER WORK ORDER */
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between no-print">
                <div className="flex items-center space-x-2">
                  <TableIcon className="w-5 h-5 text-[#00A2B9] dark:text-teal-400" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Tabel Realisasi per Work Order ({woMonitoringRows.length})
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  Sinkron dengan Data Google Spreadsheet
                </span>
              </div>

              <div 
                ref={draggable1.ref}
                onMouseDown={draggable1.onMouseDown}
                onMouseUp={draggable1.onMouseUp}
                onMouseLeave={draggable1.onMouseLeave}
                onMouseMove={draggable1.onMouseMove}
                className="overflow-x-auto"
                style={draggable1.style}
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-extrabold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Nama Work Order</th>
                      <th className="py-3.5 px-4">Tanggal</th>
                      <th className="py-3.5 px-4">ULP</th>
                      <th className="py-3.5 px-4">Penyulang</th>
                      <th className="py-3.5 px-4 text-center">Total Realisasi</th>
                      <th className="py-3.5 px-4 text-center">Total Tebang</th>
                      <th className="py-3.5 px-4 text-center">Total Pangkas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {woMonitoringRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          Tidak ada data Work Order yang sesuai filter
                        </td>
                      </tr>
                    ) : (
                      woMonitoringRows.map((row, idx) => (
                        <tr
                          key={`${row.workOrder.id}-${idx}`}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-[#008396] dark:text-teal-400">
                            <div className="flex flex-col">
                              <span className="text-xs font-black">{row.nomorWO}</span>
                              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                {row.workOrder.jenisPekerjaan || 'Pemangkasan Pohon (ROW)'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {formatDateDisplay(row.tanggal)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-800 dark:text-slate-200 font-semibold">
                            {row.ulpName}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {row.penyulangName}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-[#00A2B9]/10 dark:bg-teal-950/80 text-[#008396] dark:text-teal-300 border border-[#00A2B9]/20 dark:border-teal-800">
                              {row.totalRealisasiCount} Titik
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-[#00A2B9]/10 dark:bg-teal-950/80 text-[#008396] dark:text-teal-300 border border-[#00A2B9]/20 dark:border-teal-800">
                              {row.totalTebang} Pohon
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {row.totalPotong} Titik/Pohon
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {woMonitoringRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-extrabold border-t-2 border-slate-200 dark:border-slate-700">
                        <td colSpan={4} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                          Total Keseluruhan :
                        </td>
                        <td className="py-3.5 px-4 text-center text-[#00A2B9] dark:text-teal-400">
                          {grandTotalRealisasi} Titik
                        </td>
                        <td className="py-3.5 px-4 text-center text-[#008396] dark:text-teal-400">
                          {grandTotalTebang} Pohon
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-400">
                          {grandTotalPotong} Titik/Pohon
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            /* MAP GIS VIEW */
            <div className="space-y-6 no-print">
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-2">
                <div className="h-[520px] w-full rounded-2xl overflow-hidden relative">
                  {/* Floating Overlay Badge */}
                  <div className="absolute top-3 right-3 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl border border-slate-300 dark:border-slate-700 shadow-md text-[11px] space-y-1 font-sans text-slate-800 dark:text-slate-200">
                    <p className="font-extrabold flex items-center space-x-1">
                      <span>⚡ JARINGAN TR & PETA GIS</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">Total Lokasi: <span className="font-extrabold text-[#00A2B9]">{filteredWOs.length} Titik</span></p>
                    <p className="text-slate-600 dark:text-slate-400">Regu Aktif: <span className="font-extrabold text-[#00A2B9]">{activeReguLocations.length} Regu</span></p>
                    <p className="text-amber-600 dark:text-amber-400 font-extrabold pt-1 border-t border-slate-200 dark:border-slate-700">
                      ⚡ Jaringan Listrik TR (Tegangan Rendah) PLN
                    </p>
                  </div>

                  <MapContainer
                    center={mapCenter}
                    zoom={11}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <MapBoundsHandler locations={activeReguLocations} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {mapPolylinePositions.length > 1 && (
                      <>
                        {/* Dark Casing Outer Line */}
                        <Polyline
                          positions={mapPolylinePositions}
                          color="#0f172a"
                          weight={6}
                          opacity={0.85}
                        />
                        {/* Orange-Yellow Jaringan TR PLN Line */}
                        <Polyline
                          positions={mapPolylinePositions}
                          color="#f59e0b"
                          weight={3.5}
                          opacity={1}
                          dashArray="8, 6"
                        />
                      </>
                    )}

                    {filteredWOs.map((wo, idx) => {
                      const rel = realisasiList.find((r) => r.workOrderId === wo.id);
                      const customIcon = createCustomMarkerIcon(wo.status);

                      return (
                        <Marker
                          key={`${wo.id}-${idx}`}
                          position={[wo.latitude || -0.92, wo.longitude || 100.4]}
                          icon={customIcon}
                        >
                          <Popup>
                            <div className="p-1 space-y-2 max-w-xs font-sans">
                              <div className="border-b border-slate-200 pb-1 flex items-center justify-between">
                                <span className="font-extrabold text-[#008396] text-xs">
                                  {wo.nomorWO}
                                </span>
                                <StatusBadge status={wo.status} size="sm" />
                              </div>

                              <div className="space-y-1 text-xs">
                                <p className="font-bold text-slate-900 leading-tight">
                                  {wo.penyulangName} - {wo.ulpName}
                                </p>
                                <p className="text-slate-600 text-[11px]">📍 {wo.lokasi || 'Lokasi Field'}</p>
                                <p className="text-slate-500 text-[10px]">
                                  👤 Regu: {wo.reguName}
                                </p>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}

                    {/* Live Regu Markers */}
                    {activeReguLocations.map((regu: any, idx: number) => (
                      <Marker
                        key={`regu-${regu.name}-${idx}`}
                        position={[regu.lat, regu.lon]}
                        icon={createCustomMarkerIcon('Regu')}
                      >
                        <Tooltip permanent direction="top" offset={[0, -40]} className="bg-[#00A2B9] text-white font-bold border-none rounded-lg px-2 py-1 shadow-md text-[10px]">
                          {regu.name}
                        </Tooltip>
                        <Popup>
                          <div className="p-2 space-y-2 min-w-[180px] font-sans">
                            <div className="border-b border-slate-200 pb-1 flex items-center justify-between">
                              <span className="font-black text-[#008396] text-sm italic">
                                LIVE TRACKING
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-[#00A2B9]/10 text-[#008396] text-[10px] font-black uppercase">
                                AKTIF
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-slate-900 uppercase">
                                {regu.name}
                              </p>
                              <div className="flex items-center space-x-1.5 text-[11px] text-slate-600">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Update: {new Date(regu.lastUpdate).toLocaleTimeString('id-ID')}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span>Sumber: {regu.type}</span>
                              </p>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* VIEW 3: REKAP ABSENSI MONTHLY GRID */
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-6 space-y-6 print:p-0 print:border-none print:shadow-none print-content">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; }
              table { border-collapse: collapse !important; width: 100% !important; }
              th, td { border: 1px solid black !important; color: black !important; font-size: 8px !important; padding: 2px !important; }
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
            ref={draggable2.ref}
            onMouseDown={draggable2.onMouseDown}
            onMouseUp={draggable2.onMouseUp}
            onMouseLeave={draggable2.onMouseLeave}
            onMouseMove={draggable2.onMouseMove}
            className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl print:border-none"
            style={draggable2.style}
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
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-teal-600">Total Hadir</th>
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-amber-600">Total Izin</th>
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-rose-600">Total Sakit</th>
                  <th className="p-1 border border-slate-300 dark:border-slate-600 text-center w-12 bg-slate-600">Total Alfa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                {rekapData.officers.length === 0 ? (
                  <tr>
                    <td colSpan={rekapData.days.length + 7} className="p-8 text-center text-slate-400 italic">
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
                          const status = rekapData.presenceMap.get(dateKey)?.get(officer.nama.trim().toLowerCase());
                          
                          let cellText = '-';
                          let cellClass = 'text-slate-300 dark:text-slate-600';
                          
                          if (status === 'HADIR') {
                            cellText = 'H';
                            cellClass = 'text-teal-600 dark:text-teal-400 font-black';
                            totalHadir++;
                          } else if (status === 'IZIN') {
                            cellText = 'I';
                            cellClass = 'text-amber-600 dark:text-amber-400 font-black';
                            totalIzin++;
                          } else if (status === 'SAKIT') {
                            cellText = 'S';
                            cellClass = 'text-rose-600 dark:text-rose-400 font-black';
                            totalSakit++;
                          } else if (status === 'TIDAK HADIR' || status === 'ALPHA' || status === 'ALFA') {
                            cellText = 'A';
                            cellClass = 'text-slate-400 dark:text-slate-500 font-black';
                            totalAlfa++;
                          } else {
                            // Check if it's already passed or today
                            const cellDate = new Date(rekapYear, rekapMonth - 1, d);
                            if (cellDate <= new Date()) {
                              // Optional: Mark as A if no record found for past days
                              // cellText = 'A';
                              // totalAlfa++;
                            }
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
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-slate-600">{totalAlfa}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-500 no-print">
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
    </div>
  );
};
