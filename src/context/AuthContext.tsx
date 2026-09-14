import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { User, UserRole } from '../types';
import { AuthContextData } from './contextConstants';
import { AuthService } from '../services/authService';
import { InisiasiService } from '../services/inisiasiService';
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
  const [user, setUser] = usePersistState<User | null>(
    'pln_mobile_user',
    AuthContextData.defaultUser
  );

  const logout = React.useCallback(() => {
    setUser(null);
    AuthService.clearSession();
  }, [setUser]);

  const login = React.useCallback((userData: User) => {
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const activeUnitId = activeInisiasi.unitId;
    const userUnitId = userData.unitId ? InisiasiService.getStandardUnitId(userData.unitId) : activeUnitId;
    
    console.log("[APHRO LOGIN]", {
      selectedUnitId: activeUnitId,
      username: userData.userName || userData.nip,
      authenticatedUserId: userData.id,
      authenticatedUserUnitId: userUnitId
    });

    if (userData.unitId && !InisiasiService.isUserMatchingUnit(userData.unitId, activeUnitId)) {
      console.error("[APHRO LOGIN MISMATCH]", { selectedUnitId: activeUnitId, userUnitId: userData.unitId });
      logout();
      throw new Error("User tidak sesuai dengan UL yang dipilih.");
    }

    const fullUser: User = {
      ...userData,
      unitId: userUnitId,
      unitName: userData.unitName || activeInisiasi.namaUL,
    };

    setUser(fullUser);
    AuthService.saveLocalSession(fullUser);
  }, [setUser, logout]);

  // Validate current user session on mount or state change against active inisiasi unit
  React.useEffect(() => {
    if (user && user.unitId) {
      const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
      if (!InisiasiService.isUserMatchingUnit(user.unitId, activeInisiasi.unitId)) {
        console.warn(`[APHRO SESSION MISMATCH] Existing user unitId (${user.unitId}) does not match active Inisiasi unitId (${activeInisiasi.unitId}). Resetting session.`);
        logout();
      }
    }
  }, [user, logout]);

  const loginWithCredentials = React.useCallback(async (userid: string, password?: string) => {
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const res = await AuthService.loginWithCredentials(userid, password, activeInisiasi.unitId);
    if (res.success && res.user) {
      login(res.user);
      return true;
    }
    return false;
  }, [login]);

  const loginAsRole = React.useCallback((role: UserRole) => {
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const safeRole = role || '';
    let name = `Demo ${role}`;
    let reguName: string | undefined = undefined;
    let ulpName: string | undefined = undefined;

    if (role === 'User') {
      const primary = getPrimaryTimRowForUnit(activeInisiasi.namaUL || activeInisiasi.unitId);
      name = primary.name;
      reguName = primary.reguName;
      ulpName = primary.ulpName;
    }

    const mockUser: User = {
      id: `usr-${safeRole.toLowerCase()}-${activeInisiasi.unitId.toLowerCase()}`,
      unitId: activeInisiasi.unitId,
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
