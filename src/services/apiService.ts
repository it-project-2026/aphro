import { Realisasi } from '../types';
import { normalizeRealisasiRow } from '../utils/realisasiNormalizer';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://api.aphro-row.my.id';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RealisasiApiResponse {
  status: string;
  unitId?: string;
  pagination: PaginationMeta;
  data: Realisasi[];
  filters?: {
    ULP?: string | null;
    tanggalDari?: string | null;
    tanggalSampai?: string | null;
    Nomor_WO?: string | null;
  };
  message?: string;
}

export interface FetchRealisasiParams {
  page?: number;
  limit?: number;
  tanggalDari?: string;
  tanggalSampai?: string;
  ULP?: string;
  Nomor_WO?: string;
}

export class ApiService {
  private static getCleanBaseUrl(): string {
    const rawUrl =
      import.meta.env.VITE_API_URL ||
      API_BASE_URL ||
      'https://api.aphro-row.my.id';
    return rawUrl.trim().replace(/\/+$/, '');
  }

  /**
   * Mengambil JWT token dari localStorage.
   */
  static getAuthToken(): string {
    const directToken =
      localStorage.getItem('aphro_token') ||
      localStorage.getItem('jwt_token') ||
      localStorage.getItem('token');

    if (directToken) {
      return directToken;
    }

    const savedUserStr =
      localStorage.getItem('aphro_user') ||
      localStorage.getItem('pln_mobile_user');

    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        const tok =
          parsed.token ||
          parsed.jwtToken ||
          parsed.accessToken ||
          parsed.token_jwt;
        if (tok) return tok;
      } catch {}
    }

    return localStorage.getItem('aphro_sys_token') || 'system-hypercloud-token';
  }

  /**
   * Helper internal untuk memformat pesan kesalahan status HTTP
   */
  private static formatErrorMessage(
    status: number,
    defaultMsg?: string
  ): string {
    if (status === 400) {
      return defaultMsg || 'Permintaan tidak valid (HTTP 400).';
    }
    if (status === 401) {
      return 'Sesi login telah berakhir atau token tidak valid. Silakan login kembali.';
    }
    if (status === 403) {
      return defaultMsg || 'Akses ke data ditolak oleh server (HTTP 403).';
    }
    if (status === 404) {
      return defaultMsg || 'Endpoint atau data tidak ditemukan (HTTP 404).';
    }
    if (status === 409) {
      return (
        defaultMsg ||
        'Konflik data atau data duplikat ditemukan di server (HTTP 409).'
      );
    }
    if (status === 429) {
      return 'Permintaan terlalu banyak. Harap tunggu beberapa saat lalu coba lagi (HTTP 429).';
    }
    if (status >= 500) {
      return 'Server API HyperCloudHost sedang mengalami masalah. Silakan coba lagi nanti.';
    }
    return defaultMsg || `API mengembalikan status HTTP ${status}`;
  }

  /**
   * Helper to perform HTTP request with automatic priority to local Express API (/api/...)
   */
  public static async executeFetch(
    pathAndQuery: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const cleanPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
    const token = this.getAuthToken();
    
    // Build plain headers object for maximum compatibility with all browsers/iframes
    const headersObj: Record<string, string> = {};
    
    // Copy any input headers safely
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((val, key) => {
          headersObj[key] = val;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, val]) => {
          headersObj[key] = val;
        });
      } else {
        Object.entries(options.headers).forEach(([key, val]) => {
          headersObj[key] = String(val);
        });
      }
    }

    if (!headersObj['Authorization'] && token) {
      headersObj['Authorization'] = `Bearer ${token}`;
    }
    if (!headersObj['Accept']) {
      headersObj['Accept'] = 'application/json';
    }

    const requestOptions = { ...options, headers: headersObj };

    // Get current browser origin if in browser, to resolve absolute URLs and bypass sandbox base-URL restrictions
    const host = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const localUrl = `${host}${cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`}`;

    try {
      const res = await fetch(localUrl, requestOptions);
      // Return the local response immediately if we got any HTTP status code from the local server
      return res;
    } catch (localErr) {
      console.warn(`[ApiService] Local Express API fetch to ${localUrl} failed (network/CORS/sandbox):`, localErr);
      
      // Fallback only if local fetch literally throws a network error (not a 4xx/5xx status)
      const externalBase = this.getCleanBaseUrl();
      if (externalBase && !externalBase.includes('localhost') && !externalBase.includes('127.0.0.1') && !externalBase.includes(host)) {
        const externalUrl = `${externalBase}${cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`}`;
        console.log(`[ApiService] Falling back to external URL: ${externalUrl}`);
        try {
          return await fetch(externalUrl, requestOptions);
        } catch (extErr) {
          console.error(`[ApiService] External fallback to ${externalUrl} also failed:`, extErr);
          throw extErr;
        }
      }
      throw localErr;
    }
  }

  /**
   * Mengambil data REALISASI dari Node.js API
   * dengan server-side pagination dan filtering.
   *
   * Sumber data online:
   * PostgreSQL HyperCloudHost
   */
  static async fetchRealisasi(
    params: FetchRealisasiParams = {}
  ): Promise<RealisasiApiResponse> {
    const {
      page = 1,
      limit = 20,
      tanggalDari,
      tanggalSampai,
      ULP,
      Nomor_WO,
    } = params;

    const token = this.getAuthToken();
    if (!token) {
      throw new Error(
        'Token login tidak ditemukan. Silakan login kembali.'
      );
    }

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(page));
    queryParams.set('limit', String(limit));

    if (tanggalDari?.trim()) {
      queryParams.set('tanggalDari', tanggalDari.trim());
    }
    if (tanggalSampai?.trim()) {
      queryParams.set('tanggalSampai', tanggalSampai.trim());
    }
    if (ULP?.trim() && ULP !== 'ALL') {
      queryParams.set('ULP', ULP.trim());
    }
    if (Nomor_WO?.trim()) {
      queryParams.set('Nomor_WO', Nomor_WO.trim());
    }

    const baseUrl = this.getCleanBaseUrl();
    const url = `${baseUrl}/api/realisasi?${queryParams.toString()}`;

    let response: Response;
    try {
      response = await this.executeFetch(`/api/realisasi?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (networkError: any) {
      console.error(
        '[ApiService.fetchRealisasi Network Error]',
        networkError
      );
      throw new Error(
        'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.'
      );
    }

    if (!response.ok) {
      let serverMessage: string | undefined;
      try {
        const errorJson = await response.json();
        serverMessage = errorJson?.message;
      } catch {
        // Response bukan JSON
      }

      const errorMessage = this.formatErrorMessage(
        response.status,
        serverMessage
      );
      throw new Error(errorMessage);
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new Error('Response dari API Realisasi tidak valid.');
    }

    if (!json || typeof json !== 'object') {
      throw new Error('Format response API Realisasi tidak valid.');
    }

    const rawData = Array.isArray(json.data) ? json.data : [];
    const normalizedData: Realisasi[] = rawData.map((item: any) =>
      normalizeRealisasiRow(item)
    );

    const paginationMeta: PaginationMeta = json.pagination || {
      page,
      limit,
      total: normalizedData.length,
      totalPages: Math.ceil(normalizedData.length / limit) || 1,
      hasNextPage: false,
      hasPreviousPage: page > 1,
    };

    return {
      status: json.status || 'success',
      unitId: json.unitId,
      pagination: paginationMeta,
      data: normalizedData,
      filters: json.filters,
      message: json.message,
    };
  }

  /**
   * Post new Realisasi record to HyperCloudHost PostgreSQL
   */
  static async saveRealisasi(
    data: any
  ): Promise<{ success: boolean; serverId?: string; message?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res = await this.executeFetch('/api/realisasi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      const json = await res.json().catch(() => ({}));
      return {
        success: true,
        serverId: json.id || json.data?.id || data.id,
        message: json.message,
      };
    } catch (err: any) {
      console.error('[ApiService.saveRealisasi Error]', err);
      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Update Realisasi record in HyperCloudHost PostgreSQL
   */
  static async updateRealisasi(
    id: string,
    data: any
  ): Promise<{ success: boolean; message?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res = await this.executeFetch(`/api/realisasi/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[ApiService.updateRealisasi Error]', err);
      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Delete Realisasi record from HyperCloudHost PostgreSQL
   */
  static async deleteRealisasi(
    id: string
  ): Promise<{ success: boolean; message?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res = await this.executeFetch(`/api/realisasi/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[ApiService.deleteRealisasi Error]', err);
      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Fetch Work Orders from HyperCloudHost PostgreSQL
   */
  static async fetchWorkOrders(
    unitId?: string
  ): Promise<{ success: boolean; data: any[]; message?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        data: [],
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const query =
      unitId && unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    try {
      const res = await this.executeFetch(`/api/work-orders${query}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }
        return {
          success: false,
          data: [],
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      const json = await res.json();
      const list = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
      return { success: true, data: list };
    } catch (err: any) {
      console.error('[ApiService.fetchWorkOrders Error]', err);
      return {
        success: false,
        data: [],
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Save Work Order to HyperCloudHost PostgreSQL
   */
  static async saveWorkOrder(
    data: any
  ): Promise<{ success: boolean; message?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res = await this.executeFetch('/api/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[ApiService.saveWorkOrder Error]', err);
      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Fetch Absensi from HyperCloudHost PostgreSQL
   */
  static async fetchAbsensi(
    unitId?: string
  ): Promise<{ success: boolean; data: any[]; message?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        data: [],
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const query =
      unitId && unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    try {
      const res = await this.executeFetch(`/api/absensi${query}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }
        return {
          success: false,
          data: [],
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      const json = await res.json();
      const list = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
      return { success: true, data: list };
    } catch (err: any) {
      console.error('[ApiService.fetchAbsensi Error]', err);
      return {
        success: false,
        data: [],
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Save Absensi to HyperCloudHost PostgreSQL
   */
  static async saveAbsensi(
    data: any
  ): Promise<{ success: boolean; message?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res = await this.executeFetch('/api/absensi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[ApiService.saveAbsensi Error]', err);
      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Check API Health
   */
  static async checkHealth(): Promise<{
    status: string;
    database: string;
    databaseName?: string;
    timestamp?: string;
  }> {
    const res = await this.executeFetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Health check failed with status ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Login to HyperCloudHost Node.js API
   */
  static async login(
    username: string,
    password?: string,
    unitId?: string
  ): Promise<{
    status: string;
    message: string;
    token?: string;
    user?: any;
  }> {
    const cleanUsername = (username || '').trim();
    const cleanPassword = (password || '').trim();
    const cleanUnitId = (unitId || '').trim();

    try {
      const res = await this.executeFetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          Username: cleanUsername,
          Password: cleanPassword,
          unitId: cleanUnitId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status === 'error') {
        return {
          status: 'error',
          message: json.message || this.formatErrorMessage(res.status),
        };
      }

      if (json.token) {
        try {
          localStorage.setItem('aphro_token', json.token);
          localStorage.setItem('jwt_token', json.token);
        } catch {
          // ignore
        }
      }

      return {
        status: 'success',
        message: json.message || 'Login berhasil',
        token: json.token,
        user: json.user,
      };
    } catch (err: any) {
      console.error('[ApiService.login Error]', err);
      return {
        status: 'error',
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Fetch all users from HyperCloudHost API
   */
  static async fetchUsers(
    unitId?: string
  ): Promise<{ success: boolean; data: any[]; message?: string }> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const query =
      unitId && unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    try {
      console.log(`[ApiService] fetchUsers starting for unit: ${unitId || 'ALL'}`);
      const res = await this.executeFetch(`/api/users${query}`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {}
        console.warn(`[ApiService] fetchUsers failed with status ${res.status}:`, serverMsg);
        return {
          success: false,
          data: [],
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      const json = await res.json();
      const list = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
      console.log(`[ApiService] fetchUsers success: found ${list.length} users`);
      return { success: true, data: list };
    } catch (err: any) {
      console.error('[ApiService.fetchUsers Error]', err);
      return {
        success: false,
        data: [],
        message: 'Tidak dapat terhubung ke API HyperCloudHost.',
      };
    }
  }

  /**
   * Fetch Master Data (ULP, Penyulang, Regu-ROW, Petugas) from HyperCloudHost API
   */
  static async fetchMasterData(
    unitId?: string
  ): Promise<{
    ulp: any[];
    penyulang: any[];
    regu: any[];
    petugas: any[];
    users: any[];
  }> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const query = unitId && unitId !== 'ALL' ? `?unitId=${encodeURIComponent(unitId)}` : '';

    const [ulpRes, penyulangRes, reguRes, petugasRes, usersRes] = await Promise.all([
      this.executeFetch(`/api/ulp${query}`, { headers }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      this.executeFetch(`/api/penyulang${query}`, { headers }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      this.executeFetch(`/api/regu-row${query}`, { headers }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      this.executeFetch(`/api/petugas${query}`, { headers }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      this.executeFetch(`/api/users${query}`, { headers }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
    ]);

    return {
      ulp: Array.isArray(ulpRes.data) ? ulpRes.data : [],
      penyulang: Array.isArray(penyulangRes.data) ? penyulangRes.data : [],
      regu: Array.isArray(reguRes.data) ? reguRes.data : [],
      petugas: Array.isArray(petugasRes.data) ? petugasRes.data : [],
      users: Array.isArray(usersRes.data) ? usersRes.data : [],
    };
  }

  /**
   * Delete Work Order from HyperCloudHost API
   */
  static async deleteWorkOrder(
    id: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.executeFetch(`/api/work-orders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        return { success: false, message: this.formatErrorMessage(res.status) };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Delete Absensi from HyperCloudHost API
   */
  static async deleteAbsensi(
    id: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.executeFetch(`/api/absensi/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        return { success: false, message: this.formatErrorMessage(res.status) };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Save User to HyperCloudHost API
   */
  static async saveUser(
    userData: any
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.executeFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        return { success: false, message: this.formatErrorMessage(res.status) };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Delete User from HyperCloudHost API
   */
  static async deleteUser(
    id: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.executeFetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        return { success: false, message: this.formatErrorMessage(res.status) };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Fetch Inisiasi Units from HyperCloudHost API
   */
  static async fetchInisiasiUnits(): Promise<{
    success: boolean;
    data: any[];
    source: 'hypercloud' | 'cache' | 'default';
    message?: string;
  }> {
    try {
      const res = await this.executeFetch('/api/inisiasi', { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : [];
        if (list.length > 0) {
          return {
            success: true,
            data: list,
            source: 'hypercloud',
            message: `Berhasil memuat ${list.length} Unit Layanan dari HyperCloudHost.`,
          };
        }
      }
    } catch (e) {
      console.warn('[ApiService] fetchInisiasiUnits error:', e);
    }
    return {
      success: false,
      data: [],
      source: 'default',
      message: 'Gagal memuat Unit Layanan dari HyperCloudHost API',
    };
  }
}
