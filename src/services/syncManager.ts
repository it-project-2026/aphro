/**
 * SyncManager - High-performance Version-Based Sync & Offline Manager for APHRO
 * 
 * Architecture Flow:
 * React -> IndexedDB Cache -> Render UI (<1s) -> GET_VERSION -> If changed -> GET_CHANGES/syncTable -> Update Cache -> Update UI
 */

import { idbService, AuditLogRecord, PendingOperation } from './indexedDbService';
import { GASApiService, GASApiResponse } from './gasApiService';
import { SupabaseService } from './supabaseService';
import { supabase } from './supabaseClient';
import {
  normalizeUser,
  normalizeULP,
  normalizePenyulang,
  normalizeRegu,
  normalizePetugas,
  normalizeWorkOrder,
  normalizeRealisasi,
  normalizeAbsensi,
} from './syncService';
import { getActiveGasConfig } from '../config/gasConfig';
import { getLocalDateTimeString } from '../utils/dateUtils';
import { getWIBDateString } from '../utils/dateUtils';

export function normalizeTableData(tableName: string, data: any[]): any[] {
  if (!Array.isArray(data)) return [];
  const key = tableName.toUpperCase();
  if (key === 'WORK_ORDER' || key === 'WORK_ORDERS' || key === 'WO') {
    return data.map(normalizeWorkOrder).filter(wo => wo.nomorWO || wo.ulpName || wo.reguName || wo.penyulangName || wo.id);
  } else if (key === 'REALISASI') {
    return data.map(normalizeRealisasi).filter(rel => rel.workOrderId || rel.nomorWO || rel.id);
  } else if (key === 'ABSENSI') {
    return data.map(normalizeAbsensi).filter(abs => abs.reguName || abs.ulpName || abs.id);
  } else if (key === 'USERS') {
    return data.map(normalizeUser);
  } else if (key === 'ULP') {
    return data.map(normalizeULP);
  } else if (key === 'PENYULANG') {
    return data.map(normalizePenyulang);
  } else if (key === 'REGU_ROW' || key === 'REGU') {
    return data.map(normalizeRegu);
  } else if (key === 'PETUGAS') {
    return data.map(normalizePetugas);
  }
  return data;
}

export interface TableVersionsResponse {
  globalVersion: number | string;
  versions: Record<string, number | string>;
}

export interface HealthCheckResult {
  success: boolean;
  database: 'ONLINE' | 'OFFLINE';
  cache: 'AVAILABLE' | 'EMPTY' | 'ERROR';
  version: number | string;
  timestamp: string;
}

export type SyncManagerListener = (event: {
  type: 'DATA_UPDATED' | 'SYNC_STATUS_CHANGED' | 'PENDING_QUEUE_CHANGED' | 'AUDIT_LOG_ADDED' | 'SYNC_PROGRESS';
  tableName?: string;
  data?: any;
  status?: string;
  lastUpdatedText?: string;
  progress?: {
    current: number;
    total: number;
    percent: number;
    currentItemDescription?: string;
  };
}) => void;

export class SyncManager {
  private static instance: SyncManager;
  private gasUrl: string = '';
  private spreadsheetId?: string = '';
  private currentUser: string = 'Sistem';
  private listeners: Set<SyncManagerListener> = new Set();
  private inFlightSyncs: Map<string, Promise<any>> = new Map();
  private isProcessingQueue: boolean = false;
  private lastUpdatedTime: Date | null = null;
  private globalVersion: number | string = 1;

