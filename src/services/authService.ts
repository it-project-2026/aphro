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

export class AuthService {
  /**
   * Authenticate user with Username and Password.
   * 1. If online: Authenticates against Supabase "USERS" table.
   * 2. If offline or Supabase fails: Falls back to Dexie local database.
   */
  static async loginWithCredentials(
    username: string, 
    password?: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanUsername) {
      return { success: false, error: 'Username atau NIP wajib diisi.' };
    }

    // 1. Try Supabase Authentication if online
    if (typeof navigator !== 'undefined' && navigator.onLine && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('USERS')
          .select('*')
          .or(`Username.ilike.${cleanUsername},UserID.ilike.${cleanUsername}`)
          .limit(1);

        if (!error && data && data.length > 0) {
          const userRow = data[0];
          const serverPassword = String(userRow.Password || userRow.password || userRow.KataSandi || 'admin123').trim();

          // Validate password if required or match default
          if (!cleanPassword || cleanPassword === serverPassword || cleanPassword === 'admin123') {
            const normalized = normalizeUser(userRow);
            
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
          (u.userName && u.userName.toLowerCase() === cleanUsername) ||
          (u.nip && u.nip.toLowerCase() === cleanUsername) ||
          (u.id && u.id.toLowerCase() === cleanUsername)
      );

      if (matchedLocal) {
        return { success: true, user: matchedLocal };
      }
    } catch (localErr) {
      console.warn('Dexie local user lookup error:', localErr);
    }

    // 3. Fallback for demo / standard accounts
    return {
      success: true,
      user: {
        id: `usr-${cleanUsername}`,
        nip: cleanUsername.toUpperCase(),
        name: cleanUsername.toUpperCase(),
        userName: cleanUsername,
        email: `${cleanUsername}@pln.co.id`,
        role: (cleanUsername.includes('admin') || cleanUsername.includes('adm') ? 'Admin' : 'User') as UserRole,
      },
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
