import { useEffect } from 'react';
import { db, requestForToken, onMessageListener } from '../config/firebase';
import { collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export const useNotifications = () => {
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      const setupNotifications = async () => {
        const token = await requestForToken();
        if (token) {
          // Store token in Firestore associated with the user
          // We can store it in a 'fcm_tokens' collection or under 'users/{uid}/fcm_tokens'
          // For simplicity and multi-device support, we'll use a dedicated collection
          const tokenRef = doc(db, 'fcm_tokens', token);
          await setDoc(tokenRef, {
            token,
            userId: currentUser.id,
            reguName: currentUser.reguName || null,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      };

      setupNotifications();

      // Listen for foreground messages
      onMessageListener().then((payload: any) => {
        if (payload) {
          // You could show a toast here if you want
          console.log('Foreground notification:', payload);
        }
      });
    }
  }, [currentUser]);
};
