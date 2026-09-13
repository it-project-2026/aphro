import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { User, UserRole } from '../types';
import { AuthContextData } from './contextConstants';
import { dexieDb } from '../services/dexieDb';

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

  const loginWithCredentials = React.useCallback(async (userid: string, _password?: string) => {
    return true; 
  }, []);

  const login = React.useCallback((userData: User) => {
    setUser(userData);
    try {
      localStorage.setItem('aphro_user', JSON.stringify(userData));
      localStorage.setItem('aphro_has_initiated', 'true');

      // Persist in Dexie DB for offline authentication access
      dexieDb.users.put({
        ...userData,
        syncStatus: 'SYNCED',
        updatedAt: new Date().toISOString(),
      }).catch(err => console.warn('Dexie user put error:', err));
    } catch {
      // Ignore storage write error
    }
  }, [setUser]);

  const loginAsRole = React.useCallback((role: UserRole) => {
    const safeRole = role || '';
    const mockUser: User = {
      id: `usr-${safeRole.toLowerCase()}`,
      nip: (role || '').toUpperCase(),
      name: `Demo ${role}`,
      email: `${safeRole.toLowerCase()}@pln.co.id`,
      role: role
    };
    login(mockUser);
  }, [login]);

  const logout = React.useCallback(() => {
    setUser(null);
    localStorage.removeItem('aphro_user');
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
