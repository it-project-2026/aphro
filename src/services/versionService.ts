/**
 * Version Management Service for APHRO
 * Handles semantic version & buildId comparison, cache-busted version fetching,
 * force update policies, form busy detection, and safe asset updates.
 *
 * CRITICAL SAFETY RULES:
 * - NEVER deletes Dexie IndexedDB database.
 * - NEVER deletes pending / queued / synced Realisasi data.
 * - NEVER deletes localStorage user credentials or initiation state.
 * - Only refreshes browser HTTP CacheStorage and Service Worker caches.
 */

import { APP_BUILD_ID, APP_VERSION } from '../config/version';

export interface AppVersionInfo {
  version: string;
  minimumVersion?: string;
  build?: string;
  buildId?: string;
  releaseDate?: string;
  updatedAt?: string;
}

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  currentBuildId?: string;
  latestBuildId?: string;
  minimumVersion?: string;
  updateAvailable: boolean;
  forceUpdateRequired: boolean;
  loopDetected: boolean;
  versionInfo?: AppVersionInfo;
}

const STORAGE_KEYS = {
  TARGET_VERSION: 'aphro_update_target_version',
  UPDATE_ATTEMPTS: 'aphro_update_attempts',
  LAST_CHECK_TIME: 'aphro_last_version_check_ts',
};

/**
 * Compare two semantic or calver versions.
 */
export function compareVersions(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean1 = v1.toString().trim().replace(/^[vV]/, '');
  const clean2 = v2.toString().trim().replace(/^[vV]/, '');

  if (clean1 === clean2) return 0;

  const parts1 = clean1.split(/[.-]/);
  const parts2 = clean2.split(/[.-]/);
  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] !== undefined ? parts1[i] : '0';
    const p2 = parts2[i] !== undefined ? parts2[i] : '0';

    const num1 = Number(p1);
    const num2 = Number(p2);

    const isNum1 = !isNaN(num1) && /^\d+$/.test(p1.trim());
    const isNum2 = !isNaN(num2) && /^\d+$/.test(p2.trim());

    if (isNum1 && isNum2) {
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    } else {
      const cmp = p1.localeCompare(p2, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp > 0 ? 1 : -1;
    }
  }

  return 0;
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

export function isForceUpdateRequired(current: string, minimumVersion?: string): boolean {
  if (!minimumVersion) return false;
  return compareVersions(current, minimumVersion) < 0;
}

export function clearUpdateLoopState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.TARGET_VERSION);
    sessionStorage.removeItem(STORAGE_KEYS.UPDATE_ATTEMPTS);
  } catch {
    // Ignore storage errors
  }
}

export function checkUpdateLoop(targetKey: string, currentKey: string): boolean {
  try {
    const storedTarget = sessionStorage.getItem(STORAGE_KEYS.TARGET_VERSION);
    const attempts = Number(sessionStorage.getItem(STORAGE_KEYS.UPDATE_ATTEMPTS)) || 0;

    if (storedTarget && storedTarget === currentKey) {
      clearUpdateLoopState();
      return false;
    }

    if (storedTarget === targetKey && attempts >= 2) {
      return true;
    }
  } catch {
    // Gracefully handle storage errors
  }
  return false;
}

export function recordUpdateAttempt(targetKey: string): void {
  try {
    const storedTarget = sessionStorage.getItem(STORAGE_KEYS.TARGET_VERSION);
    const currentAttempts = storedTarget === targetKey
      ? (Number(sessionStorage.getItem(STORAGE_KEYS.UPDATE_ATTEMPTS)) || 0)
      : 0;

    sessionStorage.setItem(STORAGE_KEYS.TARGET_VERSION, targetKey);
    sessionStorage.setItem(STORAGE_KEYS.UPDATE_ATTEMPTS, String(currentAttempts + 1));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Check if the user is actively typing, recording camera, or submitting a form.
 * IMPORTANT: Does NOT match Chart.js/Leaflet <canvas> or pre-filled Settings/Login forms!
 */
export function isUserBusyWithForm(): boolean {
  try {
    if (typeof document === 'undefined') return false;

    // 1. Active form submission / sync / upload flag
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.aphro_is_submitting_form || w.aphro_is_syncing || w.aphro_is_uploading) {
        return true;
      }
    }

    // 2. Live camera video stream or explicit camera/watermark processing
    const activeMedia = document.querySelector('video, .camera-active, .watermark-processing');
    if (activeMedia) return true;

    // 3. Explicit edit modal open (not general dialogs)
    const activeModal = document.querySelector('.modal-active, .edit-modal');
    if (activeModal) return true;

    // 4. User is currently focused inside an editable input/textarea/select
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') &&
      !(active as HTMLInputElement).readOnly &&
      !(active as HTMLInputElement).disabled
    ) {
      return true;
    }
  } catch {
    // Graceful fallback
  }

  return false;
}

