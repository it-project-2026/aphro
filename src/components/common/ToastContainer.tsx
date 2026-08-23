import React from 'react';
import { useUI } from '../../context/UIContext';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUI();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full px-4 pointer-events-none">
      {toasts.map((toast, idx) => {
        let bgClass = 'bg-slate-900 text-white';
        let Icon = Info;

        if (toast.type === 'success') {
          bgClass = 'bg-[#00A2B9] text-white shadow-[#00A2B9]/20';
          Icon = CheckCircle;
        } else if (toast.type === 'error') {
          bgClass = 'bg-rose-600 text-white shadow-rose-500/20';
          Icon = AlertCircle;
        } else if (toast.type === 'warning') {
          bgClass = 'bg-amber-500 text-white shadow-amber-500/20';
          Icon = AlertTriangle;
        }

        return (
          <div
            key={`${toast.id}-${idx}`}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-xl border border-white/10 ${bgClass} animate-in slide-in-from-bottom-5 duration-300`}
          >
            <div className="flex items-center space-x-3">
              <Icon className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs sm:text-sm font-medium leading-tight">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
