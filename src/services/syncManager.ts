/**
 * SyncManager - High-performance Version-Based Sync & Offline Manager for APHRO
 * 
 * Architecture Flow:
 * React -> IndexedDB Cache -> Render UI (<1s) -> GET_VERSION -> If changed -> GET_CHANGES/syncTable -> Update Cache -> Update UI
 */

import { idbService, AuditLogRecord, PendingOperation } from './indexedDbService';
import { GASApiService, GASApiResponse } from './gasApiService';

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
  type: 'DATA_UPDATED' | 'SYNC_STATUS_CHANGED' | 'PENDING_QUEUE_CHANGED' | 'AUDIT_LOG_ADDED';
  tableName?: string;
  data?: any;
  status?: string;
  lastUpdatedText?: string;
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
      const raw = localStorage.getItem('aphro_app_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.gasWebAppUrl) this.gasUrl = parsed.gasWebAppUrl;
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

  private notifyListeners(event: {
    type: 'DATA_UPDATED' | 'SYNC_STATUS_CHANGED' | 'PENDING_QUEUE_CHANGED' | 'AUDIT_LOG_ADDED';
    tableName?: string;
    data?: any;
    status?: string;
    lastUpdatedText?: string;
  }) {
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
   * Then triggers non-blocking background version check.
   */
  public async initialize(): Promise<{
    cachedData: Record<string, any[]>;
    lastUpdatedText: string;
    pendingCount: number;
  }> {
    this.loadSettingsFromStorage();

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
      if (data) {
        cachedData[table] = data;
      }
    }

    const pendingOps = await idbService.getPendingOperations();

    // Trigger non-blocking version check in background if online & URL configured
    if (this.gasUrl && typeof window !== 'undefined' && navigator.onLine) {
      setTimeout(() => {
        this.syncAllRequired().catch((err) => {
          console.warn('Background syncAllRequired failed:', err);
        });
      }, 500);
    }

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

      const response = await fetch(targetUrl, { method: 'GET' });
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
   * Syncs a specific table from GAS backend if version differs or force is true.
   */
  public async syncTable(tableName: string, force = false): Promise<any[]> {
    if (!this.gasUrl) {
      const cached = await idbService.getTable(tableName);
      return cached || [];
    }

    // Deduplicate in-flight sync for the same table
    const inFlightKey = `syncTable_${tableName}`;
    if (this.inFlightSyncs.has(inFlightKey)) {
      return await this.inFlightSyncs.get(inFlightKey);
    }

    const syncPromise = (async () => {
      try {
        let response: GASApiResponse | null = null;

        if (tableName === 'WORK_ORDER' || tableName === 'WORK_ORDERS') {
          response = await GASApiService.fetchWorkOrders(this.gasUrl, this.spreadsheetId);
        } else if (tableName === 'REALISASI') {
          response = await GASApiService.fetchRealisasi(this.gasUrl, this.spreadsheetId);
        } else if (tableName === 'ABSENSI') {
          response = await GASApiService.fetchAbsensi(this.gasUrl, this.spreadsheetId);
        } else if (tableName === 'USERS') {
          response = await GASApiService.fetchUsers(this.gasUrl, this.spreadsheetId);
        } else if (['ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS'].includes(tableName)) {
          response = await GASApiService.fetchMasterData(this.gasUrl, tableName, this.spreadsheetId);
        }

        if (response && response.status === 'success' && Array.isArray(response.data)) {
          const freshData = response.data;
          await idbService.saveTable(tableName, freshData);
          await idbService.saveTableVersion(tableName, Date.now());

          this.updateLastUpdatedTime();

          this.notifyListeners({
            type: 'DATA_UPDATED',
            tableName,
            data: freshData,
            lastUpdatedText: this.getLastUpdatedText(),
          });

          return freshData;
        } else {
          const cached = await idbService.getTable(tableName);
          return cached || [];
        }
      } catch (err: any) {
        console.warn(`Sync table ${tableName} error:`, err);
        const cached = await idbService.getTable(tableName);
        return cached || [];
      } finally {
        this.inFlightSyncs.delete(inFlightKey);
      }
    })();

    this.inFlightSyncs.set(inFlightKey, syncPromise);
    return await syncPromise;
  }

  /**
   * 4. syncAllRequired(force?)
   * Version-based sync: checks versions first. Only syncs tables that have changed!
   */
  public async syncAllRequired(force = false): Promise<Record<string, any[]>> {
    this.notifyListeners({ type: 'SYNC_STATUS_CHANGED', status: 'SYNCHRONIZING' });

    const localVersions = await idbService.getAllVersions();
    const result: Record<string, any[]> = {};

    if (!force) {
      const remoteVersionInfo = await this.getVersions();

      if (remoteVersionInfo && remoteVersionInfo.versions) {
        const remoteVersions = remoteVersionInfo.versions;
        const tablesToSync: string[] = [];

        for (const [table, remoteVer] of Object.entries(remoteVersions)) {
          const localVer = localVersions[table];
          if (!localVer || String(localVer) !== String(remoteVer)) {
            tablesToSync.push(table);
          }
        }

        if (tablesToSync.length === 0) {
          // No changes! Zero network table downloads needed!
          this.updateLastUpdatedTime();
          this.notifyListeners({
            type: 'SYNC_STATUS_CHANGED',
            status: 'IDLE',
            lastUpdatedText: this.getLastUpdatedText(),
          });

          const tableNames = ['WORK_ORDER', 'REALISASI', 'ABSENSI', 'USERS', 'ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS'];
          for (const t of tableNames) {
            result[t] = (await idbService.getTable(t)) || [];
          }
          return result;
        }

        // Fetch only changed tables
        for (const table of tablesToSync) {
          result[table] = await this.syncTable(table, true);
        }

        // Load remaining cached tables
        const allTables = ['WORK_ORDER', 'REALISASI', 'ABSENSI', 'USERS', 'ULP', 'PENYULANG', 'REGU_ROW', 'PETUGAS'];
        for (const t of allTables) {
          if (!result[t]) {
            result[t] = (await idbService.getTable(t)) || [];
          }
        }

        this.notifyListeners({
          type: 'SYNC_STATUS_CHANGED',
          status: 'IDLE',
          lastUpdatedText: this.getLastUpdatedText(),
        });
        return result;
      }
    }

    // Fallback if no version response or force is true: single call getAllData
    try {
      const res = await GASApiService.fetchAllData(this.gasUrl, this.spreadsheetId);
      if (res.status === 'success' && res.data) {
        const allData = res.data;
        for (const [table, rows] of Object.entries(allData)) {
          if (Array.isArray(rows)) {
            await idbService.saveTable(table, rows);
            await idbService.saveTableVersion(table, Date.now());
            result[table] = rows;
            this.notifyListeners({ type: 'DATA_UPDATED', tableName: table, data: rows });
          }
        }
      }
    } catch (err) {
      console.warn('Fallback fetchAllData error:', err);
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
      fetch(this.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'logActivity',
          spreadsheetId: this.spreadsheetId,
          user: record.user,
          aktivitas: `${record.action}: ${record.details}`,
          modul: record.module,
        }),
      }).catch(() => {});
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
    if (this.gasUrl && typeof window !== 'undefined' && navigator.onLine) {
      try {
        const response = await params.apiCall(idempotencyKey);
        if (response.status === 'success') {
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
  public async processPendingOperations(): Promise<number> {
    if (this.isProcessingQueue || !this.gasUrl || typeof window === 'undefined' || !navigator.onLine) {
      return 0;
    }

    this.isProcessingQueue = true;
    let processedCount = 0;

    try {
      const queue = await idbService.getPendingOperations();
      if (queue.length === 0) {
        this.isProcessingQueue = false;
        return 0;
      }

      this.notifyListeners({ type: 'SYNC_STATUS_CHANGED', status: 'PROCESSING_QUEUE' });

      for (const item of queue) {
        if (item.status === 'PROCESSING') continue;

        item.status = 'PROCESSING';
        item.retryCount = (item.retryCount || 0) + 1;
        await idbService.updatePendingOperation(item);

        try {
          let res: GASApiResponse | null = null;

          if (item.tableName === 'WORK_ORDER') {
            if (item.type === 'CREATE') {
              res = await GASApiService.createWorkOrder(this.gasUrl, this.spreadsheetId, item.payload);
            } else if (item.type === 'UPDATE') {
              res = await GASApiService.updateWorkOrder(this.gasUrl, this.spreadsheetId, item.payload.id, item.payload);
            } else if (item.type === 'DELETE') {
              res = await GASApiService.deleteWorkOrder(this.gasUrl, this.spreadsheetId || '', item.payload.id);
            }
          } else if (item.tableName === 'REALISASI') {
            if (item.type === 'CREATE') {
              res = await GASApiService.saveRealisasi(this.gasUrl, this.spreadsheetId, item.payload);
            } else if (item.type === 'UPDATE') {
              res = await GASApiService.updateRealisasi(this.gasUrl, this.spreadsheetId || '', item.payload.id, item.payload);
            } else if (item.type === 'DELETE') {
              res = await GASApiService.deleteRealisasi(this.gasUrl, this.spreadsheetId || '', item.payload.id);
            }
          } else if (item.tableName === 'ABSENSI') {
            if (item.type === 'CREATE' || item.type === 'UPDATE') {
              res = await GASApiService.saveAbsensi(this.gasUrl, this.spreadsheetId, item.payload);
            } else if (item.type === 'DELETE') {
              res = await GASApiService.deleteAbsensi(this.gasUrl, this.spreadsheetId || '', item.payload.id);
            }
          } else {
            if (item.type === 'CREATE' || item.type === 'UPDATE') {
              res = await GASApiService.saveMasterItem(this.gasUrl, this.spreadsheetId, item.tableName, item.payload);
            } else if (item.type === 'DELETE') {
              res = await GASApiService.deleteMasterItem(this.gasUrl, this.spreadsheetId || '', item.tableName, item.payload.id);
            }
          }

          if (res && res.status === 'success') {
            await idbService.removePendingOperation(item.idempotencyKey);
            processedCount++;
            await this.addAuditLog({
              action: item.type,
              module: item.tableName,
              details: `Berhasil memproses antrean offline (Key: ${item.idempotencyKey})`,
            });
          } else {
            item.status = 'FAILED';
            item.error = res?.message || 'Gagal mengirim transaksi';
            await idbService.updatePendingOperation(item);
          }
        } catch (err: any) {
          item.status = 'FAILED';
          item.error = err.message || 'Koneksi terputus';
          await idbService.updatePendingOperation(item);
        }
      }

      const remainingOps = await idbService.getPendingOperations();
      this.notifyListeners({
        type: 'PENDING_QUEUE_CHANGED',
        data: remainingOps,
      });

      if (processedCount > 0) {
        await this.syncAllRequired(true);
      }
    } finally {
      this.isProcessingQueue = false;
      this.notifyListeners({ type: 'SYNC_STATUS_CHANGED', status: 'IDLE' });
    }

    return processedCount;
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
    let dbStatus: 'ONLINE' | 'OFFLINE' = isOnline && !!this.gasUrl ? 'ONLINE' : 'OFFLINE';

    if (isOnline && this.gasUrl) {
      try {
        const isConn = await GASApiService.testConnection(this.gasUrl);
        dbStatus = isConn ? 'ONLINE' : 'OFFLINE';
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
      timestamp: new Date().toISOString(),
    };
  }

  private updateLastUpdatedTime() {
    this.lastUpdatedTime = new Date();
    idbService.setMetadata('last_updated_timestamp', this.lastUpdatedTime.toISOString());
  }
}

export const syncManager = SyncManager.getInstance();
