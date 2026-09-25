/**
 * Service & Model Data untuk Rekap Pekerjaan Harian
 * Menyesuaikan ULP dan TIM ROW dengan Unit Layanan (UL), serta mendukung No. Urut
 */

import { RekapItemData } from '../utils/rekapExportService';
import { Realisasi, ULP, ReguROW, WorkOrder, Penyulang } from '../types';
import { getWOTargetKms, getWORealisasiKms, TARGET_KMS_PER_TIM_ROW } from '../utils/metricUtils';
import { normalizeDateISO, parseDateFromNomorWO, getItemDateISO } from '../utils/dateUtils';

/**
 * Helper canonical key untuk pencocokan REGU
 * - collapse multiple whitespace into single space
 * - trim, lowercase
 * - buang prefiks tim/regu/team/kelompok/row
 */
export function getCanonicalReguKey(s?: string): string {
  if (!s) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(tim|regu|team|kelompok|regu_row|tim_row)\s+/gi, '')
    .replace(/^(row)\s+/gi, '')
    .replace(/\b0+(\d+)\b/g, '$1')
    .trim();
}

/**
 * Helper canonical key untuk pencocokan PENYULANG
 * Toleran terhadap "F. Cingkariang", "F.Cingkariang", "Cingkariang", "CINGKARIANG"
 */
export function getCanonicalPenyulangKey(s?: string): string {
  if (!s) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(f\.\s*|f\s+|feeder\s+|penyulang\s+)/gi, '')
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper klasifikasi KETERANGAN (TEBANG vs PANGKAS)
 * Toleran terhadap whitespace, lowercase, UPPERCASE
 */
export function classifyKeteranganPohon(s?: string): 'TEBANG' | 'PANGKAS' {
  if (!s) return 'PANGKAS';
  const clean = String(s).trim().toUpperCase().replace(/\s+/g, ' ');
  if (
    clean.includes('TEBANG') ||
    clean.includes('TEB') ||
    clean.includes('TBG') ||
    clean === 'T' ||
    clean.includes('TEBANGAN')
  ) {
    return 'TEBANG';
  }
  return 'PANGKAS';
}

/**
 * Robust Action Classifier for Realisasi item
 * Checks keterangan, Keterangan, jenisPekerjaan, PEKERJAAN, jenisTanaman, and pertumbuhanTanaman
 */
export function classifyRealisasiAction(rel: any): 'TEBANG' | 'PANGKAS' {
  if (!rel) return 'PANGKAS';

  // 1. Primary: Keterangan
  const ket = String(
    rel.keterangan ||
    rel.Keterangan ||
    rel.KETERANGAN ||
    ''
  ).trim().toUpperCase().replace(/\s+/g, ' ');

  if (ket) {
    if (ket.includes('TEBANG') || ket.includes('TBG') || ket === 'T' || ket.includes('TEBANGAN')) {
      return 'TEBANG';
    }
    if (ket.includes('PANGKAS') || ket.includes('POTONG') || ket.includes('RABAS')) {
      return 'PANGKAS';
    }
  }

  // 2. Secondary: jenisPekerjaan / PEKERJAAN
  const pek = String(
    rel.jenisPekerjaan ||
    rel.PEKERJAAN ||
    rel.pekerjaan ||
    ''
  ).trim().toUpperCase().replace(/\s+/g, ' ');

  if (pek) {
    if (pek.includes('TEBANG') || pek.includes('TBG')) {
      return 'TEBANG';
    }
    if (pek.includes('PANGKAS') || pek.includes('POTONG') || pek.includes('RABAS')) {
      return 'PANGKAS';
    }
  }

  // 3. Fallback for legacy shifted sheet records (where column values shifted into Jenis_Tanaman or Pertumbuhan_Tanaman)
  const jenisTanaman = String(
    rel.jenisTanaman ||
    rel.Jenis_Tanaman ||
    rel.jenis_tanaman ||
    ''
  ).trim().toUpperCase().replace(/\s+/g, ' ');

  if (jenisTanaman) {
    if (jenisTanaman.includes('TEBANG') || jenisTanaman.includes('TBG')) {
      return 'TEBANG';
    }
    if (jenisTanaman.includes('PANGKAS') || jenisTanaman.includes('POTONG')) {
      return 'PANGKAS';
    }
  }

  const pertumbuhan = String(
    rel.pertumbuhanTanaman ||
    rel.Pertumbuhan_Tanaman ||
    ''
  ).trim().toUpperCase().replace(/\s+/g, ' ');

  if (pertumbuhan) {
    if (pertumbuhan.includes('TEBANG') || pertumbuhan.includes('TBG')) {
      return 'TEBANG';
    }
    if (pertumbuhan.includes('PANGKAS')) {
      return 'PANGKAS';
    }
  }

  // 4. Default to PANGKAS if record exists
  return 'PANGKAS';
}

export interface ULConfigPreset {
  kodeUL: string;
  namaUL: string;
  rows: Array<{
    namaUlp: string;
    timRow: string;
    target: number;
    kodeUnit?: string;
  }>;
}

