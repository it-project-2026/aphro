/**
 * Inisiasi Service
 *
 * Sumber data INISIASI:
 * HyperCloudHost PostgreSQL melalui /api/inisiasi
 *
 * Tidak lagi menggunakan:
 * - Supabase INISIASI
 * - Spreadsheet INISIASI
 * - GAS untuk membaca INISIASI
 */

import { InisiasiUnit } from '../types';
import { ApiService } from './apiService';

/**
 * Daftar default Unit Layanan.
 *
 * Data utama tetap berasal dari tabel INISIASI HyperCloudHost.
 * DEFAULT_UL_OPTIONS hanya digunakan sebagai fallback untuk
 * informasi tambahan yang belum disimpan di tabel INISIASI.
 */
export const DEFAULT_UL_OPTIONS: InisiasiUnit[] = [
  {
    id: 'UL1',
    no: 1,
    kodeUL: 'PDG',
    namaUL: 'UL PADANG',
    idSpreadsheet: '',
    urlGas: '',
    folderIdSpreadsheet: '',
    folderIdFoto:
      '1nd5UtHbTxyplyCrmraMTTvrtS6AezDEY',
    folderIdAbsensi:
      '1fqRjx5w4joPR58WBhIjJDZNLNznOU98b',
    isCustom: false,
    notes: 'Unit Layanan Padang',
  },
  {
    id: 'UL2',
    no: 2,
    kodeUL: 'BKT',
    namaUL: 'UL BUKITTINGGI',
    idSpreadsheet: '',
    urlGas: '',
    folderIdSpreadsheet: '',
    folderIdFoto:
      '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    folderIdAbsensi:
      '1zDU9fGaFan01Y9Dogtd0xHOPM1S1Vry5',
    isCustom: false,
    notes: 'Unit Layanan Bukittinggi',
  },
  {
    id: 'UL3',
    no: 3,
    kodeUL: 'SLK',
    namaUL: 'UL SOLOK',
    idSpreadsheet: '',
    urlGas: '',
    folderIdSpreadsheet: '',
    folderIdFoto:
      '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    folderIdAbsensi:
      '1zDU9fGaFan01Y9Dogtd0xHOPM1S1Vry5',
    isCustom: false,
    notes: 'Unit Layanan Solok',
  },
  {
    id: 'UL4',
    no: 4,
    kodeUL: 'PYK',
    namaUL: 'UL PAYAKUMBUH',
    idSpreadsheet: '',
    urlGas: '',
    folderIdSpreadsheet: '',
    folderIdFoto:
      '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    folderIdAbsensi:
      '1zDU9fGaFan01Y9Dogtd0xHOPM1S1Vry5',
    isCustom: false,
    notes: 'Unit Layanan Payakumbuh',
  },
];

/**
 * Normalisasi ID Unit Layanan.
 *
 * Contoh:
 * UL1 / 1 / PADANG / PDG -> UL1
 * UL2 / 2 / BUKITTINGGI / BKT -> UL2
 */
export function getStandardUnitId(
  value?: string | number | null
): string {
  if (value === undefined || value === null) {
    return '';
  }

  const normalized = String(value)
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'UL1':
    case '1':
    case 'PADANG':
    case 'PDG':
      return 'UL1';

    case 'UL2':
    case '2':
    case 'BUKITTINGGI':
    case 'BUKIT TINGGI':
    case 'BKT':
      return 'UL2';

    case 'UL3':
    case '3':
    case 'SOLOK':
    case 'SLK':
      return 'UL3';

    case 'UL4':
    case '4':
    case 'PAYAKUMBUH':
    case 'PYK':
      return 'UL4';

    default:
      return normalized;
  }
}

/**
 * Mengambil seluruh Unit Layanan dari HyperCloudHost.
 *
 * Endpoint:
 * GET /api/inisiasi
 */
