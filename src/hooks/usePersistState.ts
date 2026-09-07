import * as React from 'react';

function safeSetLocalStorage(key: string, value: any): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (err) {
    // If quota is exceeded or storage unavailable, fail gracefully without blocking the UI thread
    console.warn(`[usePersistState] Could not save key "${key}" to localStorage:`, err);
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

  const setPersistentState = React.useCallback((value: React.SetStateAction<T>) => {
    setState((prev) => {
      const nextValue = value instanceof Function ? value(prev) : value;
      safeSetLocalStorage(key, nextValue);
      return nextValue;
    });
  }, [key]);

  return [state, setPersistentState];
}

