import { useEffect } from 'react';
import { db, requestForToken, onMessageListener } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from './useToast';
import { useNotifications as useNotificationContext } from '../context/NotificationContext';

export const useNotifications = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { addNotification } = useNotificationContext();

  useEffect(() => {
    if (currentUser) {
      const setupNotifications = async () => {
        try {
          const token = await requestForToken();
          if (token) {
            console.log('FCM Token retrieved, saving to Firestore...');
            const tokenRef = doc(db, 'fcm_tokens', token);
            await setDoc(tokenRef, {
              token,
              userId: currentUser.id,
              reguName: currentUser.reguName || null,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log('FCM Token saved successfully.');
          }
        } catch (error) {
          console.error('Error setting up notifications:', error);
        }
      };

      setupNotifications();
      
      // Listen for foreground messages
      const unsubscribe = onMessageListener((payload) => {
        if (payload && payload.notification) {
          const title = payload.notification.title || 'Pemberitahuan Baru';
          const body = payload.notification.body || '';
          
          showToast(title + ': ' + body, 'info');

          // Add to local notification bell list
          addNotification({
            title,
            message: body,
            type: 'info',
            reguTarget: currentUser.reguName,
            ulpTarget: currentUser.ulpName
          });
        }
      });

      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [currentUser, showToast, addNotification]);
};
