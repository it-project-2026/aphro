import React from 'react';

interface TopPerformer {
  id: string;
  namaRegu: string;
  penanggungJawab: string;
  ulpName: string;
  realisasiKms: number;
  targetKms: number;
  woSelesai: number;
  totalTebang: number;
  totalPangkas: number;
  percentage: number;
}

interface TopPerformersListProps {
  topPerformersData: TopPerformer[];
}

export const TopPerformersList: React.FC<TopPerformersListProps> = ({ topPerformersData }) => {
  return (
    <div className="space-y-3">
      {topPerformersData.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-6 italic">
          Belum ada data tim ROW sesuai filter yang dipilih.
        </p>
      ) : (
        topPerformersData.map((regu, idx) => {
          const rank = idx + 1;
          const isGold = rank === 1;
          const isSilver = rank === 2;
          const isBronze = rank === 3;

          return (
            <div
              key={regu.id ? `performer-${regu.id}-${idx}` : `performer-${idx}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 gap-3 hover:border-teal-500/50 transition-all"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${
                  isGold 
                    ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 ring-2 ring-amber-300/50'
                    : isSilver 
                    ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 ring-2 ring-slate-300/50'
                    : isBronze 
                    ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-50 ring-2 ring-amber-700/50'
                    : 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                }`}>
                  {isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `#${rank}`}
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase truncate">
                    {regu.namaRegu}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    PJ: <span className="font-semibold text-slate-700 dark:text-slate-300">{regu.penanggungJawab}</span>
                    {regu.ulpName && ` • ${regu.ulpName}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200/50 dark:border-slate-800">
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {Number(regu.realisasiKms).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ {Number(regu.targetKms || 50.20).toFixed(2)} KMS</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {regu.woSelesai} WO Selesai • {regu.totalTebang + regu.totalPangkas} Pohon
                  </p>
                </div>

                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${
                  regu.percentage >= 100 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : regu.percentage >= 50
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}>
                  {regu.percentage}%
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
