import { useUI } from '../context/UIContext';

export function useToast() {
  const { showToast, removeToast, toasts } = useUI();
  return { toasts, showToast, removeToast };
}
