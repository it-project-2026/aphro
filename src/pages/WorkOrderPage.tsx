import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { WorkOrder, WOStatus, WOPriority } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { QRCodeModal } from '../components/common/QRCodeModal';
import { EditWorkOrderModal } from '../components/common/EditWorkOrderModal';
import { exportWorkOrdersToExcel } from '../utils/exportUtils';
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
} from 'lucide-react';
import { formatDateDisplay } from '../utils/dateUtils';

export const WorkOrderPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { workOrders, deleteWorkOrder } = useWorkOrders();
  const { ulpList, penyulangList } = useMasterData();
  const { settings } = useSettings();
  const { setActiveTab, setSelectedWoIdForRealisasi } = useUI();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [qrModalWO, setQrModalWO] = useState<WorkOrder | null>(null);
  const [editModalWO, setEditModalWO] = useState<WorkOrder | null>(null);

  const role = currentUser?.role || 'User';

  // Filter logic
  const filteredWOs = workOrders.filter((wo) => {
    // If User role, show assigned WOs or all in user ULP
    if (role === 'User' && wo.petugasId !== currentUser?.id && wo.ulpId !== currentUser?.ulpId) {
      // return false if strict
    }

    const matchesSearch =
      (wo.nomorWO || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.lokasi || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.petugasName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.penyulangName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUlp = filterUlp === 'ALL' || wo.ulpId === filterUlp;
    const matchesPenyulang = filterPenyulang === 'ALL' || wo.penyulangId === filterPenyulang;
    const matchesStatus = filterStatus === 'ALL' || wo.status === filterStatus;
    const matchesDate = !filterDate || wo.tanggal === filterDate;

    return matchesSearch && matchesUlp && matchesPenyulang && matchesStatus && matchesDate;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">
            {role === 'User' ? 'Work Order Saya (Penugasan)' : 'Daftar Seluruh Work Order'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Kelola data instruksi kerja, lokasi tapak tiang, status progress, dan pelimpahan tugas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {role !== 'User' && (
            <button
              onClick={() => exportWorkOrdersToExcel(filteredWOs, settings.namaUnitLayanan)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          )}

          {(role === 'Admin' || role === 'SuperAdmin' || role === 'Adm') && (
            <button
              onClick={() => setActiveTab('input_wo')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>Tambah Work Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Control Bar */}
      {role !== 'User' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Field */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari WO, Lokasi, Petugas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Filter ULP */}
          <div>
            <select
              value={filterUlp}
              onChange={(e) => setFilterUlp(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Semua ULP</option>
              {ulpList.map((u, idx) => (
                <option key={`${u.id}-${idx}`} value={u.id}>
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Semua Penyulang</option>
              {penyulangList.map((p, idx) => (
                <option key={`${p.id}-${idx}`} value={p.id}>
                  {p.namaPenyulang}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="Belum Dikerjakan">Belum Dikerjakan (Merah)</option>
              <option value="Sedang Dikerjakan">Sedang Dikerjakan (Kuning)</option>
              <option value="Selesai">Selesai (Hijau)</option>
            </select>
          </div>

          {/* Filter Date */}
          <div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
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
                className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-emerald-100 dark:border-slate-700/80 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/80 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                    {wo.nomorWO}
                  </span>
                  <StatusBadge status={wo.status} size="sm" />
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase">
                    {wo.penyulangName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center mt-0.5">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                    <span className="truncate">{wo.lokasi} ({wo.ulpName})</span>
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
                      <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                        {wo.volumePekerjaan || wo.woKms || wo.woBatang} {wo.satuan || 'KMS'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Progress Realisasi:</span>
                    <span className="text-sky-600 dark:text-sky-400">{wo.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        wo.status === 'Selesai' ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${wo.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Mobile Action Buttons */}
                <div className="pt-2 flex items-center gap-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <button
                    disabled={role === 'User' && wo.status === 'Selesai'}
                    onClick={() => {
                      if (setSelectedWoIdForRealisasi) {
                        setSelectedWoIdForRealisasi(wo.id);
                      }
                      setActiveTab('input_realisasi');
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 transition-transform ${
                      role === 'User' && wo.status === 'Selesai'
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>{wo.status === 'Selesai' ? 'Sudah Selesai' : 'Input Realisasi'}</span>
                  </button>
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
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 pl-5">No WO & Tanggal</th>
                <th className="p-3.5">ULP / Penyulang</th>
                <th className="p-3.5">Lokasi & Alamat</th>
                <th className="p-3.5">Regu & Petugas</th>
                <th className="p-3.5">Prioritas</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Progress</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredWOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
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
                      <p className="font-bold text-sky-600 dark:text-sky-400">
                        {wo.nomorWO}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium flex items-center mt-0.5">
                        <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                        {formatDateDisplay(wo.tanggal)}
                      </p>
                      {(wo.volumePekerjaan || wo.woKms || wo.woBatang) && (
                        <div className="flex items-center space-x-1.5 mt-1">
                          {wo.satuan ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-600">
                              Vol: {wo.volumePekerjaan} {wo.satuan}
                            </span>
                          ) : wo.woKms ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-600">
                              Vol: {wo.woKms} KMS
                            </span>
                          ) : wo.woBatang ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-600">
                              Vol: {wo.woBatang} GAWANG
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 dark:text-white uppercase">
                        {wo.penyulangName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">{wo.ulpName}</p>
                    </td>

                    <td className="p-3.5 max-w-xs">
                      <p className="font-medium text-slate-900 dark:text-slate-200 truncate">
                        {wo.lokasi}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium truncate">{wo.alamat}</p>
                    </td>

                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {wo.petugasName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">{wo.reguName}</p>
                    </td>

                    <td className="p-3.5">
                      <PriorityBadge priority={wo.prioritas} />
                    </td>

                    <td className="p-3.5">
                      <StatusBadge status={wo.status} size="sm" />
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              wo.status === 'Selesai'
                                ? 'bg-emerald-500'
                                : wo.status === 'Sedang Dikerjakan'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${wo.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {wo.progressPercent}%
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => setSelectedWO(wo)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
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
                          disabled={role === 'User' && wo.status === 'Selesai'}
                          onClick={() => {
                            if (setSelectedWoIdForRealisasi) {
                              setSelectedWoIdForRealisasi(wo.id);
                            }
                            setActiveTab('input_realisasi');
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            role === 'User' && wo.status === 'Selesai'
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                          title={wo.status === 'Selesai' ? 'Pekerjaan ini sudah selesai' : 'Input Realisasi Work Order Ini'}
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>

                        {(role === 'Admin' || role === 'SuperAdmin' || role === 'Adm') && (
                          <>
                            <button
                              onClick={() => setEditModalWO(wo)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                              title="Edit Work Order"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteWorkOrder(wo.id)}
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
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
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
              </div>

              <div>
                <p className="text-slate-400 font-semibold mb-1">Lokasi & Alamat:</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  📍 {selectedWO.lokasi}
                </p>
                <p className="text-slate-500 text-xs">{selectedWO.alamat}</p>
                <p className="text-xs text-sky-600 font-mono mt-1">
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
