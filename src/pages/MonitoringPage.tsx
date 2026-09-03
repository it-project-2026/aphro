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
import { OptimizedMapView, MapPointItem } from '../components/common/OptimizedMapView';
import { WorkOrder, Realisasi } from '../types';
import { getLocalDateTimeString, formatDateDisplay, normalizeDateISO, getWIBDateString } from '../utils/dateUtils';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  if (status === 'Selesai' || status === 'SELESAI') color = '#00A2B9'; // Teal Selesai
  else if (status === 'Sedang Dikerjakan') color = '#F59E0B'; // Amber Progress
  else if (status === 'Regu') color = '#EF4444'; // Red for Regu
  else color = '#3B82F6'; // Blue Belum Dikerjakan

  if (status === 'Regu') {
    const reguHtml = `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: rgba(239, 68, 68, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="position: relative; width: 30px; height: 30px; border-radius: 9999px; background-color: #EF4444; border: 2px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25); display: flex; align-items: center; justify-content: center; color: white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
      </div>
    `;
    return L.divIcon({
      className: 'custom-regu-leaflet-marker',
      html: reguHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff" />
    </svg>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: svg,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
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

  const [activeViewMode, setActiveViewMode] = useState<'table' | 'map'>(
    isUserRole ? 'table' : 'table'
  );

  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  // Default today in WIB for User, empty for Admin to see all
  const [filterDate, setFilterDate] = useState(currentUser?.role === 'User' ? getWIBDateString() : '');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmRole = (currentUser?.role || '').toUpperCase() === 'ADM' || (currentUser?.role || '').toUpperCase() === 'ADMIN' || (currentUser?.userName || '').toLowerCase() === 'admbkt';

  const { petugasList } = useMasterData();

  // Helper to normalize strings for robust matching
  const cleanStr = (s?: string | null) => {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/gi, '');
  };

  // 1. Deduplicate Work Orders to ensure each Nomor WO only appears once, and synthetic WOs from Realisasi are included
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

    // Also inject synthetic Work Orders for any Realisasi whose nomorWO / workOrderId is not in seen
    realisasiList.forEach((r) => {
      if (!r) return;
      const rKey = (r.nomorWO || '').trim().toUpperCase() || (r.workOrderId || '').trim().toUpperCase();
      if (!rKey) return;

      if (!seen.has(rKey)) {
        seen.set(rKey, {
          id: r.workOrderId || `wo-syn-${rKey}`,
          nomorWO: r.nomorWO || rKey,
          tanggal: r.tanggalRealisasi || r.createdAt || getWIBDateString(),
          ulpId: '',
          ulpName: r.ulpName || '-',
          penyulangId: '',
          penyulangName: r.penyulangName || '-',
          reguId: '',
          reguName: r.reguName || '-',
          status: r.status || 'Selesai',
          progressPercent: 100,
          createdAt: r.createdAt || getLocalDateTimeString(),
        });
      }
    });

    return Array.from(seen.values());
  }, [isUserRole, displayedWorkOrders, workOrders, realisasiList]);

  // 2. Filtered unique WOs
  const filteredWOs = useMemo(() => {
    return uniqueWorkOrders.filter((wo) => {
      const matchesUlp = filterUlp === 'ALL' || cleanStr(wo.ulpId) === cleanStr(filterUlp) || cleanStr(wo.ulpName) === cleanStr(filterUlp);
      const matchesPenyulang = filterPenyulang === 'ALL' || cleanStr(wo.penyulangId) === cleanStr(filterPenyulang) || cleanStr(wo.penyulangName) === cleanStr(filterPenyulang);
      const matchesRegu = filterRegu === 'ALL' || cleanStr(wo.reguName) === cleanStr(filterRegu);
      const matchesStatus = filterStatus === 'ALL' || wo.status === filterStatus;

      // Robust date matching
      const woDateIso = normalizeDateISO(wo.tanggal);
      const matchesWoDate = Boolean(filterDate) && (
        woDateIso === filterDate ||
        Boolean(wo.tanggal && String(wo.tanggal).includes(filterDate))
      );

      const woNomorClean = (wo.nomorWO || '').trim().toUpperCase();
      const hasRealisasiOnDate = Boolean(filterDate) && realisasiList.some((r) => {
        if (!r) return false;
        const matchId = r.workOrderId && r.workOrderId === wo.id;
        const rNoWoClean = (r.nomorWO || '').trim().toUpperCase();
        const matchNoWo = Boolean(woNomorClean && rNoWoClean && rNoWoClean === woNomorClean);
        if (!matchId && !matchNoWo) return false;

        const rDateIso = normalizeDateISO(r.tanggalRealisasi || r.createdAt);
        return rDateIso === filterDate || Boolean(r.tanggalRealisasi && String(r.tanggalRealisasi).includes(filterDate));
      });

      const matchesDate = !filterDate || matchesWoDate || hasRealisasiOnDate;
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (wo.nomorWO || '').toLowerCase().includes(query) ||
        (wo.ulpName || '').toLowerCase().includes(query) ||
        (wo.penyulangName || '').toLowerCase().includes(query) ||
        (wo.jenisPekerjaan || '').toLowerCase().includes(query);

      return matchesUlp && matchesPenyulang && matchesRegu && matchesStatus && matchesDate && matchesSearch;
    });
  }, [uniqueWorkOrders, realisasiList, filterUlp, filterPenyulang, filterRegu, filterStatus, filterDate, searchQuery]);

  // 3. Calculate totals across filtered WOs with deduplicated realisasi items
  const woMonitoringRows = useMemo(() => {
    return filteredWOs.map((wo) => {
      const woNomorClean = (wo.nomorWO || '').trim().toUpperCase();

      const matchedRealisasi = realisasiList.filter((r) => {
        if (!r) return false;
        const matchId = r.workOrderId && r.workOrderId === wo.id;
        const rNoWoClean = (r.nomorWO || '').trim().toUpperCase();
        const matchNoWo = Boolean(woNomorClean && rNoWoClean && rNoWoClean === woNomorClean);
        if (!matchId && !matchNoWo) return false;

        if (filterDate) {
          const rDateIso = normalizeDateISO(r.tanggalRealisasi || r.createdAt);
          const woDateIso = normalizeDateISO(wo.tanggal);
          if (rDateIso === filterDate) return true;
          if (woDateIso === filterDate && (!r.tanggalRealisasi || rDateIso === woDateIso)) return true;
          return false;
        }

        return true;
      });

      // Deduplicate realisasi items to prevent double counting
      const seenRel = new Set<string>();
      const uniqueRelList = matchedRealisasi.filter((r) => {
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
  }, [filteredWOs, realisasiList, filterDate]);

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

  // Today ISO date in WIB (YYYY-MM-DD)
  const todayISO = useMemo(() => getWIBDateString(), []);

  // 4. Dedicated Work Orders for GIS Field: ONLY TODAY & Status BELUM SELESAI
  const mapWOs = useMemo(() => {
    return uniqueWorkOrders.filter((wo) => {
      // Must be TODAY
      const isToday = normalizeDateISO(wo.tanggal) === todayISO;
      if (!isToday) return false;

      // Must be Status BELUM SELESAI (exclude Selesai / SELESAI)
      const s = (wo.status || '').trim().toUpperCase();
      const isBelumSelesai = s !== 'SELESAI';
      if (!isBelumSelesai) return false;

      // Match dropdown filter selections
      const matchesUlp = filterUlp === 'ALL' || cleanStr(wo.ulpId) === cleanStr(filterUlp) || cleanStr(wo.ulpName) === cleanStr(filterUlp);
      const matchesPenyulang = filterPenyulang === 'ALL' || cleanStr(wo.penyulangId) === cleanStr(filterPenyulang) || cleanStr(wo.penyulangName) === cleanStr(filterPenyulang);
      const matchesRegu = filterRegu === 'ALL' || cleanStr(wo.reguName) === cleanStr(filterRegu);
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (wo.nomorWO || '').toLowerCase().includes(query) ||
        (wo.ulpName || '').toLowerCase().includes(query) ||
        (wo.penyulangName || '').toLowerCase().includes(query) ||
        (wo.jenisPekerjaan || '').toLowerCase().includes(query);

      return matchesUlp && matchesPenyulang && matchesRegu && matchesSearch;
    });
  }, [uniqueWorkOrders, todayISO, filterUlp, filterPenyulang, filterRegu, searchQuery]);

  // 5. Active Regu ROW Locations for TODAY with Status BELUM SELESAI
  const activeReguLocations = useMemo(() => {
    // Unique Regu from today's Belum Selesai Work Orders
    const reguNamesFromTodayUnfinishedWOs = Array.from(
      new Set(mapWOs.map(wo => (wo.reguName || '').trim()))
    ).filter(Boolean);

    if (reguNamesFromTodayUnfinishedWOs.length === 0) return [];

    return reguNamesFromTodayUnfinishedWOs.map(name => {
      const targetName = name.toUpperCase();

      // Find latest realization of TODAY with coordinates for this Regu
      const latestRelToday = realisasiList
        .filter(r => {
          if ((r.reguName || '').trim().toUpperCase() !== targetName) return false;
          if (!r.latitude || !r.longitude) return false;
          const relDate = normalizeDateISO(r.tanggalRealisasi || r.createdAt);
          return relDate === todayISO;
        })
        .sort((a, b) => new Date(b.createdAt || b.tanggalRealisasi || 0).getTime() - new Date(a.createdAt || a.tanggalRealisasi || 0).getTime())[0];

      if (latestRelToday) {
        return {
          name,
          lat: latestRelToday.latitude,
          lon: latestRelToday.longitude,
          lastUpdate: latestRelToday.createdAt || latestRelToday.tanggalRealisasi,
          type: 'Realisasi Lapangan Hari Ini',
          nomorWO: latestRelToday.nomorWO || '-',
          keterangan: latestRelToday.keterangan || '-'
        };
      }

      // Fallback to latest attendance of TODAY with coordinates
      const latestAbsToday = absensiList
        .filter(a => {
          if ((a.reguName || '').trim().toUpperCase() !== targetName) return false;
          if (!a.latitude || !a.longitude) return false;
          const absDate = normalizeDateISO(a.tanggal || a.createdAt);
          return absDate === todayISO;
        })
        .sort((a, b) => new Date(b.createdAt || b.tanggal || 0).getTime() - new Date(a.createdAt || a.tanggal || 0).getTime())[0];

      if (latestAbsToday) {
        return {
          name,
          lat: latestAbsToday.latitude,
          lon: latestAbsToday.longitude,
          lastUpdate: latestAbsToday.createdAt || latestAbsToday.tanggal,
          type: 'Absensi Regu (Check-In Hari Ini)',
          petugas: latestAbsToday.namaPetugas || '-'
        };
      }

      // Fallback: If no realization/attendance recorded today yet, use WO coordinates for today's unfinished work
      const woWithCoords = mapWOs.find(wo => (wo.reguName || '').trim().toUpperCase() === targetName && wo.latitude && wo.longitude);
      if (woWithCoords) {
        return {
          name,
          lat: woWithCoords.latitude,
          lon: woWithCoords.longitude,
          lastUpdate: woWithCoords.tanggal,
          type: 'Titik Rencana WO Hari Ini',
          nomorWO: woWithCoords.nomorWO
        };
      }

      return null;
    }).filter(Boolean);
  }, [mapWOs, realisasiList, absensiList, todayISO]);

  const mapPolylinePositions: [number, number][] = useMemo(() => {
    return mapWOs
      .filter((wo) => wo.latitude && wo.longitude)
      .map((wo) => [wo.latitude as number, wo.longitude as number]);
  }, [mapWOs]);

  const allMapLocations = useMemo(() => {
    const pts: { lat: number; lon: number }[] = [];
    activeReguLocations.forEach((r: any) => {
      if (r && r.lat && r.lon) pts.push({ lat: r.lat, lon: r.lon });
    });
    mapWOs.forEach((w) => {
      if (w.latitude && w.longitude) pts.push({ lat: w.latitude, lon: w.longitude });
    });
    return pts;
  }, [activeReguLocations, mapWOs]);

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

  const mapPointItems = useMemo<MapPointItem[]>(() => {
    const items: MapPointItem[] = [];

    // 1. Work Orders Hari Ini (Status Belum Selesai)
    mapWOs.forEach((wo) => {
      if (wo.latitude && wo.longitude) {
        items.push({
          id: `wo-${wo.id}`,
          lat: wo.latitude,
          lng: wo.longitude,
          type: 'wo',
          title: wo.nomorWO || 'Work Order',
          subtitle: `${wo.penyulangName || ''} - ${wo.ulpName || ''}`,
          status: wo.status || 'Belum Dikerjakan',
          ulpName: wo.ulpName,
          penyulangName: wo.penyulangName,
          reguName: wo.reguName,
          lokasi: wo.lokasi || 'Lokasi Field',
          tanggal: wo.tanggal,
          raw: wo,
        });
      }
    });

    // 2. Active Regu ROW
    activeReguLocations.forEach((regu: any) => {
      if (regu && regu.lat && regu.lon) {
        items.push({
          id: `regu-${regu.name}`,
          lat: regu.lat,
          lng: regu.lon,
          type: 'regu',
          title: regu.name,
          subtitle: `Sumber: ${regu.type}`,
          status: 'Regu',
          reguName: regu.name,
          lokasi: regu.keterangan || regu.type,
          lastUpdate: regu.lastUpdate,
          raw: regu,
        });
      }
    });

    return items;
  }, [mapWOs, activeReguLocations]);

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
              Monitoring Realisasi Pekerjaan
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ringkasan & Tabel Isi Realisasi per Work Order (Total Realisasi, Tebang, dan Pangkas).
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all bg-[#00A2B9] text-white shadow-md"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Monitoring Pekerjaan</span>
          </button>
        </div>
      </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Cari Work Order</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nomor WO, Lokasi..."
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
                    setFilterRegu('ALL');
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
                    .filter(p => filterUlp === 'ALL' || cleanStr(p.ulpName) === cleanStr(filterUlp) || cleanStr(p.ulpId) === cleanStr(filterUlp))
                    .map((p, idx) => (
                    <option key={`${p.id}-${idx}`} value={p.namaPenyulang || p.id}>
                      {p.namaPenyulang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter Regu ROW</label>
                <select
                  value={filterRegu}
                  onChange={(e) => setFilterRegu(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00A2B9]"
                >
                  <option value="ALL">Semua Regu</option>
                  {reguList
                    .filter(r => filterUlp === 'ALL' || cleanStr(r.ulpName) === cleanStr(filterUlp))
                    .map((r, idx) => (
                    <option key={`${r.id}-${idx}`} value={r.namaRegu || r.id}>
                      {r.namaRegu}
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
            /* MAP GIS VIEW (LIGHTWEIGHT CANVAS & BOUNDING-BOX CLUSTERING) */
            <div className="space-y-6 no-print">
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-2">
                <OptimizedMapView
                  points={mapPointItems}
                  polylinePositions={mapPolylinePositions}
                  badgeTitle="⚡ PETA GIS ROW (CANVAS & CLUSTERING)"
                  height="560px"
                  tileProvider="osm"
                />
              </div>
            </div>
          )}
        </>
    </div>
  );
};
