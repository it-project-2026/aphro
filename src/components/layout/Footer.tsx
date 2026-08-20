import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Phone, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  const { settings } = useSettings();

  return (
    <footer className="mt-auto border-t-2 border-emerald-100 bg-emerald-50 dark:bg-slate-900/80 backdrop-blur-xs py-4 sm:py-6 px-3 sm:px-6 pb-24 lg:pb-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
        <div className="space-y-0.5">
          <p className="font-black text-black dark:text-slate-200 text-xs sm:text-sm uppercase tracking-tighter">
            {settings.namaUnitLayanan}
          </p>
          <p className="text-[10px] sm:text-xs font-bold text-slate-500">© 13307BKT- 2026 PLN ES UP4 Sumatera Barat. All rights reserved.</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-[10px] sm:text-[11px]">
          <a
            href={`https://wa.me/${settings.kontakAdmin.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 transition-colors font-black shadow-sm"
          >
            <Phone className="w-3 h-3 text-red-600 shrink-0" />
            <span>WA: +{settings.kontakAdmin.whatsapp}</span>
          </a>

          <a
            href={`mailto:${settings.kontakAdmin.email}`}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white dark:bg-sky-950/40 text-black dark:text-sky-300 border border-emerald-200 dark:border-sky-800/60 hover:bg-emerald-50 transition-colors font-black shadow-sm"
          >
            <Mail className="w-3 h-3 text-red-600 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-none">{settings.kontakAdmin.email}</span>
          </a>

          <div className="hidden sm:flex items-center space-x-1 text-slate-700 font-bold">
            <MapPin className="w-3 h-3 text-red-600 shrink-0" />
            <span className="truncate max-w-xs">{settings.kontakAdmin.alamat}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
