// Phone numbers that work without this website. Shown everywhere a person might be stuck.
export const HELPLINES = [
  { number: '108', label: 'Ambulance', detail: 'Maharashtra Emergency Medical Services, free, 24x7' },
  { number: '112', label: 'Any emergency', detail: 'Police, fire and ambulance, works without a SIM balance' },
  { number: '102', label: 'Pregnancy & newborn', detail: 'Free transport for mothers and infants' },
  { number: '101', label: 'Fire', detail: 'Fire brigade, also rescue from heights and water' },
  { number: '100', label: 'Police', detail: 'Road accidents and violence' },
  { number: '1916', label: 'BMC disaster control', detail: 'Mumbai floods, building collapse, tree fall' },
];

export const tel = (number) => `tel:${String(number).replace(/[^\d+]/g, '')}`;

export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
