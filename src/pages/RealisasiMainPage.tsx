import React, { useState, useMemo } from 'react';
import { 
  CheckSquare,
  History,
  Edit,
  TrendingUp,
  Filter,
  Search
} from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { useAuth } from '../context/AuthContext';
import { useRealisasi } from '../context/RealisasiContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { formatExecutionDateTime } from '../utils/dateFormatter';
import { InputRealisasiPage } from './InputRealisasiPage';

interface RealisasiMainPageProps {
  initialSubTab?: 'input' | 'history';
}

export const RealisasiMainPage: React.FC<RealisasiMainPageProps> = ({ initialSubTab = 'input' }) => {
  const { user: currentUser } = useAuth();
  const { realisasiList } = useRealisasi();
  const { workOrders } = useWorkOrders();
  const { ulpList, penyulangList } = useMasterData();
  const { settings } = useSettings();

  const draggable = useDraggableScroll();

  const [activeSubTab, setActiveSubTab] = useState<'input' | 'history'>(initialSubTab);
  
  // Edit State
  const [editingRealisasi, setEditingRealisasi] = useState<any | null>(null);

  // Filters for History Tab
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

      // Role-based filtering
      if (!isAdmbktUser && currentUser?.role === 'User' && currentUser?.ulpName) {
        const uUlp = currentUser.ulpName.toLowerCase().trim();
        const relUlp = (rel.ulpName || wo?.ulpName || '').toLowerCase().trim();
        if (relUlp && uUlp && relUlp !== uUlp && !relUlp.includes(uUlp) && !uUlp.includes(relUlp)) {
          return false;
        }
      }

      const matchesUlp = filterUlp === 'ALL' || rel.ulpName === filterUlp || wo?.ulpName === filterUlp;
      const matchesPenyulang = filterPenyulang === 'ALL' || rel.penyulangName === filterPenyulang || wo?.penyulangName === filterPenyulang;
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (rel.nomorWO || '').toLowerCase().includes(searchLower) ||
        (rel.penyulangName || '').toLowerCase().includes(searchLower) ||
        (rel.noTiang || '').toLowerCase().includes(searchLower) ||
        (rel.lokasiKerja || '').toLowerCase().includes(searchLower);

      return matchesUlp && matchesPenyulang && matchesSearch;
    });
  }, [realisasiList, workOrdersMap, currentUser, filterUlp, filterPenyulang, searchQuery, isAdmbktUser]);

  const selectedAreaName = settings.namaUnitLayanan.replace(/^UP3\s*/i, '').toUpperCase() || 'BUKITTINGGI';
  const selectedUlpName = filterUlp !== 'ALL' ? filterUlp : (filteredRealisasi[0]?.ulpName || 'UNIT LAYANAN');

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
            onSuccess={() => {
              setEditingRealisasi(null);
              setActiveSubTab('history');
            }}
            onCancel={() => {
              setEditingRealisasi(null);
              setActiveSubTab('history');
            }}
          />
        ) : (
          <div className="space-y-6">
            {/* Filters Bar for History */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm no-print">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Cari Data</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="No WO, Tiang, Lokasi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Filter ULP</label>
                  <select
                    value={filterUlp}
                    onChange={(e) => {
                      setFilterUlp(e.target.value);
                      setFilterPenyulang('ALL');
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="ALL">Semua ULP</option>
                    {ulpList.map((u, idx) => (
                      <option key={`${u.id}-${idx}`} value={u.namaULP}>
                        {u.namaULP}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Filter Penyulang</label>
                  <select
                    value={filterPenyulang}
                    onChange={(e) => setFilterPenyulang(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="ALL">Semua Penyulang</option>
                    {penyulangList
                      .filter(p => filterUlp === 'ALL' || p.ulpName === filterUlp)
                      .map((p, idx) => (
                      <option key={`${p.id}-${idx}`} value={p.namaPenyulang}>
                        {p.namaPenyulang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Riwayat Realisasi Table (Matching CETAK PHOTO format) */}
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-6">
              <div className="flex items-center justify-between font-extrabold text-[10px] sm:text-xs text-slate-900 dark:text-slate-200 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700 pb-2">
                <div>EVIDEN ROW AREA {selectedAreaName}</div>
                <div>ULP {selectedUlpName}</div>
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
                      <th colSpan={14} className="p-2 text-center border-b border-[#008396]">
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
                    {filteredRealisasi.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="p-12 text-slate-400 italic text-center text-xs">
                          Belum ada riwayat realisasi yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRealisasi.map((rel, idx) => {
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
                                <img
                                  src={rel.photosSebelum?.[0]?.dataUrl || rel.fotoSebelumUrl}
                                  alt="Sebelum"
                                  className="w-20 h-16 object-cover rounded-md mx-auto shadow-sm border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-20 h-16 bg-slate-100 dark:bg-slate-800 rounded-md mx-auto flex items-center justify-center text-[8px] text-slate-400">
                                  N/A
                                </div>
                              )}
                            </td>
                            <td className="p-1.5 border border-slate-100 dark:border-slate-800">
                              {rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl ? (
                                <img
                                  src={rel.photosSesudah?.[0]?.dataUrl || rel.fotoSesudahUrl}
                                  alt="Sesudah"
                                  className="w-20 h-16 object-cover rounded-md mx-auto shadow-sm border border-slate-200 dark:border-slate-700"
                                />
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
                              <button
                                onClick={() => handleEditRealisasi(rel)}
                                className="p-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                                title="Edit Realisasi"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

