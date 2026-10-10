import React from 'react';
import { Check, HeartPulse, PhoneCall, X } from 'lucide-react';
import { findCategory } from '../../data/emergencyCategories';

/** Picture or fallback icon for a category. */
export const CategoryImage = ({ category, className = '' }) =>
  category.image ? (
    <img src={category.image} alt="" loading="lazy" className={`object-contain ${className}`} />
  ) : (
    <span className={`flex items-center justify-center bg-amber-50 text-amber-600 ${className}`}>
      <HeartPulse className="w-1/2 h-1/2" />
    </span>
  );

/**
 * "What to do until the ambulance arrives" for one emergency category.
 */
export const FirstAidSteps = ({ categoryId, compact = false }) => {
  const category = findCategory(categoryId);

  return (
    <div className="cc-card overflow-hidden">
      <div className="flex items-center gap-4 p-5 border-b border-stone-100 bg-amber-50/60">
        <CategoryImage category={category} className="w-16 h-16 rounded-xl bg-white shrink-0" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">While you wait for the ambulance</p>
          <h3 className="text-xl font-black text-stone-900">{category.label}</h3>
        </div>
      </div>

      <div className={`grid gap-0 ${compact ? '' : 'md:grid-cols-2'}`}>
        <div className="p-5">
          <h4 className="font-extrabold text-emerald-700 flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="w-4 h-4" /></span>
            Do
          </h4>
          <ol className="space-y-2.5">
            {category.dos.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-stone-700 leading-relaxed">
                <span className="w-6 h-6 shrink-0 rounded-full bg-stone-100 text-stone-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className={`p-5 ${compact ? 'border-t' : 'border-t md:border-t-0 md:border-l'} border-stone-100`}>
          <h4 className="font-extrabold text-red-700 flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><X className="w-4 h-4" /></span>
            Don't
          </h4>
          <ul className="space-y-2.5">
            {category.donts.map((step) => (
              <li key={step} className="flex gap-3 text-sm text-stone-700 leading-relaxed">
                <X className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                {step}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span>General first-aid guidance. Always follow what the emergency operator tells you.</span>
        <a href="tel:112" className="inline-flex items-center gap-1 font-bold text-red-700"><PhoneCall className="w-3.5 h-3.5" /> Call 112</a>
      </div>
    </div>
  );
};
