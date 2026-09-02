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

export class GASApiService {
  /**
   * Fetch with AbortController timeout (default 10 seconds) to prevent hanging on weak mobile signals
   */
  private static async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
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
      if (err.name === 'AbortError') {
        throw new Error('Koneksi timeout. Waktu tunggu habis (sinyal lemah atau server lambat).');
      }
      throw err;
    }
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
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 8000);
      
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
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 12000);
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
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'login',
          username,
          password,
        }),
      }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Gagal terhubung ke server GAS Login' };
    }
  }

  /**
   * Fetch users from USERS sheet
   */
  static async fetchUsers(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getUsers` : `${gasUrl}?action=getUsers`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch all Work Orders from Google Spreadsheet WORK_ORDER sheet
   */
  static async fetchWorkOrders(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getWorkOrders` : `${gasUrl}?action=getWorkOrders`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 10000);
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
      const mappedWo = {
        ...workOrder,
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

      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'createWorkOrder', spreadsheetId, workOrder: mappedWo }),
      }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch Realisasi from REALISASI sheet
   */
  static async fetchRealisasi(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getRealisasi` : `${gasUrl}?action=getRealisasi`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Create or Save Realisasi
   */
  static async createRealisasi(gasUrl: string, spreadsheetId: string | undefined, realisasi: any): Promise<GASApiResponse> {
    try {
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'createRealisasi', spreadsheetId, realisasi }),
      }, 12000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async saveRealisasi(gasUrl: string, spreadsheetId: string | undefined, realisasi: any): Promise<GASApiResponse> {
    return this.createRealisasi(gasUrl, spreadsheetId, realisasi);
  }

  static async updateRealisasi(gasUrl: string, spreadsheetId: string | undefined, id: string, realisasi: any): Promise<GASApiResponse> {
    try {
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateRealisasi', spreadsheetId, id, realisasi }),
      }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch Absensi from ABSENSI sheet
   */
  static async fetchAbsensi(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getAbsensi` : `${gasUrl}?action=getAbsensi`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Create or Save Absensi
   */
  static async createAbsensi(gasUrl: string, spreadsheetId: string | undefined, absensi: any): Promise<GASApiResponse> {
    try {
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'createAbsensi', spreadsheetId, absensi }),
      }, 12000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async saveAbsensi(gasUrl: string, spreadsheetId: string | undefined, absensi: any): Promise<GASApiResponse> {
    return this.createAbsensi(gasUrl, spreadsheetId, absensi);
  }

  static async deleteAbsensi(gasUrl: string, spreadsheetId: string, id: string): Promise<GASApiResponse> {
    try {
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteAbsensi', spreadsheetId, id }),
      }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async deleteRealisasi(gasUrl: string, spreadsheetId: string, id: string): Promise<GASApiResponse> {
    try {
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteRealisasi',
          spreadsheetId,
          id,
        }),
      }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch ALL Data from all sheets in a single API call (with 12s timeout)
   */
  static async fetchAllData(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      const action = 'getAllData';
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=${action}` : `${gasUrl}?action=${action}`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 12000);
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
      const mappedWo = {
        ...wo,
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
        TOTAL_REALISASI: (wo.status || '').toUpperCase() === 'SELESAI' 
          ? Number(wo.totalRealisasi || 0).toFixed(2) 
          : "0.00",
        SATUAN_TOTAL_REALISASI: (wo.status || '').toUpperCase() === 'SELESAI' 
          ? (wo.satuanTotalRealisasi || '') 
          : '',
        LOKASI_START: wo.lokasiStart || '',
        LOKASI_FINISH: wo.lokasiFinish || '',
        CREATED_AT: wo.createdAt || '',
      };

      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateWorkOrder', spreadsheetId, id, workOrder: mappedWo }),
      }, 10000);
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
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteWorkOrder', spreadsheetId, id }),
      }, 10000);
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
    spreadsheetId: string,
    sheetName: 'ULP' | 'PENYULANG' | 'REGU_ROW' | 'PETUGAS' | 'USERS' | 'SETTING' | 'LOG_ACTIVITY',
    item: any
  ): Promise<GASApiResponse> {
    try {
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveMasterData', spreadsheetId, sheetName, item }),
      }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Delete item from generic sheet by ID
   */
  static async deleteMasterData(
    gasUrl: string,
    spreadsheetId: string,
    sheetName: 'ULP' | 'PENYULANG' | 'REGU_ROW' | 'PETUGAS' | 'USERS',
    id: string
  ): Promise<GASApiResponse> {
    try {
      const response = await this.fetchWithTimeout(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteMasterData', spreadsheetId, sheetName, id }),
      }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch Master Data (ULP, Penyulang, Regu, Petugas)
   */
  static async fetchMasterData(
    gasUrl: string,
    type: 'getULP' | 'getPenyulang' | 'getRegu' | 'getPetugas' | 'getSetting' | 'getLogs' | string,
    spreadsheetId?: string
  ): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=${type}` : `${gasUrl}?action=${type}`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' }, 10000);
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

}
