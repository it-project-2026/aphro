import * as React from 'react';

// Helper to sanitize large base64 image strings if localStorage reaches quota
function sanitizeForStorage(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image') && obj.length > 500) {
      return '[Tersimpan di Cloud/Spreadsheet]';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForStorage(item));
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      cleaned[key] = sanitizeForStorage(obj[key]);
    }
    return cleaned;
  }
  return obj;
}

function safeSetLocalStorage(key: string, value: any): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch {
    try {
      // Step 1: Strip large base64 image data to drastically reduce size
      const sanitized = sanitizeForStorage(value);
      const sanitizedStr = JSON.stringify(sanitized);
      localStorage.setItem(key, sanitizedStr);
    } catch {
      // Fallback: silently fail writing to localStorage so React state update does NOT crash
    }
  }
}

export function usePersistState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback to default value
    }
    return defaultValue;
  });

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        setState(JSON.parse(saved));
      } else {
        setState(defaultValue);
      }
    } catch {
      setState(defaultValue);
    }
  }, [key]);

  const setPersistentState = React.useCallback((value: React.SetStateAction<T>) => {
    setState((prev) => {
      const nextValue = value instanceof Function ? value(prev) : value;
      safeSetLocalStorage(key, nextValue);
      return nextValue;
    });
  }, [key]);

  return [state, setPersistentState];
}

