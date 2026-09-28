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
  if (isBase64Image(url)) return ''; // Never format or return base64 as Drive view link
  if (!url.startsWith('http')) return url;

  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/view?usp=sharing`;
  }
  return url;
}

/**
 * Converts any Google Drive URL to direct image CDN link (lh3.googleusercontent.com)
 * so it can be safely rendered inside <img src="..." /> tags in web UI.
 */
export function formatDriveImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image')) return url;
  if (!url.startsWith('http')) return url;

  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

/**
 * Ensures photo string is converted to a Google Drive URL via GASApiService.uploadPhoto.
 * If photo is already an HTTP Google URL, returns formatted Google Drive link.
 * If photo is Base64, uploads it to Google Drive and returns the Google Drive URL.
 * If upload fails or offline, returns empty string so base64 IS NEVER saved to database.
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

  // 1. If already an HTTP/HTTPS URL
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return formatDriveViewUrl(clean);
  }

  // 2. If Base64 string, upload to Google Drive
  if (isBase64Image(clean)) {
    const gasUrl = options.gasUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem('aphro_gas_url') || '' : '');
    const photoType = options.photoType || 'Photo';
    const nomorWO = options.nomorWO || options.reguName || 'REALISASI';

    console.log(`[PHOTO_UPLOAD_START] type=${photoType} nomorWO=${nomorWO} online=${typeof navigator !== 'undefined' ? navigator.onLine : false}`);

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
          console.log(`[PHOTO_UPLOAD_SUCCESS] type=${photoType} nomorWO=${nomorWO} url=${finalUrl}`);
          return finalUrl;
        } else {
          console.warn(`[PHOTO_UPLOAD_FAILED] type=${photoType} nomorWO=${nomorWO} message=${uploadRes?.message || 'Unknown response'}`);
        }
      } catch (e: any) {
        console.warn(`[PHOTO_UPLOAD_FAILED] type=${photoType} nomorWO=${nomorWO} error=${e?.message || 'Upload exception'}`);
      }
    } else {
      console.warn(`[PHOTO_UPLOAD_FAILED] type=${photoType} nomorWO=${nomorWO} reason=${!gasUrl ? 'GAS URL not configured' : 'Device offline'}`);
    }
    // Never return base64 data to be written into Database
    return '';
  }

  return clean;
}
