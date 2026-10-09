-- =============================================================================
-- Migration 010: Replace all hospitals with Mumbai-only BMC/city hospitals
--
-- Source: files/crisis_care_hospitals.csv  (cluster = 'Mumbai', city = 'Mumbai')
-- 22 hospitals, all within Greater Mumbai municipal limits.
-- Passwords hashed with bcrypt cost 12 from hospital_admin_credentials.csv.
-- All passwords follow the pattern CareHosp@NNN — pre-hashed below.
-- Hash for ALL CareHosp@NNN passwords (cost 12):
--   CareHosp@001 → stored per-hospital below (same hash pattern, generated once for demo)
-- For demo we use a SINGLE shared hash: bcrypt('CareHosp@001', 12)
-- = $2b$12$Y8RVe.RWjeToOaDHx3nnBO7tS9OlfIRSwEqJBkbYIXSXtWSxG3.zW
-- =============================================================================

BEGIN;

-- ── Step 1: Wipe non-Mumbai data (cascades to resources, admin_users, reservations) ──
DELETE FROM hospitals WHERE cluster != 'Mumbai' OR city != 'Mumbai';

-- ── Step 2: Remove lingering hospitals that aren't in our 22-hospital Mumbai list ──
DELETE FROM hospitals
WHERE seed_key IS NULL
   OR seed_key NOT IN (
     'kem_mumbai','sion_mumbai','jj_mumbai','nair_mumbai',
     'lilavati_mumbai','kokilaben_mumbai','jaslok_mumbai','hinduja_mumbai',
     'bombay_mumbai','wockhardt_mumbai','nanavati_mumbai','holyfamily_mumbai',
     'fortis_mulund','saifee_mumbai','cooper_mumbai','rajawadi_mumbai',
     'bhabha_mumbai','breachcandy_mumbai','gleneagles_mumbai','sevenhills_mumbai',
     'hiranandani_mumbai','bhagwati_mumbai'
   );

-- ── Step 3: Upsert all 22 Mumbai hospitals ────────────────────────────────────

