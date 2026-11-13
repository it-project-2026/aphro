import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './index.css';
import { ApiService } from './services/apiService.ts';

// Strip one-time update cache-buster query param cleanly on boot
if (typeof window !== 'undefined' && window.location.search.includes('_aphro_refresh=')) {
  try {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('_aphro_refresh');
    window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  } catch {
    // Ignore history replace errors
  }
}

// Inisialisasi pengecekan latar belakang ketersediaan API lokal
ApiService.initBackgroundValidation();

// Register Service Worker for PWA / Offline caching in production, clean stale SW in dev
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          reg.update().catch(() => {});

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.dispatchEvent(new CustomEvent('aphro:sw_updated'));
              }
            });
          });

          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              reg.update().catch(() => {});
            }
          });

          setInterval(() => {
            reg.update().catch(() => {});
          }, 60 * 1000);
        })
        .catch(() => {
          // Gracefully ignore SW registration errors in sandbox iframe
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.dispatchEvent(new CustomEvent('aphro:sw_updated'));
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'APHRO_SW_ACTIVATED') {
        window.dispatchEvent(new CustomEvent('aphro:sw_updated'));
      }
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister().catch(() => {}));
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
