
/**
 * Utilitas untuk kompresi gambar sebelum diunggah
 * Kriteria: Max 1280px, JPEG Quality 75%, Max 300KB
 */

export const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Jika bukan base64, kembalikan apa adanya
    if (!base64Str || !base64Str.startsWith('data:image')) {
      return resolve(base64Str);
    }

    const img = new Image();
    img.src = base64Str;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // 1. Resize: Max 1280px
      const MAX_SIZE = 1280;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return reject(new Error('Gagal mendapatkan context canvas'));
      }

      // Draw and Compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // 2. Initial Compression (75% quality)
      let quality = 0.75;
      let resultBase64 = canvas.toDataURL('image/jpeg', quality);

      // 3. Iterative adjustment if size > 300KB
      // Base64 size is roughly 1.33x actual file size
      const MAX_FILE_SIZE = 300 * 1024; // 300KB
      
      // Hitung estimasi ukuran dari base64
      const getBase64Size = (s: string) => {
        const parts = s.split(',');
        const base64Content = parts.length > 1 ? parts[1] : parts[0];
        return Math.round((base64Content.length * 3) / 4);
      };

      let currentSize = getBase64Size(resultBase64);
      
      // Jika masih terlalu besar, turunkan kualitas secara bertahap
      while (currentSize > MAX_FILE_SIZE && quality > 0.1) {
        quality -= 0.1;
        resultBase64 = canvas.toDataURL('image/jpeg', quality);
        currentSize = getBase64Size(resultBase64);
      }

      // Clean up canvas memory immediately
      const dataUrl = resultBase64;
      canvas.width = 0;
      canvas.height = 0;
      img.onload = null;
      img.onerror = null;

      resolve(dataUrl);
    };

    img.onerror = (err) => {
      img.onload = null;
      img.onerror = null;
      reject(err);
    };
  });
};