INSERT INTO hospitals (name, geom, address, phone, tier, seed_key, city, cluster, region_type, google_place_id)
VALUES
  ('KEM Hospital (Seth G.S. Medical College)',
   ST_SetSRID(ST_MakePoint(72.841973,19.001435),4326)::geography,
   'Acharya Donde Marg, Parel, Mumbai 400012','+91 22 2410 7000',1,
   'kem_mumbai','Mumbai','Mumbai','urban_dense','ChIJWcdwNuXO5zsR4MLLE1zcCTU'),

  ('Lokmanya Tilak Municipal General Hospital (Sion Hospital)',
   ST_SetSRID(ST_MakePoint(72.859466,19.035843),4326)::geography,
   'Sion West, Mumbai 400022','+91 22 2406 3267',1,
   'sion_mumbai','Mumbai','Mumbai','urban_dense','ChIJ6TgtONPI5zsRZ6qBqX8OruA'),

  ('Sir J.J. Hospital',
   ST_SetSRID(ST_MakePoint(72.833703,18.962641),4326)::geography,
   'J J Marg, Nagpada, Mumbai 400008','+91 22 2373 5555',1,
   'jj_mumbai','Mumbai','Mumbai','urban_dense','ChIJUeRSVCjP5zsRIWoGT-BKebA'),

  ('B.Y.L. Nair Hospital',
   ST_SetSRID(ST_MakePoint(72.821866,18.972880),4326)::geography,
   'Dr. A. L. Nair Marg, Mumbai Central, Mumbai 400008','+91 22 2302 7000',1,
   'nair_mumbai','Mumbai','Mumbai','urban_dense','ChIJAQC01m7O5zsRzE8ay6azRPs'),

  ('Lilavati Hospital and Research Centre',
   ST_SetSRID(ST_MakePoint(72.829323,19.051004),4326)::geography,
   'A-791, Bandra Reclamation Rd, Bandra West, Mumbai 400050','+91 22 6930 1000',1,
   'lilavati_mumbai','Mumbai','Mumbai','urban_dense','ChIJsXCptzjJ5zsRlS-bPoti--k'),

  ('Kokilaben Dhirubhai Ambani Hospital',
   ST_SetSRID(ST_MakePoint(72.824988,19.130931),4326)::geography,
   'Four Bungalows, Andheri West, Mumbai 400053',NULL,1,
   'kokilaben_mumbai','Mumbai','Mumbai','urban_dense','ChIJaUzg1x625zsRJCynVxLFYDg'),

  ('Jaslok Hospital and Research Centre',
   ST_SetSRID(ST_MakePoint(72.809832,18.971660),4326)::geography,
   '15, Dr Gopalrao Deshmukh Marg, Peddar Rd, Mumbai 400026','+91 99301 92000',1,
   'jaslok_mumbai','Mumbai','Mumbai','urban_dense','ChIJk3X00XbO5zsRx2UpTspHr3M'),

  ('P.D. Hinduja Hospital and Medical Research Centre',
   ST_SetSRID(ST_MakePoint(72.839110,19.032875),4326)::geography,
   'Veer Savarkar Marg, Mahim West, Mumbai 400016','+91 22 6924 8000',1,
   'hinduja_mumbai','Mumbai','Mumbai','urban_dense','ChIJhaDBes3O5zsRBbIMQcxSM_c'),

  ('Bombay Hospital and Medical Research Centre',
   ST_SetSRID(ST_MakePoint(72.827433,18.941069),4326)::geography,
   '12, Vitthaldas Thackersey Marg, New Marine Lines, Mumbai 400020','+91 22 2206 7676',1,
   'bombay_mumbai','Mumbai','Mumbai','urban_dense','ChIJkwIlDeDR5zsRkVBOhODKuv4'),

  ('Wockhardt Hospital, Mumbai Central',
   ST_SetSRID(ST_MakePoint(72.823888,18.975212),4326)::geography,
   '1877, Dr Anandrao Nair Marg, Mumbai Central, Mumbai 400011','+91 82911 01001',1,
   'wockhardt_mumbai','Mumbai','Mumbai','urban_dense','ChIJkZClnGjO5zsRwcGDYzFLyCw'),

  ('Nanavati Max Super Speciality Hospital',
   ST_SetSRID(ST_MakePoint(72.840261,19.095882),4326)::geography,
   'Swami Vivekanand Rd, Vile Parle West, Mumbai 400056','+91 22 6836 0000',1,
   'nanavati_mumbai','Mumbai','Mumbai','urban_dense','ChIJYcI0nLrJ5zsRVYAvxUyzk64'),

  ('Holy Family Hospital, Bandra',
   ST_SetSRID(ST_MakePoint(72.827269,19.055125),4326)::geography,
   'St Andrews Rd, Bandra West, Mumbai 400050','+91 22 6267 0555',2,
   'holyfamily_mumbai','Mumbai','Mumbai','urban_dense','ChIJie0TXT7J5zsRjxl3Abj8ksI'),

  ('Fortis Hospital, Mulund',
   ST_SetSRID(ST_MakePoint(72.941809,19.161794),4326)::geography,
   'Mulund-Goregaon Link Rd, Mulund West, Mumbai 400078',NULL,1,
   'fortis_mulund','Mumbai','Mumbai','urban_dense','ChIJYdMKQV645zsRluAWkv57qWw'),

  ('Saifee Hospital',
   ST_SetSRID(ST_MakePoint(72.818256,18.952532),4326)::geography,
   'Maharshi Karve Rd, Charni Road, Mumbai 400004','+91 22 6757 0111',2,
   'saifee_mumbai','Mumbai','Mumbai','urban_dense','ChIJ5fYZmxrO5zsRrokKoLjCucg'),

  ('HBT Medical College and Dr. R.N. Cooper Hospital',
   ST_SetSRID(ST_MakePoint(72.836205,19.107768),4326)::geography,
   'Bhaktivedanta Swami Rd, JVPD Scheme, Juhu, Mumbai 400056','+91 22 2620 7254',1,
   'cooper_mumbai','Mumbai','Mumbai','urban_dense','ChIJW78A8cbJ5zsR8IL8eRtqoVg'),

  ('Rajawadi Hospital',
   ST_SetSRID(ST_MakePoint(72.901298,19.078675),4326)::geography,
   '7th Rd, Rajawadi Colony, Ghatkopar East, Mumbai 400077',NULL,2,
   'rajawadi_mumbai','Mumbai','Mumbai','urban_dense','ChIJq6qqqs_H5zsR_kBjsn8Z_7E'),

  ('K.B. Bhabha Municipal General Hospital',
   ST_SetSRID(ST_MakePoint(72.833645,19.057454),4326)::geography,
   'Waterfield Rd, Bandra West, Mumbai 400050','+91 22 2642 2541',2,
   'bhabha_mumbai','Mumbai','Mumbai','urban_dense','ChIJjzjPrD_J5zsRb6L4MOpQ1KY'),

  ('Breach Candy Hospital Trust',
   ST_SetSRID(ST_MakePoint(72.804567,18.972535),4326)::geography,
   '60 A, Bhulabhai Desai Rd, Breach Candy, Mumbai 400026','+91 22 6259 7788',2,
   'breachcandy_mumbai','Mumbai','Mumbai','urban_dense','ChIJTZphhnnO5zsRzn8BB0ICCWA'),

  ('Gleneagles Hospital (Global), Parel',
   ST_SetSRID(ST_MakePoint(72.840605,18.999504),4326)::geography,
   '35, Dr Ernest Borges Rd, Parel East, Mumbai 400012','+91 92402 61611',1,
   'gleneagles_mumbai','Mumbai','Mumbai','urban_dense','ChIJxatUrvDO5zsRbXpEagVP2ts'),

  ('SevenHills Hospital (Reliance Foundation), Marol',
   ST_SetSRID(ST_MakePoint(72.878037,19.118000),4326)::geography,
   'Marol Maroshi Rd, Andheri East, Mumbai 400059','+91 22 6767 6766',1,
   'sevenhills_mumbai','Mumbai','Mumbai','urban_dense','ChIJ690opxfI5zsR05T02iSmmZU'),

  ('Dr. L.H. Hiranandani Hospital, Powai',
   ST_SetSRID(ST_MakePoint(72.916950,19.120519),4326)::geography,
   'Hillside Avenue, Hiranandani Gardens, Powai, Mumbai 400076','+91 84240 07007',1,
   'hiranandani_mumbai','Mumbai','Mumbai','urban_dense','ChIJ6R9iLOzH5zsRNGhlhglnL3o'),

  ('Shri Harilal Bhagwati Municipal Hospital, Borivali',
   ST_SetSRID(ST_MakePoint(72.854827,19.241283),4326)::geography,
   'SV Patel Rd, Borivali West, Mumbai 400103',NULL,2,
   'bhagwati_mumbai','Mumbai','Mumbai','urban_dense','ChIJK79m-t6w5zsR3ZcNcpCKPgM')
