import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../hooks/useToast';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { MapReportCapture, MapReportCaptureRef } from '../components/MapReportCapture';
import { formatDateTime, formatDateOnly, formatExecutionDateTime } from '../utils/dateFormatter';
import { formatDateDisplay } from '../utils/dateUtils';
import {
  generateLaporanPetaPDF,
  exportWorkOrdersToExcel,
  generateCetakPhotoPDF,
  exportCetakPhotoToExcel,
  exportCetakPetaToExcel,
} from '../utils/exportUtils';
import { generateEnhancedLaporanPetaPDF } from '../utils/pdfExportService';
import { MapPoint } from '../utils/pdfExportTypes';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  Search,
  Database,
  Calendar,
  Building2,
  Layers,
  Eye,
  Info,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { SupabaseService } from '../services/supabaseService';
import { Realisasi, WorkOrder } from '../types';

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

// Vector PLN Logo Component
const LogoComponent = () => {
  return (
    <div className="flex items-center space-x-2 select-none">
      <div className="w-10 h-10 bg-[#FFEB00] rounded-sm flex items-center justify-center relative p-1 shrink-0">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 24 24">
          <path d="M2 9 Q4.5 7.5, 7 9 T12 9 T17 9 T22 9" stroke="#00A2B9" strokeWidth="1.5" fill="none" />
          <path d="M2 13 Q4.5 11.5, 7 13 T12 13 T17 13 T22 13" stroke="#00A2B9" strokeWidth="1.5" fill="none" />
          <path d="M2 17 Q4.5 15.5, 7 17 T12 17 T17 17 T22 17" stroke="#00A2B9" strokeWidth="1.5" fill="none" />
          <path d="M14.5 3 L7.5 12.5 H12.5 L9.5 21 L16.5 11.5 H11.5 Z" fill="#E53E3E" />
        </svg>
      </div>
      <div className="text-left leading-tight shrink-0">
        <span className="font-extrabold text-[#00A2B9] text-base block tracking-tight">PLN</span>
        <span className="font-semibold text-[#00A2B9] text-[9px] block tracking-tight uppercase">Electricity Service</span>
      </div>
    </div>
  );
};

