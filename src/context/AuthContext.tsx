import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { User, UserRole } from '../types';
import { AuthContextData } from './contextConstants';
import { AuthService } from '../services/authService';
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

  const login = React.useCallback((userData: User) => {
    setUser(userData);
    AuthService.saveLocalSession(userData);
  }, [setUser]);

  const loginWithCredentials = React.useCallback(async (userid: string, password?: string) => {
    const res = await AuthService.loginWithCredentials(userid, password);
    if (res.success && res.user) {
      login(res.user);
      return true;
    }
    return false;
  }, [login]);

  const loginAsRole = React.useCallback((role: UserRole) => {
    const safeRole = role || '';
    let name = `Demo ${role}`;
    let reguName: string | undefined = undefined;
    let ulpName: string | undefined = undefined;

    if (role === 'User') {
      const activeUnit = localStorage.getItem('aphro_nama_unit_layanan') || localStorage.getItem('aphro_selected_unit_id') || 'UL BUKITTINGGI';
      const primary = getPrimaryTimRowForUnit(activeUnit);
      name = primary.name;
      reguName = primary.reguName;
      ulpName = primary.ulpName;
    }

    const mockUser: User = {
      id: `usr-${safeRole.toLowerCase()}`,
      nip: (role || '').toUpperCase(),
      name,
      reguName,
      ulpName,
      email: `${safeRole.toLowerCase()}@pln.co.id`,
      role: role
    };
    login(mockUser);
  }, [login]);

  const logout = React.useCallback(() => {
    setUser(null);
    AuthService.clearSession();
  }, [setUser]);

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
