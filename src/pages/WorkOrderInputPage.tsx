import React, { useState, useEffect, useMemo } from 'react';
import { useMasterData } from '../context/MasterDataContext';
import { useWorkOrders } from '../context/WorkOrderContext';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useToast } from '../hooks/useToast';
import { useGASSync } from '../hooks/useGASSync';
import { GASApiService } from '../services/gasApiService';
import { Save, ArrowLeft, FilePlus, Database, CheckCircle2, Sparkles, Layers, AlertTriangle } from 'lucide-react';
import { WOStatus } from '../types';
import { getLocalDateTimeString } from '../utils/dateUtils';

const INDO_MONTHS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

export const WorkOrderInputPage: React.FC = () => {
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { workOrders, addWorkOrder } = useWorkOrders();
  const { settings } = useSettings();
  const { setActiveTab } = useUI();
  const { showToast } = useToast();
  const { isGasConnected } = useGASSync();
  const [isSaving, setIsSaving] = useState(false);

  // 1. Initial State Definition
  const [pekerjaan, setPekerjaan] = useState<'NORMAL' | 'GOROW'>('NORMAL');
  const [tanggal, setTanggal] = useState(getLocalDateTimeString().slice(0, 10));
  
  const [ulpName, setUlpName] = useState(ulpList[0]?.namaULP || 'ULP Kuranji');
  const [reguName, setReguName] = useState(reguList[0]?.namaRegu || 'Regu ROW Alpha');
  const [status, setStatus] = useState<WOStatus>('BELUM SELESAI');

  // Filter Penyulang based on selected ULP
  const matchedUlp = ulpList.find((u) => u.namaULP === ulpName);
  let filteredPenyulang = penyulangList.filter((p) => {
    const isUlpNameMatch = p.ulpName && ulpName && (p.ulpName || '').trim().toLowerCase() === (ulpName || '').trim().toLowerCase();
    const isUlpIdMatch = matchedUlp && p.ulpId === matchedUlp.id;
    return isUlpNameMatch || isUlpIdMatch;
  });

  if (filteredPenyulang.length === 0) {
    filteredPenyulang = penyulangList;
  }

  const [penyulangName, setPenyulangName] = useState(
    filteredPenyulang[0]?.namaPenyulang || penyulangList[0]?.namaPenyulang || 'Penyulang Kuranji'
  );

  const cleanStr = (s: any) => String(s || '').trim().toUpperCase();

  // Filter Regu_ROW based on selected ULP (strict match when NORMAL, all if GOROW)
  const strictFilteredRegu = reguList.filter(
    (r) =>
      (matchedUlp && r.ulpId === matchedUlp.id) ||
      (r.ulpName && ulpName && (r.ulpName || '').toLowerCase() === (ulpName || '').toLowerCase()) ||
      (r.namaRegu && ulpName && (r.namaRegu || '').toLowerCase().includes((ulpName || '').replace(/^ULP\s+/i, '').toLowerCase()))
  );

  const availableRegu = pekerjaan === 'GOROW' 
    ? reguList 
    : (strictFilteredRegu.length > 0 ? strictFilteredRegu : reguList.filter(r => !r.ulpId && !r.ulpName));

  // Auto-update Penyulang & Regu when ULP or Pekerjaan changes
  useEffect(() => {
    if (filteredPenyulang.length > 0) {
      const isCurrentValid = filteredPenyulang.some((p) => p.namaPenyulang === penyulangName);
      if (!isCurrentValid) {
        setPenyulangName(filteredPenyulang[0].namaPenyulang);
      }
    } else {
      setPenyulangName('');
    }

    if (availableRegu.length > 0) {
      const isReguValid = availableRegu.some((r) => r.namaRegu === reguName);
      if (!isReguValid) {
        const newRegu = availableRegu[0].namaRegu;
        setReguName(newRegu);
        setNomorWO(generateFormattedNomorWO(tanggal, newRegu, ulpName));
      }
    } else {
      setReguName('');
    }
  }, [ulpName, pekerjaan]);

  // Target Volume: VOLUME PEKERJAAN & SATUAN (KMS / GAWANG)
  const [volumePekerjaan, setVolumePekerjaan] = useState<string>('');
  const [satuan, setSatuan] = useState<'KMS' | 'GAWANG'>('KMS');

  // Auto-generate formatted Nomor_WO helper function: (Format: M1/05/AGUSTUS/2026/KTO/01)
  // ket : M[Minggu] / [Tanggal] / [Bulan] / [Tahun] / [ULP] / [No. Tim ROW]
  const generateFormattedNomorWO = (dateStr: string, teamName: string, selectedUlpName: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'M1/05/AGUSTUS/2026/KTO/01';

    const year = d.getFullYear();
    const monthName = INDO_MONTHS[d.getMonth()] || 'AGUSTUS';
    const dayNum = d.getDate();
    const dayStr = String(dayNum).padStart(2, '0');

    // Week of month (M1 - M5)
    const weekNum = Math.min(5, Math.ceil(dayNum / 7));
    const weekStr = `M${weekNum}`;

    // ULP Code / Abbreviation (e.g., KTO, PGB, IDR)
    const matchedUlpObj = ulpList.find((u) => u.namaULP === selectedUlpName);
    let ulpCode = 'KTO';
    if (matchedUlpObj?.kodeULP) {
      const cleanCode = (matchedUlpObj.kodeULP || '').replace(/^ULP-?/i, '').trim().toUpperCase();
      if (cleanCode) ulpCode = cleanCode;
    } else if (selectedUlpName) {
      const cleanUlp = (selectedUlpName || '').replace(/^ULP\s+/i, '').trim().toUpperCase();
      if (cleanUlp.includes('KURANJI') || cleanUlp.includes('KOTA')) ulpCode = 'KTO';
      else if (cleanUlp.includes('PADANG BARAT') || cleanUlp.includes('PGB')) ulpCode = 'PGB';
      else if (cleanUlp.includes('INDARUNG') || cleanUlp.includes('IDR')) ulpCode = 'IDR';
      else ulpCode = cleanUlp.substring(0, 3).toUpperCase();
    }

    // Team Number
    let teamNum = '01';
    const safeTeamName = teamName || '';
    const digitMatch = safeTeamName.match(/\d+/);
    if (digitMatch) {
      teamNum = String(digitMatch[0]).padStart(2, '0');
    } else if (safeTeamName.toLowerCase().includes('beta')) {
      teamNum = '02';
    } else if (safeTeamName.toLowerCase().includes('gamma')) {
      teamNum = '03';
    }

    return `${weekStr}/${dayStr}/${monthName}/${year}/${ulpCode}/${teamNum}`;
  };

  const [nomorWO, setNomorWO] = useState(() =>
    generateFormattedNomorWO(
      new Date().toISOString().slice(0, 10),
      reguList[0]?.namaRegu || 'Regu ROW Alpha',
      ulpList[0]?.namaULP || 'ULP Kuranji'
    )
  );

  // Helper: Detect duplicate Work Order with the same Nomor_WO AND same Penyulang
  const existingDuplicateWO = useMemo(() => {
    const currentNoWoClean = cleanStr(nomorWO);
    const currentPenyulangClean = cleanStr(penyulangName);
    if (!currentNoWoClean || !currentPenyulangClean) return null;

    return (
      workOrders.find((wo) => {
        return cleanStr(wo.nomorWO) === currentNoWoClean && cleanStr(wo.penyulangName) === currentPenyulangClean;
      }) || null
    );
  }, [workOrders, nomorWO, penyulangName]);

  // Update Nomor_WO automatically when date, team, or ULP changes
  const handleTanggalChange = (newDate: string) => {
    setTanggal(newDate);
    setNomorWO(generateFormattedNomorWO(newDate, reguName, ulpName));
  };

  const handleUlpChange = (newUlp: string) => {
    setUlpName(newUlp);
    setNomorWO(generateFormattedNomorWO(tanggal, reguName, newUlp));
  };

  const handleReguChange = (newRegu: string) => {
    setReguName(newRegu);
    setNomorWO(generateFormattedNomorWO(tanggal, newRegu, ulpName));
  };

  const handleAutoFormatNomorWO = () => {
    const formatted = generateFormattedNomorWO(tanggal, reguName, ulpName);
    setNomorWO(formatted);
    showToast(`Format Nomor WO diperbarui: ${formatted}`, 'info');
  };

  // 2. Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numVolume = parseFloat(volumePekerjaan);

    if (isNaN(numVolume) || numVolume <= 0) {
      showToast('Mohon isi Volume Pekerjaan dengan angka yang valid!', 'warning');
      return;
    }

    if (!penyulangName) {
      showToast('Mohon pilih Penyulang dari ULP yang dipilih', 'warning');
      return;
    }

    // Strict check: Prevent same Nomor WO on the same Penyulang
    if (existingDuplicateWO) {
      showToast(
        `Nomor Work Order "${nomorWO}" dengan Penyulang "${penyulangName}" sudah pernah dibuat! Tidak dapat membuat Work Order ganda pada penyulang yang sama.`,
        'error'
      );
      return;
    }

    setIsSaving(true);
    try {
      const currentUlpObj = ulpList.find((u) => u.namaULP === ulpName) || ulpList[0];
      const currentPenyulangObj = penyulangList.find((p) => p.namaPenyulang === penyulangName) || penyulangList[0];
      const currentReguObj = reguList.find((r) => r.namaRegu === reguName) || reguList[0];

      const newWoData = {
        pekerjaan: pekerjaan,
        nomorWO: (nomorWO || '').trim() || generateFormattedNomorWO(tanggal, reguName, ulpName),
        tanggal,
        ulpId: currentUlpObj?.id || 'ulp-1',
        ulpName,
        penyulangId: currentPenyulangObj?.id || 'peny-1',
        penyulangName,
        reguId: currentReguObj?.id || 'regu-1',
        reguName,
        volumePekerjaan: numVolume,
        satuan: satuan,
        status: status,
        progressPercent: status === 'SELESAI' ? 100 : 0,
      };

      // addWorkOrder already handles both local state and GAS API synchronization
      addWorkOrder(newWoData);
      
      showToast(`Work Order Baru (${numVolume} ${satuan}) Berhasil Disimpan!`, 'success');
      setActiveTab('work_orders');
    } catch (err: any) {
      console.error('Error saving Work Order:', err);
      showToast(`Terjadi kesalahan saat menyimpan Work Order`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveTab('work_orders')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Work Order</span>
        </button>

        {isGasConnected ? (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00A2B9]" />
            <span>Tersinkron ke Spreadsheet</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold rounded-full">
            <Database className="w-3.5 h-3.5 text-amber-500" />
            <span>Mode Lokal (Offline)</span>
          </span>
        )}
      </div>

      {/* Main Card */}
      <div className="bg-teal-50 dark:bg-slate-800 rounded-3xl border-2 border-teal-100 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-teal-200 dark:border-slate-700 pb-4">
          <div className="flex items-center space-x-3 text-black dark:text-teal-400">
            <FilePlus className="w-6 h-6 text-[#00A2B9]" />
            <h1 className="text-xl sm:text-2xl font-black text-black dark:text-white font-display uppercase tracking-tighter">
              Form Input Work Order Baru
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400 mt-1 font-bold">
            Inputkan data pekerjaan ROW sesuai dengan format sheet <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono text-black dark:text-teal-400 font-black border border-teal-100">WORK_ORDER</code>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: PEKERJAAN & Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-black dark:text-slate-300 mb-1 uppercase">
                PEKERJAAN <span className="text-red-600">*</span>
              </label>
              <select
                value={pekerjaan || 'NORMAL'}
                onChange={(e) => {
                  const newPekerjaan = e.target.value as 'NORMAL' | 'GOROW';
                  setPekerjaan(newPekerjaan);
                }}
                className="w-full px-3.5 py-3 text-xs sm:text-sm font-black rounded-xl border border-teal-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white focus:outline-none focus:border-[#00A2B9]"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="GOROW">GOROW</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-black dark:text-slate-300 mb-1 uppercase">
                Tanggal <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={tanggal || ''}
                onChange={(e) => handleTanggalChange(e.target.value)}
                className="w-full px-3.5 py-3 text-xs sm:text-sm rounded-xl border border-teal-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-black dark:text-white font-black focus:outline-none focus:border-[#00A2B9]"
              />
            </div>
          </div>

          {/* Row 2: Nomor_WO */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nomor_WO <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAutoFormatNomorWO}
                className="inline-flex items-center space-x-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400"
              >
                <Sparkles className="w-3 h-3" />
                <span>Format Otomatis</span>
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Format: M1/05/AGUSTUS/2026/KTO/01"
              value={nomorWO || ''}
              onChange={(e) => setNomorWO(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold rounded-xl border transition-colors ${
                existingDuplicateWO
                  ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 focus:border-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9]'
              } focus:outline-none`}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-1">
              <span className="font-semibold text-teal-600 dark:text-teal-400">Format:</span>
              <span>M[Minggu] / [Tanggal] / [Bulan] / [Tahun] / [ULP] / [No. Tim ROW]</span>
            </p>
          </div>

          {/* Row 3: ULP & Penyulang (Filtered) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ULP <span className="text-rose-500">*</span>
              </label>
              <select
                value={ulpName || ''}
                onChange={(e) => handleUlpChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#00A2B9]"
              >
                {ulpList.map((u, uIdx) => (
                  <option key={`${u.id}-${uIdx}`} value={u.namaULP}>
                    {u.namaULP}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Penyulang <span className="text-rose-500">*</span>{' '}
                <span className="text-slate-400 font-normal">(Sesuai ULP dipilih)</span>
              </label>
              <select
                value={penyulangName || ''}
                onChange={(e) => setPenyulangName(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border transition-colors ${
                  existingDuplicateWO
                    ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 focus:border-rose-500'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#00A2B9]'
                } focus:outline-none`}
              >
                {filteredPenyulang.length > 0 ? (
                  filteredPenyulang.map((p, pIdx) => (
                    <option key={`${p.id}-${pIdx}`} value={p.namaPenyulang}>
                      {p.namaPenyulang}
                    </option>
                  ))
                ) : (
                  <option value="">-- Tidak ada Penyulang di ULP ini --</option>
                )}
              </select>
            </div>
          </div>

          {/* DUPLICATE WARNING ALERT */}
          {existingDuplicateWO && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-start space-x-3 text-rose-800 dark:text-rose-300 animate-in fade-in duration-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-rose-700 dark:text-rose-300 flex items-center space-x-1.5">
                  <span>Tidak Dapat Membuat Work Order Duplikat!</span>
                </p>
                <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                  Work Order dengan Nomor <span className="font-mono font-bold underline">{nomorWO}</span> pada Penyulang <span className="font-bold underline">{penyulangName}</span> sudah terdaftar dalam sistem.
                </p>
                <div className="mt-1.5 p-2 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-rose-200/60 dark:border-rose-800/40 text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5">
                  <p><span className="font-semibold text-rose-600 dark:text-rose-400">Data Terdaftar:</span> Tanggal: {existingDuplicateWO.tanggal || '-'} | ULP: {existingDuplicateWO.ulpName || '-'} | Regu: {existingDuplicateWO.reguName || '-'}</p>
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pt-1">
                  💡 <strong>Aturan:</strong> Anda tidak boleh membuat No Work Order yang sama pada Penyulang yang sama. Silakan ganti <strong>Penyulang</strong> yang berbeda atau gunakan <strong>Nomor WO</strong> yang baru.
                </p>
              </div>
            </div>
          )}

          {/* Row 4: Regu_ROW */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Regu_ROW <span className="text-rose-500">*</span>{' '}
              <span className="text-slate-400 font-normal">
                {pekerjaan === 'GOROW' ? '(Semua Regu ROW - Mode GOROW)' : '(Sesuai ULP dipilih)'}
              </span>
            </label>
            <select
              value={reguName || ''}
              onChange={(e) => handleReguChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#00A2B9]"
            >
              {availableRegu.map((r, rIdx) => (
                <option key={`${r.id}-${rIdx}`} value={r.namaRegu}>
                  {r.namaRegu}
                </option>
              ))}
            </select>
          </div>

          {/* Row 5: VOLUME PEKERJAAN & SATUAN (KMS / GAWANG) */}
          <div className="p-4 bg-teal-50/70 dark:bg-teal-950/20 rounded-2xl border border-teal-200/80 dark:border-teal-800/50 space-y-3">
            <div className="flex items-center space-x-2 text-teal-800 dark:text-teal-300">
              <Layers className="w-4 h-4 shrink-0 text-teal-600" />
              <span className="text-xs font-bold">
                Target Volume Pekerjaan & Satuan <span className="text-rose-600 font-black">*</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  VOLUME PEKERJAAN <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Contoh: 2.5"
                  value={volumePekerjaan || ''}
                  onChange={(e) => setVolumePekerjaan(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#00A2B9]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  SATUAN <span className="text-rose-500">*</span>
                </label>
                <select
                  value={satuan || 'KMS'}
                  onChange={(e) => setSatuan(e.target.value as 'KMS' | 'GAWANG')}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#00A2B9]"
                >
                  <option value="KMS">KMS (Kilometer Sirkit)</option>
                  <option value="GAWANG">GAWANG (Jumlah Gawang/Span)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 6: STATUS (Posisikan di paling terakhir) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              STATUS <span className="text-rose-500">*</span>
            </label>
            <select
              value={status || 'BELUM SELESAI'}
              onChange={(e) => setStatus(e.target.value as WOStatus)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#00A2B9]"
            >
              <option value="BELUM SELESAI">BELUM SELESAI</option>
              <option value="SELESAI">SELESAI</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('work_orders')}
              className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving || Boolean(existingDuplicateWO)}
              className="inline-flex items-center space-x-2 px-8 py-3.5 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-[#008396] via-[#00A2B9] to-[#00C2DE] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xl shadow-teal-900/25 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan & Terbitkan WO'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
