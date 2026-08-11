import React, { useState } from 'react';
import { useMasterData } from '../context/MasterDataContext';
import { ULP, Penyulang, ReguROW, Petugas, UserRole } from '../types';
import {
  Database,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Building2,
  Zap,
  ShieldAlert,
  X,
  Check,
} from 'lucide-react';

export const MasterDataPage: React.FC = () => {
  const {
    ulpList,
    addULP,
    updateULP,
    deleteULP,
    penyulangList,
    addPenyulang,
    updatePenyulang,
    deletePenyulang,
    reguList,
    addRegu,
    updateRegu,
    deleteRegu,
    petugasList,
    addPetugas,
    updatePetugas,
    deletePetugas,
  } = useMasterData();

  const [activeTab, setActiveTab] = useState<'regu' | 'petugas' | 'ulp' | 'penyulang'>('regu');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showReguModal, setShowReguModal] = useState(false);
  const [editingRegu, setEditingRegu] = useState<ReguROW | null>(null);

  const [showPetugasModal, setShowPetugasModal] = useState(false);
  const [editingPetugas, setEditingPetugas] = useState<Petugas | null>(null);

  const [showUlpModal, setShowUlpModal] = useState(false);
  const [editingUlp, setEditingUlp] = useState<ULP | null>(null);

  const [showPenyulangModal, setShowPenyulangModal] = useState(false);
  const [editingPenyulang, setEditingPenyulang] = useState<Penyulang | null>(null);

  // Form states for REGU
  const [reguName, setReguName] = useState('');
  const [reguKode, setReguKode] = useState('');
  const [reguPj, setReguPj] = useState('');
  const [reguAnggota, setReguAnggota] = useState(5);
  const [reguKontak, setReguKontak] = useState('');

  // Form states for PETUGAS
  const [ptgNip, setPtgNip] = useState('');
  const [ptgNama, setPtgNama] = useState('');
  const [ptgReguId, setPtgReguId] = useState(reguList[0]?.id || '');
  const [ptgUlpId, setPtgUlpId] = useState(ulpList[0]?.id || '');
  const [ptgNoHp, setPtgNoHp] = useState('');
  const [ptgRole, setPtgRole] = useState<UserRole>('User');

  // Form states for ULP
  const [ulpKode, setUlpKode] = useState('');
  const [ulpNama, setUlpNama] = useState('');
  const [ulpManajer, setUlpManajer] = useState('');
  const [ulpKontak, setUlpKontak] = useState('');
  const [ulpAlamat, setUlpAlamat] = useState('');

  // Form states for PENYULANG
  const [penyKode, setPenyKode] = useState('');
  const [penyNama, setPenyNama] = useState('');
  const [penyUlpId, setPenyUlpId] = useState(ulpList[0]?.id || '');
  const [penyPanjang, setPenyPanjang] = useState(30);
  const [penyTrafo, setPenyTrafo] = useState(100);

  // Submit Regu
  const handleSaveRegu = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRegu) {
      updateRegu(editingRegu.id, {
        kodeRegu: reguKode,
        namaRegu: reguName,
        penanggungJawab: reguPj,
        jumlahAnggota: Number(reguAnggota),
        kontak: reguKontak,
      });
    } else {
      addRegu({
        kodeRegu: reguKode || `ROW-${Date.now().toString().slice(-2)}`,
        namaRegu: reguName,
        penanggungJawab: reguPj,
        jumlahAnggota: Number(reguAnggota),
        kontak: reguKontak,
        status: 'Aktif',
      });
    }
    setShowReguModal(false);
  };

  // Submit Petugas
  const handleSavePetugas = (e: React.FormEvent) => {
    e.preventDefault();
    const selRegu = reguList.find((r) => r.id === ptgReguId);
    const selUlp = ulpList.find((u) => u.id === ptgUlpId);

    if (editingPetugas) {
      updatePetugas(editingPetugas.id, {
        nip: ptgNip,
        nama: ptgNama,
        reguId: ptgReguId,
        reguName: selRegu?.namaRegu || 'Regu ROW Alpha',
        ulpId: ptgUlpId,
        ulpName: selUlp?.namaULP || 'ULP Padang Barat',
        noHp: ptgNoHp,
        role: ptgRole,
      });
    } else {
      addPetugas({
        nip: ptgNip || '19980000000',
        nama: ptgNama,
        reguId: ptgReguId,
        reguName: selRegu?.namaRegu || 'Regu ROW Alpha',
        ulpId: ptgUlpId,
        ulpName: selUlp?.namaULP || 'ULP Padang Barat',
        noHp: ptgNoHp,
        role: ptgRole,
        status: 'Aktif',
      });
    }
    setShowPetugasModal(false);
  };

  // Submit ULP
  const handleSaveUlp = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUlp) {
      updateULP(editingUlp.id, {
        kodeULP: ulpKode,
        namaULP: ulpNama,
        manajer: ulpManajer,
        kontak: ulpKontak,
        alamat: ulpAlamat,
      });
    } else {
      addULP({
        kodeULP: ulpKode || `ULP-${Date.now().toString().slice(-2)}`,
        namaULP: ulpNama,
        manajer: ulpManajer,
        kontak: ulpKontak,
        alamat: ulpAlamat,
        status: 'Aktif',
      });
    }
    setShowUlpModal(false);
  };

  // Submit Penyulang
  const handleSavePenyulang = (e: React.FormEvent) => {
    e.preventDefault();
    const selUlp = ulpList.find((u) => u.id === penyUlpId);

    if (editingPenyulang) {
      updatePenyulang(editingPenyulang.id, {
        kodePenyulang: penyKode,
        namaPenyulang: penyNama,
        ulpId: penyUlpId,
        ulpName: selUlp?.namaULP || 'ULP Padang Barat',
        panjangKms: Number(penyPanjang),
        jumlahTrafo: Number(penyTrafo),
      });
    } else {
      addPenyulang({
        kodePenyulang: penyKode || `PENY-${Date.now().toString().slice(-2)}`,
        namaPenyulang: penyNama,
        ulpId: penyUlpId,
        ulpName: selUlp?.namaULP || 'ULP Padang Barat',
        panjangKms: Number(penyPanjang),
        jumlahTrafo: Number(penyTrafo),
        status: 'Normal',
      });
    }
    setShowPenyulangModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
            Pengelolaan Master Data Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kelola data terstruktur Regu ROW, Personel Petugas, Unit Layanan (ULP), dan Feeder Penyulang.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'regu' && (
            <button
              onClick={() => {
                setEditingRegu(null);
                setReguKode('');
                setReguName('');
                setReguPj('');
                setShowReguModal(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Regu ROW</span>
            </button>
          )}

          {activeTab === 'petugas' && (
            <button
              onClick={() => {
                setEditingPetugas(null);
                setPtgNama('');
                setPtgNip('');
                setShowPetugasModal(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Petugas</span>
            </button>
          )}

          {activeTab === 'ulp' && (
            <button
              onClick={() => {
                setEditingUlp(null);
                setUlpNama('');
                setUlpKode('');
                setShowUlpModal(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah ULP Baru</span>
            </button>
          )}

          {activeTab === 'penyulang' && (
            <button
              onClick={() => {
                setEditingPenyulang(null);
                setPenyNama('');
                setPenyKode('');
                setShowPenyulangModal(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Penyulang</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex space-x-2 overflow-x-auto w-full sm:w-auto p-1">
          <button
            onClick={() => setActiveTab('regu')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'regu'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>1. Regu ROW ({reguList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('petugas')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'petugas'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Petugas ({petugasList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ulp')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ulp'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>3. ULP ({ulpList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('penyulang')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'penyulang'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>4. Penyulang / Feeder ({penyulangList.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari data master..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Tab 1: REGU ROW Table */}
      {activeTab === 'regu' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 pl-5">Kode Regu</th>
                <th className="p-3.5">Nama Regu ROW</th>
                <th className="p-3.5">Penanggung Jawab</th>
                <th className="p-3.5">Jumlah Anggota</th>
                <th className="p-3.5">Kontak</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {reguList
                .filter((r) => (r.namaRegu || '').toLowerCase().includes(searchTerm.toLowerCase()))
                .map((regu, idx) => (
                  <tr key={`${regu.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3.5 pl-5 font-bold text-sky-600">{regu.kodeRegu}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {regu.namaRegu}
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      {regu.penanggungJawab}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      {regu.jumlahAnggota} Personel
                    </td>
                    <td className="p-3.5 text-slate-500">{regu.kontak}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {regu.status}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setEditingRegu(regu);
                            setReguKode(regu.kodeRegu);
                            setReguName(regu.namaRegu);
                            setReguPj(regu.penanggungJawab);
                            setReguAnggota(regu.jumlahAnggota);
                            setReguKontak(regu.kontak);
                            setShowReguModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRegu(regu.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: PETUGAS Table */}
      {activeTab === 'petugas' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 pl-5">NIP / ID</th>
                <th className="p-3.5">Nama Petugas</th>
                <th className="p-3.5">Regu ROW Assigned</th>
                <th className="p-3.5">ULP Base</th>
                <th className="p-3.5">No HP / WhatsApp</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {petugasList
                .filter((p) => (p.nama || '').toLowerCase().includes(searchTerm.toLowerCase()))
                .map((ptg, idx) => (
                  <tr key={`${ptg.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3.5 pl-5 font-bold text-sky-600">{ptg.nip}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{ptg.nama}</td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{ptg.reguName}</td>
                    <td className="p-3.5 text-slate-500">{ptg.ulpName}</td>
                    <td className="p-3.5 text-slate-500">{ptg.noHp}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                        {ptg.role}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setEditingPetugas(ptg);
                            setPtgNip(ptg.nip);
                            setPtgNama(ptg.nama);
                            setPtgReguId(ptg.reguId);
                            setPtgUlpId(ptg.ulpId);
                            setPtgNoHp(ptg.noHp);
                            setPtgRole(ptg.role);
                            setShowPetugasModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePetugas(ptg.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: ULP Table */}
      {activeTab === 'ulp' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 pl-5">Kode ULP</th>
                <th className="p-3.5">Nama Unit Layanan</th>
                <th className="p-3.5">Manajer ULP</th>
                <th className="p-3.5">Alamat Office</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {ulpList
                .filter((u) => (u.namaULP || '').toLowerCase().includes(searchTerm.toLowerCase()))
                .map((ulp, idx) => (
                  <tr key={`${ulp.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3.5 pl-5 font-bold text-sky-600">{ulp.kodeULP}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {ulp.namaULP}
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{ulp.manajer}</td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">{ulp.alamat}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        {ulp.status}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setEditingUlp(ulp);
                            setUlpKode(ulp.kodeULP);
                            setUlpNama(ulp.namaULP);
                            setUlpManajer(ulp.manajer);
                            setUlpKontak(ulp.kontak);
                            setUlpAlamat(ulp.alamat);
                            setShowUlpModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteULP(ulp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: PENYULANG Table */}
      {activeTab === 'penyulang' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3.5 pl-5">Kode Feeder</th>
                <th className="p-3.5">Nama Penyulang</th>
                <th className="p-3.5">ULP Induk</th>
                <th className="p-3.5">Panjang (kms)</th>
                <th className="p-3.5">Jumlah Trafo</th>
                <th className="p-3.5">Kondisi Jaringan</th>
                <th className="p-3.5 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {penyulangList
                .filter((p) => (p.namaPenyulang || '').toLowerCase().includes(searchTerm.toLowerCase()))
                .map((p, idx) => (
                  <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3.5 pl-5 font-bold text-sky-600">{p.kodePenyulang}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {p.namaPenyulang}
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{p.ulpName}</td>
                    <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      {p.panjangKms} kms
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      {p.jumlahTrafo} Unit
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          p.status === 'Rawan Hazard'
                            ? 'bg-rose-100 text-rose-800'
                            : p.status === 'Maintenance'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setEditingPenyulang(p);
                            setPenyKode(p.kodePenyulang);
                            setPenyNama(p.namaPenyulang);
                            setPenyUlpId(p.ulpId);
                            setPenyPanjang(p.panjangKms);
                            setPenyTrafo(p.jumlahTrafo);
                            setShowPenyulangModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePenyulang(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Regu ROW Modal */}
      {showReguModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {editingRegu ? 'Edit Regu ROW' : 'Tambah Regu ROW'}
              </h3>
              <button onClick={() => setShowReguModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveRegu} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nama Regu</label>
                <input
                  type="text"
                  required
                  value={reguName}
                  onChange={(e) => setReguName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Penanggung Jawab</label>
                <input
                  type="text"
                  required
                  value={reguPj}
                  onChange={(e) => setReguPj(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReguModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Petugas Modal */}
      {showPetugasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {editingPetugas ? 'Edit Petugas' : 'Tambah Petugas'}
              </h3>
              <button onClick={() => setShowPetugasModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSavePetugas} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nama Petugas</label>
                <input
                  type="text"
                  required
                  value={ptgNama}
                  onChange={(e) => setPtgNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">NIP / ID</label>
                <input
                  type="text"
                  value={ptgNip}
                  onChange={(e) => setPtgNip(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPetugasModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ULP Modal */}
      {showUlpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {editingUlp ? 'Edit ULP' : 'Tambah ULP'}
              </h3>
              <button onClick={() => setShowUlpModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveUlp} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nama ULP</label>
                <input
                  type="text"
                  required
                  value={ulpNama}
                  onChange={(e) => setUlpNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUlpModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Penyulang Modal */}
      {showPenyulangModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {editingPenyulang ? 'Edit Penyulang' : 'Tambah Penyulang'}
              </h3>
              <button onClick={() => setShowPenyulangModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSavePenyulang} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nama Penyulang</label>
                <input
                  type="text"
                  required
                  value={penyNama}
                  onChange={(e) => setPenyNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPenyulangModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
