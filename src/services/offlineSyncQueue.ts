import { GASApiService } from './gasApiService';
import { getLocalDateTimeString } from '../utils/dateUtils';

export interface PendingSyncItem {
  id: string;
  type: 'ABSENSI' | 'REALISASI' | 'REALISASI_DELETE' | 'WORK_ORDER_CREATE' | 'WORK_ORDER_UPDATE' | 'WORK_ORDER_DELETE';
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
    timestamp: getLocalDateTimeString(),
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

export function getItemReadableDescription(item: PendingSyncItem): string {
  switch (item.type) {
    case 'ABSENSI':
      return `Absensi ${item.payload?.reguName || 'Regu'} (${item.payload?.tanggal || 'Hari ini'})`;
    case 'REALISASI':
      return `Realisasi WO ${item.payload?.nomorWO || item.payload?.workOrderId || ''} (${item.payload?.ulpName || 'ROW'})`;
    case 'REALISASI_DELETE':
      return `Hapus Realisasi #${item.payload?.id || ''}`;
    case 'WORK_ORDER_CREATE':
      return `Work Order Baru ${item.payload?.nomorWO || ''}`;
    case 'WORK_ORDER_UPDATE':
      return `Pembaruan WO ${item.payload?.nomorWO || item.payload?.id || ''}`;
    case 'WORK_ORDER_DELETE':
      return `Hapus WO #${item.payload?.id || ''}`;
    default:
      return `Data ${item.type}`;
  }
}

export type SyncProgressCallback = (progress: {
  current: number;
  total: number;
  percent: number;
  item: PendingSyncItem;
  description: string;
}) => void;

export async function processOfflineSyncQueue(
  gasUrl: string,
  spreadsheetId?: string,
  onProgress?: SyncProgressCallback
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
  const total = queue.length;

  for (let i = 0; i < total; i++) {
    const item = queue[i];
    const description = getItemReadableDescription(item);
    const percent = Math.round(((i + 1) / total) * 100);

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        percent,
        item,
        description,
      });
    }

    try {
      let res: any = null;
      if (item.type === 'ABSENSI') {
        res = await GASApiService.saveAbsensi(gasUrl, spreadsheetId, item.payload);
      } else if (item.type === 'REALISASI') {
        res = await GASApiService.saveRealisasi(gasUrl, spreadsheetId, item.payload);
      } else if (item.type === 'REALISASI_DELETE') {
        res = await GASApiService.deleteRealisasi(gasUrl, spreadsheetId, item.payload.id || item.payload);
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
        res = await GASApiService.deleteWorkOrder(gasUrl, spreadsheetId, item.payload.id || item.payload);
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
        errors.push(res?.message || `Gagal sinkronkan ${description}`);
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
