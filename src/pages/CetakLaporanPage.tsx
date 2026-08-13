import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useGASSync } from '../context/GASSyncContext';
import { useToast } from '../hooks/useToast';
import { MapReportCapture, MapReportCaptureRef } from '../components/MapReportCapture';
import { MapPreviewModal } from '../components/MapPreviewModal';
import {
  generateLaporanPetaPDF,
  exportWorkOrdersToExcel,
  generateCetakPhotoPDF,
  exportCetakPhotoToExcel,
  exportCetakPetaToExcel,
} from '../utils/exportUtils';
import { StatusBadge } from '../components/common/StatusBadge';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to dynamically fit map view to markers/route
function RecenterMap({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (positions.length === 1) {
      map.setView(positions[0], 17);
    } else if (positions.length > 1) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }
  }, [positions, map]);
  return null;
}
import {
  Printer,
  FileText,
  Map,
  Download,
  Filter,
  Image as ImageIcon,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';

// Custom Plant Marker Icon with Sequence Number, No. Tiang, Jenis Tanaman, Coordinate Dot, and Leader Line
function createPlantMarkerIcon(jenisTanaman: string, noTiang: string, seqNo: number, status?: string) {
  const name = (jenisTanaman || 'TANAMAN').toUpperCase();
  let badgeColor = '#047857'; // Emerald green
  if (name.includes('TEBANG')) badgeColor = '#b91c1c'; // Red
  else if (name.includes('BAMBU') || name.includes('PISANG') || name.includes('CEMARA') || name.includes('JAMBU')) badgeColor = '#b45309'; // Amber

  const html = `
    <div style="
      position: relative;
      width: 100px;
      height: 40px;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <!-- Leader Line from coordinate dot to box -->
      <svg width="100" height="40" style="position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible;">
        <line x1="50" y1="35" x2="50" y2="18" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" />
      </svg>

      <!-- Coordinate Dot at exact lat/lng anchor -->
      <div style="
        position: absolute;
        left: 46px;
        top: 32px;
        width: 8px;
        height: 8px;
        background: #f59e0b;
        border: 1.5px solid #0f172a;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        z-index: 2;
      "></div>

      <!-- Description Box (1/3 smaller than original) -->
      <div style="
        position: absolute;
        left: 4px;
        top: 0px;
        width: 92px;
        display: inline-flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.95);
        border: 1.2px solid #0f172a;
        border-radius: 8px;
        padding: 1px 4px 1px 1px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        white-space: nowrap;
        gap: 3px;
        backdrop-filter: blur(4px);
        z-index: 3;
      ">
        <div style="
          background: #f59e0b;
          color: #0f172a;
          font-weight: 900;
          font-size: 8px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #0f172a;
          flex-shrink: 0;
        ">
          ${seqNo}
        </div>
        <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;">
          <span style="color: #0f172a; font-weight: 800; font-size: 8px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis;">
            📌 ${noTiang || `T#${seqNo}`}
          </span>
          <span style="color: ${badgeColor}; font-weight: 800; font-size: 7.5px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis;">
            🌳 ${name}
          </span>
        </div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-plant-leaflet-marker',
    html: html,
    iconSize: [100, 40],
    iconAnchor: [50, 35],
    popupAnchor: [0, -25],
  });
}

