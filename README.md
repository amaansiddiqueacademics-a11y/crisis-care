# Crisis Care: Real-Time Emergency Routing for Mumbai and Palghar

Crisis Care connects **people in an emergency**, **ambulance crews**, **hospital emergency desks** and **dispatchers** so a patient is driven once, to a hospital that has already said yes and can treat their condition.

The problem it targets: in Mumbai a patient is often driven from hospital to hospital because the first one had no ICU bed, no cath lab or no specialist on duty. Every hospital that says no costs time. Crisis Care sends the nearest suitable ambulance, tells the hospital what the patient needs before arrival, and ranks hospitals by what the patient needs, not only by distance.

| Layer | Technology |
| :--- | :--- |
| Frontend | React 19, Vite, Tailwind CSS 3, Leaflet (OpenStreetMap), socket.io-client, lucide-react |
| Backend | Node.js 20+ (ESM), Express 5, Socket.IO, JWT, bcryptjs, express-validator, helmet, express-rate-limit |
| Database | PostgreSQL 16+ with PostGIS 3.4 |

---

## Contents

1. [What each person sees](#what-each-person-sees)
2. [Quick start](#quick-start)
3. [Logins and passwords](#logins-and-passwords)
4. [Demo walkthrough](#demo-walkthrough)
5. [How the system decides](#how-the-system-decides)
6. [Data](#data)
7. [Security and privacy](#security-and-privacy)
8. [API reference](#api-reference)
9. [Real-time events](#real-time-events)
10. [Database tables](#database-tables)
11. [Project structure](#project-structure)
12. [Configuration](#configuration)
13. [Scripts and tests](#scripts-and-tests)
14. [Data honesty and limitations](#data-honesty-and-limitations)
15. [Credits](#credits)

---

## What each person sees

The site is a single-page app with hash routes, so links, refresh and the Back button work everywhere. Every page except Home has a **Back** button and a **Home** link. The numbers **108** and **112** are in the header on every page.

### 1. Anyone (public, no sign-in): `#/`, `#/report`, `#/help/...`

**Home (`#/`)**
- Hero with "Get help now" (or "Track my ambulance" if this phone already has an open request) and "Call 108".
- **Helpline strip** with tap-to-call buttons that work without this website: 108 ambulance, 112 any emergency, 102 pregnancy and newborn, 101 fire, 100 police, 1916 BMC disaster control.
- **Live network figures** from the database: ambulances free now, hospitals connected, emergencies being handled, average minutes from report to a hospital confirming a bed (30 days).
- **"Which hospital can treat this, near me?"** Pick where you are (My location, or South Mumbai, Western Suburbs, Central Suburbs, Thane & Kalyan, Navi Mumbai & Panvel, Palghar & Vasai-Virar) and what happened. Hospitals are ranked by whether they have what that emergency needs, whether their emergency room is open, then travel time. Each row shows: ER status, Govt/Private, what matches (green), what is missing (red), ICU beds free, phone, and directions. The page says when stock was last confirmed by the hospital.
- **First-aid guide** for 17 situations with Do and Don't steps.
- **Real hospital photos** (Lilavati, Hinduja) and an "About" section with an ambulance photo.
- Footer: Portals, Services (anchors to sections on Home), Support pages (Privacy policy, Terms of use, Grievances, FAQs), and contact numbers.

**Get help (`#/report`)**: designed to be done in two taps, with everything else optional:
1. **Where is the patient?** "Use my current location" (GPS, shows accuracy), or tap the nearest of 18 areas (Colaba, Fort/CSMT, Byculla, Dadar, Bandra, Andheri, Borivali, Kurla, Ghatkopar, Mulund, Thane, Kalyan, Vashi, Panvel, Mira Road, Vasai-Virar, Palghar, Dahanu). Optional landmark text.
2. **What happened?** Tap a picture: road accident, chest pain, trouble breathing, heavy bleeding, unconscious, stroke signs, seizure, burns, fall, broken bone, poisoning, snake/animal bite, pregnancy, child in distress, severe allergy, electric shock, something else.
3. **Where does it hurt?** (optional) *On the body* (pick the body part, optionally take a photo of the injury, shrunk in the browser to stay small) or *Inside the body* (tap symptoms, pain strength 1 to 5).
4. **Your phone number** (optional): so the crew can call if they cannot find the place. The reporter does not need to know the patient's name; the crew records age, allergies and conditions on scene.
5. **How many people need help?**

The bottom bar always has a **108** button and the **Send ambulance** button. If the report cannot be sent (no network or server error), the page shows big **Call 108** and **Call 112** buttons and an **SMS to 112 with the location** instead of failing silently.

**Tracking page**: after sending, the address becomes `#/report/CC-XXXXXXXX`.
- A coloured banner says what is happening now: finding an ambulance (queued), ambulance on its way, crew with the patient, asking the hospital, hospital declined (finding another), hospital ready, on the way to hospital, arrived, handed over, cancelled.
- Estimated minutes for the **current leg** (to the patient, then to the hospital), always labelled a rough straight-line estimate with no traffic data. With no live GPS, or a GPS fix older than 5 minutes, no number is shown: the page says why instead. A four-step progress list, the hospitals that declined and why, a map with patient, ambulance and hospital, a "call hospital" button once one is chosen, directions to the hospital, and the first-aid steps for that emergency.
- It updates by itself over Socket.IO with a 15-second fallback poll.
- **The page asks the person to stay on it and shows the report ID** (`CC-XXXXXXXX`) for future reference. The code is saved on the phone; refreshing the page or reopening the address finds the same request. Once a request is finished (handed over or cancelled) it is forgotten for next time, so the next visit opens a fresh form.
- **Cancel request** is available until transport starts and always asks for confirmation first (it stops the request, releases the hospital bed and frees the ambulance). The page shows "cancelled" only after the server confirms. Once transport has started the button is replaced by an explanation and the advice to tell the crew or call 108. **New request** starts a fresh form.

### 2. Ambulance crew: `#/ambulance`

- Sign in with the unit call sign (for example `mum-als-01`). The header shows the signed-in crew member's name with an initials badge, the call sign, unit type (ALS or BLS) and status.
- **GPS switch**: shares the unit's position every 15 seconds (re-sending the latest fix even while standing still) so dispatch and the patient see it move. A permission or network failure is shown on screen. **Go off duty / Go on duty** when no call is active.
- **Waiting for a call** screen until dispatch assigns one; new calls appear automatically.
- **Navigation card** (follows the stage of the call): **Navigate to Patient** until the crew taps *Arrived at patient*; once a hospital has accepted, **Navigate to Hospital** (also during transport); no button when there is nothing to navigate to (with the patient and no hospital yet, or at the hospital). The map shows the patient, the unit's last GPS position and the accepted hospital, with a dashed straight line to the current destination.
- **Active call**: category picture, URGENT flag, triage colour, location, time since report, and one big button for the next step (Arrived at patient, Patient on board, Arrived at hospital, Patient handed over).
- **Patient card**: name (if known), age group, sex, blood group, the reporter's injury photo, symptoms and pain level, conditions, **allergies (in red)** and tap-to-call buttons for the caller and family. "Correct patient details" saves name, age and sex to the patient record.
- **On-scene assessment**: conscious / breathing / pulse buttons, severe bleeding, pulse, SpO2, blood pressure, plus **questions specific to the emergency** that decide which hospital fits:

  | Emergency | Extra questions |
  | :--- | :--- |
  | Chest pain | ST elevation on ECG? minutes of pain |
  | Stroke | hours since onset, face droop, arm weakness, speech slurred |
  | Road accident / fall | possible spine injury, GCS |
  | Burns | % body burned, burns to face/airway |
  | Pregnancy | weeks pregnant, heavy bleeding, minutes between contractions |
  | Snake bite | hours since bite, droopy eyelids / trouble swallowing, spreading swelling |
  | Poisoning | substance, hours since |
  | Child | age in years, weight |

  The system computes a **triage colour** (red, yellow, green) with the reasons shown. A red triage marks the call urgent.
- **Best hospital for this patient**: up to 10 hospitals ranked for this exact patient, with badges **Best fit** and **Nearest**, ER status, Govt/Private, distance, minutes and **extra minutes versus the nearest**, ICU beds free, what matches and what is missing, warnings (ER on diversion, limited intake, stock not confirmed), and a Call button. Press **Ask** to send the patient's details to one hospital. Only one hospital is asked at a time. Hospitals that declined are greyed out with their reason and cannot be asked again.
- Transport can only start once a hospital has accepted.

### 3. Hospital emergency desk: `#/hospital`

- Each hospital signs in with **its own hospital ID** and sees only patients sent to that hospital.
- Shows the secure-session badge, when the session ends, and the 15-minute idle lock.
- **Emergency room status**: *Accepting patients*, *Limited intake* or *ER full (diversion)*, with an optional note (for example "No paediatric cases until 6 PM"). Crews are routed away from a hospital on diversion.
- **Incoming patients** (live): each card shows urgency, triage colour and reasons, the ambulance and paramedic, minutes and km away, the patient (name, age, sex, blood group), vitals, conscious/breathing/pulse/bleeding, conditions, allergies, symptoms, the category-specific findings, the crew's notes and the injury photo. A **"Can you treat this patient?"** panel lists what this hospital has and what it lacks for this patient.
  - **Accept** reserves an ICU bed only if the patient needs one (a snake bite or a delivery can be accepted without an ICU bed).
  - **Decline** needs a reason (no ICU bed, ER full, specialist not on duty, cath lab/CT not working, theatres occupied, no matching blood, no ventilator). The crew is told immediately.
- **Stock**: beds and equipment (ICU, cardiac ICU, ventilators, CT scanner, oxygen), **specialists on duty now** (trauma surgeon, cardiologist, neurologist), and **blood bank** for all 8 groups, each with plus/minus buttons. Seeded figures are labelled "sample" until the hospital changes them; units reserved for incoming patients are shown.
- **Services available now**: switch off what is down so crews do not bring patients you cannot treat: Trauma care, Cath lab, Stroke unit, Burns unit, Maternity, Newborn ICU, Children's ER, Dialysis, Poison treatment, Anti-snake venom.
- **Trauma surgeon on duty**: name plus status (available, in surgery, on call, offline).

### 4. Dispatch control: `#/dispatch`

- Sign in with the administrator email and password.
- **Counters**: open calls, urgent, waiting for a unit, units free, hospitals on diversion.
- **Live map** of every open call (red when urgent) and every ambulance (green free, amber busy, grey offline).
- **Call queue** (urgent first, then oldest): shows time since report, stage, and an **"act"** flag on problems that need a person:
  - no ambulance for N minutes (assign one or call 108 control),
  - a hospital has not answered for 4+ minutes (call them),
  - two or more hospitals declined (help the crew find a bed),
  - the assigned unit is more than 20 minutes away (is a closer one free?).
- **Call detail**: caller and hospital phone buttons, ambulance and hospital status, patient, what the patient needs, symptoms, conditions, vitals, who declined and why, the reporter's photo and a map. **Assign / send a closer unit**: the four nearest free ambulances with distance. **Cancel call** opens a dialog that requires a reason (duplicate report, prank call, patient left or was taken by other transport, or free text); the call leaves the board only after the server confirms, and the action is written to the audit log.
- **Fleet table**: unit, zone, status, crew, how long ago its GPS was last seen (red when stale for over 10 minutes), and current call.
- **Hospital pressure by zone**: hospitals, accepting, limited, diversion, ICU beds free.
- **Audit log** (append-only) with **Export CSV**.

---

## Quick start

### Prerequisites
- Node.js 20 or newer
- PostgreSQL with the **PostGIS** extension (a plain PostgreSQL will not work). Docker is the easiest way.

### 1. Database
```bash
cd crisis-care
docker compose up -d            # PostGIS on localhost:5432
# port 5432 already used?  DB_PORT=5433 docker compose up -d
```
Without Docker, create a database (`CREATE DATABASE crisis_care;`) on a server with PostGIS installed. The schema runs `CREATE EXTENSION postgis`, so the user needs permission to do so.

### 2. Backend configuration
```bash
cd backend
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
```
Edit `.env` (see [Configuration](#configuration)). Suggested development values so this README's logins work:

```
DATABASE_URL=postgresql://crisis:crisis_dev_password@localhost:5432/crisis_care
JWT_SECRET=<a long random string>
SEED_ADMIN_EMAIL=admin@crisiscare.local
SEED_ADMIN_PASSWORD=AdminDev2026pass
SEED_CREW_PASSWORD=CrewDev2026pass
```

### 3. Create tables and seed data
```bash
npm install
npm run db:setup                # = npm run db:init && npm run db:seed
npm run db:demo                 # optional: realistic live cases for a demo
```

### 4. Run
```bash
npm start                       # backend  http://localhost:5000
cd ../frontend
npm install
npm run dev                     # frontend http://localhost:3000
```
After pulling new code, **restart the backend** (`npm start` does not auto-reload; `npm run dev` does). An old backend still running will show "Route not found" in the newer screens. In development Vite proxies `/api` and `/socket.io` to `http://localhost:5000` (override with `VITE_BACKEND_URL`).

---

## Logins and passwords

These are **development credentials**. Passwords are stored in the database only as bcrypt hashes. In production the seed skips the hospital CSV unless `SEED_ALLOW_DEMO_CREDENTIALS=true`; provision real accounts with strong, unique passwords and treat every account below as public.

### Quick reference

| Who | Page | Login ID | Password |
| :--- | :--- | :--- | :--- |
| Citizen (anyone) | `#/report` | none, no account needed | none |
| Dispatcher (administrator) | `#/dispatch` | `admin@crisiscare.local` | `AdminDev2026pass` |
| Ambulance crew (all 28 units) | `#/ambulance` | unit call sign in lower case, e.g. `mum-als-01` | `CrewDev2026pass` (same for every crew) |
| Hospital emergency desk (all 105) | `#/hospital` | hospital ID, e.g. `kem_mumbai` | per hospital, e.g. `CareHosp@001` (full list below) |

The full lists follow: the dispatcher, then every crew login, then every hospital login.

### Dispatch (administrator): `#/dispatch`

| Email | Password |
| :--- | :--- |
| `admin@crisiscare.local` | `AdminDev2026pass` |

(Set by `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `backend/.env`.)

### Ambulance crews: `#/ambulance`

All crews share the password **`CrewDev2026pass`** (`SEED_CREW_PASSWORD` in `backend/.env`).

| Username | Crew member | Unit | Zone | Based at |
| :--- | :--- | :--- | :--- | :--- |
| `mum-als-01` | Asha Kulkarni | MUM-ALS-01 (ALS) | South Mumbai | KEM Hospital, Parel |
| `mum-als-02` | Rohan Deshmukh | MUM-ALS-02 (ALS) | Central Suburbs | Sion Hospital |
| `mum-bls-03` | Farah Sheikh | MUM-BLS-03 (BLS) | South Mumbai | Sir J.J. Hospital |
| `mum-bls-04` | Vikram Patil | MUM-BLS-04 (BLS) | South Mumbai | B.Y.L. Nair Hospital |
| `wst-als-05` | Neha Joshi | WST-ALS-05 (ALS) | Western Suburbs | Cooper Hospital |
| `wst-bls-06` | Imran Khan | WST-BLS-06 (BLS) | Western Suburbs | Shatabdi Hospital, Kandivali |
| `cen-als-07` | Sunita Pawar | CEN-ALS-07 (ALS) | Central Suburbs | Rajawadi Hospital |
| `thn-als-08` | Ganesh More | THN-ALS-08 (ALS) | Thane & Kalyan | CSM Hospital, Kalwa |
| `nvm-als-09` | Priya Nair | NVM-ALS-09 (ALS) | Navi Mumbai & Panvel | NMMC Hospital, Vashi |
| `nvm-bls-10` | Sachin Patil | NVM-BLS-10 (BLS) | Navi Mumbai & Panvel | MGM Hospital, Kamothe |
| `pal-bls-11` | Kiran Vartha | PAL-BLS-11 (BLS) | Palghar & Vasai-Virar | Rural Hospital, Palghar |
| `pal-bls-12` | Mahesh Dhodi | PAL-BLS-12 (BLS) | Palghar & Vasai-Virar | Sub-District Hospital, Dahanu |
| `vsi-als-13` | Joseph D'Souza | VSI-ALS-13 (ALS) | Palghar & Vasai-Virar | D.M. Petit Hospital, Vasai |
| `mum-als-14` | Meera Iyer | MUM-ALS-14 (ALS) | South Mumbai | St. George Hospital |
| `mum-bls-15` | Arjun Naik | MUM-BLS-15 (BLS) | South Mumbai | H.N. Reliance Hospital |
| `wst-als-16` | Pooja Bhatt | WST-ALS-16 (ALS) | Western Suburbs | V.N. Desai Hospital, Santacruz |
| `wst-bls-17` | Salman Ansari | WST-BLS-17 (BLS) | Western Suburbs | HBT Trauma Hospital, Jogeshwari |
| `wst-bls-18` | Dinesh Yadav | WST-BLS-18 (BLS) | Western Suburbs | Bhaktivedanta Hospital, Mira Road |
| `cen-bls-19` | Rekha Gaikwad | CEN-BLS-19 (BLS) | Central Suburbs | Bhabha Hospital, Kurla |
| `cen-als-20` | Tushar Kadam | CEN-ALS-20 (ALS) | Central Suburbs | M.T. Agarwal Hospital, Mulund |
| `thn-bls-21` | Anita Shinde | THN-BLS-21 (BLS) | Thane & Kalyan | Highland Hospital, Thane |
| `thn-als-22` | Faisal Qureshi | THN-ALS-22 (ALS) | Thane & Kalyan | Fortis Hospital, Kalyan |
| `thn-bls-23` | Lata Chavan | THN-BLS-23 (BLS) | Thane & Kalyan | Central Hospital, Ulhasnagar. **Starts OFFLINE** |
| `nvm-als-24` | Rahul Mhatre | NVM-ALS-24 (ALS) | Navi Mumbai & Panvel | NBC Hospital, Airoli |
| `nvm-bls-25` | Sneha Jadhav | NVM-BLS-25 (BLS) | Navi Mumbai & Panvel | Terna Hospital, Nerul |
| `nvm-bls-26` | Omkar Salvi | NVM-BLS-26 (BLS) | Navi Mumbai & Panvel | Sub-District Hospital, Panvel. **Starts in MAINTENANCE** |
| `vsi-als-27` | Glen Fernandes | VSI-ALS-27 (ALS) | Palghar & Vasai-Virar | Cardinal Gracias Hospital, Vasai |
| `pal-bls-28` | Bhavesh Raut | PAL-BLS-28 (BLS) | Palghar & Vasai-Virar | Rural Hospital, Kasa |

Units 14 to 28 are **demo fixtures** added for dispatch demonstrations (invented crew names, real hospital coordinates used as base stations, registration numbers start with `DEV-`). They are not real emergency services and have no live position until a crew signs in with GPS on. The two units that start OFFLINE and in MAINTENANCE exist to show that only available units are ever dispatched. Re-running `npm run db:seed` never duplicates units or crews and never changes a unit's current status or position.

### Hospital emergency desks: `#/hospital`

Each hospital has its own **hospital ID** (equal to its `seed_key`) and password. The same list is in `backend/data/hospital_admin_credentials.csv`.

| # | Hospital | Hospital ID | Password | Zone |
| ---: | :--- | :--- | :--- | :--- |
| 1 | KEM Hospital (Seth G.S. Medical College) | `kem_mumbai` | `CareHosp@001` | South Mumbai |
| 2 | Lokmanya Tilak Municipal General Hospital (Sion Hospital) | `sion_mumbai` | `CareHosp@002` | Central Suburbs |
| 3 | Sir J.J. Hospital | `jj_mumbai` | `CareHosp@003` | South Mumbai |
| 4 | B.Y.L. Nair Hospital | `nair_mumbai` | `CareHosp@004` | South Mumbai |
| 5 | Lilavati Hospital and Research Centre | `lilavati_mumbai` | `CareHosp@005` | Western Suburbs |
| 6 | Kokilaben Dhirubhai Ambani Hospital | `kokilaben_mumbai` | `CareHosp@006` | Western Suburbs |
| 7 | Jaslok Hospital and Research Centre | `jaslok_mumbai` | `CareHosp@007` | South Mumbai |
| 8 | P.D. Hinduja Hospital and Medical Research Centre | `hinduja_mumbai` | `CareHosp@008` | Western Suburbs |
| 9 | Bombay Hospital and Medical Research Centre | `bombay_mumbai` | `CareHosp@009` | South Mumbai |
| 10 | Wockhardt Hospital, Mumbai Central | `wockhardt_mumbai` | `CareHosp@010` | South Mumbai |
| 11 | Nanavati Max Super Speciality Hospital | `nanavati_mumbai` | `CareHosp@011` | Western Suburbs |
| 12 | Holy Family Hospital, Bandra | `holyfamily_mumbai` | `CareHosp@012` | Western Suburbs |
| 13 | Fortis Hospital, Mulund | `fortis_mulund` | `CareHosp@013` | Central Suburbs |
| 14 | Saifee Hospital | `saifee_mumbai` | `CareHosp@014` | South Mumbai |
| 15 | HBT Medical College and Dr. R.N. Cooper Hospital | `cooper_mumbai` | `CareHosp@015` | Western Suburbs |
| 16 | Rajawadi Hospital | `rajawadi_mumbai` | `CareHosp@016` | Central Suburbs |
| 17 | K.B. Bhabha Municipal General Hospital | `bhabha_mumbai` | `CareHosp@017` | Western Suburbs |
| 18 | Breach Candy Hospital Trust | `breachcandy_mumbai` | `CareHosp@018` | South Mumbai |
| 19 | Apollo Hospitals, Navi Mumbai (CBD Belapur) | `apollo_navimumbai` | `CareHosp@019` | Navi Mumbai & Panvel |
| 20 | Gleneagles Hospital (Global), Parel | `gleneagles_mumbai` | `CareHosp@020` | South Mumbai |
| 21 | SevenHills Hospital (Reliance Foundation), Marol | `sevenhills_mumbai` | `CareHosp@021` | Central Suburbs |
| 22 | Dr. L.H. Hiranandani Hospital, Powai | `hiranandani_mumbai` | `CareHosp@022` | Central Suburbs |
| 23 | Shri Harilal Bhagwati Municipal Hospital, Borivali | `bhagwati_mumbai` | `CareHosp@023` | Western Suburbs |
| 24 | Sassoon General Hospital | `sassoon_pune` | `CareHosp@024` | Pune |
| 25 | Ruby Hall Clinic, Sassoon Road | `rubyhall_pune` | `CareHosp@025` | Pune |
| 26 | Jehangir Hospital | `jehangir_pune` | `CareHosp@026` | Pune |
| 27 | Deenanath Mangeshkar Hospital and Research Center | `dmh_pune` | `CareHosp@027` | Pune |
| 28 | KEM Hospital, Rasta Peth | `kem_pune` | `CareHosp@028` | Pune |
| 29 | Aditya Birla Memorial Hospital, Chinchwad | `abmh_pune` | `CareHosp@029` | Pimpri-Chinchwad |
| 30 | Sahyadri Super Speciality Hospital, Deccan Gymkhana | `sahyadri_pune` | `CareHosp@030` | Pune |
| 31 | Poona Hospital and Research Centre | `poona_pune` | `CareHosp@031` | Pune |
| 32 | Noble Hospitals and Research Centre, Hadapsar | `noble_pune` | `CareHosp@032` | Pune |
| 33 | PCMC Yashwantrao Chavan Memorial Hospital, Pimpri | `ycm_pune` | `CareHosp@033` | Pimpri-Chinchwad |
| 34 | Inamdar Multispeciality Hospital | `inamdar_pune` | `CareHosp@034` | Pune |
| 35 | Bharati Hospital, Dhankawadi | `bharati_pune` | `CareHosp@035` | Pune |
| 36 | Jupiter Hospital, Baner | `jupiter_pune` | `CareHosp@036` | Pune |
| 37 | Manipal Hospital, Kharadi | `manipal_kharadi_pune` | `CareHosp@037` | Pune |
| 38 | Government Medical College and Hospital (GMCH), Nagpur | `gmch_nagpur` | `CareHosp@038` | Nagpur |
| 39 | Indira Gandhi Government Medical College and Hospital (Mayo), Nagpur | `mayo_nagpur` | `CareHosp@039` | Nagpur |
| 40 | AIIMS Nagpur | `aiims_nagpur` | `CareHosp@040` | Nagpur |
| 41 | Orange City Hospital and Research Institute | `orangecity_nagpur` | `CareHosp@041` | Nagpur |
| 42 | Wockhardt Super Specialty Hospital, Nagpur | `wockhardt_nagpur` | `CareHosp@042` | Nagpur |
| 43 | KIMS-Kingsway Hospitals | `kims_nagpur` | `CareHosp@043` | Nagpur |
| 44 | Alexis Multispeciality Hospital | `alexis_nagpur` | `CareHosp@044` | Nagpur |
| 45 | CARE Hospitals, Nagpur | `care_nagpur` | `CareHosp@045` | Nagpur |
| 46 | Lata Mangeshkar Hospital, Digdoh | `lata_nagpur` | `CareHosp@046` | Nagpur |
| 47 | Government Medical College and Hospital (Ghati), Chhatrapati Sambhajinagar | `gmch_sambhajinagar` | `CareHosp@047` | Chhatrapati Sambhajinagar (Aurangabad) |
| 48 | MGM Medical College and Hospital, CIDCO | `mgm_sambhajinagar` | `CareHosp@048` | Chhatrapati Sambhajinagar (Aurangabad) |
| 49 | Kamalnayan Bajaj Hospital | `kamalnayan_sambhajinagar` | `CareHosp@049` | Chhatrapati Sambhajinagar (Aurangabad) |
| 50 | Seth Nandlal Dhoot Hospital and Research Foundation | `dhoot_sambhajinagar` | `CareHosp@050` | Chhatrapati Sambhajinagar (Aurangabad) |
| 51 | CARE United CIIGMA Hospitals | `ciigma_sambhajinagar` | `CareHosp@051` | Chhatrapati Sambhajinagar (Aurangabad) |
| 52 | Dr. Hedgewar Rugnalaya | `hedgewar_sambhajinagar` | `CareHosp@052` | Chhatrapati Sambhajinagar (Aurangabad) |
| 53 | District General Hospital, Nandurbar | `dgh_nandurbar` | `CareHosp@053` | Nandurbar |
| 54 | Sub District Hospital, Taloda | `sdh_taloda` | `CareHosp@054` | Taloda |
| 55 | Rural Hospital, Akkalkuwa | `rh_akkalkuwa` | `CareHosp@055` | Akkalkuwa |
| 56 | Rural Hospital, Shahada | `rh_shahada` | `CareHosp@056` | Shahada |
| 57 | General (District) Hospital, Gadchiroli | `gh_gadchiroli` | `CareHosp@057` | Gadchiroli |
| 58 | Sub District Hospital, Aheri | `sdh_aheri` | `CareHosp@058` | Aheri |
| 59 | Sub District Hospital, Armori | `sdh_armori` | `CareHosp@059` | Armori |
| 60 | SEARCH Hospital, Shodhgram | `search_shodhgram` | `CareHosp@060` | Shodhgram |
| 61 | Jupiter Hospital, Thane | `jupiter_thane` | `CareHosp@061` | Thane & Kalyan |
| 62 | Bethany Hospital | `bethany_thane` | `CareHosp@062` | Thane & Kalyan |
| 63 | Kaushalya Medical Foundation Trust Hospital | `kaushalya_thane` | `CareHosp@063` | Thane & Kalyan |
| 64 | Chhatrapati Shivaji Maharaj Hospital, Kalwa | `csmh_kalwa_thane` | `CareHosp@064` | Thane & Kalyan |
| 65 | Highland Super Speciality Hospital | `highland_thane` | `CareHosp@065` | Thane & Kalyan |
| 66 | Fortis Hiranandani Hospital, Vashi | `fortis_vashi` | `CareHosp@066` | Navi Mumbai & Panvel |
| 67 | Dr. D.Y. Patil Hospital, Nerul | `dypatil_nerul` | `CareHosp@067` | Navi Mumbai & Panvel |
| 68 | NMMC General Hospital, Vashi | `nmmc_vashi` | `CareHosp@068` | Navi Mumbai & Panvel |
| 69 | MGM New Bombay Hospital, Vashi | `mgm_vashi` | `CareHosp@069` | Navi Mumbai & Panvel |
| 70 | Lokmanya Hospital, Chinchwad | `lokmanya_chinchwad` | `CareHosp@070` | Pimpri-Chinchwad |
| 71 | Dr. D.Y. Patil Hospital and Research Centre, Pimpri | `dypatil_pimpri` | `CareHosp@071` | Pimpri-Chinchwad |
| 72 | Civil Hospital, Nashik | `civil_nashik` | `CareHosp@072` | Nashik |
| 73 | Ashoka Medicover Hospital, Nashik | `medicover_nashik` | `CareHosp@073` | Nashik |
| 74 | Apollo Hospitals, Nashik | `apollo_nashik` | `CareHosp@074` | Nashik |
| 75 | Dr. Vasantrao Pawar Medical College, Hospital and Research Center | `vpmc_nashik` | `CareHosp@075` | Nashik |
| 76 | Bai Rukminibai Hospital (KDMC), Kalyan | `rukminibai_kalyan` | `CareHosp@076` | Thane & Kalyan |
| 77 | KDMC General Hospital, Shastri Nagar, Dombivli | `shastrinagar_dombivli` | `CareHosp@077` | Thane & Kalyan |
| 78 | ICON Hospital, Dombivli | `icon_dombivli` | `CareHosp@078` | Thane & Kalyan |
| 79 | VVCMC D.M. Petit Municipal Hospital, Vasai | `dmpetit_vasai` | `CareHosp@079` | Palghar & Vasai-Virar |
| 80 | Wellcare Multispeciality Hospital, Virar | `wellcare_virar` | `CareHosp@080` | Palghar & Vasai-Virar |
| 81 | St. George's Hospital | `stgeorge_mumbai` | `CareHosp@081` | South Mumbai |
| 82 | Gokuldas Tejpal (G.T.) Hospital | `gt_mumbai` | `CareHosp@082` | South Mumbai |
| 83 | Sir H.N. Reliance Foundation Hospital | `hnreliance_mumbai` | `CareHosp@083` | South Mumbai |
| 84 | Masina Hospital (Burns Centre) | `masina_mumbai` | `CareHosp@084` | South Mumbai |
| 85 | Cama and Albless Hospital (Women & Children) | `cama_mumbai` | `CareHosp@085` | South Mumbai |
| 86 | Bhatia Hospital | `bhatia_mumbai` | `CareHosp@086` | South Mumbai |
| 87 | Bai Jerbai Wadia Hospital for Children | `wadia_children_mumbai` | `CareHosp@087` | South Mumbai |
| 88 | HBT Trauma Care Municipal Hospital, Jogeshwari | `hbttrauma_jogeshwari` | `CareHosp@088` | Western Suburbs |
| 89 | Dr. Babasaheb Ambedkar (Shatabdi) Municipal Hospital, Kandivali | `shatabdi_kandivali` | `CareHosp@089` | Western Suburbs |
| 90 | V.N. Desai Municipal General Hospital, Santacruz | `vndesai_santacruz` | `CareHosp@090` | Western Suburbs |
| 91 | Bhaktivedanta Hospital, Mira Road | `bhaktivedanta_mira` | `CareHosp@091` | Western Suburbs |
| 92 | Wockhardt Hospital, Mira Road | `wockhardt_mira` | `CareHosp@092` | Western Suburbs |
| 93 | M.T. Agarwal Municipal Hospital, Mulund | `mtagarwal_mulund` | `CareHosp@093` | Central Suburbs |
| 94 | K.B. Bhabha Municipal Hospital, Kurla | `kurlabhabha_mumbai` | `CareHosp@094` | Central Suburbs |
| 95 | Central Hospital, Ulhasnagar (Govt.) | `central_ulhasnagar` | `CareHosp@095` | Thane & Kalyan |
| 96 | Fortis Hospital, Kalyan | `fortis_kalyan` | `CareHosp@096` | Thane & Kalyan |
| 97 | National Burns Centre, Airoli | `nbc_airoli` | `CareHosp@097` | Navi Mumbai & Panvel |
| 98 | Terna Sahyadri Speciality Hospital, Nerul | `terna_nerul` | `CareHosp@098` | Navi Mumbai & Panvel |
| 99 | MGM Hospital, Kamothe | `mgm_kamothe` | `CareHosp@099` | Navi Mumbai & Panvel |
| 100 | Sub-District Hospital, Panvel (Govt.) | `sdh_panvel` | `CareHosp@100` | Navi Mumbai & Panvel |
| 101 | Cardinal Gracias Memorial Hospital, Vasai | `cardinalgracias_vasai` | `CareHosp@101` | Palghar & Vasai-Virar |
| 102 | Rural Hospital, Palghar (Govt.) | `rh_palghar` | `CareHosp@102` | Palghar & Vasai-Virar |
| 103 | Sub-District Hospital, Dahanu (Govt.) | `sdh_dahanu` | `CareHosp@103` | Palghar & Vasai-Virar |
| 104 | Rural Hospital, Kasa (Govt.) | `rh_kasa` | `CareHosp@104` | Palghar & Vasai-Virar |
| 105 | Patangshah Cottage Hospital, Jawhar (Govt.) | `patangshah_jawhar` | `CareHosp@105` | Palghar & Vasai-Virar |

---

## Demo walkthrough

Run `npm run db:demo` in `backend` (re-run with `-- --reset` to cancel the open demo cases and recreate them). It creates, through the same services the website uses:

| Case | Where | State |
| :--- | :--- | :--- |
| Chest pain, 60+ man, diabetes, high BP, allergic to aspirin, ECG shows ST elevation, triage red | Parel | Ambulance MUM-ALS-01 on scene, **Gleneagles Hospital (Global), Parel** asked and pending |
| Labour, 38 weeks, contractions every 4 minutes | Thane | Accepted by Highland Super Speciality Hospital, ambulance transporting |
| Road accident, 2 patients | Kurla | Ambulance dispatched |
| Suspected stroke | Andheri | Ambulance dispatched |
| Snake bite | Dahanu | Ambulance dispatched |
| Breathing difficulty | Nashik | **Waiting**: no ambulance within range (shows the "no unit free" alert) |

Suggested order:
1. **Home**: show the helplines, live figures and the hospital finder (pick "Chest pain" then "South Mumbai", then "Snake or animal bite" to see the ranking change).
2. **Ambulance**: sign in as `mum-als-01` / `CrewDev2026pass`. Asha sees the Parel patient, the injury, allergies, red triage with reasons, and the ranked hospitals.
3. **Hospital**: in another window sign in as `gleneagles_mumbai` / its password from the table. The same patient arrives; check the "Can you treat this patient?" panel, then **Accept**. Mark the ER *Limited* or *Full* to show the effect on ranking.
4. **Dispatch**: sign in as the administrator. Show the map, the queue flags, the Nashik call waiting, then assign a unit and cancel a duplicate.
5. **Report**: as a citizen, send a new report from `#/report` and watch the tracking page update live as the crew and hospital act.

---

## How the system decides

Rules live in `backend/src/services/matching.js` and `emergencyService.js`. They are decision aids that show their reasons; crews, hospitals and dispatchers make the final call.

**What each emergency needs** (examples): heart attack needs a cath lab, a cardiac ICU bed and a cardiologist; stroke needs a stroke unit, a CT scanner and a neurologist; burns need a burns unit and an ICU bed; pregnancy needs maternity and O-negative blood; snake bite needs anti-venom and a ventilator; poisoning needs poison treatment and an ICU bed; road accident, falls and bleeding need trauma care and a trauma surgeon. The assessment adds more: not breathing or unconscious adds a ventilator and ICU bed; severe bleeding adds O-negative blood; a baby or child adds children's emergency (and newborn ICU for babies); a pregnant patient adds maternity; kidney disease adds dialysis.

**Hospital ranking for a patient**, in this order: has not declined this patient, is not on diversion, number of missing requirements, then travel time (a hospital with *limited intake* counts as 15 minutes further). The nearest hospital and the extra minutes to the recommended one are always shown.

**Triage colour**
- *Red*: unconscious, not breathing, no pulse, severe bleeding, SpO2 below 90, systolic BP below 90, pulse above 130 or below 40, ST elevation, stroke within 4.5 hours, 20% or more burned, neurological signs after a bite, heavy bleeding in pregnancy.
- *Yellow*: drowsy, laboured breathing, rapid or weak pulse, SpO2 90 to 93, possible spine injury.
- *Green*: stable.

**Urgent priority** is set at report time for chest pain, breathing difficulty, severe bleeding, unconscious, stroke, anaphylaxis, electric shock, burns, a baby patient, a dangerous symptom (chest pain, hard to breathe, vomiting blood, cannot move a limb, confusion) or pain 4 to 5 out of 5. A red triage also turns a call urgent.

**Ambulance dispatch**: the nearest free unit within `DISPATCH_RADIUS_KM` (default 60) is assigned automatically using PostGIS distance. For urgent calls a BLS unit's distance counts 1.5 times, so an ALS unit is preferred unless a basic unit is much closer. When no unit is free the call waits in a queue (urgent first, then oldest) and is dispatched the moment a unit frees up. A dispatcher can override the unit until the crew reaches the patient.

**Hospital response**: only one hospital is asked at a time. A decline needs a reason and is final for that call. An accept reserves an ICU bed only if the patient needs one; the reservation is consumed on handover or released if the call is cancelled.

---

## Data

### Hospitals (105)
`backend/data/crisis_care_hospitals.json`: real hospital names and addresses with coordinates, each with a **zone**, **ownership** (public or private) and a **service profile**.

| Zone | Hospitals |
| :--- | :--- |
| South Mumbai | 16 (KEM, Sir J.J., B.Y.L. Nair, Jaslok, Bombay Hospital, Breach Candy, Wockhardt, Saifee, Gleneagles, St. George's, GT, HN Reliance, Masina, Cama and Albless, Bhatia, Wadia Children's) |
| Western Suburbs | 13 (Hinduja, Lilavati, Kokilaben, Nanavati, Holy Family, Bhabha Bandra, Cooper, Bhagwati, HBT Trauma Care Jogeshwari, Shatabdi Kandivali, V.N. Desai, Bhaktivedanta and Wockhardt Mira Road) |
| Central Suburbs | 7 (Sion, Rajawadi, Fortis Mulund, SevenHills, Hiranandani Powai, M.T. Agarwal Mulund, Bhabha Kurla) |
| Thane & Kalyan | 10 (Jupiter, Bethany, Kaushalya, CSM Kalwa, Highland, Rukminibai Kalyan, Fortis Kalyan, two in Dombivli, Ulhasnagar) |
| Navi Mumbai & Panvel | 9 (Apollo Belapur, Fortis Vashi, D.Y. Patil Nerul, NMMC Vashi, MGM Vashi, National Burns Centre Airoli, Terna Nerul, MGM Kamothe, Panvel Sub-District) |
| Palghar & Vasai-Virar | 7 (D.M. Petit Vasai, Cardinal Gracias Vasai, Wellcare Virar, Rural Hospital Palghar, Sub-District Dahanu, Rural Hospital Kasa, Patangshah Jawhar) |
| Other Maharashtra | Pune, Pimpri-Chinchwad, Nagpur, Chhatrapati Sambhajinagar, Nashik, Nandurbar and Gadchiroli districts |

Public (government and municipal) hospitals are marked **Govt** and offer free or low-cost treatment.

### Resources tracked per hospital (16)
ICU bed, cardiac ICU bed, ventilator, oxygen cylinder, CT scanner, trauma surgeon, cardiologist, neurologist, and blood units for A+, A-, B+, B-, AB+, AB-, O+, O-. Quantities are generated from `inventory_profiles.json` (by hospital tier and region) with a fixed random seed, so reseeding is repeatable. A hospital's own edits are never overwritten by a reseed.

### Services tracked per hospital (10)
Trauma, cath lab, stroke unit, burns, maternity, newborn ICU, paediatric emergency, dialysis, toxicology, anti-snake venom.

### Patient records
There is no account or sign-up. Each emergency has one patient record (`patients` table) filled from the reporter's optional taps and corrected by the crew on scene: name, age group (infant, child, teen, adult, senior), sex, blood group, known conditions, allergies, medications, and an emergency-contact name and phone. The reporter's own details, the injury photo, the symptoms and the crew's vitals and findings sit with the same emergency. Phone numbers are visible only to the assigned crew and dispatch.

### Ambulances (28)
Development fleet, units 1 to 13 plus 15 demo units, stationed at real hospital coordinates (see the crew table). Crew positions update from the crew's phone GPS; until a crew shares GPS, a unit shows its base station and is marked "last known".

---

## Security and privacy

- **Passwords**: bcrypt (cost 12). Login timing does not reveal whether a username exists.
- **Sessions**: JWT (default 12 hours) with a role claim. Each role is authorised separately: `HOSPITAL_ADMIN`, `AMBULANCE_CREW`, `ADMIN`. Tokens are kept in `sessionStorage` (per tab, cleared when the tab closes). **Hospital and dispatch screens lock after 15 minutes without activity**; an expired token signs out with a message.
- **Hospital isolation**: a hospital only sees and answers its own requests; a crew only acts on its own ambulance's call.
- **Public view**: the public tracking page never includes phone numbers, the photo or the patient's profile. Phone numbers go only to the assigned crew and dispatch; clinical details and photo go to the crew, the hospital asked and dispatch.
- **Hospital view**: the hospital sees the patient and findings, never the reporter's phone number.
- **Input**: everything is validated with express-validator (including phone format, enumerated tap answers, photo type and size) and every SQL statement is parameterised.
- **Limits**: helmet headers, CORS allow-list, 600 KB request limit (one compressed photo), login limiter (20 per 15 minutes), emergency-report limiter (15 per 15 minutes, `EMERGENCY_RATE_LIMIT`), general API limiter (1000 per 15 minutes).
- **Audit trail**: every stock change, ER status change, service change, accept, decline, dispatcher assignment and cancellation is written to `audit_logs`, which is append-only (a database trigger rejects UPDATE and DELETE). A database superuser could still drop the trigger, so this is tamper-evident for the application, not a cryptographic guarantee.
- **Sockets carry only ids**; clients refetch through the authorised REST API, so sockets never expose data REST would refuse. A citizen's tracking code (`CC-XXXXXXXX`, random) is the only credential for viewing or cancelling their own request.
- **Frontend safety net**: a crash in one screen shows a message with 108 and 112 buttons instead of a blank page.

---

## API reference

Base path `/api/v1`. Responses are `{ success, message, data }`; errors are `{ success: false, message, errors? }`. Send `Authorization: Bearer <token>` for protected routes.

### Public
| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/health` | Service, database and PostGIS health |
| GET | `/stats` | Free ambulances, hospitals, active emergencies, report-to-acceptance time |
| GET | `/hospitals[?city=]` | Hospitals with available stock, services, zone, ownership, ER status |
| GET | `/hospitals/cities` | Cities and hospital counts |
| GET | `/hospitals/recommend?type=&lat=&lng=` | Hospitals ranked for an emergency type and location |
| POST | `/emergencies` | Report an emergency (type, lat, lng, optional details, photo) |
| GET | `/emergencies/:code` | Track by code (no phone numbers or photo) |
| POST | `/emergencies/:code/cancel` | Cancel before transport starts |

### Sign-in
| Method | Path | Body |
| :--- | :--- | :--- |
| POST | `/auth/hospital/login` | `{ username, password }` (hospital ID) |
| POST | `/auth/ambulance/login` | `{ username, password }` (unit call sign) |
| POST | `/auth/admin/login` | `{ username, password }` (`username` is the email) |

### Ambulance crew
`GET /ambulance/me`, `PUT /ambulance/location`, `PUT /ambulance/availability` (AVAILABLE or OFFLINE), `GET /ambulance/emergency/hospitals` (ranked for this patient), `POST /ambulance/emergency/assessment`, `PUT /ambulance/emergency/patient`, `POST /ambulance/emergency/select-hospital`, `POST /ambulance/emergency/stage` (ARRIVE_SCENE, START_TRANSPORT, ARRIVE_HOSPITAL, HANDOVER).

### Hospital staff
`GET /hospital/me`, `GET /hospital/requests`, `POST /hospital/requests/:responseId/respond` (ACCEPT or DECLINE with reason), `PATCH /hospital/inventory/:resourceCode` (`quantity` or `delta`), `PUT /hospital/surgeon`, `PUT /hospital/er-status` (ACCEPTING, LIMITED, DIVERSION), `PUT /hospital/services/:serviceCode`.

### Dispatch (administrator)
`GET /admin/overview`, `GET /admin/dispatch`, `POST /admin/emergencies/:code/assign` (`{ ambulanceId }`), `POST /admin/emergencies/:code/cancel` (`{ reason }`), `GET /admin/audit-logs`, `GET /admin/audit-logs/export` (CSV).

### Emergency types
Traffic Accident, Cardiac / Chest Pain, Breathing Difficulty, Severe Bleeding, Unconscious Person, Suspected Stroke, Seizure / Convulsion, Severe Burns, Fall from Height, Bone Fracture, Poisoning, Snakebite & Animal Bite, Pregnancy Emergency, Pediatric Emergency, Allergic Anaphylaxis, Electric Shock, Other Emergency.

### Emergency status flow
`SEARCHING` (queued) → `AMBULANCE_ASSIGNED` → `AT_SCENE` → `HOSPITAL_PENDING` → `HOSPITAL_ACCEPTED` (or `HOSPITAL_DECLINED`, then another hospital) → `TRANSPORTING` → `ARRIVED` → `CLOSED`; `CANCELLED` is possible until transport starts.

---

## Real-time events

Socket.IO rooms: `public` (everyone), `admin`, `hospital:{id}`, `ambulance:{id}` (from the JWT in the handshake) and `emergency:{code}` (joined by tracking code). Events: `emergency:changed`, `inventory:changed`, `audit:new`. All screens also poll slowly as a fallback for weak mobile connections.

---

## Database tables

Created by `backend/database/schema.sql` (safe to run repeatedly; new columns are added with `IF NOT EXISTS`).

| Table | Holds |
| :--- | :--- |
| `users` | Administrator accounts |
| `hospitals` | Name, address, phone, PostGIS location, tier, **zone, ownership, ER status and note** |
| `hospital_admins` | One login per hospital |
| `resources`, `hospital_inventory` | 16 resource types and per-hospital stock with reserved quantity and whether the hospital confirmed it |
| `hospital_services` | Which of the 10 services each hospital offers, and whether the hospital confirmed it |
| `surgeons`, `hospital_surgeons` | On-duty trauma surgeon and status |
| `ambulances`, `ambulance_crew` | Units (type, status, location, zone) and crew logins |
| `emergency_requests` | The call: type, location, status, **priority**, reporter's answers, photo, assigned ambulance and hospital |
| `patients` | **Patient record** per emergency |
| `patient_vitals` | Crew assessments: consciousness, breathing, pulse, SpO2, BP, **category findings and triage level** |
| `hospital_emergency_responses` | Each hospital's accept or decline, reason, and whether an ICU bed was reserved |
| `emergency_requirements`, `routes` | Reserved for future use |
| `audit_logs` | Append-only trail of every staff action |

---

## Project structure

```text
crisis-care/
├── docker-compose.yml            # PostgreSQL 16 + PostGIS 3.4
├── README.md
├── backend/
│   ├── .env.example              # copy to .env
│   ├── data/
│   │   ├── crisis_care_hospitals.json         # 105 hospitals (zone, ownership, services)
│   │   ├── inventory_profiles.json            # synthetic stock profiles
│   │   └── hospital_admin_credentials.csv     # DEVELOPMENT-ONLY hospital logins
│   ├── database/schema.sql
│   ├── src/
│   │   ├── server.js, app.js
│   │   ├── config/               # env validation, pg pool + transactions
│   │   ├── middleware/           # JWT auth, roles, error handler
│   │   ├── routes/ controllers/ services/
│   │   │   └── services/matching.js     # what a patient needs, triage, hospital fit
│   │   ├── realtime/socket.js
│   │   └── scripts/              # initDatabase, seedDatabase, seedDemo
│   └── test/flow.test.js         # end-to-end API + Socket.IO test
└── frontend/
    ├── vite.config.js            # dev server :3000, proxies /api and /socket.io
    └── src/
        ├── api/                  # fetch client, Socket.IO connection pool
        ├── context/              # routing, sessions, idle lock, tracking code
        ├── hooks/useLive.js      # fetch + refetch on socket events + poll
        ├── data/                 # emergency categories, helplines
        └── components/{client,ambulance,hospital,admin,dashboard,common}/
```

---

## Configuration

`backend/.env`:

| Variable | Purpose |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (use the port your database listens on) |
| `JWT_SECRET` | **Required.** Long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`); at least 32 characters when `NODE_ENV=production` |
| `JWT_EXPIRES_IN` | Token lifetime, default `12h` |
| `PORT` | Backend port, default 5000 |
| `FRONTEND_URL` | Comma-separated allowed browser origins (CORS and Socket.IO) |
| `TRUST_PROXY` | `true` behind a reverse proxy so rate limits see real client IPs |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD` | Administrator created by the seed (password at least 10 characters) |
| `SEED_CREW_PASSWORD` | Password for every seeded ambulance crew (at least 10 characters) |
| `SEED_ALLOW_DEMO_CREDENTIALS` | In production, set `true` to load the hospital CSV logins |
| `DISPATCH_RADIUS_KM`, `HOSPITAL_SEARCH_RADIUS_KM`, `AVG_SPEED_KMH`, `EMERGENCY_RATE_LIMIT` | Optional tuning, defaults 60 / 80 / 30 / 15 |
| `GPS_STALE_MINUTES` | A unit whose last GPS fix is older than this is "stale": shown as last known, and no arrival time is computed from it. Default 5 |

The server refuses to start if `JWT_SECRET` or `DATABASE_URL` is missing. **Never commit `.env`** (it is git-ignored).

Frontend: `VITE_BACKEND_URL` (dev proxy target) and `VITE_API_URL` (for a separately hosted API; add the site's origin to `FRONTEND_URL`).

---

## Scripts and tests

| Where | Command | Purpose |
| :--- | :--- | :--- |
| backend | `npm start` / `npm run dev` | Run the API and Socket.IO server (`dev` auto-reloads) |
| backend | `npm run db:init` | Apply `database/schema.sql` |
| backend | `npm run db:seed` | Seed hospitals, services, inventory, accounts, ambulances |
| backend | `npm run db:setup` | Both of the above |
| backend | `npm run db:demo` | Create demo cases (`-- --reset` to recreate) |
| backend | `npm test` | End-to-end test on a throwaway database |
| frontend | `npm run dev` | Dev server on :3000 |
| frontend | `npm run build` / `npm run preview` | Production bundle in `frontend/dist` / serve it |

`npm test` creates a throwaway database next to yours (`<dbname>_test`), applies the schema and seed, and exercises sign-in, role checks, validation, dispatch, hospital decline and accept, ICU reservation, every ambulance stage, queueing, cancellation, Socket.IO delivery and the audit log. The database user must be allowed to `CREATE DATABASE`. It takes about a minute because of password hashing.

---

## Data honesty and limitations

- **Hospital stock is synthetic until a hospital confirms it.** The hospitals and their addresses are real; seeded inventory and service profiles are generated. Screens label figures *sample* until hospital staff edit them, then show when they were confirmed.
- **25 hospitals were added by hand** (South Mumbai, suburbs, Mira-Bhayandar, Panvel, Palghar district). Their map pins are approximate (`coord_quality = approximate_manual`, `verify_pin = true`) and most have no phone number. Verify before real use.
- **No integration with hospital systems.** Stock is what each hospital's staff type in.
- **Travel times are estimates**: straight-line distance divided by `AVG_SPEED_KMH`, labelled as such everywhere. There is no road routing or traffic data (the "Navigate" buttons open Google Maps, which does its own routing); map lines are straight. No arrival time is shown when the unit has no live GPS, an unusable position, or a fix older than `GPS_STALE_MINUTES`.
- **Unit positions are only as live as the crew's phone GPS.** There is no GPS simulator; seeded units sit at their base station until a crew shares a position.
- **No address geocoding.** Location comes from GPS or the nearest-area buttons; the landmark text is informational.
- **Anonymous reporting** (no phone verification) keeps help from being blocked but allows prank calls. Rate limiting is the only mitigation; dispatch can cancel a call with a reason.
- **Matching rules are a decision aid** based on general emergency-care principles, not clinical advice. The crew and hospital decide.
- The ambulance fleet and demo cases are development fixtures. Dispatch only considers units within `DISPATCH_RADIUS_KM`; otherwise the call waits in the queue.
- **Always call 108 or 112 in a real emergency.** This software is not a replacement for the emergency numbers.

---

## Credits

- Hospital photos: Lilavati Hospital, Bandra (Nichalp), P.D. Hinduja Hospital (Dpb696, Jkl0101), via Wikimedia Commons, CC BY-SA. Ambulance photo: Satyam Shukla 28, Wikimedia Commons, CC0.
- Map data: OpenStreetMap contributors.
- Icons: lucide-react. Colour palette follows the NHS identity colours.
- The citizen report uses tap-to-answer questions instead of free text so a reporter never has to type under stress. The only typed fields are credentials, an optional phone number, an optional landmark, search boxes, numeric vitals and stock counts, and the surgeon's name.
