import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { User, UserRole } from '../types';
import { AuthContextData } from './contextConstants';
import { AuthService } from '../services/authService';
import { InisiasiService } from '../services/inisiasiService';
import { realtimeService } from '../services/realtimeService';
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
    realtimeService.disconnect();
    setUser(null);
    AuthService.clearSession();
  }, [setUser]);

  const login = React.useCallback((userData: User) => {
    const activeInisiasi = InisiasiService.getActiveInisiasiUnit();
    const fallbackUnitId = activeInisiasi.id || activeInisiasi.unitId || InisiasiService.getSelectedUnitId();
    const userUnitId = InisiasiService.getStandardUnitId(userData.unitId || fallbackUnitId);
    
    // Always sync selected unit to logged-in user's unit
    if (userUnitId) {
      InisiasiService.saveSelectedUnit(userUnitId);
    }
    const currentInisiasi = InisiasiService.getActiveInisiasiUnit();

    console.log("[APHRO LOGIN]", {
      userUnitId,
      username: userData.userName || userData.nip,
      authenticatedUserId: userData.id
    });

    const fullUser: User = {
      ...userData,
      unitId: userUnitId,
      unitName: userData.unitName || currentInisiasi.namaUL,
    };

    // CRITICAL: Write session & token to localStorage BEFORE setting state so downstream
    // context hooks (WorkOrders, Realisasi, MasterData, Absensi) find token immediately
    AuthService.saveLocalSession(fullUser);
    setUser(fullUser);
    realtimeService.connect(userUnitId);
  }, [setUser]);

  // Synchronize active inisiasi unit with current user unit on mount / user state update
  React.useEffect(() => {
    if (user && user.unitId) {
      const stdUserUnit = InisiasiService.getStandardUnitId(user.unitId);
      InisiasiService.saveSelectedUnit(stdUserUnit);
      realtimeService.connect(stdUserUnit);
    } else {
      realtimeService.disconnect();
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
