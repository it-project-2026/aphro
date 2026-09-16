/**
 * Utility to stamp metadata watermarks (Timestamp, User Name, ULP Name, GPS Lat/Long, Logo)
 * directly onto a photo canvas before upload/saving.
 */

export interface WatermarkParams {
  imageFile: File | Blob | string; // File, Blob or base64 dataUrl
  userName: string;
  ulpName: string;
  nomorWO?: string;
  noTiang?: string;
  latitude: number;
  longitude: number;
  customTimestamp?: string;
  maxDimension?: number;
  quality?: number;
}

export function generateWatermarkedImage(params: WatermarkParams): Promise<string> {
  return new Promise((resolve, reject) => {
    let objectUrlToRevoke: string | null = null;
    let sourceSrc = '';

    if (typeof params.imageFile === 'string') {
      sourceSrc = params.imageFile;
    } else if (params.imageFile instanceof Blob || params.imageFile instanceof File) {
      objectUrlToRevoke = URL.createObjectURL(params.imageFile);
      sourceSrc = objectUrlToRevoke;
    } else {
      reject(new Error('Format file foto tidak valid'));
      return;
    }

    const img = new Image();

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
        objectUrlToRevoke = null;
      }
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Disable alpha channel for 25% memory savings & faster rendering
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas 2D context tidak tersedia'));
          return;
        }

        // Set canvas to max 1280px while preserving aspect ratio
        let width = img.width || 1280;
        let height = img.height || 960;
        const MAX_SIZE = params.maxDimension || 1280;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // 1. Draw original photo onto resized canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Instantly release decoded HTMLImageElement bitmap memory from browser cache
        cleanup();

        // 2. Watermark Bar dimensions & design (Preserving EXACT existing styling)
        const barHeight = Math.max(70, Math.round(height * 0.12));
        const padding = Math.max(16, Math.round(width * 0.02));

        // Dark translucent gradient background bar at bottom
        const gradient = ctx.createLinearGradient(0, height - barHeight - 20, 0, height);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
        gradient.addColorStop(0.3, 'rgba(15, 23, 42, 0.75)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - barHeight - 30, width, barHeight + 30);

        // Font sizing relative to width
        const fontSizeTitle = Math.max(14, Math.round(width * 0.022));
        const fontSizeBody = Math.max(12, Math.round(width * 0.017));

        // Left Column - App & WO Info
        ctx.textBaseline = 'top';

        // PLN / APHRO Badge Header
        ctx.fillStyle = '#00A3E0'; // Cyan/PLN Blue accent
        ctx.font = `bold ${fontSizeTitle}px "Plus Jakarta Sans", sans-serif`;
        const appText = `⚡ APHRO - ASSET PROTECTION | ${(params.ulpName || 'ULP').toUpperCase()}`;
        ctx.fillText(appText, padding, height - barHeight + 4);

        // Timestamp & User
        const timestampStr = params.customTimestamp || new Date().toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'medium',
        });

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `500 ${fontSizeBody}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(`📅 ${timestampStr}`, padding, height - barHeight + fontSizeTitle + 10);
        
        let petugasInfo = `👤 Petugas: ${params.userName || 'Petugas'}`;
        if (params.nomorWO) petugasInfo += ` | WO: ${params.nomorWO}`;
        if (params.noTiang) petugasInfo += ` | TIANG: ${params.noTiang}`;
        
        ctx.fillText(petugasInfo, padding, height - barHeight + fontSizeTitle + fontSizeBody + 16);

        // Right Column - Coordinates & GPS Badge
        const lat = typeof params.latitude === 'number' ? params.latitude : 0;
        const lon = typeof params.longitude === 'number' ? params.longitude : 0;
        const gpsText = `📍 GPS: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        const gpsWidth = ctx.measureText(gpsText).width;
        const rightX = Math.max(width - padding - gpsWidth, width / 2);

        // Coordinate background box
        ctx.fillStyle = 'rgba(2, 132, 199, 0.85)'; // Sky blue pill
        const pillHeight = fontSizeBody + 10;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(rightX - 10, height - barHeight + 8, gpsWidth + 20, pillHeight, 6);
        } else {
          ctx.rect(rightX - 10, height - barHeight + 8, gpsWidth + 20, pillHeight);
        }
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${fontSizeBody}px "Plus Jakarta Sans", monospace`;
        ctx.fillText(gpsText, rightX, height - barHeight + 13);

        // Subtitle status under GPS
        ctx.fillStyle = '#cbd5e1';
        ctx.font = `400 ${fontSizeBody - 2}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(`Verified Asset Coordinates`, rightX, height - barHeight + pillHeight + 14);

        // Single-pass JPEG compression export (quality 0.78 produces ~150KB-250KB file)
        const quality = params.quality || 0.78;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Immediately release canvas GPU memory
        canvas.width = 0;
        canvas.height = 0;

        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Gagal memuat atau memproses foto. Silakan coba ambil foto kembali.'));
    };

    img.src = sourceSrc;
  });
}

/**
 * Creates high resolution colored placeholder canvas images with realistic asset/tree/ROW scenes
 * for default initial demonstration.
 */
export function createPlaceholderPhoto(
  title: string,
  badgeText: string,
  bgColor1: string,
  bgColor2: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 1280, 800);
  grad.addColorStop(0, bgColor1);
  grad.addColorStop(1, bgColor2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 800);

  // Decorative Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 1280; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 800);
    ctx.stroke();
  }
  for (let y = 0; y < 800; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1280, y);
    ctx.stroke();
  }

  // Draw Asset Powerline & Tree Silhouette
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  // Power Pole
  ctx.fillRect(300, 150, 24, 650);
  ctx.fillRect(200, 200, 224, 16);
  ctx.fillRect(180, 250, 264, 16);
  // Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 200); ctx.lineTo(1280, 210);
  ctx.moveTo(0, 250); ctx.lineTo(1280, 260);
  ctx.stroke();

  // Trees / ROW vegetation silhouette
  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.beginPath();
  ctx.arc(850, 600, 220, 0, Math.PI * 2);
  ctx.arc(1050, 580, 200, 0, Math.PI * 2);
  ctx.arc(680, 650, 180, 0, Math.PI * 2);
  ctx.fill();

  // Center Badge
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(340, 320, 600, 160, 20);
  ctx.fill();

  ctx.strokeStyle = '#00A3E0';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#00A3E0';
  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText.toUpperCase(), 640, 375);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.fillText(title, 640, 430);

  return canvas.toDataURL('image/jpeg', 0.9);
}
