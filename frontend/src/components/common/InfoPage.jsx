import React from 'react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { HelplineStrip } from './ui';

// Footer "Support" pages. Plain, honest statements of what the system does.
export const INFO_PAGES = {
  privacy: {
    title: 'Privacy policy',
    body: [
      'We collect only what is needed to send help: the location you share, what happened, optional patient details (age group, conditions, allergies, blood group, name), an optional injury photo and optional phone numbers.',
      'Who sees what: the public tracking page shows status only. The assigned ambulance crew and dispatch see phone numbers. The hospital asked to take the patient sees the clinical details and photo, never your phone number.',
      'Staff accounts are separate for each hospital and ambulance; a hospital only sees patients sent to it. Every staff action is written to an append-only audit log.',
      'Hospital staff screens lock after 15 minutes without activity. Passwords are stored only as bcrypt hashes.',
    ],
  },
  terms: {
    title: 'Terms of use',
    body: [
      'Crisis Care helps coordinate emergency care. It does not replace the official emergency numbers 108 and 112: in a life-threatening emergency, call them as well.',
      'Travel times are straight-line estimates. Hospital stock is what each hospital reports; seeded figures are labelled as sample data until a hospital confirms them.',
      'False or prank reports take an ambulance away from someone who needs it. Reports are rate limited and recorded.',
    ],
  },
  grievances: {
    title: 'Grievances',
    body: [
      'If something went wrong with a request (late ambulance, wrong hospital, data shown to the wrong person), write to help@crisiscare.example with your tracking code (CC-XXXXXXXX).',
      'Dispatch can trace every step of a request in the audit log and will reply within 7 days.',
    ],
  },
  faqs: {
    title: 'Frequently asked questions',
    body: [
      'Do I need an account? No. You get a tracking code that is saved on your phone.',
      'What if no ambulance is free? Your request waits in a queue, urgent cases first, and the next free unit is sent. Call 108 as well.',
      'Why did the ambulance not go to the nearest hospital? Because it may not have what the patient needs (for example a cath lab for a heart attack). The crew sees why for each hospital.',
      'Is a government hospital free? Government and municipal hospitals (marked "Govt") provide free or low-cost treatment.',
    ],
  },
};

export const InfoPage = () => {
  const { subRoute } = useCrisisCare();
  const page = INFO_PAGES[subRoute] || INFO_PAGES.faqs;
  return (
    <article className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-4xl font-black">{page.title}</h1>
      <div className="cc-card p-6 space-y-4 text-stone-700 leading-relaxed">{page.body.map((p) => <p key={p}>{p}</p>)}</div>
      <HelplineStrip compact />
    </article>
  );
};
