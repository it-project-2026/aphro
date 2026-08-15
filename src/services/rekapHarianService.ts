/**
 * Service & Model Data untuk Rekap Pekerjaan Harian
 * Menyesuaikan ULP dan TIM ROW dengan Unit Layanan (UL), serta mendukung No. Urut
 */

import { RekapItemData } from '../utils/rekapExportService';
import { Realisasi, ULP, ReguROW } from '../types';

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
      { namaUlp: 'ULP BUKITTINGGI', timRow: 'TIM ROW 3', target: 200, kodeUnit: '13221' },
      { namaUlp: 'ULP PADANG PANJANG', timRow: 'TIM ROW 4', target: 200, kodeUnit: '13222' },
      { namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 7', target: 150, kodeUnit: '13223' },
      { namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 8', target: 150, kodeUnit: '13223' },
      { namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 5', target: 180, kodeUnit: '13224' },
      { namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 6', target: 180, kodeUnit: '13224' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 9', target: 150, kodeUnit: '13225' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 10', target: 150, kodeUnit: '13225' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 11', target: 150, kodeUnit: '13225' },
      { namaUlp: 'ULP BASO', timRow: 'TIM ROW 2', target: 200, kodeUnit: '13226' },
      { namaUlp: 'ULP KOTO TUO', timRow: 'TIM ROW 1', target: 200, kodeUnit: '13227' },
    ],
  },
  PADANG: {
    kodeUL: 'PDG',
    namaUL: 'UL PADANG',
    rows: [
      { namaUlp: 'ULP PADANG BARAT', timRow: 'Regu ROW Alpha (Tim Utama)', target: 200, kodeUnit: '13211' },
      { namaUlp: 'ULP PADANG BARAT', timRow: 'Regu ROW Charlie (Rapid Response)', target: 200, kodeUnit: '13211' },
      { namaUlp: 'ULP INDARUNG', timRow: 'Regu ROW Bravo (Tim Indarung)', target: 200, kodeUnit: '13212' },
      { namaUlp: 'ULP KURANJI', timRow: 'Regu ROW Alpha (Tim Utama)', target: 200, kodeUnit: '13213' },
      { namaUlp: 'ULP TABING', timRow: 'Regu ROW Delta (Tim Tabing)', target: 200, kodeUnit: '13214' },
    ],
  },
  PAYAKUMBUH: {
    kodeUL: 'PYK',
    namaUL: 'UL PAYAKUMBUH',
    rows: [
      { namaUlp: 'ULP PAYAKUMBUH KOTA', timRow: 'TIM ROW 1', target: 200, kodeUnit: '13231' },
      { namaUlp: 'ULP PAYAKUMBUH KOTA', timRow: 'TIM ROW 2', target: 200, kodeUnit: '13231' },
      { namaUlp: 'ULP LIMA PULUH KOTA', timRow: 'TIM ROW 3', target: 180, kodeUnit: '13232' },
      { namaUlp: 'ULP SULIKI', timRow: 'TIM ROW 4', target: 180, kodeUnit: '13233' },
    ],
  },
  SOLOK: {
    kodeUL: 'SLK',
    namaUL: 'UL SOLOK',
    rows: [
      { namaUlp: 'ULP SOLOK KOTA', timRow: 'TIM ROW 1', target: 200, kodeUnit: '13241' },
      { namaUlp: 'ULP SOLOK KOTA', timRow: 'TIM ROW 2', target: 200, kodeUnit: '13241' },
      { namaUlp: 'ULP SAWAHLUNTO', timRow: 'TIM ROW 3', target: 180, kodeUnit: '13242' },
      { namaUlp: 'ULP SIJUNJUNG', timRow: 'TIM ROW 4', target: 180, kodeUnit: '13243' },
      { namaUlp: 'ULP MUARA LABUH', timRow: 'TIM ROW 5', target: 180, kodeUnit: '13244' },
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

export class RekapHarianService {
  /**
   * Normalisasi key Unit Layanan untuk storage dan preset
   */
  static normalizeUnitKey(unitName: string): string {
    const upper = (unitName || '').toUpperCase();
    if (upper.includes('PADANG')) return 'PADANG';
    if (upper.includes('PAYAKUMBUH')) return 'PAYAKUMBUH';
    if (upper.includes('SOLOK')) return 'SOLOK';
    if (upper.includes('BUKITTINGGI')) return 'BUKITTINGGI';
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
    reguList?: ReguROW[]
  ): Array<{ id: string; noUrut: number; kodeUnit: string; namaUlp: string; timRow: string; target: number }> {
    // 1. PRIORITAS UTAMA: Data Master Regu & ULP yang tersimpan dari Spreadsheet
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
              target: 200,
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
              target: 200,
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
            target: 200,
          });
          seq++;
        });
      }

      if (rows.length > 0) {
        return rows;
      }
    }

    // 2. Jika master data belum terisi, gunakan preset Unit Layanan
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

    // 3. Fallback bawaan
    return DEFAULT_REKAP_ROWS;
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
    reguList?: ReguROW[]
  ): RekapItemData[] {
    const key = this.getStorageKey(unitName, year, monthIndex);
    
    // Coba load key spesifik unit
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, idx) => ({
            ...item,
            noUrut: idx + 1,
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved rekap harian:', e);
    }

    // Fallback coba legacy key (tanpa unitKey) jika ada
    const legacyKey = `aphro_rekap_harian_${year}_${String(monthIndex + 1).padStart(2, '0')}`;
    try {
      const legacySaved = localStorage.getItem(legacyKey);
      if (legacySaved && this.normalizeUnitKey(unitName) === 'BUKITTINGGI') {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, idx) => ({
            ...item,
            noUrut: idx + 1,
          }));
        }
      }
    } catch (e) {
      // ignore
    }

    // Inisialisasi awal jika belum ada data tersimpan
    const defaultRows = this.getDefaultRowsForUnit(unitName, ulpList, reguList);
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    const initialRows: RekapItemData[] = defaultRows.map((def, idx) => {
      const dailyValues: Record<string, { tebang1: number; pangkas: number; tebang2: number }> = {};

      // Jika ada realisasiList dari sistem, hitung agregasi otomatis
      if (realisasiList && realisasiList.length > 0) {
        realisasiList.forEach((rel) => {
          if (!rel.tanggalRealisasi) return;
          const [rYear, rMonth, rDay] = rel.tanggalRealisasi.split('-');
          if (Number(rYear) === year && rMonth === monthPadded) {
            // Cek kesesuaian tim atau ULP
            const matchUlp = (rel.ulpName || '').toUpperCase().includes(def.namaUlp.replace('ULP ', ''));
            const matchTim = (rel.reguName || '').toUpperCase().includes(def.timRow.replace(/^(TIM|REGU)\s*/i, ''));

            if (matchUlp || matchTim) {
              const dayKey = rDay; // e.g. "01"
              if (!dailyValues[dayKey]) {
                dailyValues[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0 };
              }

              const ket = ((rel.keterangan || '') + ' ' + (rel.jenisTanaman || '')).toUpperCase();
              if (ket.includes('TEBANG')) {
                dailyValues[dayKey].tebang1 += 1;
              } else if (ket.includes('PANGKAS')) {
                dailyValues[dayKey].pangkas += 1;
              } else {
                dailyValues[dayKey].tebang1 += 1;
              }
            }
          }
        });
      }

      return {
        id: def.id,
        noUrut: idx + 1,
        kodeUnit: def.kodeUnit,
        namaUlp: def.namaUlp,
        timRow: def.timRow,
        target: def.target,
        keterangan: '',
        dailyValues,
      };
    });

    return initialRows;
  }

  /**
   * Menyimpan data Rekap ke LocalStorage
   */
  static saveRekapData(unitName: string, year: number, monthIndex: number, data: RekapItemData[]): void {
    const key = this.getStorageKey(unitName, year, monthIndex);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save rekap harian:', e);
    }
  }

  /**
   * Menarik data Realisasi terbaru dan mengupdate data rekap
   */
  static syncFromRealisasi(
    year: number,
    monthIndex: number,
    currentRows: RekapItemData[],
    realisasiList: Realisasi[]
  ): RekapItemData[] {
    const monthPadded = String(monthIndex + 1).padStart(2, '0');

    return currentRows.map((row) => {
      const updatedDaily = { ...row.dailyValues };

      realisasiList.forEach((rel) => {
        if (!rel.tanggalRealisasi) return;
        const [rYear, rMonth, rDay] = rel.tanggalRealisasi.split('-');
        if (Number(rYear) === year && rMonth === monthPadded) {
          const matchUlp = (rel.ulpName || '').toUpperCase().includes(row.namaUlp.replace('ULP ', ''));
          const matchTim = (rel.reguName || '').toUpperCase().includes(row.timRow.replace(/^(TIM|REGU)\s*/i, ''));

          if (matchUlp || matchTim) {
            const dayKey = rDay;
            if (!updatedDaily[dayKey]) {
              updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0 };
            }

            const ket = ((rel.keterangan || '') + ' ' + (rel.jenisTanaman || '')).toUpperCase();
            if (ket.includes('TEBANG')) {
              updatedDaily[dayKey].tebang1 += 1;
            } else if (ket.includes('PANGKAS')) {
              updatedDaily[dayKey].pangkas += 1;
            } else {
              updatedDaily[dayKey].tebang1 += 1;
            }
          }
        }
      });

      return {
        ...row,
        dailyValues: updatedDaily,
      };
    });
  }
}

