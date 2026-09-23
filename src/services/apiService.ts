import { Realisasi } from '../types';
import { normalizeRealisasiRow } from '../utils/realisasiNormalizer';
import { normalizeWorkOrderRow } from '../utils/workOrderNormalizer';
import { normalizeUser, normalizeAbsensi } from './syncService';
import { InisiasiService } from './inisiasiService';
import { dexieDb } from './dexieDb';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || 'https://api.aphro-row.my.id';

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
  unitId?: string;
}

export class ApiService {
  private static getCleanBaseUrl(): string {
    const rawUrl =
      import.meta.env.VITE_API_URL?.trim() ||
      API_BASE_URL ||
      'https://api.aphro-row.my.id';

    return rawUrl.trim().replace(/\/+$/, '');
  }

  /**
   * Mengambil JWT token dari localStorage berdasarkan urutan prioritas:
   * 1. aphro_token
   * 2. jwt_token
   * 3. token
   * 4. token dari aphro_user
   * 5. token dari pln_mobile_user
   */
  static getAuthToken(): string {
    if (typeof localStorage === 'undefined') return '';

    // 1. aphro_token
    const aphroToken = localStorage.getItem('aphro_token');
    if (aphroToken && aphroToken.trim() && aphroToken !== 'system-hypercloud-token') {
      return aphroToken.trim();
    }

    // 2. jwt_token
    const jwtToken = localStorage.getItem('jwt_token');
    if (jwtToken && jwtToken.trim() && jwtToken !== 'system-hypercloud-token') {
      return jwtToken.trim();
    }

    // 3. token
    const token = localStorage.getItem('token');
    if (token && token.trim() && token !== 'system-hypercloud-token') {
      return token.trim();
    }

    // 4. aphro_user
    const aphroUserStr = localStorage.getItem('aphro_user');
    if (aphroUserStr) {
      try {
        const u = JSON.parse(aphroUserStr);
        const tok = u?.token || u?.jwtToken || u?.accessToken || u?.token_jwt;
        if (tok && typeof tok === 'string' && tok.trim() && tok !== 'system-hypercloud-token') {
          return tok.trim();
        }
      } catch {
        // Ignore
      }
    }

    // 5. pln_mobile_user
    const plnUserStr = localStorage.getItem('pln_mobile_user');
    if (plnUserStr) {
      try {
        const u = JSON.parse(plnUserStr);
        const tok = u?.token || u?.jwtToken || u?.accessToken || u?.token_jwt;
        if (tok && typeof tok === 'string' && tok.trim() && tok !== 'system-hypercloud-token') {
          return tok.trim();
        }
      } catch {
        // Ignore
      }
    }

    return '';
  }

  /**
   * Helper internal untuk memformat pesan kesalahan status HTTP.
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
      return (
        defaultMsg ||
        'Akses ke data ditolak oleh server (HTTP 403).'
      );
    }

    if (status === 404) {
      return (
        defaultMsg ||
        'Endpoint atau data tidak ditemukan (HTTP 404).'
      );
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
      return (
        defaultMsg ||
        'Server API HyperCloudHost sedang mengalami masalah. Silakan coba lagi nanti.'
      );
    }

    return (
      defaultMsg ||
      `API mengembalikan status HTTP ${status}`
    );
  }

  /**
   * Helper utama untuk melakukan HTTP request.
   * SELALU menyertakan Authorization: Bearer <JWT>
   * Target Backend: https://api.aphro-row.my.id
   */
  public static async executeFetch(
    pathAndQuery: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = this.getAuthToken();

    // Pastikan requestOptions.headers selalu digabung dengan Authorization & Accept
    const headers = new Headers(options.headers || {});

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const finalOptions: RequestInit = {
      ...options,
      headers,
    };

    const externalBase = this.getCleanBaseUrl(); // "https://api.aphro-row.my.id"
    const cleanPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
    const apiPath = cleanPath.startsWith('/api/') ? cleanPath : cleanPath === '/api' ? '/api' : `/api${cleanPath}`;

    const externalUrl = `${externalBase}${apiPath}`;

    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isAphroProduction = hostname === 'www.aphro-row.my.id' || hostname === 'aphro-row.my.id';

    // Pada Domain Production APHRO (atau default), SELALU gunakan backend API utama: https://api.aphro-row.my.id
    // JANGAN PERNAH fallback ke frontend origin (www.aphro-row.my.id) saat server mengembalikan response HTTP (misal 401, 403, 404, 500).
    if (isAphroProduction) {
      console.log(`[ApiService] Production API request: ${externalUrl}`);
      return await fetch(externalUrl, finalOptions);
    }

    // In preview / dev mode: try primary API first, fallback to local server if network fetch fails
    const host = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const localUrl = `${host}${apiPath}`;

    try {
      console.log(`[ApiService] Production API request: ${externalUrl}`);
      return await fetch(externalUrl, finalOptions);
    } catch (extErr: any) {
      console.warn(`[ApiService] Primary API network error (${externalUrl}). Trying local endpoint (${localUrl}):`, extErr?.message || extErr);
      try {
        return await fetch(localUrl, finalOptions);
      } catch (localErr) {
        console.error(`[ApiService] Both primary and local API requests failed:`, localErr);
        throw extErr;
      }
    }
  }

