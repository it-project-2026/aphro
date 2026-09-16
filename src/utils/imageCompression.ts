
/**
 * Utilitas untuk kompresi gambar sebelum diunggah
 * Kriteria: Max 1280px, JPEG Quality 75%, Max 300KB
 */

export const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    // 1. If empty or not image dataUrl, return as is
    if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) {
      return resolve(base64Str || '');
    }

    // 2. Check size of base64 string directly
    // Base64 size is roughly 1.33x binary size.
    // 350KB binary = ~466KB base64 content length
    const parts = base64Str.split(',');
    const base64Content = parts.length > 1 ? parts[1] : parts[0];
    const estimatedSizeBytes = Math.round((base64Content.length * 3) / 4);

    // If ALREADY <= 350KB, DO NOT RE-DECODE OR RE-CANVAS! Return immediately!
    if (estimatedSizeBytes <= 350 * 1024) {
      return resolve(base64Str);
    }

    // 3. If larger than 350KB, perform single-pass fast resize & compression
    const img = new Image();

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          cleanup();
          return resolve(base64Str);
        }

        let width = img.width || 1280;
        let height = img.height || 960;
        const MAX_SIZE = 1280;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // Immediately release source img memory
        cleanup();

        // Target single pass with quality 0.75
        const resultBase64 = canvas.toDataURL('image/jpeg', 0.75);

        // Clean up canvas
        canvas.width = 0;
        canvas.height = 0;

        resolve(resultBase64);
      } catch (err) {
        cleanup();
        resolve(base64Str);
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(base64Str);
    };

    img.src = base64Str;
  });
};
