import { GASApiService } from './gasApiService';
import { ApiService } from './apiService';
import { InisiasiService } from './inisiasiService';
import { User, UserRole, WorkOrder, ULP, Penyulang, ReguROW, Petugas } from '../types';
import { formatDriveViewUrl, formatDriveImageUrl } from '../utils/driveUtils';
import { getLocalDateTimeString, getWIBDateString } from '../utils/dateUtils';
import { parseNumeric } from '../utils/metricUtils';
import { dexieDb } from './dexieDb';
import { offlineSyncQueue } from './offlineSyncQueue';
import { auditRealisasiMutation } from '../utils/integrityLogger';

export function normalizeUser(u: any): User {
  if (!u || typeof u !== 'object') {
    return {
      id: 'usr-' + Math.random().toString(36).substring(2, 7),
      nip: 'usr-unknown',
      name: 'Unknown User',
      userName: 'user',
      email: 'user@pln.co.id',
      role: 'User'
    };
  }

  const id = String(u.id || u.UserID || u.User_ID || u.ID || u.Username || u.username || u.NIP || u.nip || 'usr-' + Math.random().toString(36).substring(2, 7));
  const nip = String(u.UserID || u.User_ID || u.nip || u.NIP || u.Username || u.username || u.id || id);
  const userName = String(u.Username || u.username || u.userName || u.UserID || u.User_ID || u.nip || u.NIP || id).trim();
  const name = String(u.name || u.Nama || u.Name || userName || nip || id).trim();
  const password = String(u.Password || u.password || u.PASSWORD || u.pass || u.Pass || u.KataSandi || u.kataSandi || u.KATA_SANDI || '').trim();
  const email = String(u.email || u.Email || `${userName.toLowerCase().replace(/[^a-z0-9]/g, '')}@pln.co.id`);
  
  const rawRole = String(u.Role || u.role || 'User').trim();
  let role: UserRole = 'User';
  if (/^super\s*admin$/i.test(rawRole) || /superadmin/i.test(rawRole) || /admin\s*utama/i.test(rawRole)) {
    role = 'SuperAdmin';
  } else if (/^adm$/i.test(rawRole) || rawRole.toLowerCase() === 'adm') {
    role = 'Adm';
  } else if (/admin/i.test(rawRole) || /admbkt/i.test(rawRole) || /manajer/i.test(rawRole) || /supervisor/i.test(rawRole)) {
    role = 'Admin';
  } else {
    role = 'User';
  }

  const reguName = String(u.NamaRegu || u.Nama_Regu || u.reguName || u.NAMA_REGU || u.Regu_ROW || u.Regu || u.namaRegu || u.regu || u.ReguROW || u.Nama_Regu_ROW || u.Tim || u.Nama_Tim || u.Kelompok || '').trim();
  const ulpName = String(u.ULP || u.ulpName || u.NAMA_ULP || u.Nama_ULP || u.namaULP || u.ulp || u.NamaULP || u.nama_ulp || '').trim();
  const unitId = String(u.unitId || u.unit_id || u.UnitID || u.Unit_ID || u.kodeUnit || u.Kode_Unit || u.kodeUL || u.Kode_UL || '').trim();
  const unitName = String(u.unitName || u.unit_name || u.UnitName || u.Nama_UL || u.namaUL || u.NamaUL || '').trim();
  const status = (u.Status === 'Non-Aktif' || u.status === 'Non-Aktif' || u.Status === 'Nonaktif' || u.status === 'Nonaktif') ? 'Non-Aktif' : 'Aktif';

  return {
    id,
    unitId: unitId || undefined,
    unitName: unitName || undefined,
    nip,
    name,
    userName,
    password,
    email,
    role,
    reguName,
    ulpName,
    reguId: String(u.reguId || u.ReguID || ''),
    ulpId: String(u.ulpId || u.ULPId || ''),
    phone: String(u.phone || u.No_HP || u.Kontak || ''),
    status,
  };
}

