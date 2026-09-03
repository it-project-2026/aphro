import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { AuditLog, NotificationItem } from '../types';
import { INITIAL_LOGS, INITIAL_NOTIFICATIONS } from '../data/initialData';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { getLocalDateTimeString } from '../utils/dateUtils';

interface NotificationContextType {
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  logActivity: (action: string, details: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();

  const [auditLogs, setAuditLogs] = usePersistState<AuditLog[]>('aphro_logs', INITIAL_LOGS);
  const [notifications, setNotifications] = usePersistState<NotificationItem[]>('aphro_notifications', INITIAL_NOTIFICATIONS);

  // Derived state: filtered notifications based on active ULP, user role and regu
  const filteredNotifications = React.useMemo(() => {
    if (!user) return [];
    
    const currentULP = (settings.namaUnitLayanan || '').trim().toUpperCase();

    // 1. Filter by ULP (hanya sesuai dengan UL yang melakukan Inisiasi)
    const ulpFiltered = notifications.filter(n => {
      // If notification has no ulpTarget, we assume it's global for compatibility
      // But if it has one, it must match currentULP
      if (!n.ulpTarget) return true;
      return n.ulpTarget.trim().toUpperCase() === currentULP;
    });

    // 2. Further filter for non-admins (Regu)
    // Admins/SuperAdmins see everything within the current ULP
    if (user.role === 'SuperAdmin' || user.role === 'Admin' || user.role === 'Adm') {
      return ulpFiltered;
    }

    // Users (Regu) only see notifications targeted to them OR global ones within that ULP
    const userRegu = (user.reguName || '').trim().toUpperCase();
    return ulpFiltered.filter(n => {
      if (!n.reguTarget) return true; // Global notification for this ULP
      return n.reguTarget.trim().toUpperCase() === userRegu;
    });
  }, [notifications, user, settings.namaUnitLayanan]);

  const logActivity = React.useCallback((action: string, details: string) => {
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      timestamp: getLocalDateTimeString(),
      action,
      details,
      userId: user?.id || 'system',
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100
  }, [setAuditLogs, user]);

  const addNotification = React.useCallback((notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: 'notif-' + Date.now(),
      timestamp: getLocalDateTimeString(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 100)); // Keep last 100
  }, [setNotifications]);

  const markNotificationAsRead = React.useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, [setNotifications]);

  const clearNotifications = React.useCallback(() => {
    setNotifications([]);
  }, [setNotifications]);

  return (
    <NotificationContext.Provider value={{ 
      auditLogs, 
      notifications: filteredNotifications, // Use filtered list
      logActivity, 
      markNotificationAsRead, 
      clearNotifications, 
      addNotification 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = React.useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
