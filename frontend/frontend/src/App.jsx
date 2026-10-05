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
  const { activeSection } = useCrisisCare();

  return (
    <div className="min-h-screen flex flex-col selection:bg-blue-200">
      <OfflineBanner />
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeSection === 'overview'  && <MainDashboard />}
        {activeSection === 'client'    && <ClientPortal />}
        {activeSection === 'ambulance' && <AmbulancePortal />}
        {activeSection === 'hospital'  && <HospitalPortal />}
        {activeSection === 'admin'     && <AdminPortal />}
      </main>

      {/* Premium footer */}
      {activeSection !== 'admin' && (
        <footer className="border-t border-black/5 bg-[#F5F5F7] py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="font-bold text-[#1D1D1F] text-sm tracking-tight">
                CRISIS<span className="text-[#FF3B30]">CARE</span>
              </p>
              <p className="text-[11px] text-[#86868B] mt-0.5 font-medium">
                Real-Time Healthcare Routing & Emergency Resource Infrastructure
              </p>
            </div>
          </div>
        </footer>
      )}

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
