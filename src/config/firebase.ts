import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export const requestForToken = async () => {
  if (!messaging) return null;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission not granted.');
      return null;
    }

    const currentToken = await getToken(messaging, {
      vapidKey: 'BGrmudCVGIDGatsIOlDYs254nhyO32Jgo7siAccQOjQo_Mx_Gn7ctZ_bQDAdrOpe-iil33gB8zxt4vdC0s6kJO4'
    });
    if (currentToken) {
      console.log('Current token for client: ', currentToken);
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    console.log('Payload received: ', payload);
    callback(payload);
  });
};
