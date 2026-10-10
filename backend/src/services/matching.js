/**
 * Clinical routing rules: what a patient needs, how urgent they are, and how well a
 * hospital fits. These are decision aids for the crew, not a diagnosis; the crew and the
 * hospital always make the final call.
 */

export const SERVICE_LABELS = {
  TRAUMA: "Trauma care",
  CATH_LAB: "Cath lab (heart attack)",
  STROKE: "Stroke unit",
  BURNS: "Burns unit",
  MATERNITY: "Maternity / labour room",
  NICU: "Newborn ICU",
  PAEDIATRIC: "Children's emergency",
  DIALYSIS: "Dialysis",
  TOXICOLOGY: "Poison treatment",
  ANTIVENOM: "Anti-snake venom"
};

const R = (code, label) => ({ kind: "resource", code, label });
const S = (code) => ({ kind: "service", code, label: SERVICE_LABELS[code] });

// Requirement lists per reported category. `critical` items decide whether a hospital fits.
const BY_TYPE = {
  "Traffic Accident": [S("TRAUMA"), R("TRAUMA_SURGEON", "Trauma surgeon"), R("ICU_BED", "ICU bed")],
  "Fall from Height": [S("TRAUMA"), R("TRAUMA_SURGEON", "Trauma surgeon"), R("CT_SCANNER", "CT scanner")],
  "Severe Bleeding": [S("TRAUMA"), R("TRAUMA_SURGEON", "Trauma surgeon"), R("BLOOD_O_NEG", "O- blood")],
  "Bone Fracture": [S("TRAUMA"), R("TRAUMA_SURGEON", "Trauma surgeon")],
  "Cardiac / Chest Pain": [S("CATH_LAB"), R("CARDIAC_ICU_BED", "Cardiac ICU bed"), R("CARDIOLOGIST", "Cardiologist")],
  "Suspected Stroke": [S("STROKE"), R("CT_SCANNER", "CT scanner"), R("NEUROLOGIST", "Neurologist")],
  "Severe Burns": [S("BURNS"), R("ICU_BED", "ICU bed")],
  "Electric Shock": [S("BURNS"), R("CARDIOLOGIST", "Cardiologist")],
  "Pregnancy Emergency": [S("MATERNITY"), R("BLOOD_O_NEG", "O- blood")],
  "Pediatric Emergency": [S("PAEDIATRIC"), R("ICU_BED", "ICU bed")],
  "Snakebite & Animal Bite": [S("ANTIVENOM"), R("VENTILATOR", "Ventilator")],
  Poisoning: [S("TOXICOLOGY"), R("ICU_BED", "ICU bed")],
  "Breathing Difficulty": [R("ICU_BED", "ICU bed"), R("VENTILATOR", "Ventilator"), R("OXYGEN_CYLINDER", "Oxygen")],
  "Allergic Anaphylaxis": [R("ICU_BED", "ICU bed"), R("VENTILATOR", "Ventilator")],
  "Unconscious Person": [R("ICU_BED", "ICU bed"), R("CT_SCANNER", "CT scanner"), R("VENTILATOR", "Ventilator")],
  "Seizure / Convulsion": [R("ICU_BED", "ICU bed"), R("CT_SCANNER", "CT scanner"), R("NEUROLOGIST", "Neurologist")],
  "Other Emergency": [R("ICU_BED", "ICU bed")]
};

const URGENT_TYPES = new Set([
  "Cardiac / Chest Pain", "Breathing Difficulty", "Severe Bleeding", "Unconscious Person",
  "Suspected Stroke", "Allergic Anaphylaxis", "Electric Shock", "Severe Burns"
]);

const URGENT_SYMPTOMS = new Set([
  "Chest pain", "Hard to breathe", "Vomiting blood", "Cannot move an arm or leg", "Confusion"
]);

/** Priority known at report time, used to order the dispatch queue. */
export const reportPriority = ({ type, symptoms = [], painLevel, patient }) => {
  if (URGENT_TYPES.has(type)) return "URGENT";
  if (symptoms.some((s) => URGENT_SYMPTOMS.has(s))) return "URGENT";
  if ((painLevel ?? 0) >= 4) return "URGENT";
  if (patient?.ageGroup === "INFANT") return "URGENT";
  return "STANDARD";
};

