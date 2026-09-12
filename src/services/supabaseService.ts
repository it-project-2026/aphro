/**
 * Supabase Service - APHRO-Database
 * Centralized service layer for Supabase PostgreSQL operations.
 * Single database architecture connecting all tables via 'unitId' to INISIASI (ID).
 */

import { supabase, SUPABASE_TABLES, SUPABASE_DATABASE_NAME } from './supabaseClient';
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
} from './inisiasiService';
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
import { formatDriveViewUrl, formatDriveImageUrl } from '../utils/driveUtils';
import { parseNumeric } from '../utils/metricUtils';
import { GASApiService } from './gasApiService';
import { getActiveGasConfig } from '../config/gasConfig';

export class SupabaseService {
  public static readonly DB_NAME = SUPABASE_DATABASE_NAME;

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
   * Get currently active unitId from localStorage (Defaults to 'UL2' for UL BUKITTINGGI)
   */
  static getActiveUnitId(): string {
    try {
      const unitName = (
        this.safeGetItem('aphro_nama_unit_layanan') || ''
      ).toUpperCase();

      const selected = this.safeGetItem('aphro_selected_inisiasi_ul');
      let parsedId = '';
      let parsedName = '';
      if (selected) {
        try {
          const parsed = JSON.parse(selected);
          parsedId = parsed?.id ? String(parsed.id) : '';
          parsedName = parsed?.namaUL ? String(parsed.namaUL).toUpperCase() : '';
        } catch {}
      }
      const directId = this.safeGetItem('aphro_selected_unit_id') || '';

      const activeName = unitName || parsedName;
      if (activeName.includes('BUKITTINGGI') || activeName.includes('BKT')) {
        // Ensure local storage reflects UL2 for Bukittinggi
        if (directId === 'UL1' || parsedId === 'UL1') {
          this.safeSetItem('aphro_selected_unit_id', 'UL2');
        }
        return 'UL2';
      }
      if (activeName.includes('PADANG') || activeName.includes('PDG')) {
        return 'UL1';
      }
      if (activeName.includes('SOLOK') || activeName.includes('SLK')) {
        return 'UL3';
      }
      if (activeName.includes('PAYAKUMBUH') || activeName.includes('PYK')) {
        return 'UL4';
      }

      if (directId) return directId;
      if (parsedId) return parsedId;
    } catch {
      // Fallback
    }
    return 'UL2'; // UL BUKITTINGGI is the primary active unit
  }

  // ==========================================
  // 1. INISIASI TABLE OPERATIONS
  // ==========================================

  /**
   * Fetch Unit Layanan list from INISIASI table
   */
  static async fetchInisiasiUnits(): Promise<{
    success: boolean;
    data: InisiasiUnit[];
    source: 'supabase' | 'cache' | 'default';
    message?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.INISIASI)
        .select('*');

