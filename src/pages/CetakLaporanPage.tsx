import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useGASSync } from '../context/GASSyncContext';
import { useToast } from '../hooks/useToast';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { MapReportCapture, MapReportCaptureRef } from '../components/MapReportCapture';
import { MapPreviewModal } from '../components/MapPreviewModal';
import { formatDateTime, formatDateOnly, formatExecutionDateTime } from '../utils/dateFormatter';
import { formatDateDisplay, normalizeDateISO } from '../utils/dateUtils';
import {
  generateLaporanPetaPDF,
  exportWorkOrdersToExcel,
  generateCetakPhotoPDF,
  exportCetakPhotoToExcel,
  exportCetakPetaToExcel,
} from '../utils/exportUtils';
import { generateEnhancedLaporanPetaPDF } from '../utils/pdfExportService';
import { MapPoint } from '../utils/pdfExportTypes';
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
function createPlantMarkerIcon(jenisTanaman: string, noTiang: string, seqNo: number, status?: string, keterangan?: string, lokasiKerja?: string) {
  const name = (jenisTanaman || 'TANAMAN').toUpperCase();
  const checkStr = ((keterangan || '') + ' ' + name).toUpperCase();
  let badgeColor = '#facc15'; // Yellow for Pangkas
  if (checkStr.includes('TEBANG')) {
    badgeColor = '#ef4444'; // Red
  } else if (checkStr.includes('POTONG')) {
    badgeColor = '#22c55e'; // Green
  } else if (checkStr.includes('PANGKAS')) {
    badgeColor = '#facc15'; // Yellow
  }

  const html = `
    <div style="
      position: relative;
      width: 130px;
      height: 60px;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <!-- Leader Line from coordinate dot to box -->
      <svg width="130" height="60" style="position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible;">
        <line x1="65" y1="52" x2="65" y2="30" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" />
      </svg>

      <!-- Coordinate Dot at exact lat/lng anchor -->
      <div style="
        position: absolute;
        left: 61px;
        top: 49px;
        width: 8px;
        height: 8px;
        background: ${badgeColor};
        border: 1.5px solid #0f172a;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        z-index: 2;
      "></div>

      <!-- Description Box -->
      <div style="
        position: absolute;
        left: 0px;
        top: 0px;
        width: 130px;
        display: inline-flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.95);
        border: 1.2px solid #0f172a;
        border-radius: 8px;
        padding: 3px 5px 3px 3px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        white-space: nowrap;
        gap: 5px;
        backdrop-filter: blur(4px);
        z-index: 3;
      ">
        <div style="
          background: ${badgeColor};
          color: #0f172a;
          font-weight: 900;
          font-size: 9px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #0f172a;
          flex-shrink: 0;
        ">
          ${seqNo}
        </div>
        <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden; width: 100%;">
          <span style="color: #0f172a; font-weight: 800; font-size: 8.5px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; display: block;">
            📌 ${noTiang || `T#${seqNo}`}
          </span>
          <span style="color: #0f172a; font-weight: 800; font-size: 8px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; display: block;">
            🌳 ${name}
          </span>
          ${lokasiKerja ? `
          <span style="color: #ef4444; font-weight: 900; font-size: 8px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; display: block; margin-top: 1px; border-top: 0.5px solid #e2e8f0; padding-top: 1px;">
            🏠 ${lokasiKerja}
          </span>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-plant-leaflet-marker',
    html: html,
    iconSize: [130, 60],
    iconAnchor: [65, 52],
    popupAnchor: [0, -40],
  });
}

// Helper component for robust logo rendering with multiple fallbacks
const LogoComponent = () => {
  const [imgStatus, setImgStatus] = React.useState<'local' | 'remote' | 'fallback'>('local');
  const logoUrl = "https://www.plnes.co.id/_next/image?url=https%3A%2F%2Fcms.plnes.co.id%2Fuploads%2FLogo_HP_New_Temporary_09a9c5a521.png&w=750&q=75";

  if (imgStatus === 'fallback') {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-5 h-6 bg-amber-400 text-slate-900 font-extrabold text-xs flex items-center justify-center rounded-2xs">⚡</div>
        <div className="text-left leading-none">
          <span className="font-extrabold text-teal-700 text-xs block">PLN</span>
          <span className="font-bold text-teal-900 text-[10px]">Electricity Services</span>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={imgStatus === 'local' ? '/logo_plnes.png' : logoUrl} 
      alt="PLN Logo" 
      className="h-10 w-auto object-contain"
      onError={() => {
        if (imgStatus === 'local') setImgStatus('remote');
        else setImgStatus('fallback');
      }}
    />
  );
};

export const CetakLaporanPage: React.FC = () => {
  const draggable1 = useDraggableScroll();
  const draggable2 = useDraggableScroll();
  const draggable3 = useDraggableScroll();

  const { user: currentUser } = useAuth();
  const { realisasiList } = useRealisasi();
  const { workOrders } = useWorkOrders();
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { settings } = useSettings();
  const { syncWithGAS, isSyncing } = useGASSync();
  const { showToast } = useToast();

  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [activeReportTab, setActiveReportTab] = useState<'foto' | 'peta'>('foto');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');
  const [filterNoWo, setFilterNoWo] = useState('ALL');
  const [filterDate, setFilterDate] = useState(getTodayDateString());
  const [latestMapImage, setLatestMapImage] = useState<string | null>(null);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
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
    return uName.includes('admbkt') || currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin' || currentUser.role === 'Adm';
  }, [currentUser]);

  // Helper to normalize strings for robust matching
  const cleanStr = (s?: string | null) => {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/gi, '');
  };

  // Map WO by ID for easy lookup
  const workOrdersMap = useMemo(() => {
    return workOrders.reduce((acc, wo) => {
      acc[wo.id] = wo;
      return acc;
    }, {} as Record<string, typeof workOrders[0]>);
  }, [workOrders]);

  // Filter available Penyulang by selected ULP
  const availablePenyulangList = useMemo(() => {
    if (filterUlp === 'ALL') return penyulangList;
    const selectedUlpObj = ulpList.find((u) => u.id === filterUlp || u.namaULP === filterUlp);
    const targetUlpName = selectedUlpObj ? selectedUlpObj.namaULP : filterUlp;

    return penyulangList.filter((p) => {
      if (cleanStr(p.ulpId) === cleanStr(filterUlp) || cleanStr(p.ulpName) === cleanStr(filterUlp)) return true;
      if (selectedUlpObj && (cleanStr(p.ulpId) === cleanStr(selectedUlpObj.id) || cleanStr(p.ulpName) === cleanStr(selectedUlpObj.namaULP))) return true;
      if (p.ulpName && targetUlpName && cleanStr(p.ulpName) === cleanStr(targetUlpName)) return true;
      return false;
    });
  }, [penyulangList, filterUlp, ulpList]);

  // Filter available NO WO by selected ULP
  const availableWONumbers = useMemo(() => {
    const selectedUlpObj = ulpList.find((u) => u.id === filterUlp || u.namaULP === filterUlp);
    const targetUlpName = selectedUlpObj ? selectedUlpObj.namaULP : filterUlp;

    const woSet = new Set<string>();

    workOrders.forEach((wo) => {
      const matchesUlp =
        filterUlp === 'ALL' ||
        cleanStr(wo.ulpId) === cleanStr(filterUlp) ||
        cleanStr(wo.ulpName) === cleanStr(filterUlp) ||
        (wo.ulpName && targetUlpName && cleanStr(wo.ulpName) === cleanStr(targetUlpName));
      
      const matchesRegu = filterRegu === 'ALL' || cleanStr(wo.reguName) === cleanStr(filterRegu);

      if (matchesUlp && matchesRegu && wo.nomorWO) {
        woSet.add(wo.nomorWO);
      }
    });

    realisasiList.forEach((rel) => {
      const wo = workOrdersMap[rel.workOrderId];
      const matchesUlp =
        filterUlp === 'ALL' ||
        cleanStr(rel.ulpName) === cleanStr(filterUlp) ||
        cleanStr(wo?.ulpName) === cleanStr(filterUlp) ||
        cleanStr(wo?.ulpId) === cleanStr(filterUlp) ||
        (rel.ulpName && targetUlpName && cleanStr(rel.ulpName) === cleanStr(targetUlpName)) ||
        (wo?.ulpName && targetUlpName && cleanStr(wo.ulpName) === cleanStr(targetUlpName));
      
      const matchesRegu = filterRegu === 'ALL' || cleanStr(rel.reguName) === cleanStr(filterRegu) || cleanStr(wo?.reguName) === cleanStr(filterRegu);

      if (matchesUlp && matchesRegu) {
        if (rel.nomorWO) woSet.add(rel.nomorWO);
        if (wo?.nomorWO) woSet.add(wo.nomorWO);
      }
    });

    return Array.from(woSet).filter(Boolean).sort();
  }, [workOrders, realisasiList, workOrdersMap, filterUlp, ulpList]);

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
        cleanStr(rel.ulpName) === cleanStr(filterUlp) ||
        cleanStr(wo?.ulpName) === cleanStr(filterUlp) ||
        cleanStr(wo?.ulpId) === cleanStr(filterUlp) ||
        (rel.ulpName && targetUlpName && cleanStr(rel.ulpName) === cleanStr(targetUlpName)) ||
        (wo?.ulpName && targetUlpName && cleanStr(wo.ulpName) === cleanStr(targetUlpName));

      const selectedPenyulangObj = penyulangList.find((p) => p.id === filterPenyulang || p.namaPenyulang === filterPenyulang);
      const targetPenyulangName = selectedPenyulangObj ? selectedPenyulangObj.namaPenyulang : filterPenyulang;

      const matchesPenyulang =
        filterPenyulang === 'ALL' ||
        cleanStr(rel.penyulangName) === cleanStr(filterPenyulang) ||
        cleanStr(wo?.penyulangName) === cleanStr(filterPenyulang) ||
        cleanStr(wo?.penyulangId) === cleanStr(filterPenyulang) ||
        (rel.penyulangName && targetPenyulangName && cleanStr(rel.penyulangName) === cleanStr(targetPenyulangName)) ||
        (wo?.penyulangName && targetPenyulangName && cleanStr(wo.penyulangName) === cleanStr(targetPenyulangName));

      const matchesNoWo =
        filterNoWo === 'ALL' ||
        cleanStr(rel.nomorWO) === cleanStr(filterNoWo) ||
        cleanStr(wo?.nomorWO) === cleanStr(filterNoWo) ||
        cleanStr(rel.workOrderId) === cleanStr(filterNoWo);

      const matchesRegu = filterRegu === 'ALL' || cleanStr(rel.reguName) === cleanStr(filterRegu) || cleanStr(wo?.reguName) === cleanStr(filterRegu);

      const itemDate = normalizeDateISO(rel.tanggalRealisasi || rel.createdAt);
      const matchesDate = !filterDate || itemDate === filterDate;

      return matchesDate && matchesUlp && matchesPenyulang && matchesNoWo && matchesRegu;
    });
  }, [realisasiList, workOrdersMap, currentUser, filterUlp, filterPenyulang, filterNoWo, filterRegu, filterDate, isAdmbktUser, ulpList, penyulangList]);

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
        cleanStr(wo.ulpId) === cleanStr(filterUlp) ||
        cleanStr(wo.ulpName) === cleanStr(filterUlp) ||
        (wo.ulpName && targetUlpName && cleanStr(wo.ulpName) === cleanStr(targetUlpName));

      const selectedPenyulangObj = penyulangList.find((p) => p.id === filterPenyulang || p.namaPenyulang === filterPenyulang);
      const targetPenyulangName = selectedPenyulangObj ? selectedPenyulangObj.namaPenyulang : filterPenyulang;

      const matchesPenyulang =
        filterPenyulang === 'ALL' ||
        cleanStr(wo.penyulangId) === cleanStr(filterPenyulang) ||
        cleanStr(wo.penyulangName) === cleanStr(filterPenyulang) ||
        (wo.penyulangName && targetPenyulangName && cleanStr(wo.penyulangName) === cleanStr(targetPenyulangName));

      const matchesNoWo =
        filterNoWo === 'ALL' ||
        cleanStr(wo.nomorWO) === cleanStr(filterNoWo) ||
        cleanStr(wo.id) === cleanStr(filterNoWo);

      const matchesRegu = filterRegu === 'ALL' || cleanStr(wo.reguName) === cleanStr(filterRegu);

      return matchesUlp && matchesPenyulang && matchesNoWo && matchesRegu;
    });
  }, [workOrders, filterUlp, filterPenyulang, filterNoWo, filterRegu, isAdmbktUser, currentUser, ulpList, penyulangList]);

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
            lokasiKerja: rel.lokasiKerja || wo?.lokasi || '',
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
            lokasiKerja: wo.lokasi || '',
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
        // Map current points to the export type
        const exportPoints: MapPoint[] = nonOverlappingMapPoints.map((pt, idx) => ({
          id: pt.id,
          nomorWO: pt.nomorWO,
          noTiang: pt.noTiang,
          jenisTanaman: pt.jenisTanaman,
          lat: pt.lat,
          lng: pt.lng,
          keterangan: pt.keterangan,
          lokasiKerja: pt.lokasiKerja,
          status: pt.status,
          seqNo: idx + 1,
          ulpName: pt.ulpName,
          penyulangName: pt.penyulangName
        }));

        await generateEnhancedLaporanPetaPDF(
          filteredWOs,
          settings,
          selectedUlpName,
          selectedPenyulangName,
          filteredRealisasi,
          exportPoints,
          activePolylinePositions // Pass the route data here
        );
        
        showToast('PDF Laporan Peta Berhasil Dibuat', 'success');
      } catch (error) {
        console.error('Failed to generate enhanced PDF:', error);
        showToast('Gagal membuat PDF Laporan Peta', 'error');
        
        // Fallback to old method if new one fails
        generateLaporanPetaPDF(
          filteredWOs,
          settings,
          selectedUlpName,
          selectedPenyulangName,
          filteredRealisasi,
          undefined,
          nonOverlappingMapPoints
        );
      } finally {
        setIsGeneratingPDF(false);
      }
    }
  };

  const handleExportExcel = async () => {
    setIsGeneratingExcel(true);
    try {
      if (activeReportTab === 'foto') {
        await exportCetakPhotoToExcel(filteredRealisasi, workOrdersMap, settings, selectedUlpName, filteredWOs);
        showToast('File Excel Eviden Foto Berhasil Diunduh', 'success');
      } else {
        await exportCetakPetaToExcel(nonOverlappingMapPoints, settings, selectedUlpName, selectedPenyulangName);
        showToast('File Excel Peta Pohon Berhasil Diunduh', 'success');
      }
    } catch (err) {
      console.error('Export Excel error:', err);
      showToast('Gagal mengunduh file Excel: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setIsGeneratingExcel(false);
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
      <div className="no-print bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-3">
              <div className="p-2 bg-teal-50 dark:bg-teal-950 rounded-xl">
                <FileText className="w-6 h-6 text-[#00A2B9]" />
              </div>
              <span>Cetak & Export Laporan Operations</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {activeReportTab === 'foto'
                ? 'Fitur Download PDF dan Excel Laporan CETAK PHOTO (Rekap Hasil ROW Eviden Area & ULP).'
                : 'Fitur Download PDF dan Excel Laporan CETAK PETA (Rekapitulasi Titik Lokasi Work Order).'}
            </p>
          </div>

          {/* Action Buttons Group */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              onClick={() => syncWithGAS(showToast)}
              disabled={isSyncing}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
              title="Sinkronkan / Tarik Data Terbaru dari Spreadsheet Google"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Download File PDF Laporan"
            >
              <Download className={`w-4 h-4 ${isGeneratingPDF ? 'animate-spin' : ''}`} />
              <span>PDF Report</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isGeneratingExcel}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#008396] hover:bg-[#00A2B9] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Download File Spreadsheet Excel (.xlsx)"
            >
              <FileSpreadsheet className={`w-4 h-4 ${isGeneratingExcel ? 'animate-spin' : ''}`} />
              <span>Excel Export</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#00A2B9] hover:bg-[#008396] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
              title="Cetak/Print Dokumen"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Tab Selection & Filter Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 pt-6 border-t border-slate-100 dark:border-slate-700">
          {/* Professional Tab Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl sm:w-auto self-start">
            <button
              onClick={() => setActiveReportTab('foto')}
              className={`inline-flex items-center justify-center space-x-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${
                activeReportTab === 'foto'
                  ? 'bg-white dark:bg-slate-800 text-[#00A2B9] dark:text-teal-400 shadow-sm ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>CETAK PHOTO</span>
            </button>

            <button
              onClick={() => setActiveReportTab('peta')}
              className={`inline-flex items-center justify-center space-x-2 px-6 py-2 rounded-lg text-xs font-bold transition-all ${
                activeReportTab === 'peta'
                  ? 'bg-white dark:bg-slate-800 text-[#00A2B9] dark:text-teal-400 shadow-sm ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>CETAK PETA</span>
            </button>
          </div>

          {/* Vertical Divider for desktop */}
          <div className="hidden lg:block w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2"></div>

          {/* Unified Filter Group */}
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <Filter className="w-3 h-3" />
              <span>Filter Laporan</span>
            </div>
            
            <div className="grid grid-cols-1 sm:flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer"
                  title="Filter Tanggal"
                />
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate('')}
                    className="px-2.5 py-2 text-[10px] bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors whitespace-nowrap"
                    title="Tampilkan Semua Tanggal"
                  >
                    Semua
                  </button>
                )}
              </div>

              <select
                value={filterUlp}
                onChange={(e) => {
                  setFilterUlp(e.target.value);
                  setFilterPenyulang('ALL');
                  setFilterRegu('ALL');
                  setFilterNoWo('ALL');
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer min-w-[140px]"
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
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer min-w-[160px]"
              >
                <option value="ALL">Semua Penyulang</option>
                {availablePenyulangList.map((p, idx) => (
                  <option key={`${p.id}-${idx}`} value={p.id}>
                    {p.namaPenyulang}
                  </option>
                ))}
              </select>

              <select
                value={filterRegu}
                onChange={(e) => setFilterRegu(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer min-w-[140px]"
              >
                <option value="ALL">Semua Regu</option>
                {reguList
                  .filter(r => filterUlp === 'ALL' || cleanStr(r.ulpId) === cleanStr(filterUlp) || cleanStr(r.ulpName) === cleanStr(filterUlp))
                  .map((r, idx) => (
                  <option key={`${r.id}-${idx}`} value={r.namaRegu}>
                    {r.namaRegu}
                  </option>
                ))}
              </select>

              <select
                value={filterNoWo}
                onChange={(e) => setFilterNoWo(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer min-w-[140px]"
              >
                <option value="ALL">Semua NO WO</option>
                {availableWONumbers.map((woNum, idx) => (
                  <option key={`${woNum}-${idx}`} value={woNum}>
                    {woNum}
                  </option>
                ))}
              </select>
            </div>
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
            <div 
              ref={draggable1.ref}
              onMouseDown={draggable1.onMouseDown}
              onMouseUp={draggable1.onMouseUp}
              onMouseLeave={draggable1.onMouseLeave}
              onMouseMove={draggable1.onMouseMove}
              className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white"
              style={draggable1.style}
            >
              <table className="w-full text-center text-[11px] border-collapse min-w-[1100px]">
                <thead>
                  {/* Banner Title 1 */}
                  <tr className="bg-[#00A2B9] text-white font-extrabold text-xs uppercase tracking-wider">
                    <th colSpan={14} className="p-2 border-b border-[#008396] bg-[#00A2B9] text-center">
                      REKAP HASIL ROW
                    </th>
                  </tr>
                  {/* Banner Title 2 */}
                  <tr className="bg-[#008396] text-white font-bold text-[11px] uppercase tracking-wider">
                    <th colSpan={14} className="p-1.5 border-b border-[#008396] bg-[#008396] text-center">
                      PLN ELECTRICITY SERVICES
                    </th>
                  </tr>
                  {/* Columns */}
                  <tr className="bg-[#008396] text-white font-bold text-[10px] uppercase">
                    <th className="p-2 border border-[#008396] min-w-[120px]">NO WO</th>
                    <th className="p-2 border border-[#008396]">AREA</th>
                    <th className="p-2 border border-[#008396]">ULP</th>
                    <th className="p-2 border border-[#008396] min-w-[120px]">NAMA TIM</th>
                    <th className="p-2 border border-[#008396]">FEEDER</th>
                    <th className="p-2 border border-[#008396]">NO TIANG</th>
                    <th className="p-2 border border-[#008396]">TANGGAL EKSEKUSI</th>
                    <th className="p-2 border border-[#008396] min-w-[110px]">FOTO SEBELUM</th>
                    <th className="p-2 border border-[#008396] min-w-[110px]">FOTO SESUDAH</th>
                    <th className="p-2 border border-[#008396] min-w-[130px]">JENIS TANAMAN</th>
                    <th className="p-2 border border-[#008396]">KETERANGAN</th>
                    <th className="p-2 border border-[#008396] min-w-[110px]">PERTUMBUHAN TANAMAN</th>
                    <th className="p-2 border border-[#008396]">KENDALA</th>
                    <th className="p-2 border border-[#008396] min-w-[130px]">LOKASI</th>
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
                        <tr key={`cetak-photo-${rel.id}-${idx}`} className="hover:bg-teal-50/50 transition-colors">
                          <td className="p-2 border border-slate-200 font-extrabold text-teal-800 text-[10px]">
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
                            {formatExecutionDateTime(rel, wo)}
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
            <div 
              ref={draggable2.ref}
              onMouseDown={draggable2.onMouseDown}
              onMouseUp={draggable2.onMouseUp}
              onMouseLeave={draggable2.onMouseLeave}
              onMouseMove={draggable2.onMouseMove}
              className="border-2 border-slate-900 rounded-2xl p-4 sm:p-6 bg-white space-y-4 shadow-sm overflow-x-auto"
              style={draggable2.style}
            >
              {/* Header Box */}
              <div className="grid grid-cols-12 border border-slate-900 rounded-lg overflow-hidden text-center divide-x divide-slate-900">
                {/* Left Logo */}
                <div className="col-span-3 sm:col-span-2 p-2 bg-white flex items-center justify-center">
                  <LogoComponent />
                </div>

                {/* Center Title */}
                <div className="col-span-6 sm:col-span-8 p-2 flex flex-col items-center justify-center bg-white">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                    GAMBAR PETA POHON (ROW)
                  </h3>
                  <h4 className="font-bold text-[11px] sm:text-xs text-teal-800 uppercase">
                    FEEDER {selectedPenyulangName}
                  </h4>
                  <p className="font-extrabold text-[10px] sm:text-xs text-slate-800 uppercase">
                    ULP {selectedUlpName}
                  </p>
                </div>

                {/* Right Certification Badges */}
                <div className="col-span-3 sm:col-span-2 p-1.5 bg-slate-50 flex flex-col items-center justify-center text-[9px] font-bold text-slate-600">
                  <span className="text-[#008396]">Safety First 🛡️</span>
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
                      attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      crossOrigin="anonymous"
                    />
                    <TileLayer
                      attribution='Labels &copy; Esri'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                      crossOrigin="anonymous"
                      pane="overlayPane"
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
                      const plantIcon = createPlantMarkerIcon(pt.jenisTanaman, pt.noTiang, idx + 1, pt.status, pt.keterangan, pt.lokasiKerja);

                      return (
                        <Marker
                          key={`map-pt-${pt.id || 'point'}-${idx}`}
                          position={[pt.lat, pt.lng]}
                          icon={plantIcon}
                        >
                          <Popup>
                            <div className="p-1 space-y-2 max-w-xs font-sans text-xs">
                              <div className="border-b border-slate-200 pb-1 flex items-center justify-between">
                                <span className="font-black text-teal-800 text-xs">
                                  {pt.nomorWO}
                                </span>
                                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-teal-100 text-[#008396] rounded-full">
                                  {pt.status}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <p className="font-extrabold text-slate-900 text-xs flex items-center space-x-1">
                                  <span>🌳 Jenis Tanaman:</span>
                                  <span className="text-[#00A2B9]">{pt.jenisTanaman}</span>
                                </p>
                                <p className="font-medium text-slate-700 text-[11px]">
                                  ⚡ Feeder: <span className="font-bold">{pt.penyulangName}</span>
                                </p>
                                <p className="font-medium text-slate-700 text-[11px]">
                                  🏢 ULP: <span className="font-bold">{pt.ulpName}</span>
                                </p>
                                <p className="text-slate-600 text-[10px] font-bold">🏠 Lokasi Kerja: {pt.lokasiKerja || pt.noTiang}</p>
                                <p className="text-slate-600 text-[10px]">📍 No Tiang: {pt.noTiang}</p>
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
                  <p className="text-slate-600">Total Titik: <span className="font-extrabold text-teal-700">{nonOverlappingMapPoints.length} Lokasi</span></p>
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
                <div className="font-extrabold text-slate-900 border-b border-slate-900 pb-1 uppercase flex justify-between items-center">
                  <span>KETERANGAN :</span>
                  <span className="text-slate-600 font-semibold">TANGGAL REALISASI: {(() => {
                    const tgl = filteredRealisasi[0]?.tanggalRealisasi || filteredWOs[0]?.tanggal || new Date();
                    return formatDateOnly(tgl);
                  })()}</span>
                </div>

                {(() => {
                  const summaryWoNumbers = filteredWOs.map(w => w.nomorWO).join(', ') || filteredRealisasi[0]?.nomorWO || '-';
                  const summaryTanggal = formatDateOnly(filteredRealisasi[0]?.tanggalRealisasi || filteredWOs[0]?.tanggal || new Date());
                  const summaryUlp = selectedUlpName;
                  const summaryPenyulang = selectedPenyulangName;
                  const summaryRegu = filteredRealisasi[0]?.reguName || filteredWOs[0]?.petugasName || 'Regu ROW Alpha';
                  const summaryTotalRealisasi = nonOverlappingMapPoints.length;
                  const summaryPangkas = nonOverlappingMapPoints.filter(p => (p.keterangan || p.jenisTanaman || '').toUpperCase().includes('PANGKAS')).length;
                  const summaryTebang = nonOverlappingMapPoints.filter(p => (p.keterangan || p.jenisTanaman || '').toUpperCase().includes('TEBANG')).length;
                  const summaryPotong = nonOverlappingMapPoints.filter(p => (p.keterangan || p.jenisTanaman || '').toUpperCase().includes('POTONG')).length;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 font-medium text-slate-800 text-[11px]">
                      {/* Column 1: Info Resmi Kiri */}
                      <div className="space-y-1 pt-1 sm:pt-0">
                        <p><span className="font-extrabold">NO WO:</span> {summaryWoNumbers}</p>
                        <p><span className="font-extrabold">TANGGAL:</span> {summaryTanggal}</p>
                        <p><span className="font-extrabold">NAMA ULP:</span> {summaryUlp}</p>
                        <p><span className="font-extrabold">NAMA PENYULANG:</span> {summaryPenyulang}</p>
                        <p><span className="font-extrabold">NAMA REGU:</span> {summaryRegu}</p>
                      </div>

                      {/* Column 2: Jumlah Realisasi Tengah */}
                      <div className="space-y-1 sm:pl-3 pt-1 sm:pt-0">
                        <p><span className="font-extrabold">JUMLAH REALISASI:</span> {summaryTotalRealisasi} Titik</p>
                        <p><span className="font-extrabold text-amber-700">JUMLAH REALISASI PANGKAS:</span> {summaryPangkas}</p>
                        <p><span className="font-extrabold text-red-600">JUMLAH REALISASI TEBANG:</span> {summaryTebang}</p>
                        <p><span className="font-extrabold text-[#008396]">JUMLAH REALISASI POTONG:</span> {summaryPotong}</p>
                      </div>

                      {/* Column 3: Mengetahui / Disetujui */}
                      <div className="sm:pl-3 flex flex-col items-center justify-center pt-1 sm:pt-0 text-[11px]">
                        <div className="text-center">
                          <p className="font-extrabold text-slate-900 text-xs">Mengetahui / Disetujui</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Rekapitualsi Table below diagram */}
            <div 
              ref={draggable3.ref}
              onMouseDown={draggable3.onMouseDown}
              onMouseUp={draggable3.onMouseUp}
              onMouseLeave={draggable3.onMouseLeave}
              onMouseMove={draggable3.onMouseMove}
              className="overflow-x-auto border border-slate-200 rounded-xl"
              style={draggable3.style}
            >
              <table className="w-full text-left text-xs border border-slate-200 min-w-[800px]">
                <thead className="bg-teal-900 text-white font-bold">
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
                      <td className="p-2 border font-bold text-teal-700">{wo.nomorWO}</td>
                      <td className="p-2 border">{formatDateDisplay(wo.tanggal)}</td>
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
            <p className="font-semibold">Disetujui Oleh,</p>
            <p className="font-bold text-slate-900 mt-12">TL. TEKNIK</p>
          </div>
          <div>
            <p className="font-semibold">Dibuat Oleh,</p>
            <p className="font-bold text-slate-900 mt-12">Pengatur ULP</p>
          </div>
        </div>
      </div>
    </div>
  );
};

