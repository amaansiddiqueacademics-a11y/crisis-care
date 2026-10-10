import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";

import pool from "../config/db.js";
import { config } from "../config/env.js";


/*
|--------------------------------------------------------------------------
| File paths
|--------------------------------------------------------------------------
*/

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(
  __dirname,
  "../../data"
);

const hospitalsFile = path.join(
  DATA_DIR,
  "crisis_care_hospitals.json"
);

const inventoryFile = path.join(
  DATA_DIR,
  "inventory_profiles.json"
);

const credentialsFile = path.join(
  DATA_DIR,
  "hospital_admin_credentials.csv"
);


/*
|--------------------------------------------------------------------------
| Deterministic random generator
|--------------------------------------------------------------------------
|
| Inventory profile specifies RNG seed = 42.
| We use a small seeded generator so the same
| data is generated every time.
|
*/

function createSeededRandom(seed) {
  let value = seed;

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;

    return value / 4294967296;
  };
}

const random = createSeededRandom(42);


/*
|--------------------------------------------------------------------------
| Random integer
|--------------------------------------------------------------------------
*/

function randomInt(min, max) {
  return Math.floor(
    random() * (max - min + 1)
  ) + min;
}


/*
|--------------------------------------------------------------------------
| Generate quantity
|--------------------------------------------------------------------------
*/

function generateQuantity(rule) {

  if (Array.isArray(rule)) {
    return randomInt(
      rule[0],
      rule[1]
    );
  }

  if (
    rule &&
    typeof rule === "object" &&
    "p" in rule
  ) {

    const available = random() < rule.p;

    if (!available) {
      return 0;
    }

    return randomInt(
      rule.qty[0],
      rule.qty[1]
    );
  }

  return 0;
}


/*
|--------------------------------------------------------------------------
| Determine inventory profile
|--------------------------------------------------------------------------
*/

function getProfileName(hospital) {

  if (hospital.suggested_tier === "A") {
    return "tier_A_urban";
  }

  if (
    hospital.suggested_tier === "B" &&
    (
      hospital.region_type === "urban_dense" ||
      hospital.region_type === "urban_mid"
    )
  ) {
    return "tier_B_urban";
  }

  if (
    hospital.region_type === "rural_sparse"
  ) {
    return "tier_B_rural";
  }

  // Safe fallback
  return "tier_B_urban";
}


/*
|--------------------------------------------------------------------------
| Resource definitions
|--------------------------------------------------------------------------
*/

const resources = [
  {
    code: "ICU_BED",
    name: "ICU Bed",
    category: "BED",
    unit: "beds"
  },
  {
    code: "VENTILATOR",
    name: "Ventilator",
    category: "EQUIPMENT",
    unit: "units"
  },
  {
    code: "OXYGEN_CYLINDER",
    name: "Oxygen Cylinder",
    category: "OXYGEN",
    unit: "cylinders"
  },
  {
    code: "TRAUMA_SURGEON",
    name: "Trauma Surgeon",
    category: "STAFF",
    unit: "doctors"
  },
  {
    code: "CT_SCANNER",
    name: "CT Scanner",
    category: "EQUIPMENT",
    unit: "units"
  },
  {
    code: "CARDIOLOGIST",
    name: "Cardiologist",
    category: "STAFF",
    unit: "doctors"
  },
  {
    code: "CARDIAC_ICU_BED",
    name: "Cardiac ICU Bed",
    category: "BED",
    unit: "beds"
  },
  {
    code: "NEUROLOGIST",
    name: "Neurologist",
    category: "STAFF",
    unit: "doctors"
  },

  // Blood groups
  {
    code: "BLOOD_A_POS",
    name: "Blood A+",
    category: "BLOOD",
    unit: "units"
  },
  {
    code: "BLOOD_A_NEG",
    name: "Blood A-",
    category: "BLOOD",
    unit: "units"
  },
  {
    code: "BLOOD_B_POS",
    name: "Blood B+",
    category: "BLOOD",
    unit: "units"
  },
  {
    code: "BLOOD_B_NEG",
    name: "Blood B-",
    category: "BLOOD",
    unit: "units"
  },
  {
    code: "BLOOD_AB_POS",
    name: "Blood AB+",
    category: "BLOOD",
    unit: "units"
  },
  {
    code: "BLOOD_AB_NEG",
    name: "Blood AB-",
    category: "BLOOD",
    unit: "units"
  },
  {
    code: "BLOOD_O_POS",
    name: "Blood O+",
    category: "BLOOD",
    unit: "units"
  },
  {
    code: "BLOOD_O_NEG",
    name: "Blood O-",
    category: "BLOOD",
    unit: "units"
  }
];


