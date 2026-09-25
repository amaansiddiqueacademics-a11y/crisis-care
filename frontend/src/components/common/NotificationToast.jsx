import React from 'react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { CheckCircle2, AlertCircle, Info, Siren, X } from 'lucide-react';

export const NotificationToast = () => {
  const { toastMessage, showToast } = useCrisisCare();

  if (!toastMessage) return null;

  const getStyle = () => {
    switch (toastMessage.type) {
      case 'emergency':
        return 'bg-emergency-red text-white border-emergency-dark shadow-emergency';
      case 'success':
        return 'bg-teal-deep text-white border-teal-primary/40 shadow-elevated';
      case 'warning':
        return 'bg-status-amber text-stone-900 border-amber-600 shadow-md';
      default:
        return 'bg-teal-primary text-white border-teal-light/20 shadow-md';
    }
  };

  const getIcon = () => {
    switch (toastMessage.type) {
      case 'emergency':
        return <Siren className="w-5 h-5 animate-bounce" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-300" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5 text-sky-200" />;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-slide-up">
      <div className={`flex items-start gap-3 p-4 rounded-xl border ${getStyle()}`}>
        <div className="shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1">
          <h4 className="font-bold text-sm tracking-wide">{toastMessage.title}</h4>
          <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{toastMessage.message}</p>
        </div>
      </div>
    </div>
  );
};
