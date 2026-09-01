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
   * Safe response handler to prevent JSON parsing errors when GAS returns HTML
   */
  private static async handleResponse(response: Response): Promise<GASApiResponse> {
    const contentType = response.headers.get('content-type');
    const text = await response.text();

    if (!response.ok) {
      return { 
        status: 'error', 
        message: `HTTP Error ${response.status}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}` 
      };
    }

    if (contentType && contentType.includes('text/html')) {
      // Check if it looks like a Google Login page or Error page
      if (text.includes('google-signin') || text.includes('<!DOCTYPE html>')) {
        return { 
          status: 'error', 
          message: 'Menerima balasan HTML. Pastikan URL Web App sudah benar dan Izin skrip disetel ke "Anyone".' 
        };
      }
      return { status: 'error', message: `Menerima balasan tidak terduga (HTML): ${text.substring(0, 50)}...` };
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
    } catch (err) {
      console.warn('GAS Connection test failed:', err);
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
   * Fetch all Work Orders from Google Spreadsheet WORK_ORDER sheet
   */
  static async fetchWorkOrders(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getWorkOrders` : `${gasUrl}?action=getWorkOrders`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await fetch(targetUrl, { method: 'GET' });
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
      const mappedRel = {
        ...realisasi,
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

  static async saveAbsensi(gasUrl: string, absensi: any): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveAbsensi',
          absensi,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async deleteAbsensi(gasUrl: string, id: string): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteAbsensi',
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
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateRealisasi',
          spreadsheetId,
          id,
          realisasi: rel,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async deleteRealisasi(gasUrl: string, id: string): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteRealisasi',
          id,
        }),
      });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch ALL Data from all 10 sheets in a single API call
   */
  static async fetchAllData(gasUrl: string, spreadsheetId?: string): Promise<GASApiResponse> {
    try {
      const action = 'getAllData';
      let targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=${action}` : `${gasUrl}?action=${action}`;
      if (spreadsheetId) targetUrl += `&spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
      const response = await fetch(targetUrl, { method: 'GET' });
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
  static async deleteWorkOrder(gasUrl: string, id: string): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteWorkOrder', id }),
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
    sheetName: 'ULP' | 'PENYULANG' | 'REGU_ROW' | 'PETUGAS' | 'USERS' | 'SETTING' | 'LOG_ACTIVITY',
    item: any
  ): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveMasterData', sheetName, item }),
      });
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
    sheetName: 'ULP' | 'PENYULANG' | 'REGU_ROW' | 'PETUGAS' | 'USERS',
    id: string
  ): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteMasterData', sheetName, id }),
      });
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
      const response = await fetch(targetUrl, { method: 'GET' });
      return await this.handleResponse(response);
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

}