  /**
   * =========================================================
   * REALISASI
   * =========================================================
   */

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
      unitId,
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

    if (
      unitId?.trim() &&
      unitId !== 'ALL'
    ) {
      queryParams.set(
        'unitId',
        unitId.trim()
      );
    }

    if (tanggalDari?.trim()) {
      queryParams.set(
        'tanggalDari',
        tanggalDari.trim()
      );
    }

    if (tanggalSampai?.trim()) {
      queryParams.set(
        'tanggalSampai',
        tanggalSampai.trim()
      );
    }

    if (
      ULP?.trim() &&
      ULP !== 'ALL'
    ) {
      queryParams.set(
        'ULP',
        ULP.trim()
      );
    }

    if (Nomor_WO?.trim()) {
      queryParams.set(
        'Nomor_WO',
        Nomor_WO.trim()
      );
    }

    let response: Response;

    try {
      response = await this.executeFetch(
        `/api/realisasi?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
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
        const errorJson =
          await response.json();

        serverMessage =
          errorJson?.message;
      } catch {
        // Response bukan JSON
      }

      const errorMessage =
        this.formatErrorMessage(
          response.status,
          serverMessage
        );

      throw new Error(
        errorMessage
      );
    }

    let json: any;

    try {
      json = await response.json();
    } catch {
      throw new Error(
        'Response dari API Realisasi tidak valid.'
      );
    }

    if (
      !json ||
      typeof json !== 'object'
    ) {
      throw new Error(
        'Format response API Realisasi tidak valid.'
      );
    }

    const rawData =
      Array.isArray(json.data)
        ? json.data
        : [];

    const normalizedData: Realisasi[] =
      rawData.map(
        (item: any) =>
          normalizeRealisasiRow(item)
      );

    const paginationMeta: PaginationMeta =
      json.pagination || {
        page,
        limit,
        total:
          normalizedData.length,
        totalPages:
          Math.ceil(
            normalizedData.length /
              limit
          ) || 1,
        hasNextPage: false,
        hasPreviousPage:
          page > 1,
      };

    return {
      status:
        json.status || 'success',
      unitId:
        json.unitId,
      pagination:
        paginationMeta,
      data:
        normalizedData,
      filters:
        json.filters,
      message:
        json.message,
    };
  }

  /**
   * Post new Realisasi record
   * to HyperCloudHost PostgreSQL.
   */
  static async saveRealisasi(
    data: any
  ): Promise<{
    success: boolean;
    serverId?: string;
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          '/api/realisasi',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify(data),
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      const json =
        await res
          .json()
          .catch(() => ({}));

      return {
        success: true,
        serverId:
          json.id ||
          json.data?.id ||
          data.id,
        message:
          json.message,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.saveRealisasi Error]',
        err
      );

      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Update Realisasi record.
   */
  static async updateRealisasi(
    id: string,
    data: any
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          `/api/realisasi/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify(data),
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.updateRealisasi Error]',
        err
      );

      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Delete Realisasi record.
   */
  static async deleteRealisasi(
    id: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          `/api/realisasi/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
            headers: {
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.deleteRealisasi Error]',
        err
      );

      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * =========================================================
   * WORK ORDER
   * =========================================================
   */

  /**
   * Fetch Work Orders.
   */
  static async fetchWorkOrders(
    unitId?: string
  ): Promise<{
    success: boolean;
    data: any[];
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        data: [],
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const query =
      unitId &&
      unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    try {
      const res =
        await this.executeFetch(
          `/api/work-orders${query}`,
          {
            method: 'GET',
            headers: {
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          data: [],
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      const json =
        await res.json();

      const list =
        Array.isArray(json.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

      return {
        success: true,
        data: list,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.fetchWorkOrders Error]',
        err
      );

      return {
        success: false,
        data: [],
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Save Work Order.
   */
  static async saveWorkOrder(
    data: any
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          '/api/work-orders',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify(data),
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.saveWorkOrder Error]',
        err
      );

      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Update Work Order.
   */
  static async updateWorkOrder(
    id: string,
    data: any
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          `/api/work-orders/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify(data),
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.updateWorkOrder Error]',
        err
      );

      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * =========================================================
   * ABSENSI
   * =========================================================
   */

  /**
   * Fetch Absensi.
   */
  static async fetchAbsensi(
    unitId?: string
  ): Promise<{
    success: boolean;
    data: any[];
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        data: [],
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const query =
      unitId &&
      unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    try {
      const res =
        await this.executeFetch(
          `/api/absensi${query}`,
          {
            method: 'GET',
            headers: {
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          data: [],
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      const json =
        await res.json();

      const rawList =
        Array.isArray(json.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

      const list =
        rawList.map(
          normalizeAbsensi
        );

      return {
        success: true,
        data: list,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.fetchAbsensi Error]',
        err
      );

      return {
        success: false,
        data: [],
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Save Absensi.
   */
  static async saveAbsensi(
    data: any
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          '/api/absensi',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify(data),
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.saveAbsensi Error]',
        err
      );

      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * Update Absensi.
   */
  static async updateAbsensi(
    id: string,
    data: any
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        success: false,
        message:
          'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          `/api/absensi/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify(data),
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // ignore
        }

        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.updateAbsensi Error]',
        err
      );

      return {
        success: false,
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * =========================================================
   * HEALTH CHECK
   * =========================================================
   */

  static async checkHealth(): Promise<{
    status: string;
    database: string;
    databaseName?: string;
    timestamp?: string;
  }> {
    const res =
      await this.executeFetch(
        '/api/health',
        {
          method: 'GET',
          headers: {
            Accept:
              'application/json',
          },
        }
      );

    if (!res.ok) {
      throw new Error(
        `Health check failed with status ${res.status}`
      );
    }

    return await res.json();
  }

  /**
   * =========================================================
   * LOGIN
   * =========================================================
   */

  /**
   * Login to HyperCloudHost Node.js API.
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
    const cleanUsername =
      (username || '').trim();

    const cleanPassword =
      (password || '').trim();

    const cleanUnitId =
      (unitId || '').trim();

    try {
      const res =
        await this.executeFetch(
          '/api/login',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
            },
            body:
              JSON.stringify({
                Username: cleanUsername,
                Password: cleanPassword,
                username: cleanUsername,
                password: cleanPassword,
                unitId: cleanUnitId,
              }),
          }
        );

      const json =
        await res
          .json()
          .catch(() => ({}));

      if (
        !res.ok ||
        json.status === 'error'
      ) {
        return {
          status: 'error',
          message:
            json.message ||
            this.formatErrorMessage(
              res.status
            ),
        };
      }

      if (json.token) {
        try {
          localStorage.setItem(
            'aphro_token',
            json.token
          );

          localStorage.setItem(
            'jwt_token',
            json.token
          );
        } catch {
          // Ignore storage error
        }
      }

      return {
        status: 'success',
        message:
          json.message ||
          'Login berhasil',
        token:
          json.token,
        user:
          json.user,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.login Error]',
        err
      );

      return {
        status: 'error',
        message:
          'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
      };
    }
  }

  /**
   * =========================================================
   * USERS
   * =========================================================
   */

  /**
   * Fetch all users.
   */
  static async fetchUsers(
    unitId?: string
  ): Promise<{
    success: boolean;
    data: any[];
    source?: 'hypercloud' | 'dexie' | 'none';
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      console.warn('[ApiService] fetchUsers: Token JWT tidak ditemukan.');
      const dexieUsers = await dexieDb.users.toArray().catch(() => []);
      if (dexieUsers && dexieUsers.length > 0) {
        console.log('[USERS STATE] Received from Dexie cache:', dexieUsers.length, 'users');
        return {
          success: true,
          data: dexieUsers,
          source: 'dexie',
          message: 'JWT token tidak ditemukan. Memuat data pengguna dari cache lokal.',
        };
      }
      return {
        success: false,
        data: [],
        source: 'none',
        message: 'JWT token tidak ditemukan. Silakan login kembali.',
      };
    }

    const headers: Record<
      string,
      string
    > = {
      Accept:
        'application/json',
    };

    if (token) {
      headers[
        'Authorization'
      ] = `Bearer ${token}`;
    }

    const query =
      unitId &&
      unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    try {
      console.log(
        `[ApiService] fetchUsers starting for unit: ${
          unitId || 'ALL'
        }`
      );

      const res =
        await this.executeFetch(
          `/api/users${query}`,
          {
            method: 'GET',
            headers,
          }
        );

      if (!res.ok) {
        let serverMsg:
          | string
          | undefined;

        try {
          const errJson =
            await res.json();

          serverMsg =
            errJson?.message;
        } catch {
          // Ignore
        }

        console.warn(
          `[ApiService] fetchUsers failed with status ${res.status}:`,
          serverMsg
        );

        const dexieUsers = await dexieDb.users.toArray().catch(() => []);
        if (dexieUsers && dexieUsers.length > 0) {
          console.log('[USERS STATE] Received from Dexie cache:', dexieUsers.length, 'users');
          return {
            success: true,
            data: dexieUsers,
            source: 'dexie',
            message: 'Memuat data pengguna dari cache lokal.',
          };
        }

        return {
          success: false,
          data: [],
          source: 'none',
          message:
            this.formatErrorMessage(
              res.status,
              serverMsg
            ),
        };
      }

      const json =
        await res.json();

      const list =
        Array.isArray(json.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

      console.log(
        '[USERS STATE] Received from HyperCloud:', list.length, 'users'
      );

      return {
        success: true,
        data: list,
        source: 'hypercloud',
      };
    } catch (err: any) {
      console.warn(
        '[ApiService.fetchUsers Error, attempting Dexie fallback]',
        err?.message || err
      );

      try {
        const dexieUsers = await dexieDb.users.toArray();
        if (dexieUsers && dexieUsers.length > 0) {
          console.log('[USERS STATE] Received from Dexie cache:', dexieUsers.length, 'users');
          return {
            success: true,
            data: dexieUsers,
            source: 'dexie',
            message: 'Memuat data pengguna dari cache lokal.',
          };
        }
      } catch (dexieErr) {
        console.warn('[ApiService.fetchUsers Dexie error]', dexieErr);
      }

      return {
        success: false,
        data: [],
        source: 'none',
        message:
          'Tidak dapat terhubung ke API HyperCloudHost.',
      };
    }
  }

  /**
   * =========================================================
   * REALISASI DASHBOARD
   * =========================================================
   */

  /**
   * Mengambil seluruh data REALISASI
   * untuk Dashboard.
   */
  static async fetchRealisasiDashboard(): Promise<{
    status: string;
    data: Realisasi[];
    message?: string;
  }> {
    const token =
      this.getAuthToken();

    if (!token) {
      return {
        status: 'error',
        data: [],
        message:
          'Token login tidak ditemukan.',
      };
    }

    try {
      const res =
        await this.executeFetch(
          '/api/realisasi/dashboard',
          {
            method: 'GET',
            headers: {
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!res.ok) {
        return {
          status: 'error',
          data: [],
          message:
            this.formatErrorMessage(
              res.status
            ),
        };
      }

      const json =
        await res.json();

      const rawData =
        Array.isArray(json.data)
          ? json.data
          : [];

      const normalizedData =
        rawData.map(
          (item: any) =>
            normalizeRealisasiRow(
              item
            )
        );

      return {
        status:
          json.status ||
          'success',
        data:
          normalizedData,
        message:
          json.message,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.fetchRealisasiDashboard Error]',
        err
      );

      return {
        status: 'error',
        data: [],
        message:
          'Tidak dapat terhubung ke API Dashboard.',
      };
    }
  }

  /**
   * =========================================================
   * MASTER DATA
   * =========================================================
   */

  /**
   * Fetch Master Data:
   * ULP
   * Penyulang
   * Regu-ROW
   * Petugas
   * Users
   */
  static async fetchMasterData(
    unitId?: string,
    filters: {
      ulp?: string;
      regu?: string;
    } = {}
  ): Promise<{
    ulp: any[];
    penyulang: any[];
    regu: any[];
    petugas: any[];
    users: any[];
  }> {
    const token =
      this.getAuthToken();

    const headers: Record<
      string,
      string
    > = {
      Accept:
        'application/json',
    };

    if (token) {
      headers[
        'Authorization'
      ] = `Bearer ${token}`;
    }

    const query =
      unitId &&
      unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    const masterQuery =
      query || '?unitId=ALL';

    let petugasQuery =
      masterQuery;

    if (filters.ulp) {
      petugasQuery +=
        `&ulp=${encodeURIComponent(filters.ulp)}`;
    }

    if (filters.regu) {
      petugasQuery +=
        `&regu=${encodeURIComponent(filters.regu)}`;
    }

    const [
      ulpRes,
      penyulangRes,
      reguRes,
      petugasRes,
      usersRes,
    ] = await Promise.all([
      this.executeFetch(
        `/api/ulp${masterQuery}`,
        { headers }
      )
        .then((r) =>
          r.ok
            ? r.json()
            : { data: [] }
        )
        .catch(() => ({
          data: [],
        })),

      this.executeFetch(
        `/api/penyulang${masterQuery}`,
        { headers }
      )
        .then((r) =>
          r.ok
            ? r.json()
            : { data: [] }
        )
        .catch(() => ({
          data: [],
        })),

      this.executeFetch(
        `/api/regu-row${masterQuery}`,
        { headers }
      )
        .then((r) =>
          r.ok
            ? r.json()
            : { data: [] }
        )
        .catch(() => ({
          data: [],
        })),

      this.executeFetch(
        `/api/petugas${petugasQuery}`,
        { headers }
      )
        .then((r) =>
          r.ok
            ? r.json()
            : { data: [] }
        )
        .catch(() => ({
          data: [],
        })),

      this.executeFetch(
        `/api/users${masterQuery}`,
        { headers }
      )
        .then((r) =>
          r.ok
            ? r.json()
            : { data: [] }
        )
        .catch(() => ({
          data: [],
        })),
    ]);

    return {
      ulp:
        Array.isArray(
          ulpRes.data
        )
          ? ulpRes.data
          : [],

      penyulang:
        Array.isArray(
          penyulangRes.data
        )
          ? penyulangRes.data
          : [],

      regu:
        Array.isArray(
          reguRes.data
        )
          ? reguRes.data
          : [],

      petugas:
        Array.isArray(
          petugasRes.data
        )
          ? petugasRes.data
          : [],

      users:
        Array.isArray(
          usersRes.data
        )
          ? usersRes.data
          : [],
    };
  }

  /**
   * =========================================================
   * DELETE WORK ORDER
   * =========================================================
   */

  static async deleteWorkOrder(
    id: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const res =
        await this.executeFetch(
          `/api/work-orders/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          }
        );

      if (!res.ok) {
        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err.message,
      };
    }
  }

  /**
   * =========================================================
   * DELETE ABSENSI
   * =========================================================
   */

  static async deleteAbsensi(
    id: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const res =
        await this.executeFetch(
          `/api/absensi/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          }
        );

      if (!res.ok) {
        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err.message,
      };
    }
  }

  /**
   * =========================================================
   * SAVE USER
   * =========================================================
   */

  static async saveUser(
    userData: any
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const res =
        await this.executeFetch(
          '/api/users',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json',
            },
            body:
              JSON.stringify(
                userData
              ),
          }
        );

      if (!res.ok) {
        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err.message,
      };
    }
  }

  /**
   * =========================================================
   * DELETE USER
   * =========================================================
   */

  static async deleteUser(
    id: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const res =
        await this.executeFetch(
          `/api/users/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          }
        );

      if (!res.ok) {
        return {
          success: false,
          message:
            this.formatErrorMessage(
              res.status
            ),
        };
      }

      return {
        success: true,
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err.message,
      };
    }
  }

  /**
   * =========================================================
   * INISIASI UNIT
   * =========================================================
   */

  static async fetchInisiasiUnits(): Promise<{
    success: boolean;
    data: any[];
    source:
      | 'hypercloud'
      | 'cache'
      | 'default';
    message?: string;
  }> {
    try {
      const res =
        await this.executeFetch(
          '/api/inisiasi',
          {
            method: 'GET',
            headers: {
              Accept:
                'application/json',
            },
          }
        );

      if (res.ok) {
        const json =
          await res.json();

        const list =
          Array.isArray(
            json.data
          )
            ? json.data
            : [];

        if (list.length > 0) {
          return {
            success: true,
            data: list,
            source:
              'hypercloud',
            message:
              `Berhasil memuat ${list.length} Unit Layanan dari HyperCloudHost.`,
          };
        }
      }
    } catch (e) {
      console.warn(
        '[ApiService] fetchInisiasiUnits error:',
        e
      );
    }

    return {
      success: false,
      data: [],
      source: 'default',
      message:
        'Gagal memuat Unit Layanan dari HyperCloudHost API',
    };
  }

  /**
   * =========================================================
   * ROW NORMALIZERS
   * =========================================================
   */
  static normalizeUserRow(row: any) {
    return normalizeUser(row);
  }

  static normalizeWorkOrderRow(row: any) {
    return normalizeWorkOrderRow(row);
  }

  static normalizeRealisasiRow(row: any) {
    return normalizeRealisasiRow(row);
  }

  /**
   * =========================================================
   * SAVE & DELETE REGU
   * =========================================================
   */
  static async saveRegu(reguData: any): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.executeFetch('/api/regu-row', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reguData),
      });

      return { success: res.ok };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  static async deleteRegu(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.executeFetch(`/api/regu-row/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      return { success: res.ok };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * =========================================================
   * REKAP PERIOD DATA & TARGETED REPORT DATA
   * =========================================================
   */
  static async fetchRekapPeriodData(
    unitNameOrId: string,
    year: number,
    monthIndex: number
  ) {
    const cleanId = (unitNameOrId || '').toUpperCase().trim();
    const stdId = InisiasiService.getStandardUnitId(cleanId) || (cleanId.startsWith('UL') ? cleanId : 'UL1');
    const monthPadded = String(monthIndex + 1).padStart(2, '0');
    const startDate = `${year}-${monthPadded}-01`;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

    try {
      const woRes = await this.fetchWorkOrders(stdId);
      const relRes = await this.fetchRealisasi({
        unitId: stdId,
        limit: 1000,
        tanggalDari: startDate,
        tanggalSampai: endDate,
      });

      const rawWo = woRes.success && Array.isArray(woRes.data) ? woRes.data : [];
      const rawRel = Array.isArray(relRes?.data) ? relRes.data : [];

      const workOrders = rawWo.map((row: any) => normalizeWorkOrderRow(row));
      const realisasiList = rawRel.map((row: any) => normalizeRealisasiRow(row));

      console.log(`[DB SOURCE] entity=REKAP_PERIOD source=HYPERCLOUD unitId=${stdId} woCount=${workOrders.length} relCount=${realisasiList.length}`);

      return {
        success: true,
        workOrders,
        realisasiList,
        message: `Memuat ${workOrders.length} Work Order dan ${realisasiList.length} Realisasi dari HyperCloud untuk ${monthPadded}/${year}.`,
      };
    } catch (err: any) {
      console.warn('fetchRekapPeriodData exception:', err);
      return {
        success: false,
        workOrders: [],
        realisasiList: [],
        message: err.message || 'Backend HyperCloud tidak dapat dihubungi.',
      };
    }
  }

  static async fetchTargetedReportData(params: {
    jenisLaporan: 'realisasi' | 'work_order' | 'foto' | 'peta';
    unitId?: string;
    ulpName?: string;
    startDate?: string;
    endDate?: string;
    penyulangName?: string;
    reguName?: string;
    nomorWO?: string;
  }) {
    const { unitId, nomorWO, startDate, endDate } = params;
    const stdId = InisiasiService.getStandardUnitId(unitId || '') || 'UL1';

    try {
      const woRes = await this.fetchWorkOrders(stdId);
      const relRes = await this.fetchRealisasi({
        unitId: stdId,
        limit: 1000,
        tanggalDari: startDate,
        tanggalSampai: endDate,
      });

      const rawWo = woRes.success && Array.isArray(woRes.data) ? woRes.data : [];
      const rawRel = Array.isArray(relRes?.data) ? relRes.data : [];

      let workOrders = rawWo.map((row: any) => normalizeWorkOrderRow(row));
      let realisasiList = rawRel.map((row: any) => normalizeRealisasiRow(row));

      if (nomorWO && nomorWO !== 'ALL') {
        const targetWO = nomorWO.toLowerCase().trim();
        workOrders = workOrders.filter((w: any) => (w.nomorWO || '').toLowerCase().includes(targetWO));
        realisasiList = realisasiList.filter((r: any) => (r.nomorWO || '').toLowerCase().includes(targetWO));
      }

      console.log(`[DB SOURCE] entity=TARGETED_REPORT source=HYPERCLOUD unitId=${stdId} woCount=${workOrders.length} relCount=${realisasiList.length}`);

      return {
        success: true,
        realisasi: realisasiList,
        workOrders,
        totalCount: params.jenisLaporan === 'work_order' ? workOrders.length : realisasiList.length,
        source: 'hypercloud' as const,
      };
    } catch (err: any) {
      console.warn('fetchTargetedReportData exception:', err);
      return {
        success: false,
        realisasi: [],
        workOrders: [],
        totalCount: 0,
        source: 'dexie' as const,
      };
    }
  }

  static async fetchAllData(unitId: string) {
    const stdId = InisiasiService.getStandardUnitId(unitId || '') || 'UL1';
    const masterData = await this.fetchMasterData(stdId);
    const woRes = await this.fetchWorkOrders(stdId);
    const relRes = await this.fetchRealisasi({ unitId: stdId, limit: 1000 });

    const rawWo = woRes.success && Array.isArray(woRes.data) ? woRes.data : [];
    const rawRel = Array.isArray(relRes?.data) ? relRes.data : [];

    return {
      masterData,
      workOrders: rawWo.map((row: any) => normalizeWorkOrderRow(row)),
      realisasi: rawRel.map((row: any) => normalizeRealisasiRow(row)),
    };
  }
}