/*
|--------------------------------------------------------------------------
| Main seed function
|--------------------------------------------------------------------------
*/

async function seedDatabase() {

  const client = await pool.connect();

  try {

    console.log("");
    console.log("======================================");
    console.log("       CRISIS CARE DATABASE SEED");
    console.log("======================================");
    console.log("");


    /*
    |--------------------------------------------------------------------------
    | Read files
    |--------------------------------------------------------------------------
    */

    console.log("Reading hospital data...");

    const hospitals = JSON.parse(
      fs.readFileSync(
        hospitalsFile,
        "utf-8"
      )
    );

    console.log(
      `Found ${hospitals.length} hospitals`
    );


    console.log("Reading inventory profiles...");

    const inventoryConfig = JSON.parse(
      fs.readFileSync(
        inventoryFile,
        "utf-8"
      )
    );


    /*
    |--------------------------------------------------------------------------
    | Read hospital credentials
    |--------------------------------------------------------------------------
    */

    let credentials = [];

    if (
      config.isProduction &&
      process.env.SEED_ALLOW_DEMO_CREDENTIALS !== "true"
    ) {
      console.log(
        "Production: skipping demo hospital credentials CSV (set SEED_ALLOW_DEMO_CREDENTIALS=true to override)."
      );
    } else if (fs.existsSync(credentialsFile)) {

      const csvContent = fs.readFileSync(
        credentialsFile,
        "utf-8"
      );

      credentials = parse(
        csvContent,
        {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }
      );

      console.log(
        `Found ${credentials.length} hospital credentials`
      );

    } else {

      console.log(
        "Hospital credentials CSV not found."
      );

    }


    /*
    |--------------------------------------------------------------------------
    | Begin transaction
    |--------------------------------------------------------------------------
    */

    await client.query("BEGIN");


    /*
    |--------------------------------------------------------------------------
    | Insert resources
    |--------------------------------------------------------------------------
    */

    console.log("");
    console.log("Seeding resources...");

    for (const resource of resources) {

      await client.query(
        `
        INSERT INTO resources
        (
          resource_code,
          resource_name,
          resource_category,
          unit
        )
        VALUES ($1, $2, $3, $4)

        ON CONFLICT (resource_code)
        DO UPDATE SET
          resource_name = EXCLUDED.resource_name,
          resource_category = EXCLUDED.resource_category,
          unit = EXCLUDED.unit
        `,
        [
          resource.code,
          resource.name,
          resource.category,
          resource.unit
        ]
      );
    }

    console.log(
      `${resources.length} resources ready`
    );


    /*
    |--------------------------------------------------------------------------
    | Insert hospitals
    |--------------------------------------------------------------------------
    */

    console.log("");
    console.log("Seeding hospitals...");

    let hospitalCount = 0;

    for (const hospital of hospitals) {

      await client.query(
        `
        INSERT INTO hospitals
        (
          seed_key,
          name,
          city,
          address,
          phone,
          latitude,
          longitude,
          location,
          tier,
          region_type,
          suggested_tier,
          status,
          google_place_id,
          coord_quality,
          verify_pin,
          source,
          zone,
          ownership
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          ST_SetSRID(
            ST_MakePoint($7, $6),
            4326
          )::geography,
          $8,
          $9,
          $10,
          'ACTIVE',
          $11,
          $12,
          $13,
          $14,
          $15,
          $16
        )

        ON CONFLICT (seed_key)
        DO UPDATE SET
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          location = EXCLUDED.location,
          tier = EXCLUDED.tier,
          region_type = EXCLUDED.region_type,
          suggested_tier = EXCLUDED.suggested_tier,
          google_place_id = EXCLUDED.google_place_id,
          coord_quality = EXCLUDED.coord_quality,
          verify_pin = EXCLUDED.verify_pin,
          source = EXCLUDED.source,
          zone = EXCLUDED.zone,
          ownership = EXCLUDED.ownership,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          hospital.seed_key,
          hospital.name,
          hospital.city,
          hospital.address,
          hospital.phone,
          hospital.lat,
          hospital.lng,
          hospital.suggested_tier,
          hospital.region_type,
          hospital.suggested_tier,
          hospital.google_place_id,
          hospital.coord_quality,
          Boolean(hospital.verify_pin),
          hospital.source,
          hospital.zone || hospital.city,
          hospital.ownership || null
        ]
      );

      // Service profile: never overwrites what a hospital's staff have set.
      for (const service of hospital.services || []) {
        await client.query(
          `INSERT INTO hospital_services (hospital_id, service_code)
           SELECT hospital_id, $2 FROM hospitals WHERE seed_key = $1
           ON CONFLICT (hospital_id, service_code) DO NOTHING`,
          [hospital.seed_key, service]
        );
      }

      hospitalCount++;
    }

    console.log(
      `${hospitalCount} hospitals inserted/updated`
    );


    /*
    |--------------------------------------------------------------------------
    | Seed hospital inventory
    |--------------------------------------------------------------------------
    */

    console.log("");
    console.log("Generating hospital inventory...");

    let inventoryCount = 0;

    const hospitalResult = await client.query(
      `
      SELECT
        hospital_id,
        seed_key,
        suggested_tier,
        region_type
      FROM hospitals
      ORDER BY hospital_id
      `
    );


    for (const hospital of hospitalResult.rows) {

      const profileName =
        getProfileName(hospital);

      const profile =
        inventoryConfig.profiles[profileName];

      if (!profile) {
        throw new Error(
          `No inventory profile found for ${profileName}`
        );
      }


      /*
      |--------------------------------------------------------------------------
      | ICU bed
      |--------------------------------------------------------------------------
      */

      const inventoryRules = [
        {
          key: "icu_bed",
          resourceCode: "ICU_BED"
        },
        {
          key: "ventilator",
          resourceCode: "VENTILATOR"
        },
        {
          key: "oxygen_cylinder",
          resourceCode: "OXYGEN_CYLINDER"
        },
        {
          key: "trauma_surgeon",
          resourceCode: "TRAUMA_SURGEON"
        },
        {
          key: "ct_scanner",
          resourceCode: "CT_SCANNER"
        },
        {
          key: "cardiologist",
          resourceCode: "CARDIOLOGIST"
        },
        {
          key: "cardiac_icu_bed",
          resourceCode: "CARDIAC_ICU_BED"
        },
        {
          key: "neurologist",
          resourceCode: "NEUROLOGIST"
        }
      ];


      for (const rule of inventoryRules) {

        const quantity =
          generateQuantity(
            profile[rule.key]
          );

        const resourceResult =
          await client.query(
            `
            SELECT resource_id
            FROM resources
            WHERE resource_code = $1
            `,
            [rule.resourceCode]
          );

        const resourceId =
          resourceResult.rows[0].resource_id;


        await client.query(
          `
          INSERT INTO hospital_inventory
          (
            hospital_id,
            resource_id,
            quantity,
            reserved_quantity
          )
          VALUES ($1, $2, $3, 0)

          ON CONFLICT
          (
            hospital_id,
            resource_id
          )
          DO NOTHING
          `,
          [
            hospital.hospital_id,
            resourceId,
            quantity
          ]
        );

        inventoryCount++;
      }


      /*
      |--------------------------------------------------------------------------
      | Blood groups
      |--------------------------------------------------------------------------
      */

      const bloodGroups = [
        {
          code: "BLOOD_A_POS",
          specialRule: null
        },
        {
          code: "BLOOD_A_NEG",
          specialRule: null
        },
        {
          code: "BLOOD_B_POS",
          specialRule: null
        },
        {
          code: "BLOOD_B_NEG",
          specialRule: null
        },
        {
          code: "BLOOD_AB_POS",
          specialRule: null
        },
        {
          code: "BLOOD_AB_NEG",
          specialRule: "blood_AB_neg"
        },
        {
          code: "BLOOD_O_POS",
          specialRule: null
        },
        {
          code: "BLOOD_O_NEG",
          specialRule: "blood_O_neg"
        }
      ];


      for (const blood of bloodGroups) {

        const rule = blood.specialRule
          ? profile[blood.specialRule]
          : profile.blood_units_each_type;

        const quantity =
          generateQuantity(rule);

        const resourceResult =
          await client.query(
            `
            SELECT resource_id
            FROM resources
            WHERE resource_code = $1
            `,
            [blood.code]
          );

        const resourceId =
          resourceResult.rows[0].resource_id;


        await client.query(
          `
          INSERT INTO hospital_inventory
          (
            hospital_id,
            resource_id,
            quantity,
            reserved_quantity
          )
          VALUES ($1, $2, $3, 0)

          ON CONFLICT
          (
            hospital_id,
            resource_id
          )
          DO NOTHING
          `,
          [
            hospital.hospital_id,
            resourceId,
            quantity
          ]
        );

        inventoryCount++;
      }
    }


    console.log(
      `${inventoryCount} inventory records generated`
    );


    /*
    |--------------------------------------------------------------------------
    | Hospital administrator accounts
    |--------------------------------------------------------------------------
    */

    console.log("");
    console.log("Creating hospital administrator accounts...");


    for (const credential of credentials) {

      const hospitalResult =
        await client.query(
          `
          SELECT hospital_id
          FROM hospitals
          WHERE seed_key = $1
          `,
          [credential.seed_key]
        );


      if (hospitalResult.rows.length === 0) {

        console.log(
          `Hospital not found for ${credential.seed_key}`
        );

        continue;
      }


      const hospitalId =
        hospitalResult.rows[0].hospital_id;


      /*
      |--------------------------------------------------------------------------
      | NEVER store plaintext passwords
      |--------------------------------------------------------------------------
      */

      const passwordHash =
        await bcrypt.hash(
          credential.password_demo_only,
          12
        );


      await client.query(
        `
        INSERT INTO hospital_admins
        (
          hospital_id,
          username,
          password_hash,
          full_name
        )
        VALUES ($1, $2, $3, $4)

        ON CONFLICT (username)
        DO UPDATE SET
          hospital_id = EXCLUDED.hospital_id,
          password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          hospitalId,
          credential.username,
          passwordHash,
          credential.hospital_name
        ]
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Administrator, ambulances and crews
    |--------------------------------------------------------------------------
    */

    await seedAdmin(client);
    const ambulanceCount = await seedAmbulances(client);

    /*
    |--------------------------------------------------------------------------
    | Commit
    |--------------------------------------------------------------------------
    */

    await client.query("COMMIT");


    console.log("");
    console.log("======================================");
    console.log("       DATABASE SEED COMPLETE");
    console.log("======================================");
    console.log("");
    console.log(`Hospitals: ${hospitalCount}`);
    console.log(`Ambulances: ${ambulanceCount}`);
    console.log(`Inventory rows: ${inventoryCount}`);
    console.log(
      `Hospital accounts: ${credentials.length}`
    );
    console.log("");


  } catch (error) {

    await client.query("ROLLBACK");

    console.error("");
    console.error("DATABASE SEED FAILED");
    console.error("--------------------------------------");
    console.error(error);
    console.error("--------------------------------------");

    process.exitCode = 1;

  } finally {

    client.release();

    await pool.end();
  }
}


/*
|--------------------------------------------------------------------------
| System administrator (credentials come from the environment)
|--------------------------------------------------------------------------
*/

async function seedAdmin(client) {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no admin account created."
    );
    return;
  }

  if (password.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
  }

  const hash = await bcrypt.hash(password, 12);

  // Only the password hash and active flag are refreshed for an existing admin.
  await client.query(
    `
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($1, LOWER($2), $3, 'ADMIN')
    ON CONFLICT (email)
    DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN', is_active = TRUE
    `,
    [process.env.SEED_ADMIN_NAME || "System Administrator", email, hash]
  );

  console.log(`Admin account ready: ${email.toLowerCase()}`);
}