ON CONFLICT (seed_key) DO UPDATE SET
  name            = EXCLUDED.name,
  geom            = EXCLUDED.geom,
  address         = EXCLUDED.address,
  phone           = EXCLUDED.phone,
  tier            = EXCLUDED.tier,
  city            = EXCLUDED.city,
  cluster         = EXCLUDED.cluster,
  region_type     = EXCLUDED.region_type,
  google_place_id = EXCLUDED.google_place_id;

-- ── Step 4: Upsert admin_users for all 22 Mumbai hospitals ───────────────────
-- All passwords are CareHosp@001 … @022 for demo.
-- Hash = bcrypt('CareHosp@001', 12) — same hash used for all demo accounts.
-- Real deployments should hash individually.
-- hash: $2b$12$Y8RVe.RWjeToOaDHx3nnBO7tS9OlfIRSwEqJBkbYIXSXtWSxG3.zW

INSERT INTO admin_users (hospital_id, username, hashed_password)
SELECT h.id, h.seed_key, '$2b$12$Y8RVe.RWjeToOaDHx3nnBO7tS9OlfIRSwEqJBkbYIXSXtWSxG3.zW'
FROM hospitals h
WHERE h.cluster = 'Mumbai'
ON CONFLICT (username) DO UPDATE SET
  hospital_id     = EXCLUDED.hospital_id,
  hashed_password = EXCLUDED.hashed_password;

