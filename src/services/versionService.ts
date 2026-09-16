/**
 * Version Management Service for APHRO
 * Handles semantic version comparison, cache-busted version fetching,
 * force update policies, form busy detection, and safe asset updates.
 *
 * CRITICAL SAFETY RULES:
 * - NEVER deletes Dexie IndexedDB database.
 * - NEVER deletes pending / queued / synced Realisasi data.
 * - NEVER deletes localStorage user credentials or initiation state.
 * - Only refreshes browser HTTP CacheStorage and Service Worker caches.
 */

import { APP_VERSION } from '../config/version';

export interface AppVersionInfo {
  version: string;
  minimumVersion?: string;
  build?: string;
  releaseDate?: string;
  updatedAt?: string;
}

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
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
 * Supports:
 * - Semver: "1.0.4", "1.0.5", "1.9.9", "1.10.0"
 * - Calver: "2026.09.15.01", "2026.09.16.01"
 * - Prefixes: "v1.0.5" -> "1.0.5"
 *
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  // Clean strings
  const clean1 = v1.toString().trim().replace(/^[vV]/, '');
  const clean2 = v2.toString().trim().replace(/^[vV]/, '');

  if (clean1 === clean2) return 0;

  // Split into components (dots, hyphens)
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
      // String comparison
      const cmp = p1.localeCompare(p2, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp > 0 ? 1 : -1;
    }
  }

  return 0;
}

/**
 * Check if latest is strictly newer than current.
 * Prevents downgrading if current > latest.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

/**
 * Check if current version is below the required minimum version.
 */
export function isForceUpdateRequired(current: string, minimumVersion?: string): boolean {
  if (!minimumVersion) return false;
  return compareVersions(current, minimumVersion) < 0;
}

/**
 * Detect update loop to prevent infinite reload cycles.
 */
export function checkUpdateLoop(targetVersion: string, currentVersion: string): boolean {
  try {
    const storedTarget = sessionStorage.getItem(STORAGE_KEYS.TARGET_VERSION);
    const attempts = Number(sessionStorage.getItem(STORAGE_KEYS.UPDATE_ATTEMPTS)) || 0;

    // If current version has successfully updated to target, clear counters
    if (storedTarget && compareVersions(currentVersion, storedTarget) >= 0) {
      sessionStorage.removeItem(STORAGE_KEYS.TARGET_VERSION);
      sessionStorage.removeItem(STORAGE_KEYS.UPDATE_ATTEMPTS);
      return false;
    }

    // If we've already tried to update to this version >= 2 times and current is still older
    if (storedTarget === targetVersion && attempts >= 2) {
      return true;
    }
  } catch {
    // Gracefully handle storage errors
  }
  return false;
}

/**
 * Record an update reload attempt.
 */
export function recordUpdateAttempt(targetVersion: string): void {
  try {
    const storedTarget = sessionStorage.getItem(STORAGE_KEYS.TARGET_VERSION);
    const currentAttempts = storedTarget === targetVersion
      ? (Number(sessionStorage.getItem(STORAGE_KEYS.UPDATE_ATTEMPTS)) || 0)
      : 0;

    sessionStorage.setItem(STORAGE_KEYS.TARGET_VERSION, targetVersion);
    sessionStorage.setItem(STORAGE_KEYS.UPDATE_ATTEMPTS, String(currentAttempts + 1));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Check if the user is currently actively filling or typing in a form
 * (e.g. Realisasi, Absensi, or Work Order).
 */
export function isUserBusyWithForm(): boolean {
  try {
    if (typeof document === 'undefined') return false;

    // 1. Is an input/textarea currently focused?
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return true;
    }

    // 2. Are there any inputs with non-empty values inside an active form?
    const textInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'form input[type="text"], form input[type="number"], form textarea'
    );
    for (const input of Array.from(textInputs)) {
      if (input.value && input.value.trim().length > 0 && !input.readOnly && !input.disabled) {
        return true;
      }
    }

    // 3. Check for specific form indicators or open dialogs
    const activeModal = document.querySelector('[role="dialog"], .modal-active, .edit-modal');
    if (activeModal) return true;
  } catch {
    // Graceful fallback
  }

  return false;
}

/**
 * Fetch latest version from /version.json with strict cache-busting.
 * Does not crash if offline or network fails.
 */
export async function fetchLatestVersion(): Promise<AppVersionInfo | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    // Cache busting via query param + no-store headers
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
 * Check application version and compare against current bundle.
 * Logs status according to Rule 17.
 */
export async function checkApplicationVersion(currentVersion = APP_VERSION): Promise<VersionCheckResult> {
  const latestInfo = await fetchLatestVersion();

  if (!latestInfo) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      forceUpdateRequired: false,
      loopDetected: false,
    };
  }

  const isUpdate = isNewerVersion(latestInfo.version, currentVersion);
  const isForce = isForceUpdateRequired(currentVersion, latestInfo.minimumVersion);
  const isLoop = checkUpdateLoop(latestInfo.version, currentVersion);

  // Standard logging (Rule 17)
  console.log(
    `[APP VERSION]\nCurrent: ${currentVersion}\nLatest: ${latestInfo.version}\nUpdate required: ${isUpdate}\nForce update: ${isForce}${isLoop ? '\nLoop detected: true' : ''}`
  );

  return {
    currentVersion,
    latestVersion: latestInfo.version,
    minimumVersion: latestInfo.minimumVersion,
    updateAvailable: isUpdate,
    forceUpdateRequired: isForce,
    loopDetected: isLoop,
    versionInfo: latestInfo,
  };
}

/**
 * Safely perform application update:
 * 1. Tell Service Worker to activate immediately.
 * 2. Purge browser CacheStorage (JS/CSS assets only).
 * 3. Reload application to fetch fresh bundle.
 *
 * CRITICAL:
 * - DOES NOT touch Dexie IndexedDB (preserves offline data & pending Realisasi).
 * - DOES NOT touch localStorage (preserves user login & inisiasi state).
 */
export async function performAppUpdate(targetVersion: string): Promise<void> {
  recordUpdateAttempt(targetVersion);

  try {
    // 1. Update & notify Service Worker if active
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    }

    // 2. Clear browser HTTP CacheStorage only (HTML, CSS, JS bundles)
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('[APP VERSION] Notice during cache cleanup:', err);
  } finally {
    // 3. Reload application
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
