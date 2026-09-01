import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyD2bYctI1AigY7wDbFpJr2oPjx5L2H4rRk",
  authDomain: "conductive-catcher-w9v0l.firebaseapp.com",
  projectId: "conductive-catcher-w9v0l",
  storageBucket: "conductive-catcher-w9v0l.firebasestorage.app",
  messagingSenderId: "341121989028",
  appId: "1:341121989028:web:d172debd90f319c3362931"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

let messagingInstance: Messaging | null = null;

export const getMessagingSafe = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch {
    // Graceful fallback if messaging is not supported in iframe/browser
  }
  return null;
};

export const requestForToken = async () => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;
    const messaging = await getMessagingSafe();
    if (!messaging) return null;

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    }

    const currentToken = await getToken(messaging, {
      vapidKey: 'BGrmudCVGIDGatsIOlDYs254nhyO32Jgo7siAccQOjQo_Mx_Gn7ctZ_bQDAdrOpe-iil33gB8zxt4vdC0s6kJO4'
    });
    return currentToken || null;
  } catch {
    return null;
  }
};

export const onMessageListener = (callback: (payload: any) => void) => {
  let unsubscribe: (() => void) | null = null;
  getMessagingSafe().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        callback(payload);
      });
    }
  }).catch(() => {});

  return () => {
    if (unsubscribe) unsubscribe();
  };
};

