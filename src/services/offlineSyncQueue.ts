import { GASApiService } from './gasApiService';

export interface PendingSyncItem {
  id: string;
  type: 'ABSENSI' | 'REALISASI' | 'WORK_ORDER_CREATE' | 'WORK_ORDER_UPDATE' | 'WORK_ORDER_DELETE';
  payload: any;
  timestamp: string;
  retryCount: number;
}

const QUEUE_KEY = 'aphro_pending_sync_queue';

export function getOfflineQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse offline sync queue:', e);
    return [];
  }
}

export function saveOfflineQueue(queue: PendingSyncItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline sync queue:', e);
  }
}

export function addToOfflineQueue(
  type: PendingSyncItem['type'],
  payload: any
): PendingSyncItem {
  const queue = getOfflineQueue();
  // Prevent duplicate queuing for exact same id/type
  const existingIndex = queue.findIndex(
    item => item.type === type && 
           ((item.payload?.syncId && item.payload?.syncId === payload?.syncId) || 
            (item.payload?.id === payload?.id && payload?.id))
  );

  const newItem: PendingSyncItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  if (existingIndex >= 0) {
    queue[existingIndex] = newItem;
  } else {
    queue.push(newItem);
  }

  saveOfflineQueue(queue);
  return newItem;
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  saveOfflineQueue(queue);
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export async function processOfflineSyncQueue(
  gasUrl: string,
  spreadsheetId?: string
): Promise<{ 
  successCount: number; 
  failCount: number; 
  errors: string[];
  syncedItems: Array<{ type: PendingSyncItem['type'], syncId?: string, payloadId?: string }> 
}> {
  if (!gasUrl || !navigator.onLine) {
    return { successCount: 0, failCount: 0, errors: ['Offline / URL tidak dikonfigurasi'], syncedItems: [] };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { successCount: 0, failCount: 0, errors: [], syncedItems: [] };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];
  const syncedItems: Array<{ type: PendingSyncItem['type'], syncId?: string, payloadId?: string }> = [];

  for (const item of [...queue]) {
    try {
      let res: any = null;
      if (item.type === 'ABSENSI') {
        res = await GASApiService.saveAbsensi(gasUrl, item.payload);
      } else if (item.type === 'REALISASI') {
        res = await GASApiService.saveRealisasi(gasUrl, spreadsheetId, item.payload);
      } else if (item.type === 'WORK_ORDER_CREATE') {
        res = await GASApiService.createWorkOrder(gasUrl, spreadsheetId, item.payload);
      } else if (item.type === 'WORK_ORDER_UPDATE') {
        res = await GASApiService.updateWorkOrder(
          gasUrl,
          spreadsheetId,
          item.payload.id || item.payload.nomorWO,
          item.payload.workOrder || item.payload
        );
      } else if (item.type === 'WORK_ORDER_DELETE') {
        res = await GASApiService.deleteWorkOrder(gasUrl, item.payload.id || item.payload);
      }

      if (res && res.status === 'success') {
        successCount++;
        syncedItems.push({ 
          type: item.type, 
          syncId: item.payload?.syncId, 
          payloadId: item.payload?.id 
        });
        removeFromOfflineQueue(item.id);
      } else {
        failCount++;
        errors.push(res?.message || `Gagal sinkronkan item ${item.type}`);
      }
    } catch (err: any) {
      failCount++;
      errors.push(err.message || 'Koneksi jaringan terputus');
      // Break early if network dropped
      if (!navigator.onLine) break;
    }
  }

  return { successCount, failCount, errors, syncedItems };
}
