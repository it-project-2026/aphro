import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { History, Search, ShieldCheck, Filter, Clock } from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const { auditLogs } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.actorName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = selectedRole === 'ALL' || (log.actorRole || '').toUpperCase() === selectedRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400 mb-1">
            <History className="w-6 h-6" />
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white font-display">
              Audit Log & Riwayat Aktivitas Sistem
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Catatan jejak aktivitas pengguna, perubahan data, dan riwayat operasional aplikasi
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-teal-600" />
            {auditLogs.length} Total Catatan
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari aksi, detail perubahan, atau nama petugas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">Semua Peran (Role)</option>
            <option value="SUPERADMIN">SuperAdmin</option>
            <option value="ADMIN">Admin</option>
            <option value="ADM">ADM</option>
            <option value="USER">User / Petugas</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table / List */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Daftar Aktivitas ({filteredLogs.length})
          </span>
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Urut dari terbaru</span>
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
            <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Belum ada catatan aktivitas yang sesuai dengan filter pencarian.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log, idx) => (
              <div
                key={`${log.id}-${idx}`}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-700/50">
                      {log.action}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {log.details}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                    <span>Pelaksana: <strong className="text-slate-700 dark:text-slate-300">{log.actorName || 'Sistem'}</strong></span>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[10px]">
                      {log.actorRole || 'User'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 shrink-0 flex items-center space-x-1 sm:text-right">
                  <span>{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
