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
        return (
          parsed.token ||
          parsed.jwtToken ||
          parsed.accessToken ||
          parsed.token_jwt ||
          ''
        );
      } catch {
        return '';
      }
    }

    return '';
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
      response = await fetch(url, {
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

    const url = `${this.getCleanBaseUrl()}/api/realisasi`;

    try {
      const res = await fetch(url, {
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

    const url = `${this.getCleanBaseUrl()}/api/realisasi/${encodeURIComponent(id)}`;

    try {
      const res = await fetch(url, {
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

    const url = `${this.getCleanBaseUrl()}/api/realisasi/${encodeURIComponent(id)}`;

    try {
      const res = await fetch(url, {
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
    const url = `${this.getCleanBaseUrl()}/api/work-orders${query}`;

    try {
      const res = await fetch(url, {
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

    const url = `${this.getCleanBaseUrl()}/api/work-orders`;

    try {
      const res = await fetch(url, {
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
    const url = `${this.getCleanBaseUrl()}/api/absensi${query}`;

    try {
      const res = await fetch(url, {
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

    const url = `${this.getCleanBaseUrl()}/api/absensi`;

    try {
      const res = await fetch(url, {
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
}
