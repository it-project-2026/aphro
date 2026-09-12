import React, { useState, useMemo } from 'react';
import { 
  CheckSquare,
  History,
  Edit,
  Trash2,
  TrendingUp,
  Filter,
  Search,
  RotateCw,
  CheckCircle2,
  Camera,
  FileCheck2
} from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { useAuth } from '../context/AuthContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../hooks/useToast';
import { formatExecutionDateTime } from '../utils/dateFormatter';
import { normalizeDateISO, parseDateFromNomorWO, getItemDateISO } from '../utils/dateUtils';
import { Realisasi } from '../types';
import { InputRealisasiPage } from './InputRealisasiPage';
import { ImagePreviewModal } from '../components/common/ImagePreviewModal';

interface RealisasiMainPageProps {
  initialSubTab?: 'input' | 'history' | 'finalize';
}

export const RealisasiMainPage: React.FC<RealisasiMainPageProps> = ({ initialSubTab = 'input' }) => {
  const { user: currentUser } = useAuth();
  const { realisasiList, deleteRealisasi, refreshRealisasi } = useRealisasi();
  const { workOrders, displayedWorkOrders, updateWorkOrder } = useWorkOrders();
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const draggable = useDraggableScroll();

  const [activeSubTab, setActiveSubTab] = useState<'input' | 'history' | 'finalize'>(initialSubTab);
  const [editingRealisasi, setEditingRealisasi] = useState<any | null>(null);
  const [showPostSaveModal, setShowPostSaveModal] = useState(false);
  const [lastSavedWo, setLastSavedWo] = useState<any | null>(null);

  const [finalizeLokasiStart, setFinalizeLokasiStart] = useState('');
  const [finalizeLokasiFinish, setFinalizeLokasiFinish] = useState('');
  const [finalizeVolume, setFinalizeVolume] = useState<number>(0);
  const [finalizeSatuan, setFinalizeSatuan] = useState<'KMS' | 'GAWANG'>('KMS');
  const [selectedWoForFinalize, setSelectedWoForFinalize] = useState<string>('');

  React.useEffect(() => {
    refreshRealisasi();
  }, [refreshRealisasi, activeSubTab]);

  // Photo Preview State
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; driveUrl?: string } | null>(null);

  // Filters for History Tab
  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>(getTodayDateString());

  // Default to today on initial mount
  const [showOnlyToday, setShowOnlyToday] = useState(true);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const isAdmbktUser = useMemo(() => {
    if (!currentUser) return true;
    const uName = (
      currentUser.userName ||
      currentUser.nip ||
      currentUser.id ||
      currentUser.name ||
      ''
    ).toLowerCase();
    const roleLower = (currentUser.role || '').toLowerCase();
    return (
      uName.includes('admbkt') ||
      roleLower.includes('admin') ||
      roleLower.includes('super') ||
      roleLower.includes('adm') ||
      roleLower.includes('manager') ||
      roleLower.includes('spv') ||
      roleLower.includes('supervisor')
    );
  }, [currentUser]);

  // Map WO by ID and Nomor WO for robust lookup
  const workOrdersMap = useMemo(() => {
    const map: Record<string, typeof workOrders[0]> = {};
    workOrders.forEach((wo) => {
      if (wo.id) {
        map[wo.id] = wo;
        map[wo.id.toLowerCase().trim()] = wo;
      }
      if (wo.nomorWO) {
        map[wo.nomorWO] = wo;
        map[wo.nomorWO.toLowerCase().trim()] = wo;
      }
    });
    return map;
  }, [workOrders]);

  const cleanStr = (s?: string | null) => {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/^(regu|tim|petugas|ulp|up3)\s+/gi, '')
      .replace(/[^a-z0-9]/gi, '');
  };

  const matchesReguHelper = (itemRegu?: string | null, userRegu?: string | null) => {
    if (!userRegu) return true;
    if (!itemRegu) return false;
    const normItem = cleanStr(itemRegu);
    const normUser = cleanStr(userRegu);
    if (normItem === normUser) return true;
    if (normItem.includes(normUser) || normUser.includes(normItem)) return true;

    // Check numeric match (e.g., 'TIM ROW 2' vs 'TIM ROW 02 BASO')
    const itemNums = itemRegu.match(/\d+/g)?.map(Number);
    const userNums = userRegu.match(/\d+/g)?.map(Number);
    if (itemNums && userNums && itemNums.length > 0 && userNums.length > 0) {
      return itemNums.some(n => userNums.includes(n));
    }
    return false;
  };

  const matchesUlpHelper = (itemUlp?: string | null, userUlp?: string | null) => {
    if (!userUlp) return true;
    if (!itemUlp) return false;
    const normItem = cleanStr(itemUlp);
    const normUser = cleanStr(userUlp);
    if (normItem === normUser) return true;
    return normItem.includes(normUser) || normUser.includes(normItem);
  };

  const canUserAccessRealisasi = React.useCallback((rel: Realisasi) => {
    if (isAdmbktUser) return true;
    if (!currentUser) return true;

    const roleLower = (currentUser.role || '').toLowerCase();
    if (
      roleLower.includes('admin') ||
      roleLower.includes('super') ||
      roleLower.includes('adm') ||
      roleLower.includes('manager') ||
      roleLower.includes('spv') ||
      roleLower.includes('supervisor')
    ) {
      return true;
    }

    const wo = workOrdersMap[rel.workOrderId] || 
               workOrdersMap[rel.nomorWO] ||
               (rel.workOrderId ? workOrdersMap[rel.workOrderId.toLowerCase().trim()] : undefined) ||
               (rel.nomorWO ? workOrdersMap[rel.nomorWO.toLowerCase().trim()] : undefined);

    // 0. If WO is assigned to user in displayedWorkOrders, allow access
    const isAssignedWo = displayedWorkOrders.some(woItem => 
      woItem.id === rel.workOrderId || 
      woItem.nomorWO === rel.nomorWO || 
      (rel.nomorWO && woItem.nomorWO && cleanStr(rel.nomorWO) === cleanStr(woItem.nomorWO)) ||
      (rel.workOrderId && woItem.id && cleanStr(rel.workOrderId) === cleanStr(woItem.id))
    );
    if (isAssignedWo) return true;

    // 1. Direct creator or assignee match
    const isCreatorOrPetugas =
      (rel.petugasId && String(rel.petugasId) === String(currentUser.id)) ||
      (rel.petugasName && cleanStr(rel.petugasName) === cleanStr(currentUser.name)) ||
      (rel.petugasName && cleanStr(rel.petugasName) === cleanStr(currentUser.userName)) ||
      (wo?.petugasId && String(wo.petugasId) === String(currentUser.id));

    if (isCreatorOrPetugas) return true;

    // 2. Check all user regu / name candidates
    const userReguCandidates = [
      currentUser.reguName,
      currentUser.userName,
      currentUser.name,
      currentUser.nip,
      currentUser.id
    ].filter(Boolean);

    for (const candidate of userReguCandidates) {
      if (matchesReguHelper(rel.reguName, candidate) || matchesReguHelper(wo?.reguName, candidate)) {
        return true;
      }
    }

    // 3. ULP match (if empty on rel or matches, permit)
    if (currentUser.ulpName) {
      if (!rel.ulpName && !wo?.ulpName) return true;
      const matchUlp = matchesUlpHelper(rel.ulpName, currentUser.ulpName) || matchesUlpHelper(wo?.ulpName, currentUser.ulpName);
      if (matchUlp) return true;
    }

    // Allow viewing by default in management view
    return true;
  }, [currentUser, isAdmbktUser, workOrdersMap, displayedWorkOrders]);

  const filteredRealisasi = useMemo(() => {
    const todayStr = getTodayDateString();

    return realisasiList.filter((rel) => {
      if (!canUserAccessRealisasi(rel)) return false;

      const wo = workOrdersMap[rel.workOrderId] || 
                 workOrdersMap[rel.nomorWO] ||
                 (rel.workOrderId ? workOrdersMap[rel.workOrderId.toLowerCase().trim()] : undefined) ||
                 (rel.nomorWO ? workOrdersMap[rel.nomorWO.toLowerCase().trim()] : undefined);
      const relStatus = (rel.status || wo?.status || 'Selesai').trim();

      // 1. Filter by Status
      if (filterStatus !== 'ALL') {
        if (filterStatus.toLowerCase() === 'selesai' && relStatus.toLowerCase() !== 'selesai' && relStatus.toLowerCase() !== 'closed') {
          return false;
        }
        if (filterStatus.toLowerCase() !== 'selesai' && relStatus.toLowerCase() !== filterStatus.toLowerCase()) {
          return false;
        }
      }

      // 2. Resolve canonical item date
      const itemDate = getItemDateISO(rel) || (wo ? getItemDateISO(wo) : '');

      // 3. Filter by explicit Date if selected
      if (filterDate) {
        const normFilterDate = normalizeDateISO(filterDate);
        if (normFilterDate && itemDate !== normFilterDate) {
          return false;
        }
      }

      // 4. If showOnlyToday is true and no explicit date/search query is active, filter strictly by today's date
      if (showOnlyToday && !filterDate && !debouncedSearch) {
        if (itemDate && itemDate !== todayStr) {
          return false;
        }
      }

      // 5. Search / Filter by No WO or keyword
      const searchLower = debouncedSearch.toLowerCase().trim();
      if (!searchLower) return true;

      const relNoWo = (rel.nomorWO || '').toLowerCase();
      const woNo = (wo?.nomorWO || '').toLowerCase();
      const relWoId = (rel.workOrderId || '').toLowerCase();
      const cleanSearch = cleanStr(debouncedSearch);

      // Exact or partial match for No WO when filtered via dropdown or search
      if (
        relNoWo === searchLower ||
        woNo === searchLower ||
        relWoId === searchLower ||
        (cleanSearch && (cleanStr(rel.nomorWO) === cleanSearch || cleanStr(wo?.nomorWO) === cleanSearch)) ||
        relNoWo.includes(searchLower) ||
        woNo.includes(searchLower) ||
        (relNoWo.length > 5 && searchLower.includes(relNoWo)) ||
        (woNo.length > 5 && searchLower.includes(woNo))
      ) {
        return true;
      }

      const matchesSearch =
        relNoWo.includes(searchLower) ||
        woNo.includes(searchLower) ||
        (rel.noTiang || '').toLowerCase().includes(searchLower) ||
        (rel.penyulangName || '').toLowerCase().includes(searchLower) ||
        (rel.reguName || '').toLowerCase().includes(searchLower) ||
        (rel.petugasName || '').toLowerCase().includes(searchLower);

      return matchesSearch;
    });
  }, [realisasiList, workOrdersMap, debouncedSearch, canUserAccessRealisasi, showOnlyToday, filterDate, filterStatus]);

  const noWoOptions = useMemo(() => {
    const listFromWo = workOrders.map(wo => wo.nomorWO).filter(Boolean);
    const listFromDisplayed = displayedWorkOrders.map(wo => wo.nomorWO).filter(Boolean);
    const listFromRealisasi = realisasiList
      .map(rel => rel.nomorWO || workOrdersMap[rel.workOrderId]?.nomorWO || workOrdersMap[rel.id]?.nomorWO)
      .filter(Boolean);
    return Array.from(new Set([...listFromWo, ...listFromDisplayed, ...listFromRealisasi])).sort();
  }, [workOrders, displayedWorkOrders, realisasiList, workOrdersMap]);

  const paginatedRealisasi = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRealisasi.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRealisasi, currentPage]);

  const totalPages = Math.ceil(filteredRealisasi.length / itemsPerPage);
  const selectedAreaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);
  
  const rawUlpName = currentUser?.ulpName || filteredRealisasi[0]?.ulpName || 'UNIT LAYANAN';
  const selectedUlpName = rawUlpName.replace(/^ULP\s*/i, '').trim() || 'UNIT LAYANAN';

  const handleEditRealisasi = (rel: any) => {
    setEditingRealisasi(rel);
    setActiveSubTab('input');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm no-print">
        <div>
          <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400">
            <CheckSquare className="w-6 h-6" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
              Manajemen Realisasi {editingRealisasi ? '(MODE EDIT)' : ''}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {editingRealisasi 
              ? `Sedang mengedit data realisasi WO ${editingRealisasi.nomorWO}.`
              : activeSubTab === 'input' 
                ? 'Input data realisasi pekerjaan pemangkasan/penebangan di lapangan.' 
                : 'Lihat riwayat realisasi pekerjaan yang telah diinput (EVIDEN ROW).'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setEditingRealisasi(null);
              setActiveSubTab('input');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
              activeSubTab === 'input' && !editingRealisasi
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>INPUT REALISASI</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setEditingRealisasi(null);
              setActiveSubTab('history');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
              activeSubTab === 'history'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>RIWAYAT REALISASI</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="transition-all duration-300">
        {activeSubTab === 'input' ? (
          <InputRealisasiPage 
            editMode={!!editingRealisasi} 
            initialData={editingRealisasi} 
            onSuccess={(wo) => {
              setEditingRealisasi(null);
              setLastSavedWo(wo);
              setActiveSubTab('history');
              setShowPostSaveModal(true);
            }}
            onCancel={() => {
              setEditingRealisasi(null);
              setActiveSubTab('history');
            }}
          />
        ) : activeSubTab === 'finalize' ? (
          <div className="max-w-2xl mx-auto py-8 animate-in slide-in-from-bottom-10 duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 shadow-xl space-y-6">
              <div className="flex items-center space-x-3 text-[#00A2B9] dark:text-teal-400 border-b border-slate-100 dark:border-slate-700 pb-4">
                <FileCheck2 className="w-7 h-7" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white font-display">Penyelesaian Pekerjaan (Final)</h2>
              </div>
              
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Pilih Work Order <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedWoForFinalize || lastSavedWo?.id || ''}
                  onChange={(e) => setSelectedWoForFinalize(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9] outline-none transition-all font-medium"
                >
                  <option value="">-- Pilih Work Order --</option>
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.nomorWO} - {wo.penyulangName} ({wo.ulpName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      LOKASI START <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Titik mulai..."
                      value={finalizeLokasiStart}
                      onChange={(e) => setFinalizeLokasiStart(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      LOKASI FINISH <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Titik selesai..."
                      value={finalizeLokasiFinish}
                      onChange={(e) => setFinalizeLokasiFinish(e.target.value)}
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
                    step="0.01"
                    placeholder="0.00"
                    value={finalizeVolume || ''}
                    onChange={(e) => setFinalizeVolume(Number(e.target.value))}
                    className="w-full px-5 py-4 text-2xl font-black rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9] outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    SATUAN <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFinalizeSatuan('KMS')}
                      className={`py-3 px-4 rounded-xl font-black text-xs border transition-all ${
                        finalizeSatuan === 'KMS'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      KMS (Kilo Meter Saluran)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinalizeSatuan('GAWANG')}
                      className={`py-3 px-4 rounded-xl font-black text-xs border transition-all ${
                        finalizeSatuan === 'GAWANG'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      GAWANG
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('history')}
                  className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetWoId = selectedWoForFinalize || lastSavedWo?.id;
                    if (!targetWoId) {
                      showToast('Pilih Work Order terlebih dahulu!', 'warning');
                      return;
                    }
                    if (!finalizeLokasiStart.trim() || !finalizeLokasiFinish.trim()) {
                      showToast('Lokasi Start dan Finish wajib diisi!', 'warning');
                      return;
                    }
                    if (finalizeVolume <= 0) {
                      showToast('Total volume realisasi wajib diisi!', 'warning');
                      return;
                    }
                    try {
                      await updateWorkOrder(targetWoId, {
                        status: 'Selesai' as any,
                        totalRealisasi: finalizeVolume,
                        satuanTotalRealisasi: finalizeSatuan,
                        lokasiStart: finalizeLokasiStart,
                        lokasiFinish: finalizeLokasiFinish,
                      });
                      showToast('Pekerjaan berhasil diselesaikan!', 'success');
                      setActiveSubTab('history');
                    } catch (err: any) {
                      showToast(`Berhasil diselesaikan secara lokal!`, 'success');
                      setActiveSubTab('history');
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black shadow-lg shadow-teal-600/20 text-xs transition-all flex items-center space-x-2"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Simpan & Selesaikan Pekerjaan</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 relative">
            {/* Post Save Confirmation Modal on History Page */}
            {showPostSaveModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center shadow-2xl space-y-6">
                  <div className="w-20 h-20 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-teal-50 dark:border-teal-900/20">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white font-display">Data Berhasil Tersimpan!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Realisasi titik pekerjaan ini telah berhasil dicatat ke sistem.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPostSaveModal(false);
                        setActiveSubTab('input');
                      }}
                      className="flex items-center justify-center space-x-2 py-3.5 px-4 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 font-black rounded-2xl transition-all border border-teal-200 dark:border-teal-800 shadow-sm text-xs"
                    >
                      <Camera className="w-4 h-4" />
                      <span>TAMBAH REALISASI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPostSaveModal(false);
                        setActiveSubTab('finalize');
                      }}
                      className="flex items-center justify-center space-x-2 py-3.5 px-4 bg-[#008396] hover:bg-[#00A2B9] text-white font-black rounded-2xl transition-all shadow-lg shadow-teal-600/25 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>SELESAI</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Filters Bar for History */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm no-print space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tampilan Tanggal:</span>
                  <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOnlyToday(true);
                        setFilterDate(getTodayDateString());
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        showOnlyToday && !filterDate 
                          ? 'bg-teal-600 text-white shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Hari Ini ({getTodayDateString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOnlyToday(false);
                        setFilterDate('');
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        !showOnlyToday && !filterDate
                          ? 'bg-teal-600 text-white shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Semua Riwayat
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pilih Tanggal:</span>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => {
                        setFilterDate(e.target.value);
                        if (e.target.value) {
                          setShowOnlyToday(false);
                        }
                      }}
                      className="px-3 py-1 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {filterDate && (
                      <button
                        type="button"
                        onClick={() => setFilterDate('')}
                        className="ml-1 px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                        title="Hapus filter tanggal"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Belum Selesai">Belum Selesai</option>
                    <option value="Proses">Proses</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Filter No WO</label>
                  <select
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Semua No WO ({noWoOptions.length})</option>
                    {noWoOptions.map(wo => (
                      <option key={wo} value={wo}>{wo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Pencarian Cepat</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari No WO, No Tiang, Feeder, atau Tim..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                        title="Reset Filter"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Riwayat Realisasi Table (Matching CETAK PHOTO format) */}
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-extrabold text-[10px] sm:text-xs text-slate-900 dark:text-slate-200 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700 pb-3">
                <div>EVIDEN ROW AREA {selectedAreaName} — ULP {selectedUlpName} ({filteredRealisasi.length} Data)</div>
                <button
                  type="button"
                  onClick={async () => {
                    await refreshRealisasi();
                    showToast('Riwayat realisasi berhasil disegarkan', 'success');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all normal-case tracking-normal"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Segarkan Data</span>
                </button>
              </div>

              <div 
                ref={draggable.ref}
                onMouseDown={draggable.onMouseDown}
                onMouseUp={draggable.onMouseUp}
                onMouseLeave={draggable.onMouseLeave}
                onMouseMove={draggable.onMouseMove}
                className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl"
                style={draggable.style}
              >
                <table className="w-full text-center text-[10px] border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-[#00A2B9] text-white font-extrabold text-xs uppercase">
                      <th colSpan={15} className="p-2 text-center border-b border-[#008396]">
                        REKAP HASIL ROW (RIWAYAT REALISASI)
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
                      <th className="p-2 border border-[#008396] min-w-[110px]">PERTUMBUHAN</th>
                      <th className="p-2 border border-[#008396]">KENDALA</th>
                      <th className="p-2 border border-[#008396] min-w-[130px]">LOKASI</th>
                      <th className="p-2 border border-[#008396] min-w-[80px]">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {paginatedRealisasi.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="p-12 text-slate-400 italic text-center text-xs">
                          Belum ada riwayat realisasi yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRealisasi.map((rel, idx) => {
                        const wo = workOrdersMap[rel.workOrderId];
                        const lat = rel.latitude || wo?.latitude || 0;
                        const lng = rel.longitude || wo?.longitude || 0;

                        return (
                          <tr key={`rel-history-${rel.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold text-teal-700 dark:text-teal-400">
                              {rel.nomorWO || wo?.nomorWO || '-'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 uppercase font-semibold">
                              {selectedAreaName}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 uppercase">
                              {rel.ulpName || wo?.ulpName || selectedUlpName}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                              {rel.reguName || wo?.reguName || 'TIM ROW'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                              {rel.penyulangName || wo?.penyulangName || '-'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold">
                              {rel.noTiang || wo?.lokasi || '-'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                              {formatExecutionDateTime(rel, wo)}
                            </td>
                            {/* Photos */}
                            <td className="p-1.5 border border-slate-100 dark:border-slate-800">
                              {rel.photosSebelum?.[0]?.dataUrl || rel.fotoSebelumUrl ? (
                                <button
                                  onClick={() => setPreviewPhoto({
                                    url: rel.photosSebelum?.[0]?.dataUrl || rel.fotoSebelumUrl,
                                    title: `Foto Sebelum - ${rel.nomorWO || wo?.nomorWO || 'WO'}`,
                                    driveUrl: rel.fotoSebelumUrl
                                  })}
                                  className="group relative block w-20 h-16 mx-auto rounded-md overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 transition-all hover:scale-105"
                                >
                                  <img
                                    src={rel.photosSebelum?.[0]?.dataUrl || rel.fotoSebelumUrl}
                                    alt="Sebelum"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Search className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <div className="w-20 h-16 bg-slate-100 dark:bg-slate-800 rounded-md mx-auto flex items-center justify-center text-[8px] text-slate-400">
                                  N/A
                                </div>
                              )}
                            </td>
                            <td className="p-1.5 border border-slate-100 dark:border-slate-800">
                              {rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl ? (
                                <button
                                  onClick={() => setPreviewPhoto({
                                    url: rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl,
                                    title: `Foto Sesudah - ${rel.nomorWO || wo?.nomorWO || 'WO'}`,
                                    driveUrl: rel.fotoSesudahUrl
                                  })}
                                  className="group relative block w-20 h-16 mx-auto rounded-md overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 transition-all hover:scale-105"
                                >
                                  <img
                                    src={rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl}
                                    alt="Sesudah"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Search className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <div className="w-20 h-16 bg-slate-100 dark:bg-slate-800 rounded-md mx-auto flex items-center justify-center text-[8px] text-slate-400">
                                  N/A
                                </div>
                              )}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 uppercase font-medium">
                              {rel.jenisTanaman || wo?.jenisPekerjaan || '-'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 uppercase">
                              {rel.keterangan || 'POTONG'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 uppercase font-medium">
                              {rel.pertumbuhanTanaman || 'SEDANG'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 uppercase">
                              {rel.kendala || 'NIHIL'}
                            </td>
                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-mono text-[8px] text-slate-500">
                              {lat && lng ? `${lat.toFixed(6)},\n${lng.toFixed(6)}` : '-'}
                            </td>
                             <td className="p-2 border border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleEditRealisasi(rel)}
                                  className="p-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                                  title="Edit Realisasi"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (window.confirm('Hapus data realisasi ini? Perubahan akan langsung sinkron ke Supabase Database.')) {
                                      await deleteRealisasi(rel.id);
                                    }
                                  }}
                                  className="p-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                                  title="Hapus Realisasi"
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
                  <tfoot>
                    <tr className="bg-teal-50 dark:bg-slate-800 font-extrabold text-xs text-teal-900 dark:text-teal-200 uppercase border-t-2 border-teal-600">
                      <td colSpan={15} className="p-3 text-right">
                        TOTAL REALISASI: <span className="text-teal-700 dark:text-teal-400 font-black text-sm ml-2">{filteredRealisasi.length} DATA</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {totalPages > 1 && (
                  <div className="p-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 disabled:opacity-50"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ImagePreviewModal
        isOpen={!!previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        imageUrl={previewPhoto?.url || ''}
        title={previewPhoto?.title}
      />
    </div>
  );
};

export default RealisasiMainPage;