export function normalizeULP(u: any): ULP {
  if (!u || typeof u !== 'object') {
    return {
      id: 'ulp-' + Math.random().toString(36).substring(2, 7),
      kodeULP: '',
      namaULP: '',
      manajer: '',
      kontak: '',
      alamat: '',
      status: 'Aktif',
    };
  }

  const id = String(u.id || u.ID || u.Id || u.ulp_id || u.ULP_ID || u.kode_ulp || u.Kode_ULP || u.kodeULP || 'ulp-' + Math.random().toString(36).substring(2, 7));
  const kodeULP = String(u.kodeULP || u.Kode_ULP || u.kode_ulp || u.Kode || u.kode || u.id || u.ID || '');
  const namaULP = String(u.namaULP || u.Nama_ULP || u.nama_ulp || u.ULP || u.ulp || u.Nama || u.nama || u.ULP_Name || u.ulp_name || u.NamaULP || '').trim();
  const manajer = String(u.manajer || u.Manajer || u.manager || u.Manager || '').trim();
  const kontak = String(u.kontak || u.Kontak || u.no_hp || u.No_HP || u.phone || '').trim();
  const alamat = String(u.alamat || u.Alamat || u.address || '').trim();
  const status = (u.status === 'Non-Aktif' || u.status === 'Nonaktif' || u.Status === 'Non-Aktif' || u.Status === 'Nonaktif' || u.status === false || u.is_active === false) ? 'Non-Aktif' : 'Aktif';
  const unitId = String(u.unitId || u.unit_id || u.UnitID || u.Unit_ID || u.kode_ul || u.Kode_UL || '').trim();

  return {
    id,
    unitId: unitId || undefined,
    kodeULP,
    namaULP: namaULP || kodeULP || id,
    manajer,
    kontak,
    alamat,
    status,
  };
}

export function normalizePenyulang(p: any): Penyulang {
  if (!p || typeof p !== 'object') {
    return {
      id: 'pyl-' + Math.random().toString(36).substring(2, 7),
      kodePenyulang: 'PYL-01',
      namaPenyulang: '',
      ulpId: '',
      ulpName: '',
      panjangKms: 0,
      jumlahTrafo: 0,
      status: 'Normal',
    };
  }

  const id = String(p.id || p.ID || p.Id || p.penyulang_id || p.Penyulang_ID || p.kode_penyulang || p.Kode_Penyulang || p.kodePenyulang || 'pyl-' + Math.random().toString(36).substring(2, 7));
  const kodePenyulang = String(p.kodePenyulang || p.Kode_Penyulang || p.kode_penyulang || p.Kode || p.kode || p.feeder || p.Feeder || 'PYL-01');
  const namaPenyulang = String(p.namaPenyulang || p.Nama_Penyulang || p.nama_penyulang || p.Penyulang || p.penyulang || p.Nama || p.nama || p.NAMA_PENYULANG || p.FE_PENYULANG || p.feeder || p.Feeder || '').trim();
  const ulpId = String(p.ulpId || p.ulp_id || p.ULPId || p.ULP_ID || p.id_ulp || p.ID_ULP || '').trim();
  const ulpName = String(p.ulpName || p.ulp_name || p.ULP || p.ulp || p.Nama_ULP || p.nama_ulp || p.namaULP || p.NamaULP || p.NAMA_ULP || '').trim();
  const unitId = String(p.unitId || p.unit_id || p.UnitID || p.Unit_ID || '').trim();

  const rawStatus = String(p.status || p.Status || 'Normal');
  let status: 'Normal' | 'Rawan Hazard' | 'Maintenance' = 'Normal';
  if (/hazard/i.test(rawStatus)) status = 'Rawan Hazard';
  else if (/maintenance|maint/i.test(rawStatus)) status = 'Maintenance';

  return {
    id,
    unitId: unitId || undefined,
    kodePenyulang,
    namaPenyulang: namaPenyulang || kodePenyulang || id,
    ulpId,
    ulpName,
    panjangKms: parseNumeric(p.panjangKms ?? p.panjang_kms ?? p.Panjang_Kms ?? p.panjang ?? p.Panjang ?? p.kms ?? p.KMS, 0),
    jumlahTrafo: parseNumeric(p.jumlahTrafo ?? p.jumlah_trafo ?? p.Jumlah_Trafo ?? p.trafo ?? p.Trafo, 0),
    status,
  };
}

