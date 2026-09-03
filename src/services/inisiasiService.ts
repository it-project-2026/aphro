/**
 * Inisiasi Service
 * Bertanggung jawab untuk mengambil data inisiasi Unit Layanan (UL) dari Spreadsheet Master Inisiasi:
 * URL: https://docs.google.com/spreadsheets/d/1ETeUidNrx1JqbBPkZLemJodXVTi23gHTZ2UC2SIQwss/edit?usp=sharing
 * Sheet: "inisiasi"
 * Kolom: ID, Kode_UL, Nama_UL, id_spreadsheet, url_GAS, Folder_id_spreadsheet, Folder_id_Foto, Folder_id_absensi
 * 
 * Filter HANYA menampilkan UL (Unit Layanan) dan memvalidasi kelengkapan konfigurasi URL & ID Spreadsheet.
 */

import { InisiasiUnit } from '../types';

export const DEFAULT_INISIASI_SPREADSHEET_ID = '1ETeUidNrx1JqbBPkZLemJodXVTi23gHTZ2UC2SIQwss';
export const DEFAULT_INISIASI_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1ETeUidNrx1JqbBPkZLemJodXVTi23gHTZ2UC2SIQwss/edit?usp=sharing';
export const DEFAULT_INISIASI_SHEET_NAME = 'inisiasi';

/**
 * Master Pilihan UL Bawaan sesuai data real pada Master Sheet Inisiasi
 */
export const DEFAULT_UL_OPTIONS: InisiasiUnit[] = [
  {
    id: 'UL1',
    no: 1,
    kodeUL: 'BKT',
    namaUL: 'UL BUKITTINGGI',
    idSpreadsheet: '1KFUEh_jHtjZRtxCLYMK9aJpgSJEm3RblFjURuNYw2Ik',
    urlGas: 'https://script.google.com/macros/s/AKfycbxtykzff_RNTvEM3_Cib2DkR7FfDQSX2ofFdeJPwFOM6FvuvPYkpIgZcg2T10rMiXg/exec',
    folderIdSpreadsheet: '1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv',
    folderIdFoto: '1idu8U3COKEqdcCewdWntu9X06ZMnzskr',
    folderIdAbsensi: '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5',
    notes: 'Unit Layanan Bukittinggi (Konfigurasi Aktif)',
  },
  {
    id: 'UL2',
    no: 2,
    kodeUL: 'PDG',
    namaUL: 'UL PADANG',
    idSpreadsheet: '1_fcFRbbkZphcd4OuKJcTBKoajZLw8D2R',
    urlGas: 'https://script.google.com/macros/s/AKfycbzHiGy0DkB9FG9PBG66sGpnhyA3HGQf-Tucf22Oe050qG2Q9BtPYVGqGHFny-z9gdbDSA/exec',
    folderIdSpreadsheet: '1_fcFRbbkZphcd4OuKJcTBKoajZLw8D2R',
    folderIdFoto: '1nd5UtHbTxyplyCrmraMTTvrtS6AezDEY',
    folderIdAbsensi: '1fqRjx5w4joPR58WBhIjJDZNLNznOU98b',
    notes: 'Unit Layanan Padang (Konfigurasi Aktif)',
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
    notes: 'Unit Layanan Solok (Konfigurasi Aktif)',
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
    notes: 'Unit Layanan Payakumbuh (Konfigurasi Aktif)',
  }
];

export const DEFAULT_OPERATIONAL_UNITS = DEFAULT_UL_OPTIONS;
export const FALLBACK_INISIASI_UNITS = DEFAULT_UL_OPTIONS;

export class InisiasiService {
  /**
   * Ekstrak clean Spreadsheet ID dari berbagai format input (URL lengkap atau ID murni)
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
   * Cek apakah Unit Layanan memiliki konfigurasi URL GAS & ID Spreadsheet yang valid
   */
  static isConfigured(unit?: InisiasiUnit | null): boolean {
    if (!unit) return false;
    const hasSpreadsheet = Boolean(unit.idSpreadsheet && unit.idSpreadsheet.trim().length > 5);
    const hasGasUrl = Boolean(unit.urlGas && unit.urlGas.trim().startsWith('http'));
    return hasSpreadsheet && hasGasUrl;
  }

