// Emergency categories shown to citizens, with an illustration and plain first-aid guidance
// for the minutes before the ambulance arrives. `id` values are the ones stored on an incident.
//
// Guidance is general, widely published first-aid advice. The 112 / 108 operator's
// instructions always take priority.

export const EMERGENCY_CATEGORIES = [
  {
    id: 'Traffic Accident',
    label: 'Road accident',
    image: '/images/categories/traffic-accident.webp',
    dos: [
      'Make the scene safe: hazard lights on, keep traffic away.',
      'Keep the person still if the neck or back could be hurt.',
      'Press firmly on any bleeding with a clean cloth.',
      'Talk to them calmly and keep them warm.',
    ],
    donts: [
      'Do not move them unless there is fire or other danger.',
      "Do not remove a rider's helmet.",
      'Do not give food or water.',
    ],
  },
  {
    id: 'Cardiac / Chest Pain',
    label: 'Chest pain or heart attack',
    image: '/images/categories/cardiac.webp',
    dos: [
      'Sit them down, leaning back, and keep them calm.',
      'Loosen tight clothing around the neck and chest.',
      'If they are not allergic, let them chew one 300 mg aspirin.',
      'If they collapse and stop breathing normally, push hard and fast on the centre of the chest (about 2 pushes a second).',
    ],
    donts: [
      'Do not let them walk around.',
      'Do not leave them alone.',
      'Do not give food or drink.',
    ],
  },
  {
    id: 'Breathing Difficulty',
    label: 'Trouble breathing',
    image: '/images/categories/breathing.webp',
    dos: [
      'Help them sit upright, leaning slightly forward.',
      'Loosen tight clothing and let fresh air in.',
      'Help them use their own inhaler if they have one.',
      'If they are choking and cannot cough: 5 firm back blows, then 5 abdominal thrusts.',
    ],
    donts: [
      'Do not lay them flat.',
      'Do not put your fingers in their mouth blindly.',
    ],
  },
  {
    id: 'Severe Bleeding',
    label: 'Heavy bleeding',
    image: '/images/categories/bleeding.webp',
    dos: [
      'Press firmly on the wound with a clean cloth and keep pressing.',
      'If blood soaks through, add more cloth on top.',
      'Raise the injured arm or leg if it is not broken.',
      'Help them lie down and keep them warm.',
    ],
    donts: [
      'Do not remove soaked cloth; add more on top.',
      'Do not pull out anything stuck in the wound; press around it.',
    ],
  },
  {
    id: 'Unconscious Person',
    label: 'Unconscious',
    image: '/images/categories/unconscious.webp',
    dos: [
      'Check for normal breathing for up to 10 seconds.',
      'If breathing, roll them onto their side (recovery position).',
      'If not breathing normally, start chest compressions: hard and fast in the centre of the chest.',
      'Tilt the head back gently to keep the airway open.',
    ],
    donts: [
      'Do not give anything by mouth.',
      'Do not leave them alone.',
    ],
  },
  {
    id: 'Suspected Stroke',
    label: 'Stroke signs',
    image: '/images/categories/stroke.webp',
    dos: [
      'Check FAST: face drooping, arm weakness, speech slurred: time to call.',
      'Note the exact time the symptoms started.',
      'Keep them lying down, head and shoulders slightly raised.',
    ],
    donts: [
      'Do not give food, drink or any medicine, including aspirin.',
      'Do not let them sleep it off or drive.',
    ],
  },
  {
    id: 'Seizure / Convulsion',
    label: 'Seizure or fit',
    image: null,
    dos: [
      'Move hard or sharp objects away from them.',
      'Cushion their head with something soft.',
      'Time how long the seizure lasts.',
      'When it stops, roll them onto their side.',
    ],
    donts: [
      'Do not hold them down.',
      'Do not put anything in their mouth.',
      'Do not give water until they are fully awake.',
    ],
  },
  {
    id: 'Severe Burns',
    label: 'Burns',
    image: '/images/categories/burns.webp',
    dos: [
      'Cool the burn under cool running water for 20 minutes.',
      'Remove rings or clothing near the burn unless stuck to it.',
      'Cover loosely with cling film or a clean plastic bag.',
    ],
    donts: [
      'Do not use ice, butter, oil or toothpaste.',
      'Do not burst blisters.',
      'Do not peel off clothing that is stuck.',
    ],
  },
  {
    id: 'Fall from Height',
    label: 'Fall or head injury',
    image: '/images/categories/fall.webp',
    dos: [
      'Keep them still, especially the head and neck.',
      'Check that they are breathing and look for bleeding.',
      'Keep them warm and talk to them.',
    ],
    donts: [
      'Do not sit them up or move them.',
      'Do not give food or drink.',
    ],
  },
  {
    id: 'Bone Fracture',
    label: 'Broken bone',
    image: '/images/categories/fracture.webp',
    dos: [
      'Keep the injured part still and support it with padding.',
      'Press gently around any open wound to control bleeding.',
      'Use a cold pack wrapped in cloth to reduce swelling.',
    ],
    donts: [
      'Do not try to straighten the bone.',
      'Do not let them walk on an injured leg.',
    ],
  },
  {
    id: 'Poisoning',
    label: 'Poisoning',
    image: '/images/categories/poisoning.webp',
    dos: [
      'Find out what was taken, how much, and when.',
      'Keep the container or packet to show the crew.',
      'Rinse poison off the skin or eyes with plenty of water.',
      'If they are drowsy, lay them on their side.',
    ],
    donts: [
      'Do not make them vomit.',
      'Do not give milk, oil or salt water.',
    ],
  },
  {
    id: 'Snakebite & Animal Bite',
    label: 'Snake or animal bite',
    image: '/images/categories/snakebite.webp',
    dos: [
      'Keep them calm and as still as possible.',
      'Keep the bitten limb still and relaxed.',
      'Remove rings, watches and tight clothing near the bite.',
      'Remember what the snake looked like.',
    ],
    donts: [
      'Do not cut or suck the wound.',
      'Do not tie a tight band above the bite.',
      'Do not try to catch or kill the snake.',
    ],
  },
  {
    id: 'Pregnancy Emergency',
    label: 'Pregnancy or labour',
    image: '/images/categories/pregnancy.webp',
    dos: [
      'Help her lie on her left side and stay calm.',
      'Keep her warm and note how often contractions come.',
      'If the baby arrives, support it gently and keep it warm against her.',
    ],
    donts: [
      'Do not pull on the baby or the cord.',
      'Do not let her walk around if she is bleeding heavily.',
    ],
  },
  {
    id: 'Pediatric Emergency',
    label: 'Child in distress',
    image: '/images/categories/pediatric.webp',
    dos: [
      'Keep the child calm and close to a parent.',
      'For a high fever, remove extra clothing.',
      'For a choking baby: 5 back blows, then 5 chest thrusts.',
    ],
    donts: [
      'Do not give adult medicines.',
      'Do not shake the child.',
    ],
  },
  {
    id: 'Allergic Anaphylaxis',
    label: 'Severe allergy',
    image: '/images/categories/allergy.webp',
    dos: [
      'If they carry an adrenaline pen, help them use it in the outer thigh.',
      'Lie them down with legs raised, or sit them up if breathing is hard.',
      'A second dose can be given after 5 minutes if there is no improvement.',
    ],
    donts: [
      'Do not make them stand or walk.',
      'Do not give food or drink.',
    ],
  },
  {
    id: 'Electric Shock',
    label: 'Electric shock',
    image: '/images/categories/electric-shock.webp',
    dos: [
      'Switch off the power at the mains before touching them.',
      'If you cannot, push them away with something dry and wooden.',
      'Check breathing, then cool any burns with water.',
    ],
    donts: [
      'Do not touch them while they are still touching the current.',
      'Do not go near fallen high-voltage lines.',
    ],
  },
  {
    id: 'Other Emergency',
    label: 'Something else',
    image: null,
    dos: [
      'Stay with the person and keep them comfortable and warm.',
      'Note what happened and when.',
      'Keep your phone free for the crew.',
    ],
    donts: [
      'Do not give food or drink.',
      'Do not move them unless they are in danger.',
    ],
  },
];

export const findCategory = (id) => EMERGENCY_CATEGORIES.find((c) => c.id === id) || EMERGENCY_CATEGORIES[EMERGENCY_CATEGORIES.length - 1];