export async function fetchInisiasiUnits(): Promise<{
  success: boolean;
  data: InisiasiUnit[];
  source: 'hypercloud' | 'default';
  message?: string;
}> {
  try {
    const result = await ApiService.fetchInisiasiUnits();

    if (
      !result.success ||
      !Array.isArray(result.data) ||
      result.data.length === 0
    ) {
      return {
        success: false,
        data: [],
        source: 'default',
        message:
          result.message ||
          'Gagal memuat INISIASI dari HyperCloudHost',
      };
    }

    /**
     * Mapping:
     *
     * PostgreSQL:
     * ID
     * Kode_UL
     * Nama_UL
     * Folder_id_Foto
     * Folder_id_absensi
     *
     * menjadi struktur InisiasiUnit yang digunakan aplikasi.
     */
    const data: InisiasiUnit[] = result.data.map(
      (row: any, index: number) => {
        const id = getStandardUnitId(
          row.ID || row.id
        );

        const defaultUnit =
          DEFAULT_UL_OPTIONS.find(
            (unit) => unit.id === id
          );

        return {
          id,

          no:
            defaultUnit?.no ??
            index + 1,

          kodeUL: String(
            row.Kode_UL ||
              row.kodeUL ||
              defaultUnit?.kodeUL ||
              ''
          ),

          namaUL: String(
            row.Nama_UL ||
              row.namaUL ||
              defaultUnit?.namaUL ||
              ''
          ),

          /**
           * Spreadsheet INISIASI sudah tidak digunakan.
           */
          idSpreadsheet: '',
          urlGas: '',
          folderIdSpreadsheet: '',

          /**
           * Folder Google Drive tetap digunakan
           * untuk foto/realisasi dan absensi.
           */
          folderIdFoto: String(
            row.Folder_id_Foto ||
              row.folderIdFoto ||
              defaultUnit?.folderIdFoto ||
              ''
          ),

          folderIdAbsensi: String(
            row.Folder_id_absensi ||
              row.folderIdAbsensi ||
              defaultUnit?.folderIdAbsensi ||
              ''
          ),

          isCustom: false,

          notes:
            defaultUnit?.notes ||
            `Unit Layanan ${id}`,
        };
      }
    );

    return {
      success: true,
      data,
      source: 'hypercloud',
      message: `Berhasil memuat ${data.length} Unit Layanan dari HyperCloudHost.`,
    };
  } catch (error: any) {
    console.error(
      '[InisiasiService] fetchInisiasiUnits error:',
      error
    );

    return {
      success: false,
      data: [],
      source: 'default',
      message:
        error?.message ||
        'Terjadi kesalahan saat mengambil INISIASI dari HyperCloudHost',
    };
  }
}

/**
 * Mendapatkan Unit Layanan berdasarkan ID.
 */
export async function getInisiasiUnitById(
  unitId: string
): Promise<InisiasiUnit | null> {
  const result = await fetchInisiasiUnits();

  if (!result.success) {
    return null;
  }

  const standardId = getStandardUnitId(unitId);

  return (
    result.data.find(
      (unit) =>
        getStandardUnitId(unit.id) === standardId
    ) || null
  );
}

/**
 * Mendapatkan Unit Layanan aktif.
 *
 * Prioritas:
 * 1. aphro_selected_inisiasi_ul
 * 2. aphro_selected_unit_id
 * 3. aphro_unit_id
 * 4. UL1
 */
export function getActiveInisiasiUnit(): InisiasiUnit {
  try {
    // 1. Explicitly selected Inisiasi Unit takes top priority
    const selectedInisiasi =
      localStorage.getItem('aphro_selected_inisiasi_ul');

    const selectedUnitId =
      localStorage.getItem('aphro_selected_unit_id');

    const unitId =
      localStorage.getItem('aphro_unit_id');

    const selected =
      selectedInisiasi ||
      selectedUnitId ||
      unitId;

    if (selected) {
      let rawSelectedId = selected;
      if (typeof selected === 'string' && (selected.startsWith('{') || selected.startsWith('"'))) {
        try {
          const parsed = JSON.parse(selected);
          if (parsed?.id) rawSelectedId = parsed.id;
        } catch {
          // ignore
        }
      }

      const standardId = getStandardUnitId(rawSelectedId);
      const found = DEFAULT_UL_OPTIONS.find(
        (unit) => getStandardUnitId(unit.id) === standardId
      );

      if (found) {
        return found;
      }
    }

    // 2. Fallback to logged in user's unit
    const userStr =
      localStorage.getItem('aphro_user') ||
      localStorage.getItem('pln_mobile_user');

    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && u.unitId) {
          const std = getStandardUnitId(u.unitId);
          if (std) {
            const found = DEFAULT_UL_OPTIONS.find(
              (unit) => getStandardUnitId(unit.id) === std
            );
            if (found) return found;
          }
        }
      } catch {
        // Ignore
      }
    }
  } catch (error) {
    console.warn(
      '[InisiasiService] Gagal membaca localStorage:',
      error
    );
  }

  /**
   * Default UL1 (UL Padang)
   */
  return (
    DEFAULT_UL_OPTIONS.find(
      (unit) => unit.id === 'UL1'
    ) ||
    DEFAULT_UL_OPTIONS[0]
  );
}

