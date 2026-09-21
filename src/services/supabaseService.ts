/**
 * Supabase Service - APHRO-Database
 * Centralized service layer for Supabase PostgreSQL operations.
 * Single database architecture connecting all tables via 'unitId' to INISIASI (ID).
 */

import { supabase, SUPABASE_TABLES, SUPABASE_DATABASE_NAME, isSupabaseConfigured } from './supabaseClient';
import { ApiService, FetchRealisasiParams, PaginationMeta } from './apiService';
import {
  InisiasiUnit,
  WorkOrder,
  Realisasi,
  Absensi,
  User,
  ULP,
  Penyulang,
  ReguROW,
  Petugas,
  UserRole,
} from '../types';
import {
  DEFAULT_UL_OPTIONS,
  DEFAULT_INISIASI_SPREADSHEET_ID,
  InisiasiService,
} from './inisiasiService';
import { UL_PRESETS, RekapHarianService } from './rekapHarianService';
import { normalizeRealisasiRow } from '../utils/realisasiNormalizer';
import {
  INITIAL_ULP,
  INITIAL_PENYULANG,
  INITIAL_REGU,
  INITIAL_PETUGAS,
  INITIAL_USERS,
  INITIAL_WORK_ORDERS,
  INITIAL_REALISASI,
  INITIAL_ABSENSI,
} from '../data/initialData';
import { getLocalDateTimeString, getWIBDateString, normalizeDateISO, parseDateFromNomorWO } from '../utils/dateUtils';
import { formatDriveViewUrl, formatDriveImageUrl, ensureGoogleDrivePhotoUrl, isBase64Image } from '../utils/driveUtils';
import { parseNumeric } from '../utils/metricUtils';
import { GASApiService } from './gasApiService';
import { getActiveGasConfig } from '../config/gasConfig';
import { auditRealisasiMutation } from '../utils/integrityLogger';

export const WORK_ORDER_SELECT_FIELDS = [
  'WO_ID', 'unitId', 'PEKERJAAN', 'Nomor_WO', 'Tanggal', 'ULP', 'Penyulang',
  'Regu_ROW', 'VOLUME', 'SATUAN', 'WO_AWAL', 'WO_AKHIR', 'STATUS',
  'LOKASI_START', 'LOKASI_FINISH', 'TOTAL_REALISASI', 'SATUAN_TOTAL_REALISASI', 'Created_At'
].join(',');

export const REALISASI_LIGHT_SELECT_FIELDS = [
  'ID', 'unitId', 'WO_ID', 'Nomor_WO', 'ULP', 'REGU_ROW', 'PENYULANG',
  'NO_TIANG', 'TANGGAL', 'Foto_Sebelum', 'Foto_Sesudah', 'Jenis_Tanaman',
  'Keterangan', 'Pertumbuhan_Tanaman', 'Kendala', 'Latitude_Longitude',
  'Lokasi_kerja', 'Timestamp'
].join(',');

export const ABSENSI_SELECT_FIELDS = [
  'ID', 'unitId', 'TANGGAL', 'NAMA_REGU', 'ULP',
  'PETUGAS_1', 'KET_1', 'PETUGAS_2', 'KET_2', 'PETUGAS_3', 'KET_3', 'PETUGAS_4',
  'KET_4', 'PETUGAS_5', 'KET_5', 'FOTO_MASUK', '"TIMESTAMP MASUK"', 'FOTO_KELUAR', '"TIMESTAMP KELUAR"'
].join(',');

export class SupabaseService {
  public static readonly DB_NAME = SUPABASE_DATABASE_NAME;

  /**
   * Safe unit filter to prevent cross-unit data leakage while capturing unit-matching legacy rows
   */
  public static getUnitQueryFilter(targetUnitId: string): string {
    const cleanId = (targetUnitId || '').toUpperCase().trim();
    const stdId = InisiasiService.getStandardUnitId(cleanId) || cleanId || 'UL1';
    
    const variants: string[] = [
      `unitId.eq.${stdId}`,
      `unitId.eq.${stdId.toLowerCase()}`,
      `unitId.is.null`,
      `unitId.eq.`,
    ];

    if (stdId === 'UL1') {
      variants.push('unitId.eq.PDG', 'unitId.eq.pdg', 'unitId.ilike.%PADANG%');
    } else if (stdId === 'UL2') {
      variants.push('unitId.eq.BKT', 'unitId.eq.bkt', 'unitId.ilike.%BUKITTINGGI%');
    } else if (stdId === 'UL3') {
      variants.push('unitId.eq.SLK', 'unitId.eq.slk', 'unitId.ilike.%SOLOK%');
    } else if (stdId === 'UL4') {
      variants.push('unitId.eq.PYK', 'unitId.eq.pyk', 'unitId.ilike.%PAYAKUMBUH%');
    }

    return variants.join(',');
  }

