import * as React from 'react';
import { User, UserRole } from '../types';
import { AuthContextData } from './contextConstants';
import { AuthService } from '../services/authService';
import { InisiasiService } from '../services/inisiasiService';
import { ApiService } from '../services/apiService';
import { getPrimaryTimRowForUnit } from '../services/rekapHarianService';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loginWithCredentials: (userid: string, password?: string) => Promise<boolean>;
  loginAsRole: (role: UserRole) => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Mekanisme session restore terverifikasi secara sinkron saat aplikasi pertama dibuka.
  // Jika aphro_token atau token pada user yang tersimpan sudah kedaluwarsa (isExpired === true),
  // session TIDAK diizinkan aktif dan langsung dibersihkan agar user diarahkan ke login.
  const [user, setUser] = React.useState<User | null>(() => {
    try {
      if (typeof localStorage === 'undefined') return AuthContextData.defaultUser;

      const aphroToken = localStorage.getItem('aphro_token');
      if (aphroToken && ApiService.isTokenExpired(aphroToken)) {
        console.warn('[AUTH SESSION] Restored session token is expired. Purging session.');
        AuthService.clearSession();
        return null;
      }

      const savedUserStr = localStorage.getItem('pln_mobile_user') || localStorage.getItem('aphro_user');
      if (savedUserStr) {
        const savedUser: User = JSON.parse(savedUserStr);
        const userTok = savedUser.token || (savedUser as any).jwtToken || (savedUser as any).accessToken || aphroToken;
        if (userTok && ApiService.isTokenExpired(userTok)) {
          console.warn('[AUTH SESSION] User token in storage is expired. Purging session.');
          AuthService.clearSession();
          return null;
        }
        return savedUser;
      }
    } catch (e) {
      console.warn('[AUTH SESSION] Failed restoring stored user:', e);
      AuthService.clearSession();
    }
    return AuthContextData.defaultUser;
  });

  const logout = React.useCallback(() => {
    setUser(null);
    AuthService.clearSession();
  }, []);

  // Tangani event kedaluwarsa sesi (HTTP 401 atau token expired dari executeFetch)
  React.useEffect(() => {
    const handleAuthExpired = () => {
      console.warn('[AuthContext] Session expired or unauthorized (401). Resetting auth state.');
      setUser(null);
      AuthService.clearSession();
    };

    window.addEventListener('aphro:auth_expired', handleAuthExpired);
    return () => {
      window.removeEventListener('aphro:auth_expired', handleAuthExpired);
    };
  }, []);

  const login = React.useCallback((userData: User) => {
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const fallbackUnitId = activeInisiasi.id || activeInisiasi.unitId || InisiasiService.getSelectedUnitId();
    const userUnitId = InisiasiService.getStandardUnitId(userData.unitId || fallbackUnitId);
    
    // Always sync selected unit to logged-in user's unit
    if (userUnitId) {
      InisiasiService.saveSelectedUnit(userUnitId);
    }
    const currentInisiasi = InisiasiService.getActiveInisiasiUnit();

    // Prioritaskan token baru yang valid dari response POST /api/login
    const rawToken = userData.token || (userData as any).jwtToken || (userData as any).accessToken;
    let freshToken: string | undefined = undefined;
    if (rawToken && ApiService.isValidToken(rawToken) && !ApiService.isTokenExpired(rawToken)) {
      freshToken = rawToken.trim();
    } else {
      const activeTok = ApiService.getAuthToken();
      if (activeTok) {
        freshToken = activeTok;
      }
    }

    console.log("[APHRO LOGIN]", {
      userUnitId,
      username: userData.userName || userData.nip,
      authenticatedUserId: userData.id,
      hasToken: Boolean(freshToken),
    });

    const fullUser: User = {
      ...userData,
      token: freshToken,
      unitId: userUnitId,
      unitName: userData.unitName || currentInisiasi.namaUL,
    };

    // CRITICAL: Tulis session & token BARU ke storage SEBELUM setUser agar downstream hooks
    // (WorkOrders, Realisasi, MasterData, Absensi) langsung mendapatkan token baru
    AuthService.saveLocalSession(fullUser, freshToken);
    setUser(fullUser);
  }, []);

  // Synchronize active inisiasi unit and token with current user state (hanya jika valid & belum expired)
  React.useEffect(() => {
    if (user && user.unitId) {
      const stdUserUnit = InisiasiService.getStandardUnitId(user.unitId);
      InisiasiService.saveSelectedUnit(stdUserUnit);

      // Pastikan aphro_token disinkronkan hanya jika user.token valid dan belum expired
      if (user.token && ApiService.isValidToken(user.token) && !ApiService.isTokenExpired(user.token)) {
        const storedToken = localStorage.getItem('aphro_token');
        if (!storedToken || storedToken !== user.token) {
          localStorage.setItem('aphro_token', user.token);
          localStorage.setItem('jwt_token', user.token);
        }
      }
    }
  }, [user]);

  const loginWithCredentials = React.useCallback(async (userid: string, password?: string) => {
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const activeUnitId = activeInisiasi.id || activeInisiasi.unitId || InisiasiService.getSelectedUnitId();
    const res = await AuthService.loginWithCredentials(userid, password, activeUnitId);
    if (res.success && res.user) {
      login(res.user);
      return true;
    }
    return false;
  }, [login]);

  const loginAsRole = React.useCallback((role: UserRole) => {
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const activeUnitId = activeInisiasi.id || activeInisiasi.unitId || InisiasiService.getSelectedUnitId();
    const safeRole = role || '';
    let name = `Demo ${role}`;
    let reguName: string | undefined = undefined;
    let ulpName: string | undefined = undefined;

    if (role === 'User') {
      const primary = getPrimaryTimRowForUnit(activeInisiasi.namaUL || activeUnitId);
      name = primary.name;
      reguName = primary.reguName;
      ulpName = primary.ulpName;
    }

    const mockUser: User = {
      id: `usr-${safeRole.toLowerCase()}-${activeUnitId.toLowerCase()}`,
      unitId: activeUnitId,
      unitName: activeInisiasi.namaUL,
      nip: (role || '').toUpperCase(),
      name,
      userName: `demo_${safeRole.toLowerCase()}`,
      reguName,
      ulpName,
      email: `${safeRole.toLowerCase()}@pln.co.id`,
      role: role
    };
    login(mockUser);
  }, [login]);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loginWithCredentials, loginAsRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
}
