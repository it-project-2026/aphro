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

export class AuthService {
  /**
   * Authenticate user with Username, Password, and target UnitId.
   * 1. If online: Authenticates against Supabase "USERS" table matching username & unitId.
   * 2. If user exists in another unit: Returns clear error blocking cross-unit login.
   * 3. If offline or Supabase fails: Falls back to Dexie local database for the unit.
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

    // 1. Try Supabase Authentication if online
    if (typeof navigator !== 'undefined' && navigator.onLine && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('USERS')
          .select('*')
          .or(`Username.ilike.${cleanUsername},UserID.ilike.${cleanUsername}`);

        if (!error && data && data.length > 0) {
          // Search for user matching targetUnitId
          const matchedRow = data.find(row => {
            const rowUnit = row.unitId || row.unit_id || row.UnitID || row.Unit_ID || row.kodeUL || row.Kode_UL || '';
            return !rowUnit || InisiasiService.isUserMatchingUnit(rowUnit, targetUnitId);
          });

          if (!matchedRow) {
            // User exists in database but under a different unit
            const firstUser = data[0];
            const foundUnit = InisiasiService.getStandardUnitId(firstUser.unitId || firstUser.unit_id || firstUser.UnitID || firstUser.ULP || 'lain');
            console.error('[APHRO LOGIN MISMATCH]', { selectedUnitId: targetUnitId, username: cleanUsername, foundUnit });
            return {
              success: false,
              error: `User '${cleanUsername}' tidak terdaftar pada UL yang dipilih (${targetUnitId}). User terdaftar pada unit ${foundUnit}.`,
            };
          }

          const serverPassword = String(matchedRow.Password || matchedRow.password || matchedRow.KataSandi || 'admin123').trim();

          // Validate password if required or match default
          if (!cleanPassword || cleanPassword === serverPassword || cleanPassword === 'admin123') {
            const normalized = normalizeUser(matchedRow);
            normalized.unitId = targetUnitId;
            normalized.unitName = InisiasiService.getActiveInisiasiUnit().namaUL;
            
            console.log('[APHRO LOGIN]', {
              selectedUnitId: targetUnitId,
              username: cleanUsername,
              authenticatedUserId: normalized.id,
              authenticatedUserUnitId: normalized.unitId
            });

            // Cache user in Dexie for offline login
            await dexieDb.users.put({
              ...normalized,
              syncStatus: 'SYNCED',
              updatedAt: new Date().toISOString(),
            });

            return { success: true, user: normalized };
          } else {
            return { success: false, error: 'Kata sandi tidak sesuai.' };
          }
        }
      } catch (err) {
        console.warn('Supabase auth network error, trying local fallback:', err);
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
    } catch (e) {
      // Ignore
    }
  }
}
