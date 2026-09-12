/**
 * Inisiasi Service - Supabase "INISIASI" Table
 * Bertanggung jawab untuk mengambil data inisiasi Unit Layanan (UL) dari Supabase Tabel "INISIASI":
 * Database: APHRO-Database
 * Tabel: "INISIASI"
 * Kolom: ID, Kode_UL, Nama_UL, Folder_id_Foto, Folder_id_absensi
 * 
 * Menghubungkan ID Unit Layanan ke setiap tabel (WORK_ORDER, REALISASI, ABSENSI, dll) melalui kolom "unitId".
 */

import { InisiasiUnit } from '../types';
import { SupabaseService } from './supabaseService';

export const DEFAULT_INISIASI_SPREADSHEET_ID = '1ETeUidNrx1JqbBPkZLemJodXVTi23gHTZ2UC2SIQwss';
export const DEFAULT_INISIASI_SPREADSHEET_URL = 'https://npeeobcpffmlyiknszhh.supabase.co';
export const DEFAULT_INISIASI_SHEET_NAME = 'INISIASI';

/**
 * Master Pilihan UL Bawaan sesuai data real pada Master Database Inisiasi
 */
export const DEFAULT_UL_OPTIONS: InisiasiUnit[] = [
  {
    id: 'UL2',
    no: 1,
    kodeUL: 'BKT',
    namaUL: 'UL BUKITTINGGI',
    idSpreadsheet: '1KFUEh_jHtjZRtxCLYMK9aJpgSJEm3RblFjURuNYw2Ik',
    urlGas: 'https://script.google.com/macros/s/AKfycbxtykzff_RNTvEM3_Cib2DkR7FfDQSX2ofFdeJPwFOM6FvuvPYkpIgZcg2T10rMiXg/exec',
    folderIdSpreadsheet: '1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv',
    folderIdFoto: '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    folderIdAbsensi: '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5',
    notes: 'Unit Layanan Bukittinggi (Database Supabase Aktif: APHRO-Database)',
  },
  {
    id: 'UL1',
    no: 2,
    kodeUL: 'PDG',
    namaUL: 'UL PADANG',
    idSpreadsheet: '1_fcFRbbkZphcd4OuKJcTBKoajZLw8D2R',
    urlGas: 'https://script.google.com/macros/s/AKfycbzHiGy0DkB9FG9PBG66sGpnhyA3HGQf-Tucf22Oe050qG2Q9BtPYVGqGHFny-z9gdbDSA/exec',
    folderIdSpreadsheet: '1_fcFRbbkZphcd4OuKJcTBKoajZLw8D2R',
    folderIdFoto: '1nd5UtHbTxyplyCrmraMTTvrtS6AezDEY',
    folderIdAbsensi: '1fqRjx5w4joPR58WBhIjJDZNLNznOU98b',
    notes: 'Unit Layanan Padang (Database Supabase Aktif: APHRO-Database)',
  },
  {
    id: 'UL3',
    no: 3,
    kodeUL: 'SLK',
    namaUL: 'UL SOLOK',
    idSpreadsheet: '1KFUEh_jHtjZRtxCLYMK9aJpgSJEm3RblFjURuNYw2Ik',
    urlGas: 'https://script.google.com/macros/s/AKfycbxtykzff_RNTvEM3_Cib2DkR7FfDQSX2ofFdeJPwFOM6FvuvPYkpIgZcg2T10rMiXg/exec',
    folderIdSpreadsheet: '1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv',
    folderIdFoto: '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    folderIdAbsensi: '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5',
    notes: 'Unit Layanan Solok (Database Supabase Aktif: APHRO-Database)',
  },
  {
    id: 'UL4',
    no: 4,
    kodeUL: 'PYK',
    namaUL: 'UL PAYAKUMBUH',
    idSpreadsheet: '1KFUEh_jHtjZRtxCLYMK9aJpgSJEm3RblFjURuNYw2Ik',
    urlGas: 'https://script.google.com/macros/s/AKfycbxtykzff_RNTvEM3_Cib2DkR7FfDQSX2ofFdeJPwFOM6FvuvPYkpIgZcg2T10rMiXg/exec',
    folderIdSpreadsheet: '1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv',
    folderIdFoto: '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    folderIdAbsensi: '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5',
    notes: 'Unit Layanan Payakumbuh (Database Supabase Aktif: APHRO-Database)',
  }
];

