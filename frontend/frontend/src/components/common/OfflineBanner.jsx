import React from 'react';
import { WifiOff } from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

export const OfflineBanner = () => {
  const { isOffline, backendOnline } = useCrisisCare();
  if (!isOffline && backendOnline !== false) return null;

  return (
    <div className="sticky top-0 z-40 bg-amber-900/90 backdrop-blur-sm border-b border-amber-700/60 px-4 py-2 text-xs animate-fade-in">
      <div className="max-w-7xl mx-auto flex items-center gap-2.5">
        <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
        <span className="font-semibold text-amber-200">
          {isOffline ? 'Network offline' : 'Backend offline — Demo mode active'}.
        </span>
        <span className="text-amber-300/70 hidden sm:inline">
          {isOffline
            ? ' Serving cached data. Live inventory paused until reconnected.'
            : ' All data is simulated. Start the gateway (npm run dev) for live backend.'}
        </span>
      </div>
    </div>
  );
};
