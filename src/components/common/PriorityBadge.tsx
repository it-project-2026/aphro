import React from 'react';
import { WOPriority } from '../../types';

interface PriorityBadgeProps {
  priority: WOPriority;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  let colorStyle = '';
  switch (priority) {
    case 'Tinggi':
      colorStyle = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      break;
    case 'Sedang':
      colorStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      break;
    case 'Rendah':
    default:
      colorStyle = 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${colorStyle}`}
    >
      {priority}
    </span>
  );
};
