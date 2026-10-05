import React, { useEffect, useState } from 'react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { CheckCircle2, AlertCircle, Info, Siren, X, Zap } from 'lucide-react';

const TYPE_CONFIG = {
  emergency: {
    icon: Siren,
    iconClass: 'text-red-300 animate-bounce',
    bg: 'bg-[rgba(185,28,28,0.95)]',
    border: 'border-red-700/60',
    bar: 'bg-red-400',
    glow: '0 0 32px rgba(239,68,68,0.4)',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-300',
    bg: 'bg-[rgba(4,47,46,0.95)]',
    border: 'border-emerald-700/60',
    bar: 'bg-emerald-400',
    glow: '0 0 24px rgba(52,211,153,0.2)',
  },
  warning: {
    icon: AlertCircle,
    iconClass: 'text-amber-300',
    bg: 'bg-[rgba(67,40,4,0.95)]',
    border: 'border-amber-700/60',
    bar: 'bg-amber-400',
    glow: '0 0 24px rgba(251,191,36,0.2)',
  },
  info: {
    icon: Info,
    iconClass: 'text-sky-300',
    bg: 'bg-[rgba(8,47,73,0.95)]',
    border: 'border-sky-700/60',
    bar: 'bg-sky-400',
    glow: '0 0 20px rgba(56,189,248,0.15)',
  },
};

export const NotificationToast = () => {
  const { toastMessage } = useCrisisCare();
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toastMessage) { setVisible(false); return; }
    setVisible(true);
    setProgress(100);
    const start = Date.now();
    const dur = 4500;
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / dur) * 100));
    }, 50);
    return () => clearInterval(tick);
  }, [toastMessage?.id]);

  if (!toastMessage || !visible) return null;

  const cfg = TYPE_CONFIG[toastMessage.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-full max-w-sm animate-slide-up">
      <div
        className={`
          relative overflow-hidden rounded-2xl border backdrop-blur-xl
          shadow-[0_8px_32px_rgba(0,0,0,0.5)]
          ${cfg.bg} ${cfg.border}
        `}
        style={{ boxShadow: `${cfg.glow}, 0 8px 32px rgba(0,0,0,0.5)` }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[rgba(255,255,255,0.1)]">
          <div
            className={`h-full transition-none ${cfg.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-start gap-3 p-4 pt-5">
          <div className="shrink-0 mt-0.5">
            <Icon className={`w-5 h-5 ${cfg.iconClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-white leading-tight">{toastMessage.title}</h4>
            <p className="text-xs mt-0.5 text-[rgba(255,255,255,0.65)] leading-relaxed">{toastMessage.message}</p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="shrink-0 text-[rgba(255,255,255,0.4)] hover:text-white transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
