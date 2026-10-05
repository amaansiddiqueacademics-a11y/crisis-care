#!/usr/bin/env python3
"""
Crisis Care — Inventory Seeder v2  (2026-09-20)

Reads files/inventory_profiles.json and crisis_care_hospitals.json,
then upserts one resources row per (hospital × resource_type) for all 80
hospitals, using rng_seed=42 for full reproducibility.

Assignment rule (per inventory_profiles.json .assignment field):
  suggested_tier=A                           -> tier_A_urban
  suggested_tier=B, region_type urban_*      -> tier_B_urban
  region_type=rural_sparse                   -> tier_B_rural

Profile key -> DB resource_type_enum mapping:
  icu_bed             -> icu_bed          (plain [min,max] range)
  ventilator          -> ventilator
  oxygen_cylinder     -> oxygen_cylinder
  trauma_surgeon      -> specialist_trauma_surgeon  (probabilistic {p, qty:[min,max]})
  ct_scanner          -> equipment_ct_scanner
  cardiologist        -> specialist_cardiologist
  cardiac_icu_bed     -> SKIPPED (maps to icu_bed which is already covered)
  neurologist         -> specialist_neurologist
  blood_units_each_type -> blood_a_pos, blood_a_neg, blood_b_pos, blood_b_neg,
                           blood_o_pos, blood_ab_pos  (same range for each)
  blood_O_neg         -> blood_o_neg
  blood_AB_neg        -> blood_ab_neg

Resources NOT in inventory_profiles.json (fall back to seed_v2_inventory.js ranges):
  blood_a_pos, blood_a_neg, blood_b_pos, blood_b_neg, blood_o_pos, blood_ab_pos
    -> these ARE covered via blood_units_each_type
  specialist_pediatric_er  -> t1:[0,3], t2:[0,2], t3:[0,1]
  equipment_dialysis       -> t1:[1,6], t2:[0,3], t3:[0,1]
  equipment_mri_trauma_ready -> t1:[0,2], t2:[0,1], t3:[0,0]

Staleness thresholds:
  high volatility   -> 30 min   (blood types, oxygen)
  medium volatility -> 60 min   (icu_bed, ventilator)
  low volatility    -> 240 min  (specialists, heavy equipment)

Usage:
  py scripts/synthetic-data/seed_inventory_from_profiles.py
  DATABASE_URL=postgresql://... py scripts/synthetic-data/seed_inventory_from_profiles.py
"""

import json
import os
import random
import sys
import re

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
HOSPITALS_JSON  = os.path.join(ROOT, 'files', 'crisis_care_hospitals.json')
PROFILES_JSON   = os.path.join(ROOT, 'files', 'inventory_profiles.json')

DATABASE_URL = os.environ.get(
    'DATABASE_URL',
    'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care',
)

RNG_SEED = 42

# ---------------------------------------------------------------------------
# Volatility groups per resource_type_enum  (PRD §5)
# ---------------------------------------------------------------------------

VOLATILITY = {
    'icu_bed':                      'medium',
    'ventilator':                   'medium',
    'oxygen_cylinder':              'high',
    'blood_a_pos':                  'high',
    'blood_a_neg':                  'high',
    'blood_b_pos':                  'high',
    'blood_b_neg':                  'high',
    'blood_o_pos':                  'high',
    'blood_o_neg':                  'high',
    'blood_ab_pos':                 'high',
    'blood_ab_neg':                 'high',
    'specialist_trauma_surgeon':    'low',
    'specialist_cardiologist':      'low',
    'specialist_neurologist':       'low',
    'specialist_pediatric_er':      'low',
    'equipment_dialysis':           'low',
    'equipment_mri_trauma_ready':   'low',
    'equipment_ct_scanner':         'low',
}

STALENESS = {
    'high':   30,
    'medium': 60,
    'low':    240,
}

# ---------------------------------------------------------------------------
# Fallback ranges for resources NOT in inventory_profiles.json
# (from seed_v2_inventory.js ranges, indexed by tier 1/2/3)
# ---------------------------------------------------------------------------

FALLBACK_RANGES = {
    'specialist_pediatric_er':   {1: (0, 3),  2: (0, 2),  3: (0, 1)},
    'equipment_dialysis':        {1: (1, 6),  2: (0, 3),  3: (0, 1)},
    'equipment_mri_trauma_ready':{1: (0, 2),  2: (0, 1),  3: (0, 0)},
}

# ---------------------------------------------------------------------------
# Sampling helpers
# ---------------------------------------------------------------------------

def sample_range(rng, lo, hi):
    """Uniform integer in [lo, hi]."""
    if lo >= hi:
        return lo
    return rng.randint(lo, hi)

def sample_profile_key(rng, key_cfg):
    """
    key_cfg is either:
      [lo, hi]                     -> plain uniform sample
      {"p": prob, "qty": [lo, hi]} -> 0 with prob (1-p), else uniform in [lo, hi]
    """
    if isinstance(key_cfg, list):
        return sample_range(rng, key_cfg[0], key_cfg[1])
    else:
        p   = key_cfg['p']
        qty = key_cfg['qty']
        if rng.random() < p:
            return sample_range(rng, qty[0], qty[1])
        return 0

# ---------------------------------------------------------------------------
# Profile key -> DB resource type mapping
# ---------------------------------------------------------------------------

