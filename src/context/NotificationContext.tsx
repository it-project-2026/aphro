import * as React from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { AuditLog, NotificationItem } from '../types';
import { INITIAL_LOGS, INITIAL_NOTIFICATIONS } from '../data/initialData';
import { useAuth } from './AuthContext';

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

  const [auditLogs, setAuditLogs] = usePersistState<AuditLog[]>('aphro_logs', INITIAL_LOGS);
  const [notifications, setNotifications] = usePersistState<NotificationItem[]>('aphro_notifications', INITIAL_NOTIFICATIONS);

  // Derived state: filtered notifications based on user role and regu
  const filteredNotifications = React.useMemo(() => {
    if (!user) return [];
    
    // Admins/SuperAdmins see everything
    if (user.role === 'SuperAdmin' || user.role === 'Admin' || user.role === 'Adm') {
      return notifications;
    }

    // Users (Regu) only see notifications targeted to them OR global ones
    const userRegu = (user.reguName || '').trim().toUpperCase();
    return notifications.filter(n => {
      if (!n.reguTarget) return true; // Global notification
      return n.reguTarget.trim().toUpperCase() === userRegu;
    });
  }, [notifications, user]);

  const logActivity = React.useCallback((action: string, details: string) => {
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
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