/**
 * Fetch latest version from /version.json with strict cache-busting.
 */
export async function fetchLatestVersion(): Promise<AppVersionInfo | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const url = `/version.json?t=${Date.now()}`;
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[APP VERSION CHECK ERROR] HTTP status ${response.status} when fetching version.json`);
      return null;
    }

    const data = await response.json();
    if (data && typeof data.version === 'string') {
      return {
        version: data.version.trim(),
        minimumVersion: typeof data.minimumVersion === 'string' ? data.minimumVersion.trim() : undefined,
        build: data.build,
        buildId: typeof data.buildId === 'string' ? data.buildId.trim() : undefined,
        releaseDate: data.releaseDate || data.updatedAt,
        updatedAt: data.updatedAt,
      };
    }

    console.warn('[APP VERSION CHECK ERROR] Invalid payload in version.json', data);
    return null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      console.warn('[APP VERSION CHECK ERROR] Request to version.json timed out');
    } else {
      console.warn('[APP VERSION CHECK ERROR]', err?.message || err);
    }
    return null;
  }
}

/**
 * Check application version and buildId against current bundle.
 */
export async function checkApplicationVersion(currentVersion = APP_VERSION): Promise<VersionCheckResult> {
  const latestInfo = await fetchLatestVersion();

  if (!latestInfo) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      currentBuildId: APP_BUILD_ID,
      latestBuildId: APP_BUILD_ID,
      updateAvailable: false,
      forceUpdateRequired: false,
      loopDetected: false,
    };
  }

  const versionChanged = isNewerVersion(latestInfo.version, currentVersion);
  const buildChanged = Boolean(
    latestInfo.buildId &&
    APP_BUILD_ID &&
    latestInfo.buildId !== APP_BUILD_ID &&
    compareVersions(latestInfo.version, currentVersion) >= 0
  );
  const isUpdate = versionChanged || buildChanged;
  const isForce = isForceUpdateRequired(currentVersion, latestInfo.minimumVersion);

  const targetKey = latestInfo.buildId || latestInfo.version;
  const currentKey = APP_BUILD_ID || currentVersion;
  const isLoop = checkUpdateLoop(targetKey, currentKey);

  console.log(
    `[APP VERSION]\nCurrent: ${currentVersion} (${APP_BUILD_ID})\nLatest: ${latestInfo.version} (${latestInfo.buildId || '-'})\nUpdate required: ${isUpdate}\nForce update: ${isForce}${isLoop ? '\nLoop detected: true' : ''}`
  );

  return {
    currentVersion,
    latestVersion: latestInfo.version,
    currentBuildId: APP_BUILD_ID,
    latestBuildId: latestInfo.buildId,
    minimumVersion: latestInfo.minimumVersion,
    updateAvailable: isUpdate,
    forceUpdateRequired: isForce,
    loopDetected: isLoop,
    versionInfo: latestInfo,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/**
 * Safely perform application update:
 * 1. Unregister/refresh app Service Worker (/sw.js) with strict timeout so it never hangs.
 * 2. Purge browser CacheStorage (HTML/JS/CSS assets only).
 * 3. Prime fresh HTML & version module, then hard-navigate with cache-busting parameter.
 *
 * CRITICAL:
 * - DOES NOT touch Dexie IndexedDB (preserves offline data & pending Realisasi).
 * - DOES NOT touch localStorage (preserves user login & inisiasi state).
 */
export async function performAppUpdate(targetKey: string, isManualTrigger = false): Promise<void> {
  if (isManualTrigger) {
    clearUpdateLoopState();
  }
  recordUpdateAttempt(targetKey);

  const cleanupTask = async () => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('aphro_version_channel');
          channel.postMessage({ type: 'APHRO_NEW_VERSION_DETECTED', targetKey });
          channel.close();
        } catch {
          // Ignore BroadcastChannel errors
        }
      }

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        await Promise.all(
          registrations.map(async (reg) => {
            const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
            if (!scriptUrl || scriptUrl.endsWith('/sw.js')) {
              if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
              await reg.unregister().catch(() => {});
            }
          })
        );
      }

      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await caches.keys().catch(() => []);
        await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
      }

      if (typeof window !== 'undefined') {
        await Promise.allSettled([
          fetch('/', { cache: 'reload', headers: { 'Cache-Control': 'no-cache' } }),
          fetch('/src/config/version.ts', { cache: 'reload', headers: { 'Cache-Control': 'no-cache' } }),
          fetch('/public/version.json?import', { cache: 'reload', headers: { 'Cache-Control': 'no-cache' } }),
        ]);
      }
    } catch (err) {
      console.warn('[APP VERSION] Notice during cache cleanup:', err);
    }
  };

  await withTimeout(cleanupTask(), 2000);

  if (typeof window !== 'undefined') {
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('_aphro_refresh', String(Date.now()));
      window.location.replace(nextUrl.toString());
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch {
      window.location.reload();
    }
  }
}