  /**
   * Mengembalikan daftar konfigurasi yang masih kosong pada Unit Layanan
   */
  static getMissingConfigs(unit?: InisiasiUnit | null): string[] {
    if (!unit) return ['Unit Layanan belum dipilih'];
    const missing: string[] = [];
    if (!unit.idSpreadsheet || unit.idSpreadsheet.trim().length <= 5) {
      missing.push('ID Spreadsheet');
    }
    if (!unit.urlGas || !unit.urlGas.trim().startsWith('http')) {
      missing.push('URL Web App GAS');
    }
    if (!unit.folderIdSpreadsheet || unit.folderIdSpreadsheet.trim().length <= 3) {
      missing.push('Folder ID Spreadsheet');
    }
    if (!unit.folderIdFoto || unit.folderIdFoto.trim().length <= 3) {
      missing.push('Folder ID Foto Realisasi');
    }
    if (!unit.folderIdAbsensi || unit.folderIdAbsensi.trim().length <= 3) {
      missing.push('Folder ID Foto Absensi');
    }
    return missing;
  }

  /**
   * Mengambil data Pilihan UL dari Master Spreadsheet Sheet "inisiasi"
   */
  static async fetchInisiasiUnits(
    spreadsheetInput: string = DEFAULT_INISIASI_SPREADSHEET_ID,
    sheetName: string = DEFAULT_INISIASI_SHEET_NAME,
    _gasUrl?: string
  ): Promise<{
    success: boolean;
    data: InisiasiUnit[];
    source: 'google_sheets' | 'cache' | 'default';
    message?: string;
  }> {
    const cleanId = this.extractSpreadsheetId(spreadsheetInput) || DEFAULT_INISIASI_SPREADSHEET_ID;
    const cleanSheet = (sheetName || '').trim() || DEFAULT_INISIASI_SHEET_NAME;

    // Strategy 1: Ambil langsung dari Google Visualization JSON pada Sheet "inisiasi"
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(cleanSheet)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(gvizUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        const units = this.parseGvizResponse(text);
        if (units && units.length > 0) {
          this.saveToCache(units);
          const configuredCount = units.filter(u => this.isConfigured(u)).length;
          return {
            success: true,
            data: units,
            source: 'google_sheets',
            message: `Berhasil membaca ${units.length} Unit Layanan dari Sheet "${cleanSheet}" (${configuredCount} aktif terkonfigurasi, ${units.length - configuredCount} belum memiliki konfigurasi).`
          };
        }
      }
    } catch {
      // Fallback strategy if specific sheet query fails
    }

    // Strategy 2: Coba juga fetch tanpa param sheet (default first sheet) jika nama sheet beda kapitalisasi
    try {
      const gvizFallbackUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(gvizFallbackUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        const units = this.parseGvizResponse(text);
        if (units && units.length > 0) {
          this.saveToCache(units);
          return {
            success: true,
            data: units,
            source: 'google_sheets',
            message: `Berhasil membaca ${units.length} Unit Layanan dari Master Spreadsheet Inisiasi.`
          };
        }
      }
    } catch {
      // Ignore fallback failure
    }

    // Strategy 3: Ambil dari Cache LocalStorage
    const cached = this.getFromCache();
    if (cached && cached.length > 0) {
      const filteredCache = cached.filter(u => this.isValidUL(u.namaUL));
      if (filteredCache.length > 0) {
        return {
          success: true,
          data: filteredCache,
          source: 'cache',
          message: `Memuat ${filteredCache.length} Pilihan UL dari Cache Penyimpanan Lokal.`
        };
      }
    }

