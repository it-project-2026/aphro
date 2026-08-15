import { GASApiService } from './gasApiService';
import { User, UserRole, WorkOrder, ULP, Penyulang, ReguROW, Petugas } from '../types';
import { formatDriveViewUrl, formatDriveImageUrl } from '../utils/driveUtils';

export function normalizeUser(u: any): User {
  if (!u || typeof u !== 'object') {
    return {
      id: 'usr-' + Math.random().toString(36).substring(2, 7),
      nip: 'usr-unknown',
      name: 'Unknown User',
      email: 'user@pln.co.id',
      role: 'User'
    };
  }

  const id = String(u.id || u.UserID || u.User_ID || u.ID || u.NIP || u.nip || u.Username || u.username || 'usr-' + Math.random().toString(36).substring(2, 7));
  const nip = String(u.nip || u.NIP || u.Username || u.username || u.UserID || u.id || id);
  const name = String(u.name || u.Nama || u.Name || u.Username || u.username || u.NIP || u.nip || id);
  const userName = String(u.userName || u.Username || u.username || name);
  const password = String(u.password || u.Password || u.PASSWORD || u.pass || u.Pass || u.KataSandi || u.kataSandi || u.KATA_SANDI || '');
  const email = String(u.email || u.Email || `${userName.toLowerCase().replace(/[^a-z0-9]/g, '')}@pln.co.id`);
  
  const rawRole = String(u.role || u.Role || 'User').trim();
  let role: UserRole = 'User';
  if (/super\s*admin/i.test(rawRole) || /admin\s*utama/i.test(rawRole)) {
    role = 'SuperAdmin';
  } else if (/admin/i.test(rawRole) || /manajer/i.test(rawRole) || /supervisor/i.test(rawRole)) {
    role = 'Admin';
  } else {
    role = 'User';
  }

  const reguName = String(u.reguName || u.NAMA_REGU || u.Nama_Regu || u.NamaRegu || u.Regu_ROW || u.Regu || u.namaRegu || '');
  const ulpName = String(u.ulpName || u.NAMA_ULP || u.Nama_ULP || u.ULP || u.namaULP || '');

  return {
    id,
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
    phone: String(u.phone || u.No_HP || u.Kontak || '')
  };
}

export function normalizeULP(u: any): ULP {
  return {
    id: String(u.id || u.ID || 'ulp-' + Math.random().toString(36).substring(2, 7)),
    kodeULP: String(u.kodeULP || u.Kode_ULP || u.Kode || ''),
    namaULP: String(u.namaULP || u.Nama_ULP || u.ULP || u.Nama || ''),
    manajer: String(u.manajer || u.Manajer || ''),
    kontak: String(u.kontak || u.Kontak || ''),
    alamat: String(u.alamat || u.Alamat || ''),
    status: (u.status === 'Non-Aktif' || u.status === 'Nonaktif' || u.Status === 'Non-Aktif' ? 'Non-Aktif' : 'Aktif'),
  };
}

export function normalizePenyulang(p: any): Penyulang {
  const rawStatus = String(p.status || p.Status || 'Normal');
  let status: 'Normal' | 'Rawan Hazard' | 'Maintenance' = 'Normal';
  if (/hazard/i.test(rawStatus)) status = 'Rawan Hazard';
  else if (/maintenance|maint/i.test(rawStatus)) status = 'Maintenance';

  return {
    id: String(p.id || p.ID || 'pyl-' + Math.random().toString(36).substring(2, 7)),
    kodePenyulang: String(p.kodePenyulang || p.Kode_Penyulang || p.Kode || 'PYL-01'),
    namaPenyulang: String(p.namaPenyulang || p.Nama_Penyulang || p.Penyulang || p.Nama || ''),
    ulpId: String(p.ulpId || p.ULPId || ''),
    ulpName: String(p.ulpName || p.ULP || p.Nama_ULP || ''),
    panjangKms: Number(p.panjangKms || p.Panjang_Kms || 0),
    jumlahTrafo: Number(p.jumlahTrafo || p.Jumlah_Trafo || 0),
    status,
  };
}

