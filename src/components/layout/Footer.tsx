import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Phone, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  const { settings } = useSettings();

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs py-4 sm:py-6 px-3 sm:px-6 pb-24 lg:pb-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
        <div className="space-y-0.5">
          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
            {settings.namaUnitLayanan}
          </p>
          <p className="text-[10px] sm:text-xs">{settings.footerText}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-[10px] sm:text-[11px]">
          <a
            href={`https://wa.me/${settings.kontakAdmin.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors"
          >
            <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>WA: +{settings.kontakAdmin.whatsapp}</span>
          </a>

          <a
            href={`mailto:${settings.kontakAdmin.email}`}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 hover:bg-sky-100 transition-colors"
          >
            <Mail className="w-3 h-3 text-sky-500 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-none">{settings.kontakAdmin.email}</span>
          </a>

          <div className="hidden sm:flex items-center space-x-1 text-slate-500">
            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
            <span className="truncate max-w-xs">{settings.kontakAdmin.alamat}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