/*
|--------------------------------------------------------------------------
| Ambulances + crews
|--------------------------------------------------------------------------
|
| Fleet data is NOT part of the hospital dataset, so these are development
| fixtures: each unit is stationed at a real seeded hospital's coordinates.
| Crew login passwords come from SEED_CREW_PASSWORD.
|
*/

// One or two units per zone so every part of the region has cover.
const AMBULANCE_FIXTURES = [
  { callsign: "MUM-ALS-01", station: "kem_mumbai", crew: "Asha Kulkarni" },
  { callsign: "MUM-ALS-02", station: "sion_mumbai", crew: "Rohan Deshmukh" },
  { callsign: "MUM-BLS-03", station: "jj_mumbai", crew: "Farah Sheikh" },
  { callsign: "MUM-BLS-04", station: "nair_mumbai", crew: "Vikram Patil" },
  { callsign: "WST-ALS-05", station: "cooper_mumbai", crew: "Neha Joshi" },
  { callsign: "WST-BLS-06", station: "shatabdi_kandivali", crew: "Imran Khan" },
  { callsign: "CEN-ALS-07", station: "rajawadi_mumbai", crew: "Sunita Pawar" },
  { callsign: "THN-ALS-08", station: "csmh_kalwa_thane", crew: "Ganesh More" },
  { callsign: "NVM-ALS-09", station: "nmmc_vashi", crew: "Priya Nair" },
  { callsign: "NVM-BLS-10", station: "mgm_kamothe", crew: "Sachin Patil" },
  { callsign: "PAL-BLS-11", station: "rh_palghar", crew: "Kiran Vartha" },
  { callsign: "PAL-BLS-12", station: "sdh_dahanu", crew: "Mahesh Dhodi" },
  { callsign: "VSI-ALS-13", station: "dmpetit_vasai", crew: "Joseph D'Souza" }
];