export function normalizeRegu(r: any): ReguROW {
  return {
    id: String(r.id || r.ID || 'rgu-' + Math.random().toString(36).substring(2, 7)),
    kodeRegu: String(r.kodeRegu || r.Kode_Regu || r.Kode || ''),
    namaRegu: String(r.namaRegu || r.Nama_Regu || r.Regu_ROW || r.Regu || ''),
    penanggungJawab: String(r.penanggungJawab || r.PenanggungJawab || r.Kontak || ''),
    ulpId: String(r.ulpId || r.ULPId || ''),
    ulpName: String(r.ulpName || r.ULP || r.Nama_ULP || ''),
    jumlahAnggota: Number(r.jumlahAnggota || r.Jumlah_Anggota || 0),
    kontak: String(r.kontak || r.Kontak || ''),
    status: (r.status === 'Non-Aktif' || r.status === 'Nonaktif' || r.Status === 'Non-Aktif' ? 'Non-Aktif' : 'Aktif'),
  };
}

export function normalizePetugas(p: any): Petugas {
  const rawRole = String(p.role || p.Role || 'User').trim();
  let role: UserRole = 'User';
  if (/super\s*admin/i.test(rawRole)) role = 'SuperAdmin';
  else if (/admin/i.test(rawRole)) role = 'Admin';

  return {
    id: String(p.id || p.ID || 'ptg-' + Math.random().toString(36).substring(2, 7)),
    nip: String(p.nip || p.NIP || p.id || p.ID || ''),
    nama: String(p.nama || p.Nama || p.Petugas || ''),
    reguId: String(p.reguId || p.ReguID || ''),
    reguName: String(p.reguName || p.Regu || p.Nama_Regu || ''),
    ulpId: String(p.ulpId || p.ULPId || ''),
    ulpName: String(p.ulpName || p.ULP || p.Nama_ULP || ''),
    noHp: String(p.noHp || p.nomorHP || p.Nomor_HP || p.Kontak || ''),
    role,
    status: (p.status === 'Non-Aktif' || p.status === 'Nonaktif' || p.Status === 'Non-Aktif' ? 'Non-Aktif' : 'Aktif'),
  };
}

export function normalizeWorkOrder(w: any): WorkOrder {
  const rawSatuan = String(w.satuan || w.SATUAN || 'KMS').toUpperCase();
  const satuan: 'KMS' | 'GAWANG' = rawSatuan === 'GAWANG' ? 'GAWANG' : 'KMS';

  return {
    id: String(w.id || w.WO_ID || w.ID || 'wo-' + Math.random().toString(36).substring(2, 7)),
    pekerjaan: (w.pekerjaan || w.PEKERJAAN || 'NORMAL') as 'NORMAL' | 'GOROW',
    nomorWO: String(w.nomorWO || w.NOMOR_WO || w.Nomor_WO || w.WO_Number || w.id || w.WO_ID || ''),
    tanggal: String(w.tanggal || w.TANGGAL || w.Tanggal || new Date().toISOString().slice(0, 10)),
    ulpId: String(w.ulpId || w.ULPId || w.ULP_ID || ''),
    ulpName: String(w.ulpName || w.NAMA_ULP || w.Nama_ULP || w.ULP || ''),
    penyulangId: String(w.penyulangId || w.PenyulangId || ''),
    penyulangName: String(w.penyulangName || w.NAMA_PENYULANG || w.Nama_Penyulang || w.Penyulang || ''),
    reguId: String(w.reguId || w.ReguId || w.REGU_ID || ''),
    reguName: String(w.reguName || w.NAMA_REGU || w.Nama_Regu || w.Regu_ROW || w.Regu || ''),
    volumePekerjaan: Number(w.volumePekerjaan || w.VOLUME || w.Volume || w.volume || 0),
    satuan,
    status: (w.status || w.STATUS || 'Belum Dikerjakan'),
    deskripsi: String(w.deskripsi || w.DESKRIPSI || w.Deskripsi || ''),
    jenisPekerjaan: w.jenisPekerjaan || w.JENIS_PEKERJAAN || w.Jenis_Pekerjaan || w.Kategori || 'Pemangkasan Pohon (ROW)',
    prioritas: w.prioritas || w.PRIORITAS || w.Prioritas || 'Sedang',
    lokasi: String(w.lokasi || w.LOKASI || w.Lokasi || ''),
    petugasName: String(w.petugasName || w.PETUGAS || w.Petugas || w.NAMA_PETUGAS || ''),
    progressPercent: Number(w.progressPercent || w.PROGRESS || w.progress || w.Progress || 0),
    createdAt: String(w.createdAt || w.Created_At || new Date().toISOString()),
  };
}

