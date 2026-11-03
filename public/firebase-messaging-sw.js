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
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const title = payload?.notification?.title || payload?.data?.title || '📋 WORK ORDER BARU';
  const body = payload?.notification?.body || payload?.data?.body || 'Ada Work Order baru yang perlu diproses.';
  const clickUrl = payload?.data?.url || payload?.fcmOptions?.link || '/?tab=work_orders';

  const notificationOptions = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: payload?.data?.woId || 'aphro-wo-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      url: clickUrl,
      woId: payload?.data?.woId || '',
      nomorWO: payload?.data?.nomorWO || ''
    }
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Handle push event fallback for standard Web Push payloads
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.notification?.title || data.title || '📋 WORK ORDER BARU';
      const options = {
        body: data.notification?.body || data.body || 'Ada pembaruan Work Order.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: {
          url: data.data?.url || '/?tab=work_orders',
          woId: data.data?.woId || ''
        }
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      // Ignore parse error
    }
  }
});

// Handle user clicking on system notification
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/?tab=work_orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