export const CetakLaporanPage: React.FC = () => {
  const draggable1 = useDraggableScroll();
  const draggable2 = useDraggableScroll();
  const draggable3 = useDraggableScroll();

  const { user: currentUser } = useAuth();
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { settings } = useSettings();
  const { showToast } = useToast();

  // Active Inisiasi Unit ID & Name
  const activeUnitId = useMemo(() => SupabaseService.getActiveUnitId(), [settings.namaUnitLayanan]);
  const activeUnitName = useMemo(() => settings.namaUnitLayanan || 'UL BUKITTINGGI', [settings.namaUnitLayanan]);

  // Helper date generators
  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFirstDayOfMonthString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  // Scoped ULP List based strictly on INISIASI (unitId)
  const scopedUlpList = useMemo(() => {
    // 1. Filter from master ulpList where unitId === activeUnitId
    const matchingUlp = ulpList.filter((u: any) => {
      if (u.unitId && String(u.unitId).toUpperCase() === activeUnitId.toUpperCase()) return true;
      return false;
    });
    if (matchingUlp.length > 0) return matchingUlp;

    // 2. Fallback to default ULP list for this unit
    const defaults = SupabaseService.getDefaultMasterForUnit(activeUnitId);
    if (defaults.ulp && defaults.ulp.length > 0) return defaults.ulp;

    return ulpList;
  }, [ulpList, activeUnitId]);

  // 1. Core Selection States (ULP, Periode, Jenis Laporan)
  const [reportType, setReportType] = useState<'foto' | 'peta' | 'work_order'>('foto');
  const [filterUlp, setFilterUlp] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState<string>(getFirstDayOfMonthString());
  const [filterEndDate, setFilterEndDate] = useState<string>(getTodayDateString());

  // 2. Secondary Filter States
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');
  const [filterNoWo, setFilterNoWo] = useState('ALL');

  // 3. Server Query Result States (Targeted Dataset)
  const [targetedRealisasi, setTargetedRealisasi] = useState<Realisasi[]>([]);
  const [targetedWorkOrders, setTargetedWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoadingQuery, setIsLoadingQuery] = useState(false);
  const [dataSource, setDataSource] = useState<'PostgreSQL/Supabase' | 'Dexie DB (Offline)'>('PostgreSQL/Supabase');
  const [lastQueriedParams, setLastQueriedParams] = useState<{
    ulp: string;
    startDate: string;
    endDate: string;
    type: string;
    total: number;
    executedAt: string;
  } | null>(null);

  // Export states
  const [latestMapImage, setLatestMapImage] = useState<string | null>(null);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [streetRoutePath, setStreetRoutePath] = useState<[number, number][]>([]);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const mapCaptureRef = useRef<MapReportCaptureRef>(null);

  // Set default ULP based on user context
  useEffect(() => {
    if (currentUser?.ulpName && filterUlp === 'ALL' && currentUser.role === 'User') {
      const matched = scopedUlpList.find(
        (u) => u.namaULP.toLowerCase().trim() === currentUser.ulpName?.toLowerCase().trim() ||
               u.id.toLowerCase().trim() === currentUser.ulpName?.toLowerCase().trim()
      );
      if (matched) {
        setFilterUlp(matched.namaULP);
      } else {
        setFilterUlp(currentUser.ulpName);
      }
    }
  }, [currentUser, scopedUlpList, filterUlp]);

  // Clean string helper
  const cleanStr = (s?: string | null) => {
    if (!s) return '';
    return String(s).toLowerCase().trim().replace(/[^a-z0-9]/gi, '');
  };

  // Selected ULP and Feeder display helpers
  const selectedUlpObj = useMemo(() => {
    return scopedUlpList.find((u) => u.id === filterUlp || u.namaULP === filterUlp) ||
           ulpList.find((u) => u.id === filterUlp || u.namaULP === filterUlp);
  }, [scopedUlpList, ulpList, filterUlp]);

  const selectedUlpName = useMemo(() => {
    if (selectedUlpObj) return selectedUlpObj.namaULP;
    if (filterUlp !== 'ALL') return filterUlp;
    return scopedUlpList[0]?.namaULP || targetedRealisasi[0]?.ulpName || targetedWorkOrders[0]?.ulpName || 'BUKITTINGGI';
  }, [selectedUlpObj, filterUlp, scopedUlpList, targetedRealisasi, targetedWorkOrders]);

  const selectedPenyulangObj = useMemo(() => {
    return penyulangList.find((p) => p.id === filterPenyulang || p.namaPenyulang === filterPenyulang);
  }, [penyulangList, filterPenyulang]);

  const selectedPenyulangName = useMemo(() => {
    if (selectedPenyulangObj) return selectedPenyulangObj.namaPenyulang;
    if (filterPenyulang !== 'ALL') return filterPenyulang;
    return targetedRealisasi[0]?.penyulangName || targetedWorkOrders[0]?.penyulangName || penyulangList[0]?.namaPenyulang || 'SEMUA FEEDER';
  }, [selectedPenyulangObj, filterPenyulang, targetedRealisasi, targetedWorkOrders, penyulangList]);

  const selectedAreaName = useMemo(() => {
    return settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  }, [settings.namaUnitLayanan]);

  // Available Penyulang list based strictly on active unitId and selected ULP
  const availablePenyulangList = useMemo(() => {
    const unitPenyulangs = penyulangList.filter((p: any) => {
      if (p.unitId && String(p.unitId).toUpperCase() === activeUnitId.toUpperCase()) return true;
      if (p.ulpId && String(p.ulpId).toUpperCase() === activeUnitId.toUpperCase()) return true;
      const matchesScoped = scopedUlpList.some(u => 
        cleanStr(u.namaULP) === cleanStr(p.ulpName) || cleanStr(u.id) === cleanStr(p.ulpId)
      );
      return matchesScoped;
    });

    const baseList = unitPenyulangs.length > 0 ? unitPenyulangs : penyulangList;

    if (filterUlp === 'ALL') return baseList;
    const targetUlpName = selectedUlpName;

    return baseList.filter((p) => {
      if (cleanStr(p.ulpId) === cleanStr(filterUlp) || cleanStr(p.ulpName) === cleanStr(filterUlp)) return true;
      if (selectedUlpObj && (cleanStr(p.ulpId) === cleanStr(selectedUlpObj.id) || cleanStr(p.ulpName) === cleanStr(selectedUlpObj.namaULP))) return true;
      if (p.ulpName && targetUlpName && (cleanStr(p.ulpName) === cleanStr(targetUlpName) || cleanStr(p.ulpName).includes(cleanStr(targetUlpName)))) return true;
      return false;
    });
  }, [penyulangList, activeUnitId, scopedUlpList, filterUlp, selectedUlpObj, selectedUlpName]);

  // Available Regu list based strictly on active unitId and selected ULP
  const availableReguList = useMemo(() => {
    const unitRegus = reguList.filter((r: any) => {
      if (r.unitId && String(r.unitId).toUpperCase() === activeUnitId.toUpperCase()) return true;
      if (r.ulpId && String(r.ulpId).toUpperCase() === activeUnitId.toUpperCase()) return true;
      const matchesScoped = scopedUlpList.some(u => 
        cleanStr(u.namaULP) === cleanStr(r.ulpName) || cleanStr(u.id) === cleanStr(r.ulpId)
      );
      return matchesScoped;
    });

    const baseList = unitRegus.length > 0 ? unitRegus : reguList;

    if (filterUlp === 'ALL') return baseList;
    const targetUlpName = selectedUlpName;

    return baseList.filter((r) => {
      if (cleanStr(r.ulpId) === cleanStr(filterUlp) || cleanStr(r.ulpName) === cleanStr(filterUlp)) return true;
      if (selectedUlpObj && (cleanStr(r.ulpId) === cleanStr(selectedUlpObj.id) || cleanStr(r.ulpName) === cleanStr(selectedUlpObj.namaULP))) return true;
      if (r.ulpName && targetUlpName && (cleanStr(r.ulpName) === cleanStr(targetUlpName) || cleanStr(r.ulpName).includes(cleanStr(targetUlpName)))) return true;
      return false;
    });
  }, [reguList, activeUnitId, scopedUlpList, filterUlp, selectedUlpObj, selectedUlpName]);

  // Pre-load Work Orders belonging to this initiated unitId for the dropdown
  const [unitWorkOrders, setUnitWorkOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadUnitWOs = async () => {
      try {
        const { dexieDb } = await import('../services/dexieDb');
        const localWos = await dexieDb.work_orders.toArray();
        const forUnit = localWos.filter((w: any) => {
          if (w.unitId && String(w.unitId).toUpperCase() === activeUnitId.toUpperCase()) return true;
          return scopedUlpList.some(u => cleanStr(u.namaULP) === cleanStr(w.ulpName));
        });
        if (isMounted) {
          setUnitWorkOrders(forUnit.length > 0 ? forUnit : localWos);
        }
      } catch {
        // Fallback
      }
    };
    loadUnitWOs();
    return () => { isMounted = false; };
  }, [activeUnitId, scopedUlpList]);

  // Available WO Numbers following active unitId, selected ULP, and selected Penyulang
  const availableWONumbers = useMemo(() => {
    const woSet = new Set<string>();

    // 1. From unit work orders matching active filters
    unitWorkOrders.forEach((wo) => {
      if (filterUlp !== 'ALL' && selectedUlpName) {
        if (cleanStr(wo.ulpName) !== cleanStr(selectedUlpName) && !cleanStr(wo.ulpName).includes(cleanStr(selectedUlpName))) return;
      }
      if (filterPenyulang !== 'ALL' && selectedPenyulangName) {
        if (cleanStr(wo.penyulangName) !== cleanStr(selectedPenyulangName)) return;
      }
      if (wo.nomorWO) woSet.add(wo.nomorWO);
    });

    // 2. From currently targeted query results
    targetedWorkOrders.forEach((wo) => {
      if (wo.nomorWO) woSet.add(wo.nomorWO);
    });
    targetedRealisasi.forEach((rel) => {
      if (rel.nomorWO) woSet.add(rel.nomorWO);
    });

    return Array.from(woSet).sort();
  }, [unitWorkOrders, targetedWorkOrders, targetedRealisasi, filterUlp, selectedUlpName, filterPenyulang, selectedPenyulangName]);

  // ==========================================
  // TARGETED QUERY EXECUTION (PostgreSQL / Supabase)
  // ==========================================
  const handleExecuteTargetedQuery = useCallback(async (isSilent: boolean = false) => {
    setIsLoadingQuery(true);

    try {
      const result = await SupabaseService.fetchTargetedReportData({
        jenisLaporan: reportType,
        unitId: activeUnitId, // Mengikuti unitId Inisiasi yang aktif
        ulpName: filterUlp !== 'ALL' ? selectedUlpName : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        penyulangName: filterPenyulang !== 'ALL' ? selectedPenyulangName : undefined,
        reguName: filterRegu !== 'ALL' ? filterRegu : undefined,
        nomorWO: filterNoWo !== 'ALL' ? filterNoWo : undefined,
      });

      if (result.success) {
        setTargetedRealisasi(result.realisasi);
        setTargetedWorkOrders(result.workOrders);
        setDataSource(result.source === 'supabase' ? 'PostgreSQL/Supabase' : 'Dexie DB (Offline)');

        setLastQueriedParams({
          ulp: filterUlp === 'ALL' ? `Semua ULP (${activeUnitName})` : selectedUlpName,
          startDate: filterStartDate,
          endDate: filterEndDate,
          type: reportType === 'foto' ? 'Laporan Foto Realisasi' : reportType === 'peta' ? 'Laporan Peta Spasial' : 'Laporan Rekapitulasi WO',
          total: result.totalCount,
          executedAt: new Date().toLocaleTimeString('id-ID'),
        });

        if (!isSilent) {
          showToast(`Berhasil memuat ${result.totalCount} data dari ${result.source === 'supabase' ? 'PostgreSQL Server' : 'Dexie Offline Cache'} (Unit: ${activeUnitName})`, 'success');
        }
      } else {
        if (!isSilent) {
          showToast('Tidak ada data yang ditemukan untuk filter yang dipilih.', 'info');
        }
      }
    } catch (err: any) {
      console.error('Targeted report query error:', err);
      if (!isSilent) {
        showToast('Gagal menjalankan query laporan: ' + (err.message || String(err)), 'error');
      }
    } finally {
      setIsLoadingQuery(false);
    }
  }, [reportType, activeUnitId, activeUnitName, filterUlp, selectedUlpName, filterStartDate, filterEndDate, filterPenyulang, selectedPenyulangName, filterRegu, filterNoWo, showToast]);

  // Initial load and automated query trigger on main filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      handleExecuteTargetedQuery(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [reportType, filterUlp, filterStartDate, filterEndDate, activeUnitId]);

  // Map WO by ID and Nomor_WO for robust lookup
  const workOrdersMap = useMemo(() => {
    const map: Record<string, WorkOrder> = {};
    unitWorkOrders.forEach((wo) => {
      if (wo.id) map[wo.id] = wo;
      if (wo.nomorWO) map[wo.nomorWO] = wo;
    });
    targetedWorkOrders.forEach((wo) => {
      if (wo.id) map[wo.id] = wo;
      if (wo.nomorWO) map[wo.nomorWO] = wo;
    });
    return map;
  }, [unitWorkOrders, targetedWorkOrders]);

  // Robust resolver for Penyulang / Feeder
  const resolvePenyulangName = useCallback((rel?: Realisasi, wo?: WorkOrder): string => {
    if (rel?.penyulangName && rel.penyulangName.trim() !== '' && rel.penyulangName !== '-' && rel.penyulangName !== 'null') {
      return rel.penyulangName;
    }
    const matchedWo = wo || (rel ? (workOrdersMap[rel.workOrderId] || workOrdersMap[rel.nomorWO] || (rel.id ? workOrdersMap[rel.id] : undefined)) : undefined);
    if (matchedWo?.penyulangName && matchedWo.penyulangName.trim() !== '' && matchedWo.penyulangName !== '-') {
      return matchedWo.penyulangName;
    }
    if (filterPenyulang !== 'ALL' && selectedPenyulangName && selectedPenyulangName !== 'Semua Penyulang') {
      return selectedPenyulangName;
    }
    const targetUlp = rel?.ulpName || matchedWo?.ulpName || selectedUlpName;
    if (targetUlp) {
      const matchFeeder = availablePenyulangList.find(p => cleanStr(p.ulpName) === cleanStr(targetUlp) || cleanStr(p.ulpId) === cleanStr(targetUlp));
      if (matchFeeder?.namaPenyulang) {
        return matchFeeder.namaPenyulang;
      }
    }
    return selectedPenyulangName !== 'Semua Penyulang' ? selectedPenyulangName : '-';
  }, [workOrdersMap, filterPenyulang, selectedPenyulangName, selectedUlpName, availablePenyulangList]);

  // Non-overlapping GIS Map points for Map Report
  const nonOverlappingMapPoints = useMemo(() => {
    const rawPoints = targetedRealisasi.length > 0
      ? targetedRealisasi.map((rel, idx) => {
          const wo = workOrdersMap[rel.workOrderId] || workOrdersMap[rel.nomorWO];
          const lat = rel.latitude || wo?.latitude || -0.286071;
          const lng = rel.longitude || wo?.longitude || 100.449261;
          const jenisTanaman = rel.jenisTanaman || wo?.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)';
          const noTiang = rel.noTiang || wo?.lokasi || `Tiang #${idx + 1}`;
          const photoUrl = rel.photosSesudah?.[0]?.dataUrl || rel.photosSebelum?.[0]?.dataUrl || rel.fotoSesudahUrl || rel.fotoSebelumUrl || wo?.lampiranUrl;
          const feeder = resolvePenyulangName(rel, wo);

          return {
            id: rel.id || `rel-${idx}`,
            nomorWO: rel.nomorWO || wo?.nomorWO || `WO-${idx + 1}`,
            ulpName: rel.ulpName || wo?.ulpName || selectedUlpName,
            penyulangName: feeder,
            jenisTanaman,
            noTiang,
            lat,
            lng,
            keterangan: rel.keterangan || 'POTONG',
            lokasiKerja: rel.lokasiKerja || wo?.lokasi || '',
            pertumbuhanTanaman: rel.pertumbuhanTanaman || 'SEDANG',
            status: rel.status || wo?.status || 'Selesai',
            photoUrl,
            tanggalRealisasi: rel.tanggalRealisasi || rel.createdAt || wo?.tanggal || wo?.createdAt,
          };
        })
      : targetedWorkOrders.map((wo, idx) => {
          const lat = wo.latitude || -0.286071;
          const lng = wo.longitude || 100.449261;
          const feeder = resolvePenyulangName(undefined, wo);
          return {
            id: wo.id || `wo-${idx}`,
            nomorWO: wo.nomorWO || `WO-${idx + 1}`,
            ulpName: wo.ulpName || selectedUlpName,
            penyulangName: feeder,
            jenisTanaman: wo.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)',
            noTiang: wo.lokasi || `Tiang #${idx + 1}`,
            lat,
            lng,
            keterangan: wo.deskripsi || 'PEMBANGKASAN POHON (ROW)',
            lokasiKerja: wo.lokasi || '',
            pertumbuhanTanaman: 'SEDANG',
            status: wo.status || 'Belum Dikerjakan',
            photoUrl: wo.lampiranUrl,
            tanggalRealisasi: wo.tanggal || wo.createdAt,
          };
        });

    const seenCoords = new Set<string>();

    return rawPoints.map((pt, idx) => {
      let lat = pt.lat;
      let lng = pt.lng;

      const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
      if (seenCoords.has(key)) {
        const angle = idx * 2.39996;
        const radius = 0.0015 * Math.sqrt(idx + 1);
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
  }, [targetedRealisasi, targetedWorkOrders, workOrdersMap, selectedUlpName, selectedPenyulangName]);

  const avgLat = nonOverlappingMapPoints.length > 0 ? nonOverlappingMapPoints.reduce((acc, p) => acc + p.lat, 0) / nonOverlappingMapPoints.length : -0.286071;
  const avgLng = nonOverlappingMapPoints.length > 0 ? nonOverlappingMapPoints.reduce((acc, p) => acc + p.lng, 0) / nonOverlappingMapPoints.length : 100.449261;
  const mapCenter: [number, number] = useMemo(() => [avgLat, avgLng], [avgLat, avgLng]);
  const mapPolylinePositions: [number, number][] = useMemo(() => nonOverlappingMapPoints.map((p) => [p.lat, p.lng]), [nonOverlappingMapPoints]);

  const routeCoordsKey = useMemo(() => {
    return nonOverlappingMapPoints.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  }, [nonOverlappingMapPoints]);

  // Street routing via OSRM
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

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // PDF Export Handler
  const handleExportPDF = async () => {
    if (reportType === 'foto') {
      const enrichedRealisasi = targetedRealisasi.map((rel) => ({
        ...rel,
        penyulangName: resolvePenyulangName(rel),
      }));
      generateCetakPhotoPDF(enrichedRealisasi, workOrdersMap, settings, selectedUlpName, targetedWorkOrders);
      showToast('PDF Laporan Foto Realisasi Berhasil Dibuat', 'success');
    } else if (reportType === 'peta') {
      setIsGeneratingPDF(true);
      try {
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
          penyulangName: pt.penyulangName,
          tanggalRealisasi: pt.tanggalRealisasi,
        }));

        await generateEnhancedLaporanPetaPDF(
          targetedWorkOrders,
          settings,
          selectedUlpName,
          selectedPenyulangName,
          targetedRealisasi,
          exportPoints,
          activePolylinePositions
        );
        
        showToast('PDF Laporan Peta Berhasil Dibuat', 'success');
      } catch (error) {
        console.error('Failed to generate enhanced PDF:', error);
        showToast('Gagal membuat PDF Laporan Peta', 'error');
        
        generateLaporanPetaPDF(
          targetedWorkOrders,
          settings,
          selectedUlpName,
          selectedPenyulangName,
          targetedRealisasi,
          latestMapImage || undefined,
          nonOverlappingMapPoints
        );
      } finally {
        setIsGeneratingPDF(false);
      }
    } else {
      // Work Order PDF
      generateCetakPhotoPDF(targetedRealisasi, workOrdersMap, settings, selectedUlpName, targetedWorkOrders);
      showToast('PDF Rekapitulasi Work Order Berhasil Dibuat', 'success');
    }
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    setIsGeneratingExcel(true);
    try {
      if (reportType === 'foto') {
        const enrichedRealisasi = targetedRealisasi.map((rel) => ({
          ...rel,
          penyulangName: resolvePenyulangName(rel),
        }));
        await exportCetakPhotoToExcel(enrichedRealisasi, workOrdersMap, settings, selectedUlpName, targetedWorkOrders);
        showToast('File Excel Eviden Foto Berhasil Diunduh', 'success');
      } else if (reportType === 'peta') {
        await exportCetakPetaToExcel(nonOverlappingMapPoints, settings, selectedUlpName, selectedPenyulangName);
        showToast('File Excel Peta Pohon Berhasil Diunduh', 'success');
      } else {
        await exportWorkOrdersToExcel(targetedWorkOrders, selectedUlpName);
        showToast('File Excel Work Order Berhasil Diunduh', 'success');
      }
    } catch (err: any) {
      console.error('Export Excel error:', err);
      showToast('Gagal mengunduh file Excel: ' + (err.message || String(err)), 'error');
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  // Quick period helper
  const handleApplyPreset = (preset: 'today' | '7days' | 'this_month' | 'last_month') => {
    const now = new Date();
    const todayStr = getTodayDateString();

    if (preset === 'today') {
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else if (preset === '7days') {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 7);
      const past7Str = `${past7.getFullYear()}-${String(past7.getMonth() + 1).padStart(2, '0')}-${String(past7.getDate()).padStart(2, '0')}`;
      setFilterStartDate(past7Str);
      setFilterEndDate(todayStr);
    } else if (preset === 'this_month') {
      setFilterStartDate(getFirstDayOfMonthString());
      setFilterEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startStr = `${firstDayPrevMonth.getFullYear()}-${String(firstDayPrevMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const endStr = `${lastDayPrevMonth.getFullYear()}-${String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonth.getDate()).padStart(2, '0')}`;
      setFilterStartDate(startStr);
      setFilterEndDate(endStr);
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

      {/* Top Header & Targeted Filter Selection Panel */}
      <div className="no-print bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
        
        {/* Title and Action Buttons */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display flex items-center space-x-3">
              <div className="p-2 bg-teal-50 dark:bg-teal-950 rounded-xl">
                <FileText className="w-6 h-6 text-[#00A2B9]" />
              </div>
              <span>Cetak Laporan & Dokumen Eksekusi</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Query tertarget langsung ke PostgreSQL/Supabase. Hanya memuat data sesuai ULP, periode, dan filter yang dipilih.
            </p>
          </div>

          {/* Action Buttons Group */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              onClick={() => handleExecuteTargetedQuery(false)}
              disabled={isLoadingQuery}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
              title="Jalankan Query ke PostgreSQL"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingQuery ? 'animate-spin' : ''}`} />
              <span>{isLoadingQuery ? 'Memuat...' : 'Query Database'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPDF || isLoadingQuery}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Download File PDF Laporan"
            >
              <Download className={`w-4 h-4 ${isGeneratingPDF ? 'animate-spin' : ''}`} />
              <span>PDF Report</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isGeneratingExcel || isLoadingQuery}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#008396] hover:bg-[#00A2B9] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Download File Spreadsheet Excel (.xlsx)"
            >
              <FileSpreadsheet className={`w-4 h-4 ${isGeneratingExcel ? 'animate-spin' : ''}`} />
              <span>Excel Export</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={isLoadingQuery}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#00A2B9] hover:bg-[#008396] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Cetak/Print Dokumen"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* 1. Step: Pilih Jenis Laporan (Tab Selector) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-slate-700">
          <div className="flex flex-wrap bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1 select-none shadow-inner">
            <button
              onClick={() => setReportType('foto')}
              className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                reportType === 'foto'
                  ? 'bg-white dark:bg-slate-800 text-[#00A2B9] dark:text-teal-400 shadow-md ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>1. Laporan Foto Realisasi (Eviden)</span>
            </button>

            <button
              onClick={() => setReportType('peta')}
              className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                reportType === 'peta'
                  ? 'bg-white dark:bg-slate-800 text-[#00A2B9] dark:text-teal-400 shadow-md ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>2. Laporan Peta & Rute Spasial</span>
            </button>

            <button
              onClick={() => setReportType('work_order')}
              className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                reportType === 'work_order'
                  ? 'bg-white dark:bg-slate-800 text-[#00A2B9] dark:text-teal-400 shadow-md ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>3. Rekapitulasi Work Order (WO)</span>
            </button>
          </div>
        </div>

        {/* 2. Step: Dedicated Targeted Filter Panel Card */}
        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
              <div className="p-1.5 bg-[#00A2B9]/10 rounded-lg text-[#00A2B9]">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider block text-[#008396] dark:text-teal-400">
                  PARAMETER QUERY DATABASE POSTGRESQL
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  Database mengeksekusi: <code className="font-mono text-teal-600 dark:text-teal-400">WHERE ulp = ... AND tanggal BETWEEN ...</code>
                </span>
              </div>
            </div>

            {/* Quick Period Presets */}
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg text-teal-800 dark:text-teal-300 font-bold">
                <Building2 className="w-3 h-3 text-[#00A2B9]" />
                <span>Unit Inisiasi: <span className="font-extrabold text-[#008396] dark:text-teal-400">{activeUnitName}</span> (<code className="font-mono">{activeUnitId}</code>)</span>
              </div>
              <span className="text-slate-400 font-bold ml-1">Preset:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('today')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('7days')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('this_month')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('last_month')}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              >
                Bulan Lalu
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Pilih ULP */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[#00A2B9]" />
                <span>Pilih ULP ({activeUnitId})</span>
              </span>
              <select
                value={filterUlp}
                onChange={(e) => {
                  setFilterUlp(e.target.value);
                  setFilterPenyulang('ALL');
                  setFilterRegu('ALL');
                  setFilterNoWo('ALL');
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer shadow-xs"
              >
                <option value="ALL">Semua ULP di {activeUnitName}</option>
                {scopedUlpList.map((u, idx) => (
                  <option key={`${u.id}-${idx}`} value={u.namaULP}>
                    {u.namaULP}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Tanggal Mulai */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#00A2B9]" />
                <span>Tanggal Mulai</span>
              </span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer shadow-xs"
              />
            </div>

            {/* 3. Tanggal Selesai */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#00A2B9]" />
                <span>Tanggal Selesai</span>
              </span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer shadow-xs"
              />
            </div>

            {/* 4. Penyulang (Feeder) */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Penyulang (Feeder)
              </span>
              <select
                value={filterPenyulang}
                onChange={(e) => {
                  setFilterPenyulang(e.target.value);
                  setFilterNoWo('ALL');
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer shadow-xs"
              >
                <option value="ALL">Semua Penyulang</option>
                {availablePenyulangList.map((p, idx) => (
                  <option key={`${p.id}-${idx}`} value={p.namaPenyulang}>
                    {p.namaPenyulang}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Regu Pelaksana */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Regu Pelaksana
              </span>
              <select
                value={filterRegu}
                onChange={(e) => {
                  setFilterRegu(e.target.value);
                  setFilterNoWo('ALL');
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer shadow-xs"
              >
                <option value="ALL">Semua Regu</option>
                {availableReguList.map((r, idx) => (
                  <option key={`${r.id}-${idx}`} value={r.namaRegu}>
                    {r.namaRegu}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Nomor WO */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Nomor Work Order
              </span>
              <select
                value={filterNoWo}
                onChange={(e) => setFilterNoWo(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#00A2B9]/20 outline-none transition-all cursor-pointer shadow-xs"
              >
                <option value="ALL">Semua Nomor WO</option>
                {availableWONumbers.map((woNum, idx) => (
                  <option key={`${woNum}-${idx}`} value={woNum}>
                    {woNum}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 3. Step: Status Query Database Confirmation Bar */}
        {lastQueriedParams && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-teal-50/80 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-teal-600 text-white font-extrabold rounded-lg text-[10px] uppercase shadow-2xs">
                <Database className="w-3 h-3" />
                <span>{dataSource}</span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                🏢 ULP: <strong className="text-teal-700 dark:text-teal-400">{lastQueriedParams.ulp}</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                📅 Periode: <strong className="text-slate-900 dark:text-white">{formatDateDisplay(lastQueriedParams.startDate)} s/d {formatDateDisplay(lastQueriedParams.endDate)}</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                📑 Jenis: <strong className="text-slate-900 dark:text-white">{lastQueriedParams.type}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-2 font-bold text-teal-800 dark:text-teal-300">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>Ditemukan: <strong>{lastQueriedParams.total} Baris Data</strong></span>
              <span className="text-[10px] text-slate-400 font-normal">({lastQueriedParams.executedAt})</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Step: Tampilkan Hasil (Printable Document & Live Preview Surface) */}
      <div className="bg-white text-slate-900 p-4 sm:p-8 rounded-3xl border border-slate-200 shadow-md space-y-6 print:p-0 print:border-none print:shadow-none overflow-hidden">
        
        {/* ======================================================== */}
        {/* VIEW 1: Subhalaman Laporan CETAK PHOTO (Foto Realisasi)  */}
        {/* ======================================================== */}
        {reportType === 'foto' && (
          <div className="space-y-6">
            {/* Top Header Labels */}
            <div className="flex items-center justify-between font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
              <div>EVIDEN ROW AREA {selectedAreaName}</div>
              <div>ULP {selectedUlpName}</div>
            </div>

            {/* Rekap Hasil ROW Table View with Photos */}
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
                  <tr className="bg-[#00A2B9] text-white font-extrabold text-xs uppercase tracking-wider">
                    <th colSpan={14} className="p-2 border-b border-[#008396] bg-[#00A2B9] text-center">
                      REKAP HASIL ROW - EVIDEN FOTO EKSEKUSI
                    </th>
                  </tr>
                  <tr className="bg-[#008396] text-white font-bold text-[11px] uppercase tracking-wider">
                    <th colSpan={14} className="p-1.5 border-b border-[#008396] bg-[#008396] text-center">
                      PLN ELECTRICITY SERVICES • PERIODE: {formatDateDisplay(filterStartDate)} S/D {formatDateDisplay(filterEndDate)}
                    </th>
                  </tr>
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
                  {targetedRealisasi.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-12 text-slate-400 text-xs italic text-center">
                        <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        Tidak ada data realisasi foto yang memenuhi kriteria filter ULP & Periode ini.
                      </td>
                    </tr>
                  ) : (
                    targetedRealisasi.map((rel, idx) => {
                      const wo = workOrdersMap[rel.workOrderId] || workOrdersMap[rel.nomorWO];
                      const lat = rel.latitude || wo?.latitude || -0.286071;
                      const lng = rel.longitude || wo?.longitude || 100.449261;
                      const feederName = resolvePenyulangName(rel, wo);

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
                            {rel.reguName || wo?.reguName || rel.petugasName || ''}
                          </td>
                          <td className="p-2 border border-slate-200 font-medium text-[10px]">
                            {feederName}
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
                            {rel.jenisTanaman || wo?.jenisPekerjaan || 'PEMBANGKASAN POHON (ROW)'}
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

        {/* ======================================================== */}
        {/* VIEW 2: Subhalaman Laporan CETAK PETA (Peta & Rute ROW)  */}
        {/* ======================================================== */}
        {reportType === 'peta' && (
          <div className="space-y-6">
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
                <div className="col-span-3 sm:col-span-2 p-2 bg-white flex items-center justify-center">
                  <LogoComponent />
                </div>

                <div className="col-span-6 sm:col-span-8 p-2 flex flex-col items-center justify-center bg-white">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                    GAMBAR PETA POHON (ROW)
                  </h3>
                  <h4 className="font-bold text-[11px] sm:text-xs text-teal-800 uppercase">
                    FEEDER {selectedPenyulangName}
                  </h4>
                  <p className="font-extrabold text-[10px] sm:text-xs text-slate-800 uppercase">
                    ULP {selectedUlpName} • PERIODE: {formatDateDisplay(filterStartDate)} S/D {formatDateDisplay(filterEndDate)}
                  </p>
                </div>

                <div className="col-span-3 sm:col-span-2 p-1.5 bg-slate-50 flex flex-col items-center justify-center text-[9px] font-bold text-slate-600">
                  <span className="text-[#008396]">Safety First 🛡️</span>
                  <span className="text-[8px] text-slate-400">YKAN / SK3 Certified</span>
                </div>
              </div>

              {/* Interactive GIS Map */}
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
                    preferCanvas={true}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='Tiles &copy; Esri'
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
                        <Polyline
                          positions={activePolylinePositions}
                          color="#0f172a"
                          weight={6}
                          opacity={0.85}
                        />
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
                  <p className="text-slate-600">Feeder: <span className="font-bold text-slate-800">{selectedPenyulangName}</span></p>
                  <p className="text-slate-600">ULP: <span className="font-bold text-slate-800">{selectedUlpName}</span></p>
                </div>
              </MapReportCapture>

              {/* Keterangan Summary Block */}
              <div className="border border-slate-900 rounded-lg p-3 bg-white text-[10px] space-y-2">
                <div className="font-extrabold text-slate-900 border-b border-slate-900 pb-1 uppercase flex justify-between items-center">
                  <span>KETERANGAN REKAPITULASI :</span>
                  <span className="text-slate-600 font-semibold">
                    PERIODE: {formatDateDisplay(filterStartDate)} S/D {formatDateDisplay(filterEndDate)}
                  </span>
                </div>

                {(() => {
                  const summaryWoNumbers = targetedWorkOrders.map(w => w.nomorWO).join(', ') || targetedRealisasi[0]?.nomorWO || '-';
                  const summaryTotalRealisasi = nonOverlappingMapPoints.length;
                  const summaryPangkas = nonOverlappingMapPoints.filter(p => (p.keterangan || p.jenisTanaman || '').toUpperCase().includes('PANGKAS')).length;
                  const summaryTebang = nonOverlappingMapPoints.filter(p => (p.keterangan || p.jenisTanaman || '').toUpperCase().includes('TEBANG')).length;
                  const summaryPotong = nonOverlappingMapPoints.filter(p => (p.keterangan || p.jenisTanaman || '').toUpperCase().includes('POTONG')).length;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 font-medium text-slate-800 text-[11px]">
                      <div className="space-y-1 pt-1 sm:pt-0">
                        <p><span className="font-extrabold">NO WO:</span> {summaryWoNumbers}</p>
                        <p><span className="font-extrabold">NAMA ULP:</span> {selectedUlpName}</p>
                        <p><span className="font-extrabold">NAMA PENYULANG:</span> {selectedPenyulangName}</p>
                      </div>

                      <div className="space-y-1 sm:pl-3 pt-1 sm:pt-0">
                        <p><span className="font-extrabold">JUMLAH REALISASI:</span> {summaryTotalRealisasi} Titik</p>
                        <p><span className="font-extrabold text-amber-700">JUMLAH PANGKAS:</span> {summaryPangkas}</p>
                        <p><span className="font-extrabold text-red-600">JUMLAH TEBANG:</span> {summaryTebang}</p>
                        <p><span className="font-extrabold text-[#008396]">JUMLAH POTONG:</span> {summaryPotong}</p>
                      </div>

                      <div className="sm:pl-3 flex flex-col items-center justify-center pt-1 sm:pt-0 text-[11px]">
                        <div className="text-center">
                          <p className="font-extrabold text-slate-900 text-xs">Mengetahui / Disetujui</p>
                          <p className="text-slate-500 text-[10px] mt-1">TL. TEKNIK / SPV ROW</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: Subhalaman Laporan REKAPITULASI WORK ORDER (WO)   */}
        {/* ======================================================== */}
        {reportType === 'work_order' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
              <div>REKAPITULASI WORK ORDER (WO) ROW</div>
              <div>ULP {selectedUlpName}</div>
            </div>

            <div 
              ref={draggable3.ref}
              onMouseDown={draggable3.onMouseDown}
              onMouseUp={draggable3.onMouseUp}
              onMouseLeave={draggable3.onMouseLeave}
              onMouseMove={draggable3.onMouseMove}
              className="overflow-x-auto border border-slate-200 rounded-xl"
              style={draggable3.style}
            >
              <table className="w-full text-left text-xs border border-slate-200 min-w-[850px]">
                <thead className="bg-[#008396] text-white font-bold">
                  <tr>
                    <th className="p-2.5 border border-[#008396] text-center w-12">No</th>
                    <th className="p-2.5 border border-[#008396]">Nomor WO</th>
                    <th className="p-2.5 border border-[#008396]">Tanggal</th>
                    <th className="p-2.5 border border-[#008396]">ULP</th>
                    <th className="p-2.5 border border-[#008396]">Penyulang</th>
                    <th className="p-2.5 border border-[#008396]">Lokasi Pekerjaan</th>
                    <th className="p-2.5 border border-[#008396]">Koordinat GPS</th>
                    <th className="p-2.5 border border-[#008396]">Petugas / Tim</th>
                    <th className="p-2.5 border border-[#008396] text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {targetedWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-slate-400 text-xs italic text-center">
                        <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        Tidak ada data Work Order yang memenuhi kriteria filter ULP & Periode ini.
                      </td>
                    </tr>
                  ) : (
                    targetedWorkOrders.map((wo, i) => (
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
                        <td className="p-2 border">{wo.petugasName || wo.reguName || '-'}</td>
                        <td className="p-2 border font-bold text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            wo.status === 'Selesai' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {wo.status || 'Belum Dikerjakan'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
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
