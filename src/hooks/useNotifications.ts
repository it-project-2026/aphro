import { useEffect, useState, useCallback } from 'react';
import { db, requestForToken, onMessageListener } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from './useToast';
import { useNotifications as useNotificationContext } from '../context/NotificationContext';
import { getLocalDateTimeString } from '../utils/dateUtils';
import { ApiService } from '../services/apiService';

const getOrCreateDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server';
  let deviceId = localStorage.getItem('aphro_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('aphro_device_id', deviceId);
  }
  return deviceId;
};

const detectPlatform = (): string => {
  if (typeof window === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Win|Mac|Linux/i.test(ua)) return 'Desktop';
  return 'Web';
};

export const useNotifications = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { addNotification } = useNotificationContext();

  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const registerTokenInFirestore = useCallback(async (token: string) => {
    if (!currentUser) return;
    try {
      const deviceId = getOrCreateDeviceId();
      const platform = detectPlatform();
      const tokenRef = doc(db, 'fcm_tokens', token);

      await setDoc(tokenRef, {
        token,
        userId: currentUser.id,
        userName: currentUser.name || (currentUser as any).username || 'User',
        unitId: currentUser.unitId || 'UL2',
        ulpName: currentUser.ulpName || '',
        reguName: currentUser.reguName || '',
        role: currentUser.role || 'User',
        deviceId,
        platform,
        updatedAt: getLocalDateTimeString(),
        active: true
      }, { merge: true });

      setFcmToken(token);
    } catch (err: any) {
      console.warn('[FCM TOKEN] Gagal menyimpan token ke Firestore:', err?.message || err);
    }
  }, [currentUser]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Browser Anda tidak mendukung Notifikasi Sistem.', 'warning');
      return false;
    }

    setIsRegistering(true);
    try {
      sessionStorage.removeItem('aphro_fcm_unauthorized');
      const perm = await Notification.requestPermission();
      setPermissionStatus(perm);

      if (perm === 'granted') {
        const token = await requestForToken();
        if (token) {
          await registerTokenInFirestore(token);
          showToast('Notifikasi Perangkat (FCM) Berhasil Diaktifkan!', 'success');
          return true;
        } else {
          showToast('Izin notifikasi diberikan, tetapi token FCM belum didapatkan.', 'info');
          return true;
        }
      } else if (perm === 'denied') {
        showToast('Izin notifikasi ditolak oleh pengguna pada browser.', 'error');
        return false;
      }
      return false;
    } catch (err: any) {
      showToast('Gagal mengaktifkan notifikasi: ' + (err.message || 'Error'), 'error');
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [registerTokenInFirestore, showToast]);

  const sendTestNotification = useCallback(async () => {
    if (!currentUser) return;
    showToast('Mengirimkan notifikasi uji coba...', 'info');

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reguName: currentUser.reguName || '',
          unitId: currentUser.unitId || 'UL2',
          ulpName: currentUser.ulpName || '',
          woData: {
            id: 'TEST-' + Date.now(),
            nomorWO: 'WO/TEST/999',
            penyulangName: 'PENYULANG TEST',
            status: 'Belum Selesai',
            pekerjaan: 'Uji Coba Push Notification System'
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Notifikasi uji coba berhasil dikirim dari Server FCM!', 'success');

        // Also trigger native browser notification if granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🔔 UJI COBA NOTIFIKASI APHRO', {
            body: 'Selamat! Fitur Push Notification Perangkat (FCM) berjalan dengan sukses.',
            icon: '/favicon.ico'
          });
        }
      } else {
        showToast('Server merespons: ' + (data.message || 'Gagal mengirim notifikasi'), 'warning');
      }
    } catch (err: any) {
      showToast('Gagal mengirim uji coba notifikasi: ' + err.message, 'error');
    }
  }, [currentUser, showToast]);

  useEffect(() => {
    if (currentUser) {
      const setupNotifications = async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const token = await requestForToken();
            if (token) {
              await registerTokenInFirestore(token);
            }
          } catch {
            // Graceful handling
          }
        }
      };

      setupNotifications();

      // Listen for foreground FCM messages
      const unsubscribe = onMessageListener((payload) => {
        if (payload) {
          const title = payload.notification?.title || payload.data?.title || '📋 Pemberitahuan Work Order';
          const body = payload.notification?.body || payload.data?.body || '';

          showToast(`${title}: ${body}`, 'info');

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
  }, [currentUser, registerTokenInFirestore, showToast, addNotification]);

  return {
    permissionStatus,
    fcmToken,
    isRegistering,
    requestPermission,
    sendTestNotification,
    deviceId: getOrCreateDeviceId(),
    platform: detectPlatform()
  };
};