export function normalizeAbsensi(a: any): any {
  if (!a || typeof a !== 'object') {
    return {
      id: 'abs-' + Math.random().toString(36).substring(2, 7),
      tanggal: new Date().toISOString().slice(0, 10),
      reguName: '',
      ulpName: '',
      petugasList: [],
      createdAt: new Date().toISOString(),
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
          keterangan: (String(kVal).includes('TIDAK') ? 'TIDAK HADIR' : String(kVal).includes('SAKIT') ? 'SAKIT' : String(kVal).includes('IZIN') ? 'IZIN' : 'HADIR'),
        });
      }
    }
  }

  return {
    ...a,
    id: String(a.id || a.ID || a.ABS_ID || 'abs-' + Math.random().toString(36).substring(2, 7)),
    tanggal: String(a.tanggal || a.TANGGAL || a.Tanggal || new Date().toISOString().slice(0, 10)),
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
    createdAt: String(a.createdAt || a.CREATED_AT || a.Created_At || new Date().toISOString()),
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

  return {
    id: String(r.id || r.WO_ID || 'rel-' + Math.random().toString(36).substring(2, 7)),
    workOrderId: String(r.WO_ID || r.workOrderId || r.id || ''),
    nomorWO: String(r.Nomor_WO || r.nomorWO || r.NO_WO || ''),
    ulpName: String(r.ULP || r.ulpName || ''),
    reguName: String(r.REGU_ROW || r.reguName || r.REGU || ''),
    penyulangName: String(r.PENYULANG || r.penyulangName || ''),
    noTiang: String(r.NO_TIANG || r.noTiang || ''),
    tanggalRealisasi: String(r.TANGGAL || r.tanggalRealisasi || new Date().toISOString().slice(0, 10)),
    petugasId: String(r.petugasId || 'usr-3'),
    petugasName: String(r.Petugas || r.petugasName || r.REGU_ROW || ''),
    jenisTanaman: String(r.Jenis_Tanaman || r.jenisTanaman || ''),
    pertumbuhanTanaman: String(r.Pertumbuhan_Tanaman || r.pertumbuhanTanaman || ''),
    kendala: String(r.Kendala || r.kendala || ''),
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
    createdAt: String(r.Timestamp || r.createdAt || new Date().toISOString()),
  };
}

