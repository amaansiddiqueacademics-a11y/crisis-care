import React from 'react';
import { AlertCircle, CheckCircle2, Info, Siren } from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

const STYLE = {
  emergency: ['bg-red-700 text-white border-red-800', Siren],
  success: ['bg-emerald-700 text-white border-emerald-800', CheckCircle2],
  warning: ['bg-amber-400 text-stone-950 border-amber-500', AlertCircle],
  info: ['bg-stone-900 text-white border-stone-700', Info],
};

export const NotificationToast = () => {
  const { toastMessage } = useCrisisCare();
  if (!toastMessage) return null;
  const [style, Icon] = STYLE[toastMessage.type] || STYLE.info;

  return (
    <div className="fixed bottom-24 sm:bottom-5 right-3 left-3 sm:left-auto z-[1000] sm:max-w-md" role="status" aria-live="polite">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${style}`}>
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm">{toastMessage.title}</h4>
          <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{toastMessage.message}</p>
        </div>
      </div>
    </div>
  );
};
