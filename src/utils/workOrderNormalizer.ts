import { WorkOrder } from '../types';
import { parseDateFromNomorWO, normalizeDateISO, getWIBDateString, getLocalDateTimeString } from './dateUtils';
import { parseNumeric } from './metricUtils';

export function normalizeWorkOrderRow(row: any): WorkOrder {
  const rawSatuan = String(row.SATUAN || row.satuan || 'KMS').toUpperCase();
  const satuan: 'KMS' | 'GAWANG' = rawSatuan === 'GAWANG' ? 'GAWANG' : 'KMS';
  const rawSatuanRel = String(row.SATUAN_TOTAL_REALISASI || row.satuanTotalRealisasi || 'KMS').toUpperCase();
  const satuanTotalRealisasi: 'KMS' | 'GAWANG' = rawSatuanRel === 'GAWANG' ? 'GAWANG' : 'KMS';

  const rawPenyulang =
    row.penyulangName ??
    row.PENYULANG ??
    row.Penyulang ??
    row.penyulang ??
    row.Nama_Penyulang ??
    row.nama_penyulang ??
    row.NAMA_PENYULANG ??
    row.FE_PENYULANG ??
    row.Feeder ??
    row.feeder ??
    '';

  const rawRegu =
    row.reguName ??
    row.REGU_ROW ??
    row.Regu_ROW ??
    row.regu_row ??
    row.REGU ??
    row.Regu ??
    row.regu ??
    row.Nama_Regu ??
    row.nama_regu ??
    row.NAMA_REGU ??
    '';

  const rawNomorWo = String(row.Nomor_WO || row.nomorWO || row.WO_ID || '').trim();
  const dateFromWo = parseDateFromNomorWO(rawNomorWo);
  const rawTanggal = row.Tanggal ?? row.tanggal;
  let tanggalStr = '';
  if (rawTanggal !== undefined && rawTanggal !== null && String(rawTanggal).trim() !== '' && String(rawTanggal) !== 'null' && String(rawTanggal) !== 'undefined') {
    tanggalStr = normalizeDateISO(rawTanggal);
  }
  if (!tanggalStr && dateFromWo) {
    tanggalStr = dateFromWo;
  }
  if (!tanggalStr) {
    tanggalStr = '';
  }

  const woId = String(row.WO_ID || row.id || row.woId || row.workOrderId || '').trim();

  return {
    id: woId,
    WO_ID: woId,
    unitId: String(row.unitId || ''),
    nomorWO: rawNomorWo,
    Nomor_WO: rawNomorWo,
    pekerjaan: (row.PEKERJAAN || row.pekerjaan || 'NORMAL') as 'NORMAL' | 'GOROW',
    tanggal: tanggalStr,
    ulpId: String(row.ulpId || row.ULP_ID || ''),
    ulpName: String(row.ULP || row.ulpName || ''),
    penyulangId: String(row.penyulangId || row.PENYULANG_ID || ''),
    penyulangName: String(rawPenyulang || '').trim(),
    reguId: String(row.reguId || row.REGU_ID || ''),
    reguName: String(rawRegu || '').trim(),
    petugasId: String(row.petugasId || ''),
    petugasName: String(row.petugasName || row.PETUGAS || ''),
    volumePekerjaan: parseNumeric(row.VOLUME || row.volumePekerjaan, 0),
    satuan,
    totalRealisasi: parseNumeric(row.TOTAL_REALISASI || row.totalRealisasi, 0),
    satuanTotalRealisasi,
    woMulai: String(row.WO_MULAI || row.woMulai || ''),
    woAkhir: String(row.WO_AKHIR || row.WO_SELESAI || row.woSelesai || row.woAkhir || ''),
    status: (row.STATUS || row.status || 'BELUM SELESAI') as any,
    progressPercent: parseNumeric(row.progressPercent || row.PROGRESS || 0),
    createdAt: String(row.createdAt || row.CREATED_AT || row.created_at || getLocalDateTimeString()),
  };
}