/**
 * Triage colour from the crew's assessment. RED = life threat now, YELLOW = serious but
 * stable, GREEN = minor. Returns the colour and the reasons, so it is never a black box.
 */
export const computeTriage = (type, a) => {
  const red = [];
  const yellow = [];
  const f = a.categoryFindings || {};

  if (a.consciousness === "unconscious") red.push("Unconscious");
  if (a.breathing === "not-breathing") red.push("Not breathing");
  if (a.pulseStatus === "none") red.push("No pulse");
  if (a.severeBleeding) red.push("Severe bleeding");
  if (a.spo2 != null && a.spo2 < 90) red.push(`SpO2 ${a.spo2}%`);
  if (a.systolicBp != null && a.systolicBp < 90) red.push(`BP ${a.systolicBp} systolic`);
  if (a.heartRate != null && (a.heartRate > 130 || a.heartRate < 40)) red.push(`Pulse ${a.heartRate}`);
  if (f.stElevation === true) red.push("ST elevation on ECG");
  if (type === "Suspected Stroke" && f.onsetHours != null && f.onsetHours <= 4.5) {
    red.push(`Stroke within ${f.onsetHours} h: clot-buster window`);
  }
  if (f.burnPercent != null && f.burnPercent >= 20) red.push(`${f.burnPercent}% body burned`);
  if (f.neuroSigns === true) red.push("Neuro signs after bite");
  if (f.heavyBleeding === true) red.push("Heavy bleeding in pregnancy");

  if (a.consciousness === "semi-conscious") yellow.push("Drowsy");
  if (a.breathing === "labored") yellow.push("Laboured breathing");
  if (["rapid", "weak"].includes(a.pulseStatus)) yellow.push(`Pulse ${a.pulseStatus}`);
  if (a.spo2 != null && a.spo2 < 94 && a.spo2 >= 90) yellow.push(`SpO2 ${a.spo2}%`);
  if (f.spinalInjury === true) yellow.push("Possible spine injury");

  if (red.length) return { level: "RED", reasons: red };
  if (yellow.length) return { level: "YELLOW", reasons: yellow };
  return { level: "GREEN", reasons: ["Stable on assessment"] };
};

/**
 * Everything the patient needs, from the category plus what the assessment and patient
 * profile add (e.g. not breathing -> ventilator; child -> children's emergency).
 */
export const requirementsFor = ({ type, assessment, patient }) => {
  const list = [...(BY_TYPE[type] || BY_TYPE["Other Emergency"])];
  const has = (code) => list.some((r) => r.code === code);
  const add = (r) => !has(r.code) && list.push(r);

  if (assessment) {
    if (assessment.breathing === "not-breathing" || assessment.consciousness === "unconscious") {
      add(R("VENTILATOR", "Ventilator"));
      add(R("ICU_BED", "ICU bed"));
    }
    if (assessment.severeBleeding) add(R("BLOOD_O_NEG", "O- blood"));
  }

  if (["INFANT", "CHILD"].includes(patient?.ageGroup)) add(S("PAEDIATRIC"));
  if (patient?.ageGroup === "INFANT") add(S("NICU"));
  if (patient?.knownConditions?.includes("Pregnant")) add(S("MATERNITY"));
  if (patient?.knownConditions?.includes("Kidney disease")) add(S("DIALYSIS"));

  return list;
};

/**
 * How well one hospital fits. `hospital.services` is the list of service codes switched on,
 * `hospital.available` maps resource code -> free quantity.
 */
export const assessFit = (requirements, hospital) => {
  const matched = [];
  const missing = [];

  for (const r of requirements) {
    const ok =
      r.kind === "service"
        ? hospital.services.includes(r.code)
        : (hospital.available[r.code] ?? 0) > 0;
    (ok ? matched : missing).push(r.label);
  }

  const warnings = [];
  if (hospital.erStatus === "DIVERSION") warnings.push("Emergency room on diversion (full)");
  if (hospital.erStatus === "LIMITED") {
    warnings.push(`Limited intake${hospital.erStatusNote ? `: ${hospital.erStatusNote}` : ""}`);
  }
  if (!hospital.inventoryConfirmed) warnings.push("Stock not confirmed by the hospital");

  return { matched, missing, warnings, fits: missing.length === 0 && hospital.erStatus !== "DIVERSION" };
};