export const CetakLaporanPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { realisasiList } = useRealisasi();
  const { workOrders } = useWorkOrders();
  const { ulpList, penyulangList } = useMasterData();
  const { settings } = useSettings();
  const { syncWithGAS, isSyncing } = useGASSync();
  const { showToast } = useToast();

  const [activeReportTab, setActiveReportTab] = useState<'foto' | 'peta'>('foto');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [latestMapImage, setLatestMapImage] = useState<string | null>(null);
  const mapCaptureRef = useRef<MapReportCaptureRef>(null);

  const isAdmbktUser = useMemo(() => {
    if (!currentUser) return false;
    const uName = (
      currentUser.userName ||
      currentUser.nip ||
      currentUser.id ||
      currentUser.name ||
      ''
    ).toLowerCase();
    return uName.includes('admbkt') || currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin';
  }, [currentUser]);

  // Map WO by ID for easy lookup
  const workOrdersMap = useMemo(() => {
    return workOrders.reduce((acc, wo) => {
      acc[wo.id] = wo;
      return acc;
    }, {} as Record<string, typeof workOrders[0]>);
  }, [workOrders]);

  const filteredRealisasi = useMemo(() => {
    return realisasiList.filter((rel) => {
      const wo = workOrdersMap[rel.workOrderId];

      // Bypass ULP filtering for admbkt/Admin/SuperAdmin users. Only filter for standard Users.
      if (!isAdmbktUser && currentUser?.role === 'User' && currentUser?.ulpName) {
        const uUlp = currentUser.ulpName.toLowerCase().trim();
        const relUlp = (rel.ulpName || wo?.ulpName || '').toLowerCase().trim();
        if (relUlp && uUlp && relUlp !== uUlp && !relUlp.includes(uUlp) && !uUlp.includes(relUlp)) {
          return false;
        }
      }

      const selectedUlpObj = ulpList.find((u) => u.id === filterUlp || u.namaULP === filterUlp);
      const targetUlpName = selectedUlpObj ? selectedUlpObj.namaULP : filterUlp;

      const matchesUlp =
        filterUlp === 'ALL' ||
        rel.ulpName === filterUlp ||
        wo?.ulpName === filterUlp ||
        wo?.ulpId === filterUlp ||
        (rel.ulpName && targetUlpName && rel.ulpName.toLowerCase().trim() === targetUlpName.toLowerCase().trim()) ||
        (wo?.ulpName && targetUlpName && wo.ulpName.toLowerCase().trim() === targetUlpName.toLowerCase().trim());

      const selectedPenyulangObj = penyulangList.find((p) => p.id === filterPenyulang || p.namaPenyulang === filterPenyulang);
      const targetPenyulangName = selectedPenyulangObj ? selectedPenyulangObj.namaPenyulang : filterPenyulang;

      const matchesPenyulang =
        filterPenyulang === 'ALL' ||
        rel.penyulangName === filterPenyulang ||
        wo?.penyulangName === filterPenyulang ||
        wo?.penyulangId === filterPenyulang ||
        (rel.penyulangName && targetPenyulangName && rel.penyulangName.toLowerCase().trim() === targetPenyulangName.toLowerCase().trim()) ||
        (wo?.penyulangName && targetPenyulangName && wo.penyulangName.toLowerCase().trim() === targetPenyulangName.toLowerCase().trim());

      return matchesUlp && matchesPenyulang;
    });
  }, [realisasiList, workOrdersMap, currentUser, filterUlp, filterPenyulang, isAdmbktUser, ulpList, penyulangList]);

  const filteredWOs = useMemo(() => {
    return workOrders.filter((wo) => {
      if (!isAdmbktUser && currentUser?.role === 'User' && currentUser?.ulpName) {
        const uUlp = currentUser.ulpName.toLowerCase().trim();
        const woUlp = (wo.ulpName || '').toLowerCase().trim();
        if (woUlp && uUlp && woUlp !== uUlp && !woUlp.includes(uUlp) && !uUlp.includes(woUlp)) {
          return false;
        }
      }

      const selectedUlpObj = ulpList.find((u) => u.id === filterUlp || u.namaULP === filterUlp);
      const targetUlpName = selectedUlpObj ? selectedUlpObj.namaULP : filterUlp;

      const matchesUlp =
        filterUlp === 'ALL' ||
        wo.ulpId === filterUlp ||
        wo.ulpName === filterUlp ||
        (wo.ulpName && targetUlpName && wo.ulpName.toLowerCase().trim() === targetUlpName.toLowerCase().trim());

      const selectedPenyulangObj = penyulangList.find((p) => p.id === filterPenyulang || p.namaPenyulang === filterPenyulang);
      const targetPenyulangName = selectedPenyulangObj ? selectedPenyulangObj.namaPenyulang : filterPenyulang;

      const matchesPenyulang =
        filterPenyulang === 'ALL' ||
        wo.penyulangId === filterPenyulang ||
        wo.penyulangName === filterPenyulang ||
        (wo.penyulangName && targetPenyulangName && wo.penyulangName.toLowerCase().trim() === targetPenyulangName.toLowerCase().trim());

      return matchesUlp && matchesPenyulang;
    });
  }, [workOrders, filterUlp, filterPenyulang, isAdmbktUser, currentUser, ulpList, penyulangList]);

  const selectedUlpObj = ulpList.find((u) => u.id === filterUlp || u.namaULP === filterUlp);
  const selectedUlpName = selectedUlpObj
    ? selectedUlpObj.namaULP
    : filterUlp !== 'ALL'
    ? filterUlp
    : (filteredRealisasi[0]?.ulpName || filteredWOs[0]?.ulpName || 'BASO');

  const selectedPenyulangObj = penyulangList.find((p) => p.id === filterPenyulang || p.namaPenyulang === filterPenyulang);
  const selectedPenyulangName = selectedPenyulangObj
    ? selectedPenyulangObj.namaPenyulang
    : filterPenyulang !== 'ALL'
    ? filterPenyulang
    : (filteredRealisasi[0]?.penyulangName || filteredWOs[0]?.penyulangName || '1 BASO - G.H. TANJUNG ALAM');

  const selectedAreaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';

  // Disambiguate map points with identical/overlapping coordinates so markers don't stack ("titik tidak menumpuk")
  const nonOverlappingMapPoints = useMemo(() => {
    const rawPoints = filteredRealisasi.length > 0
      ? filteredRealisasi.map((rel, idx) => {
          const wo = workOrdersMap[rel.workOrderId];
          const lat = rel.latitude || wo?.latitude || -0.286071;
          const lng = rel.longitude || wo?.longitude || 100.449261;
          const jenisTanaman = rel.jenisTanaman || wo?.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)';
          const noTiang = rel.noTiang || wo?.lokasi || `Tiang #${idx + 1}`;
          const photoUrl = rel.photosSesudah?.[0]?.dataUrl || rel.photosSebelum?.[0]?.dataUrl || rel.fotoSesudahUrl || rel.fotoSebelumUrl || wo?.lampiranUrl;

          return {
            id: rel.id || `rel-${idx}`,
            nomorWO: rel.nomorWO || wo?.nomorWO || `WO-${idx + 1}`,
            ulpName: rel.ulpName || wo?.ulpName || selectedUlpName,
            penyulangName: rel.penyulangName || wo?.penyulangName || selectedPenyulangName,
            jenisTanaman,
            noTiang,
            lat,
            lng,
            keterangan: rel.keterangan || 'POTONG',
            pertumbuhanTanaman: rel.pertumbuhanTanaman || 'SEDANG',
            status: rel.status || wo?.status || 'Selesai',
            photoUrl,
          };
        })
      : filteredWOs.map((wo, idx) => {
          const lat = wo.latitude || -0.286071;
          const lng = wo.longitude || 100.449261;
          return {
            id: wo.id || `wo-${idx}`,
            nomorWO: wo.nomorWO || `WO-${idx + 1}`,
            ulpName: wo.ulpName || selectedUlpName,
            penyulangName: wo.penyulangName || selectedPenyulangName,
            jenisTanaman: wo.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)',
            noTiang: wo.lokasi || `Tiang #${idx + 1}`,
            lat,
            lng,
            keterangan: wo.deskripsi || 'PEMBANGKASAN POHON (ROW)',
            pertumbuhanTanaman: 'SEDANG',
            status: wo.status || 'Belum Dikerjakan',
            photoUrl: wo.lampiranUrl,
          };
        });

    const seenCoords = new Set<string>();

    return rawPoints.map((pt, idx) => {
      let lat = pt.lat;
      let lng = pt.lng;

      const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
      if (seenCoords.has(key) || idx > 0) {
        // Apply distinct spiral offset based on index to completely eliminate overlapping boxes
        const angle = idx * 2.39996; // golden angle distribution
        const radius = 0.0015 * Math.sqrt(idx + 1); // ~150 meters spread
        lat += Math.sin(angle) * radius;
        lng += Math.cos(angle) * radius;
      }
      seenCoords.add(`${lat.toFixed(5)}_${lng.toFixed(5)}`);

      return {
        ...pt,
        lat,
        lng,
      };
    });
  }, [filteredRealisasi, filteredWOs, workOrdersMap, selectedUlpName, selectedPenyulangName]);

  const avgLat = nonOverlappingMapPoints.length > 0 ? nonOverlappingMapPoints.reduce((acc, p) => acc + p.lat, 0) / nonOverlappingMapPoints.length : -0.286071;
  const avgLng = nonOverlappingMapPoints.length > 0 ? nonOverlappingMapPoints.reduce((acc, p) => acc + p.lng, 0) / nonOverlappingMapPoints.length : 100.449261;
  const mapCenter: [number, number] = useMemo(() => [avgLat, avgLng], [avgLat, avgLng]);
  const mapPolylinePositions: [number, number][] = useMemo(() => nonOverlappingMapPoints.map((p) => [p.lat, p.lng]), [nonOverlappingMapPoints]);

  const [streetRoutePath, setStreetRoutePath] = useState<[number, number][]>([]);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const routeCoordsKey = useMemo(() => {
    return nonOverlappingMapPoints.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  }, [nonOverlappingMapPoints]);

  useEffect(() => {
    if (nonOverlappingMapPoints.length < 2) {
      setStreetRoutePath(nonOverlappingMapPoints.map((p) => [p.lat, p.lng]));
      return;
    }

    let isMounted = true;
    setIsRoutingLoading(true);

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${routeCoordsKey}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
          const fetchedRoute: [number, number][] = data.routes[0].geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          setStreetRoutePath(fetchedRoute);
        } else if (isMounted) {
          setStreetRoutePath(nonOverlappingMapPoints.map((p) => [p.lat, p.lng]));
        }
      })
      .catch(() => {
        if (isMounted) {
          setStreetRoutePath(nonOverlappingMapPoints.map((p) => [p.lat, p.lng]));
        }
      })
      .finally(() => {
        if (isMounted) setIsRoutingLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [routeCoordsKey]);

  const activePolylinePositions = streetRoutePath.length > 1 ? streetRoutePath : mapPolylinePositions;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (activeReportTab === 'foto') {
      generateCetakPhotoPDF(filteredRealisasi, workOrdersMap, settings, selectedUlpName, filteredWOs);
    } else {
      setIsGeneratingPDF(true);
      try {
        let mapImageDataUrl: string | null = null;
        if (mapCaptureRef.current) {
          mapImageDataUrl = await mapCaptureRef.current.capture();
        }
        if (!mapImageDataUrl) {
          mapImageDataUrl = latestMapImage || null;
        }

        const safeUlp = (selectedUlpName || 'BASO').replace(/[^a-zA-Z0-9]/g, '_');
        const safeFeeder = (selectedPenyulangName || 'F_MATUR').replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        const customFilename = `Peta_Pohon_ROW_${safeUlp}_${safeFeeder}_${dateStr}.pdf`;

        generateLaporanPetaPDF(
          filteredWOs,
          settings,
          selectedUlpName,
          selectedPenyulangName,
          filteredRealisasi,
          mapImageDataUrl || latestMapImage || undefined,
          nonOverlappingMapPoints,
          customFilename
        );
      } catch (error) {
        console.error('Failed to capture map for PDF download:', error);
        const safeUlp = (selectedUlpName || 'BASO').replace(/[^a-zA-Z0-9]/g, '_');
        const safeFeeder = (selectedPenyulangName || 'F_MATUR').replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        const customFilename = `Peta_Pohon_ROW_${safeUlp}_${safeFeeder}_${dateStr}.pdf`;

        generateLaporanPetaPDF(
          filteredWOs,
          settings,
          selectedUlpName,
          selectedPenyulangName,
          filteredRealisasi,
          latestMapImage || undefined,
          nonOverlappingMapPoints,
          customFilename
        );
      } finally {
        setIsGeneratingPDF(false);
      }
    }
  };

  const handleExportExcel = () => {
    if (activeReportTab === 'foto') {
      exportCetakPhotoToExcel(filteredRealisasi, workOrdersMap, settings, selectedUlpName, filteredWOs);
    } else {
      exportCetakPetaToExcel(nonOverlappingMapPoints, settings, selectedUlpName, selectedPenyulangName);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            page-break-before: always;
            break-before: page;
          }
          .print-avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
      {/* Top Header & Export Controls */}
      <div className="no-print bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-2">
              <FileText className="w-6 h-6 text-sky-600" />
              <span>Cetak & Export Laporan Operations</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {activeReportTab === 'foto'
                ? 'Fitur Download PDF dan Excel Laporan CETAK PHOTO (Rekap Hasil ROW Eviden Area & ULP).'
                : 'Fitur Download PDF dan Excel Laporan CETAK PETA (Rekapitulasi Titik Lokasi Work Order).'}
            </p>
          </div>

          {/* Action Buttons: Sync, Download PDF, Download Excel, Print */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => syncWithGAS(showToast)}
              disabled={isSyncing}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              title="Sinkronkan / Tarik Data Terbaru dari Spreadsheet Google"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Proses...' : 'Sync Spreadsheet'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              title="Download File PDF Laporan"
            >
              <Download className={`w-4 h-4 ${isGeneratingPDF ? 'animate-spin' : ''}`} />
              <span>{isGeneratingPDF ? 'Proses PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              title="Download File Spreadsheet Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              title="Cetak/Print Dokumen"
            >
              <Printer className="w-4 h-4" />
              <span>Print Laporan</span>
            </button>
          </div>
        </div>

        {/* Tab Selection & Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex space-x-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveReportTab('foto')}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeReportTab === 'foto'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>1. CETAK PHOTO</span>
            </button>

            <button
              onClick={() => setActiveReportTab('peta')}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeReportTab === 'peta'
                  ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>2. CETAK PETA</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1 text-slate-400 text-xs">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>
            <select
              value={filterUlp}
              onChange={(e) => setFilterUlp(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
            >
              <option value="ALL">Semua ULP</option>
              {ulpList.map((u, idx) => (
                <option key={`${u.id}-${idx}`} value={u.id}>
                  {u.namaULP}
                </option>
              ))}
            </select>

            <select
              value={filterPenyulang}
              onChange={(e) => setFilterPenyulang(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
            >
              <option value="ALL">Semua Penyulang</option>
              {penyulangList.map((p, idx) => (
                <option key={`${p.id}-${idx}`} value={p.id}>
                  {p.namaPenyulang}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Report Document Surface */}
      <div className="bg-white text-slate-900 p-4 sm:p-8 rounded-3xl border border-slate-200 shadow-md space-y-6 print:p-0 print:border-none print:shadow-none overflow-hidden">
        
        {/* Report Content 1: Subhalaman CETAK PHOTO */}
        {activeReportTab === 'foto' && (
          <div className="space-y-6">
            {/* Top Header Labels matching exact image layout */}
            <div className="flex items-center justify-between font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
              <div>EVIDEN ROW AREA {selectedAreaName}</div>
              <div>ULP {selectedUlpName}</div>
            </div>

            {/* Rekap Hasil ROW Table View matching exact uploaded image */}
            <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
              <table className="w-full text-center text-[11px] border-collapse min-w-[1100px]">
                <thead>
                  {/* Banner Title 1 */}
                  <tr className="bg-sky-600 text-white font-extrabold text-xs uppercase tracking-wider">
                    <th colSpan={14} className="p-2 border-b border-sky-700 bg-sky-600 text-center">
                      REKAP HASIL ROW
                    </th>
                  </tr>
                  {/* Banner Title 2 */}
                  <tr className="bg-sky-800 text-white font-bold text-[11px] uppercase tracking-wider">
                    <th colSpan={14} className="p-1.5 border-b border-sky-900 bg-sky-800 text-center">
                      PT HALEYORA POWER
                    </th>
                  </tr>
                  {/* Columns */}
                  <tr className="bg-sky-900 text-white font-bold text-[10px] uppercase">
                    <th className="p-2 border border-sky-950 min-w-[120px]">NO WO</th>
                    <th className="p-2 border border-sky-950">AREA</th>
                    <th className="p-2 border border-sky-950">ULP</th>
                    <th className="p-2 border border-sky-950 min-w-[120px]">NAMA TIM</th>
                    <th className="p-2 border border-sky-950">FEEDER</th>
                    <th className="p-2 border border-sky-950">NO TIANG</th>
                    <th className="p-2 border border-sky-950">TANGGAL EKSEKUSI</th>
                    <th className="p-2 border border-sky-950 min-w-[110px]">FOTO SEBELUM</th>
                    <th className="p-2 border border-sky-950 min-w-[110px]">FOTO SESUDAH</th>
                    <th className="p-2 border border-sky-950 min-w-[130px]">JENIS TANAMAN</th>
                    <th className="p-2 border border-sky-950">KETERANGAN</th>
                    <th className="p-2 border border-sky-950 min-w-[110px]">PERTUMBUHAN TANAMAN</th>
                    <th className="p-2 border border-sky-950">KENDALA</th>
                    <th className="p-2 border border-sky-950 min-w-[130px]">LOKASI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRealisasi.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-8 text-slate-400 text-xs italic">
                        Tidak ada data realisasi foto yang memenuhi kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRealisasi.map((rel, idx) => {
                      const wo = workOrdersMap[rel.workOrderId];
                      const lat = rel.latitude || wo?.latitude || -0.286071;
                      const lng = rel.longitude || wo?.longitude || 100.449261;

                      return (
                        <tr key={`cetak-photo-${rel.id}-${idx}`} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-2 border border-slate-200 font-extrabold text-sky-800 text-[10px]">
                            {rel.nomorWO || wo?.nomorWO || '-'}
                          </td>
                          <td className="p-2 border border-slate-200 uppercase font-semibold text-[10px]">
                            {selectedAreaName}
                          </td>
                          <td className="p-2 border border-slate-200 uppercase font-semibold text-[10px]">
                            {rel.ulpName || wo?.ulpName || selectedUlpName}
                          </td>
                          <td className="p-2 border border-slate-200 font-medium text-[10px]">
                            {rel.reguName || wo?.reguName || rel.petugasName || 'TIM ROW BASO'}
                          </td>
                          <td className="p-2 border border-slate-200 font-medium text-[10px]">
                            {rel.penyulangName || wo?.penyulangName || 'F Baso'}
                          </td>
                          <td className="p-2 border border-slate-200 font-bold text-[10px]">
                            {rel.noTiang || wo?.lokasi || '-'}
                          </td>
                          <td className="p-2 border border-slate-200 text-[10px]">
                            {rel.tanggalRealisasi || wo?.tanggal || '-'}
                          </td>
                          {/* Foto Sebelum */}
                          <td className="p-1.5 border border-slate-200">
                            {rel.photosSebelum?.[0]?.dataUrl || rel.fotoSebelumUrl ? (
                              <img
                                src={rel.photosSebelum?.[0]?.dataUrl || rel.fotoSebelumUrl}
                                alt="Foto Sebelum"
                                className="w-24 h-20 object-cover rounded-md mx-auto shadow-2xs border border-slate-200"
                              />
                            ) : (
                              <div className="w-24 h-20 bg-slate-100 rounded-md mx-auto flex items-center justify-center text-[9px] text-slate-400">
                                No Photo
                              </div>
                            )}
                          </td>
                          {/* Foto Sesudah */}
                          <td className="p-1.5 border border-slate-200">
                            {rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl ? (
                              <img
                                src={rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl}
                                alt="Foto Sesudah"
                                className="w-24 h-20 object-cover rounded-md mx-auto shadow-2xs border border-slate-200"
                              />
                            ) : (
                              <div className="w-24 h-20 bg-slate-100 rounded-md mx-auto flex items-center justify-center text-[9px] text-slate-400">
                                No Photo
                              </div>
                            )}
                          </td>
                          <td className="p-2 border border-slate-200 uppercase font-semibold text-[10px]">
                            {rel.jenisTanaman || wo?.jenisPekerjaan || 'PEMBERSIHAN HALAMAN GARDU'}
                          </td>
                          <td className="p-2 border border-slate-200 uppercase text-[10px]">
                            {rel.keterangan || 'POTONG'}
                          </td>
                          <td className="p-2 border border-slate-200 uppercase font-semibold text-[10px]">
                            {rel.pertumbuhanTanaman || 'SEDANG'}
                          </td>
                          <td className="p-2 border border-slate-200 uppercase text-[10px]">
                            {rel.kendala || 'NIHIL'}
                          </td>
                          <td className="p-2 border border-slate-200 font-mono text-[9px] text-slate-700 whitespace-pre-line font-medium">
                            {`${lat.toFixed(6)},\n${lng.toFixed(6)}`}
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

        {/* Report Content 2: Subhalaman CETAK PETA */}
        {activeReportTab === 'peta' && (
          <div className="space-y-6">
            {/* Diagram Schematic Frame - GAMBAR PETA POHON (ROW) matching attached image */}
            <div className="border-2 border-slate-900 rounded-2xl p-4 sm:p-6 bg-white space-y-4 shadow-sm overflow-x-auto">
              {/* Header Box */}
              <div className="grid grid-cols-12 border border-slate-900 rounded-lg overflow-hidden text-center divide-x divide-slate-900">
                {/* Left Logo */}
                <div className="col-span-3 sm:col-span-2 p-2 bg-slate-50 flex items-center justify-center space-x-2">
                  <div className="w-5 h-6 bg-amber-400 text-slate-900 font-extrabold text-xs flex items-center justify-center rounded-2xs">
                    ⚡
                  </div>
                  <div className="text-left leading-none">
                    <span className="font-extrabold text-sky-700 text-xs block">PLN</span>
                    <span className="font-bold text-sky-900 text-[10px]">Haleyora Power</span>
                  </div>
                </div>

                {/* Center Title */}
                <div className="col-span-6 sm:col-span-8 p-2 flex flex-col items-center justify-center bg-white">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                    GAMBAR PETA POHON (ROW)
                  </h3>
                  <h4 className="font-bold text-[11px] sm:text-xs text-sky-800 uppercase">
                    FEEDER {selectedPenyulangName}
                  </h4>
                  <p className="font-extrabold text-[10px] sm:text-xs text-slate-800 uppercase">
                    ULP {selectedUlpName}
                  </p>
                </div>

                {/* Right Certification Badges */}
                <div className="col-span-3 sm:col-span-2 p-1.5 bg-slate-50 flex flex-col items-center justify-center text-[9px] font-bold text-slate-600">
                  <span className="text-emerald-700">Safety First 🛡️</span>
                  <span className="text-[8px] text-slate-400">YKAN / SK3 Certified</span>
                </div>
              </div>

              {/* Interactive GIS Map replacing static schematic SVG with MapReportCapture */}
              <MapReportCapture
                ref={mapCaptureRef}
                id="gis-map-container"
                className="border-2 border-slate-900 rounded-xl overflow-hidden bg-slate-100 shadow-inner relative"
                onCapture={setLatestMapImage}
                triggerKey={nonOverlappingMapPoints.length}
                points={nonOverlappingMapPoints}
                polylinePositions={activePolylinePositions}
                feederName={selectedPenyulangName}
                ulpName={selectedUlpName}
              >
                <div className="h-[600px] w-full relative z-0">
                  <MapContainer
                    center={mapCenter}
                    zoom={13}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      crossOrigin="anonymous"
                    />

                    <RecenterMap positions={mapPolylinePositions} />

                    {activePolylinePositions.length > 1 && (
                      <>
                        {/* Dark Casing Outer Line */}
                        <Polyline
                          positions={activePolylinePositions}
                          color="#0f172a"
                          weight={6}
                          opacity={0.85}
                        />
                        {/* Orange-Yellow Feeder Route Line Following Street Geometry */}
                        <Polyline
                          positions={activePolylinePositions}
                          color="#f59e0b"
                          weight={3.5}
                          opacity={1}
                          dashArray="8, 6"
                        />
                      </>
                    )}

                    {nonOverlappingMapPoints.map((pt, idx) => {
                      const plantIcon = createPlantMarkerIcon(pt.jenisTanaman, pt.noTiang, idx + 1, pt.status);

                      return (
                        <Marker
                          key={`map-pt-${pt.id || 'point'}-${idx}`}
                          position={[pt.lat, pt.lng]}
                          icon={plantIcon}
                        >
                          <Popup>
                            <div className="p-1 space-y-2 max-w-xs font-sans text-xs">
                              <div className="border-b border-slate-200 pb-1 flex items-center justify-between">
                                <span className="font-black text-sky-800 text-xs">
                                  {pt.nomorWO}
                                </span>
                                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full">
                                  {pt.status}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <p className="font-extrabold text-slate-900 text-xs flex items-center space-x-1">
                                  <span>🌳 Jenis Tanaman:</span>
                                  <span className="text-emerald-700">{pt.jenisTanaman}</span>
                                </p>
                                <p className="font-medium text-slate-700 text-[11px]">
                                  ⚡ Feeder: <span className="font-bold">{pt.penyulangName}</span>
                                </p>
                                <p className="font-medium text-slate-700 text-[11px]">
                                  🏢 ULP: <span className="font-bold">{pt.ulpName}</span>
                                </p>
                                <p className="text-slate-600 text-[10px]">📍 Lokasi / Tiang: {pt.noTiang}</p>
                                <p className="font-mono text-[10px] text-slate-500">
                                  🌐 GPS: {pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}
                                </p>
                                <p className="text-[10px] text-slate-600 font-semibold">
                                  ✂️ Tindakan: {pt.keterangan} | Pertumbuhan: {pt.pertumbuhanTanaman}
                                </p>
                              </div>

                              {pt.photoUrl && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                                  <img src={pt.photoUrl} alt="Foto Realisasi" className="w-full h-28 object-cover" />
                                </div>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>

                {/* Floating Overlay Badge */}
                <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-slate-300 shadow-md text-[10px] space-y-1 font-sans">
                  <p className="font-extrabold text-slate-900 flex items-center space-x-1">
                    <span>⚡ JARINGAN TR & PETA GIS ROW</span>
                  </p>
                  <p className="text-slate-600">Total Titik: <span className="font-extrabold text-sky-700">{nonOverlappingMapPoints.length} Lokasi</span></p>
                  <p className="text-slate-600">Feeder / Penyulang: <span className="font-bold text-slate-800">{selectedPenyulangName}</span></p>
                  <p className="text-slate-600">ULP: <span className="font-bold text-slate-800">{selectedUlpName}</span></p>
                  <p className="text-amber-700 font-extrabold pt-1 border-t border-slate-200 flex items-center justify-between gap-1">
                    <span>⚡ Jaringan Listrik TR PLN</span>
                    {isRoutingLoading && <span className="animate-spin text-amber-600">⏳</span>}
                  </p>
                </div>
              </MapReportCapture>

              {/* KETERANGAN Legend Block matching image bottom box */}
              <div className="border border-slate-900 rounded-lg p-3 bg-white text-[10px] space-y-2">
                <div className="font-extrabold text-slate-900 border-b border-slate-900 pb-1 uppercase">
                  KETERANGAN :
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
                  {/* Column 1: Symbols */}
                  <div className="space-y-1 font-medium text-slate-700 pt-2 sm:pt-0">
                    <p>• = TIANG BESI</p>
                    <p>⊙ = TIANG BETON</p>
                    <p>⊗ = TIANG BESI VS BESI</p>
                    <p>▲ = GARDU DISTRIBUSI (GD) 1 TIANG BESI</p>
                    <p>◼ = GARDU DISTRIBUSI (GD) 2 TIANG BESI</p>
                    <p>✖ = TOWER</p>
                  </div>

                  {/* Column 2: Line Types & Action Color Boxes */}
                  <div className="space-y-2 font-medium text-slate-700 sm:pl-3 pt-2 sm:pt-0">
                    <div className="space-y-0.5 text-[9px]">
                      <p className="font-extrabold text-amber-800">────── = JARINGAN TEGANGAN RENDAH (TR) PLN</p>
                      <p>------- = JARINGAN TEGANGAN MENENGAH (JTM)</p>
                      <p>────── = KABEL TANAH (SKTM)</p>
                      <p>───► = TRECK SCHOOR / DRUCK SCHOOR</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-bold">
                      <div className="flex items-center space-x-1">
                        <span className="w-3.5 h-3.5 bg-yellow-400 border border-slate-800 inline-block rounded-2xs"></span>
                        <span>= PANGKAS</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="w-3.5 h-3.5 bg-green-400 border border-slate-800 inline-block rounded-2xs"></span>
                        <span>= POTONG</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="w-3.5 h-3.5 bg-red-400 border border-slate-800 inline-block rounded-2xs"></span>
                        <span>= TEBANG</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="w-3.5 h-3.5 bg-white border border-slate-800 inline-block rounded-2xs"></span>
                        <span>= TIDAK DIRAMPAL</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Date Box */}
                  <div className="sm:pl-3 flex flex-col justify-end items-center sm:items-end pt-2 sm:pt-0">
                    <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                      TANGGAL {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rekapitualsi Table below diagram */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border border-slate-200 min-w-[800px]">
                <thead className="bg-sky-900 text-white font-bold">
                  <tr>
                    <th className="p-2 border">No</th>
                    <th className="p-2 border">Nomor WO</th>
                    <th className="p-2 border">Tanggal</th>
                    <th className="p-2 border">ULP</th>
                    <th className="p-2 border">Penyulang</th>
                    <th className="p-2 border">Lokasi Pekerjaan</th>
                    <th className="p-2 border">Koordinat GPS</th>
                    <th className="p-2 border">Petugas</th>
                    <th className="p-2 border">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredWOs.map((wo, i) => (
                    <tr key={`${wo.id}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 border font-bold text-center">{i + 1}</td>
                      <td className="p-2 border font-bold text-sky-700">{wo.nomorWO}</td>
                      <td className="p-2 border">{wo.tanggal}</td>
                      <td className="p-2 border">{wo.ulpName}</td>
                      <td className="p-2 border font-semibold">{wo.penyulangName}</td>
                      <td className="p-2 border max-w-xs truncate">{wo.lokasi}</td>
                      <td className="p-2 border font-mono text-[10px]">
                        {wo.latitude}, {wo.longitude}
                      </td>
                      <td className="p-2 border">{wo.petugasName}</td>
                      <td className="p-2 border font-bold text-center">{wo.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Signatures for Official Documents */}
        <div className="pt-8 grid grid-cols-2 text-center text-xs text-slate-700 border-t border-slate-200">
          <div>
            <p className="font-semibold">Diperiksa Oleh,</p>
            <p className="font-bold text-slate-900 mt-12">Supervisor Asset Protection</p>
            <p className="text-[10px] text-slate-500">NIP. 198804122012011002</p>
          </div>
          <div>
            <p className="font-semibold">Disetujui Oleh,</p>
            <p className="font-bold text-slate-900 mt-12">Manager ULP / UP3</p>
            <p className="text-[10px] text-slate-500">NIP. 198203152008021001</p>
          </div>
        </div>
      </div>
    </div>
  );
};

