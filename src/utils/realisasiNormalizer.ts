import { Realisasi } from '../types';
import { parseDateFromNomorWO, normalizeDateISO, getWIBDateString, getLocalDateTimeString } from './dateUtils';
import { formatDriveViewUrl, formatDriveImageUrl } from './driveUtils';

/**
 * Pure normalization function for Realisasi row objects
 * Converts raw database/API row into standard UI Realisasi object.
 */
export function normalizeRealisasiRow(row: any): Realisasi {
  if (!row || typeof row !== 'object') {
    throw new Error('Data REALISASI tidak valid.');
  }

  const relId = String(row.id || row.ID || row.realisasiId || '').trim();
  if (!relId) {
    throw new Error('REALISASI dari HyperCloud tidak memiliki ID yang valid.');
  }

  const rawNoWoCandidate = String(
    row.Nomor_WO || row.nomorWO || row.nomor_wo || row.NOMOR_WO || ''
  ).trim();
  const rawWoIdCandidate = String(
    row.WO_ID || row.workOrderId || row.woId || row.wo_id || ''
  ).trim();

  // Detect if row was imported with shifted columns (sheet without separate WO_ID column)
  // Only detect shifted if row is raw database format (has not been normalized before)
  const isAlreadyNormalized = Boolean(
    row.tanggalRealisasi && (row.fotoSebelumUrl !== undefined || row.photosSebelum !== undefined)
  );

  const isShifted =
    !isAlreadyNormalized &&
    (rawNoWoCandidate.toUpperCase().startsWith('ULP') ||
      (rawWoIdCandidate.match(/^M\d+\//i) && !rawNoWoCandidate.match(/^M\d+\//i)));

  let rawNoWo = rawNoWoCandidate;
  let rawUlp = String(row.ulpName || row.ULP || row.ulp || row.Nama_ULP || row.namaUlp || '').trim();
  let reguName = String(
    row.reguName || row.REGU_ROW || row.Regu_ROW || row.regu_row || row.Regu || row.REGU || row.regu || ''
  ).trim();
  let penyulangName = String(
    row.penyulangName ||
    row.PENYULANG ||
    row.Penyulang ||
    row.penyulang ||
    row.PENYULANG_FEEDER ||
    row.Penyulang_Feeder ||
    row.penyulang_feeder ||
    row.Nama_Penyulang ||
    row.nama_penyulang ||
    row.NAMA_PENYULANG ||
    row.FEEDER ||
    row.Feeder ||
    row.feeder ||
    row.penyulang_name ||
    ''
  ).trim();
  let noTiang = String(row.noTiang || row.NO_TIANG || row.No_Tiang || row.no_tiang || '').trim();
  let rawTanggal =
    row.tanggalRealisasi ??
    row.TANGGAL ??
    row.Tanggal ??
    row.tanggal ??
    row.TANGGAL_REALISASI ??
    row.tanggal_realisasi ??
    row.TANGGAL_EKSEKUSI ??
    row.tanggal_eksekusi;
  let rawFotoSebelum = String(
    row.fotoSebelumUrl ||
    row.fotoSebelum ||
    row.Foto_Sebelum ||
    row.foto_sebelum ||
    row.FOTO_SEBELUM ||
    row.FOTO_SEBELUM_URL ||
    (Array.isArray(row.photosSebelum) && row.photosSebelum[0]?.dataUrl) ||
    (Array.isArray(row.photosSebelum) && row.photosSebelum[0]?.fileUrl) ||
    ''
  ).trim();
  let rawFotoSesudah = String(
    row.fotoSesudahUrl ||
    row.fotoSesudah ||
    row.Foto_Sesudah ||
    row.Foto_Setelah ||
    row.foto_sesudah ||
    row.FOTO_SETELAH ||
    row.FOTO_PROSES ||
    row.FOTO_SETELAH_URL ||
    (Array.isArray(row.photosSesudah) && row.photosSesudah[0]?.dataUrl) ||
    (Array.isArray(row.photosSesudah) && row.photosSesudah[0]?.fileUrl) ||
    ''
  ).trim();
  let jenisTanaman = String(
    row.jenisTanaman || row.Jenis_Tanaman || row.jenis_tanaman || row.TIPE_POHON || row.tipe_pohon || ''
  ).trim();
  let keterangan = String(
    row.keterangan || row.Keterangan || row.KETERANGAN || row.jenisPekerjaan || row.PEKERJAAN || row.pekerjaan || ''
  ).trim();
  let pertumbuhanTanaman = String(
    row.pertumbuhanTanaman || row.Pertumbuhan_Tanaman || row.pertumbuhan_tanaman || ''
  ).trim();
  let kendala = String(row.kendala || row.Kendala || '').trim();
  let lokasiKerja = String(
    row.lokasiKerja || row.Lokasi_kerja || row.lokasi_kerja || row.LOKASI_KERJA || row.Lokasi || ''
  ).trim();
  let timestampStr = String(
    row.timestamp || row.Timestamp || row.WAKTU || row.Waktu || row.createdAt || row.Created_At || row.created_at || getLocalDateTimeString()
  ).trim();
  let lat = Number(row.latitude ?? row.LATITUDE ?? row.lat) || 0;
  let lng = Number(row.longitude ?? row.LONGITUDE ?? row.lng) || 0;

  if (isShifted) {
    rawNoWo = rawWoIdCandidate;
    rawUlp = rawNoWoCandidate;
    reguName = String(row.ULP || row.ulpName || '');
    penyulangName = String(row.REGU_ROW || row.reguName || '');
    noTiang = String(row.PENYULANG || row.noTiang || '');
    rawTanggal = row.NO_TIANG || rawTanggal;
    rawFotoSebelum = String(row.Foto_Sebelum || row.fotoSebelumUrl || '');
    rawFotoSesudah = (String(row.Foto_Sesudah || row.fotoSesudahUrl || '').includes('http')) ? String(row.Foto_Sesudah || row.fotoSesudahUrl) : '';
    jenisTanaman = String(row.Foto_Sesudah || row.jenisTanaman || '');
    keterangan = String(row.Jenis_Tanaman || row.keterangan || 'PANGKAS');
    pertumbuhanTanaman = String(row.Keterangan || row.pertumbuhanTanaman || 'SEDANG');
    kendala = String(row.Pertumbuhan_Tanaman || row.kendala || 'Tidak Ada Kendala');
    if (String(row.Kendala || '').includes(',')) {
      const parts = String(row.Kendala).split(',');
      lat = Number(parts[0].trim()) || 0;
      lng = Number(parts[1].trim()) || 0;
    }
    lokasiKerja = String(row.Latitude_Longitude || row.lokasiKerja || '');
    timestampStr = String(row.Lokasi_kerja || timestampStr || getLocalDateTimeString());
  }

  if (!lat && !lng) {
    const latLngStr = String(row.Latitude_Longitude || row.latitude_longitude || row.LATITUDE_LONGITUDE || '');
    if (latLngStr.includes(',')) {
      const parts = latLngStr.split(',');
      lat = Number(parts[0].trim()) || 0;
      lng = Number(parts[1].trim()) || 0;
    }
  }

  if (rawUlp.toUpperCase().startsWith('UL UL ')) {
    rawUlp = rawUlp.replace(/^UL\s*UL\s*/i, 'UL ');
  }
  const ulpName = rawUlp;

  const dateFromWo = parseDateFromNomorWO(rawNoWo);
  let tanggalStr = '';
  if (rawTanggal !== undefined && rawTanggal !== null && String(rawTanggal).trim() !== '' && String(rawTanggal) !== 'null' && String(rawTanggal) !== 'undefined') {
    tanggalStr = normalizeDateISO(rawTanggal);
  }
  if (!tanggalStr && dateFromWo) {
    tanggalStr = dateFromWo;
  }
  if (!tanggalStr) {
    tanggalStr = normalizeDateISO(timestampStr) || getWIBDateString();
  }

  // Format Foto:
  // 1. Image URL langsung (formatDriveImageUrl) untuk tag <img src="..." />
  // 2. Browser view URL (formatDriveViewUrl) untuk buka tab baru Google Drive
  const fotoSebelumImg = formatDriveImageUrl(rawFotoSebelum);
  const fotoSesudahImg = formatDriveImageUrl(rawFotoSesudah);
  const fotoSebelumView = formatDriveViewUrl(rawFotoSebelum);
  const fotoSesudahView = formatDriveViewUrl(rawFotoSesudah);

  // Jadikan fotoSebelumUrl sebagai direct image CDN URL agar tag <img> langsung tampil
  const fotoSebelumUrl = fotoSebelumImg || fotoSebelumView || rawFotoSebelum;
  const fotoSesudahUrl = fotoSesudahImg || fotoSesudahView || rawFotoSesudah;

  let cleanWoId = String(row.WO_ID || row.workOrderId || row.woId || row.wo_id || '').trim();
  if (cleanWoId === relId || cleanWoId.startsWith('REL-')) {
    cleanWoId = '';
  }

  const existingPhotosSebelum = Array.isArray(row.photosSebelum) && row.photosSebelum.length > 0 ? row.photosSebelum : null;
  const existingPhotosSesudah = Array.isArray(row.photosSesudah) && row.photosSesudah.length > 0 ? row.photosSesudah : null;

  return {
    id: relId,
    ID: relId,
    unitId: String(row.unitId || row.unitID || ''),
    workOrderId: cleanWoId,
    WO_ID: cleanWoId,
    woId: cleanWoId,
    nomorWO: rawNoWo,
    Nomor_WO: rawNoWo,
    ulpName,
    reguName,
    penyulangName,
    noTiang,
    tanggalRealisasi: tanggalStr,
    petugasId: String(
      row.petugasId || row.PETUGAS_ID || row.Petugas_ID || row.NIP || row.nip || ''
    ),
    petugasName: String(
      row.petugasName || row.PETUGAS || row.Petugas || row.petugas || row.NAMA_PETUGAS || row.Nama_Petugas || reguName
    ),
    jenisTanaman: String(jenisTanaman || row.TIPE_POHON || row.tipe_pohon || ''),
    pertumbuhanTanaman: String(pertumbuhanTanaman || 'SEDANG'),
    kendala: String(kendala || 'Tidak Ada Kendala'),
    lokasiKerja: String(lokasiKerja || ''),
    latitude: lat,
    longitude: lng,
    keterangan: String(keterangan || 'PANGKAS'),
    progressPercent: typeof row.progressPercent === 'number' ? row.progressPercent : 100,
    status: row.status || 'Selesai',
    fotoSebelumUrl,
    fotoSesudahUrl,
    photosSebelum: existingPhotosSebelum || (fotoSebelumUrl ? [{
      id: `pic-seb-${relId}`,
      type: 'sebelum',
      slotIndex: 1,
      dataUrl: fotoSebelumImg || fotoSebelumUrl,
      fileUrl: fotoSebelumView || fotoSebelumUrl,
      originalName: 'Foto_Sebelum.jpg',
      timestamp: timestampStr,
      latitude: lat,
      longitude: lng,
      userName: reguName,
      ulpName,
    }] : []),
    photosSesudah: existingPhotosSesudah || (fotoSesudahUrl ? [{
      id: `pic-ses-${relId}`,
      type: 'sesudah',
      slotIndex: 1,
      dataUrl: fotoSesudahImg || fotoSesudahUrl,
      fileUrl: fotoSesudahView || fotoSesudahUrl,
      originalName: 'Foto_Sesudah.jpg',
      timestamp: timestampStr,
      latitude: lat,
      longitude: lng,
      userName: reguName,
      ulpName,
    }] : []),
    createdAt: timestampStr,
    isSynced: row.isSynced !== undefined ? row.isSynced : true,
  };
}
