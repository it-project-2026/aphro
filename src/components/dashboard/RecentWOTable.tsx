import React from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { WorkOrder } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface RecentWOTableProps {
  filteredWOs: WorkOrder[];
  pendingIds: string[];
  draggable: any;
}

export const RecentWOTable: React.FC<RecentWOTableProps> = ({ filteredWOs, pendingIds, draggable }) => {
  return (
    <div 
      ref={draggable.ref}
      onMouseDown={draggable.onMouseDown}
      onMouseUp={draggable.onMouseUp}
      onMouseLeave={draggable.onMouseLeave}
      onMouseMove={draggable.onMouseMove}
      className="overflow-x-auto"
      style={draggable.style}
    >
      <table className="w-full text-left text-[9px]">
        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest text-[10px]">
          <tr>
            <th className="p-4 pl-6">Nomor WO</th>
            <th className="p-4">Penyulang & ULP</th>
            <th className="p-4">Regu / Petugas</th>
            <th className="p-4 pr-6 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredWOs.slice(0, 10).map((wo, idx) => (
            <tr
              key={wo.id ? `wo-${wo.id}-${idx}` : `wo-idx-${idx}`}
              className="hover:bg-teal-50/50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <td className="p-4 pl-6">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-[#00A2B9] dark:text-teal-400 text-[11px]">
                    {wo.nomorWO}
                  </span>
                  {pendingIds.includes(wo.id) ? (
                    <span title="Menunggu Sinkronisasi" className="text-amber-500">
                      <CloudOff className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span title="Tersinkron" className="text-teal-500">
                      <Cloud className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </td>
              <td className="p-4">
                <p className="font-black text-slate-800 dark:text-white uppercase truncate">
                  {wo.penyulangName}
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">{wo.ulpName}</p>
              </td>
              <td className="p-4">
                <p className="font-black text-[#008396] dark:text-teal-400 uppercase">
                  {wo.petugasName}
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">{wo.reguName}</p>
              </td>
              <td className="p-4 pr-6 text-center">
                <StatusBadge status={wo.status} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
