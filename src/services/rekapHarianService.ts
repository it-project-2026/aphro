/**
 * Service & Model Data untuk Rekap Pekerjaan Harian
 * Menyesuaikan ULP dan TIM ROW dengan Unit Layanan (UL), serta mendukung No. Urut
 */

import { RekapItemData } from '../utils/rekapExportService';
import { Realisasi, ULP, ReguROW, WorkOrder } from '../types';

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
      { namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 7', target: 50.20, kodeUnit: '13223' },
      { namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 8', target: 50.20, kodeUnit: '13223' },
      { namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 5', target: 50.20, kodeUnit: '13224' },
      { namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 6', target: 50.20, kodeUnit: '13224' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 9', target: 50.20, kodeUnit: '13225' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 10', target: 50.20, kodeUnit: '13225' },
      { namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 11', target: 50.20, kodeUnit: '13225' },
      { namaUlp: 'ULP BASO', timRow: 'TIM ROW 2', target: 200, kodeUnit: '13226' },
      { namaUlp: 'ULP KOTO TUO', timRow: 'TIM ROW 1', target: 200, kodeUnit: '13227' },
    ],
  },
  PADANG: {
    kodeUL: 'PDG',
    namaUL: 'UL PADANG',
    rows: [
      { namaUlp: 'ULP PADANG BARAT', timRow: 'Regu ROW Alpha (Tim Utama)', target: 50.20, kodeUnit: '13211' },
      { namaUlp: 'ULP PADANG BARAT', timRow: 'Regu ROW Charlie (Rapid Response)', target: 50.20, kodeUnit: '13211' },
      { namaUlp: 'ULP INDARUNG', timRow: 'Regu ROW Bravo (Tim Indarung)', target: 200, kodeUnit: '13212' },
      { namaUlp: 'ULP KURANJI', timRow: 'Regu ROW Alpha (Tim Utama)', target: 200, kodeUnit: '13213' },
      { namaUlp: 'ULP TABING', timRow: 'Regu ROW Delta (Tim Tabing)', target: 200, kodeUnit: '13214' },
    ],
  },
  PAYAKUMBUH: {
    kodeUL: 'PYK',
    namaUL: 'UL PAYAKUMBUH',
    rows: [
      { namaUlp: 'ULP PAYAKUMBUH KOTA', timRow: 'TIM ROW 1', target: 50.20, kodeUnit: '13231' },
      { namaUlp: 'ULP PAYAKUMBUH KOTA', timRow: 'TIM ROW 2', target: 50.20, kodeUnit: '13231' },
      { namaUlp: 'ULP LIMA PULUH KOTA', timRow: 'TIM ROW 3', target: 200, kodeUnit: '13232' },
      { namaUlp: 'ULP SULIKI', timRow: 'TIM ROW 4', target: 200, kodeUnit: '13233' },
    ],
  },
  SOLOK: {
    kodeUL: 'SLK',
    namaUL: 'UL SOLOK',
    rows: [
      { namaUlp: 'ULP SOLOK KOTA', timRow: 'TIM ROW 1', target: 50.20, kodeUnit: '13241' },
      { namaUlp: 'ULP SOLOK KOTA', timRow: 'TIM ROW 2', target: 50.20, kodeUnit: '13241' },
      { namaUlp: 'ULP SAWAHLUNTO', timRow: 'TIM ROW 3', target: 200, kodeUnit: '13242' },
      { namaUlp: 'ULP SIJUNJUNG', timRow: 'TIM ROW 4', target: 200, kodeUnit: '13243' },
      { namaUlp: 'ULP MUARA LABUH', timRow: 'TIM ROW 5', target: 200, kodeUnit: '13244' },
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
    } catch (e) {
      console.warn('Failed to parse saved rekap harian:', e);
    }

    // Jika belum ada data tersimpan, inisialisasi dari default
    if (rows.length === 0) {
      const defaultRows = this.getDefaultRowsForUnit(unitName, ulpList, reguList);
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
    } catch (e) {
      console.warn('Failed to save rekap harian:', e);
    }
  }

  /**
   * Helper to parse date parts from various formats accurately
   * Prevents timezone shifts by using manual parsing for ISO strings
   */
  static parseDateParts(dateStr: any) {
    if (!dateStr) return null;
    
    // If it's already a Date object
    if (dateStr instanceof Date) {
      return { y: dateStr.getFullYear(), m: dateStr.getMonth() + 1, d: dateStr.getDate() };
    }

    const s = String(dateStr).trim();
    if (!s) return null;

    // 1. ISO format YYYY-MM-DD (optionally with T and time)
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      
      // Handle UTC ISO strings from Google Apps Script (e.g. 2026-08-19T17:00:00.000Z)
      // We assume these are local midnight shifted to UTC. 
      // 17:00 UTC of previous day = 00:00 local of current day (WIB +7)
      if (s.includes('T') && s.endsWith('Z')) {
        const dt = new Date(s);
        // If hours is late (17..23), it's likely midnight of the NEXT day in local time
        if (dt.getUTCHours() >= 12) {
          const localDt = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
          return { y: localDt.getUTCFullYear(), m: localDt.getUTCMonth() + 1, d: localDt.getUTCDate() };
        }
        // If hours is early, it stays on the same UTC day which is also same local day
        return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      }

      return { y: year, m: month, d: day };
    }

    // 2. Indo format DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      return { 
        y: parseInt(dmyMatch[3], 10), 
        m: parseInt(dmyMatch[2], 10), 
        d: parseInt(dmyMatch[1], 10) 
      };
    }

    // 3. Fallback
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
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

            if (matchUlp && matchTim) {
              const dayKey = String(parts.d).padStart(2, '0');
              if (!updatedDaily[dayKey]) {
                updatedDaily[dayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              const ket = normalize(rel.keterangan || '');
              if (ket.includes('TEBANG')) {
                updatedDaily[dayKey].tebang1++;
              } else if (ket.includes('PANGKAS') || ket.includes('POTONG')) {
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

            if (matchUlp && matchTim) {
              // SMART ALIGNMENT: 
              // Try to find if this WO has trees cut on a specific day.
              // If so, we move the KMS to that day to align with trees.
              const penyClean = normalize(wo.penyulangName || 'GENERAL');
              let targetDayKey = String(parts.d).padStart(2, '0');
              
              if (activityDatesByPenyulang[penyClean] && activityDatesByPenyulang[penyClean].size > 0) {
                // Use the first day of activity found for this penyulang in this month
                const dates = Array.from(activityDatesByPenyulang[penyClean]).sort();
                targetDayKey = dates[0];
              }

              if (!updatedDaily[targetDayKey]) {
                updatedDaily[targetDayKey] = { tebang1: 0, pangkas: 0, tebang2: 0, targetKms: 0, realisasiKms: 0 };
              }

              let targetKms = Number(wo.volumePekerjaan) || 0;
              if (wo.satuan?.toUpperCase() === 'GAWANG') targetKms = targetKms / 20;

              let realisasiKms = Number(wo.totalRealisasi) || 0;
              if (wo.satuanTotalRealisasi?.toUpperCase() === 'GAWANG') realisasiKms = realisasiKms / 20;

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

