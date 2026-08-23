import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  borderColor?: string;
  trend?: {
    text: string;
    isUp?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-teal-50 dark:bg-teal-900/30',
  iconColor = 'text-teal-600 dark:text-teal-400',
  borderColor = 'border-slate-200 dark:border-slate-800',
  trend,
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-slate-800/90 rounded-2xl p-5 border ${borderColor} shadow-sm hover:shadow-md transition-all duration-300 group`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
            {title}
          </p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {value}
            </h3>
            {trend && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  trend.isUp
                    ? 'bg-teal-100 text-[#008396] dark:bg-teal-900/40 dark:text-teal-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                }`}
              >
                {trend.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={`p-3 rounded-xl ${iconBgColor} ${iconColor} group-hover:scale-110 transition-transform duration-300 shadow-2xs`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00A2B9]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
};
