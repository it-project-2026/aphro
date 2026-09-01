import React from 'react';
import { 
  Target, 
  TrendingUp, 
  Activity, 
  PieChart, 
  LayoutDashboard,
  Calendar,
  CheckCircle2,
  Zap
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface UnitData {
  id: string;
  name: string;
  realisasi: number;
  target: number;
}

interface RealisasiTargetDashboardProps {
  data: UnitData[];
  title?: string;
  subtitle?: string;
}

export const RealisasiTargetDashboard: React.FC<RealisasiTargetDashboardProps> = ({ 
  data, 
  title = "REALISASI & TARGET PROGRAM",
  subtitle = "Monitoring Penugasan"
}) => {
  const totalRealisasi = data.reduce((sum, item) => sum + item.realisasi, 0);
  const totalTarget = data.reduce((sum, item) => sum + item.target, 0);
  const percentage = totalTarget > 0 ? Math.round((totalRealisasi / totalTarget) * 100) : 0;

  const doughnutData = {
    labels: ['Realisasi', 'Sisa Target'],
    datasets: [
      {
        data: [totalRealisasi, Math.max(0, totalTarget - totalRealisasi)],
        backgroundColor: ['#00A2B9', '#e2e8f0'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  return (
    <div className="bg-[#f8fafc] rounded-[2rem] border border-teal-100 shadow-2xl overflow-hidden font-display">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#008396] via-[#00A2B9] to-[#00C2DE] p-3 text-white relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md border border-white/30">
              <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tight leading-none">{title}</h1>
              <p className="text-teal-50/70 text-[10px] mt-0.5 font-semibold uppercase tracking-wider">{subtitle}</p>
            </div>
          </div>
          <div className="bg-[#006e7e] px-2.5 py-1 rounded-lg border border-teal-400/30 flex items-center gap-2">
            <Calendar className="w-3 h-3 text-teal-300" />
            <span className="text-[10px] font-bold tracking-tight">
              {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
            </span>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/5 to-transparent skew-x-12" />
      </div>

      <div className="p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: List Table */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-[#008396] p-2.5 px-4 flex justify-between items-center text-white font-bold text-[10px] uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>TIM ROW</span>
              </div>
              <div className="flex gap-10 mr-6">
                <span>REALISASI</span>
                <span>TARGET</span>
              </div>
            </div>
            
            <div className="p-1.5 flex flex-col gap-0.5">
              {data.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-teal-50 transition-colors group">
                  <div className="p-1 rounded bg-teal-600 text-white shadow-sm shadow-teal-100">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[9px] font-black text-slate-800 uppercase truncate">
                        {item.name}
                      </span>
                      <div className="flex gap-6 text-[9px] font-black">
                        <span className="text-[#008396] w-8 text-right">{Number(item.realisasi).toFixed(2)}</span>
                        <span className="text-slate-400 w-8 text-right">{Number(item.target).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                        style={{ width: `${Math.min(100, (item.realisasi / (item.target || 1)) * 100)}%` }}
                      >
                        {item.realisasi > 5 && (
                          <span className="text-[8px] font-black text-white leading-none">
                            {Number(item.realisasi).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {item.realisasi <= 5 && (
                        <div className="absolute inset-0 flex items-center pl-2">
                           <span className="text-[8px] font-black text-teal-700 leading-none">
                            {Number(item.realisasi).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* List Footer Summary */}
            <div className="mt-auto bg-[#008396] p-3 px-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="font-black tracking-widest text-[11px]">TOTAL REALISASI</span>
              </div>
              <div className="flex items-center gap-8">
                <span className="text-xl font-black">{totalRealisasi.toFixed(2)}</span>
                <div className="flex items-center gap-3 pl-6 border-l border-white/20">
                  <span className="text-[10px] font-bold text-teal-200 tracking-widest">TOTAL TARGET</span>
                  <span className="text-xl font-black">{totalTarget.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Charts */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Summary Cards */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <PieChart className="w-5 h-5 text-teal-600" />
              <h3 className="font-black text-slate-800 tracking-tight text-sm uppercase">RINGKASAN</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center space-y-1">
                <div className="flex justify-center mb-2">
                  <Activity className="w-5 h-5 text-[#00A2B9]" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">TOTAL<br/>REALISASI</p>
                <p className="text-xl font-black text-teal-700">{totalRealisasi.toFixed(2)}</p>
              </div>
              <div className="text-center space-y-1 border-x border-slate-100 px-2">
                <div className="flex justify-center mb-2">
                  <Target className="w-5 h-5 text-rose-500" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">TOTAL<br/>TARGET</p>
                <p className="text-xl font-black text-teal-700">{totalTarget.toFixed(2)}</p>
              </div>
              <div className="text-center space-y-1">
                <div className="flex justify-center mb-2">
                  <div className="w-5 h-5 rounded-full border-2 border-[#00A2B9] flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#00A2B9] rounded-full" />
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">PERSENTASE</p>
                <p className="text-xl font-black text-[#008396]">{percentage}%</p>
              </div>
            </div>

            {/* Donut Chart */}
            <div className="relative h-48 flex items-center justify-center">
              <Doughnut 
                data={doughnutData} 
                options={{
                  cutout: '75%',
                  plugins: {
                    legend: { display: false },
                  }
                }} 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-800">{percentage}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-teal-600" />
                  <span className="text-slate-600">Realisasi</span>
                </div>
                <span className="text-slate-900">{totalRealisasi.toFixed(2)} ({percentage}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-slate-600">Sisa Target</span>
                </div>
                <span className="text-slate-900">{(totalTarget - totalRealisasi).toFixed(2)} ({100 - percentage}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
