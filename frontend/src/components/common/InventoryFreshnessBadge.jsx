import React from 'react';
import { Clock, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

export const InventoryFreshnessBadge = ({ lastUpdatedIso }) => {
  if (!lastUpdatedIso) return null;

  const diffMinutes = Math.round((Date.now() - new Date(lastUpdatedIso).getTime()) / (1000 * 60));

  if (diffMinutes < 10) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-green bg-emerald-50 px-2 py-0.5 rounded-full border border-status-green/30">
        <CheckCircle2 className="w-3 h-3 text-status-green" />
        Verified live ({diffMinutes === 0 ? 'just now' : `${diffMinutes}m ago`})
      </span>
    );
  }

  if (diffMinutes < 60) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-amber bg-amber-50 px-2 py-0.5 rounded-full border border-status-amber/40">
        <Clock className="w-3 h-3 text-status-amber" />
        Verified {diffMinutes}m ago
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emergency-dark bg-emergency-light px-2 py-0.5 rounded-full border border-emergency-border">
      <AlertOctagon className="w-3 h-3 text-emergency-red" />
      Outdated info ({Math.round(diffMinutes / 60)}h ago)
    </span>
  );
};
