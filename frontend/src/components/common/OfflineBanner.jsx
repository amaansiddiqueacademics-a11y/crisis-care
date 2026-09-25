import React from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

export const OfflineBanner = () => {
  const { isOffline, setIsOffline } = useCrisisCare();

  if (!isOffline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-inner animate-slide-up sticky top-0 z-40">
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
        <span className="font-semibold">
          Offline / Low-Bandwidth Mode:
        </span>
        <span className="text-amber-100 hidden sm:inline">
          Serving locally cached hospital routing points. Real-time live inventory may be delayed until connectivity is re-established.
        </span>
        <button 
          onClick={() => setIsOffline(false)} 
          className="ml-auto text-[11px] underline font-bold bg-white/20 px-2 py-0.5 rounded hover:bg-white/30"
        >
          Dismiss & Retry Sync
        </button>
      </div>
    </div>
  );
};
