importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD2bYctI1AigY7wDbFpJr2oPjx5L2H4rRk",
  authDomain: "conductive-catcher-w9v0l.firebaseapp.com",
  projectId: "conductive-catcher-w9v0l",
  storageBucket: "conductive-catcher-w9v0l.firebasestorage.app",
  messagingSenderId: "341121989028",
  appId: "1:341121989028:web:d172debd90f319c3362931"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