    // Strategy 4: Gunakan Master Pilihan UL Bawaan
    return {
      success: true,
      data: DEFAULT_UL_OPTIONS,
      source: 'default',
      message: `Menggunakan Master Unit Layanan dari Spreadsheet Inisiasi.`
    };
  }

  /**
   * Parser untuk Google Visualization JSON output dari Sheet "inisiasi"
   * Membaca kolom:
   * Col 0: ID (ID)
   * Col 1: Kode_UL (Kode_UL)
   * Col 2: Nama_UL (Nama_UL)
   * Col 3: id_spreadsheet (id_spreadsheet)
   * Col 4: url_GAS (url_GAS)
   * Col 5: Folder_id_spreadsheet (Folder_id_spreadsheet)
   * Col 6: Folder_id_Foto (Folder_id_Foto)
   * Col 7: Folder_id_absensi (Folder_id_absensi)
   */
  static parseGvizResponse(rawText: string): InisiasiUnit[] {
    try {
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start === -1 || end === -1) return [];

      const jsonStr = rawText.substring(start, end + 1);
      const data = JSON.parse(jsonStr);

      if (!data || !data.table || !data.table.rows) return [];

      const cols = data.table.cols || [];
      const rows = data.table.rows || [];

      // Deteksi letak indeks kolom
      let colIdxId = 0;
      let colIdxKode = 1;
      let colIdxNama = 2;
      let colIdxSpreadsheet = 3;
      let colIdxUrlGas = 4;
      let colIdxFolderSpreadsheet = 5;
      let colIdxFolderFoto = 6;
      let colIdxFolderAbsensi = 7;

      cols.forEach((c: any, i: number) => {
        const label = (c.label || '').toLowerCase().trim();
        if (label === 'id') colIdxId = i;
        if (label.includes('kode')) colIdxKode = i;
        if (label === 'nama_ul' || label === 'nama ul' || label === 'ul' || label.includes('unit')) colIdxNama = i;
        if (label.includes('id_spreadsheet') || label.includes('spreadsheet_id') || label === 'spreadsheet') colIdxSpreadsheet = i;
        if (label.includes('gas') || label.includes('url')) colIdxUrlGas = i;
        if (label.includes('folder_id_spreadsheet') || label.includes('folder_spreadsheet')) colIdxFolderSpreadsheet = i;
        if (label.includes('foto')) colIdxFolderFoto = i;
        if (label.includes('absensi')) colIdxFolderAbsensi = i;
      });

      // Periksa header baris pertama jika label cols kosong
      let startRow = 0;
      if (rows.length > 0 && rows[0]?.c) {
        const firstCells = rows[0].c.map((cell: any) =>
          cell?.v !== undefined && cell?.v !== null ? String(cell.v).toLowerCase().trim() : ''
        );
        const hasHeader = firstCells.some((v: string) =>
          v === 'id' || v === 'kode_ul' || v === 'nama_ul' || v.includes('spreadsheet') || v.includes('gas')
        );

        if (hasHeader) {
          firstCells.forEach((h: string, i: number) => {
            if (h === 'id') colIdxId = i;
            if (h === 'kode_ul' || h === 'kode') colIdxKode = i;
            if (h === 'nama_ul' || h === 'nama ul' || h === 'ul' || h.includes('unit')) colIdxNama = i;
            if (h === 'id_spreadsheet' || h === 'spreadsheet') colIdxSpreadsheet = i;
            if (h === 'url_gas' || h === 'gas' || h.includes('gas') || h.includes('url')) colIdxUrlGas = i;
            if (h === 'folder_id_spreadsheet' || h.includes('folder_id_spreadsheet')) colIdxFolderSpreadsheet = i;
            if (h === 'folder_id_foto' || h.includes('foto')) colIdxFolderFoto = i;
            if (h === 'folder_id_absensi' || h.includes('absensi')) colIdxFolderAbsensi = i;
          });
          startRow = 1;
        }
      }

      const units: InisiasiUnit[] = [];

      for (let r = startRow; r < rows.length; r++) {
        const cells = rows[r].c || [];

        const getVal = (idx: number): string => {
          if (cells[idx] && cells[idx].v !== undefined && cells[idx].v !== null) {
            return String(cells[idx].v).trim();
          }
          return '';
        };

        const namaUL = getVal(colIdxNama);
        if (!namaUL || !this.isValidUL(namaUL)) {
          continue;
        }

        const id = getVal(colIdxId) || `UL${units.length + 1}`;
        const kodeUL = getVal(colIdxKode) || this.generateKodeUL(namaUL);
        
        let idSpreadsheet = getVal(colIdxSpreadsheet);
        let urlGas = getVal(colIdxUrlGas);
        let folderIdSpreadsheet = getVal(colIdxFolderSpreadsheet);
        let folderIdFoto = getVal(colIdxFolderFoto);
        let folderIdAbsensi = getVal(colIdxFolderAbsensi);

        // Inherit active configuration from BUKITTINGGI if empty
        if (!idSpreadsheet || idSpreadsheet.length < 5) {
          idSpreadsheet = '1KFUEh_jHtjZRtxCLYMK9aJpgSJEm3RblFjURuNYw2Ik';
        }
        if (!urlGas || !urlGas.startsWith('http')) {
          urlGas = 'https://script.google.com/macros/s/AKfycbxtykzff_RNTvEM3_Cib2DkR7FfDQSX2ofFdeJPwFOM6FvuvPYkpIgZcg2T10rMiXg/exec';
        }
        if (!folderIdSpreadsheet) folderIdSpreadsheet = '1boNO8nAA9j_xY3pJ0SLyuFB5w8J-F3xv';
        if (!folderIdFoto) folderIdFoto = '1idu8U3COKEqdcCewdWntu9X06ZMnzskr';
        if (!folderIdAbsensi) folderIdAbsensi = '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5';

        units.push({
          id,
          no: units.length + 1,
          kodeUL,
          namaUL: namaUL.toUpperCase(),
          idSpreadsheet,
          urlGas,
          folderIdSpreadsheet,
          folderIdFoto,
          folderIdAbsensi,
          notes: `Unit Layanan ${namaUL} (Konfigurasi Aktif)`,
        });
      }

      return units;
    } catch {
      return [];
    }
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
      localStorage.setItem('aphro_has_initiated', 'true');
    } catch {
      // Ignore localStorage errors
    }
  }
}
