import React from 'react';
import { PhoneCall, WifiOff } from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

/** No internet: the website cannot help, the phone still can. */
export const OfflineBanner = () => {
  const { isOffline } = useCrisisCare();
  if (!isOffline) return null;

  return (
    <div className="bg-red-700 text-white px-4 py-2.5 text-sm sticky top-0 z-[60]" role="alert">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="font-semibold">No internet connection. Call for help by phone:</span>
        <a href="tel:108" className="inline-flex items-center gap-1.5 rounded-lg bg-white text-red-800 px-3 py-1 font-black"><PhoneCall className="w-4 h-4" /> 108 Ambulance</a>
        <a href="tel:112" className="inline-flex items-center gap-1.5 rounded-lg bg-white text-red-800 px-3 py-1 font-black"><PhoneCall className="w-4 h-4" /> 112</a>
      </div>
    </div>
  );
};
