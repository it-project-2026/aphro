/**
 * AuthService - Centralized Authentication Service for APHRO
 * 
 * Architecture:
 * AuthService -> Supabase (USERS table) + Dexie (Local fallback for offline login)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
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
          const userUnitId = InisiasiService.getStandardUnitId(rawUser.unitId || rawUser.UnitID || targetUnitId);

          if (userUnitId && !InisiasiService.isUserMatchingUnit(userUnitId, targetUnitId)) {
            return {
              success: false,
              error: `User '${cleanUsername}' terdaftar pada UL (${userUnitId}), bukan di Inisiasi terpilih (${targetUnitId}).`,
            };
          }

          const normalized: User = {
            id: String(rawUser.Id || rawUser.UserID || rawUser.id || `usr-${cleanUsername}`),
            unitId: targetUnitId,
            unitName: InisiasiService.getActiveInisiasiUnit().namaUL,
            nip: String(rawUser.UserID || cleanUsername).toUpperCase(),
            name: String(rawUser.Nama_Regu || rawUser.Username || cleanUsername),
            userName: String(rawUser.Username || cleanUsername),
            email: `${cleanUsername}@pln.co.id`,
            role: (rawUser.Role || 'User') as UserRole,
            reguName: String(rawUser.Nama_Regu || ''),
            ulpName: String(rawUser.ULP || ''),
            status: rawUser.Status || 'Aktif',
          };

          (normalized as any).token = apiRes.token;

          await this.saveLocalSession(normalized);
          return { success: true, user: normalized };
        } else {
          return { success: false, error: apiRes.message || 'Gagal login ke HyperCloudHost.' };
        }
      } catch (apiErr: any) {
        console.error('HyperCloudHost API login error:', apiErr);
        return { success: false, error: `Gagal terhubung ke server HyperCloudHost: ${apiErr.message}` };
      }
    }

    // 2. Offline / Local fallback via Dexie
    try {
      const localUsers = await dexieDb.users.toArray();
      const matchedLocal = localUsers.find(
        (u) =>
          ((u.userName && u.userName.toLowerCase() === cleanUsername) ||
           (u.nip && u.nip.toLowerCase() === cleanUsername) ||
           (u.id && u.id.toLowerCase() === cleanUsername)) &&
          (!u.unitId || InisiasiService.isUserMatchingUnit(u.unitId, targetUnitId))
      );

      if (matchedLocal) {
        console.log('[APHRO LOGIN LOCAL]', {
          selectedUnitId: targetUnitId,
          username: cleanUsername,
          authenticatedUserId: matchedLocal.id,
          authenticatedUserUnitId: targetUnitId
        });
        return { success: true, user: { ...matchedLocal, unitId: targetUnitId } };
      }
    } catch (localErr) {
      console.warn('Dexie local user lookup error:', localErr);
    }

    // 3. Fallback for demo / standard accounts scoped to targetUnitId
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const demoUser: User = {
      id: `usr-${cleanUsername}-${targetUnitId.toLowerCase()}`,
      unitId: targetUnitId,
      unitName: activeInisiasi.namaUL,
      nip: cleanUsername.toUpperCase(),
      name: cleanUsername.toUpperCase(),
      userName: cleanUsername,
      email: `${cleanUsername}@pln.co.id`,
      role: (cleanUsername.includes('admin') || cleanUsername.includes('adm') ? 'Admin' : 'User') as UserRole,
    };

    console.log('[APHRO LOGIN DEMO]', {
      selectedUnitId: targetUnitId,
      username: cleanUsername,
      authenticatedUserId: demoUser.id,
      authenticatedUserUnitId: targetUnitId
    });

    return {
      success: true,
      user: demoUser,
    };
  }

  /**
   * Save / sync active user profile to Dexie & localStorage
   */
  static async saveLocalSession(user: User): Promise<void> {
    try {
      localStorage.setItem('aphro_user', JSON.stringify(user));
      localStorage.setItem('aphro_has_initiated', 'true');

      const token = (user as any).token || (user as any).jwtToken || (user as any).accessToken;
      if (token) {
        localStorage.setItem('aphro_token', token);
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