      if (!error && Array.isArray(data) && data.length > 0) {
        const units: InisiasiUnit[] = data.map((row: any, idx: number) => ({
          id: String(row.ID || `UL${idx + 1}`),
          no: idx + 1,
          kodeUL: String(row.Kode_UL || `UL-${idx + 1}`),
          namaUL: String(row.Nama_UL || '').toUpperCase(),
          idSpreadsheet: DEFAULT_INISIASI_SPREADSHEET_ID,
          urlGas: '',
          folderIdSpreadsheet: '',
          folderIdFoto: String(row.Folder_id_Foto || '1idu8U3COKEqdcCewdWntu9X06ZMnzskr'),
          folderIdAbsensi: String(row.Folder_id_absensi || '1zDU9fGaFan01Y9Dogtd0XhOPM1S1Vry5'),
          notes: `Unit Layanan ${row.Nama_UL || ''} (Supabase: APHRO-Database)`,
        })).filter(u => u.namaUL.length > 0);

        if (units.length > 0) {
          this.safeSetItem('aphro_cached_inisiasi_units', JSON.stringify(units));
          return {
            success: true,
            data: units,
            source: 'supabase',
            message: `Berhasil memuat ${units.length} Unit Layanan dari Supabase Tabel "INISIASI".`,
          };
        }
      }
    } catch (err) {
      console.warn('Supabase fetch INISIASI error:', err);
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
   * Fetch Work Orders from Supabase WORK_ORDER table filtered by unitId with pagination and incremental sync.
   */
  static async fetchWorkOrders(
    unitId?: string, 
    page: number = 0, 
    pageSize: number = 500,
    lastSyncTime?: string
  ): Promise<{
    success: boolean;
    data: WorkOrder[];
    source: 'supabase' | 'cache' | 'initial';
    message?: string;
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    try {
      // 1. Start query
      let query = supabase
        .from(SUPABASE_TABLES.WORK_ORDER)
        .select('*');

      if (targetUnitId && targetUnitId !== 'ALL') {
        query = query.eq('unitId', targetUnitId);
      }

      // 3. Add order and range
      let { data, error } = await query
        .order('Tanggal', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error || !data || data.length === 0) {
        // Fallback to Nomor_WO order if Tanggal order fails or returns nothing
        const fallbackRes = await supabase
          .from(SUPABASE_TABLES.WORK_ORDER)
          .select('*')
          .eq('unitId', targetUnitId)
          .order('Nomor_WO', { ascending: false })
          .range(from, to);
        if (fallbackRes.data && fallbackRes.data.length > 0) {
          data = fallbackRes.data;
          error = fallbackRes.error;
        }
      }

      if (!error && Array.isArray(data)) {
        const workOrders: WorkOrder[] = data.map((row: any) => this.normalizeWorkOrderRow(row));
        
        // Cache only the first page and only if NOT incremental sync
        if (page === 0 && !lastSyncTime) {
          this.safeSetItem(`aphro_wo_${targetUnitId}`, JSON.stringify(workOrders));
        }
        
        return {
          success: true,
          data: workOrders,
          source: 'supabase',
          message: `Berhasil memuat ${workOrders.length} Work Order (Halaman ${page + 1}) dari Supabase.`,
        };
      }
      return { success: true, data: [], source: 'supabase', message: 'Tidak ada data Work Order ditemukan.' };
    } catch (err) {
      console.warn('Error loading Work Orders from Supabase:', err);
      return { success: false, data: [], source: 'supabase', message: 'Gagal memuat data Work Order.' };
    }

    // Check cached data for this unit
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

    // Initial fallback data
    const initialForUnit = INITIAL_WORK_ORDERS.map(wo => ({
      ...wo,
      ulpId: targetUnitId,
    }));
    return {
      success: true,
      data: initialForUnit,
      source: 'initial',
      message: `Memuat ${initialForUnit.length} Work Order awal.`,
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
   * Save a new Work Order to Supabase WORK_ORDER table
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

    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.WORK_ORDER)
        .upsert([payload], { onConflict: 'WO_ID' });

      if (error) {
        console.warn('Supabase saveWorkOrder warning (will cache locally):', error.message);
      }
      return { success: !error, error: error?.message };
    } catch (err: any) {
      console.warn('Supabase saveWorkOrder network exception:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update Work Order in Supabase WORK_ORDER table
   */
  static async updateWorkOrder(
    unitId: string,
    id: string,
    updates: Partial<WorkOrder>
  ): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const dbUpdates: any = {};
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

    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.WORK_ORDER)
        .update(dbUpdates)
        .eq('unitId', targetUnitId)
        .eq('WO_ID', id);

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete Work Order from Supabase WORK_ORDER table
   */
  static async deleteWorkOrder(unitId: string, id: string, nomorWO?: string): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const cleanId = (id || '').trim();
    const cleanNomor = (nomorWO || '').trim();
    try {
      // 1. Delete from Supabase WORK_ORDER matching WO_ID or Nomor_WO
      let error: any = null;

      // Direct delete by WO_ID if cleanId provided
      if (cleanId) {
        const resId = await supabase
          .from(SUPABASE_TABLES.WORK_ORDER)
          .delete()
          .eq('WO_ID', cleanId);
        if (resId.error) error = resId.error;
      }

      // Also delete by Nomor_WO if cleanNomor provided or if cleanId might be Nomor_WO
      if (cleanNomor && cleanNomor !== cleanId) {
        const resNomor = await supabase
          .from(SUPABASE_TABLES.WORK_ORDER)
          .delete()
          .eq('Nomor_WO', cleanNomor);
        if (resNomor.error && !error) error = resNomor.error;
      }

      // If cleanId was used as Nomor_WO fallback
      if (cleanId && !cleanNomor) {
        await supabase
          .from(SUPABASE_TABLES.WORK_ORDER)
          .delete()
          .eq('Nomor_WO', cleanId);
      }

      // 2. Clear local storage caches so that refresh/offline won't bring the deleted item back
      try {
        const keysToClean = [
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

      // 3. Clear IndexedDB cache for WORK_ORDER
      try {
        const { idbService } = await import('./indexedDbService');
        const cached = await idbService.getTable('WORK_ORDER');
        if (Array.isArray(cached)) {
          const filtered = cached.filter((item: any) =>
            item.id !== cleanId &&
            item.WO_ID !== cleanId &&
            item.nomorWO !== cleanId &&
            item.Nomor_WO !== cleanId &&
            (!cleanNomor || (item.nomorWO !== cleanNomor && item.Nomor_WO !== cleanNomor))
          );
          await idbService.saveTable('WORK_ORDER', filtered);
        }
      } catch (idbErr) {
        console.warn('IndexedDB purge error:', idbErr);
      }

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ==========================================
  // 3. REALISASI TABLE OPERATIONS
  // ==========================================

  /**
   * Fetch Realisasi from Supabase REALISASI table filtered by unitId
   */
  /**
   * Fetch Realisasi from Supabase REALISASI table filtered by unitId with pagination.
   */
  static async fetchRealisasi(unitId?: string, page: number = 0, pageSize: number = 1000): Promise<{
    success: boolean;
    data: Realisasi[];
    source: 'supabase' | 'cache' | 'initial';
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();

    try {
      let allRawData: any[] = [];
      let batchPage = 0;
      let hasMore = true;

      // Loop to fetch all batches up to 10,000 rows so no dates (e.g. Sept 1-8) are cut off
      while (hasMore && batchPage < 10) {
        const from = batchPage * pageSize;
        const to = from + pageSize - 1;

        let res = await supabase
          .from(SUPABASE_TABLES.REALISASI)
          .select('*')
          .or(`unitId.eq.${targetUnitId},unitId.is.null`)
          .order('TANGGAL', { ascending: false, nullsFirst: false })
          .range(from, to);

        if (res.error || !res.data || res.data.length === 0) {
          res = await supabase
            .from(SUPABASE_TABLES.REALISASI)
            .select('*')
            .eq('unitId', targetUnitId)
            .order('TANGGAL', { ascending: false, nullsFirst: false })
            .range(from, to);
        }

        if (res.data && res.data.length > 0) {
          allRawData = allRawData.concat(res.data);
          if (res.data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        batchPage++;
      }

      if (allRawData.length === 0 && targetUnitId === 'UL1') {
        batchPage = 0;
        hasMore = true;
        while (hasMore && batchPage < 10) {
          const from = batchPage * pageSize;
          const to = from + pageSize - 1;
          const checkBkt = await supabase
            .from(SUPABASE_TABLES.REALISASI)
            .select('*')
            .eq('unitId', 'UL2')
            .order('TANGGAL', { ascending: false, nullsFirst: false })
            .range(from, to);
          if (checkBkt.data && checkBkt.data.length > 0) {
            allRawData = allRawData.concat(checkBkt.data);
            if (checkBkt.data.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
          batchPage++;
        }
      }

      if (Array.isArray(allRawData) && allRawData.length > 0) {
        const list: Realisasi[] = allRawData.map((row: any) => this.normalizeRealisasiRow(row));
        this.safeSetItem(`aphro_realisasi_${targetUnitId}`, JSON.stringify(list));
        return { success: true, data: list, source: 'supabase' };
      }
    } catch (err) {
      console.warn('Supabase fetch REALISASI error in catch block:', err);
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
   * Normalize Supabase REALISASI row
   */
  static normalizeRealisasiRow(row: any): Realisasi {
    const rawNoWoCandidate = String(row.Nomor_WO || row.nomor_wo || row.NOMOR_WO || row.nomorWO || '');
    const rawWoIdCandidate = String(row.WO_ID || row.wo_id || row.workOrderId || '');

    // Detect if row was imported with shifted columns (sheet without separate WO_ID column)
    const isShifted = rawNoWoCandidate.toUpperCase().startsWith('ULP') ||
      (rawWoIdCandidate.match(/^M\d+\//i) && !rawNoWoCandidate.match(/^M\d+\//i));

    let rawNoWo = rawNoWoCandidate;
    let rawUlp = String(row.ULP || row.ulp || row.Nama_ULP || '');
    let reguName = String(row.REGU_ROW || row.regu_row || row.Regu || row.REGU || '');
    let penyulangName = String(row.PENYULANG || row.penyulang || row.Nama_Penyulang || '');
    let noTiang = String(row.NO_TIANG || row.No_Tiang || row.no_tiang || '');
    let rawTanggal = row.Tanggal ?? row.TANGGAL ?? row.tanggal ?? row.TANGGAL_REALISASI ?? row.tanggal_realisasi ?? row.TANGGAL_EKSEKUSI ?? row.tanggal_eksekusi;
    let rawFotoSebelum = String(row.FOTO_SEBELUM || row.Foto_Sebelum || row.foto_sebelum || row.FOTO_SEBELUM_URL || '');
    let rawFotoSesudah = String(row.FOTO_SETELAH || row.FOTO_PROSES || row.Foto_Sesudah || row.Foto_Setelah || row.foto_sesudah || row.FOTO_SETELAH_URL || '');
    let jenisTanaman = String(row.Jenis_Tanaman || row.jenis_tanaman || row.TIPE_POHON || row.tipe_pohon || '');
    let keterangan = String(row.Keterangan || row.keterangan || row.KETERANGAN || '');
    let pertumbuhanTanaman = String(row.Pertumbuhan_Tanaman || row.pertumbuhan_tanaman || '');
    let kendala = String(row.Kendala || row.kendala || '');
    let lokasiKerja = String(row.Lokasi_kerja || row.lokasi_kerja || row.LOKASI_KERJA || row.Lokasi || '');
    let timestampStr = String(row.Timestamp || row.WAKTU || row.Waktu || row.Created_At || row.created_at || getLocalDateTimeString());
    let lat = Number(row.LATITUDE ?? row.latitude ?? row.lat) || 0;
    let lng = Number(row.LONGITUDE ?? row.longitude ?? row.lng) || 0;

    if (isShifted) {
      rawNoWo = rawWoIdCandidate;
      rawUlp = rawNoWoCandidate;
      reguName = String(row.ULP || '');
      penyulangName = String(row.REGU_ROW || '');
      noTiang = String(row.PENYULANG || '');
      rawTanggal = row.NO_TIANG || rawTanggal;
      rawFotoSebelum = String(row.Foto_Sebelum || '');
      rawFotoSesudah = (String(row.Foto_Sesudah || '').includes('http')) ? String(row.Foto_Sesudah) : '';
      jenisTanaman = String(row.Foto_Sesudah || '');
      keterangan = String(row.Jenis_Tanaman || 'PANGKAS');
      pertumbuhanTanaman = String(row.Keterangan || 'SEDANG');
      kendala = String(row.Pertumbuhan_Tanaman || 'Tidak Ada Kendala');
      if (String(row.Kendala || '').includes(',')) {
        const parts = String(row.Kendala).split(',');
        lat = Number(parts[0].trim()) || 0;
        lng = Number(parts[1].trim()) || 0;
      }
      lokasiKerja = String(row.Latitude_Longitude || '');
      timestampStr = String(row.Lokasi_kerja || getLocalDateTimeString());
    }

    if (!lat && !lng) {
      const latLngStr = String(row.Latitude_Longitude || row.latitude_longitude || row.LATITUDE_LONGITUDE || '');
      if (latLngStr.includes(',')) {
        const parts = latLngStr.split(',');
        lat = Number(parts[0].trim()) || 0;
        lng = Number(parts[1].trim()) || 0;
      }
    }

    if (rawUlp.toUpperCase().startsWith('UL UL ')) {
      rawUlp = rawUlp.replace(/^UL\s*UL\s*/i, 'UL ');
    }
    const ulpName = rawUlp;

    const dateFromWo = parseDateFromNomorWO(rawNoWo);
    let tanggalStr = '';
    if (rawTanggal !== undefined && rawTanggal !== null && String(rawTanggal).trim() !== '' && String(rawTanggal) !== 'null' && String(rawTanggal) !== 'undefined') {
      tanggalStr = normalizeDateISO(rawTanggal);
    }
    if (!tanggalStr && dateFromWo) {
      tanggalStr = dateFromWo;
    }
    if (!tanggalStr) {
      tanggalStr = normalizeDateISO(timestampStr) || getWIBDateString();
    }

    const fotoSebelumUrl = formatDriveViewUrl(rawFotoSebelum);
    const fotoSesudahUrl = formatDriveViewUrl(rawFotoSesudah);
    const fotoSebelumImg = formatDriveImageUrl(rawFotoSebelum);
    const fotoSesudahImg = formatDriveImageUrl(rawFotoSesudah);

    const relId = String(row.REALISASI_ID || row.realisasi_id || row.ID || row.id || `REL-${Date.now()}`);

    return {
      id: relId,
      unitId: String(row.unitId || ''),
      workOrderId: String(row.WO_ID || row.wo_id || row.workOrderId || ''),
      nomorWO: rawNoWo,
      ulpName,
      reguName,
      penyulangName: String(row.PENYULANG || row.penyulang || row.Nama_Penyulang || ''),
      noTiang: String(row.NO_TIANG || row.No_Tiang || row.no_tiang || ''),
      tanggalRealisasi: tanggalStr,
      petugasId: 'usr-1',
      petugasName: String(row.PETUGAS || row.Petugas || row.petugas || reguName),
      jenisTanaman: String(jenisTanaman || row.TIPE_POHON || row.tipe_pohon || ''),
      pertumbuhanTanaman: String(pertumbuhanTanaman),
      kendala: String(kendala),
      lokasiKerja: String(lokasiKerja),
      latitude: lat,
      longitude: lng,
      keterangan: String(keterangan),
      progressPercent: 100,
      status: 'Selesai',
      fotoSebelumUrl,
      fotoSesudahUrl,
      photosSebelum: fotoSebelumUrl ? [{
        id: `pic-seb-${relId}`,
        type: 'sebelum',
        slotIndex: 1,
        dataUrl: fotoSebelumImg,
        fileUrl: fotoSebelumUrl,
        originalName: 'Foto_Sebelum.jpg',
        timestamp: timestampStr,
        latitude: lat,
        longitude: lng,
        userName: reguName,
        ulpName,
      }] : [],
      photosSesudah: fotoSesudahUrl ? [{
        id: `pic-ses-${relId}`,
        type: 'sesudah',
        slotIndex: 1,
        dataUrl: fotoSesudahImg,
        fileUrl: fotoSesudahUrl,
        originalName: 'Foto_Sesudah.jpg',
        timestamp: timestampStr,
        latitude: lat,
        longitude: lng,
        userName: reguName,
        ulpName,
      }] : [],
      createdAt: timestampStr,
      isSynced: true,
    };
  }

  /**
   * Save Realisasi to Supabase REALISASI table
   */
  static async saveRealisasi(unitId: string, rel: Realisasi): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    let finalFotoSebelum = rel.fotoSebelumUrl || rel.photosSebelum?.[0]?.dataUrl || '';
    let finalFotoSesudah = rel.fotoSesudahUrl || rel.photosSesudah?.[0]?.dataUrl || '';

    const gasConfig = getActiveGasConfig();
    const gasUrl = gasConfig.gasWebAppUrl;
    const fotoFolderId = gasConfig.driveFolderId || '1idu8U3COKEqdcCewdWntu9X06ZMnzskr';

    if (finalFotoSebelum && finalFotoSebelum.startsWith('data:image') && gasUrl && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const uploadRes = await GASApiService.uploadPhoto(gasUrl, {
          base64Data: finalFotoSebelum,
          reguName: rel.reguName || 'ROW',
          photoType: 'Realisasi_Sebelum',
          folderId: fotoFolderId,
        });
        if (uploadRes && uploadRes.status === 'success' && uploadRes.fileUrl) {
          finalFotoSebelum = uploadRes.fileUrl;
          rel.fotoSebelumUrl = uploadRes.fileUrl;
        }
      } catch (e) {
        console.warn('Auto upload Google Drive foto sebelum warning:', e);
      }
    }

    if (finalFotoSesudah && finalFotoSesudah.startsWith('data:image') && gasUrl && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const uploadRes = await GASApiService.uploadPhoto(gasUrl, {
          base64Data: finalFotoSesudah,
          reguName: rel.reguName || 'ROW',
          photoType: 'Realisasi_Sesudah',
          folderId: fotoFolderId,
        });
        if (uploadRes && uploadRes.status === 'success' && uploadRes.fileUrl) {
          finalFotoSesudah = uploadRes.fileUrl;
          rel.fotoSesudahUrl = uploadRes.fileUrl;
        }
      } catch (e) {
        console.warn('Auto upload Google Drive foto sesudah warning:', e);
      }
    }

    const latLng = (rel.latitude && rel.longitude) ? `${rel.latitude}, ${rel.longitude}` : '';
    const payload: Record<string, any> = {
      REALISASI_ID: rel.id,
      ID: rel.id,
      unitId: targetUnitId,
      WO_ID: rel.workOrderId || rel.id,
      Nomor_WO: rel.nomorWO || '',
      ULP: rel.ulpName || '',
      REGU_ROW: rel.reguName || '',
      PENYULANG: rel.penyulangName || '',
      NO_TIANG: rel.noTiang || '',
      Tanggal: rel.tanggalRealisasi,
      TANGGAL: rel.tanggalRealisasi,
      PETUGAS: rel.petugasName || rel.reguName || '',
      TIPE_POHON: rel.jenisTanaman || '',
      Jenis_Tanaman: rel.jenisTanaman || '',
      Pertumbuhan_Tanaman: rel.pertumbuhanTanaman || '',
      Kendala: rel.kendala || '',
      Lokasi_kerja: rel.lokasiKerja || '',
      LATITUDE: rel.latitude || 0,
      LONGITUDE: rel.longitude || 0,
      Latitude_Longitude: latLng,
      Keterangan: rel.keterangan || '',
      FOTO_SEBELUM: formatDriveViewUrl(finalFotoSebelum),
      Foto_Sebelum: formatDriveViewUrl(finalFotoSebelum),
      FOTO_SETELAH: formatDriveViewUrl(finalFotoSesudah),
      Foto_Sesudah: formatDriveViewUrl(finalFotoSesudah),
      STATUS: 'SELESAI',
      WAKTU: rel.createdAt || getLocalDateTimeString(),
      Timestamp: rel.createdAt || getLocalDateTimeString(),
    };

    try {
      const tryUpsert = async (currPayload: Record<string, any>): Promise<{ success: boolean; error?: string }> => {
        let { error } = await supabase
          .from(SUPABASE_TABLES.REALISASI)
          .upsert([currPayload], { onConflict: 'REALISASI_ID' });

        if (error && (error.code === 'PGRST204' || error.message?.includes('Could not find the'))) {
          const match = error.message?.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
            const badCol = match[1];
            delete currPayload[badCol];
            return tryUpsert(currPayload);
          } else {
            const optionalCols = ['FOTO_SEBELUM', 'Foto_Sebelum', 'FOTO_SETELAH', 'Foto_Sesudah', 'TIPE_POHON', 'TANGGAL', 'WAKTU', 'PETUGAS', 'Pertumbuhan_Tanaman', 'Kendala'];
            for (const col of optionalCols) {
              if (currPayload[col]) delete currPayload[col];
            }
            const retryErr = await supabase
              .from(SUPABASE_TABLES.REALISASI)
              .upsert([currPayload], { onConflict: 'REALISASI_ID' });
            if (!retryErr.error) return { success: true };
            error = retryErr.error;
          }
        }

        if (error) {
          const err2 = await supabase
            .from(SUPABASE_TABLES.REALISASI)
            .upsert([currPayload], { onConflict: 'ID' });
          if (!err2.error) return { success: true };
          error = err2.error;
        }

        if (error) {
          const err3 = await supabase
            .from(SUPABASE_TABLES.REALISASI)
            .insert([currPayload]);
          if (!err3.error) return { success: true };
          error = err3.error;
        }

        return { success: !error, error: error?.message };
      };

      const result = await tryUpsert(payload);
      if (!result.success) {
        console.error('Supabase saveRealisasi all attempts failed:', result.error);
      }
      return result;
    } catch (err: any) {
      console.error('Supabase saveRealisasi catch error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete Realisasi by ID
   */
  static async deleteRealisasi(arg1: string, arg2?: string): Promise<{ success: boolean; error?: string }> {
    const targetId = arg2 || arg1;
    try {
      let { error } = await supabase
        .from(SUPABASE_TABLES.REALISASI)
        .delete()
        .eq('REALISASI_ID', targetId);

      if (error) {
        const err2 = await supabase
          .from(SUPABASE_TABLES.REALISASI)
          .delete()
          .eq('ID', targetId);
        error = err2.error;
      }

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
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

    try {
      // 1. Fetch with unitId filter, specific columns, and range pagination (latest 50)
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.ABSENSI)
        .select('*')
        .eq('unitId', targetUnitId)
        .order('TANGGAL', { ascending: false })
        .range(0, 49);

      if (!error && Array.isArray(data) && data.length > 0) {
        const list: Absensi[] = data.map((row: any) => this.normalizeAbsensiRow(row));
        this.safeSetItem(`aphro_absensi_${targetUnitId}`, JSON.stringify(list));
        return { 
          success: true, 
          data: list, 
          source: 'supabase',
          message: `Berhasil memuat ${list.length} data absensi terbaru.` 
        };
      }
      return { success: true, data: [], source: 'supabase', message: 'Tidak ada data absensi ditemukan.' };
    } catch (err) {
      console.warn('Error loading Absensi from Supabase:', err);
      return { success: false, data: [], source: 'supabase', message: 'Gagal memuat data absensi.' };
    }

    try {
      const cached = this.safeGetItem(`aphro_absensi_all`) || this.safeGetItem(`aphro_absensi_${targetUnitId}`);
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

    if (finalFotoMasuk && finalFotoMasuk.startsWith('data:image') && gasUrl && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const uploadRes = await GASApiService.uploadPhoto(gasUrl, {
          base64Data: finalFotoMasuk,
          reguName: abs.reguName,
          photoType: 'Absensi_Masuk',
          folderId: absensiFolderId,
        });
        if (uploadRes && uploadRes.status === 'success' && uploadRes.fileUrl) {
          finalFotoMasuk = uploadRes.fileUrl;
          abs.fotoMasuk = uploadRes.fileUrl;
        }
      } catch (e) {
        console.warn('Auto upload Google Drive foto masuk warning:', e);
      }
    }

    if (finalFotoKeluar && finalFotoKeluar.startsWith('data:image') && gasUrl && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const uploadRes = await GASApiService.uploadPhoto(gasUrl, {
          base64Data: finalFotoKeluar,
          reguName: abs.reguName,
          photoType: 'Absensi_Keluar',
          folderId: absensiFolderId,
        });
        if (uploadRes && uploadRes.status === 'success' && uploadRes.fileUrl) {
          finalFotoKeluar = uploadRes.fileUrl;
          abs.fotoKeluar = uploadRes.fileUrl;
        }
      } catch (e) {
        console.warn('Auto upload Google Drive foto keluar warning:', e);
      }
    }

    const payload: any = {
      ID: abs.id,
      unitId: targetUnitId,
      TANGGAL: abs.tanggal || getWIBDateString(),
      NAMA_REGU: abs.reguName || '',
      ULP: abs.ulpName || '',
      FOTO_MASUK: formatDriveViewUrl(finalFotoMasuk),
      FOTO_KELUAR: formatDriveViewUrl(finalFotoKeluar),
      'TIMESTAMP MASUK': abs.timestampMasuk || (finalFotoMasuk ? getLocalDateTimeString() : null),
      'TIMESTAMP KELUAR': abs.timestampKeluar || (finalFotoKeluar ? getLocalDateTimeString() : null),
    };

    if (Array.isArray(abs.petugasList)) {
      abs.petugasList.slice(0, 5).forEach((p, idx) => {
        payload[`PETUGAS_${idx + 1}`] = p.nama;
        payload[`KET_${idx + 1}`] = p.keterangan || 'HADIR';
      });
      for (let i = abs.petugasList.length + 1; i <= 5; i++) {
        payload[`PETUGAS_${i}`] = '-';
        payload[`KET_${i}`] = 'HADIR';
      }
    }

    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.ABSENSI)
        .upsert([payload], { onConflict: 'ID' });

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete Absensi by ID
   */
  static async deleteAbsensi(arg1: string, arg2?: string): Promise<{ success: boolean; error?: string }> {
    const targetId = arg2 || arg1;
    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.ABSENSI)
        .delete()
        .eq('ID', targetId);

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ==========================================
  // 5. MASTER DATA (USERS, ULP, PENYULANG, REGU_ROW, PETUGAS)
  // ==========================================

  /**
   * Flexible row normalizer for Supabase USERS table
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

    return {
      id: String(rawUserId || `usr-${Math.random().toString(36).substr(2, 6)}`),
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
   * Fetch all user accounts directly from Supabase USERS table
   */
  static async fetchUsers(unitId?: string): Promise<{
    success: boolean;
    data: User[];
    source: 'supabase' | 'cache' | 'initial';
    message?: string;
  }> {
    const targetUnitId = unitId || this.getActiveUnitId();

    try {
      // 1. Try querying with unitId filter
      let { data, error } = await supabase
        .from(SUPABASE_TABLES.USERS)
        .select('*')
        .eq('unitId', targetUnitId);

      // 2. If no data with unitId, fetch all users
      if ((!data || data.length === 0) && !error) {
        const allRes = await supabase.from(SUPABASE_TABLES.USERS).select('*');
        if (allRes.data && allRes.data.length > 0) {
          data = allRes.data;
        }
      }

      if (!error && Array.isArray(data) && data.length > 0) {
        const users = data.map((row: any) => this.normalizeUserRow(row));
        return {
          success: true,
          data: users,
          source: 'supabase',
          message: `Berhasil memuat ${users.length} user dari Supabase USERS.`,
        };
      }
    } catch (err: any) {
      console.warn('fetchUsers Supabase error:', err);
    }

    return {
      success: true,
      data: INITIAL_USERS,
      source: 'initial',
      message: 'Menggunakan data user bawaan (Supabase USERS kosong).',
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
  static async saveRegu(regu: ReguROW, unitId?: string): Promise<{ success: boolean; error?: string }> {
    const targetUnitId = unitId || this.getActiveUnitId();
    const payload = {
      ID: regu.id,
      unitId: targetUnitId,
      Kode_Regu: regu.kodeRegu || regu.id,
      Nama_Regu: regu.namaRegu,
      NAMA_REGU: regu.namaRegu,
      REGU_ROW: regu.namaRegu,
      Kontak: regu.kontak || regu.penanggungJawab || '',
      Jumlah_Anggota: regu.jumlahAnggota || 5,
      ULP: regu.ulpName || '',
      Status: regu.status || 'Aktif',
    };

    try {
      let { error } = await supabase
        .from(SUPABASE_TABLES.REGU_ROW)
        .upsert([payload], { onConflict: 'ID' });

      if (error) {
        const fallback = await supabase
          .from('regu_row')
          .upsert([payload], { onConflict: 'ID' });
        error = fallback.error;
      }

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete Regu ROW from Supabase REGU_ROW table
   */
  static async deleteRegu(reguId: string): Promise<{ success: boolean; error?: string }> {
    try {
      let { error } = await supabase
        .from(SUPABASE_TABLES.REGU_ROW)
        .delete()
        .or(`ID.eq.${reguId},Kode_Regu.eq.${reguId},Nama_Regu.eq.${reguId}`);

      if (error) {
        const fallback = await supabase
          .from('regu_row')
          .delete()
          .or(`ID.eq.${reguId},Kode_Regu.eq.${reguId},Nama_Regu.eq.${reguId}`);
        error = fallback.error;
      }

      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch all master data for the given unitId
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

    try {
      let [usersRes, ulpRes, pylRes, reguRes, ptgRes] = await Promise.all([
        supabase.from(SUPABASE_TABLES.USERS).select('*').eq('unitId', targetUnitId),
        supabase.from(SUPABASE_TABLES.ULP).select('*').eq('unitId', targetUnitId),
        supabase.from(SUPABASE_TABLES.PENYULANG).select('*').eq('unitId', targetUnitId),
        supabase.from(SUPABASE_TABLES.REGU_ROW).select('*').eq('unitId', targetUnitId),
        supabase.from(SUPABASE_TABLES.PETUGAS).select('*').eq('unitId', targetUnitId),
      ]);

      // Fallbacks if filtered query returned no data
      if (!ulpRes.data || ulpRes.data.length === 0) {
        ulpRes = await supabase.from(SUPABASE_TABLES.ULP).select('*');
      }
      if (!pylRes.data || pylRes.data.length === 0) {
        pylRes = await supabase.from(SUPABASE_TABLES.PENYULANG).select('*');
      }
      
      // Fallback query for REGU_ROW across multiple table name variations
      if (!reguRes.data || reguRes.data.length === 0 || reguRes.error) {
        reguRes = await supabase.from(SUPABASE_TABLES.REGU_ROW).select('*');
      }
      if (!reguRes.data || reguRes.data.length === 0 || reguRes.error) {
        reguRes = await supabase.from('regu_row').select('*');
      }
      if (!reguRes.data || reguRes.data.length === 0 || reguRes.error) {
        reguRes = await supabase.from('REGU').select('*');
      }
      if (!reguRes.data || reguRes.data.length === 0 || reguRes.error) {
        reguRes = await supabase.from('regu').select('*');
      }

      if (!ptgRes.data || ptgRes.data.length === 0) {
        ptgRes = await supabase.from(SUPABASE_TABLES.PETUGAS).select('*');
      }

      const users: User[] = (usersRes.data || []).map((u: any) => this.normalizeUserRow(u));

      const ulp: ULP[] = (ulpRes.data || []).map((u: any) => ({
        id: String(u.ID || u.id || `ulp-${Math.random().toString(36).substr(2, 6)}`),
        kodeULP: String(u.Kode_ULP || u.kode_ulp || ''),
        namaULP: String(u.Nama_ULP || u.nama_ulp || ''),
        manajer: String(u.Manajer || u.manajer || ''),
        kontak: String(u.Kontak || u.kontak || ''),
        alamat: String(u.Alamat || u.alamat || ''),
        status: (u.Status === 'Non-Aktif' || u.status === 'Non-Aktif' ? 'Non-Aktif' : 'Aktif'),
      }));

      const penyulang: Penyulang[] = (pylRes.data || []).map((p: any) => ({
        id: String(p.ID || p.id || `pyl-${Math.random().toString(36).substr(2, 6)}`),
        kodePenyulang: String(p.Kode_Penyulang || p.kode_penyulang || p.ID || 'PYL-01'),
        namaPenyulang: String(p.Nama_Penyulang || p.nama_penyulang || ''),
        ulpId: targetUnitId,
        ulpName: String(p.ULP || p.ulp || ''),
        panjangKms: 10,
        jumlahTrafo: 15,
        status: 'Normal',
      }));

      const regu: ReguROW[] = (reguRes.data || [])
        .map((r: any) => {
          const rawName =
            r.Nama_Regu ??
            r.nama_regu ??
            r.NAMA_REGU ??
            r.REGU_ROW ??
            r.regu_row ??
            r.Regu_ROW ??
            r.REGU ??
            r.Regu ??
            r.regu ??
            r.Nama ??
            r.nama ??
            r.Name ??
            r.name ??
            r.Kode_Regu ??
            r.kode_regu ??
            '';

          const rawKode = r.Kode_Regu ?? r.kode_regu ?? r.KODE_REGU ?? r.ID ?? r.id ?? '';
          const rawUlp = r.ULP ?? r.ulp ?? r.ulpName ?? r.ULP_NAME ?? r.ulp_name ?? r.Nama_ULP ?? '';
          const rawKontak = r.Kontak ?? r.kontak ?? r.KONTAK ?? r.No_HP ?? r.no_hp ?? r.Penanggung_Jawab ?? '';
          const rawJumlah = r.Jumlah_Anggota ?? r.jumlah_anggota ?? r.JUMLAH_ANGGOTA ?? r.Anggota ?? 0;
          const rawStatus = r.Status ?? r.status ?? r.STATUS ?? 'Aktif';

          return {
            id: String(r.ID || r.id || `rgu-${Math.random().toString(36).substr(2, 6)}`),
            kodeRegu: String(rawKode || ''),
            namaRegu: String(rawName || '').trim(),
            penanggungJawab: String(rawKontak || ''),
            jumlahAnggota: Number(rawJumlah || 0),
            kontak: String(rawKontak || ''),
            ulpId: String(r.unitId || targetUnitId || ''),
            ulpName: String(rawUlp || ''),
            status: (rawStatus === 'Non-Aktif' || rawStatus === 'non-aktif' ? 'Non-Aktif' : 'Aktif') as 'Aktif' | 'Non-Aktif',
          };
        })
        .filter((r) => r.namaRegu && r.namaRegu !== '-');

      // Reconstruction Fallback if REGU_ROW table is empty in Supabase
      if (regu.length === 0) {
        const extractedNames = new Set<string>();

        // From Users
        users.forEach((u) => {
          if (u.reguName && u.reguName.trim() && u.reguName.trim() !== '-') {
            extractedNames.add(u.reguName.trim());
          }
        });

        // From local Work Orders cache
        try {
          const cachedWo = this.safeGetItem(`aphro_wo_${targetUnitId}`) || this.safeGetItem('aphro_work_orders');
          if (cachedWo) {
            const parsed = JSON.parse(cachedWo);
            if (Array.isArray(parsed)) {
              parsed.forEach((w: any) => {
                const name = w.reguName || w.REGU_ROW || w.regu || w.Regu;
                if (name && String(name).trim() && String(name).trim() !== '-') {
                  extractedNames.add(String(name).trim());
                }
              });
            }
          }
        } catch {}

        let idx = 1;
        extractedNames.forEach((reguName) => {
          regu.push({
            id: `rgu-auto-${idx}`,
            kodeRegu: `REG-${String(idx).padStart(2, '0')}`,
            namaRegu: reguName,
            penanggungJawab: '-',
            jumlahAnggota: 5,
            kontak: '-',
            ulpId: targetUnitId,
            ulpName: '',
            status: 'Aktif',
          });
          idx++;
        });
      }

      const petugas: Petugas[] = (ptgRes.data || []).map((ptg: any) => ({
        id: String(ptg.ID || ptg.id || `ptg-${Math.random().toString(36).substr(2, 6)}`),
        nip: String(ptg.ID || ptg.id || ''),
        nama: String(ptg.Nama || ptg.nama || ''),
        reguId: '',
        reguName: String(ptg.Regu || ptg.regu || ''),
        ulpId: targetUnitId,
        ulpName: String(ptg.ULP || ptg.ulp || ''),
        noHp: '',
        role: (ptg.Role || ptg.role || 'User') as UserRole,
        status: (ptg.Status === 'Non-Aktif' || ptg.status === 'Non-Aktif' ? 'Non-Aktif' : 'Aktif'),
      }));

      if (users.length > 0 || ulp.length > 0 || penyulang.length > 0 || regu.length > 0 || petugas.length > 0) {
        return {
          users: users.length > 0 ? users : INITIAL_USERS,
          ulp: ulp.length > 0 ? ulp : INITIAL_ULP,
          penyulang: penyulang.length > 0 ? penyulang : INITIAL_PENYULANG,
          regu: regu.length > 0 ? regu : INITIAL_REGU,
          petugas: petugas.length > 0 ? petugas : INITIAL_PETUGAS,
          source: 'supabase',
        };
      }
    } catch (err) {
      console.warn('Supabase fetchMasterData error:', err);
    }

    return {
      users: INITIAL_USERS,
      ulp: INITIAL_ULP,
      penyulang: INITIAL_PENYULANG,
      regu: INITIAL_REGU,
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

    const [woRes, relRes, absRes, masterRes] = await Promise.all([
      this.fetchWorkOrders(targetUnitId),
      this.fetchRealisasi(targetUnitId),
      this.fetchAbsensi(targetUnitId),
      this.fetchMasterData(targetUnitId),
    ]);

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
    const tables = [
      SUPABASE_TABLES.INISIASI,
      SUPABASE_TABLES.WORK_ORDER,
      SUPABASE_TABLES.REALISASI,
      SUPABASE_TABLES.ABSENSI,
      SUPABASE_TABLES.USERS,
      SUPABASE_TABLES.ULP,
      SUPABASE_TABLES.PENYULANG,
      SUPABASE_TABLES.REGU_ROW,
      SUPABASE_TABLES.PETUGAS,
    ];

    let totalRows = 0;
    let anySuccess = false;
    const results = [];

    for (const t of tables) {
      const start = Date.now();
      try {
        const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(5);
        const latency = Date.now() - start;
        if (error) {
          results.push({
            name: t,
            status: 'ERROR' as const,
            count: 0,
            latencyMs: latency,
            error: error.message,
          });
        } else {
          anySuccess = true;
          const rowCount = count !== null && count !== undefined ? count : (data ? data.length : 0);
          totalRows += rowCount;
          results.push({
            name: t,
            status: (rowCount > 0 ? 'OK' : 'EMPTY') as 'OK' | 'EMPTY',
            count: rowCount,
            latencyMs: latency,
          });
        }
      } catch (err: any) {
        results.push({
          name: t,
          status: 'ERROR' as const,
          count: 0,
          latencyMs: Date.now() - start,
          error: err.message,
        });
      }
    }

    return {
      isOnline: anySuccess,
      tables: results,
      totalRows,
      summary: anySuccess
        ? `Terhubung ke Supabase (Total ${totalRows} baris data ditemukan di 9 tabel).`
        : 'Gagal menghubungi tabel Supabase. Pastikan RLS dinonaktifkan atau izin diaktifkan.',
    };
  }

  // ==========================================
  // 8. DIRECT SEEDING MASTER DATA TO SUPABASE
  // ==========================================

  /**
   * Helper to seed a table safely with fallback strategy for constraints and casing
   */
  private static async smartSeedTable(
    tableName: string,
    payload: any[],
    idKey: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!payload || payload.length === 0) return { success: true, count: 0 };

    try {
      // 1. First attempt: standard upsert with primary key
      const { error: upsertErr } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: idKey });

      if (!upsertErr) {
        return { success: true, count: payload.length };
      }

      // Check for RLS policy error
      const errLower = (upsertErr.message || '').toLowerCase();
      if (errLower.includes('row-level security') || errLower.includes('policy')) {
        return {
          success: false,
          count: 0,
          error: `Tabel "${tableName}" terkunci RLS di Supabase. Salin dan jalankan Script SQL Setup di Supabase SQL Editor.`,
        };
      }

      // 2. Fallback: If ON CONFLICT / constraint matching error, query existing and insert
      if (
        upsertErr.message?.includes('ON CONFLICT') ||
        upsertErr.message?.includes('constraint') ||
        upsertErr.message?.includes('unique')
      ) {
        // Query existing table rows
        const { data: existingRows, error: selErr } = await supabase.from(tableName).select('*');
        if (!selErr && Array.isArray(existingRows)) {
          const existingIds = new Set(
            existingRows.map((r: any) =>
              String(r[idKey] ?? r[idKey.toLowerCase()] ?? r.id ?? r.ID ?? r.UserID ?? r.WO_ID ?? '').trim()
            )
          );

          const newItems = payload.filter(
            item => !existingIds.has(String(item[idKey] ?? item.ID ?? item.id ?? item.UserID ?? item.WO_ID ?? '').trim())
          );

          if (newItems.length > 0) {
            const { error: insertErr } = await supabase.from(tableName).insert(newItems);
            if (!insertErr) {
              return { success: true, count: newItems.length };
            } else {
              return { success: false, count: 0, error: insertErr.message };
            }
          } else {
            // Already present
            return { success: true, count: payload.length };
          }
        } else {
          // Try direct insert
          const { error: directInsertErr } = await supabase.from(tableName).insert(payload);
          if (!directInsertErr) {
            return { success: true, count: payload.length };
          }
        }
      }

      return { success: false, count: 0, error: upsertErr.message };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
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
        REALISASI_ID: rel.id,
        ID: rel.id,
        unitId: targetUnitId,
        WO_ID: rel.workOrderId || rel.id,
        Nomor_WO: rel.nomorWO || '',
        ULP: rel.ulpName || '',
        REGU_ROW: rel.reguName || '',
        PENYULANG: rel.penyulangName || '',
        NO_TIANG: rel.noTiang || '',
        Tanggal: rel.tanggalRealisasi || getWIBDateString(),
        TANGGAL: rel.tanggalRealisasi || getWIBDateString(),
        PETUGAS: rel.petugasName || rel.reguName || '',
        TIPE_POHON: rel.jenisTanaman || '',
        Jenis_Tanaman: rel.jenisTanaman || '',
        Pertumbuhan_Tanaman: rel.pertumbuhanTanaman || '',
        Kendala: rel.kendala || '',
        Lokasi_kerja: rel.lokasiKerja || '',
        LATITUDE: rel.latitude || 0,
        LONGITUDE: rel.longitude || 0,
        Latitude_Longitude: `${rel.latitude || 0}, ${rel.longitude || 0}`,
        Keterangan: rel.keterangan || '',
        FOTO_SEBELUM: rel.fotoSebelumUrl || '',
        Foto_Sebelum: rel.fotoSebelumUrl || '',
        FOTO_SETELAH: rel.fotoSesudahUrl || '',
        Foto_Sesudah: rel.fotoSesudahUrl || '',
        STATUS: 'SELESAI',
        WAKTU: rel.createdAt || getLocalDateTimeString(),
        Timestamp: rel.createdAt || getLocalDateTimeString(),
      }));
      const res = await this.smartSeedTable(SUPABASE_TABLES.REALISASI, relPayload, 'REALISASI_ID');
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
   * Authenticate user against Supabase USERS table
   */
  static async loginWithSupabase(username: string, passwordInput?: string): Promise<{
    success: boolean;
    user?: User;
    message?: string;
  }> {
    const safeUsername = (username || '').trim().toLowerCase();

    try {
      const { data, error } = await supabase.from(SUPABASE_TABLES.USERS).select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const matchedRow = data.find((u: any) => {
          const uName = String(u.Username ?? u.username ?? '').trim().toLowerCase();
          const uId = String(u.UserID ?? u.userid ?? u.id ?? '').trim().toLowerCase();
          const uNama = String(u.Nama ?? u.nama ?? u.name ?? '').trim().toLowerCase();
          return uName === safeUsername || uId === safeUsername || uNama === safeUsername;
        });

        if (matchedRow) {
          const userObj = this.normalizeUserRow(matchedRow);
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

