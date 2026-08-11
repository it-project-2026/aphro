import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { usePersistState } from '../hooks/usePersistState';
import { AuditLog, NotificationItem } from '../types';
import { INITIAL_LOGS, INITIAL_NOTIFICATIONS } from '../data/initialData';

interface NotificationContextType {
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  logActivity: (action: string, details: string) => void;
  markNotificationAsRead: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [auditLogs, setAuditLogs] = usePersistState<AuditLog[]>('aphro_logs', INITIAL_LOGS);
  const [notifications, setNotifications] = usePersistState<NotificationItem[]>('aphro_notifications', INITIAL_NOTIFICATIONS);

  const logActivity = useCallback((action: string, details: string) => {
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      action,
      details,
      userId: 'system', // Should be dynamic
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100
  }, [setAuditLogs]);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, [setNotifications]);

  return (
    <NotificationContext.Provider value={{ auditLogs, notifications, logActivity, markNotificationAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
