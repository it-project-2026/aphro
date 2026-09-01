import * as React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkOrders } from '../../context/WorkOrderContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../hooks/useToast';

export const NotificationListener: React.FC = () => {
  const { user } = useAuth();
  const { workOrders } = useWorkOrders();
  const { addNotification } = useNotifications();
  const { showToast } = useToast();

  // Keep track of seen IDs to prevent double notifications in the same session
  const seenWorkOrders = React.useRef<Set<string>>(new Set());
  const seenCompletions = React.useRef<Set<string>>(new Set());

  // Initialize seen sets from localStorage if available to persist across refreshes
  React.useEffect(() => {
    try {
      const savedSeenWO = localStorage.getItem('aphro_notified_wo');
      const savedSeenComp = localStorage.getItem('aphro_notified_completions');
      
      if (savedSeenWO) {
        const parsed = JSON.parse(savedSeenWO);
        if (Array.isArray(parsed)) parsed.forEach(id => seenWorkOrders.current.add(id));
      }
      
      if (savedSeenComp) {
        const parsed = JSON.parse(savedSeenComp);
        if (Array.isArray(parsed)) parsed.forEach(id => seenCompletions.current.add(id));
      }
    } catch (e) {
      console.warn('Failed to load seen notifications from localStorage', e);
    }
  }, []);

  // Update localStorage when sets change
  const saveSeenToStorage = () => {
    localStorage.setItem('aphro_notified_wo', JSON.stringify(Array.from(seenWorkOrders.current)));
    localStorage.setItem('aphro_notified_completions', JSON.stringify(Array.from(seenCompletions.current)));
  };

  React.useEffect(() => {
    if (!user || !workOrders.length) return;

    const userRole = (user.role || '').toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'ADM' || userRole === 'SUPERADMIN';
    const isUser = userRole === 'USER';

    // 1. Logic for ROLE USER: New Work Orders assigned to them
    if (isUser) {
      const myRegu = user.reguName || user.reguId;
      if (!myRegu) return;

      const myNewWorkOrders = workOrders.filter(wo => {
        const isForMe = wo.reguName === myRegu || wo.reguId === myRegu;
        const isNotSeen = !seenWorkOrders.current.has(wo.id);
        const isRecent = new Date(wo.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000; // Within last 24h
        return isForMe && isNotSeen && isRecent && wo.status !== 'Selesai' && wo.status !== 'SELESAI';
      });

      myNewWorkOrders.forEach(wo => {
        const title = 'Work Order Baru';
        const message = `Ada Work Order baru untuk Regu ${wo.reguName}: ${wo.nomorWO} - ${wo.penyulangName}`;
        
        addNotification({
          title,
          message,
          type: 'info',
          ulpTarget: wo.ulpName
        });
        
        showToast(message, 'info');
        seenWorkOrders.current.add(wo.id);
      });

      if (myNewWorkOrders.length > 0) saveSeenToStorage();
    }

    // 2. Logic for ROLE ADMIN: Users completed a Work Order
    if (isAdmin) {
      const recentlyCompleted = workOrders.filter(wo => {
        const isCompleted = wo.status === 'Selesai' || wo.status === 'SELESAI';
        const isNotSeen = !seenCompletions.current.has(wo.id);
        // Only notify if it was updated/completed recently (within last hour for active notifications)
        // If updatedAt is not available, we can't easily tell WHEN it was completed, 
        // but we can at least notify once when we first see it as completed.
        return isCompleted && isNotSeen;
      });

      recentlyCompleted.forEach(wo => {
        const title = 'Work Order Selesai';
        const message = `Regu ${wo.reguName} telah menyelesaikan Work Order ${wo.nomorWO} (${wo.penyulangName})`;
        
        addNotification({
          title,
          message,
          type: 'success',
          ulpTarget: wo.ulpName
        });
        
        showToast(message, 'success');
        seenCompletions.current.add(wo.id);
      });

      if (recentlyCompleted.length > 0) saveSeenToStorage();
    }
  }, [user, workOrders, addNotification, showToast]);

  return null; // This component doesn't render anything
};
