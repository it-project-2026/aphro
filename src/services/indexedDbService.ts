/**
 * IndexedDB Service for APHRO - Asset Protection & Hazard Response Operations
 * Provides client-side persistent storage for table data, versions, pending operations, and audit logs.
 */

const DB_NAME = 'aphro_app_db';
const DB_VERSION = 1;

export interface CachedTableRecord<T = any> {
  tableName: string;
  data: T[];
  updatedAt: string;
}

export interface TableVersionRecord {
  tableName: string;
  version: number | string;
  updatedAt: string;
}

export interface PendingOperation {
  idempotencyKey: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  tableName: string;
  payload: any;
  timestamp: string;
  retryCount: number;
  status: 'PENDING' | 'PROCESSING' | 'FAILED';
  error?: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  user: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SYNC' | 'ERROR';
  module: string;
  details: string;
  synced?: boolean;
}

class IndexedDBService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;

        if (!db.objectStoreNames.contains('tables')) {
          db.createObjectStore('tables', { keyPath: 'tableName' });
        }
        if (!db.objectStoreNames.contains('versions')) {
          db.createObjectStore('versions', { keyPath: 'tableName' });
        }
        if (!db.objectStoreNames.contains('pendingOperations')) {
          db.createObjectStore('pendingOperations', { keyPath: 'idempotencyKey' });
        }
        if (!db.objectStoreNames.contains('auditLogs')) {
          db.createObjectStore('auditLogs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('IndexedDB open failed:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- TABLES ---
  async getTable<T = any>(tableName: string): Promise<T[] | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('tables', 'readonly');
        const store = tx.objectStore('tables');
        const req = store.get(tableName);
        req.onsuccess = () => resolve(req.result ? (req.result.data as T[]) : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async saveTable<T = any>(tableName: string, data: T[]): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('tables', 'readwrite');
        const store = tx.objectStore('tables');
        const record: CachedTableRecord<T> = {
          tableName,
          data,
          updatedAt: new Date().toISOString(),
        };
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`Failed to save table ${tableName} to IndexedDB`, err);
    }
  }

  async clearTable(tableName: string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('tables', 'readwrite');
      tx.objectStore('tables').delete(tableName);
    } catch (e) {
      console.warn(`Failed to clear table ${tableName}`, e);
    }
  }

  // --- VERSIONS ---
  async getTableVersion(tableName: string): Promise<number | string | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('versions', 'readonly');
        const store = tx.objectStore('versions');
        const req = store.get(tableName);
        req.onsuccess = () => resolve(req.result ? req.result.version : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async getAllVersions(): Promise<Record<string, number | string>> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('versions', 'readonly');
        const store = tx.objectStore('versions');
        const req = store.getAll();
        req.onsuccess = () => {
          const map: Record<string, number | string> = {};
          (req.result || []).forEach((item: TableVersionRecord) => {
            map[item.tableName] = item.version;
          });
          resolve(map);
        };
        req.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  }

  async saveTableVersion(tableName: string, version: number | string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('versions', 'readwrite');
      tx.objectStore('versions').put({
        tableName,
        version,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`Failed to save version for ${tableName}`, e);
    }
  }

  // --- PENDING OPERATIONS ---
  async getPendingOperations(): Promise<PendingOperation[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('pendingOperations', 'readonly');
        const store = tx.objectStore('pendingOperations');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async addPendingOperation(op: Omit<PendingOperation, 'timestamp' | 'retryCount' | 'status'> & { timestamp?: string }): Promise<PendingOperation> {
    const fullOp: PendingOperation = {
      ...op,
      timestamp: op.timestamp || new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };
    try {
      const db = await this.initDB();
      const tx = db.transaction('pendingOperations', 'readwrite');
      tx.objectStore('pendingOperations').put(fullOp);
    } catch (e) {
      console.warn('Failed to add pending operation to IndexedDB', e);
    }
    return fullOp;
  }

  async updatePendingOperation(op: PendingOperation): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('pendingOperations', 'readwrite');
      tx.objectStore('pendingOperations').put(op);
    } catch (e) {
      console.warn('Failed to update pending operation in IndexedDB', e);
    }
  }

  async removePendingOperation(idempotencyKey: string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('pendingOperations', 'readwrite');
      tx.objectStore('pendingOperations').delete(idempotencyKey);
    } catch (e) {
      console.warn(`Failed to remove pending operation ${idempotencyKey}`, e);
    }
  }

  // --- AUDIT LOGS ---
  async getAuditLogs(): Promise<AuditLogRecord[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('auditLogs', 'readonly');
        const store = tx.objectStore('auditLogs');
        const req = store.getAll();
        req.onsuccess = () => {
          const logs = req.result || [];
          logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(logs);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async addAuditLog(entry: Omit<AuditLogRecord, 'id' | 'timestamp'> & { timestamp?: string; id?: string }): Promise<AuditLogRecord> {
    const log: AuditLogRecord = {
      id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      user: entry.user || 'Sistem',
      action: entry.action,
      module: entry.module,
      details: entry.details,
      synced: false,
    };
    try {
      const db = await this.initDB();
      const tx = db.transaction('auditLogs', 'readwrite');
      tx.objectStore('auditLogs').put(log);
    } catch (e) {
      console.warn('Failed to add audit log to IndexedDB', e);
    }
    return log;
  }

  // --- METADATA ---
  async setMetadata(key: string, value: any): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('metadata', 'readwrite');
      tx.objectStore('metadata').put({ key, value, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.warn(`Failed to set metadata ${key}`, e);
    }
  }

  async getMetadata<T = any>(key: string): Promise<T | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('metadata', 'readonly');
        const req = tx.objectStore('metadata').get(key);
        req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.initDB();
      const stores = ['tables', 'versions', 'pendingOperations', 'auditLogs', 'metadata'];
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((store) => tx.objectStore(store).clear());
    } catch (e) {
      console.warn('Failed to clear IndexedDB', e);
    }
  }
}

export const idbService = new IndexedDBService();