PROFILE_KEY_TO_DB = {
    'icu_bed':           ['icu_bed'],
    'ventilator':        ['ventilator'],
    'oxygen_cylinder':   ['oxygen_cylinder'],
    'trauma_surgeon':    ['specialist_trauma_surgeon'],
    'ct_scanner':        ['equipment_ct_scanner'],
    'cardiologist':      ['specialist_cardiologist'],
    # cardiac_icu_bed -> icu_bed (already covered; skip to avoid duplicate conflict)
    'neurologist':       ['specialist_neurologist'],
    'blood_units_each_type': [
        'blood_a_pos', 'blood_a_neg', 'blood_b_pos',
        'blood_b_neg', 'blood_o_pos', 'blood_ab_pos',
    ],
    'blood_O_neg':       ['blood_o_neg'],
    'blood_AB_neg':      ['blood_ab_neg'],
}

SKIP_PROFILE_KEYS = {'cardiac_icu_bed'}  # duplicates icu_bed

# ---------------------------------------------------------------------------
# Select profile for a hospital
# ---------------------------------------------------------------------------

def select_profile_name(hospital):
    region_type     = hospital.get('region_type', '')
    suggested_tier  = hospital.get('suggested_tier', 'B')

    if region_type == 'rural_sparse':
        return 'tier_B_rural'
    if suggested_tier == 'A':
        return 'tier_A_urban'
    # B + urban_dense or urban_mid
    return 'tier_B_urban'

# ---------------------------------------------------------------------------
# DB tier (integer) for fallback ranges
# ---------------------------------------------------------------------------

def db_tier(hospital):
    region_type    = hospital.get('region_type', '')
    suggested_tier = hospital.get('suggested_tier', 'B')
    if region_type == 'rural_sparse':
        return 3
    if suggested_tier == 'A':
        return 1
    return 2

# ---------------------------------------------------------------------------
# Generate all (resource_type -> qty) for one hospital
# ---------------------------------------------------------------------------

def generate_inventory(rng, hospital, profiles):
    profile_name = select_profile_name(hospital)
    profile      = profiles[profile_name]
    tier         = db_tier(hospital)

    results = {}  # resource_type_enum -> qty

    # From profile
    for key, key_cfg in profile.items():
        if key in SKIP_PROFILE_KEYS:
            continue
        if key not in PROFILE_KEY_TO_DB:
            continue
        qty = sample_profile_key(rng, key_cfg)
        for db_type in PROFILE_KEY_TO_DB[key]:
            # First writer wins (no key appears twice in PROFILE_KEY_TO_DB)
            if db_type not in results:
                results[db_type] = qty

    # Fallback for resources not covered by profile
    for db_type, tier_ranges in FALLBACK_RANGES.items():
        if db_type not in results:
            lo, hi = tier_ranges[tier]
            results[db_type] = sample_range(rng, lo, hi)

    # Ensure ALL 18 resource types present (qty=0 if still missing)
    for db_type in VOLATILITY:
        if db_type not in results:
            results[db_type] = 0

    return results

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import psycopg2

    # Load input files
    with open(HOSPITALS_JSON, encoding='utf-8') as f:
        hospitals = json.load(f)
    with open(PROFILES_JSON, encoding='utf-8') as f:
        profile_data = json.load(f)

    profiles = profile_data['profiles']
    print(f'[seed-inv] Loaded {len(hospitals)} hospitals, profiles: {list(profiles.keys())}')

    rng = random.Random(RNG_SEED)

    # Generate all inventory rows first (so rng sequence is deterministic
    # regardless of DB round-trip timing)
    inventory_plan = []
    for h in hospitals:
        inv = generate_inventory(rng, h, profiles)
        for resource_type, qty in inv.items():
            volatility  = VOLATILITY[resource_type]
            staleness   = STALENESS[volatility]
            inventory_plan.append((h['seed_key'], resource_type, qty, volatility, staleness))

    print(f'[seed-inv] Generated {len(inventory_plan)} resource rows ({len(hospitals)} hospitals × 18 types)')

    # Connect and upsert
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Build seed_key -> hospital_id lookup
    cur.execute('SELECT id, seed_key FROM hospitals')
    key_to_id = {row[1]: row[0] for row in cur.fetchall()}
    print(f'[seed-inv] Found {len(key_to_id)} hospitals in DB')

    inserted = 0
    updated  = 0
    missing  = []

    for seed_key, resource_type, qty, volatility, staleness in inventory_plan:
        hospital_id = key_to_id.get(seed_key)
        if hospital_id is None:
            missing.append(seed_key)
            continue

        cur.execute("""
            INSERT INTO resources
              (hospital_id, resource_type, quantity_available,
               volatility_group, staleness_threshold_minutes)
            VALUES (%s, %s::resource_type_enum, %s, %s::volatility_group, %s)
            ON CONFLICT (hospital_id, resource_type) DO UPDATE SET
              quantity_available          = EXCLUDED.quantity_available,
              volatility_group            = EXCLUDED.volatility_group,
              staleness_threshold_minutes = EXCLUDED.staleness_threshold_minutes,
              last_updated_at             = now()
            RETURNING (xmax = 0) AS was_insert
        """, (hospital_id, resource_type, qty, volatility, staleness))
        row = cur.fetchone()
        if row and row[0]:
            inserted += 1
        else:
            updated += 1

    conn.commit()
    cur.close()
    conn.close()

    if missing:
        print(f'[seed-inv] WARNING: {len(missing)} seed_keys not found in DB: {missing[:5]}')

    print(f'[seed-inv] Done: inserted={inserted} updated={updated} missing={len(missing)}')
    if missing:
        sys.exit(1)

if __name__ == '__main__':
    main()