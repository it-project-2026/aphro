import React, { useState } from 'react';
import { useRealisasi } from '../context/RealisasiContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useMasterData } from '../context/MasterDataContext';
import { useSettings } from '../context/SettingsContext';
import { generateRealisasiFotoPDF, generateLaporanPetaPDF, exportWorkOrdersToExcel } from '../utils/exportUtils';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Printer,
  FileText,
  Map,
  Download,
  Filter,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';

export const CetakLaporanPage: React.FC = () => {
  const { realisasiList } = useRealisasi();
  const { workOrders } = useWorkOrders();
  const { ulpList, penyulangList } = useMasterData();
  const { settings } = useSettings();

  const [activeReportTab, setActiveReportTab] = useState<'foto' | 'peta'>('foto');
  const [filterUlp, setFilterUlp] = useState('ALL');
  const [filterPenyulang, setFilterPenyulang] = useState('ALL');

  // Map WO by ID for easy lookup
  const workOrdersMap = workOrders.reduce((acc, wo) => {
    acc[wo.id] = wo;
    return acc;
  }, {} as Record<string, typeof workOrders[0]>);

  const filteredRealisasi = realisasiList.filter((rel) => {
    const wo = workOrdersMap[rel.workOrderId];
    if (!wo) return true;
    const matchesUlp = filterUlp === 'ALL' || wo.ulpId === filterUlp;
    const matchesPenyulang = filterPenyulang === 'ALL' || wo.penyulangId === filterPenyulang;
    return matchesUlp && matchesPenyulang;
  });

  const filteredWOs = workOrders.filter((wo) => {
    const matchesUlp = filterUlp === 'ALL' || wo.ulpId === filterUlp;
    const matchesPenyulang = filterPenyulang === 'ALL' || wo.penyulangId === filterPenyulang;
    return matchesUlp && matchesPenyulang;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Export Controls */}
      <div className="no-print bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
              Cetak & Export Laporan Operations
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Cetak Laporan Realisasi Foto Terstempel Watermark atau Laporan Peta Pekerjaan dalam format PDF, Excel, & Print.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (activeReportTab === 'foto') {
                  generateRealisasiFotoPDF(filteredRealisasi, workOrdersMap, settings);
                } else {
                  generateLaporanPetaPDF(filteredWOs, settings);
                }
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={() => exportWorkOrdersToExcel(filteredWOs, settings.namaUnitLayanan)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
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
              <FileText className="w-4 h-4" />
              <span>1. Laporan Realisasi Foto</span>
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
              <span>2. Laporan Peta Pekerjaan</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={filterUlp}
              onChange={(e) => setFilterUlp(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
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
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
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
      <div className="bg-white text-slate-900 p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-md space-y-8 print:p-0 print:border-none print:shadow-none">
        {/* Printable Letterhead Header */}
        <div className="border-b-2 border-sky-800 pb-4 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-sky-900 font-display">
              {settings.namaUnitLayanan.toUpperCase()}
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              {activeReportTab === 'foto'
                ? 'DOKUMENTASI LAPORAN REALISASI FOTO PEKERJAAN ASSET PROTECTION (ROW)'
                : 'LAPORAN REKAPITULASI PETA & TITIK LOKASI HAZARD ASSET'}
            </p>
            <p className="text-[11px] text-slate-500">
              Dicetak Pada: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold px-3 py-1 bg-sky-100 text-sky-800 rounded-full inline-block">
              APHRO VERIFIED
            </span>
            <p className="text-[10px] text-slate-400 mt-1">{settings.versiAplikasi}</p>
          </div>
        </div>

        {/* Report Content 1: Laporan Realisasi Foto */}
        {activeReportTab === 'foto' && (
          <div className="space-y-8">
            {filteredRealisasi.length === 0 ? (
              <p className="text-center text-slate-400 py-8">
                Tidak ada data realisasi foto yang memenuhi kriteria filter.
              </p>
            ) : (
              filteredRealisasi.map((rel, index) => {
                const wo = workOrdersMap[rel.workOrderId];

                return (
                  <div
                    key={`${rel.id}-${index}`}
                    className="border border-slate-200 rounded-2xl p-5 space-y-4 print-page-break"
                  >
                    {/* WO Spec Banner */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-sky-700">
                          #{index + 1} | NOMOR WO: {rel.nomorWO}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Penyulang: {wo?.penyulangName || '-'} ({wo?.ulpName || '-'})
                        </h4>
                        <p className="text-xs text-slate-600">📍 Lokasi: {wo?.lokasi || '-'}</p>
                      </div>

                      <div className="text-right text-xs">
                        <p className="font-semibold text-slate-800">Petugas: {rel.petugasName}</p>
                        <p className="text-slate-500">Tanggal: {rel.tanggalRealisasi}</p>
                        <p className="font-bold text-emerald-700">Progress: {rel.progressPercent}% [{rel.status}]</p>
                      </div>
                    </div>

                    {/* Side by Side Photos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Before Photo */}
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">
                          Kondisi Sebelum (BEFORE)
                        </span>
                        {rel.photosSebelum[0] ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                            <img
                              src={rel.photosSebelum[0].dataUrl}
                              alt="Sebelum"
                              className="w-full h-56 object-cover"
                            />
                            <div className="p-2 bg-slate-900/80 text-white text-[10px] space-y-0.5">
                              <p>📅 {rel.photosSebelum[0].timestamp}</p>
                              <p>📍 GPS: {rel.photosSebelum[0].latitude}, {rel.photosSebelum[0].longitude}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-56 bg-slate-100 rounded-xl border border-dashed flex items-center justify-center text-xs text-slate-400">
                            Tidak Ada Foto Sebelum
                          </div>
                        )}
                      </div>

                      {/* After Photo */}
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                          Kondisi Sesudah (AFTER)
                        </span>
                        {rel.photosSesudah[0] ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                            <img
                              src={rel.photosSesudah[0].dataUrl}
                              alt="Sesudah"
                              className="w-full h-56 object-cover"
                            />
                            <div className="p-2 bg-slate-900/80 text-white text-[10px] space-y-0.5">
                              <p>📅 {rel.photosSesudah[0].timestamp}</p>
                              <p>📍 GPS: {rel.photosSesudah[0].latitude}, {rel.photosSesudah[0].longitude}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-56 bg-slate-100 rounded-xl border border-dashed flex items-center justify-center text-xs text-slate-400">
                            Tidak Ada Foto Sesudah
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200">
                      <span className="font-bold">Keterangan Realisasi:</span>{' '}
                      {rel.keterangan || 'Tidak ada catatan khusus.'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Report Content 2: Laporan Peta Pekerjaan */}
        {activeReportTab === 'peta' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border border-slate-200">
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
        )}

        {/* Footer Signatures for Official Documents */}
        <div className="pt-8 grid grid-cols-2 text-center text-xs text-slate-700">
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
