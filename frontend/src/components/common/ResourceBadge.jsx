import React from 'react';
import { BedDouble, Wind, Droplets, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const ResourceBadge = ({ type, count, label, minWarning = 2 }) => {
  const isLow = count <= minWarning && count > 0;
  const isNone = count === 0;

  const getIcon = () => {
    switch (type) {
      case 'bed':
        return <BedDouble className="w-3.5 h-3.5" />;
      case 'oxygen':
        return <Wind className="w-3.5 h-3.5" />;
      case 'blood':
        return <Droplets className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const getStyle = () => {
    if (isNone) {
      return 'bg-red-50 text-emergency-dark border-emergency-border';
    }
    if (isLow) {
      return 'bg-amber-50 text-status-amber border-status-amber/40';
    }
    return 'bg-emerald-50 text-status-green border-status-green/30';
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getStyle()}`}>
      {getIcon()}
      <span>{label || type}:</span>
      <span className="font-bold underline decoration-dotted">{count}</span>
      {isNone && <span className="text-[10px] uppercase font-bold text-emergency-red">Empty</span>}
    </div>
  );
};