export const UL_PRESETS: Record<string, ULConfigPreset> = {
  BUKITTINGGI: {
    kodeUL: 'BKT',
    namaUL: 'UL BUKITTINGGI',
    rows: [
      { namaUlp: 'ULP KOTO TUO', timRow: 'TIM ROW 01 Koto Tuo', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13227' },
      { namaUlp: 'ULP BASO', timRow: 'TIM ROW 02 Baso', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13226' },
      { namaUlp: 'ULP BUKITTINGGI', timRow: 'TIM ROW 03 Bukittinggi Kota', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13221' },
      { namaUlp: 'ULP PADANG PANJANG', timRow: 'TIM ROW 04 Padang Panjang', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13222' },
      { namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 05 Lubuk Basung 1', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13224' },
      { namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 06 Lubuk Basung 2', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13224' },
      { namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 07 Lubuk Sikaping 1', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13223' },
      { namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 08 Lubuk Sikaping 2', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13223' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 09 Simpang Empat 1', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13225' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 10 Simpang Empat 2', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13225' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 11 Simpang Empat 3', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13225' },
    ],
  },
  PADANG: {
    kodeUL: 'PDG',
    namaUL: 'UL PADANG',
    rows: [
      { namaUlp: 'ULP BELANTI', timRow: 'TIM ROW 01 Belanti', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13211' },
      { namaUlp: 'ULP PADANG BARAT', timRow: 'TIM ROW 02 Padang Barat', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13211' },
      { namaUlp: 'ULP INDARUNG', timRow: 'TIM ROW 03 Indarung', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13212' },
      { namaUlp: 'ULP KURANJI', timRow: 'TIM ROW 04 Kuranji', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13213' },
      { namaUlp: 'ULP TABING', timRow: 'TIM ROW 05 Tabing', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13214' },
      { namaUlp: 'ULP LUBUK BEGALUNG', timRow: 'TIM ROW 06 Lubuk Begalung', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13215' },
      { namaUlp: 'ULP PARIAMAN', timRow: 'TIM ROW 07 Pariaman', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13216' },
      { namaUlp: 'ULP SICINCIN', timRow: 'TIM ROW 08 Sicincin', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13217' },
      { namaUlp: 'ULP LUBUK ALUNG', timRow: 'TIM ROW 09 Lubuk Alung', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13218' },
      { namaUlp: 'ULP PAINAN', timRow: 'TIM ROW 10 Painan', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13219' },
      { namaUlp: 'ULP BALAI SELASA', timRow: 'TIM ROW 11 Balai Selasa', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13210' },
      { namaUlp: 'ULP KAMBANG', timRow: 'TIM ROW 12 Kambang', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13219' },
      { namaUlp: 'ULP MENTAWAI', timRow: 'TIM ROW 13 Mentawai', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13210' },
      { namaUlp: 'ULP TUAPEJAT', timRow: 'TIM ROW 14 Tuapejat', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13210' },
      { namaUlp: 'ULP SIKABALUAN', timRow: 'TIM ROW 15 Sikabaluan', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13210' },
      { namaUlp: 'ULP SIOBAN', timRow: 'TIM ROW 16 Sioban', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13210' },
    ],
  },
  PAYAKUMBUH: {
    kodeUL: 'PYK',
    namaUL: 'UL PAYAKUMBUH',
    rows: [
      { namaUlp: 'ULP PAYAKUMBUH KOTA', timRow: 'TIM ROW 01 Payakumbuh Kota', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13231' },
      { namaUlp: 'ULP LIMA PULUH KOTA', timRow: 'TIM ROW 02 Lima Puluh Kota', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13232' },
      { namaUlp: 'ULP SULIKI', timRow: 'TIM ROW 03 Suliki', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13233' },
    ],
  },
  SOLOK: {
    kodeUL: 'SLK',
    namaUL: 'UL SOLOK',
    rows: [
      { namaUlp: 'ULP SOLOK KOTA', timRow: 'TIM ROW 01 Solok Kota', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13241' },
      { namaUlp: 'ULP SAWAHLUNTO', timRow: 'TIM ROW 02 Sawahlunto', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13242' },
      { namaUlp: 'ULP SIJUNJUNG', timRow: 'TIM ROW 03 Sijunjung', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13243' },
      { namaUlp: 'ULP MUARA LABUH', timRow: 'TIM ROW 04 Muara Labuh', target: TARGET_KMS_PER_TIM_ROW, kodeUnit: '13244' },
    ],
  },
};

export const DEFAULT_REKAP_ROWS = UL_PRESETS.BUKITTINGGI.rows.map((r, idx) => ({
  id: `row-${idx + 1}`,
  noUrut: idx + 1,
  kodeUnit: r.kodeUnit || String(13220 + idx + 1),
  namaUlp: r.namaUlp,
  timRow: r.timRow,
  target: r.target,
}));

export function getPrimaryTimRowForUnit(unitNameOrId: string) {
  const key = RekapHarianService.normalizeUnitKey(unitNameOrId);
  const preset = UL_PRESETS[key] || UL_PRESETS.BUKITTINGGI;
  const firstRow = preset.rows[0];
  return {
    name: firstRow.timRow,
    reguName: firstRow.timRow,
    ulpName: firstRow.namaUlp,
  };
}

export function resolveUserTimRowAndUlp(
  user: any,
  unitNameOrId?: string | null,
  masterUsers?: any[],
  ulpList?: any[],
  reguList?: any[]
): { name: string; reguName: string; ulpName: string } {
  // 1. Determine active Inisiasi unit key (prioritizing active unit selection over legacy user.unitId)
  const activeUnitInput =
    unitNameOrId ||
    localStorage.getItem('aphro_nama_unit_layanan') ||
    localStorage.getItem('aphro_selected_unit_id') ||
    user?.unitId ||
    user?.unit_id ||
    'UL PADANG';

  const unitKey = RekapHarianService.normalizeUnitKey(activeUnitInput);
  const primaryInfo = getPrimaryTimRowForUnit(unitKey);
  const preset = UL_PRESETS[unitKey] || UL_PRESETS.PADANG;

  if (!user) {
    return {
      name: primaryInfo.name,
      reguName: primaryInfo.reguName,
      ulpName: primaryInfo.ulpName,
    };
  }

  // 2. Check Admin / Management role
  const roleUpper = (user.role || '').toUpperCase();
  const userNameLower = (user.userName || user.nip || user.id || '').toLowerCase();
  if (roleUpper === 'SUPERADMIN' || roleUpper === 'ADMIN' || roleUpper === 'ADM' || userNameLower === 'admbkt') {
    return {
      name: user.name || user.userName || 'Admin',
      reguName: 'Manajemen/Admin',
      ulpName: user.ulpName || 'SEMUA ULP',
    };
  }

  // Helper clean string
  const cleanStr = (s?: string | null) =>
    (s || '')
      .toLowerCase()
      .trim()
      .replace(/^(regu|tim|petugas|kelompok|regu_row|ulp)\s+/gi, '')
      .replace(/[^a-z0-9]/g, '');

  // Helper extract row number (e.g., 'row01', 'USERS 01', 'usr-01', '01' -> 1, 'row13' -> 13)
  const extractRowNumber = (s?: string | null): number | null => {
    if (!s) return null;
    const str = String(s).trim();
    const m = str.match(/(?:row|users|user|usr)[-_\s]*0?(\d+)/i) || str.match(/\b0?(\d+)\b/);
    return m ? parseInt(m[1], 10) : null;
  };

  // Find matching user from MasterData / USERS table if provided
  const userIdentifier = (user.userName || user.nip || user.id || '').toLowerCase().trim();
  const matchedMaster = (masterUsers || []).find((m: any) => {
    if (!m) return false;
    const mName = (m.userName || '').toLowerCase().trim();
    const mNip = (m.nip || '').toLowerCase().trim();
    const mId = (m.id || '').toLowerCase().trim();
    return Boolean(userIdentifier && (mName === userIdentifier || mNip === userIdentifier || mId === userIdentifier));
  });

  // Extract explicit regu and ulp from user or matchedMaster
  const directReguName = (
    user.reguName ||
    matchedMaster?.reguName ||
    user.namaRegu ||
    matchedMaster?.namaRegu ||
    user.Regu_ROW ||
    matchedMaster?.Regu_ROW ||
    user.Nama_Regu ||
    matchedMaster?.Nama_Regu ||
    user.NAMA_REGU ||
    matchedMaster?.NAMA_REGU ||
    (user.name && user.name.toUpperCase().startsWith('TIM ROW') ? user.name : '') ||
    ''
  ).trim();

  const directUlpName = (
    user.ulpName ||
    matchedMaster?.ulpName ||
    user.namaULP ||
    matchedMaster?.namaULP ||
    user.ULP ||
    matchedMaster?.ULP ||
    user.Nama_ULP ||
    matchedMaster?.Nama_ULP ||
    user.NAMA_ULP ||
    matchedMaster?.NAMA_ULP ||
    ''
  ).trim();

  let resolvedReguName: string | null = null;
  let resolvedUlpName: string | null = null;

  // Filter reguList and ulpList for active unit
  const unitReguList = (reguList || []).filter((r: any) => {
    const rUnitId = r.unitId || r.unit_id || r.ulpId;
    if (!rUnitId) return true;
    return RekapHarianService.normalizeUnitKey(rUnitId) === unitKey;
  });

  const unitUlpList = (ulpList || []).filter((u: any) => {
    const uUnitId = u.unitId || u.unit_id;
    if (!uUnitId) return true;
    return RekapHarianService.normalizeUnitKey(uUnitId) === unitKey;
  });

  // Step 1: If user explicitly has a non-placeholder reguName (e.g. 'TIM ROW 13 MENTAWAI' or 'TIM ROW 01 Belanti')
  if (directReguName && directReguName !== 'Belum Ada Regu' && directReguName !== 'Semua Regu' && directReguName !== '-') {
    resolvedReguName = directReguName;
  }

  // Step 2: If user explicitly has a non-placeholder ulpName (e.g. 'ULP BELANTI' or 'ULP MENTAWAI')
  if (directUlpName && directUlpName !== 'SEMUA ULP' && directUlpName !== 'Semua ULP' && directUlpName !== '-') {
    resolvedUlpName = directUlpName;
  }

  // Step 3: If regu is still missing, try matching by row number or preset
  const userRowNum = extractRowNumber(user.userName) ?? extractRowNumber(user.nip) ?? extractRowNumber(user.id) ?? extractRowNumber(user.name);
  if (!resolvedReguName && userRowNum !== null && userRowNum > 0) {
    const presetRow = preset.rows.find(r => extractRowNumber(r.timRow) === userRowNum) || preset.rows[userRowNum - 1];
    if (presetRow) {
      resolvedReguName = presetRow.timRow;
      if (!resolvedUlpName) {
        resolvedUlpName = presetRow.namaUlp;
      }
    } else {
      const reguMatch = unitReguList.find(r => extractRowNumber(r.namaRegu) === userRowNum);
      if (reguMatch) {
        resolvedReguName = reguMatch.namaRegu;
        if (!resolvedUlpName && reguMatch.ulpName) {
          resolvedUlpName = reguMatch.ulpName;
        }
      }
    }
  }

  // Step 4: If regu is still missing, check if user.name matches any timRow in preset or reguList
  if (!resolvedReguName && user.name) {
    const presetMatch = preset.rows.find(r => cleanStr(r.timRow) === cleanStr(user.name));
    if (presetMatch) {
      resolvedReguName = presetMatch.timRow;
      if (!resolvedUlpName) resolvedUlpName = presetMatch.namaUlp;
    } else {
      const reguMatch = unitReguList.find(r => cleanStr(r.namaRegu) === cleanStr(user.name));
      if (reguMatch) {
        resolvedReguName = reguMatch.namaRegu;
        if (!resolvedUlpName && reguMatch.ulpName) resolvedUlpName = reguMatch.ulpName;
      }
    }
  }

  // Step 5: Fallback regu to primaryInfo for this unit
  if (!resolvedReguName) {
    resolvedReguName = primaryInfo.reguName;
  }

  // Step 6: If ULP is still missing, resolve it from resolvedReguName
  if (!resolvedUlpName) {
    // 6a. Check in active preset
    const presetMatch = preset.rows.find(r => 
      cleanStr(r.timRow) === cleanStr(resolvedReguName) ||
      (extractRowNumber(resolvedReguName) !== null && extractRowNumber(r.timRow) === extractRowNumber(resolvedReguName))
    );
    if (presetMatch?.namaUlp) {
      resolvedUlpName = presetMatch.namaUlp;
    }

    // 6b. Check in reguList
    if (!resolvedUlpName) {
      const reguMatch = unitReguList.find(r => cleanStr(r.namaRegu) === cleanStr(resolvedReguName));
      if (reguMatch?.ulpName) {
        resolvedUlpName = reguMatch.ulpName;
      }
    }

    // 6c. Infer ULP from name in resolvedReguName (e.g., 'TIM ROW 13 MENTAWAI' -> 'ULP MENTAWAI', 'TIM ROW 01 Belanti' -> 'ULP BELANTI')
    if (!resolvedUlpName && resolvedReguName) {
      const parts = resolvedReguName.replace(/^TIM\s*ROW\s*\d+\s*/i, '').trim();
      if (parts && parts.length > 2) {
        const potentialUlpName = parts.toUpperCase().startsWith('ULP') ? parts.toUpperCase() : `ULP ${parts.toUpperCase()}`;
        const matchedUlp = unitUlpList.find(u => cleanStr(u.namaULP) === cleanStr(potentialUlpName)) ||
          preset.rows.find(r => cleanStr(r.namaUlp) === cleanStr(potentialUlpName));
        if (matchedUlp) {
          resolvedUlpName = (matchedUlp as any).namaULP || (matchedUlp as any).namaUlp;
        } else {
          resolvedUlpName = potentialUlpName;
        }
      }
    }

    // 6d. Fallback to primary ULP of active unit
    if (!resolvedUlpName) {
      resolvedUlpName = primaryInfo.ulpName;
    }
  }

  const resolvedUserName: string = user.name && !user.name.toUpperCase().startsWith('TIM ROW')
    ? user.name
    : resolvedReguName || 'Petugas Regu ROW';

  return {
    name: resolvedUserName,
    reguName: resolvedReguName,
    ulpName: resolvedUlpName,
  };
}

export class RekapHarianService {
  /**
   * Normalisasi key Unit Layanan untuk storage dan preset
   */
  static normalizeUnitKey(unitName: string): string {
    const upper = (unitName || '').toUpperCase().trim();
    if (upper.includes('PADANG') || upper === 'UL1' || upper.includes('PDG')) return 'PADANG';
    if (upper.includes('PAYAKUMBUH') || upper === 'UL4' || upper.includes('PYK')) return 'PAYAKUMBUH';
    if (upper.includes('SOLOK') || upper === 'UL3' || upper.includes('SLK')) return 'SOLOK';
    if (upper.includes('BUKITTINGGI') || upper === 'UL2' || upper.includes('BKT')) return 'BUKITTINGGI';
    return upper.replace(/[^A-Z0-9]/g, '_') || 'BUKITTINGGI';
  }

  /**
   * Mendapatkan key penyimpanan localStorage untuk unit, tahun dan bulan tertentu
   */
  static getStorageKey(unitName: string, year: number, monthIndex: number): string {
    const unitKey = this.normalizeUnitKey(unitName);
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    return `aphro_rekap_harian_${unitKey}_${year}_${monthPadded}`;
  }

  /**
   * Menghasilkan struktur baris awal berdasarkan Master Data Spreadsheet (reguList & ulpList) atau preset Unit Layanan
   */
  static getDefaultRowsForUnit(
    unitName: string,
    ulpList?: ULP[],
    reguList?: ReguROW[],
    realisasiList?: Realisasi[],
    workOrders?: WorkOrder[]
  ): Array<{ id: string; noUrut: number; kodeUnit: string; namaUlp: string; timRow: string; target: number }> {
    // 1. PRIORITAS 1: Jika ada realisasiList atau workOrders, ekstrak regu/tim unik dari sana agar semua tim lapangan otomatis masuk ke rekap!
    if ((realisasiList && realisasiList.length > 0) || (workOrders && workOrders.length > 0)) {
      const seenRegu = new Set<string>();
      const rows: Array<{ id: string; noUrut: number; kodeUnit: string; namaUlp: string; timRow: string; target: number }> = [];
      let seq = 1;

      const addRegu = (ulp?: string, regu?: string) => {
        if (!regu) return;
        const cleanRegu = regu.trim().replace(/\s+/g, ' ').toUpperCase();
        const canonKey = getCanonicalReguKey(cleanRegu);
        if (!canonKey || seenRegu.has(canonKey)) return;
        seenRegu.add(canonKey);
        rows.push({
          id: `row-extracted-${seq}`,
          noUrut: seq,
          kodeUnit: `1320${seq}`,
          namaUlp: (ulp || 'ULP UTAMA').toUpperCase(),
          timRow: cleanRegu,
          target: TARGET_KMS_PER_TIM_ROW,
        });
        seq++;
      };

      realisasiList?.forEach(r => addRegu(r.ulpName, r.reguName || r.petugasName));
      workOrders?.forEach(w => addRegu(w.ulpName, w.reguName));

      if (rows.length > 0) {
        return rows;
      }
    }

    // 2. Data Master Regu & ULP yang tersimpan dari Spreadsheet
    if (reguList && reguList.length > 0) {
      const activeRegus = reguList.filter(r => r.status !== 'Non-Aktif');
      const targetRegus = activeRegus.length > 0 ? activeRegus : reguList;
      
      const rows: Array<{ id: string; noUrut: number; kodeUnit: string; namaUlp: string; timRow: string; target: number }> = [];
      let seq = 1;

      if (ulpList && ulpList.length > 0) {
        // Kelompokkan Regu berdasarkan ULP
        ulpList.forEach((ulp) => {
          const matchingRegus = targetRegus.filter((r) => {
            if (r.ulpId && r.ulpId === ulp.id) return true;
            if (r.ulpName && (
              r.ulpName.toLowerCase() === ulp.namaULP.toLowerCase() ||
              r.ulpName.toLowerCase().includes(ulp.namaULP.toLowerCase()) ||
              ulp.namaULP.toLowerCase().includes(r.ulpName.toLowerCase())
            )) {
              return true;
            }
            return false;
          });

          matchingRegus.forEach((regu) => {
            rows.push({
              id: `row-regu-${regu.id || seq}`,
              noUrut: seq,
              kodeUnit: ulp.kodeULP || `1320${seq}`,
              namaUlp: (regu.ulpName || ulp.namaULP).toUpperCase(),
              timRow: regu.namaRegu,
              target: TARGET_KMS_PER_TIM_ROW,
            });
            seq++;
          });
        });

        // Tambahkan regu yang belum terpetakan ke ulpList
        const matchedReguNames = new Set(rows.map(r => r.timRow));
        targetRegus.forEach((regu) => {
          if (!matchedReguNames.has(regu.namaRegu)) {
            const resolvedUlpName = regu.ulpName || (regu.ulpId ? ulpList.find(u => u.id === regu.ulpId)?.namaULP : '') || 'ULP TERKAIT';
            rows.push({
              id: `row-regu-${regu.id || seq}`,
              noUrut: seq,
              kodeUnit: `1320${seq}`,
              namaUlp: resolvedUlpName.toUpperCase(),
              timRow: regu.namaRegu,
              target: TARGET_KMS_PER_TIM_ROW,
            });
            seq++;
          }
        });
      } else {
        // Jika belum ada ulpList, tampilkan langsung dari reguList
        targetRegus.forEach((regu) => {
          rows.push({
            id: `row-regu-${regu.id || seq}`,
            noUrut: seq,
            kodeUnit: `1320${seq}`,
            namaUlp: (regu.ulpName || 'ULP UTAMA').toUpperCase(),
            timRow: regu.namaRegu,
            target: TARGET_KMS_PER_TIM_ROW,
          });
          seq++;
        });
      }

      if (rows.length > 0) {
        return rows;
      }
    }

    // 3. Jika master data belum terisi, gunakan preset Unit Layanan
    const unitKey = this.normalizeUnitKey(unitName);
    if (UL_PRESETS[unitKey]) {
      return UL_PRESETS[unitKey].rows.map((r, idx) => ({
        id: `row-${unitKey.toLowerCase()}-${idx + 1}`,
        noUrut: idx + 1,
        kodeUnit: r.kodeUnit || String(13200 + idx + 1),
        namaUlp: r.namaUlp,
        timRow: r.timRow,
        target: r.target,
      }));
    }

    // 4. Fallback bawaan
    return DEFAULT_REKAP_ROWS;
  }

  /**
   * Menghasilkan struktur baris awal berdasarkan Master Data Penyulang
   */
  static getDefaultRowsForPenyulang(
    unitName: string,
    ulpList?: ULP[],
    penyulangList?: Penyulang[],
    realisasiList?: Realisasi[],
    workOrders?: WorkOrder[]
  ): Array<{ id: string; noUrut: number; kodeUnit: string; namaUlp: string; timRow: string; target: number }> {
    if (penyulangList && penyulangList.length > 0) {
      const rows: Array<{ id: string; noUrut: number; kodeUnit: string; namaUlp: string; timRow: string; target: number }> = [];
      let seq = 1;

      penyulangList.forEach((p) => {
        rows.push({
          id: `row-penyulang-${p.id || seq}`,
          noUrut: seq,
          kodeUnit: p.kodePenyulang || `PYL-${seq}`,
          namaUlp: (p.ulpName || 'ULP TERKAIT').toUpperCase(),
          timRow: p.namaPenyulang,
          target: TARGET_KMS_PER_TIM_ROW,
        });
        seq++;
      });

      if (rows.length > 0) return rows;
    }

    // Jika penyulangList kosong, ekstrak dari realisasiList & workOrders
    if ((realisasiList && realisasiList.length > 0) || (workOrders && workOrders.length > 0)) {
      const seenPenyulang = new Set<string>();
      const rows: Array<{ id: string; noUrut: number; kodeUnit: string; namaUlp: string; timRow: string; target: number }> = [];
      let seq = 1;

      const addPenyulang = (ulp?: string, penyulang?: string) => {
        if (!penyulang) return;
        const clean = penyulang.trim().replace(/\s+/g, ' ').toUpperCase();
        const canonKey = getCanonicalPenyulangKey(clean);
        if (!canonKey || seenPenyulang.has(canonKey)) return;
        seenPenyulang.add(canonKey);
        rows.push({
          id: `row-penyulang-ext-${seq}`,
          noUrut: seq,
          kodeUnit: `PYL-${seq}`,
          namaUlp: (ulp || 'ULP UTAMA').toUpperCase(),
          timRow: clean,
          target: TARGET_KMS_PER_TIM_ROW,
        });
        seq++;
      };

      realisasiList?.forEach(r => addPenyulang(r.ulpName, r.penyulangName));
      workOrders?.forEach(w => addPenyulang(w.ulpName, w.penyulangName));

      if (rows.length > 0) return rows;
    }

    return [];
  }

  /**
   * Memuat data Rekap Penyulang dari LocalStorage atau menginisialisasi
   */
  static loadRekapPenyulangData(
    unitName: string,
    year: number,
    monthIndex: number,
    realisasiList?: Realisasi[],
    ulpList?: ULP[],
    penyulangList?: Penyulang[],
    workOrders?: WorkOrder[]
  ): RekapItemData[] {
    const unitKey = this.normalizeUnitKey(unitName);
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    const key = `aphro_rekap_penyulang_${unitKey}_${year}_${monthPadded}`;
    
    let rows: RekapItemData[] = [];
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rows = parsed;
        }
      }
    } catch {
      // Ignore parse errors, fallback to default
    }

    if (rows.length === 0) {
      const defaultRows = this.getDefaultRowsForPenyulang(unitName, ulpList, penyulangList, realisasiList, workOrders);
      rows = defaultRows.map((def, idx) => ({
        id: def.id,
        noUrut: idx + 1,
        kodeUnit: def.kodeUnit,
        namaUlp: def.namaUlp,
        timRow: def.timRow,
        target: def.target,
        keterangan: '',
        dailyValues: {},
      }));
    }

    if ((realisasiList && realisasiList.length > 0) || (workOrders && workOrders.length > 0)) {
      rows = this.syncFromDataByPenyulang(year, monthIndex, rows, realisasiList || [], workOrders || []);
    }

    return rows.map((r, idx) => ({ ...r, noUrut: idx + 1 }));
  }

  /**
   * Sinkronisasi data KMS dan Pohon berdasarkan PENYULANG
   */
  static syncFromDataByPenyulang(
    year: number,
    monthIndex: number,
    currentRows: RekapItemData[],
    realisasiList: Realisasi[],
    workOrders: WorkOrder[]
  ): RekapItemData[] {
    const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toUpperCase();

    const existingPenyulang = new Set(currentRows.map(r => getCanonicalPenyulangKey(r.timRow)));
    const dynamicRows = [...currentRows];

    const addMissingPenyulang = (ulp?: string, penyulang?: string) => {
      if (!penyulang) return;
      const cleanCanon = getCanonicalPenyulangKey(penyulang);
      if (!cleanCanon) return;
      if (!existingPenyulang.has(cleanCanon)) {
        existingPenyulang.add(cleanCanon);
        dynamicRows.push({
          id: `row-peny-dyn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          noUrut: dynamicRows.length + 1,
          kodeUnit: `PYL-${dynamicRows.length + 1}`,
          namaUlp: (ulp || 'ULP UTAMA').toUpperCase(),
          timRow: penyulang.trim().toUpperCase(),
          target: TARGET_KMS_PER_TIM_ROW,
          keterangan: '',
          dailyValues: {}
        });
      }
    };

    // Build Work Order maps for fallback penyulang resolution
    const woMapById: Record<string, WorkOrder> = {};
    const woMapByNo: Record<string, WorkOrder> = {};
    if (Array.isArray(workOrders)) {
      workOrders.forEach((w) => {
        if (w.id) woMapById[w.id] = w;
        if (w.nomorWO) woMapByNo[w.nomorWO] = w;
      });
    }

    realisasiList?.forEach(r => {
      let peny = r.penyulangName || (r as any).Penyulang || (r as any).PENYULANG || (r as any).Nama_Penyulang || '';
      if (!peny || peny === '-' || peny === 'null') {
        const matchedWo = woMapById[r.workOrderId] || woMapByNo[r.nomorWO];
        if (matchedWo?.penyulangName) peny = matchedWo.penyulangName;
      }
      addMissingPenyulang(r.ulpName, peny);
    });
    workOrders?.forEach(w => addMissingPenyulang(w.ulpName, w.penyulangName));

    return dynamicRows.map((row) => {
      const updatedDaily = { ...row.dailyValues };
      
      // Reset
      for (let i = 1; i <= 31; i++) {
        const dayKey = String(i).padStart(2, '0');
        updatedDaily[dayKey] = {
          tebang1: 0,
          pangkas: 0,
          tebang2: 0,
          targetKms: 0,
          realisasiKms: 0
        };
      }

      const rowPenyulangCanon = getCanonicalPenyulangKey(row.timRow);

      // 1. Data Pohon
      if (Array.isArray(realisasiList)) {
        realisasiList.forEach((rel) => {
          if (!rel) return;
          const parts = this.parseDateParts(rel.tanggalRealisasi || rel);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            let relPenyulangRaw =
              rel.penyulangName ||
              (rel as any).PENYULANG ||
              (rel as any).Penyulang ||
              (rel as any).penyulang ||
              (rel as any).Nama_Penyulang ||
              (rel as any).feeder ||
              (rel as any).FEEDER ||
              '';
            if (!relPenyulangRaw || relPenyulangRaw === '-' || relPenyulangRaw === 'null') {
              const matchedWo = woMapById[rel.workOrderId] || woMapByNo[rel.nomorWO];
              if (matchedWo?.penyulangName) relPenyulangRaw = matchedWo.penyulangName;
            }
            const relPenyulangCanon = getCanonicalPenyulangKey(relPenyulangRaw);
            
            let matchPenyulang = false;
            if (relPenyulangCanon && rowPenyulangCanon) {
              matchPenyulang =
                relPenyulangCanon === rowPenyulangCanon ||
                relPenyulangCanon.includes(rowPenyulangCanon) ||
                rowPenyulangCanon.includes(relPenyulangCanon);
            }

            if (matchPenyulang) {
              const dayKey = String(parts.d).padStart(2, '0');
              if (!updatedDaily[dayKey]) {
                updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const action = classifyRealisasiAction(rel);
              if (action === 'TEBANG') {
                updatedDaily[dayKey].tebang1++;
              } else {
                updatedDaily[dayKey].pangkas++;
              }
            }
          }
        });
      }

      // 2. Data KMS
      if (Array.isArray(workOrders)) {
        workOrders.forEach((wo) => {
          if (!wo) return;
          const parts = this.parseDateParts(wo.tanggal || wo);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            const woPenyulangCanon = getCanonicalPenyulangKey(wo.penyulangName || (wo as any).Penyulang || (wo as any).PENYULANG || '');
            
            if (woPenyulangCanon && rowPenyulangCanon && (
              woPenyulangCanon === rowPenyulangCanon ||
              woPenyulangCanon.includes(rowPenyulangCanon) ||
              rowPenyulangCanon.includes(woPenyulangCanon)
            )) {
              const dayKey = String(parts.d).padStart(2, '0');
              if (!updatedDaily[dayKey]) {
                updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const targetKms = getWOTargetKms(wo);
              const realisasiKms = getWORealisasiKms(wo);

              updatedDaily[dayKey].targetKms += targetKms;
              updatedDaily[dayKey].realisasiKms += realisasiKms;

              // Also aggregate TEBANG and PANGKAS if defined on Work Order level
              const normPekerjaan = String(wo.pekerjaan || (wo as any).PEKERJAAN || wo.jenisPekerjaan || '').trim().toUpperCase();
              if (normPekerjaan === 'TEBANG' || normPekerjaan.includes('TEBANG')) {
                const vol = Number(wo.volumePekerjaan || (wo as any).VOLUME || 1);
                updatedDaily[dayKey].tebang1 += (isNaN(vol) ? 1 : vol);
              } else if (normPekerjaan === 'PANGKAS' || normPekerjaan.includes('PANGKAS')) {
                const vol = Number(wo.volumePekerjaan || (wo as any).VOLUME || 1);
                updatedDaily[dayKey].pangkas += (isNaN(vol) ? 1 : vol);
              }
            }
          }
        });
      }

      return { ...row, dailyValues: updatedDaily };
    });
  }

  /**
   * Menyimpan data Rekap Penyulang ke LocalStorage
   */
  static saveRekapPenyulangData(unitName: string, year: number, monthIndex: number, data: RekapItemData[]): void {
    const unitKey = this.normalizeUnitKey(unitName);
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    const key = `aphro_rekap_penyulang_${unitKey}_${year}_${monthPadded}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Ignore localStorage write error
    }
  }

  /**
   * Menyelaraskan baris rekap dengan Master Data (Spreadsheet) sambil mempertahankan data pekerjaan harian yang sudah diinput
   */
  static syncWithMasterData(
    unitName: string,
    currentRows: RekapItemData[],
    ulpList?: ULP[],
    reguList?: ReguROW[]
  ): RekapItemData[] {
    const defaultMasterRows = this.getDefaultRowsForUnit(unitName, ulpList, reguList);
    
    // Petakan nilai yang sudah ada berdasarkan timRow atau namaUlp
    return defaultMasterRows.map((defRow, idx) => {
      const existing = currentRows.find((c) => 
        c.timRow.toLowerCase().trim() === defRow.timRow.toLowerCase().trim() ||
        (c.id && c.id === defRow.id)
      );

      return {
        id: defRow.id,
        noUrut: idx + 1,
        kodeUnit: defRow.kodeUnit,
        namaUlp: defRow.namaUlp,
        timRow: defRow.timRow,
        target: existing?.target || defRow.target,
        keterangan: existing?.keterangan || '',
        dailyValues: existing?.dailyValues || {},
      };
    });
  }

  /**
   * Memuat data Rekap dari LocalStorage atau menginisialisasi dari data Realisasi aplikasi
   */
  static loadRekapData(
    unitName: string,
    year: number,
    monthIndex: number,
    realisasiList?: Realisasi[],
    ulpList?: ULP[],
    reguList?: ReguROW[],
    workOrders?: WorkOrder[]
  ): RekapItemData[] {
    const key = this.getStorageKey(unitName, year, monthIndex);
    
    // Coba load key spesifik unit
    let rows: RekapItemData[] = [];
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rows = parsed;
        }
      }
    } catch {
      // Ignore parse errors, fallback to default
    }

    // Jika belum ada data tersimpan, inisialisasi dari default
    if (rows.length === 0) {
      const defaultRows = this.getDefaultRowsForUnit(unitName, ulpList, reguList, realisasiList, workOrders);
      rows = defaultRows.map((def, idx) => ({
        id: def.id,
        noUrut: idx + 1,
        kodeUnit: def.kodeUnit,
        namaUlp: def.namaUlp,
        timRow: def.timRow,
        target: def.target,
        keterangan: '',
        dailyValues: {},
      }));
    }

    // SELALU jalankan sync otomatis jika ada data referensi (realisasiList/workOrders)
    // agar data selalu mutakhir dengan entri lapangan
    if ((realisasiList && realisasiList.length > 0) || (workOrders && workOrders.length > 0)) {
      rows = this.syncFromData(year, monthIndex, rows, realisasiList || [], workOrders || []);
    }

    return rows.map((r, idx) => ({ ...r, noUrut: idx + 1 }));
  }

  /**
   * Menyimpan data Rekap ke LocalStorage
   */
  static saveRekapData(unitName: string, year: number, monthIndex: number, data: RekapItemData[]): void {
    const key = this.getStorageKey(unitName, year, monthIndex);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Ignore localStorage write error
    }
  }

  /**
   * Helper to parse date parts from various formats accurately
   * Uses unified normalizeDateISO logic
   */
  static parseDateParts(dateInput: any) {
    if (!dateInput) return null;
    let dateStr = '';
    if (typeof dateInput === 'string' || typeof dateInput === 'number') {
      dateStr = String(dateInput);
    } else if (typeof dateInput === 'object') {
      dateStr = dateInput.tanggalRealisasi || dateInput.tanggal || dateInput.Tanggal || dateInput.TANGGAL || dateInput.createdAt || dateInput.Created_At || dateInput.timestamp || '';
      if (!dateStr && dateInput.nomorWO) {
        dateStr = parseDateFromNomorWO(dateInput.nomorWO) || '';
      }
    }

    const iso = normalizeDateISO(dateStr) || (typeof dateInput === 'string' ? parseDateFromNomorWO(dateInput) : null);
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-').map(Number);
      return { y, m, d };
    }
    return null;
  }

  /**
   * Sinkronisasi data dari Realisasi dan Work Orders
   */
  static syncFromData(
    year: number,
    monthIndex: number,
    currentRows: RekapItemData[],
    realisasiList: Realisasi[],
    workOrders: WorkOrder[]
  ): RekapItemData[] {
    // Dynamically include any teams from realisasi or workOrders that are not in currentRows
    const existingTeams = new Set(currentRows.map(r => getCanonicalReguKey(r.timRow)));
    const dynamicRows = [...currentRows];

    const addMissingTeam = (ulp?: string, regu?: string) => {
      if (!regu) return;
      const cleanKey = getCanonicalReguKey(regu);
      if (!cleanKey) return;
      if (!existingTeams.has(cleanKey)) {
        existingTeams.add(cleanKey);
        dynamicRows.push({
          id: `row-team-dyn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          noUrut: dynamicRows.length + 1,
          kodeUnit: `1320${dynamicRows.length + 1}`,
          namaUlp: (ulp || 'ULP UTAMA').toUpperCase(),
          timRow: regu.trim().toUpperCase(),
          target: TARGET_KMS_PER_TIM_ROW,
          keterangan: '',
          dailyValues: {}
        });
      }
    };

    realisasiList?.forEach(r => addMissingTeam(r.ulpName, r.reguName || r.petugasName));
    workOrders?.forEach(w => addMissingTeam(w.ulpName, w.reguName));

    return dynamicRows.map((row) => {
      const updatedDaily = { ...row.dailyValues };
      
      // Reset ALL days for the current month
      for (let i = 1; i <= 31; i++) {
        const dayKey = String(i).padStart(2, '0');
        updatedDaily[dayKey] = {
          tebang1: 0,
          pangkas: 0,
          tebang2: 0,
          targetKms: 0,
          realisasiKms: 0
        };
      }

      const rowUlpCanon = getCanonicalReguKey(row.namaUlp);
      const rowTimCanon = getCanonicalReguKey(row.timRow);

      // 1. Data Pohon from Realisasi (Process this first to get dates of activity)
      const activityDatesByPenyulang: Record<string, Set<string>> = {};

      if (Array.isArray(realisasiList)) {
        realisasiList.forEach((rel) => {
          if (!rel) return;
          const parts = this.parseDateParts(rel.tanggalRealisasi || rel);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            const relUlpRaw = rel.ulpName || (rel as any).ULP || (rel as any).Nama_ULP || '';
            const relUlpCanon = getCanonicalReguKey(relUlpRaw);
            const relReguRaw = rel.reguName || (rel as any).REGU_ROW || (rel as any).Regu || (rel as any).petugasName || '';
            const relTimCanon = getCanonicalReguKey(relReguRaw);
            
            const rowNumMatch = rowTimCanon.match(/\d+/);
            const relNumMatch = relTimCanon.match(/\d+/);
            
            let matchTim = false;
            if (rowTimCanon && relTimCanon) {
              if (
                relTimCanon === rowTimCanon ||
                relTimCanon.includes(rowTimCanon) ||
                rowTimCanon.includes(relTimCanon)
              ) {
                matchTim = true;
              } else if (rowNumMatch && relNumMatch) {
                const matchUlp = !relUlpCanon || !rowUlpCanon || relUlpCanon.includes(rowUlpCanon) || rowUlpCanon.includes(relUlpCanon) || relTimCanon.includes(rowUlpCanon);
                if (matchUlp) {
                  matchTim = parseInt(rowNumMatch[0], 10) === parseInt(relNumMatch[0], 10);
                }
              }
            }

            if (matchTim) {
              const dayKey = String(parts.d).padStart(2, '0');
              if (!updatedDaily[dayKey]) {
                updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const action = classifyRealisasiAction(rel);
              if (action === 'TEBANG') {
                updatedDaily[dayKey].tebang1++;
              } else {
                updatedDaily[dayKey].pangkas++;
              }

              // Track dates of activity for each Penyulang to help align KMS
              const penyClean = getCanonicalPenyulangKey(rel.penyulangName || (rel as any).Penyulang || 'GENERAL');
              if (!activityDatesByPenyulang[penyClean]) activityDatesByPenyulang[penyClean] = new Set();
              activityDatesByPenyulang[penyClean].add(dayKey);
            }
          }
        });
      }

      // 2. Data KMS from Work Order
      if (Array.isArray(workOrders)) {
        workOrders.forEach((wo) => {
          if (!wo) return;
          const parts = this.parseDateParts(wo.tanggal || wo);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            const woUlpCanon = getCanonicalReguKey(wo.ulpName || (wo as any).ULP || '');
            const woTimCanon = getCanonicalReguKey(wo.reguName || (wo as any).REGU_ROW || (wo as any).Regu || '');
            
            const rowNumMatch = rowTimCanon.match(/\d+/);
            const woNumMatch = woTimCanon.match(/\d+/);
            
            let matchTim = false;
            if (rowTimCanon && woTimCanon) {
              if (
                woTimCanon === rowTimCanon ||
                woTimCanon.includes(rowTimCanon) ||
                rowTimCanon.includes(woTimCanon)
              ) {
                matchTim = true;
              } else if (rowNumMatch && woNumMatch) {
                const matchUlp = !woUlpCanon || !rowUlpCanon || woUlpCanon.includes(rowUlpCanon) || rowUlpCanon.includes(woUlpCanon) || woTimCanon.includes(rowUlpCanon);
                if (matchUlp) {
                  matchTim = parseInt(rowNumMatch[0], 10) === parseInt(woNumMatch[0], 10);
                }
              }
            }

            if (matchTim) {
              let targetDayKey = String(parts.d).padStart(2, '0');

              if (!updatedDaily[targetDayKey]) {
                updatedDaily[targetDayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const targetKms = getWOTargetKms(wo);
              const realisasiKms = getWORealisasiKms(wo);

              updatedDaily[targetDayKey].targetKms += targetKms;
              updatedDaily[targetDayKey].realisasiKms += realisasiKms;

              // Also aggregate TEBANG and PANGKAS if defined on Work Order level
              const normPekerjaan = String(wo.pekerjaan || (wo as any).PEKERJAAN || wo.jenisPekerjaan || '').trim().toUpperCase();
              if (normPekerjaan === 'TEBANG' || normPekerjaan.includes('TEBANG')) {
                const vol = Number(wo.volumePekerjaan || (wo as any).VOLUME || 1);
                updatedDaily[targetDayKey].tebang1 += (isNaN(vol) ? 1 : vol);
              } else if (normPekerjaan === 'PANGKAS' || normPekerjaan.includes('PANGKAS')) {
                const vol = Number(wo.volumePekerjaan || (wo as any).VOLUME || 1);
                updatedDaily[targetDayKey].pangkas += (isNaN(vol) ? 1 : vol);
              }
            }
          }
        });
      }

      return { ...row, dailyValues: updatedDaily };
    });
  }

  /**
   * Legacy method for backward compatibility if needed
   */
  static syncFromRealisasi(
    year: number,
    monthIndex: number,
    currentRows: RekapItemData[],
    realisasiList: Realisasi[]
  ): RekapItemData[] {
    return this.syncFromData(year, monthIndex, currentRows, realisasiList, []);
  }
}