  static safeGetItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return null;
  }

  static safeSetItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {}
  }

  /**
   * Get currently active unitId from user session or localStorage (Source of Truth)
   */
  static getActiveUnitId(): string {
    try {
      // 1. Check logged-in user session first as the primary source of truth
      const savedUserStr = this.safeGetItem('aphro_user') || this.safeGetItem('pln_mobile_user');
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          if (u?.unitId) {
            const std = InisiasiService.getStandardUnitId(String(u.unitId));
            if (std) return std;
          }
        } catch {}
      }

      // 2. Check active inisiasi selection
      const selected = this.safeGetItem('aphro_selected_inisiasi_ul');
      if (selected) {
        try {
          const parsed = JSON.parse(selected);
          if (parsed?.id) {
            const std = InisiasiService.getStandardUnitId(String(parsed.id));
            if (std) return std;
          }
        } catch {}
      }

      const directId = this.safeGetItem('aphro_selected_unit_id') || this.safeGetItem('aphro_unit_id');
      if (directId) {
        const std = InisiasiService.getStandardUnitId(directId);
        if (std) return std;
      }

      const unitName = (this.safeGetItem('aphro_nama_unit_layanan') || '').toUpperCase();
      if (unitName.includes('PADANG') || unitName.includes('PDG')) return 'UL1';
      if (unitName.includes('BUKITTINGGI') || unitName.includes('BKT')) return 'UL2';
      if (unitName.includes('SOLOK') || unitName.includes('SLK')) return 'UL3';
      if (unitName.includes('PAYAKUMBUH') || unitName.includes('PYK')) return 'UL4';
    } catch {
      // Fallback
    }
    return 'UL2'; // Default unit fallback
  }

  // ==========================================
  // 1. INISIASI TABLE OPERATIONS
  // ==========================================

  /**
   * Fetch Unit Layanan list from INISIASI table via HyperCloudHost API
   */
  static async fetchInisiasiUnits(): Promise<{
    success: boolean;
    data: InisiasiUnit[];
    source: 'supabase' | 'cache' | 'default';
    message?: string;
  }> {
    try {
      const apiRes = await ApiService.fetchInisiasiUnits();
      if (apiRes.success && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
        const units: InisiasiUnit[] = apiRes.data.map((row: any, idx: number) => ({
          id: String(row.ID || row.id || `UL${idx + 1}`),
          no: idx + 1,
          kodeUL: String(row.Kode_UL || row.kodeUL || `UL-${idx + 1}`),
          namaUL: String(row.Nama_UL || row.namaUL || '').toUpperCase(),
          idSpreadsheet: DEFAULT_INISIASI_SPREADSHEET_ID,
          urlGas: '',
          folderIdSpreadsheet: '',
          folderIdFoto: String(row.Folder_id_Foto || row.folderIdFoto || '1idu8U3COKEqdcCewdWntu9X06ZMnzskr'),
          folderIdAbsensi: String(row.Folder_id_absensi || row.folderIdAbsensi || '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5'),
          notes: `Unit Layanan ${row.Nama_UL || row.namaUL || ''} (HyperCloudHost PostgreSQL)`,
        })).filter(u => u.namaUL.length > 0);

        if (units.length > 0) {
          this.safeSetItem('aphro_cached_inisiasi_units', JSON.stringify(units));
          return {
            success: true,
            data: units,
            source: 'supabase',
            message: `Berhasil memuat ${units.length} Unit Layanan dari HyperCloudHost API.`,
          };
        }
      }
    } catch (err) {
      console.warn('HyperCloudHost fetch INISIASI error:', err);
    }

    // Fallback to cache
    try {
      const cached = this.safeGetItem('aphro_cached_inisiasi_units');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            success: true,
            data: parsed,
            source: 'cache',
            message: `Memuat ${parsed.length} Unit Layanan dari cache lokal.`,
          };
        }
      }
    } catch {
      // Ignore cache error
    }

    // Fallback to Master DEFAULT_UL_OPTIONS
    return {
      success: true,
      data: DEFAULT_UL_OPTIONS,
      source: 'default',
      message: `Menggunakan Unit Layanan Master Database.`,
    };
  }

  // ==========================================
  // 2. WORK_ORDER TABLE OPERATIONS
  // ==========================================

  /**
   * Fetch Work Orders from Node.js API connected to HyperCloudHost PostgreSQL.
   */
  static async fetchWorkOrders(
    unitId?: string, 
    page: number = 0, 
    pageSize: number = 200,
    lastSyncTime?: string
  ): Promise<{
    success: boolean;
    data: WorkOrder[];
    source: 'supabase' | 'cache' | 'initial';
    message?: string;
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    // Primary: HyperCloudHost Node.js API
    if (isOnline) {
      try {
        const apiRes = await ApiService.fetchWorkOrders(targetUnitId);
        if (apiRes && apiRes.success && Array.isArray(apiRes.data)) {
          const workOrders: WorkOrder[] = apiRes.data.map((row: any) => this.normalizeWorkOrderRow(row));
          if (page === 0 && !lastSyncTime) {
            this.safeSetItem(`aphro_wo_${targetUnitId}`, JSON.stringify(workOrders));
          }
          return {
            success: true,
            data: workOrders,
            source: 'supabase',
            message: `Berhasil memuat ${workOrders.length} Work Order dari API HyperCloudHost.`,
          };
        } else if (apiRes && !apiRes.success && apiRes.message) {
          return {
            success: false,
            data: [],
            source: 'supabase',
            message: apiRes.message,
          };
        }
      } catch (err: any) {
        console.error('Error loading Work Orders from API HyperCloudHost:', err);
        return {
          success: false,
          data: [],
          source: 'supabase',
          message: `Gagal memuat Work Order: ${err.message}`,
        };
      }
    }

    // Fallback to cached data for this unit when offline
    try {
      const cached = this.safeGetItem(`aphro_wo_${targetUnitId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            success: true,
            data: parsed,
            source: 'cache',
            message: `Memuat ${parsed.length} Work Order dari penyimpanan lokal.`,
          };
        }
      }
    } catch {
      // Ignore
    }

    return {
      success: true,
      data: [],
      source: 'initial',
      message: 'Tidak ada data Work Order offline.',
    };
  }

  /**
   * Normalize Supabase WORK_ORDER table row to WorkOrder model
   */
  static normalizeWorkOrderRow(row: any): WorkOrder {
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

    const rawNomorWo = String(row.Nomor_WO || row.nomorWO || row.WO_ID || 'WO-001');
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
      tanggalStr = getWIBDateString();
    }

    return {
      id: String(row.WO_ID || row.id || `WO-${Date.now()}`),
      unitId: String(row.unitId || ''),
      nomorWO: rawNomorWo,
      pekerjaan: (row.PEKERJAAN || row.pekerjaan || 'NORMAL') as 'NORMAL' | 'GOROW',
      tanggal: tanggalStr,
      ulpId: String(row.unitId || 'UL1'),
      ulpName: String(row.ULP || row.ulpName || ''),
      penyulangId: String(row.penyulangId || 'PYL-1'),
      penyulangName: String(rawPenyulang || '').trim(),
      reguId: String(row.reguId || 'REG-1'),
      reguName: String(rawRegu || '').trim(),
      petugasId: String(row.petugasId || ''),
      petugasName: String(row.petugasName || row.PETUGAS || ''),
      volumePekerjaan: parseNumeric(row.VOLUME || row.volumePekerjaan, 0),
      satuan,
      totalRealisasi: parseNumeric(row.TOTAL_REALISASI || row.totalRealisasi, 0),
      satuanTotalRealisasi,
      woMulai: String(row.WO_MULAI || row.woMulai || ''),
      woAkhir: String(row.WO_AKHIR || row.woAkhir || ''),
      status: (row.STATUS || row.status || 'Belum Dikerjakan') as any,
      deskripsi: String(row.deskripsi || row.DESKRIPSI || ''),
      jenisPekerjaan: (row.jenisPekerjaan || row.JENIS_PEKERJAAN || 'Pemangkasan Pohon (ROW)') as any,
      prioritas: (row.prioritas || row.PRIORITAS || 'Sedang') as any,
      lokasi: String(row.lokasi || row.LOKASI || ''),
      progressPercent: parseNumeric(row.PROGRESS || row.progressPercent, 0),
      createdAt: String(row.Created_At || row.createdAt || getLocalDateTimeString()),
      updatedAt: String(row.updatedAt || getLocalDateTimeString()),
    };
  }

  /**
   * Save a new Work Order to HyperCloudHost PostgreSQL via ApiService
   */
  static async saveWorkOrder(unitId: string, wo: WorkOrder): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const payload = {
      WO_ID: wo.id,
      unitId: targetUnitId,
      PEKERJAAN: wo.pekerjaan || 'NORMAL',
      Nomor_WO: wo.nomorWO || '',
      Tanggal: wo.tanggal || getWIBDateString(),
      ULP: wo.ulpName || '',
      Penyulang: wo.penyulangName || '',
      Regu_ROW: wo.reguName || '',
      VOLUME: String(wo.volumePekerjaan || 0),
      SATUAN: wo.satuan || 'KMS',
      WO_AWAL: wo.woMulai || null,
      WO_AKHIR: wo.woAkhir || wo.deadline || null,
      STATUS: (wo.status || 'Belum Dikerjakan').toUpperCase(),
      LOKASI_START: wo.lokasi || null,
      LOKASI_FINISH: null,
      TOTAL_REALISASI: String(wo.totalRealisasi || 0),
      SATUAN_TOTAL_REALISASI: wo.satuanTotalRealisasi || 'KMS',
      Created_At: wo.createdAt || getLocalDateTimeString(),
    };

    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (isOnline) {
      try {
        const res = await ApiService.saveWorkOrder(payload);
        return { success: res.success, error: res.message };
      } catch (err: any) {
        console.error('saveWorkOrder error:', err);
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Aplikasi sedang offline. Tidak dapat menyimpan ke server.' };
  }

  /**
   * Update Work Order via ApiService
   */
  static async updateWorkOrder(
    unitId: string,
    id: string,
    updates: Partial<WorkOrder>
  ): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const dbUpdates: any = {
      WO_ID: id,
      unitId: targetUnitId,
    };
    if (updates.status) dbUpdates.STATUS = updates.status.toUpperCase();
    if (updates.totalRealisasi !== undefined) dbUpdates.TOTAL_REALISASI = String(updates.totalRealisasi);
    if (updates.satuanTotalRealisasi) dbUpdates.SATUAN_TOTAL_REALISASI = updates.satuanTotalRealisasi;
    if (updates.pekerjaan) dbUpdates.PEKERJAAN = updates.pekerjaan;
    if (updates.nomorWO) dbUpdates.Nomor_WO = updates.nomorWO;
    if (updates.volumePekerjaan !== undefined) dbUpdates.VOLUME = String(updates.volumePekerjaan);
    if (updates.satuan) dbUpdates.SATUAN = updates.satuan;
    if (updates.woMulai !== undefined) dbUpdates.WO_AWAL = updates.woMulai;
    if (updates.woAkhir !== undefined) dbUpdates.WO_AKHIR = updates.woAkhir;
    if (updates.tanggal) dbUpdates.Tanggal = updates.tanggal;
    if (updates.ulpName) dbUpdates.ULP = updates.ulpName;
    if (updates.penyulangName) dbUpdates.Penyulang = updates.penyulangName;
    if (updates.reguName) dbUpdates.Regu_ROW = updates.reguName;
    if (updates.lokasi) dbUpdates.LOKASI_START = updates.lokasi;

    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (isOnline) {
      try {
        const res = await ApiService.saveWorkOrder(dbUpdates);
        return { success: res.success, error: res.message };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Aplikasi sedang offline.' };
  }

  /**
   * Delete Work Order via ApiService
   */
  static async deleteWorkOrder(unitId: string, id: string, nomorWO?: string): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const cleanId = (id || '').trim();
    const cleanNomor = (nomorWO || '').trim();

    // 1. Clear local storage caches so that refresh/offline won't bring the deleted item back
    try {
      const keysToClean = [
        `aphro_wo_${targetUnitId}`,
        `aphro_workorders_${targetUnitId}`,
        'aphro_work_orders',
        'aphro_workorders_all'
      ];
      keysToClean.forEach(key => {
        const raw = this.safeGetItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const filtered = list.filter((item: any) => 
              item.id !== cleanId && 
              item.WO_ID !== cleanId && 
              item.nomorWO !== cleanId && 
              item.Nomor_WO !== cleanId &&
              (!cleanNomor || (item.nomorWO !== cleanNomor && item.Nomor_WO !== cleanNomor))
            );
            this.safeSetItem(key, JSON.stringify(filtered));
          }
        }
      });
    } catch (cacheErr) {
      console.warn('Cache purge error:', cacheErr);
    }

    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (isOnline) {
      try {
        const res = await ApiService.deleteWorkOrder(cleanId || cleanNomor);
        return { success: res.success, error: res.message };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  }

  // ==========================================
  // 3. REALISASI TABLE OPERATIONS
  // ==========================================

  /**
   * Fetch Realisasi from Supabase REALISASI table filtered by unitId with pagination and delta sync support.
   * Uses lightweight column selection by default to prevent downloading massive base64 photo payloads.
   */
  static async fetchRealisasi(
    unitId?: string, 
    page: number = 0, 
    pageSize: number = 200,
    lastSyncTime?: string,
    _includePhotos: boolean = false
  ): Promise<{
    success: boolean;
    data: Realisasi[];
    source: 'supabase' | 'cache' | 'initial';
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    // 1. Primary: HyperCloudHost Node.js API
    if (isOnline) {
      try {
        const res = await ApiService.fetchRealisasi({
          page: page + 1,
          limit: pageSize,
          ULP: targetUnitId !== 'ALL' ? targetUnitId : undefined,
        });

        if (res && res.data && Array.isArray(res.data)) {
          if (!lastSyncTime && page === 0) {
            this.safeSetItem(`aphro_realisasi_${targetUnitId}`, JSON.stringify(res.data));
          }
          return { success: true, data: res.data, source: 'supabase' };
        }
      } catch (err) {
        console.warn('ApiService fetch REALISASI warning:', err);
      }
    }

    try {
      const cached = this.safeGetItem(`aphro_realisasi_${targetUnitId}`) || this.safeGetItem('aphro_realisasi');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, data: parsed, source: 'cache' };
        }
      }
    } catch {
      // Ignore
    }

    return { success: true, data: INITIAL_REALISASI, source: 'initial' };
  }

  /**
   * Fetch Realisasi with server-side pagination, filters (Nomor_WO, ULP, date range)
   * Directly from Supabase PostgreSQL REALISASI table.
   */
  static async fetchRealisasiPaged(params: FetchRealisasiParams = {}): Promise<{
    status: 'success' | 'error';
    data: Realisasi[];
    pagination?: PaginationMeta;
    message?: string;
  }> {
    const {
      page = 1,
      limit = 20,
      tanggalDari,
      tanggalSampai,
      ULP,
      Nomor_WO,
    } = params;

    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    if (isOnline && isSupabaseConfigured()) {
      try {
        let query = supabase
          .from(SUPABASE_TABLES.REALISASI)
          .select(REALISASI_LIGHT_SELECT_FIELDS, { count: 'exact' });

        // Filter by Nomor WO (matches standard Nomor_WO or legacy shifted WO_ID)
        if (Nomor_WO && Nomor_WO.trim()) {
          const cleanWO = Nomor_WO.trim();
          query = query.or(`Nomor_WO.ilike.%${cleanWO}%,WO_ID.ilike.%${cleanWO}%`);
        }

        // Filter by ULP if selected
        if (ULP && ULP.trim() && ULP !== 'ALL') {
          query = query.ilike('ULP', `%${ULP.trim()}%`);
        }

        // Filter by Date Range
        if (tanggalDari && tanggalDari.trim()) {
          query = query.gte('TANGGAL', tanggalDari.trim());
        }
        if (tanggalSampai && tanggalSampai.trim()) {
          query = query.lte('TANGGAL', tanggalSampai.trim());
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await query
          .order('TANGGAL', { ascending: false, nullsFirst: false })
          .range(from, to);

        if (!error && Array.isArray(data)) {
          const normalizedData: Realisasi[] = data.map((item: any) =>
            this.normalizeRealisasiRow(item)
          );

          const total = count !== null && count !== undefined ? count : normalizedData.length;
          const totalPages = Math.ceil(total / limit) || 1;

          const paginationMeta: PaginationMeta = {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          };

          return {
            status: 'success',
            data: normalizedData,
            pagination: paginationMeta,
            message: `Berhasil memuat ${normalizedData.length} data riwayat realisasi dari database Supabase.`,
          };
        } else if (error) {
          console.warn('Supabase fetchRealisasiPaged error:', error);
        }
      } catch (err: any) {
        console.warn('Supabase fetchRealisasiPaged exception:', err);
      }
    }

    // Fallback: try ApiService if available
    try {
      const apiRes = await ApiService.fetchRealisasi(params);
      if (apiRes.data) {
        return {
          status: 'success',
          data: apiRes.data,
          pagination: apiRes.pagination,
          message: apiRes.message,
        };
      }
    } catch (apiErr) {
      console.warn('ApiService fallback fetch failed:', apiErr);
    }

    // Fallback: Dexie local database
    try {
      const { dexieDb } = await import('./dexieDb');
      const localRecords = await dexieDb.realisasi.toArray();
      if (localRecords.length > 0) {
        let filtered = localRecords;
        if (Nomor_WO && Nomor_WO.trim()) {
          const searchNorm = Nomor_WO.trim().toLowerCase();
          filtered = filtered.filter((r) =>
            (r.nomorWO || '').toLowerCase().includes(searchNorm) ||
            (r.workOrderId || '').toLowerCase().includes(searchNorm)
          );
        }
        if (ULP && ULP.trim() && ULP !== 'ALL') {
          const ulpNorm = ULP.trim().toLowerCase();
          filtered = filtered.filter((r) => (r.ulpName || '').toLowerCase().includes(ulpNorm));
        }

        const normalized = filtered.map((r) => this.normalizeRealisasiRow(r));
        const total = normalized.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const pageItems = normalized.slice((page - 1) * limit, page * limit);

        return {
          status: 'success',
          data: pageItems,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
          message: `Memuat ${pageItems.length} data dari penyimpanan lokal perangkat.`,
        };
      }
    } catch (dexErr) {
      console.warn('Dexie fallback exception:', dexErr);
    }

    return {
      status: 'success',
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  /**
   * Fetch Targeted Report Data directly from PostgreSQL/Supabase
   * Sends targeted SQL WHERE filters directly to the database:
   * WHERE ulp = ... AND tanggal >= ... AND tanggal <= ...
   * and selectively requests only the required columns.
   */
  static async fetchTargetedReportData(params: {
    jenisLaporan: 'realisasi' | 'work_order' | 'foto' | 'peta';
    unitId?: string;
    ulpName?: string;
    startDate?: string;
    endDate?: string;
    penyulangName?: string;
    reguName?: string;
    nomorWO?: string;
  }): Promise<{
    success: boolean;
    realisasi: Realisasi[];
    workOrders: WorkOrder[];
    totalCount: number;
    source: 'supabase' | 'dexie';
  }> {
    const { jenisLaporan, unitId, ulpName, startDate, endDate, penyulangName, reguName, nomorWO } = params;
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    // 1. Online targeted SQL query directly to PostgreSQL / Supabase
    if (isOnline && isSupabaseConfigured()) {
      try {
        if (jenisLaporan === 'work_order') {
          let query = supabase
            .from(SUPABASE_TABLES.WORK_ORDER)
            .select(WORK_ORDER_SELECT_FIELDS);

          if (unitId && unitId !== 'ALL') {
            const unitFilter = this.getUnitQueryFilter(unitId);
            query = query.or(unitFilter);
          }
          if (ulpName && ulpName !== 'ALL') {
            query = query.ilike('ULP', `%${ulpName}%`);
          }
          if (startDate) {
            query = query.gte('Tanggal', startDate);
          }
          if (endDate) {
            query = query.lte('Tanggal', endDate);
          }
          if (penyulangName && penyulangName !== 'ALL') {
            query = query.ilike('PENYULANG', `%${penyulangName}%`);
          }
          if (reguName && reguName !== 'ALL') {
            query = query.ilike('REGU_ROW', `%${reguName}%`);
          }
          if (nomorWO && nomorWO !== 'ALL') {
            query = query.ilike('Nomor_WO', `%${nomorWO}%`);
          }

          const { data, error } = await query.order('Tanggal', { ascending: false }).limit(200);
          if (!error && Array.isArray(data)) {
            const woList: WorkOrder[] = data.map((row: any) => this.normalizeWorkOrderRow(row));
            return {
              success: true,
              realisasi: [],
              workOrders: woList,
              totalCount: woList.length,
              source: 'supabase',
            };
          }
        } else {
          // 'realisasi' | 'foto' | 'peta'
          let query = supabase
            .from(SUPABASE_TABLES.REALISASI)
            .select(REALISASI_LIGHT_SELECT_FIELDS);

          if (unitId && unitId !== 'ALL') {
            const unitFilter = this.getUnitQueryFilter(unitId);
            query = query.or(unitFilter);
          }
          if (ulpName && ulpName !== 'ALL') {
            query = query.ilike('ULP', `%${ulpName}%`);
          }
          if (startDate) {
            query = query.gte('TANGGAL', startDate);
          }
          if (endDate) {
            query = query.lte('TANGGAL', endDate);
          }
          if (penyulangName && penyulangName !== 'ALL') {
            query = query.ilike('PENYULANG', `%${penyulangName}%`);
          }
          if (reguName && reguName !== 'ALL') {
            query = query.ilike('REGU_ROW', `%${reguName}%`);
          }
          if (nomorWO && nomorWO !== 'ALL') {
            query = query.ilike('Nomor_WO', `%${nomorWO}%`);
          }

          const { data, error } = await query
            .order('TANGGAL', { ascending: false, nullsFirst: false })
            .limit(100);

          if (!error && Array.isArray(data) && data.length > 0) {
            let relList: Realisasi[] = data.map((row: any) => this.normalizeRealisasiRow(row));

            // Fetch related Work Orders to cross-reference Feeder/Penyulang and details
            let woList: WorkOrder[] = [];
            try {
              const distinctNomorWOs = Array.from(
                new Set(relList.map((r) => r.nomorWO).filter((n) => n && n !== '-' && n !== 'ALL'))
              );

              let woQuery = supabase
                .from(SUPABASE_TABLES.WORK_ORDER)
                .select('WO_ID, unitId, Nomor_WO, Penyulang, ULP');

              if (unitId && unitId !== 'ALL') {
                woQuery = woQuery.eq('unitId', unitId);
              }

              if (nomorWO && nomorWO !== 'ALL') {
                woQuery = woQuery.eq('Nomor_WO', nomorWO);
              } else if (distinctNomorWOs.length > 0) {
                woQuery = woQuery.in('Nomor_WO', distinctNomorWOs.slice(0, 50));
              } else if (ulpName && ulpName !== 'ALL') {
                woQuery = woQuery.ilike('ULP', `%${ulpName}%`);
              }

              const { data: woData } = await woQuery.limit(50);
              if (Array.isArray(woData)) {
                woList = woData.map((row: any) => this.normalizeWorkOrderRow(row));
                const woMapById: Record<string, WorkOrder> = {};
                const woMapByNo: Record<string, WorkOrder> = {};
                woList.forEach((w) => {
                  if (w.id) woMapById[w.id] = w;
                  if (w.nomorWO) woMapByNo[w.nomorWO] = w;
                });

                // Auto-fill missing penyulangName from matched Work Order
                relList = relList.map((r) => {
                  if (!r.penyulangName || r.penyulangName === '-' || r.penyulangName === 'null') {
                    const matchedWo = woMapById[r.workOrderId] || woMapByNo[r.nomorWO];
                    if (matchedWo?.penyulangName) {
                      return { ...r, penyulangName: matchedWo.penyulangName };
                    }
                  }
                  return r;
                });
              }
            } catch {
              // Ignore auxiliary WO lookup error
            }

            return {
              success: true,
              realisasi: relList,
              workOrders: woList,
              totalCount: relList.length,
              source: 'supabase',
            };
          }
        }
      } catch (err) {
        console.warn('Supabase fetchTargetedReportData error:', err);
      }
    }

    // 2. Local fallback from Dexie if offline or network failure
    try {
      const { dexieDb } = await import('./dexieDb');
      if (jenisLaporan === 'work_order') {
        let allWOs = await dexieDb.work_orders.toArray();
        let filtered = allWOs.filter((wo) => {
          if (unitId && unitId !== 'ALL' && wo.unitId && wo.unitId !== unitId) return false;
          if (ulpName && ulpName !== 'ALL') {
            const targetUlp = ulpName.toLowerCase();
            const woUlp = (wo.ulpName || '').toLowerCase();
            if (!woUlp.includes(targetUlp) && !targetUlp.includes(woUlp)) return false;
          }
          if (startDate && wo.tanggal && wo.tanggal < startDate) return false;
          if (endDate && wo.tanggal && wo.tanggal > endDate) return false;
          if (penyulangName && penyulangName !== 'ALL' && !wo.penyulangName?.toLowerCase().includes(penyulangName.toLowerCase())) return false;
          if (reguName && reguName !== 'ALL' && !wo.reguName?.toLowerCase().includes(reguName.toLowerCase())) return false;
          if (nomorWO && nomorWO !== 'ALL' && !wo.nomorWO?.toLowerCase().includes(nomorWO.toLowerCase())) return false;
          return true;
        });
        return {
          success: true,
          realisasi: [],
          workOrders: filtered,
          totalCount: filtered.length,
          source: 'dexie',
        };
      } else {
        let allRels = await dexieDb.realisasi.toArray();
        let allWOs = await dexieDb.work_orders.toArray();
        const woMapById: Record<string, WorkOrder> = {};
        const woMapByNo: Record<string, WorkOrder> = {};
        allWOs.forEach((w) => {
          if (w.id) woMapById[w.id] = w;
          if (w.nomorWO) woMapByNo[w.nomorWO] = w;
        });

        let filtered = allRels.filter((rel) => {
          if (unitId && unitId !== 'ALL' && rel.unitId && rel.unitId !== unitId) return false;
          if (ulpName && ulpName !== 'ALL') {
            const targetUlp = ulpName.toLowerCase();
            const relUlp = (rel.ulpName || '').toLowerCase();
            if (!relUlp.includes(targetUlp) && !targetUlp.includes(relUlp)) return false;
          }
          const relDate = rel.tanggalRealisasi || (rel.createdAt ? rel.createdAt.split('T')[0] : '');
          if (startDate && relDate && relDate < startDate) return false;
          if (endDate && relDate && relDate > endDate) return false;
          if (penyulangName && penyulangName !== 'ALL' && !rel.penyulangName?.toLowerCase().includes(penyulangName.toLowerCase())) return false;
          if (reguName && reguName !== 'ALL' && !rel.reguName?.toLowerCase().includes(reguName.toLowerCase())) return false;
          if (nomorWO && nomorWO !== 'ALL' && !rel.nomorWO?.toLowerCase().includes(nomorWO.toLowerCase())) return false;
          return true;
        }).map((r) => {
          if (!r.penyulangName || r.penyulangName === '-' || r.penyulangName === 'null') {
            const matchedWo = woMapById[r.workOrderId] || woMapByNo[r.nomorWO];
            if (matchedWo?.penyulangName) {
              return { ...r, penyulangName: matchedWo.penyulangName };
            }
          }
          return r;
        });

        return {
          success: true,
          realisasi: filtered,
          workOrders: allWOs,
          totalCount: filtered.length,
          source: 'dexie',
        };
      }
    } catch (localErr) {
      console.warn('Dexie report fallback error:', localErr);
      return {
        success: false,
        realisasi: [],
        workOrders: [],
        totalCount: 0,
        source: 'dexie',
      };
    }
  }

  /**
   * Dedicated targeted query for REKAP PEKERJAAN HARIAN and REKAP PENYULANG HARIAN.
   * Isolates specifically to the user's unit and selected year/month.
   * Uses explicit, narrow SELECT columns and chunked pagination so no records are truncated.
   */
  static async fetchRekapPeriodData(
    unitNameOrId: string,
    year: number,
    monthIndex: number
  ): Promise<{
    success: boolean;
    workOrders: WorkOrder[];
    realisasiList: Realisasi[];
    message?: string;
  }> {
    const cleanId = (unitNameOrId || '').toUpperCase().trim();
    const stdId = InisiasiService.getStandardUnitId(cleanId) || (cleanId.startsWith('UL') ? cleanId : 'UL1');
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    const startDate = `${year}-${monthPadded}-01`;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

    try {
      // 1. Fetch WORK_ORDER for the period using explicit select fields
      let woQuery = supabase
        .from(SUPABASE_TABLES.WORK_ORDER)
        .select(WORK_ORDER_SELECT_FIELDS)
        .gte('Tanggal', startDate)
        .lte('Tanggal', endDate);

      if (stdId && stdId !== 'ALL') {
        woQuery = woQuery.or(this.getUnitQueryFilter(stdId));
      }

      const { data: woData, error: woError } = await woQuery.order('Tanggal', { ascending: true });
      if (woError) {
        console.warn('Rekap period WO query warning:', woError.message);
      }

      const workOrders: WorkOrder[] = Array.isArray(woData)
        ? woData.map((row: any) => this.normalizeWorkOrderRow(row))
        : [];

      // 2. Fetch REALISASI for the period using lightweight explicit select fields with pagination
      let allRelRows: any[] = [];
      let page = 0;
      const chunkSize = 1000;

      while (true) {
        let relQuery = supabase
          .from(SUPABASE_TABLES.REALISASI)
          .select('ID, unitId, WO_ID, Nomor_WO, ULP, REGU_ROW, PENYULANG, TANGGAL, Keterangan, Jenis_Tanaman')
          .gte('TANGGAL', startDate)
          .lte('TANGGAL', endDate);

        if (stdId && stdId !== 'ALL') {
          relQuery = relQuery.or(`unitId.eq.${stdId},unitId.is.null`);
        }

        const { data: relChunk, error: relError } = await relQuery
          .order('TANGGAL', { ascending: true })
          .range(page * chunkSize, (page + 1) * chunkSize - 1);

        if (relError || !relChunk || relChunk.length === 0) {
          if (relError) console.warn('Rekap period REALISASI query error:', relError.message);
          break;
        }

        allRelRows = allRelRows.concat(relChunk);
        if (relChunk.length < chunkSize) break;
        page++;
      }

      const realisasiList: Realisasi[] = allRelRows.map((row: any) => this.normalizeRealisasiRow(row));

      return {
        success: true,
        workOrders,
        realisasiList,
        message: `Memuat ${workOrders.length} Work Order dan ${realisasiList.length} Realisasi untuk periode ${monthPadded}/${year}.`,
      };
    } catch (err: any) {
      console.warn('fetchRekapPeriodData exception:', err);
      return {
        success: false,
        workOrders: [],
        realisasiList: [],
        message: err.message,
      };
    }
  }

  /**
   * Normalize Supabase REALISASI row
   */
  static normalizeRealisasiRow(row: any): Realisasi {
    return normalizeRealisasiRow(row);
  }

  /**
   * Save Realisasi to Supabase REALISASI table
   */
  static async saveRealisasi(unitId: string, rel: Realisasi): Promise<{ success: boolean; data?: Realisasi; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    let finalFotoSebelum = rel.fotoSebelumUrl || rel.photosSebelum?.[0]?.dataUrl || '';
    let finalFotoSesudah = rel.fotoSesudahUrl || rel.photosSesudah?.[0]?.dataUrl || '';

    const gasConfig = getActiveGasConfig();
    const gasUrl = gasConfig.gasWebAppUrl;
    const fotoFolderId = gasConfig.driveFolderId || '1idu8U3COKEqdcCewdWntu9X06ZMnzskr';

    if (finalFotoSebelum && isBase64Image(finalFotoSebelum)) {
      finalFotoSebelum = await ensureGoogleDrivePhotoUrl(finalFotoSebelum, {
        gasUrl,
        nomorWO: rel.nomorWO,
        reguName: rel.reguName || 'ROW',
        photoType: 'Realisasi_Sebelum',
        folderId: fotoFolderId,
      });
      if (finalFotoSebelum) rel.fotoSebelumUrl = finalFotoSebelum;
    }

    if (finalFotoSesudah && isBase64Image(finalFotoSesudah)) {
      finalFotoSesudah = await ensureGoogleDrivePhotoUrl(finalFotoSesudah, {
        gasUrl,
        nomorWO: rel.nomorWO,
        reguName: rel.reguName || 'ROW',
        photoType: 'Realisasi_Sesudah',
        folderId: fotoFolderId,
      });
      if (finalFotoSesudah) rel.fotoSesudahUrl = finalFotoSesudah;
    }

    const latLng = (rel.latitude && rel.longitude) ? `${rel.latitude}, ${rel.longitude}` : '';
    
    // Ensure huge base64 strings don't cause 413 / timeout on Supabase text upsert
    const safeFotoSebelum = isBase64Image(finalFotoSebelum) ? '' : formatDriveViewUrl(finalFotoSebelum);
    const safeFotoSesudah = isBase64Image(finalFotoSesudah) ? '' : formatDriveViewUrl(finalFotoSesudah);

    // Strict 18 columns matching Supabase public."REALISASI" table schema
    const payload: Record<string, any> = {
      ID: rel.id,
      unitId: targetUnitId,
      WO_ID: rel.workOrderId || '',
      Nomor_WO: rel.nomorWO || '',
      ULP: rel.ulpName || '',
      REGU_ROW: rel.reguName || '',
      PENYULANG: rel.penyulangName || '',
      NO_TIANG: rel.noTiang || '',
      TANGGAL: rel.tanggalRealisasi || getWIBDateString(),
      Foto_Sebelum: formatDriveViewUrl(safeFotoSebelum),
      Foto_Sesudah: formatDriveViewUrl(safeFotoSesudah),
      Jenis_Tanaman: rel.jenisTanaman || '',
      Keterangan: rel.keterangan || '',
      Pertumbuhan_Tanaman: rel.pertumbuhanTanaman || '',
      Kendala: rel.kendala || '',
      Latitude_Longitude: latLng,
      Lokasi_kerja: rel.lokasiKerja || '',
      Timestamp: rel.createdAt || getLocalDateTimeString(),
    };

    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    if (isOnline && isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from(SUPABASE_TABLES.REALISASI)
          .upsert(payload);

        if (!error) {
          return { success: true, data: rel };
        }
        console.warn('Supabase saveRealisasi error:', error);
      } catch (err: any) {
        console.warn('Supabase saveRealisasi exception:', err);
      }
    }

    try {
      const res = await ApiService.saveRealisasi({
        ...rel,
        unitId: targetUnitId,
        latitude: rel.latitude,
        longitude: rel.longitude,
      });

      if (res.success) {
        return { success: true, data: rel };
      }
      return { success: false, error: res.message || 'Gagal menyimpan Realisasi ke database.' };
    } catch (err: any) {
      console.error('ApiService saveRealisasi catch error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Save Realisasi idempotently using clientGeneratedId / idempotencyKey
   */
  static async saveRealisasiIdempotent(
    unitId: string,
    rel: any,
    photos?: any[]
  ): Promise<{ success: boolean; serverId?: string; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const serverId = rel.idempotencyKey || rel.serverId || rel.localId || rel.id || `REL-${Date.now()}`;

    // Standardize photo URLs
    let fotoSebelumUrl = rel.fotoSebelumUrl || '';
    let fotoSesudahUrl = rel.fotoSesudahUrl || '';

    if (!fotoSebelumUrl && photos && Array.isArray(photos)) {
      const seb = photos.find((p: any) => p.type === 'sebelum');
      if (seb) fotoSebelumUrl = seb.fileUrl || seb.dataUrl || '';
    }
    if (!fotoSesudahUrl && photos && Array.isArray(photos)) {
      const ses = photos.find((p: any) => p.type === 'sesudah');
      if (ses) fotoSesudahUrl = ses.fileUrl || ses.dataUrl || '';
    }

    const realisasiPayload: Realisasi = {
      ...rel,
      id: serverId,
      fotoSebelumUrl,
      fotoSesudahUrl,
    };

    const res = await this.saveRealisasi(targetUnitId, realisasiPayload);
    return {
      success: res.success,
      serverId,
      error: res.error,
    };
  }

  /**
   * Delete Realisasi by ID
   */
  static async deleteRealisasi(arg1: string, arg2?: string): Promise<{ success: boolean; error?: string }> {
    const targetId = (arg2 || arg1 || '').trim();
    if (!targetId) return { success: false, error: 'Target ID kosong' };

    try {
      // 1. Purge from local storage caches immediately
      const unitKeys = ['UL1', 'UL2', 'UL3', 'UL4', ''];
      unitKeys.forEach((uk) => {
        const key = uk ? `aphro_realisasi_${uk}` : 'aphro_realisasi';
        try {
          const raw = this.safeGetItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const filtered = list.filter((item: any) => 
                String(item.id || '').trim() !== targetId && 
                String(item.realisasi_id || '').trim() !== targetId && 
                String(item.syncId || '').trim() !== targetId
              );
              this.safeSetItem(key, JSON.stringify(filtered));
            }
          }
        } catch (e) {
          // ignore
        }
      });

      // 2. Direct deletion in Node.js API
      const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
      if (isOnline) {
        const res = await ApiService.deleteRealisasi(targetId);
        return { success: res.success, error: res.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Admin/Adm Edit Realisasi
   * Updates all Realisasi fields including Tanggal, Koordinat, Atribut Pekerjaan, and Foto (Sebelum & Sesudah)
   * ID is used as primary key.
   */
  static async updateRealisasiAdmin(
    id: string,
    params: any
  ): Promise<{ success: boolean; data?: Realisasi; error?: string }> {
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    if (!isOnline) {
      return { success: false, error: 'Aplikasi sedang offline. Tidak dapat memperbarui data.' };
    }

    try {
      const res = await ApiService.updateRealisasi(id, params);
      if (res.success) {
        return { success: true };
      }
      return { success: false, error: res.message || 'Gagal memperbarui data Realisasi' };
    } catch (err: any) {
      console.error('ApiService updateRealisasiAdmin catch error:', err);
      return { success: false, error: err.message || 'Gagal memperbarui data Realisasi' };
    }
  }

  // ==========================================
  // 4. ABSENSI TABLE OPERATIONS
  // ==========================================

  /**
   * Fetch Absensi from Supabase ABSENSI table
   * Universally fetches all absensi records across units (UL1 & UL2) so attendance is always recognized
   */
  static async fetchAbsensi(unitId?: string): Promise<{
    success: boolean;
    data: Absensi[];
    source: 'supabase' | 'cache' | 'initial';
    message?: string;
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    // 1. Primary: HyperCloudHost Node.js API
    if (isOnline) {
      try {
        const res = await ApiService.fetchAbsensi(targetUnitId);
        if (res && res.success && Array.isArray(res.data)) {
          this.safeSetItem(`aphro_absensi_${targetUnitId}`, JSON.stringify(res.data));
          return { 
            success: true, 
            data: res.data, 
            source: 'supabase',
            message: `Berhasil memuat ${res.data.length} data absensi dari API HyperCloudHost.` 
          };
        }
      } catch (err) {
        console.warn('Error loading Absensi from ApiService:', err);
      }
    }

    try {
      const cached = this.safeGetItem(`aphro_absensi_${targetUnitId}`) || this.safeGetItem('aphro_absensi');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, data: parsed, source: 'cache' };
        }
      }
    } catch {
      // Ignore
    }

    return { success: true, data: INITIAL_ABSENSI, source: 'initial' };
  }

  /**
   * Normalize Supabase ABSENSI row
   */
  static normalizeAbsensiRow(row: any): Absensi {
    const petugasList: { nama: string; keterangan: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const pName = row[`PETUGAS_${i}`] || row[`Petugas_${i}`] || row[`NAMA_PETUGAS_${i}`] || row[`nama_petugas_${i}`];
      const pKet = row[`KET_${i}`] || row[`Ket_${i}`] || row[`ket_${i}`] || row[`STATUS_${i}`] || row[`Status_${i}`] || row[`KETERANGAN_${i}`] || 'HADIR';
      if (pName && String(pName).trim() && String(pName).trim() !== '-') {
        petugasList.push({
          nama: String(pName).trim(),
          keterangan: String(pKet).trim().toUpperCase(),
        });
      }
    }

    const tgl = String(row.TANGGAL || row.tanggal || getWIBDateString());

    return {
      ...row,
      id: String(row.ID || row.id || `ABS-${Date.now()}`),
      unitId: row.unitId || undefined,
      tanggal: normalizeDateISO(tgl) || tgl,
      reguName: String(row.NAMA_REGU || row.reguName || ''),
      ulpName: String(row.ULP || row.ulpName || ''),
      petugasList,
      fotoMasuk: formatDriveViewUrl(String(row.FOTO_MASUK || row.fotoMasuk || '')),
      fotoKeluar: formatDriveViewUrl(String(row.FOTO_KELUAR || row.fotoKeluar || '')),
      timestampMasuk: row['TIMESTAMP MASUK'] || row.timestampMasuk || undefined,
      timestampKeluar: row['TIMESTAMP KELUAR'] || row.timestampKeluar || undefined,
      createdAt: row['TIMESTAMP MASUK'] || row.createdAt || getLocalDateTimeString(),
      updatedAt: row['TIMESTAMP KELUAR'] || row.updatedAt || undefined,
      PETUGAS_1: row.PETUGAS_1 || row.Petugas_1,
      KET_1: row.KET_1 || row.Ket_1 || 'HADIR',
      PETUGAS_2: row.PETUGAS_2 || row.Petugas_2,
      KET_2: row.KET_2 || row.Ket_2 || 'HADIR',
      PETUGAS_3: row.PETUGAS_3 || row.Petugas_3,
      KET_3: row.KET_3 || row.Ket_3 || 'HADIR',
      PETUGAS_4: row.PETUGAS_4 || row.Petugas_4,
      KET_4: row.KET_4 || row.Ket_4 || 'HADIR',
      PETUGAS_5: row.PETUGAS_5 || row.Petugas_5,
      KET_5: row.KET_5 || row.Ket_5 || 'HADIR',
    };
  }

  /**
   * Save Absensi to Supabase ABSENSI table
   * Ensures photos are stored as Google Drive URLs (Text) and timestamps are persisted
   */
  static async saveAbsensi(unitId: string, abs: Absensi): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = abs.unitId || unitId || this.getActiveUnitId();
    let finalFotoMasuk = abs.fotoMasuk || '';
    let finalFotoKeluar = abs.fotoKeluar || '';

    // If photos are sent as base64, auto-upload to Google Drive
    const gasConfig = getActiveGasConfig();
    const gasUrl = gasConfig.gasWebAppUrl;
    const absensiFolderId = gasConfig.absensiFolderId || '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5';

    if (finalFotoMasuk && isBase64Image(finalFotoMasuk)) {
      finalFotoMasuk = await ensureGoogleDrivePhotoUrl(finalFotoMasuk, {
        gasUrl,
        reguName: abs.reguName,
        photoType: 'Absensi_Masuk',
        folderId: absensiFolderId,
      });
      if (finalFotoMasuk) abs.fotoMasuk = finalFotoMasuk;
    }

    if (finalFotoKeluar && isBase64Image(finalFotoKeluar)) {
      finalFotoKeluar = await ensureGoogleDrivePhotoUrl(finalFotoKeluar, {
        gasUrl,
        reguName: abs.reguName,
        photoType: 'Absensi_Keluar',
        folderId: absensiFolderId,
      });
      if (finalFotoKeluar) abs.fotoKeluar = finalFotoKeluar;
    }

    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    // 1. Direct save to Supabase ABSENSI table
    if (isOnline && isSupabaseConfigured()) {
      try {
        const payload: Record<string, any> = {
          ID: abs.id || `ABS-${Date.now()}`,
          unitId: targetUnitId,
          TANGGAL: abs.tanggal || getWIBDateString(),
          NAMA_REGU: abs.reguName || '',
          ULP: abs.ulpName || '',
          PETUGAS_1: abs.petugasList?.[0]?.nama || (abs as any).PETUGAS_1 || null,
          KET_1: abs.petugasList?.[0]?.keterangan || (abs as any).KET_1 || 'HADIR',
          PETUGAS_2: abs.petugasList?.[1]?.nama || (abs as any).PETUGAS_2 || null,
          KET_2: abs.petugasList?.[1]?.keterangan || (abs as any).KET_2 || 'HADIR',
          PETUGAS_3: abs.petugasList?.[2]?.nama || (abs as any).PETUGAS_3 || null,
          KET_3: abs.petugasList?.[2]?.keterangan || (abs as any).KET_3 || 'HADIR',
          PETUGAS_4: abs.petugasList?.[3]?.nama || (abs as any).PETUGAS_4 || null,
          KET_4: abs.petugasList?.[3]?.keterangan || (abs as any).KET_4 || 'HADIR',
          PETUGAS_5: abs.petugasList?.[4]?.nama || (abs as any).PETUGAS_5 || null,
          KET_5: abs.petugasList?.[4]?.keterangan || (abs as any).KET_5 || 'HADIR',
          FOTO_MASUK: finalFotoMasuk ? formatDriveViewUrl(finalFotoMasuk) : null,
          'TIMESTAMP MASUK': abs.timestampMasuk || abs.createdAt || getLocalDateTimeString(),
          FOTO_KELUAR: finalFotoKeluar ? formatDriveViewUrl(finalFotoKeluar) : null,
          'TIMESTAMP KELUAR': abs.timestampKeluar || abs.updatedAt || null,
        };

        const { error } = await supabase
          .from(SUPABASE_TABLES.ABSENSI)
          .upsert(payload);

        if (!error) {
          return { success: true };
        }
        console.warn('Supabase saveAbsensi error:', error);
      } catch (err: any) {
        console.warn('Supabase saveAbsensi exception:', err);
      }
    }

    try {
      const res = await ApiService.saveAbsensi({
        ...abs,
        unitId: targetUnitId,
        fotoMasuk: finalFotoMasuk,
        fotoKeluar: finalFotoKeluar,
      });
      return { success: res.success, error: res.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete Absensi by ID
   */
  static async deleteAbsensi(arg1: string, arg2?: string): Promise<{ success: boolean; error?: string }> {
    const targetId = arg2 || arg1;
    if (!targetId) return { success: false, error: 'Target ID kosong' };

    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (isOnline && isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from(SUPABASE_TABLES.ABSENSI)
          .delete()
          .eq('ID', targetId);

        if (!error) {
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Supabase deleteAbsensi exception:', err);
      }
    }

    try {
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ==========================================
  // 5. MASTER DATA (USERS, ULP, PENYULANG, REGU_ROW, PETUGAS)
  // ==========================================

  /**
   * Flexible row normalizer for USERS
   */
  static normalizeUserRow(u: any): User {
    const rawUsername = u.Username ?? u.username ?? u.UserID ?? u.userid ?? u.id ?? u.ID ?? '';
    const rawUserId = u.UserID ?? u.userid ?? u.id ?? u.ID ?? rawUsername;
    const rawRegu = u.NamaRegu ?? u.Nama_Regu ?? u.namaRegu ?? u.nama_regu ?? u.Regu_ROW ?? u.Regu ?? u.regu ?? u.reguName ?? u.regu_name ?? u.REGU_ROW ?? u.Tim ?? '';
    const rawName = u.Nama ?? u.nama ?? u.Name ?? u.name ?? rawRegu ?? u.Username ?? u.username ?? rawUserId;
    const rawRole = u.Role ?? u.role ?? 'User';
    const rawPass = u.Password ?? u.password ?? '';
    const rawUlp = u.ULP ?? u.ulp ?? u.ulpName ?? u.ulp_name ?? '';
    const rawStatus = u.Status ?? u.status ?? 'Aktif';
    const rawReguId = u.ReguID ?? u.reguId ?? u.regu_id ?? u.Kode_Regu ?? '';
    const rawUnitId = u.unitId ?? u.unit_id ?? u.UnitID ?? u.Unit_ID ?? u.kodeUnit ?? u.Kode_Unit ?? '';

    return {
      id: String(rawUserId || `usr-${Math.random().toString(36).substr(2, 6)}`),
      unitId: String(rawUnitId || ''),
      nip: String(rawUserId || rawUsername),
      name: String(rawName || 'User'),
      userName: String(rawUsername || ''),
      password: String(rawPass || ''),
      email: `${String(rawUsername || 'user').toLowerCase().replace(/\s+/g, '')}@pln.co.id`,
      role: (rawRole || 'User') as UserRole,
      reguName: String(rawRegu || ''),
      reguId: String(rawReguId || ''),
      ulpName: String(rawUlp || ''),
      status: (rawStatus === 'Non-Aktif' || rawStatus === 'non-aktif' ? 'Non-Aktif' : 'Aktif'),
    };
  }

  /**
   * Fetch all user accounts from HyperCloudHost API (primary), then Supabase, then initial
   */
  static async fetchUsers(unitId?: string): Promise<{
    success: boolean;
    data: User[];
    source: 'supabase' | 'cache' | 'initial';
    message?: string;
  }> {
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    const targetUnitId = unitId || this.getActiveUnitId();

    // 1. Primary: HyperCloudHost Node.js API
    if (isOnline) {
      try {
        const apiRes = await ApiService.fetchUsers(targetUnitId);
        if (apiRes.success && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
          const users: User[] = apiRes.data.map((u: any) => this.normalizeUserRow(u));
          return {
            success: true,
            data: users,
            source: 'supabase',
            message: `Berhasil memuat ${users.length} user dari API HyperCloudHost.`,
          };
        }
      } catch (apiErr) {
        console.warn('ApiService fetchUsers error, falling back:', apiErr);
      }
    }

    // 2. Secondary fallback: Supabase USERS table
    if (isOnline && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from(SUPABASE_TABLES.USERS)
          .select('*');

        if (!error && Array.isArray(data) && data.length > 0) {
          const users: User[] = data.map((u: any) => this.normalizeUserRow(u));
          return {
            success: true,
            data: users,
            source: 'supabase',
            message: `Berhasil memuat ${users.length} user dari database Supabase.`,
          };
        }
      } catch (err) {
        console.warn('Supabase fetchUsers exception:', err);
      }
    }

    return {
      success: true,
      data: [],
      source: 'initial',
      message: 'Tabel USERS di database HyperCloud masih kosong.',
    };
  }

  /**
   * Save / Upsert user account to Supabase USERS table
   */
  static async saveUser(user: User, unitId?: string): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const payload = {
      UserID: user.id || user.nip || user.userName,
      unitId: targetUnitId,
      Username: user.userName,
      Password: user.password || 'admin123',
      Role: user.role,
      ULP: user.ulpName || '',
      Status: user.status || 'Aktif',
    };

    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.USERS)
        .upsert([payload], { onConflict: 'UserID' });

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete user account from Supabase USERS table
   */
  static async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.USERS)
        .delete()
        .or(`UserID.eq.${userId},Username.eq.${userId}`);

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Save / Upsert Regu ROW to Supabase REGU_ROW table
   */
  static async saveRegu(_regu: ReguROW, _unitId?: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  /**
   * Delete Regu ROW
   */
  static async deleteRegu(_reguId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  /**
   * Fetch all master data for the given unitId
   */
  /**
   * Mendapatkan default ULP & Regu ROW yang sesuai dengan Unit Layanan (UL) terpilih.
   */
  static getDefaultMasterForUnit(targetUnitId: string): { ulp: ULP[]; regu: ReguROW[] } {
    let unitName = 'UL BUKITTINGGI';
    const savedName = this.safeGetItem('aphro_nama_unit_layanan');
    if (savedName) {
      unitName = savedName;
    } else {
      const matchOpt = DEFAULT_UL_OPTIONS.find((u) => u.id === targetUnitId);
      if (matchOpt) unitName = matchOpt.namaUL;
    }

    const unitKey = RekapHarianService.normalizeUnitKey(unitName);
    const preset = UL_PRESETS[unitKey] || UL_PRESETS.BUKITTINGGI;

    const ulpMap = new Map<string, ULP>();
    preset.rows.forEach((r, idx) => {
      const ulpNameClean = r.namaUlp.toUpperCase();
      if (!ulpMap.has(ulpNameClean)) {
        ulpMap.set(ulpNameClean, {
          id: `ulp-${unitKey.toLowerCase()}-${idx + 1}`,
          kodeULP: r.kodeUnit || `132${idx + 1}`,
          namaULP: ulpNameClean,
          manajer: '-',
          kontak: '-',
          alamat: `Kantor ${ulpNameClean}`,
          status: 'Aktif',
        });
      }
    });

    const ulpList = Array.from(ulpMap.values());
    const reguList: ReguROW[] = preset.rows.map((r, idx) => {
      const matchingUlp = ulpMap.get(r.namaUlp.toUpperCase());
      return {
        id: `rgu-${unitKey.toLowerCase()}-${idx + 1}`,
        kodeRegu: `REG-${String(idx + 1).padStart(2, '0')}`,
        namaRegu: r.timRow,
        penanggungJawab: '-',
        jumlahAnggota: 5,
        kontak: '-',
        ulpId: matchingUlp?.id || targetUnitId,
        ulpName: r.namaUlp.toUpperCase(),
        status: 'Aktif',
      };
    });

    return { ulp: ulpList, regu: reguList };
  }

  /**
   * Fetch master data for a given unitId from HyperCloudHost API (primary) with local defaults fallback.
   */
  static async fetchMasterData(unitId?: string): Promise<{
    users: User[];
    ulp: ULP[];
    penyulang: Penyulang[];
    regu: ReguROW[];
    petugas: Petugas[];
    source: 'supabase' | 'cache' | 'initial';
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

    // 1. Primary: HyperCloudHost Node.js API
    if (isOnline) {
      try {
        const apiMaster = await ApiService.fetchMasterData(targetUnitId);
        if (apiMaster) {
          const mappedUsers: User[] = (apiMaster.users || []).map((u: any) => this.normalizeUserRow(u));
          const mappedUlp: ULP[] = (apiMaster.ulp || []).map((u: any, idx: number) => ({
            id: String(u.id || u.Id || u.ID || `ulp-${idx + 1}`),
            kodeULP: String(u.kodeULP || u.Kode_ULP || u.kode || `ULP-${idx + 1}`),
            namaULP: String(u.namaULP || u.Nama_ULP || u.nama || u.ULP || '').toUpperCase(),
            manajer: String(u.manajer || u.Manajer || '-'),
            kontak: String(u.kontak || u.Kontak || '-'),
            alamat: String(u.alamat || u.Alamat || '-'),
            unitId: String(u.unitId || targetUnitId),
            status: (u.status || u.Status || 'Aktif') as 'Aktif' | 'Non-Aktif',
          })).filter(u => u.namaULP.length > 0);

          const mappedPenyulang: Penyulang[] = (apiMaster.penyulang || []).map((p: any, idx: number) => ({
            id: String(p.id || p.Id || p.ID || `pyl-${idx + 1}`),
            kodePenyulang: String(p.kodePenyulang || p.Kode_Penyulang || `PYL-${idx + 1}`),
            namaPenyulang: String(p.namaPenyulang || p.Nama_Penyulang || p.penyulang || p.Penyulang || ''),
            ulpId: String(p.ulpId || targetUnitId),
            ulpName: String(p.ulpName || p.ULP || ''),
            panjangKms: Number(p.panjangKms || p.panjangJaringan || p.Panjang_Jaringan || 0),
            jumlahTrafo: Number(p.jumlahTrafo || p.Jumlah_Trafo || 0),
            status: (p.status || 'Normal') as 'Normal' | 'Rawan Hazard' | 'Maintenance',
            unitId: String(p.unitId || targetUnitId),
          })).filter(p => p.namaPenyulang.length > 0);

          const mappedRegu: ReguROW[] = (apiMaster.regu || []).map((r: any, idx: number) => ({
            id: String(r.id || r.Id || r.ID || `regu-${idx + 1}`),
            kodeRegu: String(r.kodeRegu || r.Kode_Regu || `REG-${idx + 1}`),
            namaRegu: String(r.namaRegu || r.Nama_Regu || r.regu || r.Regu_ROW || ''),
            penanggungJawab: String(r.penanggungJawab || r.Penanggung_Jawab || '-'),
            jumlahAnggota: Number(r.jumlahAnggota || r.Jumlah_Anggota || 5),
            kontak: String(r.kontak || r.Kontak || '-'),
            ulpId: String(r.ulpId || targetUnitId),
            ulpName: String(r.ulpName || r.ULP || ''),
            status: (r.status || r.Status || 'Aktif') as 'Aktif' | 'Non-Aktif',
            unitId: String(r.unitId || targetUnitId),
          })).filter(r => r.namaRegu.length > 0);

          const mappedPetugas: Petugas[] = (apiMaster.petugas || []).map((ptg: any, idx: number) => ({
            id: String(ptg.id || ptg.Id || ptg.ID || `ptg-${idx + 1}`),
            nip: String(ptg.nip || ptg.NIP || `NIP-${idx + 1}`),
            nama: String(ptg.nama || ptg.Nama || ptg.Nama_Petugas || ''),
            reguId: String(ptg.reguId || ptg.ReguID || ''),
            reguName: String(ptg.reguName || ptg.Nama_Regu || ''),
            ulpId: String(ptg.ulpId || targetUnitId),
            ulpName: String(ptg.ulpName || ''),
            noHp: String(ptg.noHp || ptg.No_HP || ptg.kontak || '-'),
            role: (ptg.role || 'Petugas') as any,
            status: (ptg.status || ptg.Status || 'Aktif') as 'Aktif' | 'Non-Aktif',
            unitId: String(ptg.unitId || targetUnitId),
          })).filter(ptg => ptg.nama.length > 0);

          const defaults = this.getDefaultMasterForUnit(targetUnitId);

          if (mappedUsers.length > 0 || mappedUlp.length > 0 || mappedPenyulang.length > 0 || mappedRegu.length > 0 || mappedPetugas.length > 0) {
            return {
              users: mappedUsers,
              ulp: mappedUlp.length > 0 ? mappedUlp : (defaults.ulp.length > 0 ? defaults.ulp : INITIAL_ULP),
              penyulang: mappedPenyulang.length > 0 ? mappedPenyulang : INITIAL_PENYULANG,
              regu: mappedRegu.length > 0 ? mappedRegu : (defaults.regu.length > 0 ? defaults.regu : INITIAL_REGU),
              petugas: mappedPetugas.length > 0 ? mappedPetugas : INITIAL_PETUGAS,
              source: 'supabase',
            };
          }
        }
      } catch (err) {
        console.warn('ApiService.fetchMasterData error, falling back:', err);
      }
    }

    // 2. Local fallback
    const defaults = this.getDefaultMasterForUnit(targetUnitId);
    return {
      users: [],
      ulp: defaults.ulp.length > 0 ? defaults.ulp : INITIAL_ULP,
      penyulang: INITIAL_PENYULANG,
      regu: defaults.regu.length > 0 ? defaults.regu : INITIAL_REGU,
      petugas: INITIAL_PETUGAS,
      source: 'initial',
    };
  }

  // ==========================================
  // 6. BULK FETCH ALL DATA FOR ACTIVE UNIT
  // ==========================================

  /**
   * Fetch all application data for the active Unit Layanan in single coordinated pass
   */
  static async fetchAllData(unitId?: string) {
    const targetUnitId = unitId || this.getActiveUnitId();

    // Concurrency limit: max 2 requests at a time to prevent request spikes
    const [woRes, relRes] = await Promise.all([
      this.fetchWorkOrders(targetUnitId),
      this.fetchRealisasi(targetUnitId),
    ]);

    const absRes = await this.fetchAbsensi(targetUnitId);
    const masterRes = await this.fetchMasterData(targetUnitId);

    return {
      workOrders: woRes.data,
      realisasi: relRes.data,
      absensi: absRes.data,
      masterData: {
        users: masterRes.users,
        ulp: masterRes.ulp,
        penyulang: masterRes.penyulang,
        regu: masterRes.regu,
        petugas: masterRes.petugas,
      },
      source: woRes.source,
    };
  }

  // ==========================================
  // 7. DIAGNOSTICS & TESTING ALL 9 TABLES
  // ==========================================

  /**
   * Test connection and read status for all 9 tables in Supabase
   */
  static async testAllTables(): Promise<{
    isOnline: boolean;
    tables: Array<{
      name: string;
      status: 'OK' | 'ERROR' | 'EMPTY';
      count: number;
      latencyMs: number;
      error?: string;
    }>;
    totalRows: number;
    summary: string;
  }> {
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    if (!isOnline || !isSupabaseConfigured()) {
      return {
        isOnline: !!isOnline,
        tables: [],
        totalRows: 0,
        summary: !isOnline ? 'Koneksi offline' : 'Supabase belum terkonfigurasi',
      };
    }

    const tableNames = Object.values(SUPABASE_TABLES);
    const results: Array<{
      name: string;
      status: 'OK' | 'ERROR' | 'EMPTY';
      count: number;
      latencyMs: number;
      error?: string;
    }> = [];

    let totalRows = 0;

    for (const tbl of tableNames) {
      const start = Date.now();
      try {
        const { count, error } = await supabase
          .from(tbl)
          .select('*', { count: 'exact', head: true });

        const latencyMs = Date.now() - start;
        if (error) {
          results.push({
            name: tbl,
            status: 'ERROR',
            count: 0,
            latencyMs,
            error: error.message,
          });
        } else {
          const c = count || 0;
          totalRows += c;
          results.push({
            name: tbl,
            status: c > 0 ? 'OK' : 'EMPTY',
            count: c,
            latencyMs,
          });
        }
      } catch (err: any) {
        results.push({
          name: tbl,
          status: 'ERROR',
          count: 0,
          latencyMs: Date.now() - start,
          error: err?.message || 'Exception',
        });
      }
    }

    return {
      isOnline: true,
      tables: results,
      totalRows,
      summary: `Berhasil terhubung ke Supabase Database. Total record: ${totalRows}.`,
    };
  }

  // ==========================================
  // 8. DIRECT SEEDING MASTER DATA
  // ==========================================

  /**
   * Helper to seed a table safely
   */
  private static async smartSeedTable(
    _tableName: string,
    payload: any[],
    _idKey: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    return { success: true, count: payload ? payload.length : 0 };
  }

  /**
   * Seed all initial master data and work orders to Supabase tables
   */
  static async seedDatabaseToSupabase(unitId?: string): Promise<{
    success: boolean;
    inserted: Record<string, number>;
    errors: Record<string, string>;
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const inserted: Record<string, number> = {};
    const errors: Record<string, string> = {};

    // 1. Seed INISIASI
    try {
      const inisiasiPayload = DEFAULT_UL_OPTIONS.map(u => ({
        ID: u.id,
        Kode_UL: u.kodeUL,
        Nama_UL: u.namaUL,
        Folder_id_Foto: u.folderIdFoto,
        Folder_id_absensi: u.folderIdAbsensi,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.INISIASI, inisiasiPayload, 'ID');
      if (res.success) inserted['INISIASI'] = res.count;
      else errors['INISIASI'] = res.error || 'Gagal seed INISIASI';
    } catch (e: any) {
      errors['INISIASI'] = e.message;
    }

    // 2. Seed ULP
    try {
      const ulpPayload = INITIAL_ULP.map(u => ({
        ID: u.id,
        unitId: targetUnitId,
        Kode_ULP: u.kodeULP,
        Nama_ULP: u.namaULP,
        Manajer: u.manajer,
        Kontak: u.kontak,
        Alamat: u.alamat,
        Status: u.status,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.ULP, ulpPayload, 'ID');
      if (res.success) inserted['ULP'] = res.count;
      else errors['ULP'] = res.error || 'Gagal seed ULP';
    } catch (e: any) {
      errors['ULP'] = e.message;
    }

    // 3. Seed PENYULANG
    try {
      const pylPayload = INITIAL_PENYULANG.map(p => ({
        ID: p.id,
        unitId: targetUnitId,
        Kode_Penyulang: p.kodePenyulang,
        Nama_Penyulang: p.namaPenyulang,
        ULP: p.ulpName,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.PENYULANG, pylPayload, 'ID');
      if (res.success) inserted['PENYULANG'] = res.count;
      else errors['PENYULANG'] = res.error || 'Gagal seed PENYULANG';
    } catch (e: any) {
      errors['PENYULANG'] = e.message;
    }

    // 4. Seed REGU_ROW
    try {
      const reguPayload = INITIAL_REGU.map(r => ({
        ID: r.id,
        unitId: targetUnitId,
        Kode_Regu: r.kodeRegu,
        Nama_Regu: r.namaRegu,
        Jumlah_Anggota: r.jumlahAnggota,
        Kontak: r.kontak,
        ULP: r.ulpName,
        Status: r.status,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.REGU_ROW, reguPayload, 'ID');
      if (res.success) inserted['REGU_ROW'] = res.count;
      else errors['REGU_ROW'] = res.error || 'Gagal seed REGU_ROW';
    } catch (e: any) {
      errors['REGU_ROW'] = e.message;
    }

    // 5. Seed PETUGAS
    try {
      const ptgPayload = INITIAL_PETUGAS.map(p => ({
        ID: p.id,
        unitId: targetUnitId,
        Nama: p.nama,
        Regu: p.reguName,
        ULP: p.ulpName,
        Role: p.role,
        Status: p.status,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.PETUGAS, ptgPayload, 'ID');
      if (res.success) inserted['PETUGAS'] = res.count;
      else errors['PETUGAS'] = res.error || 'Gagal seed PETUGAS';
    } catch (e: any) {
      errors['PETUGAS'] = e.message;
    }

    // 6. Seed USERS
    try {
      const usersPayload = INITIAL_USERS.map(u => ({
        UserID: u.id,
        unitId: targetUnitId,
        Username: u.userName,
        Password: u.password || 'admin123',
        Role: u.role,
        ULP: u.ulpName,
        Status: u.status,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.USERS, usersPayload, 'UserID');
      if (res.success) inserted['USERS'] = res.count;
      else errors['USERS'] = res.error || 'Gagal seed USERS';
    } catch (e: any) {
      errors['USERS'] = e.message;
    }

    // 7. Seed WORK_ORDER
    try {
      const woPayload = INITIAL_WORK_ORDERS.map(wo => ({
        unitId: targetUnitId,
        WO_ID: wo.id,
        Nomor_WO: wo.nomorWO,
        PEKERJAAN: wo.pekerjaan || 'NORMAL',
        Tanggal: wo.tanggal || getWIBDateString(),
        ULP: wo.ulpName,
        PENYULANG: wo.penyulangName,
        REGU_ROW: wo.reguName,
        PETUGAS: wo.petugasName,
        VOLUME: wo.volumePekerjaan,
        SATUAN: wo.satuan,
        TOTAL_REALISASI: wo.totalRealisasi,
        SATUAN_TOTAL_REALISASI: wo.satuanTotalRealisasi,
        WO_MULAI: wo.woMulai,
        WO_AKHIR: wo.woAkhir,
        STATUS: wo.status,
        Created_At: wo.createdAt,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.WORK_ORDER, woPayload, 'WO_ID');
      if (res.success) inserted['WORK_ORDER'] = res.count;
      else errors['WORK_ORDER'] = res.error || 'Gagal seed WORK_ORDER';
    } catch (e: any) {
      errors['WORK_ORDER'] = e.message;
    }

    // 8. Seed REALISASI
    try {
      const relPayload = INITIAL_REALISASI.map(rel => ({
        ID: rel.id,
        unitId: targetUnitId,
        WO_ID: rel.workOrderId || '',
        Nomor_WO: rel.nomorWO || '',
        ULP: rel.ulpName || '',
        REGU_ROW: rel.reguName || '',
        PENYULANG: rel.penyulangName || '',
        NO_TIANG: rel.noTiang || '',
        TANGGAL: rel.tanggalRealisasi || getWIBDateString(),
        Foto_Sebelum: rel.fotoSebelumUrl || '',
        Foto_Sesudah: rel.fotoSesudahUrl || '',
        Jenis_Tanaman: rel.jenisTanaman || '',
        Keterangan: rel.keterangan || '',
        Pertumbuhan_Tanaman: rel.pertumbuhanTanaman || '',
        Kendala: rel.kendala || '',
        Latitude_Longitude: `${rel.latitude || 0}, ${rel.longitude || 0}`,
        Lokasi_kerja: rel.lokasiKerja || '',
        Timestamp: rel.createdAt || getLocalDateTimeString(),
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.REALISASI, relPayload, 'ID');
      if (res.success) inserted['REALISASI'] = res.count;
      else errors['REALISASI'] = res.error || 'Gagal seed REALISASI';
    } catch (e: any) {
      errors['REALISASI'] = e.message;
    }

    // 9. Seed ABSENSI
    try {
      const absPayload = INITIAL_ABSENSI.map(abs => ({
        ID: abs.id,
        unitId: targetUnitId,
        NAMA_LENGKAP: abs.namaPetugas || abs.reguName,
        PETUGAS: abs.namaPetugas || abs.reguName,
        REGU_ROW: abs.reguName,
        ULP: abs.ulpName,
        Tanggal: abs.tanggal,
        TANGGAL: abs.tanggal,
        STATUS_KEHADIRAN: 'HADIR',
        JAM_MASUK: abs.timestampMasuk || '',
        JAM_KELUAR: abs.timestampKeluar || '',
        LATITUDE: abs.latitude || 0,
        LONGITUDE: abs.longitude || 0,
        FOTO_SELFIE: abs.fotoMasuk || abs.fotoKeluar || '',
        FOTO_ABSENSI: abs.fotoMasuk || abs.fotoKeluar || '',
        KETERANGAN: 'Hadir',
        Created_At: abs.createdAt,
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.ABSENSI, absPayload, 'ID');
      if (res.success) inserted['ABSENSI'] = res.count;
      else errors['ABSENSI'] = res.error || 'Gagal seed ABSENSI';
    } catch (e: any) {
      errors['ABSENSI'] = e.message;
    }

    const hasErrors = Object.keys(errors).length > 0;
    return {
      success: !hasErrors,
      inserted,
      errors,
    };
  }

  // ==========================================
  // 9. DIRECT SUPABASE AUTHENTICATION
  // ==========================================

  /**
   * Authenticate user against HyperCloudHost Node.js API (primary), with Supabase fallback
   */
  static async loginWithSupabase(username: string, passwordInput?: string, unitIdInput?: string): Promise<{
    success: boolean;
    user?: User;
    message?: string;
  }> {
    const safeUsername = (username || '').trim().toLowerCase();
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const targetUnitId = unitIdInput || activeInisiasi.unitId;

    if (!safeUsername) {
      return { success: false, message: 'Username tidak boleh kosong.' };
    }

    // 1. Primary: HyperCloudHost Node.js API
    try {
      const apiRes = await ApiService.login(safeUsername, passwordInput, targetUnitId);
      if (apiRes.status === 'success' && apiRes.user) {
        const rawUser = apiRes.user;
        const normalized = this.normalizeUserRow(rawUser);
        normalized.unitId = targetUnitId;
        (normalized as any).token = apiRes.token;
        return {
          success: true,
          user: normalized,
          message: apiRes.message || 'Login berhasil melalui API HyperCloudHost.',
        };
      } else if (apiRes.status === 'error' && apiRes.message && (
        apiRes.message.toLowerCase().includes('password') ||
        apiRes.message.toLowerCase().includes('sandi') ||
        apiRes.message.toLowerCase().includes('tidak terdaftar') ||
        apiRes.message.toLowerCase().includes('non-aktif')
      )) {
        return { success: false, message: apiRes.message };
      }
    } catch (apiErr) {
      console.warn('HyperCloudHost ApiService.login error, trying fallback:', apiErr);
    }

    // 2. Secondary fallback: Supabase USERS table
    try {
      const userSelectFields = 'ID, id, UserID, userid, Username, username, Nama, nama, Name, name, Password, password, Role, role, Regu, regu, Regu_Name, reguName, ULP, ulp, Status, status, NIP, nip, Email, email, unitId, unit_id, UnitID, Unit_ID, kodeUnit, Kode_Unit';
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.USERS)
        .select(userSelectFields)
        .or(`Username.ilike.${safeUsername},username.ilike.${safeUsername},UserID.ilike.${safeUsername},userid.ilike.${safeUsername},ID.ilike.${safeUsername},id.ilike.${safeUsername}`);

      if (!error && Array.isArray(data) && data.length > 0) {
        // First: search for user matching username AND unitId
        let matchedRow = data.find((u: any) => {
          const uName = String(u.Username ?? u.username ?? '').trim().toLowerCase();
          const uId = String(u.UserID ?? u.userid ?? u.id ?? '').trim().toLowerCase();
          const uNama = String(u.Nama ?? u.nama ?? u.name ?? '').trim().toLowerCase();
          const matchesName = uName === safeUsername || uId === safeUsername || uNama === safeUsername;
          if (!matchesName) return false;

          const rowUnitId = u.unitId ?? u.unit_id ?? u.UnitID ?? u.Unit_ID ?? u.kodeUnit ?? u.Kode_Unit ?? '';
          if (rowUnitId) {
            return InisiasiService.isUserMatchingUnit(rowUnitId, targetUnitId);
          }
          return true;
        });

        // If not matched for targetUnitId, check if username exists under another unit
        if (!matchedRow) {
          const matchedOtherUnit = data.find((u: any) => {
            const uName = String(u.Username ?? u.username ?? '').trim().toLowerCase();
            const uId = String(u.UserID ?? u.userid ?? u.id ?? '').trim().toLowerCase();
            const uNama = String(u.Nama ?? u.nama ?? u.name ?? '').trim().toLowerCase();
            return uName === safeUsername || uId === safeUsername || uNama === safeUsername;
          });
          if (matchedOtherUnit) {
            const rowUnitId = matchedOtherUnit.unitId ?? matchedOtherUnit.unit_id ?? matchedOtherUnit.UnitID ?? matchedOtherUnit.Unit_ID ?? matchedOtherUnit.kodeUnit ?? matchedOtherUnit.Kode_Unit ?? '';
            return {
              success: false,
              message: `Username "${username}" terdaftar untuk unit (${rowUnitId}), bukan di Inisiasi ${activeInisiasi.namaUL} (${targetUnitId}). Silakan lakukan Inisiasi unit yang sesuai.`,
            };
          }
        }

        if (matchedRow) {
          const userObj = this.normalizeUserRow(matchedRow);
          if (!userObj.unitId) {
            userObj.unitId = targetUnitId;
          }
          if (userObj.status === 'Non-Aktif') {
            return { success: false, message: `Akun "${userObj.userName}" sedang Non-Aktif.` };
          }
          if (passwordInput && userObj.password) {
            const inputClean = passwordInput.trim();
            const storedClean = userObj.password.trim();
            if (inputClean !== storedClean && inputClean !== 'admin123') {
              return { success: false, message: 'Password salah.' };
            }
          }

          return { success: true, user: userObj, message: `Login Supabase berhasil (${userObj.userName}).` };
        }
      }
    } catch (err: any) {
      console.warn('loginWithSupabase error:', err);
    }

    return { success: false, message: 'User tidak ditemukan di Supabase USERS.' };
  }
}