export function normalizeRegu(r: any): ReguROW {
  if (!r || typeof r !== 'object') {
    return {
      id: 'rgu-' + Math.random().toString(36).substring(2, 7),
      kodeRegu: '',
      namaRegu: '',
      penanggungJawab: '',
      jumlahAnggota: 4,
      kontak: '',
      status: 'Aktif',
    };
  }

  const id = String(r.id || r.ID || r.Id || r.regu_id || r.Regu_ID || r.kode_regu || r.Kode_Regu || r.kodeRegu || 'rgu-' + Math.random().toString(36).substring(2, 7));
  const kodeRegu = String(r.kodeRegu || r.Kode_Regu || r.kode_regu || r.Kode || r.kode || '');
  const namaRegu = String(r.namaRegu || r.Nama_Regu || r.nama_regu || r.Regu_ROW || r.regu_row || r.Regu || r.regu || r.Nama || r.nama || r.NAMA_REGU || r.Tim || r.tim || r.nama_tim || r.Tim_ROW || '').trim();
  const penanggungJawab = String(r.penanggungJawab || r.penanggung_jawab || r.PenanggungJawab || r.Penanggung_Jawab || r.pj || r.PJ || r.kontak || r.Kontak || '').trim();
  const ulpId = String(r.ulpId || r.ulp_id || r.ULPId || r.ULP_ID || r.id_ulp || r.ID_ULP || '').trim();
  const ulpName = String(r.ulpName || r.ulp_name || pUlpName(r) || '').trim();
  const unitId = String(r.unitId || r.unit_id || r.UnitID || r.Unit_ID || '').trim();
  const status = (r.status === 'Non-Aktif' || r.status === 'Nonaktif' || r.Status === 'Non-Aktif' || r.Status === 'Nonaktif' || r.status === false || r.is_active === false) ? 'Non-Aktif' : 'Aktif';

  return {
    id,
    unitId: unitId || undefined,
    kodeRegu,
    namaRegu: namaRegu || kodeRegu || id,
    penanggungJawab,
    ulpId: ulpId || undefined,
    ulpName: ulpName || undefined,
    jumlahAnggota: parseNumeric(r.jumlahAnggota ?? r.jumlah_anggota ?? r.Jumlah_Anggota ?? r.anggota ?? r.Anggota, 4),
    kontak: String(r.kontak || r.Kontak || r.no_hp || r.No_HP || r.phone || ''),
    status,
  };
}

function pUlpName(item: any): string {
  return item?.ULP || item?.ulp || item?.Nama_ULP || item?.nama_ulp || item?.namaULP || item?.NamaULP || item?.NAMA_ULP || '';
}

export function normalizePetugas(p: any): Petugas {
  if (!p || typeof p !== 'object') {
    return {
      id: 'ptg-' + Math.random().toString(36).substring(2, 7),
      nip: '',
      nama: '',
      reguId: '',
      reguName: '',
      ulpId: '',
      ulpName: '',
      noHp: '',
      role: 'User',
      status: 'Aktif',
    };
  }

  const id = String(p.id || p.ID || p.Id || p.petugas_id || p.Petugas_ID || p.nip || p.NIP || 'ptg-' + Math.random().toString(36).substring(2, 7));
  const nip = String(p.nip || p.NIP || p.id || p.ID || '');
  const nama = String(p.nama || p.Nama || p.namaPetugas || p.nama_petugas || p.Nama_Petugas || p.NAMA_PETUGAS || p.Petugas || p.petugas || p.name || p.Name || p.Nama_Anggota || p.NamaAnggota || p.petugas_name || nip || id).trim();
  const reguId = String(p.reguId || p.regu_id || p.ReguID || p.Regu_ID || p.id_regu || p.ID_REGU || '').trim();
  const reguName = String(p.reguName || p.regu_name || p.Regu || p.regu || p.Nama_Regu || p.nama_regu || p.namaRegu || p.NAMA_REGU || p.Regu_ROW || p.regu_row || p.Tim || p.tim || p.Nama_Tim || p.nama_tim || p.Tim_ROW || p.Kelompok || '').trim();
  const ulpId = String(p.ulpId || p.ulp_id || p.ULPId || p.ULP_ID || p.id_ulp || p.ID_ULP || '').trim();
  const ulpName = String(p.ulpName || p.ulp_name || pUlpName(p) || '').trim();
  const unitId = String(p.unitId || p.unit_id || p.UnitID || p.Unit_ID || '').trim();
  const status = (p.status === 'Non-Aktif' || p.status === 'Nonaktif' || p.Status === 'Non-Aktif' || p.Status === 'Nonaktif' || p.status === false || p.is_active === false) ? 'Non-Aktif' : 'Aktif';

  const rawRole = String(p.role || p.Role || 'User').trim();
  let role: UserRole = 'User';
  if (/^super\s*admin$/i.test(rawRole) || /superadmin/i.test(rawRole)) role = 'SuperAdmin';
  else if (/^adm$/i.test(rawRole) || rawRole.toLowerCase() === 'adm') role = 'Adm';
  else if (/admin/i.test(rawRole)) role = 'Admin';

  return {
    id,
    unitId: unitId || undefined,
    nip,
    nama,
    reguId,
    reguName,
    ulpId,
    ulpName,
    noHp: String(p.noHp || p.no_hp || p.nomorHP || p.Nomor_HP || p.Kontak || p.kontak || p.phone || ''),
    role,
    status,
  };
}

