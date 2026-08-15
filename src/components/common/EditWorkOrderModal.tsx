import React, { useState, useEffect, useMemo } from 'react';
import { WorkOrder, WOStatus } from '../../types';
import { useMasterData } from '../../context/MasterDataContext';
import { useWorkOrders } from '../../context/WorkOrderContext';
import { useToast } from '../../hooks/useToast';
import { X, Save, AlertTriangle } from 'lucide-react';

interface EditWorkOrderModalProps {
  workOrder: WorkOrder;
  onClose: () => void;
}

export const EditWorkOrderModal: React.FC<EditWorkOrderModalProps> = ({ workOrder, onClose }) => {
  const { ulpList, penyulangList, reguList } = useMasterData();
  const { workOrders, updateWorkOrder } = useWorkOrders();
  const { showToast } = useToast();

  const [nomorWO, setNomorWO] = useState(workOrder.nomorWO);
  const [tanggal, setTanggal] = useState(workOrder.tanggal);
  const [pekerjaan, setPekerjaan] = useState<'NORMAL' | 'GOROW'>(workOrder.pekerjaan || 'NORMAL');
  
  const [ulpName, setUlpName] = useState(workOrder.ulpName);
  const [penyulangName, setPenyulangName] = useState(workOrder.penyulangName);
  const [reguName, setReguName] = useState(workOrder.reguName);
  
  const [volumePekerjaan, setVolumePekerjaan] = useState(workOrder.volumePekerjaan?.toString() || '');
  const [satuan, setSatuan] = useState(workOrder.satuan || 'KMS');
  const [status, setStatus] = useState<WOStatus>((workOrder.status as WOStatus) || 'BELUM SELESAI');

  const cleanStr = (s: any) => String(s || '').trim().toUpperCase();

  // Helper: Detect duplicate Work Order with the same Nomor_WO AND same Penyulang
  const existingDuplicateWO = useMemo(() => {
    const currentNoWoClean = cleanStr(nomorWO);
    const currentPenyulangClean = cleanStr(penyulangName);
    if (!currentNoWoClean || !currentPenyulangClean) return null;

    return (
      workOrders.find((wo) => {
        if (wo.id === workOrder.id) return false;
        return cleanStr(wo.nomorWO) === currentNoWoClean && cleanStr(wo.penyulangName) === currentPenyulangClean;
      }) || null
    );
  }, [workOrders, workOrder.id, nomorWO, penyulangName]);

  const matchedUlp = ulpList.find((u) => u.namaULP === ulpName);
  const filteredPenyulang = penyulangList.filter((p) => {
    const isUlpNameMatch = p.ulpName && ulpName && (p.ulpName || '').trim().toLowerCase() === (ulpName || '').trim().toLowerCase();
    const isUlpIdMatch = matchedUlp && p.ulpId === matchedUlp.id;
    return isUlpNameMatch || isUlpIdMatch;
  });

  const availablePenyulang = filteredPenyulang.length > 0 ? filteredPenyulang : penyulangList;

  const strictFilteredRegu = reguList.filter(
    (r) =>
      (r.ulpName?.toLowerCase() === (ulpName || '').toLowerCase()) ||
      (matchedUlp && r.ulpId === matchedUlp.id)
  );

  const availableRegu = pekerjaan === 'GOROW'
    ? reguList
    : (strictFilteredRegu.length > 0 ? strictFilteredRegu : reguList.filter(r => !r.ulpId && !r.ulpName));

  const handleUlpChange = (val: string) => {
    setUlpName(val);
    const newMatchedUlp = ulpList.find((u) => u.namaULP === val);
    
    let newFilteredPenyulang = penyulangList.filter((p) => {
      const isUlpNameMatch = p.ulpName && val && (p.ulpName || '').trim().toLowerCase() === (val || '').trim().toLowerCase();
      const isUlpIdMatch = newMatchedUlp && p.ulpId === newMatchedUlp.id;
      return isUlpNameMatch || isUlpIdMatch;
    });

    if (newFilteredPenyulang.length === 0) newFilteredPenyulang = penyulangList;

    if (!newFilteredPenyulang.some(p => p.namaPenyulang === penyulangName)) {
      setPenyulangName(newFilteredPenyulang[0]?.namaPenyulang || '');
    }

    const newStrictRegu = reguList.filter(
      (r) =>
        (r.ulpName || '').toLowerCase() === (val || '').toLowerCase() ||
        (newMatchedUlp && r.ulpId === newMatchedUlp.id)
    );
    const newAvailableRegu = pekerjaan === 'GOROW'
      ? reguList
      : (newStrictRegu.length > 0 ? newStrictRegu : reguList.filter(r => !r.ulpId && !r.ulpName));
      
    if (!newAvailableRegu.some(r => r.namaRegu === reguName)) {
      setReguName(newAvailableRegu[0]?.namaRegu || '');
    }
  };

  const handlePekerjaanChange = (val: 'NORMAL' | 'GOROW') => {
    setPekerjaan(val);
    const newAvailableRegu = val === 'GOROW'
      ? reguList
      : (strictFilteredRegu.length > 0 ? strictFilteredRegu : reguList.filter(r => !r.ulpId && !r.ulpName));
      
    if (!newAvailableRegu.some(r => r.namaRegu === reguName)) {
      setReguName(newAvailableRegu[0]?.namaRegu || '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numVolume = parseFloat(volumePekerjaan);
    if (isNaN(numVolume) || numVolume <= 0) {
      showToast('Mohon isi Volume Pekerjaan dengan angka yang valid!', 'warning');
      return;
    }

    if (existingDuplicateWO) {
      showToast(
        `Nomor Work Order "${nomorWO}" dengan Penyulang "${penyulangName}" sudah digunakan pada Work Order lain!`,
        'error'
      );
      return;
    }

    const currentUlpObj = ulpList.find((u) => u.namaULP === ulpName) || ulpList[0];
    const currentPenyulangObj = penyulangList.find((p) => p.namaPenyulang === penyulangName) || penyulangList[0];
    const currentReguObj = reguList.find((r) => r.namaRegu === reguName) || reguList[0];

    updateWorkOrder(workOrder.id, {
      nomorWO,
      tanggal,
      pekerjaan,
      ulpId: currentUlpObj?.id,
      ulpName,
      penyulangId: currentPenyulangObj?.id,
      penyulangName,
      reguId: currentReguObj?.id,
      reguName,
      volumePekerjaan: numVolume,
      satuan,
      status,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Edit Work Order</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pekerjaan</label>
              <select
                value={pekerjaan}
                onChange={(e) => handlePekerjaanChange(e.target.value as 'NORMAL' | 'GOROW')}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              >
                <option value="NORMAL">NORMAL (Per ULP)</option>
                <option value="GOROW">GOROW (Lintas ULP)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal</label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nomor WO</label>
              <input
                type="text"
                required
                value={nomorWO}
                onChange={(e) => setNomorWO(e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-xl border transition-colors ${
                  existingDuplicateWO
                    ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 focus:border-rose-500'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-sky-500'
                } focus:outline-none`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ULP</label>
              <select
                value={ulpName}
                onChange={(e) => handleUlpChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              >
                {ulpList.map((u, i) => (
                  <option key={i} value={u.namaULP}>{u.namaULP}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Penyulang</label>
              <select
                value={penyulangName}
                onChange={(e) => setPenyulangName(e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-xl border transition-colors ${
                  existingDuplicateWO
                    ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 focus:border-rose-500'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-sky-500'
                } focus:outline-none`}
              >
                {availablePenyulang.map((p, i) => (
                  <option key={i} value={p.namaPenyulang}>{p.namaPenyulang}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Regu ROW</label>
              <select
                value={reguName}
                onChange={(e) => setReguName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              >
                {availableRegu.map((r, i) => (
                  <option key={i} value={r.namaRegu}>{r.namaRegu}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Volume Pekerjaan</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={volumePekerjaan}
                onChange={(e) => setVolumePekerjaan(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Satuan</label>
              <select
                value={satuan}
                onChange={(e) => setSatuan(e.target.value as 'KMS' | 'GAWANG')}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              >
                <option value="KMS">KMS</option>
                <option value="GAWANG">GAWANG</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WOStatus)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              >
                <option value="BELUM SELESAI">BELUM SELESAI</option>
                <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
                <option value="SELESAI">SELESAI</option>
              </select>
            </div>
          </div>

          {/* DUPLICATE WARNING ALERT */}
          {existingDuplicateWO && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-start space-x-3 text-rose-800 dark:text-rose-300 animate-in fade-in duration-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-rose-700 dark:text-rose-300">
                  Duplikasi Terdeteksi!
                </p>
                <p className="text-rose-600 dark:text-rose-400">
                  Nomor WO <span className="font-mono font-bold underline">{nomorWO}</span> dengan Penyulang <span className="font-bold underline">{penyulangName}</span> sudah digunakan pada data Work Order lain.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={Boolean(existingDuplicateWO)}
              className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-sky-600/25 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
