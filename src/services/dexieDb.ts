/**
 * Dexie IndexedDB Database Definition for APHRO Offline-First Field Application
 * Manages local persistent storage for Users, Work Orders, Realisasi, Photos, Sync Queue, Master Data, and Metadata.
 */

import Dexie, { Table } from 'dexie';
import { User, WorkOrder, Realisasi, WatermarkedPhoto, Absensi, ULP, Penyulang, ReguROW, Petugas } from '../types';

export interface LocalUser extends User {
  syncStatus?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  updatedAt?: string;
}

export interface LocalWorkOrder extends WorkOrder {
  syncStatus?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  serverUpdatedAt?: string;
}

export interface LocalRealisasi extends Realisasi {
  localId: string;
  serverId?: string;
  idempotencyKey: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  syncError?: string;
  retryCount?: number;
  updatedAt: string;
}

export interface LocalPhoto {
  id: string;
  realisasiId: string;
  woId: string;
  type: 'sebelum' | 'sesudah';
  slotIndex: 1 | 2 | 3;
  dataUrl: string;
  fileUrl?: string;
  originalName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  userName: string;
  ulpName: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  createdAt: string;
}

export interface LocalSyncQueueItem {
  idempotencyKey: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  tableName: 'REALISASI' | 'WORK_ORDER' | 'ABSENSI' | 'PHOTO';
  payload: any;
  timestamp: string;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'FAILED_ENDPOINT_NOT_FOUND';
  error?: string;
  lastAttemptAt?: string;
}

export interface LocalMasterData {
  id: string;
  category: 'ULP' | 'PENYULANG' | 'REGU' | 'PETUGAS' | 'USER';
  ulpId?: string;
  reguId?: string;
  data: any;
  updatedAt: string;
}

export interface LocalMetadata {
  key: string;
  value: any;
  updatedAt: string;
}

export class AphroDexieDB extends Dexie {
  users!: Table<LocalUser, string>;
  work_orders!: Table<LocalWorkOrder, string>;
  realisasi!: Table<LocalRealisasi, string>;
  photos!: Table<LocalPhoto, string>;
  sync_queue!: Table<LocalSyncQueueItem, string>;
  master_data!: Table<LocalMasterData, string>;
  metadata!: Table<LocalMetadata, string>;

  constructor() {
    super('aphro_offline_db');

    this.version(1).stores({
      users: 'id, nip, userName, role, ulpId, ulpName, reguId, status',
      work_orders: 'id, nomorWO, ulpId, ulpName, reguId, petugasId, status, syncStatus, updatedAt, createdAt',
      realisasi: 'localId, serverId, idempotencyKey, woId, nomorWO, ulpId, reguId, petugasId, syncStatus, createdAt, updatedAt',
      photos: 'id, realisasiId, woId, type, syncStatus, createdAt',
      sync_queue: 'idempotencyKey, type, tableName, status, retryCount, timestamp',
      master_data: 'id, category, ulpId, reguId, updatedAt',
      metadata: 'key, updatedAt',
    });
  }
}

export const dexieDb = new AphroDexieDB();
