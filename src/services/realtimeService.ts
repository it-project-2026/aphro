import { ApiService } from './apiService';

class RealtimeService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: any = null;
  private isConnected = false;
  private userUnitId: string | null = null;
  private visibilityListener: (() => void) | null = null;
  private focusListener: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.visibilityListener = () => {
        if (document.visibilityState === 'visible') {
          console.log('[REALTIME] Browser tab visible. Checking SSE connection...');
          if (!this.isConnected && ApiService.getAuthToken()) {
            this.connect(this.userUnitId || undefined);
          }
        }
      };

      this.focusListener = () => {
        if (!this.isConnected && ApiService.getAuthToken()) {
          console.log('[REALTIME] Window focused. Reconnecting SSE...');
          this.connect(this.userUnitId || undefined);
        }
      };

      document.addEventListener('visibilitychange', this.visibilityListener);
      window.addEventListener('focus', this.focusListener);
    }
  }

  public connect(unitId?: string) {
    if (this.eventSource) {
      this.disconnect();
    }

    this.userUnitId = unitId || null;
    const token = ApiService.getAuthToken();
    if (!token) {
      console.log('[REALTIME] Skipping connection: No auth token available.');
      return;
    }

    const url = `/api/realtime?token=${encodeURIComponent(token)}${unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''}`;
    
    try {
      console.log(`[REALTIME] Connecting to SSE endpoint: ${url}`);
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('[REALTIME] SSE connected successfully.');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        window.dispatchEvent(new CustomEvent('aphro_realtime_status', { detail: { connected: true } }));
      };

      this.eventSource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          console.log(`[REALTIME] Received event type=${data.type} unitId=${data.unitId}`);

          if (data.type === 'CONNECTED') {
            return;
          }

          // Unit isolation check
          if (this.userUnitId && data.unitId && this.userUnitId !== 'ALL' && data.unitId !== 'ALL' && this.userUnitId.toUpperCase() !== data.unitId.toUpperCase()) {
            console.log(`[REALTIME] Skipping event for unit ${data.unitId} (User is in ${this.userUnitId})`);
            return;
          }

          window.dispatchEvent(new CustomEvent('aphro_data_updated', { detail: data }));
        } catch (err) {
          console.warn('[REALTIME] Failed to parse SSE message:', err);
        }
      };

      this.eventSource.onerror = (err) => {
        console.warn('[REALTIME] SSE connection error/disconnected:', err);
        this.isConnected = false;
        window.dispatchEvent(new CustomEvent('aphro_realtime_status', { detail: { connected: false } }));
        this.handleDisconnect();
      };
    } catch (e: any) {
      console.error('[REALTIME] Failed to initialize EventSource:', e?.message || e);
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;
      console.log(`[REALTIME] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => {
        if (ApiService.getAuthToken()) {
          this.connect(this.userUnitId || undefined);
        }
      }, delay);
    } else {
      console.warn('[REALTIME] Max reconnect attempts reached.');
    }
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.reconnectAttempts = 0;
    window.dispatchEvent(new CustomEvent('aphro_realtime_status', { detail: { connected: false } }));
    console.log('[REALTIME] Disconnected and cleaned up.');
  }

  public getStatus() {
    return this.isConnected;
  }
}

export const realtimeService = new RealtimeService();
