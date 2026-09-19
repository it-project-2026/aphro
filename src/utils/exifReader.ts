import exifr from 'exifr';

export interface ExifPhotoMetadata {
  hasExif: boolean;
  dateISO?: string; // YYYY-MM-DD
  timeStr?: string; // HH:mm:ss
  formattedDate?: string; // DD-MM-YYYY
  rawDateTime?: string;
  latitude?: number;
  longitude?: number;
  formattedGps?: string;
  cameraModel?: string;
  dateDetected: boolean;
  gpsDetected: boolean;
  error?: string;
}

/**
 * Parses EXIF metadata directly from a File or Blob in the client browser.
 * Extracts DateTimeOriginal, DateTimeDigitized, DateTime and GPS coordinates.
 * Validates coordinate bounds and prevents UTC timezone day-shifts.
 */
export async function extractExifFromPhoto(file: File | Blob): Promise<ExifPhotoMetadata> {
  const result: ExifPhotoMetadata = {
    hasExif: false,
    dateDetected: false,
    gpsDetected: false,
  };

  if (!file) return result;

  try {
    // 1. Read EXIF tags with exifr
    const parsed = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      reviveValues: true,
    });

    if (!parsed) {
      return result;
    }

    result.hasExif = true;

    // 2. Parse Date & Time (Priority: DateTimeOriginal -> DateTimeDigitized -> CreateDate -> DateTime)
    const rawDateObj =
      parsed.DateTimeOriginal ||
      parsed.DateTimeDigitized ||
      parsed.CreateDate ||
      parsed.DateTime;

    if (rawDateObj) {
      if (rawDateObj instanceof Date && !isNaN(rawDateObj.getTime())) {
        const year = rawDateObj.getFullYear();
        const month = String(rawDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(rawDateObj.getDate()).padStart(2, '0');
        const hours = String(rawDateObj.getHours()).padStart(2, '0');
        const minutes = String(rawDateObj.getMinutes()).padStart(2, '0');
        const seconds = String(rawDateObj.getSeconds()).padStart(2, '0');

        result.dateISO = `${year}-${month}-${day}`;
        result.formattedDate = `${day}-${month}-${year}`;
        result.timeStr = `${hours}:${minutes}:${seconds}`;
        result.rawDateTime = rawDateObj.toISOString();
        result.dateDetected = true;
      } else if (typeof rawDateObj === 'string' && rawDateObj.trim()) {
        const str = rawDateObj.trim();
        // Match EXIF date format 'YYYY:MM:DD HH:MM:SS' or 'YYYY-MM-DD'
        const match = str.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
        if (match) {
          const [, year, month, day, h, m, s] = match;
          result.dateISO = `${year}-${month}-${day}`;
          result.formattedDate = `${day}-${month}-${year}`;
          if (h && m && s) {
            result.timeStr = `${h}:${m}:${s}`;
          }
          result.rawDateTime = str;
          result.dateDetected = true;
        }
      }
    }

    // 3. Parse GPS Coordinates accurately
    let lat: number | undefined;
    let lng: number | undefined;

    // Helper to safely parse DMS array or decimal number with N/S/E/W reference direction
    const parseCoordVal = (val: any, ref?: string): number | undefined => {
      if (val === undefined || val === null) return undefined;
      let num: number | undefined;
      if (typeof val === 'number' && !isNaN(val)) {
        num = val;
      } else if (Array.isArray(val) && val.length >= 1) {
        const deg = Number(val[0]) || 0;
        const min = Number(val[1]) || 0;
        const sec = Number(val[2]) || 0;
        num = deg + min / 60 + sec / 3600;
      } else if (typeof val === 'string' && val.trim()) {
        const n = parseFloat(val);
        if (!isNaN(n)) num = n;
      }

      if (num !== undefined && ref) {
        const r = String(ref).trim().toUpperCase();
        if ((r === 'S' || r === 'W') && num > 0) {
          num = -num;
        }
      }
      return num;
    };

    // First try exifr.gps(file) dedicated helper
    try {
      const gpsObj = await exifr.gps(file);
      if (gpsObj && typeof gpsObj.latitude === 'number' && typeof gpsObj.longitude === 'number') {
        lat = gpsObj.latitude;
        lng = gpsObj.longitude;
      }
    } catch (e) {
      // Ignore fallback
    }

    // Fallback to parsed tags if exifr.gps was incomplete
    if (lat === undefined || lng === undefined) {
      if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
        lat = parseCoordVal(parsed.latitude, parsed.GPSLatitudeRef);
        lng = parseCoordVal(parsed.longitude, parsed.GPSLongitudeRef);
      } else if (parsed.GPSLatitude !== undefined || parsed.GPSLongitude !== undefined) {
        lat = parseCoordVal(parsed.GPSLatitude, parsed.GPSLatitudeRef);
        lng = parseCoordVal(parsed.GPSLongitude, parsed.GPSLongitudeRef);
      }
    }

    // Always enforce ref sign if reference is S or W
    const latRef = (parsed.GPSLatitudeRef || '').toString().toUpperCase();
    const lngRef = (parsed.GPSLongitudeRef || '').toString().toUpperCase();
    if (lat !== undefined && latRef === 'S' && lat > 0) lat = -lat;
    if (lng !== undefined && lngRef === 'W' && lng > 0) lng = -lng;

    // Check GPS ranges
    if (
      lat !== undefined &&
      lng !== undefined &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      // Reject exact (0,0) null-island bogus tags
      !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)
    ) {
      result.latitude = Number(lat.toFixed(6));
      result.longitude = Number(lng.toFixed(6));
      result.formattedGps = `${result.latitude}, ${result.longitude}`;
      result.gpsDetected = true;
    }

    if (parsed.Model || parsed.Make) {
      result.cameraModel = [parsed.Make, parsed.Model].filter(Boolean).join(' ');
    }
  } catch (err: any) {
    console.warn('[exifReader] EXIF parsing non-blocking error:', err);
    result.error = err?.message || 'Gagal membaca EXIF';
  }

  return result;
}
