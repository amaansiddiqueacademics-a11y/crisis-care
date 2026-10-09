BEGIN;

INSERT INTO hospitals (name, geom, address, phone, tier, seed_key, city, cluster, region_type, google_place_id)
VALUES
  ('Bhatia Hospital, Tardeo', ST_SetSRID(ST_MakePoint(72.8130,18.9663),4326)::geography, 'Tardeo Rd, Mumbai 400007', '+91 22 6666 0000', 2, 'bhatia_mumbai', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJBhatiaTardeo'),
  ('Sushrut Hospital and Research Centre', ST_SetSRID(ST_MakePoint(72.8943,19.0494),4326)::geography, 'Chembur, Mumbai 400071', '+91 22 2526 0000', 2, 'sushrut_chembur', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJSushrutChembur'),
  ('Zen Multi Speciality Hospital', ST_SetSRID(ST_MakePoint(72.9062,19.0536),4326)::geography, 'Chembur, Mumbai 400071', '+91 22 2529 4444', 2, 'zen_chembur', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJZenChembur'),
  ('Surana Sethia Hospital', ST_SetSRID(ST_MakePoint(72.9015,19.0487),4326)::geography, 'Chembur, Mumbai 400071', '+91 22 2522 7777', 2, 'surana_chembur', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJSuranaChembur'),
  ('Hinduja Healthcare Surgical', ST_SetSRID(ST_MakePoint(72.8354,19.0716),4326)::geography, 'Khar West, Mumbai 400052', '+91 22 6154 8989', 1, 'hinduja_khar', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJHindujaKhar'),
  ('S L Raheja Hospital - A Fortis Associate', ST_SetSRID(ST_MakePoint(72.8443,19.0422),4326)::geography, 'Mahim, Mumbai 400016', '+91 22 6652 9999', 1, 'raheja_mahim', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJRahejaMahim'),
  ('Sanjeevani Hospital', ST_SetSRID(ST_MakePoint(72.8624,19.1232),4326)::geography, 'Andheri East, Mumbai 400059', '+91 22 2821 0000', 2, 'sanjeevani_andheri', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJSanjeevaniAndheri'),
  ('Critikae Hospital', ST_SetSRID(ST_MakePoint(72.8872,19.0682),4326)::geography, 'Kurla West, Mumbai 400070', '+91 22 2503 1111', 2, 'critikae_kurla', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJCritikaeKurla'),
  ('Jupiter Hospital, Thane', ST_SetSRID(ST_MakePoint(72.9723,19.2085),4326)::geography, 'Eastern Express Hwy, Thane 400601', '+91 22 2172 5555', 1, 'jupiter_thane', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJJupiterThane'),
  ('Bethany Hospital', ST_SetSRID(ST_MakePoint(72.9662,19.2155),4326)::geography, 'Pokhran Rd 2, Thane 400610', '+91 22 2172 5000', 2, 'bethany_thane', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJBethanyThane'),
  ('Thunga Hospital', ST_SetSRID(ST_MakePoint(72.8576,19.1866),4326)::geography, 'Malad West, Mumbai 400064', '+91 22 2888 5555', 2, 'thunga_malad', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJThungaMalad'),
  ('Sushrut Hospital', ST_SetSRID(ST_MakePoint(72.8429,19.2272),4326)::geography, 'Borivali West, Mumbai 400092', '+91 22 2899 0000', 2, 'sushrut_borivali', 'Mumbai', 'Mumbai', 'urban_dense', 'ChIJSushrutBorivali')
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


INSERT INTO admin_users (hospital_id, username, hashed_password)
SELECT h.id, h.seed_key, '$2b$12$Y8RVe.RWjeToOaDHx3nnBO7tS9OlfIRSwEqJBkbYIXSXtWSxG3.zW'
FROM hospitals h
WHERE h.seed_key IN (
  'bhatia_mumbai', 'sushrut_chembur', 'zen_chembur', 'surana_chembur', 'hinduja_khar', 'raheja_mahim',
  'sanjeevani_andheri', 'critikae_kurla', 'jupiter_thane', 'bethany_thane', 'thunga_malad', 'sushrut_borivali'
)
ON CONFLICT (username) DO UPDATE SET
  hospital_id     = EXCLUDED.hospital_id,
  hashed_password = EXCLUDED.hashed_password;


INSERT INTO resources (hospital_id, resource_type, quantity_available, last_updated_at, staleness_threshold_minutes)
SELECT
  h.id,
  rt.resource_type::resource_type_enum,
  CASE rt.resource_type
    WHEN 'icu_bed'                     THEN (3  + (h.id * 7  + rt.ord * 3) % 10)
    WHEN 'ventilator'                  THEN (1  + (h.id * 11 + rt.ord * 5) % 6)
    WHEN 'oxygen_cylinder'             THEN (15 + (h.id * 13 + rt.ord * 7) % 30)
    WHEN 'blood_a_pos'                 THEN (2  + (h.id * 5  + rt.ord * 2) % 10)
    WHEN 'blood_b_pos'                 THEN (2  + (h.id * 9  + rt.ord * 4) % 8)
    WHEN 'blood_o_neg'                 THEN (1  + (h.id * 3  + rt.ord * 6) % 5)
    WHEN 'blood_ab_pos'                THEN (0  + (h.id * 7  + rt.ord * 3) % 4)
    WHEN 'specialist_trauma_surgeon'   THEN (0  + (h.id * 2  + rt.ord    ) % 2)
    WHEN 'specialist_cardiologist'     THEN (1  + (h.id * 3  + rt.ord    ) % 3)
    WHEN 'specialist_neurologist'      THEN (0  + (h.id * 4  + rt.ord    ) % 2)
    WHEN 'equipment_ct_scanner'        THEN (1  + (h.id * 5  + rt.ord    ) % 2)
    WHEN 'equipment_mri_trauma_ready'  THEN (0  + (h.id * 6  + rt.ord    ) % 2)
    WHEN 'equipment_dialysis'          THEN (1  + (h.id * 7  + rt.ord    ) % 4)
    WHEN 'labor_delivery_bed'          THEN (1  + (h.id * 8  + rt.ord    ) % 5)
    WHEN 'pediatric_icu_bed'           THEN (0  + (h.id * 9  + rt.ord    ) % 3)
    ELSE 3
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
WHERE h.seed_key IN (
  'bhatia_mumbai', 'sushrut_chembur', 'zen_chembur', 'surana_chembur', 'hinduja_khar', 'raheja_mahim',
  'sanjeevani_andheri', 'critikae_kurla', 'jupiter_thane', 'bethany_thane', 'thunga_malad', 'sushrut_borivali'
)
ON CONFLICT DO NOTHING;

COMMIT;