/**
 * Mendapatkan Unit ID yang sedang dipilih.
 */
export function getSelectedUnitId(): string {
  try {
    const selected =
      localStorage.getItem('aphro_selected_unit_id') ||
      localStorage.getItem('aphro_selected_inisiasi_ul') ||
      localStorage.getItem('aphro_unit_id');

    if (selected) {
      let rawSelectedId = selected;
      if (typeof selected === 'string' && (selected.startsWith('{') || selected.startsWith('"'))) {
        try {
          const parsed = JSON.parse(selected);
          if (parsed?.id) rawSelectedId = parsed.id;
        } catch {
          // ignore
        }
      }
      const std = getStandardUnitId(rawSelectedId);
      if (std) return std;
    }

    const userStr =
      localStorage.getItem('aphro_user') ||
      localStorage.getItem('pln_mobile_user');

    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && u.unitId) {
          const std = getStandardUnitId(u.unitId);
          if (std) return std;
        }
      } catch {
        // Ignore
      }
    }
  } catch (error) {
    console.warn(
      '[InisiasiService] Gagal membaca selected unit:',
      error
    );
  }

  return 'UL1';
}

/**
 * Menyimpan Unit Layanan yang dipilih.
 */
export function saveSelectedUnit(
  unitId: string | InisiasiUnit
): void {
  const rawId = typeof unitId === 'string' ? unitId : unitId?.id;
  const standardId = getStandardUnitId(rawId) || 'UL1';
  const foundUnit = DEFAULT_UL_OPTIONS.find((u) => u.id === standardId);

  try {
    localStorage.setItem(
      'aphro_selected_unit_id',
      standardId
    );

    localStorage.setItem(
      'aphro_selected_inisiasi_ul',
      standardId
    );

    localStorage.setItem(
      'aphro_unit_id',
      standardId
    );

    if (foundUnit) {
      localStorage.setItem('aphro_nama_unit_layanan', foundUnit.namaUL);
    }

    // Update logged-in user unitId if present
    const userStr = localStorage.getItem('aphro_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u) {
          u.unitId = standardId;
          if (foundUnit) u.unitName = foundUnit.namaUL;
          localStorage.setItem('aphro_user', JSON.stringify(u));
        }
      } catch {}
    }

    const plnUserStr = localStorage.getItem('pln_mobile_user');
    if (plnUserStr) {
      try {
        const u = JSON.parse(plnUserStr);
        if (u) {
          u.unitId = standardId;
          if (foundUnit) u.unitName = foundUnit.namaUL;
          localStorage.setItem('pln_mobile_user', JSON.stringify(u));
        }
      } catch {}
    }

    /**
     * Sinkronisasi dengan setting mobile
     */
    const settingsRaw =
      localStorage.getItem('pln_mobile_settings');

    if (settingsRaw) {
      try {
        const settings = JSON.parse(settingsRaw);
        settings.unitId = standardId;
        if (foundUnit) settings.namaUnitLayanan = foundUnit.namaUL;
        localStorage.setItem(
          'pln_mobile_settings',
          JSON.stringify(settings)
        );
      } catch {
        // Abaikan
      }
    }
  } catch (error) {
    console.warn(
      '[InisiasiService] Gagal menyimpan selected unit:',
      error
    );
  }
}

/**
 * Mengambil data unit aktif dari HyperCloudHost.
 */
export async function getActiveUnitFromHyperCloud(): Promise<InisiasiUnit | null> {
  const activeUnit =
    getActiveInisiasiUnit();

  const result =
    await fetchInisiasiUnits();

  if (!result.success) {
    return activeUnit || null;
  }

  const standardId =
    getStandardUnitId(activeUnit.id);

  return (
    result.data.find(
      (unit) =>
        getStandardUnitId(unit.id) ===
        standardId
    ) ||
    activeUnit ||
    null
  );
}

/**
 * Memastikan Unit ID valid.
 */
export function isValidUnitId(
  unitId?: string | null
): boolean {
  if (!unitId) {
    return false;
  }

  const standardId =
    getStandardUnitId(unitId);

  return DEFAULT_UL_OPTIONS.some(
    (unit) => unit.id === standardId
  );
}

/**
 * Mendapatkan nama Unit Layanan.
 */
export function getUnitName(
  unitId?: string | null
): string {
  if (!unitId) {
    return '';
  }

  const standardId =
    getStandardUnitId(unitId);

  const unit =
    DEFAULT_UL_OPTIONS.find(
      (item) => item.id === standardId
    );

  return unit?.namaUL || '';
}

