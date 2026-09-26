import "dotenv/config";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";

import pool from "../config/db.js";


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

    if (fs.existsSync(credentialsFile)) {

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
          source
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
          $14
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
          String(hospital.verify_pin ?? ""),
          hospital.source
        ]
      );

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
          DO UPDATE SET
            quantity = EXCLUDED.quantity,
            last_updated = CURRENT_TIMESTAMP
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
          DO UPDATE SET
            quantity = EXCLUDED.quantity,
            last_updated = CURRENT_TIMESTAMP
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


seedDatabase();