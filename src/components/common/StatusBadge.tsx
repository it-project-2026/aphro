import React from 'react';
import { WOStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface StatusBadgeProps {
  status: WOStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  let bgColor = '';
  let textColor = '';
  let borderColor = '';
  let IconComponent = Clock;

  switch (status) {
    case 'Selesai':
    case 'SELESAI':
      bgColor = 'bg-emerald-500/10 dark:bg-emerald-500/20';
      textColor = 'text-emerald-700 dark:text-emerald-300';
      borderColor = 'border-emerald-500/30';
      IconComponent = CheckCircle2;
      break;
    case 'Sedang Dikerjakan':
      bgColor = 'bg-amber-500/10 dark:bg-amber-500/20';
      textColor = 'text-amber-700 dark:text-amber-300';
      borderColor = 'border-amber-500/30';
      IconComponent = Clock;
      break;
    case 'Belum Dikerjakan':
    case 'BELUM SELESAI':
    default:
      bgColor = 'bg-rose-500/10 dark:bg-rose-500/20';
      textColor = 'text-rose-700 dark:text-rose-300';
      borderColor = 'border-rose-500/30';
      IconComponent = AlertTriangle;
      break;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs sm:text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${bgColor} ${textColor} ${borderColor} ${sizeClasses} transition-all duration-200 shadow-2xs whitespace-nowrap`}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
      <span>{status}</span>
    </span>
  );
};
