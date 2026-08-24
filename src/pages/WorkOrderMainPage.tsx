import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, 
  FilePlus, 
  LayoutDashboard,
  ArrowRight
} from 'lucide-react';
import { WorkOrderPage } from './WorkOrderPage';
import { WorkOrderInputPage } from './WorkOrderInputPage';

interface WorkOrderMainPageProps {
  initialSubTab?: 'list' | 'input';
}

export const WorkOrderMainPage: React.FC<WorkOrderMainPageProps> = ({ initialSubTab = 'list' }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'input'>(initialSubTab);
  const [editingWO, setEditingWO] = useState<any | null>(null);

  const handleEditWO = (wo: any) => {
    setEditingWO(wo);
    setActiveSubTab('input');
  };

  const isAdmin = user && (user.role === 'Admin' || user.role === 'SuperAdmin');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm no-print">
        <div>
          <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400">
            <ClipboardList className="w-6 h-6" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
              Manajemen Work Order {editingWO ? '(MODE EDIT)' : ''}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {editingWO 
              ? `Sedang mengedit data Work Order ${editingWO.nomorWO}.`
              : activeSubTab === 'list' 
                ? 'Lihat dan kelola daftar seluruh Work Order yang tersedia.' 
                : 'Buat penugasan Work Order baru untuk regu lapangan.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setEditingWO(null);
              setActiveSubTab('list');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
              activeSubTab === 'list'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>DAFTAR WORK ORDER</span>
          </button>
          
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditingWO(null);
                setActiveSubTab('input');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all ${
                activeSubTab === 'input' && !editingWO
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FilePlus className="w-4 h-4" />
              <span>INPUT WORK ORDER</span>
            </button>
          )}
        </div>
      </div>

      {/* Conditional Rendering of Sub-Pages */}
      <div className="transition-all duration-300">
        {activeSubTab === 'list' ? (
          <WorkOrderPage 
            onAdd={() => setActiveSubTab('input')} 
            onEdit={handleEditWO}
          />
        ) : (
          <WorkOrderInputPage 
            editMode={!!editingWO}
            initialData={editingWO}
            onBack={() => {
              setEditingWO(null);
              setActiveSubTab('list');
            }} 
          />
        )}
      </div>
    </div>
  );
};
