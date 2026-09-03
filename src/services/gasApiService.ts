/**
 * REST API Client Service for Google Apps Script (GAS) Web App
 * Connects frontend React application with Google Spreadsheet & Google Drive
 */

export interface GASApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  [key: string]: any;
}

// Memory cache & Request deduplication map
const apiCache = new Map<string, { data: any; timestamp: number }>();
const activeRequests = new Map<string, Promise<Response>>();
const CACHE_TTL_MS = 15000; // 15 seconds memory cache to prevent redundant requests

export class GASApiService {
  /**
   * Fetch with AbortController timeout and exponential backoff retry
   */
  private static async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 25000, retries = 2): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(id);
        return response;
      } catch (err: any) {
        clearTimeout(id);
        const isLastAttempt = attempt === retries;
        if (isLastAttempt) {
          if (err.name === 'AbortError') {
            throw new Error('Koneksi ke Google Spreadsheet Timeout (>25 detik). Periksa koneksi internet atau status Web App GAS.');
          }
          throw err;
        }
        // Wait with exponential backoff and random jitter before retry
        const delay = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Gagal terhubung ke server setelah beberapa kali percobaan.');
  }

  /**
   * Cached GET fetch with request deduplication
   */
  public static async cachedFetch(url: string, useCache = true, ttl = CACHE_TTL_MS): Promise<Response> {
    const cacheKey = url;
    const now = Date.now();

    if (useCache && apiCache.has(cacheKey)) {
      const cached = apiCache.get(cacheKey)!;
      if (now - cached.timestamp < ttl) {
        // Return a mock Response object using cached text/json
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        apiCache.delete(cacheKey);
      }
    }

    // Request deduplication for simultaneous identical GET requests
    if (activeRequests.has(cacheKey)) {
      const res = await activeRequests.get(cacheKey)!;
      return res.clone();
    }

    const requestPromise = this.fetchWithTimeout(url, { method: 'GET' });
    activeRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      activeRequests.delete(cacheKey);

      if (response.ok && useCache) {
        const cloned = response.clone();
        try {
          const json = await cloned.json();
          apiCache.set(cacheKey, { data: json, timestamp: now });
          return new Response(JSON.stringify(json), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          return response;
        }
      }
      return response;
    } catch (err) {
      activeRequests.delete(cacheKey);
      throw err;
    }
  }

  /**
   * Clear client API memory cache when mutations occur
   */
  static clearCache() {
    apiCache.clear();
  }

  /**
   * Safe response handler to prevent JSON parsing errors when GAS returns HTML
   */
  private static async handleResponse(response: Response): Promise<GASApiResponse> {
    const contentType = response.headers.get('content-type');
    const text = await response.text();

    if (!response.ok) {
      if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
        return { 
          status: 'error', 
          message: `Koneksi Google Apps Script gagal (HTTP ${response.status}). Pastikan Web App dideploy dengan izin "Anyone".` 
        };
      }
      return { 
        status: 'error', 
        message: `HTTP Error ${response.status}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}` 
      };
    }

    if (contentType && contentType.includes('text/html')) {
      // Check if it looks like a Google Login page or Error page
      if (text.includes('google-signin') || text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
        return { 
          status: 'error', 
          message: 'Menerima balasan HTML. Pastikan URL Web App sudah benar dan Izin skrip disetel ke "Anyone".' 
        };
      }
      return { status: 'error', message: `Menerima balasan tidak terduga (HTML). Pastikan skrip GAS aktif.` };
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('JSON Parse Error. Raw Text:', text);
      return { 
        status: 'error', 
        message: `Gagal membaca data (JSON Error). Pastikan skrip GAS sudah benar. Balasan mentah: ${text.substring(0, 50)}...` 
      };
    }
  }

  /**
   * Test connection to Google Apps Script Web App Endpoint
   */
  static async testConnection(gasUrl: string): Promise<boolean> {
    if (!gasUrl || !gasUrl.startsWith('http')) return false;
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=ping` : `${gasUrl}?action=ping`;
      const response = await fetch(targetUrl, { method: 'GET' });
      
      if (response.ok) {
        const result = await this.handleResponse(response);
        return result.status === 'success' || !!result.message;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Initialize Spreadsheet Database and create all required sheets automatically
   */
  static async initDatabase(gasUrl: string): Promise<GASApiResponse> {
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=initDatabase` : `${gasUrl}?action=initDatabase`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Gagal menginisialisasi database GAS' };
    }
  }

  /**
   * Login user via Google Spreadsheet USERS sheet
   */
  static async login(gasUrl: string, username: string, password: string): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'login',
          username,
          password,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Gagal terhubung ke server GAS Login' };
    }
  }

  /**
   * Fetch all Work Orders from Google Spreadsheet WORK_ORDER sheet (cached & deduplicated)
   */
  static async fetchWorkOrders(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getWorkOrders` : `${gasUrl}?action=getWorkOrders`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.cachedFetch(targetUrl, true);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Create Work Order in Google Spreadsheet WORK_ORDER sheet
   */
  static async createWorkOrder(gasUrl: string, spreadsheetId: string | undefined, workOrder: any): Promise<GASApiResponse> {
    try {
      this.clearCache();
      const mappedWo = {
        ...workOrder,
        // Match Spreadsheet Headers exactly (Case Sensitive in some GAS scripts)
        NOMOR_WO: workOrder.nomorWO || '',
        TANGGAL: workOrder.tanggal || '',
        ULP: workOrder.ulpName || '',
        PENYULANG: workOrder.penyulangName || '',
        VOLUME: Number(workOrder.volumePekerjaan || 0).toFixed(2),
        SATUAN: workOrder.satuan || 'KMS',
        REGU_ROW: workOrder.reguName || '',
        PETUGAS: workOrder.petugasName || '',
        JENIS_PEKERJAAN: workOrder.jenisPekerjaan || '',
        STATUS: (workOrder.status || 'BELUM SELESAI').toUpperCase(),
        DEADLINE: workOrder.deadline || '',
        WO_AWAL: workOrder.woMulai || '',
        WO_AKHIR: workOrder.woAkhir || '',
        // Fix 46265 bug: Explicitly send "0.00" string for non-completed to avoid GAS truthy/date bug
        TOTAL_REALISASI: (workOrder.status || '').toUpperCase() === 'SELESAI' 
          ? Number(workOrder.totalRealisasi || 0).toFixed(2) 
          : "0.00",
        SATUAN_TOTAL_REALISASI: (workOrder.status || '').toUpperCase() === 'SELESAI' 
          ? (workOrder.satuanTotalRealisasi || workOrder.satuan || '') 
          : '',
        LOKASI_START: workOrder.lokasiStart || '',
        LOKASI_FINISH: workOrder.lokasiFinish || '',
        CREATED_AT: workOrder.createdAt || new Date().toISOString(),
      };

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createWorkOrder',
          spreadsheetId,
          workOrder: mappedWo,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Upload Photo to Google Drive (FOTO/YYYY/Month/WO_ID/)
   */
  static async uploadPhoto(
    gasUrl: string,
    payload: {
      base64Data: string;
      nomorWO?: string;
      reguName?: string;
      photoType: string;
      folderId?: string;
      year?: string;
      month?: string;
    }
  ): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadPhoto',
          base64Data: payload.base64Data,
          nomorWO: payload.nomorWO || payload.reguName,
          reguName: payload.reguName,
          photoType: payload.photoType,
          folderId: payload.folderId,
          year: payload.year || new Date().getFullYear().toString(),
          month:
            payload.month ||
            ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][
              new Date().getMonth()
            ],
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Save Realisasi Entry to Google Spreadsheet REALISASI sheet
   */
  static async saveRealisasi(gasUrl: string, spreadsheetId: string | undefined, realisasi: any): Promise<GASApiResponse> {
    try {
      const { id, ...rest } = realisasi;
      const mappedRel = {
        id: id || '', // Ensure ID is the first column
        ...rest,
        // Ensure volume is always 2 decimal string to prevent GAS truthy/date bug (46265)
        volume: Number(realisasi.volume || 0).toFixed(2),
        Lokasi_kerja: realisasi.lokasiKerja || '',
      };

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveRealisasi',
          spreadsheetId,
          realisasi: mappedRel,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch all Users from Google Spreadsheet USERS sheet
   */
  static async fetchUsers(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getUsers` : `${gasUrl}?action=getUsers`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch all Realisasi from Google Spreadsheet REALISASI sheet
   */
  static async fetchRealisasi(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getRealisasi` : `${gasUrl}?action=getRealisasi`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async fetchAbsensi(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getAbsensi` : `${gasUrl}?action=getAbsensi`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async saveAbsensi(gasUrl: string, spreadsheetId: string | undefined, absensi: any): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveAbsensi',
          spreadsheetId,
          absensi,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async deleteAbsensi(gasUrl: string, spreadsheetId: string, id: string): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteAbsensi',
          spreadsheetId,
          id,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async updateRealisasi(gasUrl: string, spreadsheetId: string, id: string, rel: any): Promise<GASApiResponse> {
    try {
      const { id: relId, ...rest } = rel;
      const mappedRel = {
        id: id || relId || '', // Ensure ID is the first column
        ...rest,
        // Ensure volume is always 2 decimal string to prevent GAS truthy/date bug (46265)
        volume: Number(rel.volume || 0).toFixed(2),
      };

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateRealisasi',
          spreadsheetId,
          id,
          realisasi: mappedRel,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch ALL Data from all sheets in a single API call (cached & deduplicated)
   */
  static async fetchAllData(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      const action = 'getAllData';
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=${action}` : `${gasUrl}?action=${action}`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.cachedFetch(targetUrl, true, 10000); // 10s cache for getAllData
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Gagal mengambil data lengkap dari Spreadsheet' };
    }
  }

  /**
   * Update Work Order in WORK_ORDER sheet
   */
  static async updateWorkOrder(gasUrl: string, spreadsheetId: string | undefined, id: string, wo: any): Promise<GASApiResponse> {
    try {
      this.clearCache();
      const mappedWo = {
        ...wo,
        // Match Spreadsheet Headers exactly (Case Sensitive in some GAS scripts)
        NOMOR_WO: wo.nomorWO || '',
        TANGGAL: wo.tanggal || '',
        ULP: wo.ulpName || '',
        PENYULANG: wo.penyulangName || '',
        VOLUME: Number(wo.volumePekerjaan || 0).toFixed(2),
        SATUAN: wo.satuan || 'KMS',
        REGU_ROW: wo.reguName || '',
        PETUGAS: wo.petugasName || '',
        JENIS_PEKERJAAN: wo.jenisPekerjaan || '',
        STATUS: (wo.status || 'BELUM SELESAI').toUpperCase(),
        DEADLINE: wo.deadline || '',
        WO_AWAL: wo.woMulai || '',
        WO_AKHIR: wo.woAkhir || '',
        // Fix 46265 bug: Explicitly send "0.00" string for non-completed to avoid GAS truthy/date bug
        TOTAL_REALISASI: (wo.status || '').toUpperCase() === 'SELESAI' 
          ? Number(wo.totalRealisasi || 0).toFixed(2) 
          : "0.00",
        SATUAN_TOTAL_REALISASI: (wo.status || '').toUpperCase() === 'SELESAI' 
          ? (wo.satuanTotalRealisasi || '') 
          : '',
        LOKASI_START: wo.lokasiStart || '',
        LOKASI_FINISH: wo.lokasiFinish || '',
        CREATED_AT: wo.createdAt || '', // Should already exist on update
      };

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateWorkOrder', spreadsheetId, id, workOrder: mappedWo }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Delete Work Order in WORK_ORDER sheet
   */
  static async deleteWorkOrder(gasUrl: string, spreadsheetId: string, id: string): Promise<GASApiResponse> {
    try {
      this.clearCache();
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteWorkOrder', spreadsheetId, id }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async deleteRealisasi(gasUrl: string, spreadsheetId: string, id: string): Promise<GASApiResponse> {
    try {
      this.clearCache();
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteRealisasi',
          spreadsheetId,
          id,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Save / Sync generic Master Data (ULP, PENYULANG, REGU_ROW, PETUGAS, USERS)
   */
  static async saveMasterData(
    gasUrl: string,
    spreadsheetId: string | undefined,
    sheetName: string,
    item: any
  ): Promise<GASApiResponse> {
    try {
      this.clearCache();
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveMasterData', spreadsheetId, sheetName, item }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async saveMasterItem(
    gasUrl: string,
    spreadsheetId: string | undefined,
    sheetName: string,
    item: any
  ): Promise<GASApiResponse> {
    return this.saveMasterData(gasUrl, spreadsheetId, sheetName, item);
  }

  /**
   * Delete item from generic sheet by ID
   */
  static async deleteMasterData(
    gasUrl: string,
    spreadsheetId: string | undefined,
    sheetName: string,
    id: string
  ): Promise<GASApiResponse> {
    try {
      this.clearCache();
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteMasterData', spreadsheetId, sheetName, id }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async deleteMasterItem(
    gasUrl: string,
    spreadsheetId: string | undefined,
    sheetName: string,
    id: string
  ): Promise<GASApiResponse> {
    return this.deleteMasterData(gasUrl, spreadsheetId, sheetName, id);
  }

  private static getActionName(type: string): string {
    const actionMap: Record<string, string> = {
      ULP: 'getULP',
      PENYULANG: 'getPenyulang',
      REGU_ROW: 'getRegu',
      REGU: 'getRegu',
      PETUGAS: 'getPetugas',
      USERS: 'getUsers',
      WORK_ORDER: 'getWorkOrders',
      WORK_ORDERS: 'getWorkOrders',
      REALISASI: 'getRealisasi',
      ABSENSI: 'getAbsensi',
    };
    return actionMap[type] || type;
  }

  /**
   * Fetch Master Data (ULP, Penyulang, Regu, Petugas) (cached & deduplicated)
   */
  static async fetchMasterData(
    gasUrl: string,
    type: 'getULP' | 'getPenyulang' | 'getRegu' | 'getPetugas' | 'getSetting' | 'getLogs' | string,
    spreadsheetId?: string
  ): Promise<GASApiResponse> {
    try {
      const actionName = this.getActionName(type);
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=${actionName}` : `${gasUrl}?action=${actionName}`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.cachedFetch(targetUrl, true);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

}
