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
  const isInitializedRef = React.useRef(false);

  // Initialize seen sets from localStorage if available to persist across refreshes
  React.useEffect(() => {
    try {
      const savedSeenWO = localStorage.getItem('aphro_notified_wo');
      const savedSeenComp = localStorage.getItem('aphro_notified_completions');
      
      if (savedSeenWO) {
        const parsed = JSON.parse(savedSeenWO);
        if (Array.isArray(parsed)) parsed.slice(-200).forEach(id => seenWorkOrders.current.add(id));
      }
      
      if (savedSeenComp) {
        const parsed = JSON.parse(savedSeenComp);
        if (Array.isArray(parsed)) parsed.slice(-200).forEach(id => seenCompletions.current.add(id));
      }
    } catch {
      // Ignore if localStorage format is legacy
    }
  }, []);

  // Update localStorage when sets change (cap to latest 200 to prevent bloat)
  const saveSeenToStorage = () => {
    try {
      const woArr = Array.from(seenWorkOrders.current).slice(-200);
      const compArr = Array.from(seenCompletions.current).slice(-200);
      localStorage.setItem('aphro_notified_wo', JSON.stringify(woArr));
      localStorage.setItem('aphro_notified_completions', JSON.stringify(compArr));
    } catch {
      // Ignore storage errors
    }
  };

  React.useEffect(() => {
    if (!user || !workOrders.length) return;

    // First load in session: Mark all existing WOs as seen so we don't bombard user with historical notifications
    if (!isInitializedRef.current) {
      workOrders.forEach(wo => {
        seenWorkOrders.current.add(wo.id);
        if (wo.status === 'Selesai' || wo.status === 'SELESAI') {
          seenCompletions.current.add(wo.id);
        }
      });
      saveSeenToStorage();
      isInitializedRef.current = true;
      return;
    }

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

      if (myNewWorkOrders.length > 0) {
        if (myNewWorkOrders.length <= 2) {
          myNewWorkOrders.forEach(wo => {
            addNotification({
              title: 'Work Order Baru',
              message: `Ada Work Order baru untuk Regu ${wo.reguName}: ${wo.nomorWO} - ${wo.penyulangName}`,
              type: 'info',
              ulpTarget: wo.ulpName
            });
            showToast(`Ada Work Order baru: ${wo.nomorWO}`, 'info');
            seenWorkOrders.current.add(wo.id);
          });
        } else {
          // Consolidate
          myNewWorkOrders.forEach(wo => {
            addNotification({
              title: 'Work Order Baru',
              message: `Ada Work Order baru untuk Regu ${wo.reguName}: ${wo.nomorWO} - ${wo.penyulangName}`,
              type: 'info',
              ulpTarget: wo.ulpName
            });
            seenWorkOrders.current.add(wo.id);
          });
          showToast(`Ada ${myNewWorkOrders.length} Work Order baru untuk Regu Anda`, 'info');
        }
        saveSeenToStorage();
      }
    }

    // 2. Logic for ROLE ADMIN: Users completed a Work Order
    if (isAdmin) {
      const recentlyCompleted = workOrders.filter(wo => {
        const isCompleted = wo.status === 'Selesai' || wo.status === 'SELESAI';
        const isNotSeen = !seenCompletions.current.has(wo.id);
        return isCompleted && isNotSeen;
      });

      if (recentlyCompleted.length > 0) {
        if (recentlyCompleted.length <= 2) {
          recentlyCompleted.forEach(wo => {
            addNotification({
              title: 'Work Order Selesai',
              message: `Regu ${wo.reguName} telah menyelesaikan Work Order ${wo.nomorWO} (${wo.penyulangName})`,
              type: 'success',
              ulpTarget: wo.ulpName
            });
            showToast(`Regu ${wo.reguName} menyelesaikan WO ${wo.nomorWO}`, 'success');
            seenCompletions.current.add(wo.id);
          });
        } else {
          // Consolidate
          recentlyCompleted.forEach(wo => {
            addNotification({
              title: 'Work Order Selesai',
              message: `Regu ${wo.reguName} telah menyelesaikan Work Order ${wo.nomorWO} (${wo.penyulangName})`,
              type: 'success',
              ulpTarget: wo.ulpName
            });
            seenCompletions.current.add(wo.id);
          });
          showToast(`${recentlyCompleted.length} Work Order telah diselesaikan oleh Regu`, 'success');
        }
        saveSeenToStorage();
      }
    }
  }, [user, workOrders, addNotification, showToast]);

  return null; // This component doesn't render anything
};
