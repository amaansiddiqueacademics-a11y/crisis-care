import React from 'react';
import { tel } from './data/helplines';
import { Activity, ArrowLeft, Mail, MapPin, PhoneCall } from 'lucide-react';
import { CrisisCareProvider, useCrisisCare } from './context/CrisisCareContext';
import { Header } from './components/common/Header';
import { OfflineBanner } from './components/common/OfflineBanner';
import { NotificationToast } from './components/common/NotificationToast';
import { InfoPage } from './components/common/InfoPage';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { ClientPortal } from './components/client/ClientPortal';
import { AmbulancePortal } from './components/ambulance/AmbulancePortal';
import { HospitalPortal } from './components/hospital/HospitalPortal';
import { AdminPortal } from './components/admin/AdminPortal';

// Every footer entry is a real link (hash routes, in-page anchors or tel:).
const FOOTER = {
  Portals: [['Report an emergency', '#/report'], ['Ambulance crew', '#/ambulance'], ['Hospital desk', '#/hospital'], ['Dispatch control', '#/dispatch']],
  Services: [['Emergency ambulance', '#/report'], ['Find the right hospital', '#/?to=find-title'], ['First-aid guidance', '#/?to=aid-title'], ['About Crisis Care', '#/?to=about']],
  Support: [['Privacy policy', '#/help/privacy'], ['Terms of use', '#/help/terms'], ['Grievances', '#/help/grievances'], ['FAQs', '#/help/faqs']],
};

/** In-page anchors on the home page ("#/?to=id"): scroll once the section has rendered. */
const goTo = (href) => (e) => {
  const m = href.match(/\?to=([\w-]+)/);
  if (!m) return;
  e.preventDefault();
  if (!/^#\/?(\?|$)/.test(window.location.hash)) window.location.hash = '#/';
  setTimeout(() => document.getElementById(m[1])?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
};

const FooterList = ({ title, items }) => (
  <div>
    <h3 className="text-sm font-extrabold text-white uppercase tracking-wide pb-2 mb-3 border-b-2 border-amber-500 inline-block">{title}</h3>
    <ul className="space-y-2 text-sm">
      {items.map(([label, href]) => (
        <li key={label}><a href={href} onClick={goTo(href)} className="hover:text-amber-300">› {label}</a></li>
      ))}
    </ul>
  </div>
);

function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 text-white flex items-center justify-center"><Activity className="w-5 h-5" /></span>
            <span className="font-black text-xl text-white">CRISIS<span className="text-amber-400">CARE</span></span>
          </div>
          <p className="text-sm leading-relaxed max-w-sm">Crisis Care connects patients, ambulance crews and hospitals so the person in trouble reaches a hospital that can actually treat them.</p>
          <div className="flex flex-wrap gap-2">
            {['108', '112', '102'].map((n) => (
              <a key={n} href={`tel:${n}`} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/50 px-4 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-500/10"><PhoneCall className="w-4 h-4" /> {n}</a>
            ))}
          </div>
        </div>

        <FooterList title="Portals" items={FOOTER.Portals} />
        <div className="space-y-6">
          <FooterList title="Services" items={FOOTER.Services} />
          <FooterList title="Support" items={FOOTER.Support} />
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wide pb-2 mb-3 border-b-2 border-amber-500 inline-block">Contact us</h3>
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3"><PhoneCall className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" /><span><strong className="block text-white text-xs">AMBULANCE (24/7)</strong><a href="tel:108" className="hover:text-amber-300">108</a> · <a href="tel:112" className="hover:text-amber-300">112</a></span></li>
            <li className="flex gap-3"><Mail className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" /><span><strong className="block text-white text-xs">EMAIL</strong><a href="mailto:help@crisiscare.example" className="hover:text-amber-300">help@crisiscare.example</a></span></li>
            <li className="flex gap-3"><MapPin className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" /><span><strong className="block text-white text-xs">ADDRESS</strong>Mumbai, Maharashtra, India</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-stone-500">© Crisis Care. In a life-threatening emergency, always call 108 or 112.</div>
    </footer>
  );
}

/** A crash in one screen must never leave a blank page: show a message and the phone numbers. */
class ErrorBoundary extends React.Component {
  state = { error: null, at: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto cc-card p-6 space-y-4" role="alert">
        <h1 className="text-2xl font-black">Something went wrong on this page</h1>
        <p className="text-stone-600 text-sm">Reload the page. If you need help right now, call:</p>
        <div className="flex gap-3">
          <a href={tel('108')} className="cc-btn-sos">Call 108</a>
          <a href={tel('112')} className="cc-btn-dark">Call 112</a>
        </div>
        <p className="text-xs text-stone-400 font-mono break-words">{String(this.state.error.message || this.state.error)}</p>
        <button onClick={() => window.location.reload()} className="cc-btn-outline">Reload</button>
      </div>
    );
  }
}

/** Back one step; if this page was opened directly, go to the home page. */
const BackBar = () => {
  const { activeSection } = useCrisisCare();
  if (activeSection === 'overview') return null;
  const back = () => (window.history.length > 1 ? window.history.back() : (window.location.hash = '#/'));
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 flex gap-4">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-600 hover:text-stone-900"><ArrowLeft className="w-4 h-4" /> Back</button>
      <a href="#/" className="text-sm font-bold text-stone-500 hover:text-stone-900">Home</a>
    </div>
  );
};

function AppContent() {
  const { activeSection } = useCrisisCare();

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      <OfflineBanner />
      <Header />
      <BackBar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary resetKey={activeSection}>
        {activeSection === 'overview' && <MainDashboard />}
        {activeSection === 'client' && <ClientPortal />}
        {activeSection === 'ambulance' && <AmbulancePortal />}
        {activeSection === 'hospital' && <HospitalPortal />}
        {activeSection === 'admin' && <AdminPortal />}
        {activeSection === 'info' && <InfoPage />}
        </ErrorBoundary>
      </main>
      <Footer />
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
