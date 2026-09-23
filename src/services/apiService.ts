import { Realisasi } from '../types';
import { normalizeRealisasiRow } from '../utils/realisasiNormalizer';
import { normalizeAbsensi } from './syncService';

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
  unitId?: string;
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

        if (tok) {
          return tok;
        }
      } catch {
        // Ignore JSON parse error
      }
    }

    return (
      localStorage.getItem('aphro_sys_token') ||
      'system-hypercloud-token'
    );
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
   *
   * PRODUCTION APHRO:
   * https://www.aphro-row.my.id
   *         |
   *         | API
   *         v
   * https://api.aphro-row.my.id
   *
   * Production TIDAK BOLEH menggunakan:
   * https://www.aphro-row.my.id/api/...
   *
   * Local API hanya digunakan jika:
   * VITE_USE_LOCAL_API=true
   * dan aplikasi bukan production APHRO.
   */
  public static async executeFetch(
    pathAndQuery: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const cleanPath = pathAndQuery.startsWith('/')
      ? pathAndQuery
      : `/${pathAndQuery}`;

    const token = this.getAuthToken();

    /**
     * Build headers object.
     */
    const headersObj: Record<string, string> = {};

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

    /**
     * Tambahkan Authorization jika belum diberikan.
     */
    if (!headersObj['Authorization'] && token) {
      headersObj['Authorization'] = `Bearer ${token}`;
    }

    /**
     * Default Accept header.
     */
    if (!headersObj['Accept']) {
      headersObj['Accept'] = 'application/json';
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: headersObj,
    };

    /**
     * =========================================================
     * HYPERCLOUD API
     * =========================================================
     */
    const externalBase = this.getCleanBaseUrl();

    const externalUrl =
      `${externalBase}` +
      `${
        cleanPath.startsWith('/api')
          ? cleanPath
          : `/api${cleanPath}`
      }`;

    /**
     * Deteksi hostname browser.
     */
    const hostname =
      typeof window !== 'undefined'
        ? window.location.hostname
        : '';

    /**
     * Domain production APHRO.
     */
    const isAphroProduction =
      hostname === 'www.aphro-row.my.id' ||
      hostname === 'aphro-row.my.id';

    /**
     * Local API hanya boleh digunakan:
     *
     * 1. VITE_USE_LOCAL_API=true
     * 2. bukan production APHRO
     */
    const allowLocalApi =
      import.meta.env.VITE_USE_LOCAL_API === 'true' &&
      !isAphroProduction;

    /**
     * =========================================================
     * PRODUCTION
     * =========================================================
     *
     * Jika aplikasi berjalan di:
     *
     * https://www.aphro-row.my.id
     *
     * langsung gunakan:
     *
     * https://api.aphro-row.my.id
     */
    if (!allowLocalApi) {
      console.log(
        `[ApiService] Using HyperCloud API: ${externalUrl}`
      );

      return fetch(
        externalUrl,
        requestOptions
      );
    }

    /**
     * =========================================================
     * LOCAL DEVELOPMENT
     * =========================================================
     */
    const host =
      typeof window !== 'undefined' &&
      window.location
        ? window.location.origin
        : '';

    const localUrl =
      `${host}` +
      `${
        cleanPath.startsWith('/api')
          ? cleanPath
          : `/api${cleanPath}`
      }`;

    try {
      console.log(
        `[ApiService] Using local API: ${localUrl}`
      );

      const res = await fetch(
        localUrl,
        requestOptions
      );

      /**
       * Local API hanya dianggap berhasil
       * jika HTTP status 2xx/3xx.
       *
       * Jika 400/401/403/404/500,
       * coba HyperCloudHost.
       */
      if (res.ok) {
        return res;
      }

      console.warn(
        `[ApiService] Local API returned HTTP ${res.status}. ` +
          `Falling back to HyperCloudHost: ${externalUrl}`
      );

      return fetch(
        externalUrl,
        requestOptions
      );
    } catch (localErr) {
      console.warn(
        `[ApiService] Local API failed: ${localUrl}`,
        localErr
      );

      console.log(
        `[ApiService] Falling back to HyperCloudHost: ${externalUrl}`
      );

      return fetch(
        externalUrl,
        requestOptions
      );
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
                Username:
                  cleanUsername,
                Password:
                  cleanPassword,
                unitId:
                  cleanUnitId,
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
    message?: string;
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

      console.log(
        `[ApiService] fetchUsers success: found ${list.length} users`
      );

      return {
        success: true,
        data: list,
      };
    } catch (err: any) {
      console.error(
        '[ApiService.fetchUsers Error]',
        err
      );

      return {
        success: false,
        data: [],
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
}