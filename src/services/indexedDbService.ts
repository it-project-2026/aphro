/**
 * IndexedDB Service for APHRO - Powered by Dexie.js
 * Provides client-side persistent storage for table data, versions, pending operations, and audit logs.
 */

import { dexieDb } from './dexieDb';
import { getLocalDateTimeString } from '../utils/dateUtils';

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
  // --- TABLES ---
  async getTable<T = any>(tableName: string): Promise<T[] | null> {
    try {
      if (tableName === 'WORK_ORDER') {
        const records = await dexieDb.work_orders.toArray();
        return (records as unknown as T[]) || null;
      }
      if (tableName === 'REALISASI') {
        const records = await dexieDb.realisasi.toArray();
        return (records as unknown as T[]) || null;
      }
      if (tableName === 'USERS') {
        const records = await dexieDb.users.toArray();
        return (records as unknown as T[]) || null;
      }
      
      const record = await dexieDb.metadata.get(`table_${tableName}`);
      return record ? (record.value as T[]) : null;
    } catch {
      return null;
    }
  }

  async saveTable<T = any>(tableName: string, data: T[]): Promise<void> {
    try {
      if (tableName === 'WORK_ORDER' && Array.isArray(data)) {
        await dexieDb.work_orders.clear();
        await dexieDb.work_orders.bulkPut(data as any);
        return;
      }
      if (tableName === 'REALISASI' && Array.isArray(data)) {
        // Keep unsynced pending local records
        const existingPending = await dexieDb.realisasi.where('syncStatus').equals('PENDING').toArray();
        const pendingMap = new Map(existingPending.map(p => [p.localId, p]));

        const recordsToSave = data.map((item: any) => {
          const localId = item.id || item.localId || `REL-${Date.now()}`;
          return {
            ...item,
            localId,
            idempotencyKey: item.idempotencyKey || localId,
            syncStatus: item.isSynced ? 'SYNCED' : (item.syncStatus || 'SYNCED'),
            updatedAt: item.updatedAt || getLocalDateTimeString(),
          };
        });

        // Re-inject unsynced pending items
        pendingMap.forEach(p => {
          if (!recordsToSave.some(r => r.localId === p.localId)) {
            recordsToSave.push(p);
          }
        });

        await dexieDb.realisasi.bulkPut(recordsToSave as any);
        return;
      }

      await dexieDb.metadata.put({
        key: `table_${tableName}`,
        value: data,
        updatedAt: getLocalDateTimeString(),
      });
    } catch (err) {
      console.warn(`Failed to save table ${tableName} to Dexie DB`, err);
    }
  }

  async clearTable(tableName: string): Promise<void> {
    try {
      if (tableName === 'WORK_ORDER') {
        await dexieDb.work_orders.clear();
        return;
      }
      if (tableName === 'REALISASI') {
        await dexieDb.realisasi.clear();
        return;
      }
      await dexieDb.metadata.delete(`table_${tableName}`);
    } catch (e) {
      console.warn(`Failed to clear table ${tableName}`, e);
    }
  }

  // --- PENDING OPERATIONS ---
  async getPendingOperations(): Promise<PendingOperation[]> {
    try {
      const queue = await dexieDb.sync_queue.toArray();
      return queue.map((q) => ({
        idempotencyKey: q.idempotencyKey,
        type: q.type,
        tableName: q.tableName,
        payload: q.payload,
        timestamp: q.timestamp,
        retryCount: q.retryCount,
        status: q.status === 'SYNCING' ? 'PROCESSING' : q.status === 'SYNCED' ? 'PENDING' : q.status,
        error: q.error,
      }));
    } catch {
      return [];
    }
  }

  async addPendingOperation(op: Omit<PendingOperation, 'timestamp' | 'retryCount' | 'status'> & { timestamp?: string }): Promise<PendingOperation> {
    const fullOp: PendingOperation = {
      ...op,
      timestamp: op.timestamp || getLocalDateTimeString(),
      retryCount: 0,
      status: 'PENDING',
    };
    try {
      await dexieDb.sync_queue.put({
        idempotencyKey: fullOp.idempotencyKey,
        type: fullOp.type,
        tableName: fullOp.tableName as any,
        payload: fullOp.payload,
        timestamp: fullOp.timestamp,
        retryCount: 0,
        status: 'PENDING',
      });
    } catch (e) {
      console.warn('Failed to add pending operation to Dexie DB', e);
    }
    return fullOp;
  }

  async removePendingOperation(idempotencyKey: string): Promise<void> {
    try {
      await dexieDb.sync_queue.delete(idempotencyKey);
    } catch (e) {
      console.warn(`Failed to remove pending operation ${idempotencyKey}`, e);
    }
  }

  async updatePendingOperation(op: PendingOperation): Promise<void> {
    try {
      await dexieDb.sync_queue.put({
        idempotencyKey: op.idempotencyKey,
        type: op.type,
        tableName: op.tableName as any,
        payload: op.payload,
        timestamp: op.timestamp,
        retryCount: op.retryCount,
        status: op.status === 'PROCESSING' ? 'SYNCING' : op.status === 'FAILED' ? 'FAILED' : 'PENDING',
        error: op.error,
      });
    } catch (e) {
      console.warn(`Failed to update pending operation ${op.idempotencyKey}`, e);
    }
  }

  async clearPendingOperations(): Promise<void> {
    try {
      await dexieDb.sync_queue.clear();
    } catch (e) {
      console.warn('Failed to clear pending operations', e);
    }
  }

  async saveTableVersion(tableName: string, version: number | string): Promise<void> {
    try {
      await dexieDb.metadata.put({
        key: `ver_${tableName}`,
        value: version,
        updatedAt: getLocalDateTimeString(),
      });
    } catch (e) {
      console.warn(`Failed to save table version for ${tableName}`, e);
    }
  }

  async addAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<AuditLogRecord> {
    const fullLog: AuditLogRecord = {
      id: log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || getLocalDateTimeString(),
      user: log.user || 'SYSTEM',
      action: log.action,
      module: log.module,
      details: log.details,
      synced: log.synced || false,
    };
    try {
      await dexieDb.metadata.put({
        key: `audit_${fullLog.id}`,
        value: fullLog,
        updatedAt: getLocalDateTimeString(),
      });
    } catch (e) {
      console.warn('Failed to add audit log', e);
    }
    return fullLog;
  }

  // --- METADATA ---
  async setMetadata(key: string, value: any): Promise<void> {
    try {
      await dexieDb.metadata.put({ key, value, updatedAt: getLocalDateTimeString() });
    } catch (e) {
      console.warn(`Failed to set metadata ${key}`, e);
    }
  }

  async getMetadata<T = any>(key: string): Promise<T | null> {
    try {
      const res = await dexieDb.metadata.get(key);
      return res ? (res.value as T) : null;
    } catch {
      return null;
    }
  }

  async clearAll(): Promise<void> {
    try {
      await dexieDb.delete();
      await dexieDb.open();
    } catch (e) {
      console.warn('Failed to clear Dexie DB', e);
    }
  }
}

export const idbService = new IndexedDBService();
