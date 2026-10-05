# Crisis Care v2.0 — PRD v5

### Updated after teacher review — rebuild window: \~1 week

---

## 0. Status Update

The Sept 21 review found the project incomplete. A separate, more complete-feeling demo frontend (dark "SRS v1.0" theme, 4 actor portals, landing-page analytics) was built to show the intended scope, and it worked — the teacher understood the project from it. This version:

- Adopts that frontend's structure and visual direction going forward
- Keeps the existing backend (Node/Express + FastAPI + PostgreSQL/PostGIS, reservations, SSE) and extends it rather than rebuilding
- Replaces every fabricated/mock number in that frontend with a real one
- Adds the features that frontend implies but doesn't yet have working backend support for

**Everything in PRD v4 not explicitly changed below still applies.** This document lists what's new or different, not a full restatement.

---

## 1. Carries over unchanged from v4

- Hospital dataset (curated real set, Mumbai/Pune/Nandurbar/Gadchiroli, \~60-80 hospitals)
- Core feasibility filter + weighted cost routing algorithm (v4 Section 7)
- 2-tier drive-time escalation logic (v4 Section 8)
- Postgres-only reservation design, no Redis (v4 Section 9)
- SSE human-in-the-loop hospital handshake (v4 Section 10)
- Simulation worker (Poisson-driven inventory fluctuation) (v4 Section 12)
- Research hypothesis framing (null-hypothesis test, no pre-claimed numbers) (v4 Section 2)
- Scope cuts still stand: no Redis, no full M/M/c queueing, no full statewide hospital coverage

## 2. What's new or changed in v5

1. **New actor: Citizen** — public-facing SOS reporting flow (new, see Section 4)
2. **Expanded triage categories: 4 → 17** (full table, Section 3)
3. **3 new resource types**: antivenom, labor/delivery ward bed, pediatric ICU bed
4. **Visual direction superseded**: the dark, animated "SRS" frontend replaces the earlier clinical blue/white direction (v4 Section 13 is retired in favor of `design.md`)
5. **Landing-page public analytics becomes a real, user-facing feature** — this means the evaluation harness (v4 Section 15) is no longer just a paper appendix, it's now something the live site displays. Build it properly.
6. **Audit log becomes a real feature** on the Admin screen, not just a concept

## 3. Updated Triage → Resource Mapping (17 categories)

Several of these intentionally reuse resource sets from the original 4 — that's fine, it reflects real clinical overlap, not laziness.

| Category | Required Resources |
| --- | --- |
| Traffic & Road Accident | ICU bed, ventilator, trauma surgeon, Blood O-, CT scanner |
| Cardiac Arrest / Chest Pain | Cardiologist, cardiac ICU, oxygen |
| Breathing / Choking | Oxygen cylinder, ventilator |
| Severe Bleeding & Trauma | Blood O-, trauma surgeon, ICU bed |
| Unconscious / Fainted | ICU bed, CT scanner |
| Suspected Stroke (FAST) | CT scanner, neurologist, ICU bed |
| Seizure / Epileptic Fit | Neurologist, ICU bed |
| Severe Burns / Fire | ICU bed, IV fluids/general supplies, trauma surgeon |
| Fall / Spinal Trauma | CT scanner, trauma surgeon, ICU bed |
| Fracture / Crush Injury | Orthopedic surgeon\*, ICU bed |
| Poison / Toxic Ingestion | ICU bed, ventilator |
| Snakebite / Animal Attack | **Antivenom (new)**, ICU bed |
| Pregnancy / Labor Emergency | **Labor/delivery ward bed (new)**, obstetrician\* |
| Pediatric / Infant Distress | **Pediatric ICU bed (new)**, pediatrician\* |
| Severe Allergic Reaction | Oxygen cylinder, ICU bed |
| Electric Shock / Electrocution | ICU bed, cardiologist, trauma surgeon |
| Other Acute Emergency | ICU bed (generic fallback) |

\* If orthopedic surgeon, obstetrician, and pediatrician aren't already specialist types in your resource list, add them alongside antivenom/labor-ward/pediatric-ICU — same pattern as existing specialists (trauma surgeon, cardiologist, neurologist).

## 4. Citizen SOS Flow (new)

**Explicitly scoped to stay simple — this is not a reopening of the ambulance-fleet-dispatch cut.**

1. Citizen selects a triage category (from the 17), describes what happened, sets patient count and location (map pin or GPS)
2. Backend creates an incident record and assigns the next available on-duty attendant from a small seeded pool (3-5 attendants) — simple availability rule, no distance optimization or fleet matching
3. Citizen sees confirmation + estimated arrival + first-aid guidance while waiting
4. From here, the flow joins the existing pipeline: attendant does clinical assessment → **system automatically runs the routing engine** (not a manual hospital pick — see `design.md` Section 4) → hospital gets SSE proposal → accept/reject as before

**For the paper:** be explicit that ambulance-to-scene assignment is a simple availability rule, not a research contribution. The system's contribution remains the scene-to-hospital allocation decision (feasibility filter + weighted cost ranking). Don't let the new UI accidentally imply you solved the fleet-matching problem — you didn't, and you don't need to.

## 5. Evaluation Harness → Live Feature (elevated from v4)

v4 Section 15's evaluation harness (naive vs. resource-aware comparison) now also needs to power a live `/stats/summary` endpoint for the landing page. Concretely:

- Run the harness, store its output (TDC comparison, secondary-transfer rate, p95 latency) in a small results table
- Landing page's stat counters read from this table — real numbers, not hardcoded ones
- If you re-run the harness as the dataset/algorithm changes, these numbers update — treat it as a living result, not a one-time calculation

## 6. Updated Build Schedule (1 week)

**Days 1-2 — Backend extension:**

- Add 3 new resource types (+ specialist types if needed) to schema and seed data
- Extend triage mapping table to all 17 categories
- Add attendant pool + simple assignment endpoint (Section 4)
- Add `audit_log` table + write events to it from existing reservation/accept/reject/escalation code paths
- Build/finish the evaluation harness, get it producing real numbers, add `/stats/summary` endpoint

**Days 3-4 — Frontend integration:**

- Wire the new frontend's screens to real endpoints per `design.md` Section 7 (data binding map)
- Fix the "Select Nearest Hospital" screen to show the engine's automatic recommendation, not a manual pick (`design.md` Section 4)
- Remove all fabricated stats, fake badges, and the "Reset Mock Data" button from anything demo-facing
- Re-verify the core SSE loop still works end-to-end with the new frontend (this was fragile before — don't assume it survived the swap)

**Day 5 — Motion/polish pass** (only after the above is solid):

- Scroll-reveal sections, animated counters, sticky nav, hover-lift cards (`design.md` Section 5)

**Days 6-7 — Buffer, paper/poster update, rehearsal:**

- Update paper to reflect 17 categories, citizen flow, and real evaluation numbers
- Update poster
- Full rehearsal with real data, no last-minute changes before the review

## 7. What to say if the teacher asks about the earlier version

Be straightforward: the first version prioritized getting the core routing algorithm correct under a hard 48-hour deadline, and intentionally deferred the full user-facing experience. This version completes that experience on top of the same validated core logic, rather than having built the UI first and the algorithm as an afterthought. That's a defensible, honest account of what actually happened.