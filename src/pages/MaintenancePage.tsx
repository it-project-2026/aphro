import * as React from 'react';

const MaintenancePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <h1 className="text-4xl font-bold mb-4">Aplikasi Sedang Maintenance</h1>
      <p className="text-slate-400">Kami sedang melakukan pemeliharaan rutin. Mohon kembali lagi nanti.</p>
    </div>
  );
};

export default MaintenancePage;