-- Keep the master super-admin (adm_shivam_027) linked to the first Mumbai hospital
INSERT INTO admin_users (hospital_id, username, hashed_password)
SELECT h.id, 'adm_shivam_027', '$2b$12$WFp1Q.dF.Y/E3o5kFNT8n.4/IKiVpY.TlVvQvpgkqJPkJxK5UJj/e'
FROM hospitals h WHERE h.seed_key = 'kem_mumbai'
ON CONFLICT (username) DO UPDATE SET hospital_id = EXCLUDED.hospital_id;

-- ── Step 5: Seed resources for every Mumbai hospital ─────────────────────────
-- Randomised realistic quantities per resource type using deterministic seed.
INSERT INTO resources (hospital_id, resource_type, quantity_available, last_updated_at, staleness_threshold_minutes)
SELECT
  h.id,
  rt.resource_type::resource_type_enum,
  CASE rt.resource_type
    WHEN 'icu_bed'                     THEN (5  + (h.id * 7  + rt.ord * 3) % 16)
    WHEN 'ventilator'                  THEN (2  + (h.id * 11 + rt.ord * 5) % 10)
    WHEN 'oxygen_cylinder'             THEN (20 + (h.id * 13 + rt.ord * 7) % 40)
    WHEN 'blood_a_pos'                 THEN (3  + (h.id * 5  + rt.ord * 2) % 12)
    WHEN 'blood_b_pos'                 THEN (2  + (h.id * 9  + rt.ord * 4) % 10)
    WHEN 'blood_o_neg'                 THEN (1  + (h.id * 3  + rt.ord * 6) % 8)
    WHEN 'blood_ab_pos'                THEN (1  + (h.id * 7  + rt.ord * 3) % 6)
    WHEN 'specialist_trauma_surgeon'   THEN (1  + (h.id * 2  + rt.ord    ) % 3)
    WHEN 'specialist_cardiologist'     THEN (1  + (h.id * 3  + rt.ord    ) % 3)
    WHEN 'specialist_neurologist'      THEN (0  + (h.id * 4  + rt.ord    ) % 3)
    WHEN 'equipment_ct_scanner'        THEN (1  + (h.id * 5  + rt.ord    ) % 2)
    WHEN 'equipment_mri_trauma_ready'  THEN (0  + (h.id * 6  + rt.ord    ) % 2)
    WHEN 'equipment_dialysis'          THEN (2  + (h.id * 7  + rt.ord    ) % 5)
    WHEN 'labor_delivery_bed'          THEN (2  + (h.id * 8  + rt.ord    ) % 6)
    WHEN 'pediatric_icu_bed'           THEN (1  + (h.id * 9  + rt.ord    ) % 4)
    ELSE 5
  END AS quantity_available,
  NOW() - (((h.id * 17 + rt.ord * 11) % 45) || ' minutes')::interval AS last_updated_at,
  CASE rt.resource_type
    WHEN 'icu_bed'        THEN 30
    WHEN 'ventilator'     THEN 30
    WHEN 'oxygen_cylinder'THEN 60
    ELSE 120
  END AS staleness_threshold_minutes
FROM hospitals h
CROSS JOIN (
  VALUES
    (1,  'icu_bed'),
    (2,  'ventilator'),
    (3,  'oxygen_cylinder'),
    (4,  'blood_a_pos'),
    (5,  'blood_b_pos'),
    (6,  'blood_o_neg'),
    (7,  'blood_ab_pos'),
    (8,  'specialist_trauma_surgeon'),
    (9,  'specialist_cardiologist'),
    (10, 'specialist_neurologist'),
    (11, 'equipment_ct_scanner'),
    (12, 'equipment_mri_trauma_ready'),
    (13, 'equipment_dialysis'),
    (14, 'labor_delivery_bed'),
    (15, 'pediatric_icu_bed')
) AS rt(ord, resource_type)
WHERE h.cluster = 'Mumbai'
ON CONFLICT DO NOTHING;

COMMIT;
