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
    const targetUnitId = InisiasiService.getStandardUnitId(unitId || InisiasiService.getActiveInisiasiUnit().unitId);

    if (!cleanUsername) {
      return { success: false, error: 'Username atau NIP wajib diisi.' };
    }

    // 1. Primary: HyperCloudHost Node.js API
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const apiRes = await ApiService.login(cleanUsername, cleanPassword, targetUnitId);
        if (apiRes.status === 'success' && apiRes.user) {
          const rawUser = apiRes.user;
          const userUnitId = InisiasiService.getStandardUnitId(rawUser.unitId || rawUser.UnitID || rawUser.unit_id || targetUnitId) || targetUnitId;

          // Automatically sync active unit selection to user's real unit
          if (userUnitId) {
            InisiasiService.saveSelectedUnit(userUnitId);
          }

          const activeUnitObj = InisiasiService.getActiveInisiasiUnit();

          const normalized: User = {
            id: String(rawUser.Id || rawUser.UserID || rawUser.id || `usr-${cleanUsername}`),
            unitId: userUnitId,
            unitName: rawUser.unitName || rawUser.UnitName || activeUnitObj.namaUL,
            nip: String(rawUser.UserID || cleanUsername).toUpperCase(),
            name: String(rawUser.Nama_Regu || rawUser.Username || rawUser.name || cleanUsername),
            userName: String(rawUser.Username || cleanUsername),
            email: `${cleanUsername}@pln.co.id`,
            role: (rawUser.Role || 'User') as UserRole,
            reguName: String(rawUser.Nama_Regu || rawUser.reguName || ''),
            ulpName: String(rawUser.ULP || rawUser.ulpName || ''),
            status: rawUser.Status || 'Aktif',
          };

          (normalized as any).token = apiRes.token;

          await this.saveLocalSession(normalized);
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
   * Save / sync active user profile to Dexie & localStorage
   */
  static async saveLocalSession(user: User): Promise<void> {
    try {
      localStorage.setItem('aphro_user', JSON.stringify(user));
      localStorage.setItem('pln_mobile_user', JSON.stringify(user));
      localStorage.setItem('aphro_has_initiated', 'true');

      if (user.unitId) {
        InisiasiService.saveSelectedUnit(user.unitId);
      }

      const token = (user as any).token || (user as any).jwtToken || (user as any).accessToken;
      if (token) {
        localStorage.setItem('aphro_token', token);
        localStorage.setItem('jwt_token', token);
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
   * Clear active user session
   */
  static clearSession(): void {
    try {
      localStorage.removeItem('aphro_user');
      localStorage.removeItem('pln_mobile_user');
      localStorage.removeItem('aphro_token');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('token');
    } catch (e) {
      // Ignore
    }
  }
}
