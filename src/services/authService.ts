/**
 * AuthService - Centralized Authentication Service for APHRO
 * 
 * Architecture:
 * AuthService -> Supabase (USERS table) + Dexie (Local fallback for offline login)
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
   * 2. Secondary fallback: Authenticates against Supabase "USERS" table if needed.
   * 3. Offline fallback: Dexie local database for the unit.
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

    // 2. Offline / Local fallback check in Dexie local cache
    try {
      const localUsers = await dexieDb.users.toArray();
      const matchedLocal = localUsers.find((u) => {
        const matchName =
          (u.userName || '').trim().toLowerCase() === cleanUsername ||
          (u.nip || '').trim().toLowerCase() === cleanUsername ||
          (u.id || '').trim().toLowerCase() === cleanUsername ||
          (u.name || '').trim().toLowerCase() === cleanUsername;

        if (!matchName) return false;
        if (u.unitId) {
          return InisiasiService.isUserMatchingUnit(u.unitId, targetUnitId);
        }
        return true;
      });

      if (matchedLocal) {
        await this.saveLocalSession(matchedLocal);
        return { success: true, user: matchedLocal };
      }
    } catch (dexieErr) {
      console.warn('[AuthService] Dexie login fallback error:', dexieErr);
    }

    return { success: false, error: 'Tidak dapat terhubung ke API HyperCloudHost dan akun tidak ditemukan di penyimpanan lokal.' };
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