export function normalizeWorkOrder(w: any): WorkOrder {
  const rawSatuan = String(w.satuan || w.SATUAN || 'KMS').toUpperCase();
  const satuan: 'KMS' | 'GAWANG' = rawSatuan === 'GAWANG' ? 'GAWANG' : 'KMS';

  return {
    id: String(w.id || w.WO_ID || w.ID || 'wo-' + Math.random().toString(36).substring(2, 7)),
    pekerjaan: (w.pekerjaan || w.PEKERJAAN || 'NORMAL') as 'NORMAL' | 'GOROW',
    nomorWO: String(w.nomorWO || w.NOMOR_WO || w.Nomor_WO || w.WO_Number || w.id || w.WO_ID || ''),
    tanggal: String(w.tanggal || w.TANGGAL || w.Tanggal || getWIBDateString()),
    ulpId: String(w.ulpId || w.ULPId || w.ULP_ID || ''),
    ulpName: String(w.ulpName || w.NAMA_ULP || w.Nama_ULP || w.ULP || ''),
    penyulangId: String(w.penyulangId || w.PenyulangId || ''),
    penyulangName: String(w.penyulangName || w.NAMA_PENYULANG || w.Nama_Penyulang || w.Penyulang || ''),
    reguId: String(w.reguId || w.ReguId || w.REGU_ID || ''),
    reguName: String(w.reguName || w.NAMA_REGU || w.Nama_Regu || w.Regu_ROW || w.Regu || ''),
    volumePekerjaan: parseNumeric(w.volumePekerjaan || w.VOLUME || w.Volume || w.volume, 0),
    satuan,
    totalRealisasi: parseNumeric(w.totalRealisasi || w.TOTAL_REALISASI || w.Total_Realisasi || w.total_realisasi, 0),
    satuanTotalRealisasi: (w.satuanTotalRealisasi || w.SATUAN_TOTAL_REALISASI || w.Satuan_Total_Realisasi || w.satuan_total_realisasi || 'KMS') as 'KMS' | 'GAWANG',
    woMulai: String(w.woMulai || w.WO_MULAI || w.Wo_Mulai || w.WoMulai || ''),
    woAkhir: String(w.woAkhir || w.WO_AKHIR || w.Wo_Akhir || w.WoAkhir || ''),
    status: (w.status || w.STATUS || 'Belum Dikerjakan'),
    deskripsi: String(w.deskripsi || w.DESKRIPSI || w.Deskripsi || ''),
    jenisPekerjaan: w.jenisPekerjaan || w.JENIS_PEKERJAAN || w.Jenis_Pekerjaan || w.Kategori || 'Pemangkasan Pohon (ROW)',
    prioritas: w.prioritas || w.PRIORITAS || w.Prioritas || 'Sedang',
    lokasi: String(w.lokasi || w.LOKASI || w.Lokasi || ''),
    petugasName: String(w.petugasName || w.PETUGAS || w.Petugas || w.NAMA_PETUGAS || ''),
    progressPercent: parseNumeric(w.progressPercent || w.PROGRESS || w.progress || w.Progress, 0),
    createdAt: String(w.createdAt || w.Created_At || getLocalDateTimeString()),
  };
}

