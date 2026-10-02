import { Response } from 'express';
import { verifyJwt } from './hypercloudApi';

interface SseClient {
  id: string;
  res: Response;
  userId: string;
  unitId: string;
  reguName: string;
}

const sseClients: Set<SseClient> = new Set();

/**
 * Broadcast event to authorized clients only
 */
export function broadcastRealtimeEvent(
  table: 'WORK_ORDER' | 'REALISASI' | 'ABSENSI' | 'USERS',
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  id: string,
  unitId: string,
  reguName?: string // Optional, for advanced filtering if needed
) {
  const eventData = JSON.stringify({ table, operation, id, unitId, timestamp: new Date().toISOString() });
  
  console.log(`[REALTIME BROADCAST] table=${table} op=${operation} id=${id} unitId=${unitId} clients=${sseClients.size}`);
  
  sseClients.forEach(client => {
    // 1. Authorization: Unit Level Isolation
    // Only broadcast if the client's unitId matches the event's unitId (or client is Admin/ALL)
    if (client.unitId !== 'ALL' && client.unitId.toUpperCase() !== unitId.toUpperCase()) {
      return;
    }

    // 2. Authorization: Regu Level Isolation (if needed by context, e.g., WorkOrder)
    // Placeholder for advanced regu-based filtering if requirements evolve beyond unit isolation
    
    try {
      client.res.write(`data: ${eventData}\n\n`);
    } catch (e) {
      console.warn(`[REALTIME BROADCAST] Failed to send to client ${client.id}, removing.`);
      sseClients.delete(client);
    }
  });
}

/**
 * Register a new SSE connection
 */
export function registerSseClient(res: Response, token: string): SseClient | null {
  const payload = verifyJwt(token);
  if (!payload) return null;

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const client: SseClient = {
    id: clientId,
    res,
    userId: payload.userId || payload.sub || 'anonymous',
    unitId: payload.unitId || 'ALL',
    reguName: payload.reguName || ''
  };

  sseClients.add(client);
  return client;
}

/**
 * Remove an SSE connection
 */
export function unregisterSseClient(client: SseClient) {
  sseClients.delete(client);
}

/**
 * Start heartbeat interval
 */
export function startHeartbeat(res: Response) {
  return setInterval(() => {
    try {
      res.write(':heartbeat\n\n');
    } catch (e) {
      // Socket probably closed
    }
  }, 30000); // 30 seconds
}
