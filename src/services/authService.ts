/**
 * AuthService - Centralized Authentication Service for APHRO
 * 
 * Architecture:
 * AuthService -> HyperCloudHost Node.js API -> PostgreSQL
 */

import { dexieDb, LocalUser } from './dexieDb';
import { User, UserRole } from '../types';
import { normalizeUser } from './syncService';
import { InisiasiService } from './inisiasiService';
import { ApiService } from './apiService';

export class AuthService {
  /**
   * Authenticate user with Username, Password, and target UnitId.
   * 1. Primary: Authenticates against HyperCloudHost Node.js API (/api/login).
   * No client-side database fallback is allowed for credential authentication.
   */
  static async loginWithCredentials(
    username: string, 
    password?: string,
    unitId?: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const resolvedUnitId = unitId || activeInisiasi.id || activeInisiasi.unitId || InisiasiService.getSelectedUnitId();
    const targetUnitId = InisiasiService.getStandardUnitId(resolvedUnitId);

    if (!cleanUsername) {
      return { success: false, error: 'Username atau NIP wajib diisi.' };
    }

    if (!targetUnitId) {
      return { success: false, error: 'Unit belum dipilih. Silakan pilih Unit Layanan terlebih dahulu.' };
    }

    // 1. Primary: HyperCloudHost Node.js API
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const apiRes = await ApiService.login(cleanUsername, cleanPassword, targetUnitId);
        if (apiRes.status === 'success' && apiRes.user && apiRes.token) {
          const rawUser = apiRes.user;
          const newToken = apiRes.token.trim();

          // Pastikan token benar-benar valid JWT dan belum expired
          if (!ApiService.isValidToken(newToken) || ApiService.isTokenExpired(newToken)) {
            return {
              success: false,
              error: 'Server mengembalikan token autentikasi yang tidak valid atau telah kedaluwarsa.',
            };
          }

          // Bersihkan seluruh session & token lama sebelum menyimpan session baru
          this.clearSession();

          // Simpan token baru ke canonical storage segera
          localStorage.setItem('aphro_token', newToken);
          localStorage.setItem('jwt_token', newToken);

          const userUnitId = InisiasiService.getStandardUnitId(rawUser.unitId || rawUser.UnitID || rawUser.unit_id || targetUnitId) || targetUnitId;

          // Automatically sync active unit selection to user's real unit
          if (userUnitId) {
            InisiasiService.saveSelectedUnit(userUnitId);
          }

          const activeUnitObj = InisiasiService.getActiveInisiasiUnit();

          const rawRoleStr = String(rawUser.Role || rawUser.role || rawUser.ROLE || 'User').trim();
          let userRole: UserRole = 'User';
          if (/^super\s*admin$/i.test(rawRoleStr) || rawRoleStr.toLowerCase() === 'superadmin') {
            userRole = 'SuperAdmin';
          } else if (/^adm$/i.test(rawRoleStr) || rawRoleStr.toLowerCase() === 'adm') {
            userRole = 'Adm';
          } else if (/admin/i.test(rawRoleStr) || /admbkt/i.test(rawRoleStr) || /manajer/i.test(rawRoleStr) || /supervisor/i.test(rawRoleStr)) {
            userRole = 'Admin';
          } else {
            userRole = 'User';
          }

          const normalized: User = {
            id: String(rawUser.Id || rawUser.UserID || rawUser.id || `usr-${cleanUsername}`),
            unitId: userUnitId,
            unitName: rawUser.unitName || rawUser.UnitName || activeUnitObj.namaUL,
            nip: String(rawUser.UserID || cleanUsername).toUpperCase(),
            name: String(rawUser.Nama_Regu || rawUser.Username || rawUser.name || cleanUsername),
            userName: String(rawUser.Username || cleanUsername),
            email: `${cleanUsername}@pln.co.id`,
            role: userRole,
            reguName: String(rawUser.Nama_Regu || rawUser.reguName || rawUser.groupWO || rawUser.namaGroupWO || rawUser.Regu || ''),
            groupWO: String(rawUser.Nama_Regu || rawUser.reguName || rawUser.groupWO || rawUser.namaGroupWO || rawUser.Regu || ''),
            namaGroupWO: String(rawUser.Nama_Regu || rawUser.reguName || rawUser.groupWO || rawUser.namaGroupWO || rawUser.Regu || ''),
            Nama_Regu: String(rawUser.Nama_Regu || rawUser.reguName || rawUser.groupWO || rawUser.namaGroupWO || rawUser.Regu || ''),
            ulpName: String(rawUser.ULP || rawUser.ulpName || ''),
            status: rawUser.Status || 'Aktif',
            token: newToken,
          };

          (normalized as any).jwtToken = newToken;

          await this.saveLocalSession(normalized, newToken);
          return { success: true, user: normalized };
        } else {
          const msg = apiRes.message || '';
          const isConnectionError =
            msg.includes('Tidak dapat terhubung') ||
            msg.includes('Failed to fetch') ||
            msg.includes('koneksi');

          if (!isConnectionError) {
            return { success: false, error: msg || 'Gagal login ke HyperCloudHost.' };
          }
        }
      } catch (apiErr: any) {
        console.error('HyperCloudHost API login error:', apiErr);
      }
    }

    // Credential authentication must be authoritative: HyperCloud is the only source of truth.
    // Dexie is still used for cached profile/session data, but it must never authenticate a password.
    return { success: false, error: 'Tidak dapat memverifikasi akun pada Database HyperCloudHost.' };

  }

  /**
   * Save / sync active user profile to Dexie & localStorage.
   * Parameter explicitToken menjamin bahwa token baru dari API login selalu diutamakan
   * dan tidak pernah tertimpa oleh token lama dari cache.
   */
  static async saveLocalSession(user: User, explicitToken?: string): Promise<void> {
    try {
      const candidateToken = (explicitToken || user.token || (user as any).jwtToken || (user as any).accessToken || '').trim();
      let activeToken = '';

      if (candidateToken && ApiService.isValidToken(candidateToken) && !ApiService.isTokenExpired(candidateToken)) {
        activeToken = candidateToken;
      } else {
        const freshToken = ApiService.getAuthToken();
        if (freshToken) {
          activeToken = freshToken;
        }
      }

      if (activeToken) {
        user.token = activeToken;
        (user as any).jwtToken = activeToken;
        localStorage.setItem('aphro_token', activeToken);
        localStorage.setItem('jwt_token', activeToken);
      } else {
        delete user.token;
        delete (user as any).jwtToken;
        delete (user as any).accessToken;
        localStorage.removeItem('aphro_token');
        localStorage.removeItem('jwt_token');
      }

      localStorage.setItem('aphro_user', JSON.stringify(user));
      localStorage.setItem('pln_mobile_user', JSON.stringify(user));
      localStorage.setItem('aphro_has_initiated', 'true');

      if (user.unitId) {
        InisiasiService.saveSelectedUnit(user.unitId);
      }

      await dexieDb.users.put({
        ...user,
        syncStatus: 'SYNCED',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('AuthService saveLocalSession error:', e);
    }
  }

  /**
   * Clear active user session (logout / session expired).
   * Membersihkan kredensial & canonical token tanpa merusak data offline pekerjaan/queue.
   */
  static clearSession(): void {
    try {
      localStorage.removeItem('aphro_user');
      localStorage.removeItem('pln_mobile_user');
      localStorage.removeItem('aphro_token');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('token');
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('aphro_token');
        sessionStorage.removeItem('jwt_token');
      }
    } catch (e) {
      // Ignore
    }
  }
}
