import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useGASSync } from '../context/GASSyncContext';
import { useToast } from '../hooks/useToast';
import { WorkOrder, WOStatus, WOPriority } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { QRCodeModal } from '../components/common/QRCodeModal';
import { EditWorkOrderModal } from '../components/common/EditWorkOrderModal';
import { exportWorkOrdersToExcel } from '../utils/exportUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import {
  Search,
  Filter,
  Download,
  QrCode,
  Eye,
  Edit,
  Trash2,
  PlusCircle,
  X,
  MapPin,
  Calendar,
  UserCheck,
  CheckSquare,
  FileCheck2,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { formatDateDisplay, normalizeDateISO } from '../utils/dateUtils';

interface WorkOrderPageProps {
  onAdd?: () => void;
  onEdit?: (wo: any) => void;
}

export const WorkOrderPage: React.FC<WorkOrderPageProps> = ({ onAdd, onEdit }) => {
  const { user: currentUser } = useAuth();
  const { workOrders, deleteWorkOrder } = useWorkOrders();
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { settings } = useSettings();
  const { setActiveTab, setSelectedWoIdForRealisasi, setIsFinalizingMode } = useUI();
  const { showToast } = useToast();
  const draggable = useDraggableScroll();

  // Get pending items from sync queue to identify unsynced WOs
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  
  React.useEffect(() => {
    const checkPending = () => {
      try {
        const raw = localStorage.getItem('aphro_pending_sync_queue');
        if (raw) {
          const queue = JSON.parse(raw);
          const ids = queue
            .filter((item: any) => item.type === 'WORK_ORDER_CREATE' || item.type === 'WORK_ORDER_UPDATE')
            .map((item: any) => item.payload?.id || item.payload?.workOrder?.id);
          setPendingIds(ids);
        } else {
          setPendingIds([]);
        }
      } catch (e) {
        setPendingIds([]);
      }
    };
    
    checkPending();
    const interval = setInterval(checkPending, 3000);
    return () => clearInterval(interval);
  }, []);

  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [filterRegu, setFilterRegu] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState(getTodayDateString());

  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [qrModalWO, setQrModalWO] = useState<WorkOrder | null>(null);
  const [editModalWO, setEditModalWO] = useState<WorkOrder | null>(null);

  const { isSyncing, syncWithGAS, pendingCount } = useGASSync();

  // Fetch latest work orders from Spreadsheet when page mounts
  React.useEffect(() => {
    if (settings.gasWebAppUrl && navigator.onLine) {
      syncWithGAS(undefined, true); // Silent sync
    }
  }, [settings.gasWebAppUrl, syncWithGAS]);

  const handleManualSync = async () => {
    try {
      await syncWithGAS(showToast);
    } catch (e) {
      showToast('Gagal melakukan sinkronisasi manual', 'error');
    }
  };

  const role = currentUser?.role || 'User';
  const isUserRole = role.toLowerCase() === 'user';
  const isAdminRole = ['admin', 'superadmin', 'adm'].includes(role.toLowerCase());

  // Helper to clean string for better matching
  const cleanStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // Filter logic
  const filteredWOs = workOrders.filter((wo) => {
    // If User role, restrict to their Regu
    if (isUserRole) {
      const userRegu = cleanStr(currentUser?.reguName || '');
      const woRegu = cleanStr(wo.reguName || '');
      const userName = cleanStr(currentUser?.name || '');
      const woPetugas = cleanStr(wo.petugasName || '');
      
      const matchRegu = userRegu !== '' && (woRegu === userRegu || woRegu.includes(userRegu));
      const matchReguId = wo.reguId && currentUser?.reguId && String(wo.reguId) === String(currentUser.reguId);
      const matchPetugas = userName !== '' && (woPetugas === userName || woPetugas.includes(userName));
      
      if (!matchRegu && !matchReguId && !matchPetugas) return false;
    }

    const matchesSearch =
      (wo.nomorWO || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.petugasName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.penyulangName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUlp = filterUlp === 'ALL' || 
      cleanStr(wo.ulpName) === cleanStr(filterUlp) || 
      cleanStr(wo.ulpId) === cleanStr(filterUlp);
    
    const matchesPenyulang = filterPenyulang === 'ALL' || 
      cleanStr(wo.penyulangName) === cleanStr(filterPenyulang) ||
      cleanStr(wo.penyulangId) === cleanStr(filterPenyulang);
      
    const matchesRegu = filterRegu === 'ALL' || 
      cleanStr(wo.reguName) === cleanStr(filterRegu);
      
    const matchesStatus = filterStatus === 'ALL' || wo.status === filterStatus;
    const itemDate = normalizeDateISO(wo.tanggal || wo.createdAt);
    const matchesDate = !filterDate || itemDate === filterDate;

    return matchesSearch && matchesUlp && matchesPenyulang && matchesRegu && matchesStatus && matchesDate;
  }).sort((a, b) => {
    // 1. Sort by Date (Newest to Oldest)
    const dateA = new Date(a.tanggal || 0).getTime();
    const dateB = new Date(b.tanggal || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;

    // 2. Sort by Regu Name (A-Z)
    const nameA = (a.reguName || '').toLowerCase();
    const nameB = (b.reguName || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">
            {isUserRole ? 'Work Order Saya (Penugasan)' : 'Daftar Seluruh Work Order'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Kelola data instruksi kerja, lokasi tapak tiang, status progress, dan pelimpahan tugas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold text-xs rounded-xl shadow-sm hover:bg-amber-100 transition-all active:scale-95 ${isSyncing ? 'animate-pulse opacity-70' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync {pendingCount} Data</span>
            </button>
          )}

          {!isUserRole && (
            <button
              onClick={() => exportWorkOrdersToExcel(filteredWOs, settings.namaUnitLayanan)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-[#00A2B9]" />
              <span>Export Excel</span>
            </button>
          )}

          {isAdminRole && (
            <button
              onClick={() => onAdd ? onAdd() : setActiveTab('input_wo')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#00A2B9] hover:bg-[#008396] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>Tambah Work Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Control Bar */}
      {!isUserRole && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Field */}
            <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari WO, Lokasi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00A2B9]"
            />
          </div>

          {/* Filter ULP */}
          <div>
            <select
              value={filterUlp}
              onChange={(e) => {
                setFilterUlp(e.target.value);
                setFilterPenyulang('ALL');
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00A2B9]"
            >
              <option value="ALL">Semua ULP</option>
              {ulpList.map((u, idx) => (
                <option key={`${u.id}-${idx}`} value={u.namaULP}>
                  {u.namaULP}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Penyulang */}
          <div>
            <select
              value={filterPenyulang}
              onChange={(e) => setFilterPenyulang(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00A2B9]"
            >
              <option value="ALL">Semua Penyulang</option>
              {penyulangList
                .filter(p => filterUlp === 'ALL' || cleanStr(p.ulpName) === cleanStr(filterUlp) || cleanStr(p.ulpId) === cleanStr(filterUlp))
                .map((p, idx) => (
                <option key={`${p.id}-${idx}`} value={p.namaPenyulang}>
                  {p.namaPenyulang}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Regu */}
          <div>
            <select
              value={filterRegu}
              onChange={(e) => setFilterRegu(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00A2B9]"
            >
              <option value="ALL">Semua Regu</option>
              {reguList
                .filter(r => filterUlp === 'ALL' || cleanStr(r.ulpName) === cleanStr(filterUlp))
                .map((r, idx) => (
                <option key={`${r.id}-${idx}`} value={r.namaRegu}>
                  {r.namaRegu}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00A2B9]"
            >
              <option value="ALL">Semua Status</option>
              <option value="Belum Dikerjakan">Belum Dikerjakan (Merah)</option>
              <option value="Sedang Dikerjakan">Sedang Dikerjakan (Kuning)</option>
              <option value="Selesai">Selesai (Hijau)</option>
            </select>
          </div>

          {/* Filter Date */}
          <div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00A2B9]"
                title="Filter Tanggal Work Order"
              />
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate('')}
                  className="px-2 py-2 text-[10px] bg-slate-200 dark:bg-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors whitespace-nowrap"
                  title="Tampilkan Semua Tanggal"
                >
                  Semua
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Data View (Mobile HP Cards + Desktop Table) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Mobile View: HP Touch-Optimized Cards */}
        <div className="md:hidden p-3 space-y-3">
          {filteredWOs.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              Tidak ada Work Order yang sesuai dengan kriteria filter.
            </div>
          ) : (
            filteredWOs.map((wo, idx) => (
              <div
                key={`mobile-wo-${wo.id}-${idx}`}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-teal-100 dark:border-slate-700/80 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                      {wo.nomorWO}
                    </span>
                    {pendingIds.includes(wo.id) ? (
                      <span title="Menunggu Sinkronisasi ke Spreadsheet" className="flex items-center text-amber-500">
                        <CloudOff className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span title="Sudah Tersinkron ke Spreadsheet" className="flex items-center text-teal-500">
                        <Cloud className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <StatusBadge status={wo.status} size="sm" />
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase">
                    {wo.penyulangName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center mt-0.5">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                    <span className="truncate">{wo.ulpName}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 block">TANGGAL</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{formatDateDisplay(wo.tanggal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">REGU</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{wo.reguName || 'Tim ROW'}</span>
                  </div>
                  {(wo.volumePekerjaan || wo.woKms || wo.woBatang) && (
                    <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">VOLUME:</span>
                      <span className="font-bold text-teal-600 dark:text-teal-400 font-mono">
                        {wo.volumePekerjaan || wo.woKms || wo.woBatang} {wo.satuan || 'KMS'}
                      </span>
                    </div>
                  )}
                </div>

                  {/* Mobile Action Buttons */}
                <div className="pt-2 flex items-center gap-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <button
                    disabled={isUserRole && wo.status === 'Selesai'}
                    onClick={() => {
                      if (setSelectedWoIdForRealisasi) {
                        setSelectedWoIdForRealisasi(wo.id);
                      }
                      setActiveTab('input_realisasi');
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 transition-transform ${
                      isUserRole && wo.status === 'Selesai'
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-[#008396] hover:bg-[#00A2B9] text-white'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>{wo.status === 'Selesai' ? 'Sudah Selesai' : 'Realisasi'}</span>
                  </button>

                  {wo.status !== 'Selesai' && (
                    <button
                      onClick={() => {
                        if (setSelectedWoIdForRealisasi) {
                          setSelectedWoIdForRealisasi(wo.id);
                          setIsFinalizingMode(true);
                        }
                        setActiveTab('input_realisasi');
                      }}
                      className="flex-1 py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm active:scale-95"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>Selesai</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedWO(wo)}
                    className="py-2.5 px-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 active:scale-95"
                    title="Detail"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setQrModalWO(wo)}
                    className="py-2.5 px-3 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 active:scale-95"
                    title="QR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  {isAdminRole && (
                    <>
                      <button
                        onClick={() => {
                          if (onEdit) onEdit(wo);
                          else setEditModalWO(wo);
                        }}
                        className="py-2.5 px-3 bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 active:scale-95"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm('Hapus Work Order ini?')) {
                            await deleteWorkOrder(wo.id);
                          }
                        }}
                        className="py-2.5 px-3 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 active:scale-95"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div 
          ref={draggable.ref}
          onMouseDown={draggable.onMouseDown}
          onMouseUp={draggable.onMouseUp}
          onMouseLeave={draggable.onMouseLeave}
          onMouseMove={draggable.onMouseMove}
          className="hidden md:block overflow-x-auto"
          style={draggable.style}
        >
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 pl-5">No WO & Tanggal</th>
                <th className="p-3.5">ULP / Penyulang</th>
                <th className="p-3.5">Regu & Petugas</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredWOs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Tidak ada Work Order yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredWOs.map((wo, idx) => (
                  <tr
                    key={`${wo.id}-${idx}`}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center space-x-2 mb-0.5">
                        <p className="font-bold text-[#00A2B9] dark:text-teal-400 text-[11px]">
                          {wo.nomorWO}
                        </p>
                        {pendingIds.includes(wo.id) ? (
                          <div className="group relative">
                            <CloudOff className="w-3 h-3 text-amber-500 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] p-1.5 rounded shadow-lg z-10 whitespace-nowrap">
                              Menunggu Sinkronisasi ke Spreadsheet
                            </div>
                          </div>
                        ) : (
                          <div className="group relative">
                            <Cloud className="w-3 h-3 text-teal-500 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] p-1.5 rounded shadow-lg z-10 whitespace-nowrap">
                              Sudah Tersinkron ke Spreadsheet
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium flex items-center">
                        <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                        {formatDateDisplay(wo.tanggal)}
                      </p>
                      {(wo.volumePekerjaan || wo.woKms || wo.woBatang) && (
                        <div className="flex items-center space-x-1.5 mt-1">
                          {wo.satuan ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-600 uppercase">
                              Vol: {wo.volumePekerjaan} {wo.satuan}
                            </span>
                          ) : wo.woKms ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-600 uppercase">
                              Vol: {wo.woKms} KMS
                            </span>
                          ) : wo.woBatang ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-600 uppercase">
                              Vol: {wo.woBatang} GAWANG
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 dark:text-white uppercase text-[11px]">
                        {wo.penyulangName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">{wo.ulpName}</p>
                    </td>

                    <td className="p-3.5">
                      <p className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                        {wo.petugasName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium uppercase">{wo.reguName}</p>
                    </td>

                    <td className="p-3.5">
                      <StatusBadge status={wo.status} size="sm" />
                    </td>

                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => setSelectedWO(wo)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#008396] hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                          title="Detail Work Order"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setQrModalWO(wo)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                          title="Generate QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        <button
                          disabled={isUserRole && wo.status === 'Selesai'}
                          onClick={() => {
                            if (setSelectedWoIdForRealisasi) {
                              setSelectedWoIdForRealisasi(wo.id);
                            }
                            setActiveTab('input_realisasi');
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isUserRole && wo.status === 'Selesai'
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:text-[#008396] hover:bg-teal-50 dark:hover:bg-teal-950/40'
                          }`}
                          title={wo.status === 'Selesai' ? 'Pekerjaan ini sudah selesai' : 'Input Realisasi Work Order Ini'}
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>

                        {wo.status !== 'Selesai' && (
                          <button
                            onClick={() => {
                              if (setSelectedWoIdForRealisasi) {
                                setSelectedWoIdForRealisasi(wo.id);
                                setIsFinalizingMode(true);
                              }
                              setActiveTab('input_realisasi');
                            }}
                            className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                            title="Penyelesaian Pekerjaan (Final)"
                          >
                            <FileCheck2 className="w-4 h-4" />
                          </button>
                        )}

                        {isAdminRole && (
                          <>
                            <button
                              onClick={() => {
                                if (onEdit) onEdit(wo);
                                else setEditModalWO(wo);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#008396] hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                              title="Edit Work Order"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('Hapus Work Order ini?')) {
                                  await deleteWorkOrder(wo.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Hapus Work Order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <span className="text-xs font-bold text-[#00A2B9] dark:text-teal-400">
                  {selectedWO.nomorWO}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  {selectedWO.jenisPekerjaan}
                </h3>
              </div>
              <button
                onClick={() => setSelectedWO(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-[11px] text-slate-400">Tanggal Pelaksanaan</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDateDisplay(selectedWO.tanggal)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Unit Layanan (ULP)</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedWO.ulpName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Penyulang / Feeder</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedWO.penyulangName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Regu ROW</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedWO.reguName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Petugas Terstruktur</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedWO.petugasName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">WO AWAL</p>
                  <p className="font-bold text-teal-600 dark:text-teal-400">
                    {selectedWO.woMulai || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">WO AKHIR</p>
                  <p className="font-bold text-teal-600 dark:text-teal-400">
                    {selectedWO.woAkhir || '-'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 font-semibold mb-1">Lokasi & Alamat:</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  📍 {selectedWO.lokasi}
                </p>
                <p className="text-slate-500 text-xs">{selectedWO.alamat}</p>
                <p className="text-xs text-teal-600 font-mono mt-1">
                  GPS: {selectedWO.latitude}, {selectedWO.longitude}
                </p>
              </div>

              <div>
                <p className="text-slate-400 font-semibold mb-1">Deskripsi Tugas:</p>
                <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {selectedWO.deskripsi}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-[11px] text-slate-400">Status Pekerjaan</p>
                  <StatusBadge status={selectedWO.status} />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Deadline</p>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {selectedWO.deadline}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedWO(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        workOrder={qrModalWO}
        onClose={() => setQrModalWO(null)}
        unitName={settings.namaUnitLayanan}
      />

      {/* Edit Work Order Modal */}
      {editModalWO && (
        <EditWorkOrderModal
          workOrder={editModalWO}
          onClose={() => setEditModalWO(null)}
        />
      )}
    </div>
  );
};