export const DEFAULT_OPERATIONAL_UNITS = DEFAULT_UL_OPTIONS;
export const FALLBACK_INISIASI_UNITS = DEFAULT_UL_OPTIONS;

export class InisiasiService {
  /**
   * Ekstrak clean Spreadsheet ID dari berbagai format input
   */
  static extractSpreadsheetId(input: string): string {
    if (!input) return DEFAULT_INISIASI_SPREADSHEET_ID;
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  /**
   * Validasi apakah sebuah string adalah "UL" yang valid dan BUKAN "ULP"
   */
  static isValidUL(val: string): boolean {
    if (!val) return false;
    const clean = val.trim().toUpperCase();
    if (clean.length < 2) return false;

    // Filter keluar jika bertipe ULP (Unit Layanan Pelanggan)
    if (clean.startsWith('ULP ') || clean.startsWith('ULP-') || clean.startsWith('ULP_')) {
      return false;
    }

    // Filter keluar nama kolom / header
    if (clean === 'ULP' || clean === 'UL' || clean === 'NAMA_UL' || clean === 'NAMA UL' || clean === 'NAMA_ULP' || clean === 'ID' || clean === 'KODE_UL') {
      return false;
    }

    return true;
  }

  /**
   * Cek apakah Unit Layanan valid dan siap digunakan
   */
  static isConfigured(unit?: InisiasiUnit | null): boolean {
    if (!unit) return false;
    return Boolean(unit.id && unit.namaUL && unit.namaUL.trim().length > 1);
  }

  /**
   * Mengembalikan daftar konfigurasi yang masih kosong pada Unit Layanan
   */
  static getMissingConfigs(unit?: InisiasiUnit | null): string[] {
    if (!unit) return ['Unit Layanan belum dipilih'];
    const missing: string[] = [];
    if (!unit.id) {
      missing.push('ID Unit Layanan');
    }
    if (!unit.namaUL) {
      missing.push('Nama Unit Layanan');
    }
    return missing;
  }

  /**
   * Mengambil data Pilihan UL dari Supabase Tabel "INISIASI"
   */
  static async fetchInisiasiUnits(
    _spreadsheetInput?: string,
    _sheetName?: string,
    _gasUrl?: string
  ): Promise<{
    success: boolean;
    data: InisiasiUnit[];
    source: 'supabase' | 'cache' | 'default';
    message?: string;
  }> {
    return await SupabaseService.fetchInisiasiUnits();
  }

  static generateKodeUL(namaUL: string): string {
    const clean = namaUL.replace(/^(UL\s*|UNIT\s*LAYANAN\s*)/i, '').trim();
    if (!clean) return 'UL-1';
    const words = clean.split(/\s+/);
    if (words.length === 1) {
      return words[0].slice(0, 3).toUpperCase();
    }
    return words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
  }

  static saveToCache(units: InisiasiUnit[]): void {
    try {
      localStorage.setItem('aphro_cached_inisiasi_units', JSON.stringify(units));
    } catch {
      // Ignore localStorage errors
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
      // Fallback to null
    }
    return null;
  }

  static getSelectedUnit(): InisiasiUnit | null {
    try {
      const saved = localStorage.getItem('aphro_selected_inisiasi_ul');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback to null
    }
    return null;
  }

  static saveSelectedUnit(unit: InisiasiUnit): void {
    try {
      localStorage.setItem('aphro_selected_inisiasi_ul', JSON.stringify(unit));
      localStorage.setItem('aphro_selected_unit_id', unit.id);
      localStorage.setItem('aphro_has_initiated', 'true');
      localStorage.setItem('aphro_nama_unit_layanan', unit.namaUL);

      // Sync directly into pln_mobile_settings for instant UI reflection
      const rawSaved = localStorage.getItem('pln_mobile_settings');
      const parsed = rawSaved ? JSON.parse(rawSaved) : {};
      parsed.namaUnitLayanan = unit.namaUL;
      parsed.spreadsheetId = unit.id;
      if (unit.folderIdSpreadsheet) parsed.driveFolderId = unit.folderIdSpreadsheet;
      if (unit.folderIdFoto) parsed.photoFolderId = unit.folderIdFoto;
      if (unit.folderIdAbsensi) parsed.absensiFolderId = unit.folderIdAbsensi;
      localStorage.setItem('pln_mobile_settings', JSON.stringify(parsed));
    } catch {
      // Ignore localStorage errors
    }
  }
}