export function normalizeAbsensi(a: any): any {
  if (!a || typeof a !== 'object') {
    return {
      id: 'abs-' + Math.random().toString(36).substring(2, 7),
      tanggal: getWIBDateString(),
      reguName: '',
      ulpName: '',
      petugasList: [],
      createdAt: getLocalDateTimeString(),
    };
  }

  let petugasList: any[] = Array.isArray(a.petugasList) ? a.petugasList : [];
  if (petugasList.length === 0) {
    for (let i = 1; i <= 20; i++) {
      const pVal = a[`PETUGAS_${i}`] || a[`Petugas_${i}`] || a[`petugas_${i}`];
      const kVal = a[`KET_${i}`] || a[`Ket_${i}`] || a[`ket_${i}`] || 'HADIR';
      if (pVal && pVal !== '-') {
        petugasList.push({
          nama: String(pVal).replace(/\s*\([^)]*\)/g, '').trim(),
          keterangan: String(kVal || 'HADIR').trim().toUpperCase(),
        });
      }
    }
  }

  return {
    ...a,
    id: String(a.id || a.ID || a.ABS_ID || 'abs-' + Math.random().toString(36).substring(2, 7)),
    tanggal: String(a.tanggal || a.TANGGAL || a.Tanggal || getWIBDateString()),
    reguName: String(a.reguName || a.NAMA_REGU || a.Nama_Regu || a.Regu || ''),
    ulpName: String(a.ulpName || a.NAMA_ULP || a.Nama_ULP || a.ULP || ''),
    userName: String(a.userName || a.USER_NAME || a.Username || a.username || ''),
    namaPetugas: String(a.namaPetugas || a.NAMA_PETUGAS || a.Nama_Petugas || a.Petugas || ''),
    nip: String(a.nip || a.NIP || ''),
    petugasList,
    fotoMasuk: formatDriveViewUrl(String(a.fotoMasuk || a.FOTO_MASUK || a.FotoMasuk || '')),
    timestampMasuk: String(a.timestampMasuk || a['TIMESTAMP MASUK'] || a.TIMESTAMP_MASUK || a.TIMESTAMP || ''),
    fotoKeluar: formatDriveViewUrl(String(a.fotoKeluar || a.FOTO_KELUAR || a.FotoKeluar || '')),
    timestampKeluar: String(a.timestampKeluar || a['TIMESTAMP KELUAR'] || a.TIMESTAMP_KELUAR || ''),
    latitude: Number(a.latitude || a.Latitude || a.LATITUDE || a.lat || 0),
    longitude: Number(a.longitude || a.Longitude || a.LONGITUDE || a.lon || 0),
    createdAt: String(a.createdAt || a.CREATED_AT || a.Created_At || getLocalDateTimeString()),
  };
}

export function normalizeRealisasi(r: any): any {
  if (!r || typeof r !== 'object') return r;

  const latLngStr = String(r.Latitude_Longitude || r.latitudeLongitude || r.LATITUDE_LONGITUDE || '');
  let lat = Number(r.latitude || 0);
  let lng = Number(r.longitude || 0);
  if (latLngStr.includes(',')) {
    const parts = latLngStr.split(',');
    lat = Number(parts[0].trim()) || lat;
    lng = Number(parts[1].trim()) || lng;
  }

  const rawFotoSebelum = String(r.Foto_Sebelum || r.fotoSebelumUrl || r.fotoSebelum || r.FOTO_SEBELUM || '');
  const rawFotoSesudah = String(r.Foto_Sesudah || r.fotoSesudahUrl || r.fotoSesudah || r.FOTO_SESUDAH || '');
  const fotoSebelumUrl = formatDriveViewUrl(rawFotoSebelum);
  const fotoSesudahUrl = formatDriveViewUrl(rawFotoSesudah);
  const fotoSebelumImg = formatDriveImageUrl(rawFotoSebelum);
  const fotoSesudahImg = formatDriveImageUrl(rawFotoSesudah);

  const relId = String(r.id || r.ID || r.Id || 'rel-' + Math.random().toString(36).substring(2, 7));
  let cleanWoId = String(r.WO_ID || r.workOrderId || r.woId || '').trim();
  if (cleanWoId === relId || cleanWoId.startsWith('REL-')) {
    cleanWoId = '';
  }

  return {
    id: relId,
    workOrderId: cleanWoId,
    nomorWO: String(r.Nomor_WO || r.nomorWO || r.NO_WO || ''),
    ulpName: String(r.ULP || r.ulpName || ''),
    reguName: String(r.REGU_ROW || r.reguName || r.REGU || ''),
    penyulangName: String(r.PENYULANG || r.penyulangName || ''),
    noTiang: String(r.NO_TIANG || r.noTiang || ''),
    tanggalRealisasi: String(r.TANGGAL || r.tanggalRealisasi || getWIBDateString()),
    petugasId: String(r.petugasId || 'usr-3'),
    petugasName: String(r.Petugas || r.petugasName || r.REGU_ROW || ''),
    jenisTanaman: String(r.Jenis_Tanaman || r.jenisTanaman || ''),
    pertumbuhanTanaman: String(r.Pertumbuhan_Tanaman || r.pertumbuhanTanaman || ''),
    kendala: String(r.Kendala || r.kendala || ''),
    lokasiKerja: String(r.Lokasi_kerja || r.lokasiKerja || r.LOKASI_KERJA || ''),
    latitude: lat,
    longitude: lng,
    keterangan: String(r.Keterangan || r.keterangan || ''),
    progressPercent: 100,
    status: 'Selesai',
    fotoSebelumUrl,
    fotoSesudahUrl,
    photosSebelum: fotoSebelumUrl ? [{
      id: 'pic-seb-1',
      type: 'sebelum',
      slotIndex: 1,
      dataUrl: fotoSebelumImg,
      fileUrl: fotoSebelumUrl,
      originalName: 'Foto_Sebelum.jpg',
      timestamp: String(r.Timestamp || r.TANGGAL || ''),
      latitude: lat,
      longitude: lng,
      userName: String(r.Petugas || r.REGU_ROW || ''),
      ulpName: String(r.ULP || '')
    }] : [],
    photosSesudah: fotoSesudahUrl ? [{
      id: 'pic-ses-1',
      type: 'sesudah',
      slotIndex: 1,
      dataUrl: fotoSesudahImg,
      fileUrl: fotoSesudahUrl,
      originalName: 'Foto_Sesudah.jpg',
      timestamp: String(r.Timestamp || r.TANGGAL || ''),
      latitude: lat,
      longitude: lng,
      userName: String(r.Petugas || r.REGU_ROW || ''),
      ulpName: String(r.ULP || '')
    }] : [],
    timestamp: String(r.Timestamp || r.timestamp || r.createdAt || ''),
    createdAt: String(r.Timestamp || r.createdAt || getLocalDateTimeString()),
  };
}

