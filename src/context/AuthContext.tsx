import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { User, UserRole } from '../types';
import { AuthContextData } from './contextConstants';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loginWithCredentials: (userid: string, password?: string) => Promise<boolean>;
  loginAsRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = usePersistState<User | null>(
    'pln_mobile_user',
    AuthContextData.defaultUser
  );
  
  // This would normally come from MasterDataContext users, but let's assume we fetch it or it's provided
  // For simplicity during migration, I'll keep it basic
  const loginWithCredentials = useCallback(async (userid: string, _password?: string) => {
    // In a real app, this would verify against a backend or MasterDataContext users
    // For now, we'll assume the component calling this will handle the lookup and then call login()
    return true; 
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
    try {
      localStorage.setItem('aphro_user', JSON.stringify(userData)); // Backward compatibility
      localStorage.setItem('aphro_has_initiated', 'true');
    } catch (e) {
      console.warn('Unable to save aphro_user to localStorage:', e);
    }
  }, [setUser]);

  const loginAsRole = useCallback((role: UserRole) => {
    // Mock user for role switcher
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

  const logout = useCallback(() => {
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
}
