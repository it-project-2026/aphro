import * as React from 'react';

interface ToastState {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface UIContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  selectedWoIdForRealisasi: string | null;
  setSelectedWoIdForRealisasi: (id: string | null) => void;
  toasts: ToastState[];
  showToast: (message: string, type?: ToastState['type']) => void;
  removeToast: (id: string) => void;
}

const UIContext = React.createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = React.useState<string>('dashboard');
  const [isDarkMode, setIsDarkMode] = React.useState<boolean>(() => {
    return localStorage.getItem('aphro_dark_mode') === 'true';
  });
  const [selectedWoIdForRealisasi, setSelectedWoIdForRealisasi] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<ToastState[]>([]);

  React.useEffect(() => {
    try {
      localStorage.setItem('aphro_dark_mode', String(isDarkMode));
    } catch (e) {
      console.warn('Unable to save dark mode setting:', e);
    }
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = React.useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const showToast = React.useCallback((message: string, type: ToastState['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <UIContext.Provider value={{ 
      activeTab, 
      setActiveTab, 
      isDarkMode, 
      toggleDarkMode,
      selectedWoIdForRealisasi,
      setSelectedWoIdForRealisasi,
      toasts,
      showToast,
      removeToast
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = React.useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