async function seedAmbulances(client) {
  const password = process.env.SEED_CREW_PASSWORD;

  if (!password) {
    console.log("SEED_CREW_PASSWORD not set: no ambulances/crews created.");
    return 0;
  }

  if (password.length < 10) {
    throw new Error("SEED_CREW_PASSWORD must be at least 10 characters.");
  }

  const hash = await bcrypt.hash(password, 12);
  let count = 0;

  for (const unit of AMBULANCE_FIXTURES) {
    const station = await client.query(
      "SELECT latitude, longitude, zone FROM hospitals WHERE seed_key = $1",
      [unit.station]
    );

    if (station.rows.length === 0) {
      console.log(`Station hospital ${unit.station} not found; skipping ${unit.callsign}`);
      continue;
    }

    const { latitude, longitude, zone } = station.rows[0];

    // Existing positions/status are kept so re-seeding never moves a live unit.
    const ambulance = await client.query(
      `
      INSERT INTO ambulances
        (callsign, registration_number, ambulance_type, latitude, longitude, location, zone)
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6)
      ON CONFLICT (callsign) DO UPDATE SET zone = EXCLUDED.zone
      RETURNING ambulance_id
      `,
      [
        unit.callsign,
        `DEV-${unit.callsign}`,
        unit.callsign.includes("ALS") ? "ALS" : "BLS",
        latitude,
        longitude,
        zone
      ]
    );

    const username = unit.callsign.toLowerCase();

    await client.query(
      `
      INSERT INTO ambulance_crew
        (ambulance_id, employee_code, full_name, role, username, password_hash)
      VALUES ($1, $2, $3, 'PARAMEDIC', $4, $5)
      ON CONFLICT (employee_code)
      DO UPDATE SET password_hash = EXCLUDED.password_hash, ambulance_id = EXCLUDED.ambulance_id
      `,
      [ambulance.rows[0].ambulance_id, `EMP-${unit.callsign}`, unit.crew, username, hash]
    );

    count++;
  }

  return count;
}


seedDatabase();