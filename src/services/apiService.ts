import { Realisasi } from '../types';
import { normalizeRealisasiRow } from '../utils/realisasiNormalizer';
import { normalizeWorkOrderRow } from '../utils/workOrderNormalizer';
import { normalizeUser, normalizeAbsensi, normalizeULP, normalizePenyulang, normalizeRegu, normalizePetugas } from './syncService';
import { InisiasiService, DEFAULT_UL_OPTIONS } from './inisiasiService';
import { dexieDb } from './dexieDb';
import { getWIBDateString, getLocalDateTimeString } from '../utils/dateUtils';

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
   * Helper klasifikasi kode error HTTP ke reason string terstandarisasi.
   */
  public static classifyErrorReason(status: number, serverError?: string): string {
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) {
      if (serverError === 'ROUTE_NOT_FOUND') return 'ROUTE_NOT_FOUND';
      if (serverError && (serverError.endsWith('_NOT_FOUND') || serverError === 'RECORD_NOT_FOUND')) {
        return 'RECORD_NOT_FOUND';
      }
      return 'ENDPOINT_NOT_FOUND';
    }
    if (status === 409) return 'CONFLICT';
    if (status === 422) return 'VALIDATION_ERROR';
    if (status === 502 || status === 503) return 'UPSTREAM_UNAVAILABLE';
    if (status >= 500) return 'SERVER_ERROR';
    return `HTTP_${status}`;
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

    const targetUnitId = (unitId && unitId.trim() !== '' ? unitId : InisiasiService.getSelectedUnitId()).trim();
    if (targetUnitId && targetUnitId !== 'ALL') {
      queryParams.set('unitId', targetUnitId);
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
    const token = this.getAuthToken();

    if (!token) {
      console.warn('[SYNC] Cannot save REALISASI: JWT token not available.');
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const unitId = data.unitId ? InisiasiService.getStandardUnitId(data.unitId) : InisiasiService.getSelectedUnitId();
    const payload = {
      id: data.id || data.realisasiId,
      realisasiId: data.id || data.realisasiId,
      woId: data.workOrderId || data.woId || '',
      workOrderId: data.workOrderId || data.woId || '',
      nomorWO: data.nomorWO || '',
      unitId: unitId,
      ULP: data.ulpName || data.ULP || '',
      ulpName: data.ulpName || data.ULP || '',
      regu: data.reguName || data.regu || data.REGU_ROW || '',
      reguName: data.reguName || data.regu || data.REGU_ROW || '',
      penyulang: data.penyulangName || data.penyulang || data.PENYULANG || '',
      penyulangName: data.penyulangName || data.penyulang || data.PENYULANG || '',
      noTiang: data.noTiang || data.NO_TIANG || '',
      tanggalRealisasi: data.tanggalRealisasi || data.tanggal || data.TANGGAL || getWIBDateString(),
      fotoSebelum: data.fotoSebelumUrl || data.fotoSebelum || '',
      fotoSesudah: data.fotoSesudahUrl || data.fotoSesudah || '',
      fotoSebelumUrl: data.fotoSebelumUrl || data.fotoSebelum || '',
      fotoSesudahUrl: data.fotoSesudahUrl || data.fotoSesudah || '',
      jenisTanaman: data.jenisTanaman || '',
      lokasiKerja: data.lokasiKerja || '',
      keterangan: data.keterangan || 'TEBANG',
      pertumbuhanTanaman: data.pertumbuhanTanaman || '',
      kendala: data.kendala || '',
      latitude: Number(data.latitude || 0),
      longitude: Number(data.longitude || 0),
      petugas: data.petugasName || data.petugas || '',
      petugasId: data.petugasId || '',
      petugasName: data.petugasName || data.petugas || '',
      progressPercent: 100,
      status: 'Selesai',
    };

    console.log('[SYNC] ONLINE');
    console.log(`[SYNC] Sending REALISASI to HyperCloud: POST /api/realisasi (unitId=${unitId}, JWT=AVAILABLE, id=${payload.id})`);

    try {
      const res = await this.executeFetch('/api/realisasi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }

        const errReason = ApiService.classifyErrorReason(res.status);
        console.warn(`[SYNC] FAILED endpoint=/api/realisasi HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'} record kept as PENDING`);
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      const json = await res.json().catch(() => ({}));
      const finalServerId = json.id || json.data?.id || payload.id;
      console.log(`[SYNC] HTTP ${res.status} - REALISASI saved to HyperCloud (ID: ${finalServerId})`);

      return {
        success: true,
        serverId: finalServerId,
        message: json.message,
      };
    } catch (err: any) {
      console.warn(`[SYNC] FAILED endpoint=/api/realisasi reason=${err?.message || 'Network error'} record kept as PENDING`);
      return {
        success: false,
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
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
    const token = this.getAuthToken();

    if (!token) {
      console.warn('[SYNC] Cannot update REALISASI: JWT token not available.');
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const unitId = data.unitId ? InisiasiService.getStandardUnitId(data.unitId) : InisiasiService.getSelectedUnitId();
    const payload = {
      ...data,
      unitId,
    };

    console.log('[SYNC] ONLINE');
    console.log(`[SYNC] Updating REALISASI to HyperCloud: PUT /api/realisasi/${id} (unitId=${unitId}, JWT=AVAILABLE)`);

    try {
      const res = await this.executeFetch(`/api/realisasi/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }

        const errReason = ApiService.classifyErrorReason(res.status);
        console.warn(`[SYNC] FAILED endpoint=/api/realisasi/${id} HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'} record kept as PENDING`);
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      console.log(`[SYNC] HTTP ${res.status} - REALISASI updated in HyperCloud (ID: ${id})`);
      return {
        success: true,
      };
    } catch (err: any) {
      console.warn(`[SYNC] FAILED endpoint=/api/realisasi/${id} reason=${err?.message || 'Network error'} record kept as PENDING`);
      return {
        success: false,
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
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
        let serverMsg: string | undefined;
        let serverError: string | undefined;

        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
          serverError = errJson?.error;
        } catch {
          // ignore
        }

        const errReason = ApiService.classifyErrorReason(res.status, serverError);
        console.warn(`[SYNC] FAILED endpoint=/api/realisasi/${id} HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'}`);

        // IDEMPOTENCY: If record is already gone on server, consider delete satisfied
        if (res.status === 404 && serverError !== 'ROUTE_NOT_FOUND') {
          console.log(`[SYNC] Realisasi ${id} already removed from HyperCloud. Considering DELETE satisfied.`);
          return {
            success: true,
            message: 'Realisasi sudah tidak ada di server.',
          };
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
   * Save Work Order directly to HyperCloud PostgreSQL.
   */
  static async saveWorkOrder(
    data: any
  ): Promise<{
    success: boolean;
    serverId?: string;
    message?: string;
  }> {
    const token = this.getAuthToken();

    if (!token) {
      console.warn('[SYNC] Cannot save WORK_ORDER: JWT token not available.');
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const unitId = data.unitId ? InisiasiService.getStandardUnitId(data.unitId) : InisiasiService.getSelectedUnitId();
    const payload = {
      id: data.id || data.WO_ID,
      WO_ID: data.WO_ID || data.id,
      woId: data.woId || data.WO_ID || data.id,
      unitId: unitId,
      nomorWO: data.nomorWO || data.Nomor_WO || '',
      Nomor_WO: data.Nomor_WO || data.nomorWO || '',
      tanggal: data.tanggal || data.Tanggal || getWIBDateString(),
      Tanggal: data.Tanggal || data.tanggal || getWIBDateString(),
      ulpName: data.ulpName || data.ULP || '',
      ULP: data.ULP || data.ulpName || '',
      penyulangName: data.penyulangName || data.Penyulang || '',
      Penyulang: data.Penyulang || data.penyulangName || '',
      reguName: data.reguName || data.Regu_ROW || data.regu || '',
      Regu_ROW: data.Regu_ROW || data.reguName || data.regu || '',
      pekerjaan: data.pekerjaan || data.PEKERJAAN || 'NORMAL',
      PEKERJAAN: data.PEKERJAAN || data.pekerjaan || 'NORMAL',
      volumePekerjaan: Number(data.volumePekerjaan || data.VOLUME || 0),
      VOLUME: String(data.VOLUME || data.volumePekerjaan || 0),
      satuan: data.satuan || data.SATUAN || 'KMS',
      SATUAN: data.SATUAN || data.satuan || 'KMS',
      woMulai: data.woMulai || data.WO_AWAL || null,
      WO_AWAL: data.WO_AWAL || data.woMulai || null,
      woAkhir: data.woAkhir || data.WO_AKHIR || null,
      WO_AKHIR: data.WO_AKHIR || data.woAkhir || null,
      status: (data.status || data.STATUS || 'Belum Dikerjakan').toUpperCase(),
      STATUS: (data.STATUS || data.status || 'Belum Dikerjakan').toUpperCase(),
      totalRealisasi: Number(data.totalRealisasi || data.TOTAL_REALISASI || 0),
      TOTAL_REALISASI: String(data.TOTAL_REALISASI || data.totalRealisasi || 0),
      satuanTotalRealisasi: data.satuanTotalRealisasi || data.SATUAN_TOTAL_REALISASI || 'KMS',
      SATUAN_TOTAL_REALISASI: data.SATUAN_TOTAL_REALISASI || data.satuanTotalRealisasi || 'KMS',
      createdAt: data.createdAt || data.Created_At || getLocalDateTimeString(),
      Created_At: data.Created_At || data.createdAt || getLocalDateTimeString(),
    };

    console.log('[WORK ORDER REQUEST]', {
      woId: payload.WO_ID,
      nomorWO: payload.Nomor_WO,
      unitId: payload.unitId,
      ulp: payload.ULP,
      penyulang: payload.Penyulang,
      regu: payload.Regu_ROW,
      tanggal: payload.Tanggal,
    });

    console.log('[SYNC] ONLINE');
    console.log(`[SYNC] Sending WORK_ORDER to HyperCloud: POST /api/work-orders (unitId=${unitId}, JWT=AVAILABLE, id=${payload.id})`);

    try {
      const res = await this.executeFetch('/api/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }

        const errReason = ApiService.classifyErrorReason(res.status);
        if (res.status === 401) {
          console.warn(`[WORK ORDER SYNC]\nstatus=FAILED\nreason=UNAUTHORIZED\nhttp=401`);
        } else {
          console.warn(`[WORK ORDER SYNC]\nstatus=FAILED\nhttp=${res.status}\nreason=${errReason}\ndetail=${serverMsg || 'None'}`);
        }

        console.warn(`[SYNC] FAILED endpoint=/api/work-orders HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'} record kept as PENDING`);
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      console.log(`[WORK ORDER SYNC]\nstatus=SUCCESS\nhttp=${res.status}\nwoId=${payload.id}`);
      console.log(`[SYNC] HTTP ${res.status} - WORK_ORDER saved to HyperCloud (ID: ${payload.id})`);
      return {
        success: true,
        serverId: payload.id,
      };
    } catch (err: any) {
      console.warn(`[WORK ORDER SYNC]\nstatus=FAILED\nreason=NETWORK_ERROR\nmessage=${err?.message || 'Network error'}`);
      console.warn(`[SYNC] FAILED endpoint=/api/work-orders reason=${err?.message || 'Network error'} record kept as PENDING`);
      return {
        success: false,
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
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
    const token = this.getAuthToken();

    if (!token) {
      console.warn('[SYNC] Cannot update WORK_ORDER: JWT token not available.');
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const unitId = data.unitId ? InisiasiService.getStandardUnitId(data.unitId) : InisiasiService.getSelectedUnitId();
    const payload = {
      ...data,
      unitId,
    };

    console.log('[SYNC] ONLINE');
    console.log(`[SYNC] Updating WORK_ORDER to HyperCloud: PUT /api/work-orders/${id} (unitId=${unitId}, JWT=AVAILABLE)`);

    try {
      const res = await this.executeFetch(`/api/work-orders/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }

        const errReason = ApiService.classifyErrorReason(res.status);
        console.warn(`[SYNC] FAILED endpoint=/api/work-orders/${id} HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'} record kept as PENDING`);
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      console.log(`[SYNC] HTTP ${res.status} - WORK_ORDER updated in HyperCloud (ID: ${id})`);
      return {
        success: true,
      };
    } catch (err: any) {
      console.warn(`[SYNC] FAILED endpoint=/api/work-orders/${id} reason=${err?.message || 'Network error'} record kept as PENDING`);
      return {
        success: false,
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
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
   * Save Absensi directly to HyperCloud PostgreSQL.
   */
  static async saveAbsensi(
    data: any
  ): Promise<{
    success: boolean;
    serverId?: string;
    message?: string;
  }> {
    const token = this.getAuthToken();

    if (!token) {
      console.warn('[SYNC] Cannot save ABSENSI: JWT token not available.');
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const unitId = data.unitId ? InisiasiService.getStandardUnitId(data.unitId) : InisiasiService.getSelectedUnitId();
    const payload = {
      id: data.id || `ABS-${Date.now()}`,
      unitId: unitId,
      tanggal: data.tanggal || data.TANGGAL || getWIBDateString(),
      TANGGAL: data.TANGGAL || data.tanggal || getWIBDateString(),
      ulpName: data.ulpName || data.ULP || '',
      ULP: data.ULP || data.ulpName || '',
      reguName: data.reguName || data.NAMA_REGU || data.REGU_ROW || '',
      NAMA_REGU: data.NAMA_REGU || data.reguName || data.REGU_ROW || '',
      petugasList: data.petugasList || data.PETUGAS || [],
      PETUGAS: data.PETUGAS || data.petugasList || [],
      fotoMasuk: data.fotoMasuk || data.FOTO_MASUK || '',
      FOTO_MASUK: data.FOTO_MASUK || data.fotoMasuk || '',
      timestampMasuk: data.timestampMasuk || data.TIMESTAMP_MASUK || '',
      TIMESTAMP_MASUK: data.TIMESTAMP_MASUK || data.timestampMasuk || '',
      fotoKeluar: data.fotoKeluar || data.FOTO_KELUAR || '',
      FOTO_KELUAR: data.FOTO_KELUAR || data.fotoKeluar || '',
      timestampKeluar: data.timestampKeluar || data.TIMESTAMP_KELUAR || '',
      TIMESTAMP_KELUAR: data.TIMESTAMP_KELUAR || data.timestampKeluar || '',
      latitude: Number(data.latitude || data.LATITUDE || 0),
      LATITUDE: Number(data.LATITUDE || data.latitude || 0),
      longitude: Number(data.longitude || data.LONGITUDE || 0),
      LONGITUDE: Number(data.LONGITUDE || data.longitude || 0),
      createdAt: data.createdAt || data.CREATED_AT || getLocalDateTimeString(),
      CREATED_AT: data.CREATED_AT || data.createdAt || getLocalDateTimeString(),
    };

    console.log('[SYNC] ONLINE');
    console.log(`[SYNC] Sending ABSENSI to HyperCloud: POST /api/absensi (unitId=${unitId}, JWT=AVAILABLE, id=${payload.id})`);

    try {
      const res = await this.executeFetch('/api/absensi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }

        const errReason = ApiService.classifyErrorReason(res.status);
        console.warn(`[SYNC] FAILED endpoint=/api/absensi HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'} record kept as PENDING`);
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      console.log(`[SYNC] HTTP ${res.status} - ABSENSI saved to HyperCloud (ID: ${payload.id})`);
      return {
        success: true,
        serverId: payload.id,
      };
    } catch (err: any) {
      console.warn(`[SYNC] FAILED endpoint=/api/absensi reason=${err?.message || 'Network error'} record kept as PENDING`);
      return {
        success: false,
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
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
    const token = this.getAuthToken();

    if (!token) {
      console.warn('[SYNC] Cannot update ABSENSI: JWT token not available.');
      return {
        success: false,
        message: 'Token login tidak ditemukan. Silakan login kembali.',
      };
    }

    const unitId = data.unitId ? InisiasiService.getStandardUnitId(data.unitId) : InisiasiService.getSelectedUnitId();
    const payload = {
      ...data,
      unitId,
    };

    console.log('[SYNC] ONLINE');
    console.log(`[SYNC] Updating ABSENSI to HyperCloud: PUT /api/absensi/${id} (unitId=${unitId}, JWT=AVAILABLE)`);

    try {
      const res = await this.executeFetch(`/api/absensi/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // ignore
        }

        const errReason = ApiService.classifyErrorReason(res.status);
        console.warn(`[SYNC] FAILED endpoint=/api/absensi/${id} HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'} record kept as PENDING`);
        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      console.log(`[SYNC] HTTP ${res.status} - ABSENSI updated in HyperCloud (ID: ${id})`);
      return {
        success: true,
      };
    } catch (err: any) {
      console.warn(`[SYNC] FAILED endpoint=/api/absensi/${id} reason=${err?.message || 'Network error'} record kept as PENDING`);
      return {
        success: false,
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
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
   * Fetch users from HyperCloud API.
   */
  static async fetchUsers(
    unitId?: string
  ): Promise<{
    success: boolean;
    data: any[];
    source?: 'hypercloud' | 'dexie' | 'none';
    message?: string;
  }> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`[INIT USERS AUTH] authenticated=${Boolean(token)} tokenPresent=${Boolean(token)} endpoint=/api/users`);

    const query =
      unitId && unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    try {
      console.log(`[INIT USERS TRACE] action=FETCH source=HYPERCLOUD endpoint=/api/users${query}`);

      const res = await this.executeFetch(`/api/users${query}`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
        } catch {
          // Ignore
        }

        console.warn(`[INIT USERS TRACE] FAILED HTTP=${res.status} reason=${serverMsg || 'Server Error'}`);

        // If 404
        if (res.status === 404) {
          return {
            success: false,
            data: [],
            source: 'none',
            message: 'Endpoint /api/users tidak ditemukan di server HyperCloud.',
          };
        }

        // On HTTP 401/403 or online error: DO NOT fallback to Dexie cache!
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline || res.status === 401 || res.status === 403) {
          return {
            success: false,
            data: [],
            source: 'none',
            message: this.formatErrorMessage(res.status, serverMsg),
          };
        }

        // Offline mode only fallback
        const dexieUsers = await dexieDb.users.toArray().catch(() => []);
        if (dexieUsers && dexieUsers.length > 0) {
          console.log('[USERS STATE] Received from Dexie cache (Offline Mode):', dexieUsers.length, 'users');
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
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      const list = rawList.map(normalizeUser);
      const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      console.log(`[INIT USERS TRACE]\nrequestId=${requestId}\nunitId=${unitId || 'ALL'}\nsource=HYPERCLOUD\nstatus=SUCCESS\ncount=${list.length}`);
      console.log('[USERS STATE] Received from HyperCloud:', list.length, 'users');

      return {
        success: true,
        data: list,
        source: 'hypercloud',
      };
    } catch (err: any) {
      console.warn('[ApiService.fetchUsers Exception]', err?.message || err);

      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      if (!isOnline) {
        try {
          const dexieUsers = await dexieDb.users.toArray();
          if (dexieUsers && dexieUsers.length > 0) {
            console.log('[USERS STATE] Received from Dexie cache (Offline Mode):', dexieUsers.length, 'users');
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
      }

      return {
        success: false,
        data: [],
        source: 'none',
        message: 'Tidak dapat terhubung ke API HyperCloudHost. Periksa koneksi internet atau server API.',
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
    isAuthError?: boolean;
    status?: number;
  }> {
    const token = this.getAuthToken();

    if (!token) {
      console.warn('[ApiService] fetchMasterData aborted: JWT token missing.');
      return {
        ulp: [],
        penyulang: [],
        regu: [],
        petugas: [],
        users: [],
        isAuthError: true,
        status: 401,
      };
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const query =
      unitId && unitId !== 'ALL'
        ? `?unitId=${encodeURIComponent(unitId)}`
        : '';

    const masterQuery = query || '?unitId=ALL';

    let petugasQuery = masterQuery;

    if (filters.ulp) {
      petugasQuery += `&ulp=${encodeURIComponent(filters.ulp)}`;
    }

    if (filters.regu) {
      petugasQuery += `&regu=${encodeURIComponent(filters.regu)}`;
    }

    const safeFetch = async (url: string) => {
      try {
        const r = await this.executeFetch(url, { headers });
        if (r.status === 401 || r.status === 403) {
          return { data: [], isAuthError: true, status: r.status };
        }
        if (r.ok) {
          const json = await r.json();
          return { data: Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [], status: 200 };
        }
        return { data: [], status: r.status };
      } catch {
        return { data: [], status: 500 };
      }
    };

    const [ulpRes, penyulangRes, reguRes, petugasRes, usersRes] = await Promise.all([
      safeFetch(`/api/ulp${masterQuery}`),
      safeFetch(`/api/penyulang${masterQuery}`),
      safeFetch(`/api/regu-row${masterQuery}`),
      safeFetch(`/api/petugas${petugasQuery}`),
      safeFetch(`/api/users${masterQuery}`),
    ]);

    const isAuthError =
      ulpRes.isAuthError ||
      penyulangRes.isAuthError ||
      reguRes.isAuthError ||
      petugasRes.isAuthError ||
      usersRes.isAuthError;

    if (isAuthError) {
      return {
        ulp: [],
        penyulang: [],
        regu: [],
        petugas: [],
        users: [],
        isAuthError: true,
        status: 401,
      };
    }

    return {
      ulp: ulpRes.data.map(normalizeULP),
      penyulang: penyulangRes.data.map(normalizePenyulang),
      regu: reguRes.data.map(normalizeRegu),
      petugas: petugasRes.data.map(normalizePetugas),
      users: usersRes.data.map(normalizeUser),
      isAuthError: false,
      status: 200,
    };
  }

  /**
   * =========================================================
   * DELETE WORK ORDER
   * =========================================================
   */

  static async deleteWorkOrder(
    id: string,
    unitId?: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token = this.getAuthToken();
    const query = unitId ? `?unitId=${encodeURIComponent(unitId)}` : '';
    console.log(`[SYNC] Sending DELETE WORK_ORDER to HyperCloud: DELETE /api/work-orders/${id}`);

    try {
      const res = await this.executeFetch(
        `/api/work-orders/${encodeURIComponent(id)}${query}`,
        {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!res.ok) {
        let serverMsg: string | undefined;
        let serverError: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
          serverError = errJson?.error;
        } catch {
          // ignore
        }
        const errReason = ApiService.classifyErrorReason(res.status, serverError);
        console.warn(`[SYNC] FAILED endpoint=/api/work-orders/${id} HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'}`);

        // IDEMPOTENCY: If record is already deleted from server (404 WORK_ORDER_NOT_FOUND / RECORD_NOT_FOUND)
        if (res.status === 404 && serverError !== 'ROUTE_NOT_FOUND') {
          console.log(`[SYNC] Work Order ${id} was already removed from HyperCloud. Considering DELETE satisfied.`);
          return {
            success: true,
            message: 'Work Order sudah tidak ada di server.',
          };
        }

        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      console.log(`[SYNC] HTTP ${res.status} - WORK_ORDER deleted from HyperCloud (ID: ${id})`);
      return {
        success: true,
      };
    } catch (err: any) {
      console.warn(`[SYNC] FAILED endpoint=/api/work-orders/${id} reason=${err.message}`);
      return {
        success: false,
        message: err.message,
      };
    }
  }

  /**
   * =========================================================
   * DELETE ABSENSI
   * =========================================================
   */

  static async deleteAbsensi(
    id: string,
    unitId?: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const token = this.getAuthToken();
    const query = unitId ? `?unitId=${encodeURIComponent(unitId)}` : '';
    console.log(`[SYNC] Sending DELETE ABSENSI to HyperCloud: DELETE /api/absensi/${id}`);

    try {
      const res = await this.executeFetch(
        `/api/absensi/${encodeURIComponent(id)}${query}`,
        {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!res.ok) {
        let serverMsg: string | undefined;
        let serverError: string | undefined;
        try {
          const errJson = await res.json();
          serverMsg = errJson?.message;
          serverError = errJson?.error;
        } catch {
          // ignore
        }
        const errReason = ApiService.classifyErrorReason(res.status, serverError);
        console.warn(`[SYNC] FAILED endpoint=/api/absensi/${id} HTTP=${res.status} reason=${errReason} detail=${serverMsg || 'None'}`);

        // IDEMPOTENCY: If record is already deleted from server (404 ABSENSI_NOT_FOUND / RECORD_NOT_FOUND)
        if (res.status === 404 && serverError !== 'ROUTE_NOT_FOUND') {
          console.log(`[SYNC] Absensi ${id} was already removed from HyperCloud. Considering DELETE satisfied.`);
          return {
            success: true,
            message: 'Data absensi sudah tidak ada di server.',
          };
        }

        return {
          success: false,
          message: this.formatErrorMessage(res.status, serverMsg),
        };
      }

      console.log(`[SYNC] HTTP ${res.status} - ABSENSI deleted from HyperCloud (ID: ${id})`);
      return {
        success: true,
      };
    } catch (err: any) {
      console.warn(`[SYNC] FAILED endpoint=/api/absensi/${id} reason=${err.message}`);
      return {
        success: false,
        message: err.message,
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
   * INISIASI PRE-LOGIN DATA
   * =========================================================
   * Public pre-login endpoint to fetch safe Inisiasi accounts
   * and units WITHOUT requiring JWT.
   */
  static async fetchInisiasi(unitId?: string): Promise<{
    success: boolean;
    data: any[];
    source: 'hypercloud' | 'none';
    http?: number;
    reason?: string;
    message?: string;
  }> {
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const targetUnitId = unitId || 'ALL';
    const query = targetUnitId && targetUnitId !== 'ALL' ? `?unitId=${encodeURIComponent(targetUnitId)}` : '';
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const startedAt = new Date().toISOString();

    if (isOnline) {
      try {
        const res = await this.executeFetch(`/api/inisiasi${query}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        const completedAt = new Date().toISOString();

        if (res.ok) {
          const json = await res.json();
          const rawList = Array.isArray(json?.users) ? json.users : Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          const list = rawList.map(normalizeUser);

          console.log(`[INIT USERS TRACE]\nrequestId=${requestId}\nunitId=${targetUnitId}\naction=FETCH_INIT\nsource=HYPERCLOUD\nendpoint=/api/inisiasi\nstatus=SUCCESS\nhttp=${res.status}\nstartedAt=${startedAt}\ncompletedAt=${completedAt}\ncount=${list.length}`);

          return {
            success: true,
            data: list,
            source: 'hypercloud',
            http: res.status,
            message: `Berhasil memuat ${list.length} akun inisiasi dari HyperCloud.`,
          };
        } else {
          let serverMsg = '';
          try {
            const errJson = await res.json();
            serverMsg = errJson?.message || '';
          } catch {
            // Ignore
          }

          let reason = 'HTTP_ERROR';
          if (res.status === 404) {
            reason = 'ENDPOINT_NOT_FOUND';
          } else if (res.status === 401) {
            reason = 'UNAUTHORIZED';
          } else if (res.status >= 500) {
            reason = 'SERVER_ERROR';
          }

          const errorMsg = res.status === 404 
            ? 'Endpoint /api/inisiasi tidak ditemukan pada backend HyperCloud'
            : (serverMsg || `HyperCloud mengembalikan status HTTP ${res.status}`);

          console.warn(`[INIT USERS TRACE]\nrequestId=${requestId}\nunitId=${targetUnitId}\naction=FETCH_INIT\nsource=HYPERCLOUD\nendpoint=/api/inisiasi\nstatus=FAILED\nhttp=${res.status}\nreason=${reason}\nstartedAt=${startedAt}\ncompletedAt=${completedAt}\nmessage=${errorMsg}`);

          return {
            success: false,
            data: [],
            source: 'none',
            http: res.status,
            reason,
            message: errorMsg,
          };
        }
      } catch (err: any) {
        const completedAt = new Date().toISOString();
        console.warn(`[INIT USERS TRACE]\nrequestId=${requestId}\nunitId=${targetUnitId}\naction=FETCH_INIT\nsource=HYPERCLOUD\nendpoint=/api/inisiasi\nstatus=FAILED\nhttp=0\nreason=NETWORK_ERROR\nstartedAt=${startedAt}\ncompletedAt=${completedAt}\nmessage=${err?.message || 'Network request failed'}`);

        return {
          success: false,
          data: [],
          source: 'none',
          http: 0,
          reason: 'NETWORK_ERROR',
          message: err?.message || 'Tidak dapat terhubung ke server HyperCloud.',
        };
      }
    }

    // Truly offline mode only
    return {
      success: false,
      data: [],
      source: 'none',
      reason: 'OFFLINE',
      message: 'Perangkat sedang dalam mode offline.',
    };
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
    return {
      success: true,
      data: DEFAULT_UL_OPTIONS,
      source: 'hypercloud',
      message: `Berhasil memuat ${DEFAULT_UL_OPTIONS.length} Unit Layanan PLN.`,
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