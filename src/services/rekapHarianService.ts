/**
 * Service & Model Data untuk Rekap Pekerjaan Harian
 * Menyesuaikan ULP dan TIM ROW dengan Unit Layanan (UL), serta mendukung No. Urut
 */

import { RekapItemData } from '../utils/rekapExportService';
import { Realisasi, ULP, ReguROW, WorkOrder, Penyulang } from '../types';
import { getWOTargetKms, getWORealisasiKms, TARGET_KMS_PER_TIM_ROW } from '../utils/metricUtils';
import { normalizeDateISO } from '../utils/dateUtils';

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
  const cleanStr = (s?: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Helper extract row number (e.g., 'row01', 'USERS 01', 'usr-01', '01' -> 1)
  const extractRowNumber = (s?: string | null): number | null => {
    if (!s) return null;
    const str = String(s).trim();
    const m = str.match(/(?:row|users|user|usr)[-_\s]*0?(\d+)/i) || str.match(/\b0?(\d+)\b/);
    return m ? parseInt(m[1], 10) : null;
  };

  // Filter reguList strictly by active unitKey
  const unitReguList = (reguList || []).filter((r: any) => {
    const rUnitId = r.unitId || r.unit_id || r.ulpId;
    if (!rUnitId) return false;
    return RekapHarianService.normalizeUnitKey(rUnitId) === unitKey;
  });

  // Filter ulpList strictly by active unitKey
  const unitUlpList = (ulpList || []).filter((u: any) => {
    const uUnitId = u.unitId || u.unit_id;
    if (!uUnitId) return false;
    return RekapHarianService.normalizeUnitKey(uUnitId) === unitKey;
  });

  // Determine row number from user identifiers
  const userIdentifier = `${user.userName || ''} ${user.nip || ''} ${user.id || ''} ${user.name || ''} ${user.reguName || ''}`;
  const userRowNum = extractRowNumber(userIdentifier);

  let resolvedReguName: string | null = null;
  let resolvedUlpName: string | null = null;

  // Priority 1: Match row number directly against ACTIVE unit's preset rows (e.g. UL1 row 1 -> TIM ROW 01 Belanti, UL2 row 1 -> TIM ROW 01 Koto Tuo)
  if (userRowNum !== null && userRowNum > 0) {
    const presetRow = preset.rows.find(r => extractRowNumber(r.timRow) === userRowNum) || preset.rows[userRowNum - 1];
    if (presetRow) {
      resolvedReguName = presetRow.timRow;
      resolvedUlpName = presetRow.namaUlp;
    }
  }

  // Priority 2: Check if user.reguName explicitly belongs to active unit's preset rows or unitReguList
  if (!resolvedReguName && user.reguName && user.reguName.trim() !== '' && user.reguName !== 'Belum Ada Regu') {
    const matchedPreset = preset.rows.find(r => cleanStr(r.timRow) === cleanStr(user.reguName));
    const matchedRegu = unitReguList.find(r => cleanStr(r.namaRegu) === cleanStr(user.reguName));
    if (matchedPreset) {
      resolvedReguName = matchedPreset.timRow;
      resolvedUlpName = matchedPreset.namaUlp;
    } else if (matchedRegu) {
      resolvedReguName = matchedRegu.namaRegu;
    }
  }

  // Priority 3: Check if user.name matches any timRow in active unit's preset
  if (!resolvedReguName && user.name) {
    const matchedPreset = preset.rows.find(r => cleanStr(r.timRow) === cleanStr(user.name));
    if (matchedPreset) {
      resolvedReguName = matchedPreset.timRow;
      resolvedUlpName = matchedPreset.namaUlp;
    }
  }

  // Priority 4: Fallback to active unit's primary tim row
  if (!resolvedReguName) {
    resolvedReguName = primaryInfo.reguName;
    resolvedUlpName = primaryInfo.ulpName;
  }

  // Resolve ULP Name for active unit if not set
  if (!resolvedUlpName) {
    const presetRow = preset.rows.find(r => 
      cleanStr(r.timRow) === cleanStr(resolvedReguName) || 
      (userRowNum !== null && extractRowNumber(r.timRow) === userRowNum)
    );
    if (presetRow?.namaUlp) {
      resolvedUlpName = presetRow.namaUlp;
    }
  }

  if (!resolvedUlpName && user.ulpName) {
    const isUlpInActiveUnit = preset.rows.some(r => cleanStr(r.namaUlp) === cleanStr(user.ulpName)) ||
      unitUlpList.some(u => cleanStr(u.namaULP) === cleanStr(user.ulpName));
    if (isUlpInActiveUnit) {
      resolvedUlpName = user.ulpName.trim();
    }
  }

  if (!resolvedUlpName) {
    resolvedUlpName = primaryInfo.ulpName;
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
        const cleanRegu = regu.trim().toUpperCase();
        if (seenRegu.has(cleanRegu)) return;
        seenRegu.add(cleanRegu);
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
        const clean = penyulang.trim().toUpperCase();
        if (seenPenyulang.has(clean)) return;
        seenPenyulang.add(clean);
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

    // Ensure any penyulang found in realisasiList or workOrders that is missing from currentRows is added
    const existingPenyulang = new Set(currentRows.map(r => normalize(r.timRow)));
    const dynamicRows = [...currentRows];

    const addMissingPenyulang = (ulp?: string, penyulang?: string) => {
      if (!penyulang) return;
      const clean = normalize(penyulang);
      if (!existingPenyulang.has(clean)) {
        existingPenyulang.add(clean);
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

    realisasiList?.forEach(r => addMissingPenyulang(r.ulpName, r.penyulangName));
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

      const rowPenyulangClean = normalize(row.timRow); // timRow is used as Nama Penyulang

      // 1. Data Pohon
      if (Array.isArray(realisasiList)) {
        realisasiList.forEach((rel) => {
          if (!rel) return;
          const parts = this.parseDateParts(rel.tanggalRealisasi);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            const relPenyulang = normalize(rel.penyulangName || '');
            
            if (relPenyulang === rowPenyulangClean || relPenyulang.includes(rowPenyulangClean) || rowPenyulangClean.includes(relPenyulang)) {
              const dayKey = String(parts.d).padStart(2, '0');
              if (!updatedDaily[dayKey]) {
                updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const ket = normalize(rel.keterangan || '');
              if (ket === 'TEBANG' || ket.includes('TEBANG')) {
                updatedDaily[dayKey].tebang1++;
              } else if (ket === 'PANGKAS' || ket.includes('PANGKAS') || ket.includes('POTONG')) {
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
          const parts = this.parseDateParts(wo.tanggal);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            const woPenyulang = normalize(wo.penyulangName || '');
            
            if (woPenyulang === rowPenyulangClean || woPenyulang.includes(rowPenyulangClean) || rowPenyulangClean.includes(woPenyulang)) {
              const dayKey = String(parts.d).padStart(2, '0');
              if (!updatedDaily[dayKey]) {
                updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const targetKms = getWOTargetKms(wo);
              const realisasiKms = getWORealisasiKms(wo);

              updatedDaily[dayKey].targetKms += targetKms;
              updatedDaily[dayKey].realisasiKms += realisasiKms;
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
  static parseDateParts(dateStr: any) {
    if (!dateStr) return null;
    const iso = normalizeDateISO(dateStr);
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
    const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const stripPrefix = (s: string) => normalize(s)
      .replace(/^(TIM|REGU|TEAM|KELOMPOK|ULP|UP3|UP4|ROW|REGU_ROW)\s*/gi, '')
      .replace(/^(TIM|REGU|TEAM|KELOMPOK|ULP|UP3|UP4|ROW|REGU_ROW)\s*/gi, '') // Double pass
      .trim();
    const normalizeNumbers = (s: string) => s.replace(/(\d+)/g, (m) => parseInt(m, 10).toString());

    return currentRows.map((row) => {
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

      const rowUlpClean = normalizeNumbers(stripPrefix(row.namaUlp));
      const rowTimClean = normalizeNumbers(stripPrefix(row.timRow));

      // 1. Data Pohon from Realisasi (Process this first to get dates of activity)
      const activityDatesByPenyulang: Record<string, Set<string>> = {};

      if (Array.isArray(realisasiList)) {
        realisasiList.forEach((rel) => {
          if (!rel) return;
          const parts = this.parseDateParts(rel.tanggalRealisasi);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            const relUlp = normalizeNumbers(stripPrefix(rel.ulpName || ''));
            const relTimFull = normalizeNumbers(normalize(rel.reguName || ''));
            const relTimClean = normalizeNumbers(stripPrefix(rel.reguName || ''));
            
            const rowNumMatch = rowTimClean.match(/\d+/);
            const relNumMatch = relTimClean.match(/\d+/);
            
            let matchTim = false;
            if (rowNumMatch && relNumMatch) {
              matchTim = rowNumMatch[0] === relNumMatch[0];
            } else {
              matchTim = relTimFull.includes(rowTimClean) || relTimClean.includes(rowTimClean) || rowTimClean.includes(relTimClean);
            }

            const matchUlp = relUlp.includes(rowUlpClean) || rowUlpClean.includes(relUlp) || relTimFull.includes(rowUlpClean);

            if (matchTim) {
              const dayKey = String(parts.d).padStart(2, '0');
              if (!updatedDaily[dayKey]) {
                updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const ket = normalize(rel.keterangan || '');
              if (ket === 'TEBANG' || ket.includes('TEBANG')) {
                updatedDaily[dayKey].tebang1++;
              } else if (ket === 'PANGKAS' || ket.includes('PANGKAS') || ket.includes('POTONG')) {
                updatedDaily[dayKey].pangkas++;
              }

              // Track dates of activity for each Penyulang to help align KMS
              const penyClean = normalize(rel.penyulangName || 'GENERAL');
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
          const parts = this.parseDateParts(wo.tanggal);
          if (!parts) return;

          if (parts.y === year && parts.m === monthIndex + 1) {
            const woUlp = normalizeNumbers(stripPrefix(wo.ulpName || ''));
            const woTimFull = normalizeNumbers(normalize(wo.reguName || ''));
            const woTimClean = normalizeNumbers(stripPrefix(wo.reguName || ''));
            
            const rowNumMatch = rowTimClean.match(/\d+/);
            const woNumMatch = woTimClean.match(/\d+/);
            
            let matchTim = false;
            if (rowNumMatch && woNumMatch) {
              matchTim = rowNumMatch[0] === woNumMatch[0];
            } else {
              matchTim = woTimFull.includes(rowTimClean) || rowTimClean.includes(woTimClean);
            }

            const matchUlp = woUlp.includes(rowUlpClean) || rowUlpClean.includes(woUlp) || woTimFull.includes(rowUlpClean);

            if (matchTim) {
              let targetDayKey = String(parts.d).padStart(2, '0');

              if (!updatedDaily[targetDayKey]) {
                updatedDaily[targetDayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const targetKms = getWOTargetKms(wo);
              const realisasiKms = getWORealisasiKms(wo);

              updatedDaily[targetDayKey].targetKms += targetKms;
              updatedDaily[targetDayKey].realisasiKms += realisasiKms;
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