export class SyncService {
  static async withRetry<T>(fn: () => Promise<T>, retries = 1, delay = 300): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.withRetry(fn, retries - 1, delay);
    }
  }

  static async fetchAllData(gasUrl: string) {
    try {
      // Try bulk fetch with minimal retry delay
      const response = await this.withRetry(() => GASApiService.fetchAllData(gasUrl), 1, 300);
      
      if (response.status === 'success' && response.data) {
        const d = response.data;
        const usersList = Array.isArray(d.USERS) ? d.USERS.map(normalizeUser) : [];
        const ulpList = Array.isArray(d.ULP) ? d.ULP.map(normalizeULP) : [];
        const penyulangList = Array.isArray(d.PENYULANG) ? d.PENYULANG.map(normalizePenyulang) : [];
        const reguList = Array.isArray(d.REGU_ROW) ? d.REGU_ROW.map(normalizeRegu) : [];
        const petugasList = Array.isArray(d.PETUGAS) ? d.PETUGAS.map(normalizePetugas) : [];
        const workOrdersList = Array.isArray(d.WORK_ORDER) ? d.WORK_ORDER.map(normalizeWorkOrder) : [];
        const realisasiList = Array.isArray(d.REALISASI) ? d.REALISASI.map(normalizeRealisasi) : [];

        const result = {
          masterData: {
            users: usersList,
            ulp: ulpList,
            penyulang: penyulangList,
            regu: reguList,
            petugas: petugasList
          },
          workOrders: workOrdersList,
          realisasi: realisasiList,
          absensi: Array.isArray(d.ABSENSI) ? d.ABSENSI.map(normalizeAbsensi) : [],
          errors: []
        };

        // Cache in localStorage for instant future loads
        try {
          localStorage.setItem('aphro_cached_synced_data', JSON.stringify(result));
        } catch (e) {
          // ignore quote quota errors
        }

        return result;
      }
      throw new Error(response.message || 'Bulk fetch failed');
    } catch (err: any) {
      // Fallback to individual parallel fetches if bulk fetch fails
      console.warn('Bulk fetch failed, trying fast parallel fetches...', err);
      const results = await Promise.allSettled([
        this.withRetry(() => GASApiService.fetchUsers(gasUrl), 1, 200),
        this.withRetry(() => GASApiService.fetchWorkOrders(gasUrl), 1, 200),
        this.withRetry(() => GASApiService.fetchRealisasi(gasUrl), 1, 200),
        this.withRetry(() => GASApiService.fetchAbsensi(gasUrl), 1, 200),
        this.withRetry(() => GASApiService.fetchMasterData(gasUrl, 'getULP'), 1, 200),
        this.withRetry(() => GASApiService.fetchMasterData(gasUrl, 'getPenyulang'), 1, 200),
        this.withRetry(() => GASApiService.fetchMasterData(gasUrl, 'getRegu'), 1, 200),
        this.withRetry(() => GASApiService.fetchMasterData(gasUrl, 'getPetugas'), 1, 200),
      ]);

      const errors = results.filter(r => r.status === 'rejected');

      const rawUsers = results[0].status === 'fulfilled' && Array.isArray(results[0].value.data) ? results[0].value.data : [];
      const rawWo = results[1].status === 'fulfilled' && Array.isArray(results[1].value.data) ? results[1].value.data : [];
      const rawRel = results[2].status === 'fulfilled' && Array.isArray(results[2].value.data) ? results[2].value.data : [];
      const rawUlp = results[4].status === 'fulfilled' && Array.isArray(results[4].value.data) ? results[4].value.data : [];
      const rawPyl = results[5].status === 'fulfilled' && Array.isArray(results[5].value.data) ? results[5].value.data : [];
      const rawRegu = results[6].status === 'fulfilled' && Array.isArray(results[6].value.data) ? results[6].value.data : [];
      const rawPtg = results[7].status === 'fulfilled' && Array.isArray(results[7].value.data) ? results[7].value.data : [];

      const result = {
        masterData: {
          users: rawUsers.map(normalizeUser),
          ulp: rawUlp.map(normalizeULP),
          penyulang: rawPyl.map(normalizePenyulang),
          regu: rawRegu.map(normalizeRegu),
          petugas: rawPtg.map(normalizePetugas),
        },
        workOrders: rawWo.map(normalizeWorkOrder),
        realisasi: rawRel.map(normalizeRealisasi),
        absensi: results[3].status === 'fulfilled' && Array.isArray(results[3].value.data) ? results[3].value.data.map(normalizeAbsensi) : [],
        errors: errors
      };

      try {
        localStorage.setItem('aphro_cached_synced_data', JSON.stringify(result));
      } catch (e) {
        // ignore
      }

      return result;
    }
  }
}

