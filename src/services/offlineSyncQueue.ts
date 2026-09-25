/**
 * Offline Sync Queue Engine for APHRO
 * Manages reliable, idempotent synchronization of offline Realisasi, Photos, Work Orders, and Absensi to Supabase.
 * Features:
 * - Exponential backoff retry (5s, 15s, 30s)
 * - Anti-duplication via clientGeneratedId (Idempotency Key)
 * - Concurrency control (max 2 parallel tasks)
 * - Automatic background listener on connection status changes
 */

import { dexieDb, LocalSyncQueueItem, LocalRealisasi, LocalPhoto } from './dexieDb';
import { ApiService } from './apiService';
import { InisiasiService } from './inisiasiService';
import { getLocalDateTimeString } from '../utils/dateUtils';

export type SyncListener = (event: {
  status: 'IDLE' | 'SYNCING' | 'COMPLETED' | 'ERROR';
  total: number;
  completed: number;
  failed: number;
  message?: string;
}) => void;

class OfflineSyncQueueEngine {
  private isProcessing = false;
  private listeners: Set<SyncListener> = new Set();
  private maxConcurrency = 2;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncQueueEngine] Internet connection restored. Triggering sync...');
        this.processQueue();
      });
    }
  }

  public async clearLocalData(): Promise<void> {
    try {
      await dexieDb.realisasi.clear();
      await dexieDb.work_orders.clear();
      await dexieDb.photos.clear();
      await dexieDb.sync_queue.clear();
      console.log('[SyncQueueEngine] Cleared all data held in local storage (Dexie).');
    } catch (e) {
      console.warn('Error clearing local storage data:', e);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: {
    status: 'IDLE' | 'SYNCING' | 'COMPLETED' | 'ERROR';
    total: number;
    completed: number;
    failed: number;
    message?: string;
  }) {
    this.listeners.forEach((fn) => fn(event));
  }

  /**
   * Add a new operation to the local sync queue and Dexie tables
   */
  public async enqueueRealisasi(realisasiData: LocalRealisasi, photos: LocalPhoto[]): Promise<void> {
    const timestamp = getLocalDateTimeString();

    const resolvedWoId = String(realisasiData.WO_ID || realisasiData.workOrderId || (realisasiData as any).woId || '').trim();
    const resolvedNomorWo = String(realisasiData.Nomor_WO || realisasiData.nomorWO || (realisasiData as any).nomor_wo || '').trim();

    const enrichedRealisasi: LocalRealisasi = {
      ...realisasiData,
      WO_ID: resolvedWoId,
      workOrderId: resolvedWoId,
      woId: resolvedWoId,
      Nomor_WO: resolvedNomorWo,
      nomorWO: resolvedNomorWo,
      syncStatus: 'PENDING',
      updatedAt: timestamp,
    };

    // 1. Save Realisasi record locally in Dexie with status PENDING
    await dexieDb.realisasi.put(enrichedRealisasi);

    // 2. Save photos locally in Dexie
    for (const photo of photos) {
      await dexieDb.photos.put({
        ...photo,
        woId: resolvedWoId || photo.woId,
        syncStatus: 'PENDING',
        createdAt: photo.createdAt || timestamp,
      });
    }

    // 3. Create Queue Item for Realisasi
    const queueItem: LocalSyncQueueItem = {
      idempotencyKey: realisasiData.idempotencyKey,
      type: 'CREATE',
      tableName: 'REALISASI',
      payload: {
        realisasi: enrichedRealisasi,
        photos: photos,
      },
      timestamp,
      retryCount: 0,
      status: 'PENDING',
    };

    await dexieDb.sync_queue.put(queueItem);

    // 4. Try processing immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  /**
   * Add a DELETE realisasi operation to the local sync queue
   */
  public async enqueueDeleteRealisasi(id: string): Promise<void> {
    const timestamp = getLocalDateTimeString();

    try {
      await dexieDb.realisasi.where('id').equals(id).or('localId').equals(id).or('serverId').equals(id).or('idempotencyKey').equals(id).delete();
      await dexieDb.realisasi.delete(id);
      await dexieDb.photos.where('realisasiId').equals(id).delete();
    } catch (e) {
      console.warn('Dexie delete error in enqueueDeleteRealisasi:', e);
    }

    const queueItem: LocalSyncQueueItem = {
      idempotencyKey: `DEL-REL-${id}-${Date.now()}`,
      type: 'DELETE',
      tableName: 'REALISASI',
      payload: { id },
      timestamp,
      retryCount: 0,
      status: 'PENDING',
    };

    await dexieDb.sync_queue.put(queueItem);

    if (navigator.onLine) {
      this.processQueue();
    }
  }

  /**
   * Main Queue Processor with concurrency limit & backoff
   */
  public async processQueue(): Promise<{ success: boolean; total: number; synced: number; failed: number }> {
    if (this.isProcessing) {
      console.log('[SyncQueueEngine] Queue processor already running.');
      return { success: true, total: 0, synced: 0, failed: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[SyncQueueEngine] Offline. Skipping sync queue execution.');
      return { success: false, total: 0, synced: 0, failed: 0 };
    }

    this.isProcessing = true;

    try {
      // 0. Recovery: Reset any orphaned 'SYNCING' items back to 'PENDING' before fetching queue
      const orphaned = await dexieDb.sync_queue.where('status').equals('SYNCING').toArray();
      if (orphaned.length > 0) {
        for (const item of orphaned) {
          item.status = 'PENDING';
          await dexieDb.sync_queue.put(item);
        }
      }

      const pendingItems = await dexieDb.sync_queue
        .where('status')
        .equals('PENDING')
        .or('status')
        .equals('FAILED')
        .toArray();

      if (pendingItems.length === 0) {
        this.notify({ status: 'COMPLETED', total: 0, completed: 0, failed: 0, message: 'Semua data telah tersinkronisasi.' });
        this.isProcessing = false;
        return { success: true, total: 0, synced: 0, failed: 0 };
      }

      this.notify({
        status: 'SYNCING',
        total: pendingItems.length,
        completed: 0,
        failed: 0,
        message: `Memulai sinkronisasi ${pendingItems.length} item...`,
      });

      let completedCount = 0;
      let failedCount = 0;
      const activeUnitId = InisiasiService.getSelectedUnitId() || 'UL2';
      for (let i = 0; i < pendingItems.length; i += this.maxConcurrency) {
        const batch = pendingItems.slice(i, i + this.maxConcurrency);

        await Promise.all(
          batch.map(async (item) => {
            const success = await this.processSingleItem(item);
            if (success) {
              completedCount++;
            } else {
              failedCount++;
            }

            this.notify({
              status: 'SYNCING',
              total: pendingItems.length,
              completed: completedCount,
              failed: failedCount,
              message: `Menyinkronkan: ${completedCount}/${pendingItems.length}`,
            });
          })
        );
      }

      const finalStatus = failedCount === 0 ? 'COMPLETED' : 'ERROR';
      const finalMsg = failedCount === 0 
        ? 'Sinkronisasi berhasil seluruhnya!' 
        : `${completedCount} berhasil, ${failedCount} gagal. Akan dicoba ulang otomatis.`;

      this.notify({
        status: finalStatus,
        total: pendingItems.length,
        completed: completedCount,
        failed: failedCount,
        message: finalMsg,
      });

      // Save last sync timestamp
      await dexieDb.metadata.put({
        key: 'lastSyncAt',
        value: getLocalDateTimeString(),
        updatedAt: getLocalDateTimeString(),
      });

      return {
        success: failedCount === 0,
        total: pendingItems.length,
        synced: completedCount,
        failed: failedCount,
      };
    } catch (err: any) {
      console.error('[SyncQueueEngine] Error during queue processing:', err);
      this.notify({
        status: 'ERROR',
        total: 0,
        completed: 0,
        failed: 1,
        message: err?.message || 'Gagal memproses antrean sinkronisasi.',
      });
      return { success: false, total: 0, synced: 0, failed: 1 };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queue item with retry backoff
   */
  private async processSingleItem(item: LocalSyncQueueItem): Promise<boolean> {
    try {
      // Mark item status as SYNCING
      item.status = 'SYNCING';
      item.lastAttemptAt = getLocalDateTimeString();
      await dexieDb.sync_queue.put(item);

      if (item.tableName === 'REALISASI') {
        if (item.type === 'DELETE') {
          const id = item.payload?.id || item.payload?.realisasi?.id || item.payload?.realisasi?.localId;
          const serverResult = await ApiService.deleteRealisasi(id);
          if (serverResult.success || serverResult.message?.includes('tidak ditemukan')) {
            await dexieDb.sync_queue.delete(item.idempotencyKey);
            return true;
          } else {
            throw new Error(serverResult.message || 'Server menolak penghapusan Realisasi.');
          }
        }

        const realisasi = item.payload?.realisasi || item.payload;
        const photos = item.payload?.photos;

        // Ensure WO_ID and Nomor_WO are carried through in case item was queued in earlier format
        let resolvedWoId = String(realisasi?.WO_ID || realisasi?.workOrderId || realisasi?.woId || '').trim();
        let resolvedNomorWo = String(realisasi?.Nomor_WO || realisasi?.nomorWO || realisasi?.nomor_wo || '').trim();

        // If WO_ID and Nomor_WO are both missing (e.g. from a legacy pending record enqueued before the fix),
        // recover from photos or matching work orders in Dexie so it does not fail with 400
        if (!resolvedWoId && !resolvedNomorWo) {
          if (photos && Array.isArray(photos)) {
            for (const p of photos) {
              if (p?.woId && p.woId.trim()) {
                resolvedWoId = p.woId.trim();
                break;
              }
            }
          }

          try {
            const cachedWos = await dexieDb.work_orders.toArray();
            if (cachedWos.length > 0) {
              const matchedWo =
                cachedWos.find((w) => {
                  if (realisasi.penyulangName && w.penyulangName && realisasi.penyulangName === w.penyulangName) return true;
                  if (realisasi.ulpName && w.ulpName && realisasi.ulpName === w.ulpName) return true;
                  return false;
                }) || cachedWos[0];

              if (matchedWo) {
                resolvedWoId = String(matchedWo.WO_ID || matchedWo.id || '').trim();
                resolvedNomorWo = String(matchedWo.Nomor_WO || matchedWo.nomorWO || '').trim();
                console.log(`[RECOVERY] Recovered WO_ID="${resolvedWoId}" Nomor_WO="${resolvedNomorWo}" for pending record ${item.idempotencyKey}`);
              }
            }
          } catch (recErr) {
            console.warn('[RECOVERY] Failed to recover work order for pending item:', recErr);
          }
        }

        const enrichedRealisasi = {
          ...realisasi,
          WO_ID: resolvedWoId,
          workOrderId: resolvedWoId,
          woId: resolvedWoId,
          Nomor_WO: resolvedNomorWo,
          nomorWO: resolvedNomorWo,
        };

        console.log('[REALISASI STEP 3]', {
          id: enrichedRealisasi.id || enrichedRealisasi.localId,
          unitId: enrichedRealisasi.unitId,
          WO_ID: enrichedRealisasi.WO_ID,
          Nomor_WO: enrichedRealisasi.Nomor_WO,
          workOrderId: enrichedRealisasi.workOrderId,
          woId: enrichedRealisasi.woId,
          nomorWO: enrichedRealisasi.nomorWO,
        });

        // Update Dexie status to SYNCING if record exists
        if (enrichedRealisasi?.localId) {
          await dexieDb.realisasi.update(enrichedRealisasi.localId, { syncStatus: 'SYNCING' }).catch(() => {});
        }

        const serverResult = item.type === 'UPDATE'
          ? await ApiService.updateRealisasi(enrichedRealisasi.id || enrichedRealisasi.localId, enrichedRealisasi)
          : await ApiService.saveRealisasi(enrichedRealisasi);

        if (serverResult.success) {
          const finalServerId = (serverResult as any).serverId || enrichedRealisasi?.localId || enrichedRealisasi?.id;
          console.log(`[DATA FLOW]\nmode=ONLINE\nentity=REALISASI\naction=SYNC\nsource=DEXIE_QUEUE\ntarget=HYPERCLOUD\nstatus=SUCCESS\nid=${finalServerId}`);

          // Mark Realisasi as SYNCED in Dexie
          if (enrichedRealisasi?.localId) {
            await dexieDb.realisasi.update(enrichedRealisasi.localId, {
              syncStatus: 'SYNCED',
              serverId: finalServerId,
              syncError: undefined,
              updatedAt: getLocalDateTimeString(),
            }).catch(() => {});
          }

          // Update photos sync status
          if (photos && Array.isArray(photos)) {
            for (const p of photos) {
              if (p?.id) {
                await dexieDb.photos.update(p.id, { syncStatus: 'SYNCED' }).catch(() => {});
              }
            }
          }

          // Remove queue item after confirmed database save
          await dexieDb.sync_queue.delete(item.idempotencyKey);
          return true;
        } else {
          throw new Error(serverResult.message || 'Server database menolak transaksi Realisasi.');
        }
      } else if (item.tableName === 'WORK_ORDER') {
        let serverResult;
        if (item.type === 'DELETE') {
          serverResult = await ApiService.deleteWorkOrder(item.payload?.id || item.payload);
        } else if (item.type === 'UPDATE') {
          serverResult = await ApiService.updateWorkOrder(item.payload?.id, item.payload);
        } else {
          serverResult = await ApiService.saveWorkOrder(item.payload);
        }

        if (serverResult.success || (item.type === 'DELETE' && serverResult.message?.includes('tidak ditemukan'))) {
          if (item.payload?.id && item.type !== 'DELETE') {
            await dexieDb.work_orders.update(item.payload.id, { syncStatus: 'SYNCED' }).catch(() => {});
          }
          await dexieDb.sync_queue.delete(item.idempotencyKey);
          return true;
        } else {
          throw new Error(serverResult.message || 'Server database menolak transaksi Work Order.');
        }
      } else if (item.tableName === 'ABSENSI') {
        let serverResult;
        if (item.type === 'DELETE') {
          serverResult = await ApiService.deleteAbsensi(item.payload?.id || item.payload);
        } else if (item.type === 'UPDATE') {
          serverResult = await ApiService.updateAbsensi(item.payload?.id, item.payload);
        } else {
          serverResult = await ApiService.saveAbsensi(item.payload);
        }

        if (serverResult.success || (item.type === 'DELETE' && serverResult.message?.includes('tidak ditemukan'))) {
          await dexieDb.sync_queue.delete(item.idempotencyKey);
          return true;
        } else {
          throw new Error(serverResult.message || 'Server database menolak transaksi Absensi.');
        }
      } else {
        // Fallback for other tables
        await dexieDb.sync_queue.delete(item.idempotencyKey);
        return true;
      }
    } catch (error: any) {
      console.warn(`[SyncQueueEngine] Sync failed for key ${item.idempotencyKey}:`, error);

      const errStr = String(error?.message || error || '').toLowerCase();
      const is404 = errStr.includes('404') || errStr.includes('not found') || errStr.includes('tidak ditemukan');

      if (is404) {
        item.status = 'FAILED_ENDPOINT_NOT_FOUND';
        item.retryCount = 999;
        item.error = error?.message || 'Endpoint tidak ditemukan (HTTP 404).';
        await dexieDb.sync_queue.put(item);
        console.warn(`[SyncQueueEngine] Item ${item.idempotencyKey} marked as FAILED_ENDPOINT_NOT_FOUND. Stopping retries.`);
        return false;
      }

      const isClientError = errStr.includes('400') || errStr.includes('pgrst') || errStr.includes('column') || errStr.includes('schema') || errStr.includes('bad request');

      const nextRetry = item.retryCount + 1;
      item.retryCount = nextRetry;
      item.status = 'FAILED';
      item.error = error?.message || 'Gagal terhubung ke server.';
      await dexieDb.sync_queue.put(item);

      // Update Local Realisasi status
      if (item.tableName === 'REALISASI' && item.payload?.realisasi?.localId) {
        await dexieDb.realisasi.update(item.payload.realisasi.localId, {
          syncStatus: 'FAILED',
          syncError: item.error,
          retryCount: item.retryCount,
        });
      }

      // Schedule next retry if online
      if (navigator.onLine && nextRetry <= 3) {
        const backoffDelayMs = this.calculateBackoffMs(nextRetry);
        setTimeout(() => {
          this.processQueue();
        }, backoffDelayMs);
      }

      return false;
    }
  }

  /**
   * Backoff strategy:
   * Retry 1 -> 5,000 ms (5s)
   * Retry 2 -> 15,000 ms (15s)
   * Retry 3 -> 30,000 ms (30s)
   * Retry 4+ -> 60,000 ms (60s)
   */
  private calculateBackoffMs(retryCount: number): number {
    if (retryCount <= 1) return 5000;
    if (retryCount === 2) return 15000;
    if (retryCount === 3) return 30000;
    return 60000;
  }

  /**
   * Summary helper for UI panels
   */
  public async getQueueSummary(): Promise<{
    pendingCount: number;
    syncingCount: number;
    syncedCount: number;
    failedCount: number;
    lastSyncAt: string | null;
  }> {
    try {
      const pendingCount = await dexieDb.realisasi.where('syncStatus').equals('PENDING').count();
      const syncingCount = await dexieDb.realisasi.where('syncStatus').equals('SYNCING').count();
      const syncedCount = await dexieDb.realisasi.where('syncStatus').equals('SYNCED').count();
      const failedCount = await dexieDb.realisasi.where('syncStatus').equals('FAILED').count();

      const lastSyncRecord = await dexieDb.metadata.get('lastSyncAt');
      const lastSyncAt = lastSyncRecord ? lastSyncRecord.value : null;

      return {
        pendingCount,
        syncingCount,
        syncedCount,
        failedCount,
        lastSyncAt,
      };
    } catch {
      return {
        pendingCount: 0,
        syncingCount: 0,
        syncedCount: 0,
        failedCount: 0,
        lastSyncAt: null,
      };
    }
  }
}

export const offlineSyncQueue = new OfflineSyncQueueEngine();