export const DEFAULT_OPERATIONAL_UNITS = DEFAULT_UL_OPTIONS;
export const FALLBACK_INISIASI_UNITS = DEFAULT_UL_OPTIONS;
export const DEFAULT_INISIASI_SPREADSHEET_ID = '1ETeUidNrx1JqbBPkZLemJodXVTi23gHTZ2UC2SIQwss';
export const DEFAULT_INISIASI_SPREADSHEET_URL = 'https://npeeobcpffmlyiknszhh.supabase.co';
export const DEFAULT_INISIASI_SHEET_NAME = 'INISIASI';

export class InisiasiService {
  static extractSpreadsheetId(input: string): string {
    if (!input) return DEFAULT_INISIASI_SPREADSHEET_ID;
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  static isValidUL(val: string): boolean {
    if (!val) return false;
    const clean = val.trim().toUpperCase();
    if (clean.length < 2) return false;
    if (clean.startsWith('ULP ') || clean.startsWith('ULP-') || clean.startsWith('ULP_')) return false;
    if (['ULP', 'UL', 'NAMA_UL', 'NAMA UL', 'NAMA_ULP', 'ID', 'KODE_UL'].includes(clean)) return false;
    return true;
  }

  static isConfigured(unit?: InisiasiUnit | null): boolean {
    if (!unit) return false;
    return Boolean(unit.id && unit.namaUL && unit.namaUL.trim().length > 1);
  }

  static getMissingConfigs(unit?: InisiasiUnit | null): string[] {
    if (!unit) return ['Unit Layanan belum dipilih'];
    const missing: string[] = [];
    if (!unit.id) missing.push('ID Unit Layanan');
    if (!unit.namaUL) missing.push('Nama Unit Layanan');
    return missing;
  }

  static async fetchInisiasiUnits(
    _spreadsheetInput?: string,
    _sheetName?: string,
    _gasUrl?: string
  ) {
    return await fetchInisiasiUnits();
  }

  static generateKodeUL(namaUL: string): string {
    const clean = namaUL.replace(/^(UL\s*|UNIT\s*LAYANAN\s*)/i, '').trim();
    if (!clean) return 'UL-1';
    const words = clean.split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
  }

  static saveToCache(units: InisiasiUnit[]): void {
    try {
      localStorage.setItem('aphro_cached_inisiasi_units', JSON.stringify(units));
    } catch {
      // Ignore
    }
  }

  static getFromCache(): InisiasiUnit[] | null {
    try {
      const saved = localStorage.getItem('aphro_cached_inisiasi_units');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  static getStandardUnitId(input?: string | null): string {
    return getStandardUnitId(input);
  }

  static isUserMatchingUnit(userUnitId?: string | null, targetUnitId?: string | null): boolean {
    if (!userUnitId || !targetUnitId) return true;
    return getStandardUnitId(userUnitId) === getStandardUnitId(targetUnitId);
  }

  static getActiveInisiasiUnit() {
    const unit = getActiveInisiasiUnit();
    return {
      unitId: unit.id,
      namaUL: unit.namaUL,
      unitName: unit.namaUL,
    };
  }

  static getSelectedUnit(): InisiasiUnit | null {
    try {
      const saved = localStorage.getItem('aphro_selected_inisiasi_ul');
      if (saved) {
        if (typeof saved === 'string' && (saved.startsWith('{') || saved.startsWith('"'))) {
          try {
            return JSON.parse(saved);
          } catch {
            // string id
          }
        }
      }
    } catch {
      // Ignore
    }
    const id = getSelectedUnitId();
    return DEFAULT_UL_OPTIONS.find(u => u.id === id) || null;
  }

  static getSelectedUnitId(): string {
    return getSelectedUnitId();
  }

  static saveSelectedUnit(unit: InisiasiUnit | string): void {
    if (typeof unit === 'string') {
      saveSelectedUnit(unit);
    } else if (unit && unit.id) {
      saveSelectedUnit(unit.id);
      try {
        localStorage.setItem('aphro_selected_inisiasi_ul', JSON.stringify(unit));
        localStorage.setItem('aphro_unit_name', unit.namaUL);
        localStorage.setItem('aphro_nama_unit_layanan', unit.namaUL);
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Mendapatkan kode Unit Layanan.
 */
export function getUnitCode(
  unitId?: string | null
): string {
  if (!unitId) {
    return '';
  }

  const standardId =
    getStandardUnitId(unitId);

  const unit =
    DEFAULT_UL_OPTIONS.find(
      (item) => item.id === standardId
    );

  return unit?.kodeUL || '';
}
