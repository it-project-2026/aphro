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
        backgroundColor: ['#3b82f6', '#e2e8f0'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  return (
    <div className="bg-[#f8fafc] rounded-[2rem] border border-blue-100 shadow-2xl overflow-hidden font-display">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#003594] via-[#0047bb] to-[#005cda] p-5 text-white relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/30">
              <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none">{title}</h1>
              <p className="text-blue-100/80 text-[11px] md:text-xs mt-1 font-semibold uppercase tracking-wider">{subtitle}</p>
            </div>
          </div>
          <div className="bg-[#002874] px-3 py-1.5 rounded-lg border border-blue-400/30 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-xs font-bold tracking-tight">
              {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
            </span>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/5 to-transparent skew-x-12" />
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List Table */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-[#0047bb] p-4 flex justify-between items-center text-white font-bold text-xs uppercase tracking-widest">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4" />
                <span>TIM ROW</span>
              </div>
              <div className="flex gap-12 mr-8">
                <span>REALISASI</span>
                <span>TARGET</span>
              </div>
            </div>
            
            <div className="p-2 flex flex-col gap-0.5">
              {data.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-blue-50 transition-colors group">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-200">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-black text-slate-800 uppercase truncate">
                        {item.name}
                      </span>
                      <div className="flex gap-8 text-[10px] font-black">
                        <span className="text-[#0047bb] w-10 text-right">{item.realisasi}</span>
                        <span className="text-slate-400 w-10 text-right">{item.target}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, (item.realisasi / (item.target || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* List Footer Summary */}
            <div className="mt-auto bg-[#0047bb] p-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5" />
                <span className="font-black tracking-widest text-sm">TOTAL REALISASI</span>
              </div>
              <div className="flex items-center gap-12">
                <span className="text-2xl font-black">{totalRealisasi}</span>
                <div className="flex items-center gap-4 pl-8 border-l border-white/20">
                  <span className="text-xs font-bold text-blue-200 tracking-widest">TOTAL TARGET</span>
                  <span className="text-2xl font-black">{totalTarget.toFixed(1)}</span>
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
              <PieChart className="w-5 h-5 text-blue-600" />
              <h3 className="font-black text-slate-800 tracking-tight text-sm uppercase">RINGKASAN</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center space-y-1">
                <div className="flex justify-center mb-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">TOTAL<br/>REALISASI</p>
                <p className="text-xl font-black text-blue-700">{totalRealisasi}</p>
              </div>
              <div className="text-center space-y-1 border-x border-slate-100 px-2">
                <div className="flex justify-center mb-2">
                  <Target className="w-5 h-5 text-rose-500" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">TOTAL<br/>TARGET</p>
                <p className="text-xl font-black text-blue-700">{totalTarget.toFixed(1)}</p>
              </div>
              <div className="text-center space-y-1">
                <div className="flex justify-center mb-2">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">PERSENTASE</p>
                <p className="text-xl font-black text-emerald-600">{percentage}%</p>
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
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                  <span className="text-slate-600">Realisasi</span>
                </div>
                <span className="text-slate-900">{totalRealisasi} ({percentage}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-slate-600">Sisa Target</span>
                </div>
                <span className="text-slate-900">{(totalTarget - totalRealisasi).toFixed(1)} ({100 - percentage}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
