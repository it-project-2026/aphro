import { Realisasi } from '../types';
import { parseDateFromNomorWO, normalizeDateISO, getWIBDateString, getLocalDateTimeString } from './dateUtils';
import { formatDriveViewUrl, formatDriveImageUrl } from './driveUtils';

/**
 * Pure normalization function for Realisasi row objects
 * Converts raw database/API row into standard UI Realisasi object.
 */
export function normalizeRealisasiRow(row: any): Realisasi {
  const rawNoWoCandidate = String(row.Nomor_WO || row.nomor_wo || row.NOMOR_WO || row.nomorWO || '');
  const rawWoIdCandidate = String(row.WO_ID || row.wo_id || row.workOrderId || '');

  // Detect if row was imported with shifted columns (sheet without separate WO_ID column)
  const isShifted = rawNoWoCandidate.toUpperCase().startsWith('ULP') ||
    (rawWoIdCandidate.match(/^M\d+\//i) && !rawNoWoCandidate.match(/^M\d+\//i));

  let rawNoWo = rawNoWoCandidate;
  let rawUlp = String(row.ULP || row.ulp || row.Nama_ULP || '');
  let reguName = String(row.REGU_ROW || row.regu_row || row.Regu || row.REGU || '');
  let penyulangName = String(
    row.PENYULANG || row.Penyulang || row.penyulang ||
    row.PENYULANG_FEEDER || row.Penyulang_Feeder || row.penyulang_feeder ||
    row.Nama_Penyulang || row.nama_penyulang || row.NAMA_PENYULANG ||
    row.FEEDER || row.Feeder || row.feeder ||
    row.penyulangName || row.penyulang_name ||
    ''
  );
  let noTiang = String(row.NO_TIANG || row.No_Tiang || row.no_tiang || '');
  let rawTanggal = row.Tanggal ?? row.TANGGAL ?? row.tanggal ?? row.TANGGAL_REALISASI ?? row.tanggal_realisasi ?? row.TANGGAL_EKSEKUSI ?? row.tanggal_eksekusi;
  let rawFotoSebelum = String(row.FOTO_SEBELUM || row.Foto_Sebelum || row.foto_sebelum || row.FOTO_SEBELUM_URL || '');
  let rawFotoSesudah = String(row.FOTO_SETELAH || row.FOTO_PROSES || row.Foto_Sesudah || row.Foto_Setelah || row.foto_sesudah || row.FOTO_SETELAH_URL || '');
  let jenisTanaman = String(row.Jenis_Tanaman || row.jenis_tanaman || row.TIPE_POHON || row.tipe_pohon || '');
  let keterangan = String(row.Keterangan || row.keterangan || row.KETERANGAN || '');
  let pertumbuhanTanaman = String(row.Pertumbuhan_Tanaman || row.pertumbuhan_tanaman || '');
  let kendala = String(row.Kendala || row.kendala || '');
  let lokasiKerja = String(row.Lokasi_kerja || row.lokasi_kerja || row.LOKASI_KERJA || row.Lokasi || '');
  let timestampStr = String(row.Timestamp || row.WAKTU || row.Waktu || row.Created_At || row.created_at || getLocalDateTimeString());
  let lat = Number(row.LATITUDE ?? row.latitude ?? row.lat) || 0;
  let lng = Number(row.LONGITUDE ?? row.longitude ?? row.lng) || 0;

  if (isShifted) {
    rawNoWo = rawWoIdCandidate;
    rawUlp = rawNoWoCandidate;
    reguName = String(row.ULP || '');
    penyulangName = String(row.REGU_ROW || '');
    noTiang = String(row.PENYULANG || '');
    rawTanggal = row.NO_TIANG || rawTanggal;
    rawFotoSebelum = String(row.Foto_Sebelum || '');
    rawFotoSesudah = (String(row.Foto_Sesudah || '').includes('http')) ? String(row.Foto_Sesudah) : '';
    jenisTanaman = String(row.Foto_Sesudah || '');
    keterangan = String(row.Jenis_Tanaman || 'PANGKAS');
    pertumbuhanTanaman = String(row.Keterangan || 'SEDANG');
    kendala = String(row.Pertumbuhan_Tanaman || 'Tidak Ada Kendala');
    if (String(row.Kendala || '').includes(',')) {
      const parts = String(row.Kendala).split(',');
      lat = Number(parts[0].trim()) || 0;
      lng = Number(parts[1].trim()) || 0;
    }
    lokasiKerja = String(row.Latitude_Longitude || '');
    timestampStr = String(row.Lokasi_kerja || getLocalDateTimeString());
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

  const fotoSebelumUrl = formatDriveViewUrl(rawFotoSebelum);
  const fotoSesudahUrl = formatDriveViewUrl(rawFotoSesudah);
  const fotoSebelumImg = formatDriveImageUrl(rawFotoSebelum);
  const fotoSesudahImg = formatDriveImageUrl(rawFotoSesudah);

  const relId = String(row.ID || row.id || '');
  if (!relId) {
    throw new Error('REALISASI dari HyperCloud tidak memiliki ID yang valid.');
  }
  let cleanWoId = String(row.WO_ID || row.wo_id || row.workOrderId || '').trim();
  if (cleanWoId === relId || cleanWoId.startsWith('REL-')) {
    cleanWoId = '';
  }

  return {
    id: relId,
    ID: relId,
    unitId: String(row.unitId || ''),
    workOrderId: cleanWoId,
    WO_ID: cleanWoId,
    woId: cleanWoId,
    nomorWO: rawNoWo,
    Nomor_WO: rawNoWo,
    ulpName,
    reguName,
    penyulangName,
    noTiang: String(row.NO_TIANG || row.No_Tiang || row.no_tiang || ''),
    tanggalRealisasi: tanggalStr,
    petugasId: String(
      row.PETUGAS_ID || row.petugasId || row.Petugas_ID || row.NIP || row.nip || ''
    ),
    petugasName: String(
      row.PETUGAS || row.Petugas || row.petugas || row.NAMA_PETUGAS || row.Nama_Petugas || reguName
    ),
    jenisTanaman: String(jenisTanaman || row.TIPE_POHON || row.tipe_pohon || ''),
    pertumbuhanTanaman: String(pertumbuhanTanaman),
    kendala: String(kendala),
    lokasiKerja: String(lokasiKerja),
    latitude: lat,
    longitude: lng,
    keterangan: String(keterangan),
    progressPercent: 100,
    status: 'Selesai',
    fotoSebelumUrl,
    fotoSesudahUrl,
    photosSebelum: fotoSebelumUrl ? [{
      id: `pic-seb-${relId}`,
      type: 'sebelum',
      slotIndex: 1,
      dataUrl: fotoSebelumImg,
      fileUrl: fotoSebelumUrl,
      originalName: 'Foto_Sebelum.jpg',
      timestamp: timestampStr,
      latitude: lat,
      longitude: lng,
      userName: reguName,
      ulpName,
    }] : [],
    photosSesudah: fotoSesudahUrl ? [{
      id: `pic-ses-${relId}`,
      type: 'sesudah',
      slotIndex: 1,
      dataUrl: fotoSesudahImg,
      fileUrl: fotoSesudahUrl,
      originalName: 'Foto_Sesudah.jpg',
      timestamp: timestampStr,
      latitude: lat,
      longitude: lng,
      userName: reguName,
      ulpName,
    }] : [],
    createdAt: timestampStr,
    isSynced: true,
  };
}
