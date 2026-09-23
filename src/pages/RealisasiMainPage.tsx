import React, { useState, useMemo, useEffect } from 'react';
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
  FileCheck2,
  MapPin,
  ExternalLink,
  FilePlus2,
  ShieldCheck,
  AlertCircle,
  X,
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
import { resolveUserTimRowAndUlp, RekapHarianService, UL_PRESETS } from '../services/rekapHarianService';
import { InisiasiService } from '../services/inisiasiService';
import { dexieDb } from '../services/dexieDb';
import { InputRealisasiPage } from './InputRealisasiPage';
import { InputManualRealisasiAdminPage } from './InputManualRealisasiAdminPage';
import { ImagePreviewModal } from '../components/common/ImagePreviewModal';
import { EditRealisasiModal } from '../components/common/EditRealisasiModal';
import { resolveRealisasiWoStatus } from '../utils/integrityLogger';

interface RealisasiMainPageProps {
  initialSubTab?: 'input' | 'manual_admin' | 'history' | 'finalize';
}

export const RealisasiMainPage: React.FC<RealisasiMainPageProps> = ({ initialSubTab = 'input' }) => {
  const { user: currentUser } = useAuth();
  const {
    realisasiList,
    pagination,
    isLoading,
    error,
    fetchRealisasiFromApi,
    deleteRealisasi,
    refreshRealisasi,
  } = useRealisasi();
  const { workOrders, displayedWorkOrders, updateWorkOrder } = useWorkOrders();
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const draggable = useDraggableScroll();

  const isAdminUser = useMemo(() => {
    if (!currentUser) return false;
    const roleUpper = (currentUser.role || '').toUpperCase();
    const uName = (currentUser.userName || currentUser.name || '').toLowerCase();
    return (
      roleUpper === 'ADMIN' ||
      roleUpper === 'ADM' ||
      roleUpper === 'SUPERADMIN' ||
      roleUpper === 'SUPER_ADMIN' ||
      roleUpper === 'SUPER ADMIN' ||
      uName.includes('admbkt') ||
      uName.includes('admin') ||
      uName.includes('adm')
    );
  }, [currentUser]);

  const [activeSubTab, setActiveSubTab] = useState<'input' | 'manual_admin' | 'history' | 'finalize'>(initialSubTab);
  const [editingRealisasi, setEditingRealisasi] = useState<any | null>(null);
  const [selectedForEditModal, setSelectedForEditModal] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showPostSaveModal, setShowPostSaveModal] = useState(false);
  const [lastSavedWo, setLastSavedWo] = useState<any | null>(null);

  const [finalizeLokasiStart, setFinalizeLokasiStart] = useState('');
  const [finalizeLokasiFinish, setFinalizeLokasiFinish] = useState('');
  const [finalizeVolume, setFinalizeVolume] = useState<number>(0);
  const [finalizeSatuan, setFinalizeSatuan] = useState<'KMS' | 'GAWANG'>('KMS');
  const [selectedWoForFinalize, setSelectedWoForFinalize] = useState<string>('');

  // Photo Preview State
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; driveUrl?: string } | null>(null);

  // Filters & Pagination for History Tab
  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filterNomorWO, setFilterNomorWO] = useState<string>('');
  const [localWoNumbers, setLocalWoNumbers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [tanggalDari, setTanggalDari] = useState<string>('');
  const [tanggalSampai, setTanggalSampai] = useState<string>('');
  const [ulpFilter, setUlpFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Preload local work order numbers from IndexedDB (Dexie)
  useEffect(() => {
    let isMounted = true;
    const fetchExtraWos = async () => {
      try {
        const [cachedWos, cachedRels] = await Promise.all([
          dexieDb.work_orders.toArray().catch(() => []),
          dexieDb.realisasi.toArray().catch(() => []),
        ]);
        if (!isMounted) return;
        const set = new Set<string>();
        cachedWos.forEach((w: any) => {
          if (w.nomorWO && w.nomorWO.trim()) set.add(w.nomorWO.trim());
        });
        cachedRels.forEach((r: any) => {
          if (r.nomorWO && r.nomorWO.trim()) set.add(r.nomorWO.trim());
        });
        setLocalWoNumbers(Array.from(set));
      } catch {
        // ignore
      }
    };
    fetchExtraWos();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch realisasi from API when subtab, pagination, date range, or filterNomorWO changes
  // STRICT REQUIREMENT: Only fetch if a filterNomorWO has been chosen!
  React.useEffect(() => {
    if (activeSubTab === 'history') {
      if (filterNomorWO && filterNomorWO.trim()) {
        fetchRealisasiFromApi({
          page,
          limit,
          tanggalDari,
          tanggalSampai,
          ULP: ulpFilter,
          Nomor_WO: filterNomorWO.trim(),
        });
      }
    }
  }, [
    activeSubTab,
    filterNomorWO,
    page,
    limit,
    tanggalDari,
    tanggalSampai,
    ulpFilter,
    fetchRealisasiFromApi,
  ]);

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
    if (!currentUser) return true;

    const roleUpper = (currentUser.role || '').toUpperCase();
    const isSuperAdmin = roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPER ADMIN' || roleUpper === 'SUPERADMIN';
    
    // Super Admin can access all units
    if (isSuperAdmin) return true;

    const activeUnitKey = RekapHarianService.normalizeUnitKey(
      settings.namaUnitLayanan || localStorage.getItem('aphro_nama_unit_layanan') || 'UL BUKITTINGGI'
    );
    const activeUnitId = currentUser.unitId 
      ? InisiasiService.getStandardUnitId(currentUser.unitId)
      : InisiasiService.getSelectedUnitId();

    // 1. Strict Unit Isolation check: All Unit Admins & Officers only see their own Unit's data
    if (rel.unitId && activeUnitId) {
      const rUId = InisiasiService.getStandardUnitId(String(rel.unitId));
      const aUId = InisiasiService.getStandardUnitId(String(activeUnitId));
      if (rUId && aUId && rUId !== aUId) {
        return false;
      }
    }

    // 2. Check ULP name preset isolation if unitId is not explicitly set
    if (!rel.unitId && rel.ulpName) {
      const activePreset = UL_PRESETS[activeUnitKey];
      const relUlpClean = cleanStr(rel.ulpName);
      if (activePreset && activePreset.rows) {
        let belongsToOtherPreset = false;
        const isInActivePreset = activePreset.rows.some(r => {
          const pUlp = cleanStr(r.namaUlp);
          return relUlpClean.includes(pUlp) || pUlp.includes(relUlpClean);
        });

        for (const [presetKey, presetData] of Object.entries(UL_PRESETS)) {
          if (presetKey !== activeUnitKey) {
            const inOther = presetData.rows.some(r => {
              const pUlp = cleanStr(r.namaUlp);
              return relUlpClean.includes(pUlp) || pUlp.includes(relUlpClean);
            });
            if (inOther && !isInActivePreset) {
              belongsToOtherPreset = true;
              break;
            }
          }
        }

        if (belongsToOtherPreset) return false;
      }
    }

    // 3. User within active Unit can view all Realisasi records of their Unit in the History Table
    return true;
  }, [currentUser, settings.namaUnitLayanan]);

  // Available WO Numbers list for dropdown filter
  const availableWONumbers = useMemo(() => {
    const woSet = new Set<string>();

    workOrders.forEach((wo) => {
      if (wo.nomorWO && wo.nomorWO.trim()) woSet.add(wo.nomorWO.trim());
    });
    displayedWorkOrders.forEach((wo) => {
      if (wo.nomorWO && wo.nomorWO.trim()) woSet.add(wo.nomorWO.trim());
    });
    localWoNumbers.forEach((no) => {
      if (no && no.trim()) woSet.add(no.trim());
    });
    realisasiList.forEach((rel) => {
      if (rel.nomorWO && rel.nomorWO.trim()) woSet.add(rel.nomorWO.trim());
      const wo = workOrdersMap[rel.workOrderId];
      if (wo?.nomorWO && wo.nomorWO.trim()) woSet.add(wo.nomorWO.trim());
    });

    return Array.from(woSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [workOrders, displayedWorkOrders, localWoNumbers, realisasiList, workOrdersMap]);

  // Tampilan Data hanya sesuai dengan Filter (dengan tampilan Kosong jika belum dipilih lewat Filter)
  const displayList = useMemo(() => {
    if (!filterNomorWO || !filterNomorWO.trim()) {
      return [];
    }

    const cleanFilter = filterNomorWO.trim().toLowerCase();

    return realisasiList.filter((rel) => {
      const wo = workOrdersMap[rel.workOrderId];
      const rWo = (rel.nomorWO || '').trim().toLowerCase();
      const mWo = (wo?.nomorWO || '').trim().toLowerCase();
      const rWoId = (rel.workOrderId || '').trim().toLowerCase();

      // Check if matches the selected Nomor WO
      const matchesWO = 
        rWo === cleanFilter ||
        mWo === cleanFilter ||
        rWoId === cleanFilter ||
        rWo.includes(cleanFilter) ||
        mWo.includes(cleanFilter);

      if (!matchesWO) return false;

      // Status filter
      if (filterStatus !== 'ALL') {
        const relStatus = rel.status || wo?.status || 'Proses';
        if (filterStatus === 'Selesai' && relStatus !== 'Selesai') return false;
        if (filterStatus === 'Belum Selesai' && relStatus === 'Selesai') return false;
      }

      // ULP filter
      if (ulpFilter) {
        const uFilter = ulpFilter.toLowerCase().trim();
        const rUlp = (rel.ulpName || wo?.ulpName || '').toLowerCase();
        if (!rUlp.includes(uFilter)) return false;
      }

      // Date range filter
      if (tanggalDari) {
        const rDate = getItemDateISO(rel) || rel.tanggalRealisasi || '';
        if (rDate && rDate < tanggalDari) return false;
      }
      if (tanggalSampai) {
        const rDate = getItemDateISO(rel) || rel.tanggalRealisasi || '';
        if (rDate && rDate > tanggalSampai) return false;
      }

      // Search query filter (tiang, feeder, tim, keterangan)
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchSearch =
          (rel.nomorWO || '').toLowerCase().includes(q) ||
          (rel.noTiang || '').toLowerCase().includes(q) ||
          (rel.penyulangName || '').toLowerCase().includes(q) ||
          (rel.reguName || '').toLowerCase().includes(q) ||
          (rel.keterangan || '').toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      return canUserAccessRealisasi(rel);
    });
  }, [
    filterNomorWO,
    realisasiList,
    workOrdersMap,
    filterStatus,
    ulpFilter,
    tanggalDari,
    tanggalSampai,
    debouncedSearch,
    canUserAccessRealisasi,
  ]);

  const selectedAreaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';

  // Reset page when search or filters change
  React.useEffect(() => {
    setPage(1);
  }, [filterNomorWO, debouncedSearch, ulpFilter, tanggalDari, tanggalSampai, filterStatus]);
  
  const rawUlpName = currentUser?.ulpName || displayList[0]?.ulpName || 'UNIT LAYANAN';
  const selectedUlpName = rawUlpName.replace(/^ULP\s*/i, '').trim() || 'UNIT LAYANAN';

  const handleEditRealisasi = (rel: any) => {
    setSelectedForEditModal(rel);
    setIsEditModalOpen(true);
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
        <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 gap-1">
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

          {/* Manual Input Sub-tab */}
          <button
            type="button"
            onClick={() => {
              setEditingRealisasi(null);
              setActiveSubTab('manual_admin');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
              activeSubTab === 'manual_admin'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-white bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40'
            }`}
          >
            <FilePlus2 className="w-4 h-4" />
            <span>INPUT MANUAL REALISASI</span>
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
        {activeSubTab === 'manual_admin' ? (
          <InputManualRealisasiAdminPage
            onSuccess={(savedRel) => {
              setActiveSubTab('history');
              showToast(`Data Realisasi manual ${savedRel.nomorWO} berhasil disimpan ke Database.`, 'success');
            }}
            onCancel={() => {
              setActiveSubTab('history');
            }}
          />
        ) : activeSubTab === 'input' ? (
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
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm no-print space-y-4">
              {/* PRIMARY FILTER: Nomor Work Order (WO) */}
              <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-slate-900/80 border border-teal-200/80 dark:border-teal-900/60 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-teal-600 text-white shadow-2xs">
                      <Filter className="w-4 h-4" />
                    </div>
                    <div>
                      <label htmlFor="filter-nomor-wo" className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1">
                        <span>Filter Nomor Work Order (WO)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Wajib dipilih: Data Riwayat Realisasi hanya ditampilkan sesuai Nomor WO yang dipilih (kosong jika belum dipilih).
                      </p>
                    </div>
                  </div>
                  {filterNomorWO && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterNomorWO('');
                        setPage(1);
                      }}
                      className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reset Filter WO</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-8">
                    <select
                      id="filter-nomor-wo"
                      value={filterNomorWO}
                      onChange={(e) => {
                        setFilterNomorWO(e.target.value);
                        setPage(1);
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-bold transition-all cursor-pointer ${
                        !filterNomorWO
                          ? 'border-amber-400 dark:border-amber-500 bg-white dark:bg-slate-950 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/20'
                          : 'border-teal-500 dark:border-teal-500 bg-white dark:bg-slate-950 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20'
                      } focus:outline-none focus:ring-2 focus:ring-teal-500`}
                    >
                      <option value="">-- SILAKAN PILIH NOMOR WORK ORDER (WO) --</option>
                      {availableWONumbers.map((woNum) => {
                        const woInfo = workOrdersMap[woNum] || workOrdersMap[woNum.toLowerCase()];
                        return (
                          <option key={woNum} value={woNum}>
                            📌 WO: {woNum} {woInfo?.penyulangName ? `• Feeder: ${woInfo.penyulangName}` : ''} {woInfo?.ulpName ? `(${woInfo.ulpName})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ketik cari nomor WO..."
                        value={filterNomorWO}
                        onChange={(e) => {
                          setFilterNomorWO(e.target.value);
                          setPage(1);
                        }}
                        className="w-full pl-8 pr-8 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      {filterNomorWO && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterNomorWO('');
                            setPage(1);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                          title="Hapus Filter WO"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Filter Info Status */}
                {filterNomorWO ? (
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] font-bold text-teal-800 dark:text-teal-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>
                      Menampilkan data realisasi untuk Nomor WO: <strong className="underline decoration-teal-500">{filterNomorWO}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Tabel di bawah saat ini kosong karena belum ada Nomor WO yang dipilih.</span>
                  </div>
                )}
              </div>

              {/* Secondary Filters */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preset Tanggal:</span>
                  <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const today = getTodayDateString();
                        setTanggalDari(today);
                        setTanggalSampai(today);
                        setPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        tanggalDari === getTodayDateString() && tanggalSampai === getTodayDateString()
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Hari Ini ({getTodayDateString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTanggalDari('2026-09-01');
                        setTanggalSampai('2026-09-18');
                        setPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        tanggalDari === '2026-09-01' && tanggalSampai === '2026-09-18'
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      1 – 18 Sep 2026
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTanggalDari('');
                        setTanggalSampai('');
                        setPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        !tanggalDari && !tanggalSampai
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Semua Tanggal
                    </button>
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

              {/* Date Range & Secondary Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Tanggal Dari</label>
                  <input
                    type="date"
                    value={tanggalDari}
                    onChange={(e) => {
                      setTanggalDari(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Tanggal Sampai</label>
                  <input
                    type="date"
                    value={tanggalSampai}
                    onChange={(e) => {
                      setTanggalSampai(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Filter ULP</label>
                  <select
                    value={ulpFilter}
                    onChange={(e) => {
                      setUlpFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold"
                  >
                    <option value="">Semua ULP</option>
                    {ulpList.map((u) => (
                      <option key={u.id} value={u.kodeULP || u.namaULP}>
                        {u.namaULP} ({u.kodeULP})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Cari Tiang / Feeder / Tim</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari Tiang, Feeder, Tim..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-3 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                        title="Reset Pencarian"
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
                <div>
                  EVIDEN ROW AREA {selectedAreaName} — ULP {selectedUlpName} {filterNomorWO ? `— WO: ${filterNomorWO}` : ''} ({displayList.length} Data)
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (filterNomorWO && filterNomorWO.trim()) {
                      await fetchRealisasiFromApi({
                        page,
                        limit,
                        tanggalDari,
                        tanggalSampai,
                        ULP: ulpFilter,
                        Nomor_WO: filterNomorWO.trim(),
                      });
                      showToast(`Data riwayat realisasi WO ${filterNomorWO} berhasil disegarkan`, 'success');
                    } else {
                      showToast('Silakan pilih Nomor WO pada filter terlebih dahulu', 'info');
                    }
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
                        REKAP HASIL ROW (RIWAYAT REALISASI) {filterNomorWO ? `— WO: ${filterNomorWO}` : ''}
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
                    {displayList.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="p-12 text-slate-400 text-center text-xs">
                          {!filterNomorWO ? (
                            <div className="flex flex-col items-center justify-center py-8 px-4">
                              <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3 shadow-xs">
                                <Filter className="w-7 h-7" />
                              </div>
                              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">
                                Filter Nomor WO Belum Dipilih
                              </h4>
                              <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md leading-relaxed mb-4 text-center">
                                Tampilan data riwayat realisasi saat ini kosong. Silakan pilih <strong>Nomor Work Order (WO)</strong> pada filter di atas untuk memuat dan menampilkan data.
                              </p>
                              {availableWONumbers.length > 0 && (
                                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xl">
                                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Pilih Cepat WO:</span>
                                  {availableWONumbers.slice(0, 6).map((num) => (
                                    <button
                                      key={num}
                                      type="button"
                                      onClick={() => {
                                        setFilterNomorWO(num);
                                        setPage(1);
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950 hover:text-teal-700 dark:hover:text-teal-300 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                                    >
                                      {num}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                                <Search className="w-6 h-6" />
                              </div>
                              <p className="font-bold text-slate-700 dark:text-slate-300 text-xs mb-1">
                                Tidak ada riwayat realisasi untuk Nomor WO &quot;{filterNomorWO}&quot;
                              </p>
                              <p className="text-slate-400 text-[11px]">
                                Coba periksa status filter atau rentang tanggal, atau pilih Nomor WO lainnya.
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      displayList.map((rel, idx) => {
                        const wo = workOrdersMap[rel.workOrderId];
                        const lat = rel.latitude || wo?.latitude || 0;
                        const lng = rel.longitude || wo?.longitude || 0;

                        const woStatus = resolveRealisasiWoStatus(rel, workOrdersMap);

                        return (
                          <tr key={`rel-history-${rel.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                              {woStatus.statusType === 'LINKED' ? (
                                <span className="font-bold text-teal-700 dark:text-teal-400">
                                  {woStatus.displayNomorWO}
                                </span>
                              ) : woStatus.statusType === 'UNLINKED' ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 tracking-tight whitespace-nowrap">
                                  WO TIDAK TERHUBUNG
                                </span>
                              ) : (
                                <span 
                                  className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 tracking-tight whitespace-nowrap"
                                  title={`WO ID: ${rel.workOrderId}`}
                                >
                                  WORK_ORDER TIDAK DITEMUKAN
                                </span>
                              )}
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
                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-mono text-[9px]">
                              {lat && lng ? (
                                <a
                                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 transition-all hover:scale-105 shadow-2xs group font-mono font-bold"
                                  title="Klik untuk membuka titik lokasi di Google Maps"
                                >
                                  <MapPin className="w-3 h-3 text-rose-500 shrink-0 group-hover:animate-bounce" />
                                  <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 shrink-0 ml-0.5" />
                                </a>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">-</span>
                              )}
                            </td>
                             <td className="p-2 border border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-center gap-1.5">
                                {isAdmbktUser && (
                                  <button
                                    onClick={() => handleEditRealisasi(rel)}
                                    className="p-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                                    title="Edit Realisasi (Admin/Adm)"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (window.confirm('Hapus data realisasi ini? Data akan dihapus dari server dan perangkat.')) {
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
                        TOTAL DATA DITEMUKAN: <span className="text-teal-700 dark:text-teal-400 font-black text-sm ml-2">{displayList.length} DATA</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Loading State Banner */}
                {isLoading && (
                  <div className="p-6 text-center text-teal-600 font-bold text-xs animate-pulse flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Memuat data Realisasi dari API server...</span>
                  </div>
                )}

                {/* Error State Banner */}
                {error && !isLoading && (
                  <div className="p-4 my-2 mx-4 text-center text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                    <span>Gagal mengambil data Realisasi: {error}</span>
                    <button
                      type="button"
                      onClick={() =>
                        fetchRealisasiFromApi({
                          page,
                          limit,
                          tanggalDari,
                          tanggalSampai,
                          ULP: ulpFilter,
                          Nomor_WO: filterNomorWO ? filterNomorWO.trim() : debouncedSearch,
                        })
                      }
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}

                {/* Pagination Navigation */}
                <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Menampilkan <span className="font-extrabold text-teal-700 dark:text-teal-400">{displayList.length}</span> dari <span className="font-extrabold text-teal-700 dark:text-teal-400">{displayList.length}</span> total data
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-500">Jumlah Per Halaman:</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="px-2 py-1 text-xs font-bold border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={isLoading || (pagination.hasPreviousPage !== undefined ? !pagination.hasPreviousPage : page <= 1)}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:opacity-50 transition-all shadow-xs"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-2">
                      Halaman {pagination.page || page} dari {pagination.totalPages || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={isLoading || (pagination.hasNextPage !== undefined ? !pagination.hasNextPage : page >= (pagination.totalPages || 1))}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:opacity-50 transition-all shadow-xs"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
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

      <EditRealisasiModal
        realisasi={selectedForEditModal}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
};

export default RealisasiMainPage;

