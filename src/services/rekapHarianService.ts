/**
 * Service & Model Data untuk Rekap Pekerjaan Harian
 */

import { RekapItemData } from '../utils/rekapExportService';
import { Realisasi } from '../types';

export const DEFAULT_REKAP_ROWS: Array<{
  id: string;
  kodeUnit: string;
  namaUlp: string;
  timRow: string;
  target: number;
}> = [
  { id: 'row-1', kodeUnit: '13221', namaUlp: 'ULP BUKITTINGGI', timRow: 'TIM ROW 3', target: 200 },
  { id: 'row-2', kodeUnit: '13222', namaUlp: 'ULP PADANG PANJANG', timRow: 'TIM ROW 4', target: 200 },
  { id: 'row-3', kodeUnit: '13223', namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 7', target: 150 },
  { id: 'row-4', kodeUnit: '13223', namaUlp: 'ULP LUBUK SIKAPING', timRow: 'TIM ROW 8', target: 150 },
  { id: 'row-5', kodeUnit: '13224', namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 5', target: 180 },
  { id: 'row-6', kodeUnit: '13224', namaUlp: 'ULP LUBUK BASUNG', timRow: 'TIM ROW 6', target: 180 },
  { id: 'row-7', kodeUnit: '13225', namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 9', target: 150 },
  { id: 'row-8', kodeUnit: '13225', namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 10', target: 150 },
  { id: 'row-9', kodeUnit: '13225', namaUlp: 'ULP SIMPANG EMPAT', timRow: 'TIM ROW 11', target: 150 },
  { id: 'row-10', kodeUnit: '13226', namaUlp: 'ULP BASO', timRow: 'TIM ROW 2', target: 200 },
  { id: 'row-11', kodeUnit: '13227', namaUlp: 'ULP KOTO TUO', timRow: 'TIM ROW 1', target: 200 },
];

export class RekapHarianService {
  /**
   * Mendapatkan key penyimpanan localStorage untuk tahun dan bulan tertentu
   */
  static getStorageKey(year: number, monthIndex: number): string {
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    return `aphro_rekap_harian_${year}_${monthPadded}`;
  }

  /**
   * Memuat data Rekap dari LocalStorage atau menginisialisasi dari data Realisasi aplikasi
   */
  static loadRekapData(
    year: number,
    monthIndex: number,
    realisasiList?: Realisasi[]
  ): RekapItemData[] {
    const key = this.getStorageKey(year, monthIndex);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved rekap harian:', e);
    }

    // Inisialisasi awal jika belum ada data tersimpan
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    const initialRows: RekapItemData[] = DEFAULT_REKAP_ROWS.map((def) => {
      const dailyValues: Record<string, { tebang1: number; pangkas: number; tebang2: number }> = {};

      // Jika ada realisasiList dari sistem, hitung agregasi otomatis
      if (realisasiList && realisasiList.length > 0) {
        realisasiList.forEach((rel) => {
          if (!rel.tanggalRealisasi) return;
          const [rYear, rMonth, rDay] = rel.tanggalRealisasi.split('-');
          if (Number(rYear) === year && rMonth === monthPadded) {
            // Cek kesesuaian tim atau ULP
            const matchUlp = (rel.ulpName || '').toUpperCase().includes(def.namaUlp.replace('ULP ', ''));
            const matchTim = (rel.reguName || '').toUpperCase().includes(def.timRow.replace('TIM ', ''));

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
  static saveRekapData(year: number, monthIndex: number, data: RekapItemData[]): void {
    const key = this.getStorageKey(year, monthIndex);
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
          const matchTim = (rel.reguName || '').toUpperCase().includes(row.timRow.replace('TIM ', ''));

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
