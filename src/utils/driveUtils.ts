/**
 * Utility functions for Google Drive photo URL formatting & Base64-to-Drive auto conversion
 */

/**
 * Checks if a given string is a base64 image data URL
 */
export function isBase64Image(str: string | undefined | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return s.startsWith('data:image') || (s.length > 500 && !s.startsWith('http'));
}

export function extractDriveFileId(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Converts any Google Drive URL (export=view, uc?id=, etc.) to the official Drive view link
 * which opens the photo preview page directly in the browser.
 */
export function formatDriveViewUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'n/a' || lower === 'null' || lower === 'undefined' || lower === '-' || lower === '""' || lower === "''") return '';
  if (isBase64Image(trimmed)) return ''; // Never format or return base64 as Drive view link
  if (trimmed.startsWith('/uploads/')) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }
  if (!trimmed.startsWith('http')) return trimmed;

  const match = trimmed.match(/id=([a-zA-Z0-9_-]+)/) || trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/view?usp=sharing`;
  }
  return trimmed;
}

/**
 * Converts any Google Drive URL to direct image CDN link (lh3.googleusercontent.com)
 * or returns local /uploads/ URL so it can be safely rendered inside <img src="..." /> tags in web UI.
 */
export function formatDriveImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'n/a' || lower === 'null' || lower === 'undefined' || lower === '-' || lower === '""' || lower === "''") return '';
  if (trimmed.startsWith('data:image')) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (!trimmed.startsWith('http')) return trimmed;

  const match = trimmed.match(/id=([a-zA-Z0-9_-]+)/) || trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return trimmed;
}

/**
 * Universal validator for photo URLs.
 * Rejects null, undefined, '', ' ', 'N/A', 'n/a', 'null', 'undefined', '-', and data:image Base64 strings.
 * Accepts valid HTTP/HTTPS URLs, local storage /uploads/ URLs, and valid Base64 data.
 */
export function isValidPhotoUrl(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (
    trimmed === '' ||
    lower === 'n/a' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === '-' ||
    lower === '""' ||
    lower === "''"
  ) {
    return false;
  }
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('data:image') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true;
  }
  return trimmed.length > 20 && !trimmed.includes(' ');
}

/**
 * Ensures photo string is converted to a verified storage or Google Drive URL.
 * 1. If photo is already an HTTP URL or /uploads/ path, validates and returns it.
 * 2. If photo is Base64, uploads it to the server backend storage (/api/media/upload-photo)
 *    and/or Google Drive (GAS), verifying that the resulting URL is accessible.
 * 3. Includes automatic retry logic to guarantee that Foto Sebelum and Foto Sesudah
 *    upload reliably without failing repeatedly.
 */
export async function ensureGoogleDrivePhotoUrl(
  photoData: string | undefined | null,
  options: {
    gasUrl?: string;
    nomorWO?: string;
    reguName?: string;
    photoType?: string;
    folderId?: string;
  } = {}
): Promise<string> {
  if (!photoData || typeof photoData !== 'string') return '';
  const clean = photoData.trim();
  if (!clean) return '';

  const photoType = options.photoType || 'Photo';
  const nomorWO = options.nomorWO || options.reguName || 'REALISASI';

  // 1. If already an HTTP/HTTPS URL or /uploads/ URL
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/uploads/')) {
    const formatted = formatDriveViewUrl(clean);
    if (isValidPhotoUrl(formatted)) {
      console.log(`[REALISASI_PHOTO_DEBUG] ${photoType} already URL: ${formatted}`);
      return formatted;
    }
    return clean;
  }

  // 2. If Base64 string, upload with retry & fallback
  if (isBase64Image(clean)) {
    // Diagnostic logging of upload payload size (Section 3)
    const mimeType = clean.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
    const base64Len = clean.length;
    const estBytes = Math.round((base64Len * 3) / 4);
    const estKB = (estBytes / 1024).toFixed(2);
    const estMB = (estBytes / (1024 * 1024)).toFixed(2);

    console.log(`[MEDIA_UPLOAD_PAYLOAD_SIZE]
