import React from 'react';
import { CrisisCareProvider, useCrisisCare } from './context/CrisisCareContext';
import { Header } from './components/common/Header';
import { OfflineBanner } from './components/common/OfflineBanner';
import { NotificationToast } from './components/common/NotificationToast';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { ClientPortal } from './components/client/ClientPortal';
import { AmbulancePortal } from './components/ambulance/AmbulancePortal';
import { HospitalPortal } from './components/hospital/HospitalPortal';
import { AdminPortal } from './components/admin/AdminPortal';

function AppContent() {
  const { activeSection, theme } = useCrisisCare();
  const isRed = theme === 'red';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isRed ? 'bg-[#0a0a0f]' : 'bg-surface-bg text-surface-dark'
    }`}>
      <OfflineBanner />
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeSection === 'overview' && <MainDashboard />}
        {activeSection === 'client' && <ClientPortal />}
        {activeSection === 'ambulance' && <AmbulancePortal />}
        {activeSection === 'hospital' && <HospitalPortal />}
        {activeSection === 'admin' && <AdminPortal />}
      </main>

      {/* Footer referencing SRS specifications and team */}
      <footer className={`${
        activeSection === 'admin' ? 'hidden' : ''
      } ${
        isRed 
          ? 'bg-[#07070a] border-t border-red-950/80' 
          : 'bg-teal-deep border-t border-teal-primary/30'
      } py-6 text-xs mt-auto`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-extrabold text-white text-sm tracking-wide">Crisis Care: A Real-Time Healthcare Routing System</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-slate-200">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/50 text-emerald-300">SRS v1.0 Approved</span>
            <span className="text-slate-500">•</span>
            <span className="px-2 py-0.5 rounded bg-sky-950/80 border border-sky-600/50 text-sky-300">PostGIS 3.x Spatial Enabled</span>
            <span className="text-slate-500">•</span>
            <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300">IEEE Std 830-1998 Spec</span>
          </div>
        </div>
      </footer>

      <NotificationToast />
    </div>
  );
}

export default function App() {
  return (
    <CrisisCareProvider>
      <AppContent />
    </CrisisCareProvider>
  );
}