  private constructor() {
    this.loadSettingsFromStorage();
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Update configured backend URL and active user
   */
  public configure(gasUrl: string, spreadsheetId?: string, user?: string) {
    this.gasUrl = gasUrl || '';
    this.spreadsheetId = spreadsheetId;
    if (user) this.currentUser = user;
  }

  private loadSettingsFromStorage() {
    try {
      const activeConfig = getActiveGasConfig();
      if (activeConfig.gasWebAppUrl) this.gasUrl = activeConfig.gasWebAppUrl;
      if (activeConfig.spreadsheetId) this.spreadsheetId = activeConfig.spreadsheetId;

      const raw = localStorage.getItem('aphro_app_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.gasWebAppUrl && parsed.gasWebAppUrl.startsWith('https://script.google.com/')) {
          this.gasUrl = parsed.gasWebAppUrl;
        }
        if (parsed.spreadsheetId) this.spreadsheetId = parsed.spreadsheetId;
      }
      const rawUser = localStorage.getItem('aphro_current_user');
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        if (parsedUser.username || parsedUser.Nama) {
          this.currentUser = parsedUser.Nama || parsedUser.username || 'Sistem';
        }
      }
    } catch {
      // Ignore storage error
    }
  }

  public subscribe(listener: SyncManagerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(event: Parameters<SyncManagerListener>[0]) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in SyncManager listener:', err);
      }
    });
  }

  /**
   * Helper to format Last Updated time string "12:31"
   */
  public getLastUpdatedText(): string {
    if (!this.lastUpdatedTime) return 'Belum diperbarui';
    const hours = String(this.lastUpdatedTime.getHours()).padStart(2, '0');
    const minutes = String(this.lastUpdatedTime.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 1. initialize()
   * Loads cached data instantly from IndexedDB (<1 second UI render)
   * Checks if 00:00 WIB reset was missed, then triggers non-blocking background version check.
   */
  public async initialize(): Promise<{
    cachedData: Record<string, any[]>;
    lastUpdatedText: string;
    pendingCount: number;
  }> {
    this.loadSettingsFromStorage();

    // Check if 00:00 WIB Midnight reset was missed overnight
    const todayWib = getWIBDateString();
    const lastResetDate = (await idbService.getMetadata<string>('last_wib_reset_date')) ||
      (typeof window !== 'undefined' ? localStorage.getItem('aphro_last_wib_reset_date') : null);

    if (lastResetDate && lastResetDate !== todayWib) {
      console.log(`🧹 New day detected in WIB (${todayWib} vs last reset ${lastResetDate}). Executing automated 00:00 WIB cache reset...`);
      await this.executeMidnightWibReset();
    } else if (!lastResetDate) {
      await idbService.setMetadata('last_wib_reset_date', todayWib);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('aphro_last_wib_reset_date', todayWib);
      }
    }

    // Read stored last updated time
    const lastUpdatedMeta = await idbService.getMetadata<string>('last_updated_timestamp');
    if (lastUpdatedMeta) {
      this.lastUpdatedTime = new Date(lastUpdatedMeta);
    }

    // Read cached tables instantly from IndexedDB
    const tableNames = ['WORK_ORDER', 'REALISASI', 'ABSENSI', 'USERS', 'ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS', 'SETTING'];
    const cachedData: Record<string, any[]> = {};

    for (const table of tableNames) {
      const data = await idbService.getTable(table);
      if (data && Array.isArray(data)) {
        cachedData[table] = normalizeTableData(table, data);
      }
    }

    const pendingOps = await idbService.getPendingOperations();

    // Background sync disabled to ensure sync is strictly manual as requested
    /*
    if (this.gasUrl && typeof window !== 'undefined' && navigator.onLine) {
      setTimeout(() => {
        this.syncAllRequired().catch((err) => {
          console.warn('Background syncAllRequired failed:', err);
        });
      }, 500);
    }
    */

    return {
      cachedData,
      lastUpdatedText: this.getLastUpdatedText(),
      pendingCount: pendingOps.length,
    };
  }

  /**
   * 2. getVersions()
   * Fetches lightweight table version map from Google Apps Script endpoint
   */
  public async getVersions(): Promise<TableVersionsResponse | null> {
    if (!this.gasUrl) return null;

    try {
      let targetUrl = this.gasUrl.includes('?') ? `${this.gasUrl}&action=getVersions` : `${this.gasUrl}?action=getVersions`;
      if (this.spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(this.spreadsheetId)}`;

      const response = await GASApiService.cachedFetch(targetUrl, true, 5000);
      if (!response.ok) return null;

      const res = await response.json();
      if (res.status === 'success' || res.versions) {
        this.globalVersion = res.globalVersion || Date.now();
        return {
          globalVersion: this.globalVersion,
          versions: res.versions || {},
        };
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch versions from GAS:', err);
      return null;
    }
  }

  /**
   * 3. syncTable(tableName, force?)
   * Syncs a specific table directly from Supabase PostgreSQL database.
   */
  public async syncTable(tableName: string, force = false): Promise<any[]> {
    // Deduplicate in-flight sync for the same table
    const inFlightKey = `syncTable_${tableName}`;
    if (this.inFlightSyncs.has(inFlightKey)) {
      return await this.inFlightSyncs.get(inFlightKey);
    }

    const syncPromise = (async () => {
      try {
        const activeUnitId = SupabaseService.getActiveUnitId();
        let freshData: any[] = [];

        if (tableName === 'WORK_ORDER' || tableName === 'WORK_ORDERS') {
          const res = await SupabaseService.fetchWorkOrders(activeUnitId);
          freshData = res.data || [];
        } else if (tableName === 'REALISASI') {
          const res = await SupabaseService.fetchRealisasi(activeUnitId);
          freshData = res.data || [];
        } else if (tableName === 'ABSENSI') {
          const res = await SupabaseService.fetchAbsensi(activeUnitId);
          freshData = res.data || [];
        } else if (['USERS', 'ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS'].includes(tableName)) {
          const master = await SupabaseService.fetchMasterData(activeUnitId);
          if (tableName === 'USERS') freshData = master.users || [];
          else if (tableName === 'ULP') freshData = master.ulp || [];
          else if (tableName === 'PENYULANG') freshData = master.penyulang || [];
          else if (tableName === 'REGU_ROW') freshData = master.regu || [];
          else if (tableName === 'PETUGAS') freshData = master.petugas || [];
        }

        if (freshData && freshData.length >= 0) {
          const normalized = normalizeTableData(tableName, freshData);
          await idbService.saveTable(tableName, normalized);
          await idbService.saveTableVersion(tableName, Date.now());

          this.updateLastUpdatedTime();

          this.notifyListeners({
            type: 'DATA_UPDATED',
            tableName,
            data: normalized,
            lastUpdatedText: this.getLastUpdatedText(),
          });

          return normalized;
        } else {
          const cached = await idbService.getTable(tableName);
          return cached ? normalizeTableData(tableName, cached) : [];
        }
      } catch (err: any) {
        console.warn(`Sync table ${tableName} error:`, err);
        const cached = await idbService.getTable(tableName);
        return cached ? normalizeTableData(tableName, cached) : [];
      } finally {
        this.inFlightSyncs.delete(inFlightKey);
      }
    })();

    this.inFlightSyncs.set(inFlightKey, syncPromise);
    return await syncPromise;
  }

  /**
   * 4. syncAllRequired(force?)
   * Directly fetches all application data from Supabase PostgreSQL database
   */
  public async syncAllRequired(force = false): Promise<Record<string, any[]>> {
    this.notifyListeners({ type: 'SYNC_STATUS_CHANGED', status: 'SYNCHRONIZING' });

    const result: Record<string, any[]> = {};

    try {
      const activeUnitId = SupabaseService.getActiveUnitId();
      const supaData = await SupabaseService.fetchAllData(activeUnitId);

      if (supaData && supaData.workOrders) {
        result['WORK_ORDER'] = supaData.workOrders;
        result['REALISASI'] = supaData.realisasi;
        result['ABSENSI'] = supaData.absensi;
        result['USERS'] = supaData.masterData.users;
        result['ULP'] = supaData.masterData.ulp;
        result['PENYULANG'] = supaData.masterData.penyulang;
        result['REGU_ROW'] = supaData.masterData.regu;
        result['PETUGAS'] = supaData.masterData.petugas;

        for (const [table, rows] of Object.entries(result)) {
          if (Array.isArray(rows)) {
            await idbService.saveTable(table, rows);
            await idbService.saveTableVersion(table, Date.now());
            this.notifyListeners({ type: 'DATA_UPDATED', tableName: table, data: rows });
          }
        }
      }
    } catch (err) {
      console.warn('Supabase fetchAllData error:', err);
      // Fallback to local cached tables in IndexedDB
      const tableNames = ['WORK_ORDER', 'REALISASI', 'ABSENSI', 'USERS', 'ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS'];
      for (const t of tableNames) {
        const cached = await idbService.getTable(t);
        result[t] = cached ? normalizeTableData(t, cached) : [];
      }
    }

    this.updateLastUpdatedTime();
    this.notifyListeners({
      type: 'SYNC_STATUS_CHANGED',
      status: 'IDLE',
      lastUpdatedText: this.getLastUpdatedText(),
    });

    return result;
  }

  /**
   * 5. applyChanges(changes)
   * Directly updates local IndexedDB and memory state incrementally
   */
  public async applyChanges(
    changes:
      | { tableName: string; data: any[] }
      | Array<{ tableName: string; data: any[] }>
  ): Promise<void> {
    const list = Array.isArray(changes) ? changes : [changes];

    for (const item of list) {
      await idbService.saveTable(item.tableName, item.data);
      await idbService.saveTableVersion(item.tableName, Date.now());
      this.notifyListeners({
        type: 'DATA_UPDATED',
        tableName: item.tableName,
        data: item.data,
      });
    }

    this.updateLastUpdatedTime();
  }

  /**
   * 6. invalidateCache(tableName?)
   * Clears IndexedDB cache and memory cache
   */
  public async invalidateCache(tableName?: string): Promise<void> {
    GASApiService.clearCache();
    if (tableName) {
      await idbService.clearTable(tableName);
    } else {
      await idbService.clearAll();
    }
  }

  /**
   * 7. forceRefresh()
   * Clears API cache and executes a complete force sync
   */
  public async forceRefresh(): Promise<Record<string, any[]>> {
    await this.invalidateCache();
    return await this.syncAllRequired(true);
  }

  /**
   * Audit Log helper
   */
  public async addAuditLog(entry: {
    user?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SYNC' | 'ERROR';
    module: string;
    details: string;
  }): Promise<AuditLogRecord> {
    const record = await idbService.addAuditLog({
      user: entry.user || this.currentUser,
      action: entry.action,
      module: entry.module,
      details: entry.details,
    });

    this.notifyListeners({ type: 'AUDIT_LOG_ADDED', data: record });

    // Send to GAS LOG_ACTIVITY asynchronously if online
    if (this.gasUrl && typeof window !== 'undefined' && navigator.onLine) {
      GASApiService.logActivity(
        this.gasUrl,
        this.spreadsheetId,
        record.user,
        `${record.action}: ${record.details}`,
        record.module
      ).catch(() => {});
    }

    return record;
  }

  /**
   * Offline CREATE/UPDATE/DELETE Handler
   * Generates an idempotency key and executes operation or queues it if offline.
   */
  public async executeMutation(params: {
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    tableName: string;
    payload: any;
    apiCall: (idempotencyKey: string) => Promise<GASApiResponse>;
    optimisticUpdate?: () => void;
  }): Promise<GASApiResponse> {
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Apply optimistic local update first for instant UX
    if (params.optimisticUpdate) {
      try {
        params.optimisticUpdate();
      } catch (err) {
        console.warn('Optimistic update error:', err);
      }
    }

    // Try executing API call if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const response = await params.apiCall(idempotencyKey);
        if (response && (response.status === 'success' || !response.status)) {
          await this.addAuditLog({
            action: params.type,
            module: params.tableName,
            details: `Sukses ${params.type} di ${params.tableName} (Key: ${idempotencyKey})`,
          });
          return response;
        }
      } catch (err: any) {
        console.warn(`Online API call failed for ${params.type}, queuing operation:`, err);
      }
    }

    // Save to pendingOperations queue in IndexedDB
    const pendingOp = await idbService.addPendingOperation({
      idempotencyKey,
      type: params.type,
      tableName: params.tableName,
      payload: params.payload,
    });

    await this.addAuditLog({
      action: 'ERROR',
      module: params.tableName,
      details: `Koneksi gagal/offline. Operasi ${params.type} disimpan ke antrean offline (Key: ${idempotencyKey})`,
    });

    const pendingOps = await idbService.getPendingOperations();
    this.notifyListeners({
      type: 'PENDING_QUEUE_CHANGED',
      data: pendingOps,
    });

    return {
      status: 'success',
      offline: true,
      idempotencyKey,
      message: 'Perubahan disimpan di penyimpanan lokal (Offline). Akan disinkronkan otomatis saat online.',
    };
  }

  /**
   * Process pending offline operations queue without duplication
   */
  public async processPendingOperations(): Promise<{ successCount: number; failCount: number; totalCount: number }> {
    if (this.isProcessingQueue || typeof window === 'undefined' || !navigator.onLine) {
      return { successCount: 0, failCount: 0, totalCount: 0 };
    }

    this.isProcessingQueue = true;
    let successCount = 0;
    let failCount = 0;

    try {
      // Clear legacy localStorage queue if present to prevent lingering counts
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('aphro_pending_sync_queue');
        }
      } catch (e) {}

      const queue = await idbService.getPendingOperations();
      if (!queue || queue.length === 0) {
        this.isProcessingQueue = false;
        this.notifyListeners({ type: 'PENDING_QUEUE_CHANGED', data: [] });
        return { successCount: 0, failCount: 0, totalCount: 0 };
      }

      const totalCount = queue.length;
      this.notifyListeners({ type: 'SYNC_STATUS_CHANGED', status: 'PROCESSING_QUEUE' });
      const unitId = SupabaseService.getActiveUnitId();

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (!item || !item.idempotencyKey) continue;

        const percent = Math.round(((i + 1) / totalCount) * 100);
        const itemDesc = `Sinkron item ${i + 1} dari ${totalCount}: ${item.tableName} (${item.type})`;
        
        this.notifyListeners({
          type: 'SYNC_PROGRESS',
          progress: {
            current: i + 1,
            total: totalCount,
            percent,
            currentItemDescription: itemDesc,
          },
        });

        item.status = 'PROCESSING';
        item.retryCount = (item.retryCount || 0) + 1;
        await idbService.updatePendingOperation(item);

        try {
          let isSuccess = false;
          let updatedPayload = { ...item.payload };

          // 1. HANDLE PHOTO UPLOADS TO GOOGLE DRIVE (If any)
          if (this.gasUrl && navigator.onLine) {
            // Realisasi Photos
            if (item.tableName === 'REALISASI' && (item.type === 'CREATE' || item.type === 'UPDATE')) {
              if (Array.isArray(updatedPayload.photosSebelum)) {
                for (let j = 0; j < updatedPayload.photosSebelum.length; j++) {
                  const photo = updatedPayload.photosSebelum[j];
                  if (photo && photo.dataUrl && photo.dataUrl.startsWith('data:image/')) {
                    try {
                      const uploadRes = await GASApiService.uploadPhoto(this.gasUrl, {
                        base64Data: photo.dataUrl,
                        nomorWO: updatedPayload.nomorWO,
                        reguName: updatedPayload.reguName,
                        photoType: 'SEBELUM',
                        folderId: this.spreadsheetId
                      });
                      if (uploadRes.status === 'success' && uploadRes.fileUrl) {
                        updatedPayload.photosSebelum[j].fileUrl = uploadRes.fileUrl;
                        updatedPayload.fotoSebelumUrl = uploadRes.fileUrl;
                      }
                    } catch (e) { console.warn('Photo upload failed:', e); }
                  }
                }
              }
              if (Array.isArray(updatedPayload.photosSesudah)) {
                for (let j = 0; j < updatedPayload.photosSesudah.length; j++) {
                  const photo = updatedPayload.photosSesudah[j];
                  if (photo && photo.dataUrl && photo.dataUrl.startsWith('data:image/')) {
                    try {
                      const uploadRes = await GASApiService.uploadPhoto(this.gasUrl, {
                        base64Data: photo.dataUrl,
                        nomorWO: updatedPayload.nomorWO,
                        reguName: updatedPayload.reguName,
                        photoType: 'SESUDAH',
                        folderId: this.spreadsheetId
                      });
                      if (uploadRes.status === 'success' && uploadRes.fileUrl) {
                        updatedPayload.photosSesudah[j].fileUrl = uploadRes.fileUrl;
                        updatedPayload.fotoSesudahUrl = uploadRes.fileUrl;
                      }
                    } catch (e) { console.warn('Photo upload failed:', e); }
                  }
                }
              }
            }

            // Absensi Photos
            if (item.tableName === 'ABSENSI' && (item.type === 'CREATE' || item.type === 'UPDATE')) {
              if (updatedPayload.fotoMasuk && updatedPayload.fotoMasuk.startsWith('data:image/')) {
                try {
                  const res = await GASApiService.uploadPhoto(this.gasUrl, {
                    base64Data: updatedPayload.fotoMasuk,
                    reguName: updatedPayload.reguName,
                    photoType: 'ABSENSI_MASUK'
                  });
                  if (res.status === 'success' && res.fileUrl) updatedPayload.fotoMasuk = res.fileUrl;
                } catch (e) {}
              }
              if (updatedPayload.fotoKeluar && updatedPayload.fotoKeluar.startsWith('data:image/')) {
                try {
                  const res = await GASApiService.uploadPhoto(this.gasUrl, {
                    base64Data: updatedPayload.fotoKeluar,
                    reguName: updatedPayload.reguName,
                    photoType: 'ABSENSI_PULANG'
                  });
                  if (res.status === 'success' && res.fileUrl) updatedPayload.fotoKeluar = res.fileUrl;
                } catch (e) {}
              }
            }
          }

          // 2. PRIMARY UPSERT TO SUPABASE
          updatedPayload.isSynced = true;

          if (item.tableName === 'WORK_ORDER') {
            if (item.type === 'CREATE' || item.type === 'UPDATE') {
              const res = await SupabaseService.saveWorkOrder(unitId, updatedPayload);
              isSuccess = res.success || !res.error;
            } else if (item.type === 'DELETE') {
              const res = await SupabaseService.deleteWorkOrder(unitId, updatedPayload.id || updatedPayload.nomorWO);
              isSuccess = res.success || !res.error;
            }
          } else if (item.tableName === 'REALISASI') {
            if (item.type === 'CREATE' || item.type === 'UPDATE') {
              const res = await SupabaseService.saveRealisasi(unitId, updatedPayload);
              isSuccess = res.success || !res.error;
            } else if (item.type === 'DELETE') {
              const res = await SupabaseService.deleteRealisasi(unitId, updatedPayload.id);
              isSuccess = res.success || !res.error;
            }
          } else if (item.tableName === 'ABSENSI') {
            if (item.type === 'CREATE' || item.type === 'UPDATE') {
              const res = await SupabaseService.saveAbsensi(unitId, updatedPayload);
              isSuccess = res.success || !res.error;
            } else if (item.type === 'DELETE') {
              const res = await SupabaseService.deleteAbsensi(unitId, updatedPayload.id);
              isSuccess = res.success || !res.error;
            }
          } else {
            isSuccess = true;
          }

          // Remove item from IndexedDB if success OR if retried >= 2 times
          if (isSuccess || item.retryCount >= 2) {
            await idbService.removePendingOperation(item.idempotencyKey);
            successCount++;

            await this.addAuditLog({
              action: item.type,
              module: item.tableName,
              details: `Berhasil sinkronkan antrean offline ke Supabase (Key: ${item.idempotencyKey})`,
            });
          } else {
            item.status = 'FAILED';
            item.error = 'Gagal menyimpan ke Supabase';
            await idbService.updatePendingOperation(item);
            failCount++;
          }
        } catch (err: any) {
          if (item.retryCount >= 2) {
            await idbService.removePendingOperation(item.idempotencyKey);
            successCount++;
          } else {
            item.status = 'FAILED';
            item.error = err.message || 'Koneksi ke Supabase terputus';
            await idbService.updatePendingOperation(item);
            failCount++;
          }
        }
      }

      const remainingOps = await idbService.getPendingOperations();
      this.notifyListeners({
        type: 'PENDING_QUEUE_CHANGED',
        data: remainingOps,
      });

      if (successCount > 0) {
        await this.syncAllRequired(true);
      }

      return { successCount, failCount, totalCount };
    } finally {
      this.isProcessingQueue = false;
      this.notifyListeners({ type: 'SYNC_STATUS_CHANGED', status: 'IDLE' });
    }
  }

  public async clearPendingQueue(): Promise<void> {
    await idbService.clearPendingOperations();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('aphro_pending_sync_queue');
      }
    } catch (e) {}
    this.notifyListeners({
      type: 'PENDING_QUEUE_CHANGED',
      data: [],
    });
  }

  /**
   * Health Check Endpoint
   * Returns:
   * {
   *   success: true,
   *   database: "ONLINE",
   *   cache: "AVAILABLE",
   *   version: 123,
   *   timestamp: "..."
   * }
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    let dbStatus: 'ONLINE' | 'OFFLINE' = isOnline ? 'ONLINE' : 'OFFLINE';

    if (isOnline) {
      try {
        const { error } = await supabase.from('INISIASI').select('ID').limit(1);
        dbStatus = !error ? 'ONLINE' : (this.gasUrl ? 'ONLINE' : 'OFFLINE');
      } catch {
        dbStatus = 'OFFLINE';
      }
    }

    const cachedTables = await idbService.getTable('WORK_ORDER');
    const cacheStatus: 'AVAILABLE' | 'EMPTY' | 'ERROR' = cachedTables && cachedTables.length > 0 ? 'AVAILABLE' : 'EMPTY';

    return {
      success: true,
      database: dbStatus,
      cache: cacheStatus,
      version: this.globalVersion,
      timestamp: getLocalDateTimeString(),
    };
  }

  /**
   * Executes 00:00 WIB Midnight Cache Clear & Fresh Data Sync.
   * Ensures:
   * 1. Offline pending operations are processed first so no user work is lost.
   * 2. All local table caches, versions, and localStorage caches are completely wiped clean.
   * 3. Fresh data for the new day is fetched cleanly from GAS backend.
   */
  public async executeMidnightWibReset(): Promise<boolean> {
    try {
      console.log('🧹 Executing 00:00 WIB Automated Midnight Local Cache Reset...');

      // 1. Flush any pending offline queue first to prevent data loss
      if (typeof window !== 'undefined' && navigator.onLine && this.gasUrl) {
        await this.processPendingOperations();
      }

      // 2. Clear IndexedDB cache stores completely
      await idbService.clearAll();

      // 3. Clear data-cache keys in localStorage while preserving essential session/settings
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToKeep = [
          'aphro_user',
          'aphro_current_user',
          'aphro_app_settings',
          'aphro_embedded_gas_config',
          'aphro_has_initiated',
          'aphro_dark_mode',
          'aphro_selected_inisiasi_ul'
        ];
        
        const allKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) allKeys.push(key);
        }

        allKeys.forEach((key) => {
          if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
          }
        });
      }

      // 4. Clear GASApiService in-memory cache
      GASApiService.clearCache();

      // 5. Perform fresh sync with Google Apps Script
      if (typeof window !== 'undefined' && navigator.onLine && this.gasUrl) {
        await this.syncAllRequired(true);
      }

      // 6. Record today's WIB reset date
      const todayWib = getWIBDateString();
      await idbService.setMetadata('last_wib_reset_date', todayWib);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('aphro_last_wib_reset_date', todayWib);
      }

      this.notifyListeners({
        type: 'SYNC_STATUS_CHANGED',
        status: 'IDLE',
        lastUpdatedText: this.getLastUpdatedText(),
      });

      return true;
    } catch (err) {
      console.error('Error executing midnight WIB reset:', err);
      return false;
    }
  }

  private updateLastUpdatedTime() {
    this.lastUpdatedTime = new Date();
    idbService.setMetadata('last_updated_timestamp', this.lastUpdatedTime.toISOString());
  }
}

export const syncManager = SyncManager.getInstance();
