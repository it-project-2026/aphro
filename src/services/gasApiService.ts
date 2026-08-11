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
   * Test connection to Google Apps Script Web App Endpoint
   */
  static async testConnection(gasUrl: string): Promise<boolean> {
    if (!gasUrl || !gasUrl.startsWith('http')) return false;
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=ping` : `${gasUrl}?action=ping`;
      const response = await fetch(targetUrl, { method: 'GET' });
      
      // If we got a 200 OK, it's connected, even if the JSON is malformed
      if (response.ok) {
        try {
          const json: GASApiResponse = await response.json();
          return json.status === 'success' || !!json.message;
        } catch (e) {
          // If it's a 200 but not JSON (maybe a redirect to login page), it's at least reachable
          return true; 
        }
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
      return await response.json();
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
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Gagal terhubung ke server GAS Login' };
    }
  }

  /**
   * Fetch all Work Orders from Google Spreadsheet WORK_ORDER sheet
   */
  static async fetchWorkOrders(gasUrl: string): Promise<GASApiResponse> {
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getWorkOrders` : `${gasUrl}?action=getWorkOrders`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Create Work Order in Google Spreadsheet WORK_ORDER sheet
   */
  static async createWorkOrder(gasUrl: string, workOrder: any): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createWorkOrder',
          workOrder,
        }),
      });
      return await response.json();
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
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Save Realisasi Entry to Google Spreadsheet REALISASI sheet
   */
  static async saveRealisasi(gasUrl: string, realisasi: any): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveRealisasi',
          realisasi,
        }),
      });
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch all Users from Google Spreadsheet USERS sheet
   */
  static async fetchUsers(gasUrl: string): Promise<GASApiResponse> {
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getUsers` : `${gasUrl}?action=getUsers`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch all Realisasi from Google Spreadsheet REALISASI sheet
   */
  static async fetchRealisasi(gasUrl: string): Promise<GASApiResponse> {
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getRealisasi` : `${gasUrl}?action=getRealisasi`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  static async fetchAbsensi(gasUrl: string): Promise<GASApiResponse> {
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getAbsensi` : `${gasUrl}?action=getAbsensi`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await response.json();
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
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch ALL Data from all 10 sheets in a single API call
   */
  static async fetchAllData(gasUrl: string): Promise<GASApiResponse> {
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=getAllData` : `${gasUrl}?action=getAllData`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Gagal mengambil data lengkap dari Spreadsheet' };
    }
  }

  /**
   * Update Work Order in WORK_ORDER sheet
   */
  static async updateWorkOrder(gasUrl: string, id: string, wo: any): Promise<GASApiResponse> {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateWorkOrder', id, workOrder: wo }),
      });
      return await response.json();
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
      return await response.json();
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
      return await response.json();
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
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Fetch Master Data (ULP, Penyulang, Regu, Petugas)
   */
  static async fetchMasterData(
    gasUrl: string,
    type: 'getULP' | 'getPenyulang' | 'getRegu' | 'getPetugas' | 'getSetting' | 'getLogs' | string
  ): Promise<GASApiResponse> {
    try {
      const targetUrl = gasUrl.includes('?') ? `${gasUrl}&action=${type}` : `${gasUrl}?action=${type}`;
      const response = await fetch(targetUrl, { method: 'GET' });
      return await response.json();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }
}
