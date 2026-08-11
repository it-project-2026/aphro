import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Phone, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  const { settings } = useSettings();

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 px-4 sm:px-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="text-center md:text-left space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {settings.namaUnitLayanan}
          </p>
          <p>{settings.footerText}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
          <a
            href={`https://wa.me/${settings.kontakAdmin.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 hover:text-emerald-600 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-500" />
            <span>WA: +{settings.kontakAdmin.whatsapp}</span>
          </a>

          <a
            href={`mailto:${settings.kontakAdmin.email}`}
            className="flex items-center space-x-1 hover:text-sky-600 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-sky-500" />
            <span>{settings.kontakAdmin.email}</span>
          </a>

          <div className="hidden lg:flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            <span className="truncate max-w-xs">{settings.kontakAdmin.alamat}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