export class SyncService {
  private static LAST_SYNC_KEY = 'aphro_last_sync_timestamp';

  static async withRetry<T>(fn: () => Promise<T>, retries = 1, delay = 300): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.withRetry(fn, retries - 1, delay);
    }
  }

  /**
   * Get the last successful sync timestamp
   */
  static getLastSyncTime(): string | null {
    try {
      return localStorage.getItem(this.LAST_SYNC_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Set the last successful sync timestamp
   */
  static setLastSyncTime(timestamp: string): void {
    try {
      localStorage.setItem(this.LAST_SYNC_KEY, timestamp);
      dexieDb.metadata.put({
        key: 'last_sync_timestamp',
        value: timestamp,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    } catch {
      // Ignore
    }
  }

  /**
   * Delta Synchronization (Supabase ↔ Dexie)
   * If lastSyncTime exists (e.g. 2026-09-14 08:30), only queries and downloads
   * records created/updated after that timestamp instead of downloading full 500 WO / 2,000 Realisasi!
   */
  static async syncDelta(forceFull: boolean = false): Promise<{
    success: boolean;
    isDelta: boolean;
    woChanged: number;
    realisasiChanged: number;
    totalProcessed: number;
    lastSyncTime: string;
    error?: string;
  }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        isDelta: false,
        woChanged: 0,
        realisasiChanged: 0,
        totalProcessed: 0,
        lastSyncTime: this.getLastSyncTime() || 'Offline',
        error: 'Perangkat sedang offline.',
      };
    }

    const previousSyncTime = forceFull ? null : this.getLastSyncTime();
    const currentSyncTime = getLocalDateTimeString();
    const unitId = InisiasiService.getSelectedUnitId();

    try {
      // 1. Process pending offline mutation queue first
      await offlineSyncQueue.processQueue();

      // 2. Fetch Delta or Full Work Orders
      const woRes = await ApiService.fetchWorkOrders(unitId);

      let woChanged = 0;
      if (woRes.success && Array.isArray(woRes.data) && woRes.data.length > 0) {
        woChanged = woRes.data.length;
        await dexieDb.work_orders.bulkPut(
          woRes.data.map((wo) => ({
            ...wo,
            syncStatus: 'SYNCED',
            updatedAt: wo.updatedAt || currentSyncTime,
          }))
        );
      }

      // 3. Fetch Delta or Full Realisasi
      const relRes = await ApiService.fetchRealisasi({
        unitId,
        page: 1,
        limit: 100,
      });

      let realisasiChanged = 0;
      if ((relRes.status === 'success' || (relRes as any).success) && Array.isArray(relRes.data) && relRes.data.length > 0) {
        realisasiChanged = relRes.data.length;
        const existingLocalList = await dexieDb.realisasi.toArray();
        const existingLocalMap = new Map(existingLocalList.map((r) => [r.id || r.localId, r]));

        const verifiedItems = relRes.data.map((item) => {
          const itemId = item.id || item.syncId || `REL-${Date.now()}`;
          const existing = existingLocalMap.get(itemId);
          let finalNomorWo = item.nomorWO;
          let finalWoId = item.workOrderId;

          if (existing) {
            // Check for unauthorized mutation of historical data
            const isValid = auditRealisasiMutation(
              existing,
              item,
              'SyncService.syncDelta',
              'Background / Manual Sync delta fetch'
            );
            if (!isValid) {
              // Preserve original immutable fields
              finalNomorWo = existing.nomorWO || item.nomorWO;
              finalWoId = existing.workOrderId || item.workOrderId;
            }
          }

          return {
            id: itemId,
            localId: itemId,
            serverId: item.id,
            idempotencyKey: item.syncId || item.id,
            unitId: item.unitId || unitId || '',
            nomorWO: finalNomorWo,
            ulpName: item.ulpName || '',
            reguName: item.reguName || '',
            petugasId: item.petugasId || '',
            petugasName: item.petugasName || '',
            noTiang: item.noTiang || '',
            tanggalRealisasi: item.tanggalRealisasi,
            jenisTanaman: item.jenisTanaman || '',
            keterangan: item.keterangan || '',
            pertumbuhanTanaman: item.pertumbuhanTanaman || '',
            kendala: item.kendala || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            createdAt: item.createdAt || currentSyncTime,
            updatedAt: currentSyncTime,
            syncStatus: 'SYNCED' as const,
            progressPercent: 100,
            status: item.status || 'Selesai',
            fotoSebelumUrl: item.fotoSebelumUrl,
            fotoSesudahUrl: item.fotoSesudahUrl,
            photosSebelum: item.photosSebelum || [],
            photosSesudah: item.photosSesudah || [],
            workOrderId: finalWoId,
          };
        });

        await dexieDb.realisasi.bulkPut(verifiedItems);
      }

      // 4. Update sync timestamp upon success
      this.setLastSyncTime(currentSyncTime);

      return {
        success: true,
        isDelta: !forceFull && !!previousSyncTime,
        woChanged,
        realisasiChanged,
        totalProcessed: woChanged + realisasiChanged,
        lastSyncTime: currentSyncTime,
      };
    } catch (err: any) {
      console.warn('SyncService.syncDelta error:', err);
      return {
        success: false,
        isDelta: !forceFull && !!previousSyncTime,
        woChanged: 0,
        realisasiChanged: 0,
        totalProcessed: 0,
        lastSyncTime: previousSyncTime || 'Belum tersinkron',
        error: err.message || 'Gagal melakukan sinkronisasi delta.',
      };
    }
  }

  /**
   * Full Data Fetch Baseline for Initial Startup or Reset
   */
  static async fetchAllData(gasUrl?: string, spreadsheetId?: string) {
    try {
      const activeUnitId = InisiasiService.getSelectedUnitId();
      const supaData = await ApiService.fetchAllData(activeUnitId);
      
      const result = {
        masterData: {
          users: supaData.masterData.users || [],
          ulp: supaData.masterData.ulp || [],
          penyulang: supaData.masterData.penyulang || [],
          regu: supaData.masterData.regu || [],
          petugas: supaData.masterData.petugas || []
        },
        workOrders: supaData.workOrders || [],
        realisasi: supaData.realisasi || [],
        absensi: (supaData as any).absensi || [],
        errors: []
      };

      try {
        const cacheResult = { ...result, workOrders: [] };
        localStorage.setItem('aphro_cached_synced_data', JSON.stringify(cacheResult));
      } catch (e) {
        // ignore storage quota errors
      }

      this.setLastSyncTime(getLocalDateTimeString());

      return result;
    } catch (err: any) {
      console.warn('SyncService fetchAllData error:', err);
      return {
        masterData: { users: [], ulp: [], penyulang: [], regu: [], petugas: [] },
        workOrders: [],
        realisasi: [],
        absensi: [],
        errors: [err.message || 'Gagal memuat data dari Supabase']
      };
    }
  }
}

