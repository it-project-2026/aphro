export function formatDateTime(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(dateInput);
  }
}

export function formatDateOnly(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(dateInput);
  }
}

export function formatExecutionDateTime(rel?: any, wo?: any): string {
  if (!rel && !wo) return '-';

  // 1. Check if photo timestamp exists (e.g. "12-08-2026 17:00:00")
  const photoTs = rel?.photosSebelum?.[0]?.timestamp || rel?.photosSesudah?.[0]?.timestamp;
  if (photoTs && typeof photoTs === 'string') {
    if (/\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}/.test(photoTs)) {
      return photoTs;
    }
    const formatted = formatDateTime(photoTs);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 2. Check createdAt or ISO timestamp
  const createdAtVal = rel?.createdAt || wo?.createdAt;
  if (createdAtVal) {
    const formatted = formatDateTime(createdAtVal);
    if (formatted !== '-' && !formatted.endsWith('00:00:00')) {
      return formatted;
    }
  }

  // 3. Fallback to tanggalRealisasi or wo.tanggal
  const dateBase = rel?.tanggalRealisasi || wo?.tanggal || rel?.createdAt || wo?.createdAt;
  if (!dateBase) return '-';

  const formatted = formatDateTime(dateBase);

  // If time is 00:00:00, replace with time from createdAt or realistic execution time (e.g. 17:00:00)
  if (formatted.endsWith('00:00:00')) {
    if (createdAtVal) {
      try {
        const d = new Date(createdAtVal);
        if (!isNaN(d.getTime())) {
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const ss = String(d.getSeconds()).padStart(2, '0');
          if (hh !== '00' || mm !== '00' || ss !== '00') {
            return formatted.replace('00:00:00', `${hh}:${mm}:${ss}`);
          }
        }
      } catch {
        // ignore
      }
    }
    return formatted.replace('00:00:00', '17:00:00');
  }

  return formatted;
}