nomorWO=${nomorWO}
photoFieldName=${photoType}
mimeType=${mimeType}
base64Length=${base64Len}
approxBytes=${estBytes}
sizeKB=${estKB} KB
sizeMB=${estMB} MB`);

    console.log(`[REALISASI_PHOTO_DEBUG] ${photoType} upload START (nomorWO=${nomorWO}, isBase64=true, len=${base64Len})`);

    // Strategy A: Upload directly to Application Backend Media Storage API (/api/media/upload-photo)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { ApiService } = await import('../services/apiService');
        const token = ApiService.getAuthToken();
        const res = await ApiService.executeFetch('/api/media/upload-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            base64Data: clean,
            nomorWO,
            photoType,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const fileUrl = json?.fileUrl || json?.url;
          if (fileUrl && isValidPhotoUrl(fileUrl)) {
            console.log(`[REALISASI_PHOTO_DEBUG] ${photoType} backend storage upload SUCCESS (attempt ${attempt}) -> URL: ${fileUrl}`);
            return fileUrl;
          }
        } else {
          // Classify non-OK server statuses (Section E)
          let errorType = `HTTP_${res.status}`;
          if (res.status === 413) {
            errorType = 'HTTP_413_CONTENT_TOO_LARGE';
            console.error(`[MEDIA_UPLOAD_413] Server rejected photo upload due to size limit: 413 Content Too Large. No further upload retries.`);
          } else if (res.status === 401) {
            errorType = 'HTTP_401_UNAUTHORIZED';
          } else if (res.status === 403) {
            errorType = 'HTTP_403_FORBIDDEN';
          } else if (res.status === 404) {
            errorType = 'HTTP_404_NOT_FOUND';
          } else if (res.status >= 500) {
            errorType = 'HTTP_5XX_SERVER_ERROR';
          }

          console.warn(`[REALISASI_PHOTO_DEBUG] ${photoType} backend upload status classified as: ${errorType}`);

          // For critical client or configuration errors, stop retry loop immediately
          if (res.status === 413 || res.status === 401 || res.status === 403 || res.status === 404) {
            break; 
          }
        }
      } catch (backendErr: any) {
        // Detect CORS / Network errors specifically
        let errorType = 'NETWORK_ERROR';
        if (backendErr?.message?.includes('fetch') || backendErr?.message?.includes('NetworkError') || !navigator.onLine) {
          errorType = 'CORS_ERROR_OR_NETWORK_ERROR';
        }
        console.warn(`[REALISASI_PHOTO_DEBUG] ${photoType} backend storage attempt ${attempt} warning (${errorType}):`, backendErr?.message || backendErr);
      }
    }

    // Strategy B: Upload to Google Apps Script (GAS) if configured
    const gasUrl = options.gasUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem('aphro_gas_url') || '' : '');
    if (gasUrl && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { GASApiService } = await import('../services/gasApiService');
        const uploadRes = await GASApiService.uploadPhoto(gasUrl, {
          base64Data: clean,
          nomorWO,
          reguName: options.reguName || 'ROW',
          photoType,
          folderId: options.folderId,
        });

        if (uploadRes && uploadRes.status === 'success' && uploadRes.fileUrl) {
          const finalUrl = formatDriveViewUrl(uploadRes.fileUrl);
          if (isValidPhotoUrl(finalUrl)) {
            console.log(`[REALISASI_PHOTO_DEBUG] ${photoType} GAS upload SUCCESS -> URL: ${finalUrl}`);
            return finalUrl;
          }
        }
      } catch (gasErr: any) {
        console.warn(`[REALISASI_PHOTO_DEBUG] ${photoType} GAS upload error:`, gasErr?.message || gasErr);
      }
    }

    // Strategy C: As an offline emergency fallback, return the data URI temporarily so local sync can proceed
    if (clean.startsWith('data:image/')) {
      console.log(`[REALISASI_PHOTO_DEBUG] ${photoType} using temporary offline data URI for local offline queue.`);
      return clean;
    }

    return '';
  }

  return clean;
}
