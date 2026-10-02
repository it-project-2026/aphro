/**
 * RealtimeService - SSE / EventSource disabled as per architectural requirement.
 * Polling on 4 report pages is used instead.
 */
class RealtimeService {
  public connect(_unitId?: string) {
    // SSE disabled
  }

  public disconnect() {
    // SSE disabled
  }

  public getStatus() {
    return false;
  }
}

export const realtimeService = new RealtimeService();

