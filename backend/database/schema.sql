-- ============================================================
-- CRISIS CARE DATABASE
-- PostgreSQL + PostGIS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,

    full_name VARCHAR(150),

    phone VARCHAR(20) UNIQUE,

    email VARCHAR(255) UNIQUE,

    password_hash TEXT,

    role VARCHAR(30) NOT NULL DEFAULT 'CITIZEN',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_role_check
        CHECK (
            role IN (
                'CITIZEN',
                'ADMIN'
            )
        )
);


-- ============================================================
-- 2. HOSPITALS
-- ============================================================

CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id BIGSERIAL PRIMARY KEY,

    seed_key VARCHAR(100) UNIQUE NOT NULL,

    name VARCHAR(255) NOT NULL,

    city VARCHAR(100),

    address TEXT,

    phone VARCHAR(30),

    latitude DOUBLE PRECISION NOT NULL,

    longitude DOUBLE PRECISION NOT NULL,

    location GEOGRAPHY(Point, 4326) NOT NULL,

    tier VARCHAR(20),

    region_type VARCHAR(50),

    suggested_tier VARCHAR(20),

    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

    google_place_id VARCHAR(255),

    coord_quality VARCHAR(50),

    verify_pin BOOLEAN NOT NULL DEFAULT FALSE,

    source VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT hospitals_status_check
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'MAINTENANCE'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_hospitals_location
ON hospitals
USING GIST(location);


-- ============================================================
-- 3. HOSPITAL ADMINS
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_admins (
    hospital_admin_id BIGSERIAL PRIMARY KEY,

    hospital_id BIGINT NOT NULL,

    username VARCHAR(100) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    full_name VARCHAR(150),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hospital_admin_hospital
        FOREIGN KEY (hospital_id)
        REFERENCES hospitals(hospital_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hospital_admin_hospital
ON hospital_admins(hospital_id);


-- ============================================================
-- 4. RESOURCES
-- ============================================================

CREATE TABLE IF NOT EXISTS resources (
    resource_id SERIAL PRIMARY KEY,

    resource_code VARCHAR(100) UNIQUE NOT NULL,

    resource_name VARCHAR(150) NOT NULL,

    resource_category VARCHAR(100),

    unit VARCHAR(50),

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- 5. HOSPITAL INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_inventory (
    inventory_id BIGSERIAL PRIMARY KEY,

    hospital_id BIGINT NOT NULL,

    resource_id INTEGER NOT NULL,

    quantity INTEGER NOT NULL DEFAULT 0,

    reserved_quantity INTEGER NOT NULL DEFAULT 0,

    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_by BIGINT,

    -- SEEDED_SYNTHETIC until a hospital staff member edits it, then HOSPITAL_REPORTED
    source VARCHAR(30) NOT NULL DEFAULT 'SEEDED_SYNTHETIC',

    CONSTRAINT fk_inventory_hospital
        FOREIGN KEY (hospital_id)
        REFERENCES hospitals(hospital_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inventory_resource
        FOREIGN KEY (resource_id)
        REFERENCES resources(resource_id)
        ON DELETE CASCADE,

    CONSTRAINT inventory_quantity_check
        CHECK (quantity >= 0),

    CONSTRAINT inventory_reserved_check
        CHECK (
            reserved_quantity >= 0
            AND reserved_quantity <= quantity
        ),

    CONSTRAINT unique_hospital_resource
        UNIQUE (hospital_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_hospital
ON hospital_inventory(hospital_id);

CREATE INDEX IF NOT EXISTS idx_inventory_resource
ON hospital_inventory(resource_id);


-- ============================================================
-- 6. AMBULANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS ambulances (
    ambulance_id BIGSERIAL PRIMARY KEY,

    callsign VARCHAR(50) UNIQUE NOT NULL,

    registration_number VARCHAR(50) UNIQUE,

    ambulance_type VARCHAR(50),

    status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',

    latitude DOUBLE PRECISION,

    longitude DOUBLE PRECISION,

    location GEOGRAPHY(Point, 4326),

    current_emergency_id BIGINT,

    last_location_update TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ambulance_status_check
        CHECK (
            status IN (
                'AVAILABLE',
                'DISPATCHED',
                'EN_ROUTE',
                'AT_SCENE',
                'TRANSPORTING',
                'AT_HOSPITAL',
                'OFFLINE',
                'MAINTENANCE'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_ambulance_location
ON ambulances
USING GIST(location);


-- ============================================================
-- 7. AMBULANCE CREW
-- ============================================================

CREATE TABLE IF NOT EXISTS ambulance_crew (
    crew_id BIGSERIAL PRIMARY KEY,

    ambulance_id BIGINT,

    employee_code VARCHAR(100) UNIQUE NOT NULL,

    full_name VARCHAR(150) NOT NULL,

    role VARCHAR(50) NOT NULL,

    username VARCHAR(100) UNIQUE,

    password_hash TEXT,

    phone VARCHAR(20),

    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_crew_ambulance
        FOREIGN KEY (ambulance_id)
        REFERENCES ambulances(ambulance_id)
        ON DELETE SET NULL,

    CONSTRAINT crew_role_check
        CHECK (
            role IN (
                'DRIVER',
                'PARAMEDIC',
                'ATTENDANT'
            )
        )
);


-- ============================================================
-- 8. EMERGENCY REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_requests (
    request_id BIGSERIAL PRIMARY KEY,

    emergency_code VARCHAR(50) UNIQUE NOT NULL,

    reported_by BIGINT,

    latitude DOUBLE PRECISION NOT NULL,

    longitude DOUBLE PRECISION NOT NULL,

    location GEOGRAPHY(Point, 4326) NOT NULL,

    emergency_type VARCHAR(100) NOT NULL,

    patient_count INTEGER NOT NULL DEFAULT 1,

    description TEXT,

    caller_name VARCHAR(150),

    caller_phone VARCHAR(20),

    location_text VARCHAR(300),

    status VARCHAR(50) NOT NULL DEFAULT 'REPORTED',

    ambulance_id BIGINT,

    selected_hospital_id BIGINT,

    closed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_emergency_user
        FOREIGN KEY (reported_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_emergency_ambulance
        FOREIGN KEY (ambulance_id)
        REFERENCES ambulances(ambulance_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_emergency_hospital
        FOREIGN KEY (selected_hospital_id)
        REFERENCES hospitals(hospital_id)
        ON DELETE SET NULL,

    CONSTRAINT emergency_patient_count_check
        CHECK (patient_count > 0),

    CONSTRAINT emergency_status_check
        CHECK (
            status IN (
                'REPORTED',
                'SEARCHING',
                'HOSPITAL_PENDING',
                'HOSPITAL_ACCEPTED',
                'HOSPITAL_DECLINED',
                'AMBULANCE_ASSIGNED',
                'EN_ROUTE',
                'AT_SCENE',
                'TRANSPORTING',
                'ARRIVED',
                'HANDED_OVER',
                'CLOSED',
                'CANCELLED'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_emergency_location
ON emergency_requests
USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_emergency_status
ON emergency_requests(status);

CREATE INDEX IF NOT EXISTS idx_emergency_created
ON emergency_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_emergency_ambulance
ON emergency_requests(ambulance_id);


-- ============================================================
-- 9. EMERGENCY REQUIREMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_requirements (
    requirement_id BIGSERIAL PRIMARY KEY,

    request_id BIGINT NOT NULL,

    resource_id INTEGER NOT NULL,

    required_quantity INTEGER NOT NULL DEFAULT 1,

    priority INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_requirement_request
        FOREIGN KEY (request_id)
        REFERENCES emergency_requests(request_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_requirement_resource
        FOREIGN KEY (resource_id)
        REFERENCES resources(resource_id)
        ON DELETE CASCADE,

    CONSTRAINT requirement_quantity_check
        CHECK (required_quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_requirements_request
ON emergency_requirements(request_id);


-- ============================================================
-- 10. HOSPITAL EMERGENCY RESPONSES
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_emergency_responses (
    response_id BIGSERIAL PRIMARY KEY,

    request_id BIGINT NOT NULL,

    hospital_id BIGINT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    reason TEXT,

    responded_by BIGINT,

    responded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_response_request
        FOREIGN KEY (request_id)
        REFERENCES emergency_requests(request_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_response_hospital
        FOREIGN KEY (hospital_id)
        REFERENCES hospitals(hospital_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_response_admin
        FOREIGN KEY (responded_by)
        REFERENCES hospital_admins(hospital_admin_id)
        ON DELETE SET NULL,

    CONSTRAINT hospital_response_status_check
        CHECK (
            status IN (
                'PENDING',
                'ACCEPTED',
                'DECLINED'
            )
        ),

    CONSTRAINT unique_request_hospital
        UNIQUE (request_id, hospital_id)
);


-- ============================================================
-- 11. PATIENT VITALS
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_vitals (
    vital_id BIGSERIAL PRIMARY KEY,

    request_id BIGINT NOT NULL,

    ambulance_id BIGINT,

    recorded_by BIGINT,

    gcs_score INTEGER,

    systolic_bp INTEGER,

    diastolic_bp INTEGER,

    heart_rate INTEGER,

    spo2 INTEGER,

    respiratory_rate INTEGER,

    temperature NUMERIC(4,1),

    trauma_severity VARCHAR(30),

    consciousness VARCHAR(20),

    breathing VARCHAR(20),

    pulse_status VARCHAR(20),

    severe_bleeding BOOLEAN,

    notes TEXT,

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vitals_request
        FOREIGN KEY (request_id)
        REFERENCES emergency_requests(request_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_vitals_ambulance
        FOREIGN KEY (ambulance_id)
        REFERENCES ambulances(ambulance_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_vitals_crew
        FOREIGN KEY (recorded_by)
        REFERENCES ambulance_crew(crew_id)
        ON DELETE SET NULL,

    CONSTRAINT gcs_check
        CHECK (
            gcs_score IS NULL
            OR (
                gcs_score >= 3
                AND gcs_score <= 15
            )
        ),

    CONSTRAINT spo2_check
        CHECK (
            spo2 IS NULL
            OR (
                spo2 >= 0
                AND spo2 <= 100
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_vitals_request
ON patient_vitals(request_id);


-- ============================================================
-- 12. SURGEONS
-- ============================================================

CREATE TABLE IF NOT EXISTS surgeons (
    surgeon_id BIGSERIAL PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,

    specialization VARCHAR(100),

    license_number VARCHAR(100),

    phone VARCHAR(20),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 13. HOSPITAL SURGEONS
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_surgeons (
    hospital_surgeon_id BIGSERIAL PRIMARY KEY,

    hospital_id BIGINT NOT NULL,

    surgeon_id BIGINT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hospital_surgeon_hospital
        FOREIGN KEY (hospital_id)
        REFERENCES hospitals(hospital_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_hospital_surgeon_surgeon
        FOREIGN KEY (surgeon_id)
        REFERENCES surgeons(surgeon_id)
        ON DELETE CASCADE,

    CONSTRAINT surgeon_status_check
        CHECK (
            status IN (
                'AVAILABLE',
                'IN_SURGERY',
                'OFFLINE',
                'ON_CALL'
            )
        ),

    CONSTRAINT unique_hospital_surgeon
        UNIQUE (hospital_id, surgeon_id)
);


-- ============================================================
-- 14. ROUTES
-- ============================================================

CREATE TABLE IF NOT EXISTS routes (
    route_id BIGSERIAL PRIMARY KEY,

    request_id BIGINT,

    ambulance_id BIGINT,

    origin_latitude DOUBLE PRECISION,

    origin_longitude DOUBLE PRECISION,

    destination_latitude DOUBLE PRECISION,

    destination_longitude DOUBLE PRECISION,

    distance_meters DOUBLE PRECISION,

    duration_seconds INTEGER,

    provider VARCHAR(50),

    geometry JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_route_request
        FOREIGN KEY (request_id)
        REFERENCES emergency_requests(request_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_route_ambulance
        FOREIGN KEY (ambulance_id)
        REFERENCES ambulances(ambulance_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 15. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,

    actor_id BIGINT,

    actor_name VARCHAR(150),

    actor_role VARCHAR(50),

    hospital_id BIGINT,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100),

    entity_id BIGINT,

    old_values JSONB,

    new_values JSONB,

    ip_address INET,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_hospital
        FOREIGN KEY (hospital_id)
        REFERENCES hospitals(hospital_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created
ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_entity
ON audit_logs(entity_type, entity_id);


-- ============================================================
-- 16. UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 17. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_users_timestamp
ON users;

CREATE TRIGGER update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


DROP TRIGGER IF EXISTS update_hospitals_timestamp
ON hospitals;

CREATE TRIGGER update_hospitals_timestamp
BEFORE UPDATE ON hospitals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


DROP TRIGGER IF EXISTS update_hospital_admins_timestamp
ON hospital_admins;

CREATE TRIGGER update_hospital_admins_timestamp
BEFORE UPDATE ON hospital_admins
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


DROP TRIGGER IF EXISTS update_ambulances_timestamp
ON ambulances;

CREATE TRIGGER update_ambulances_timestamp
BEFORE UPDATE ON ambulances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


DROP TRIGGER IF EXISTS update_emergency_timestamp
ON emergency_requests;

CREATE TRIGGER update_emergency_timestamp
BEFORE UPDATE ON emergency_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


DROP TRIGGER IF EXISTS update_routes_timestamp
ON routes;

CREATE TRIGGER update_routes_timestamp
BEFORE UPDATE ON routes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 18. AUDIT LOG IMMUTABILITY
-- audit_logs is append-only: updates and deletes are rejected.
-- ============================================================

CREATE OR REPLACE FUNCTION reject_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update
ON audit_logs;

CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION reject_audit_mutation();


-- ============================================================
-- 19. HOSPITAL ZONE, OWNERSHIP AND EMERGENCY-ROOM STATUS
-- er_status is what the hospital's own desk says right now:
--   ACCEPTING  normal intake
--   LIMITED    can take only some cases (see note)
--   DIVERSION  emergency room full: send ambulances elsewhere
-- ============================================================

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS zone VARCHAR(60);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ownership VARCHAR(20);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS er_status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTING';
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS er_status_note VARCHAR(200);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS er_status_updated_at TIMESTAMPTZ;

DO $$ BEGIN
    ALTER TABLE hospitals ADD CONSTRAINT hospitals_er_status_check
        CHECK (er_status IN ('ACCEPTING', 'LIMITED', 'DIVERSION'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_hospitals_zone ON hospitals(zone);


-- ============================================================
-- 20. HOSPITAL SERVICES (what kind of patient a hospital can treat)
-- Seeded from a profile (SEEDED_PROFILE); hospital staff confirm or
-- switch services off (HOSPITAL_REPORTED), e.g. "cath lab down".
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_services (
    hospital_id BIGINT NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    service_code VARCHAR(30) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(30) NOT NULL DEFAULT 'SEEDED_PROFILE',
    updated_by BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hospital_id, service_code),
    CONSTRAINT hospital_service_code_check CHECK (service_code IN (
        'TRAUMA', 'CATH_LAB', 'STROKE', 'BURNS', 'MATERNITY', 'NICU',
        'PAEDIATRIC', 'DIALYSIS', 'TOXICOLOGY', 'ANTIVENOM'
    ))
);


-- ============================================================
-- 21. WHAT THE REPORTER TOLD US (tap answers, optional photo)
-- ============================================================

ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS problem_kind VARCHAR(20);
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS body_area VARCHAR(30);
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS symptoms TEXT[];
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS pain_level INTEGER;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS photo_data TEXT;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS reporter_relation VARCHAR(20);
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'STANDARD';

DO $$ BEGIN
    ALTER TABLE emergency_requests ADD CONSTRAINT emergency_pain_check
        CHECK (pain_level IS NULL OR pain_level BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 22. PATIENTS
-- One record per emergency, filled from optional tap answers by the
-- reporter (no account needed) and corrected by the crew on scene.
-- Contact details are only shown to the assigned crew and dispatch.
-- ============================================================

CREATE TABLE IF NOT EXISTS patients (
    patient_id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL UNIQUE REFERENCES emergency_requests(request_id) ON DELETE CASCADE,
    full_name VARCHAR(150),
    age_group VARCHAR(20),
    sex VARCHAR(10),
    blood_group VARCHAR(5),
    known_conditions TEXT[] NOT NULL DEFAULT '{}',
    allergies TEXT[] NOT NULL DEFAULT '{}',
    medications VARCHAR(300),
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(20),
    updated_by_role VARCHAR(30) NOT NULL DEFAULT 'REPORTER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_age_group_check CHECK (age_group IS NULL OR age_group IN
        ('INFANT', 'CHILD', 'TEEN', 'ADULT', 'SENIOR')),
    CONSTRAINT patient_sex_check CHECK (sex IS NULL OR sex IN ('FEMALE', 'MALE', 'OTHER')),
    CONSTRAINT patient_blood_check CHECK (blood_group IS NULL OR blood_group IN
        ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'))
);

DROP TRIGGER IF EXISTS update_patients_timestamp ON patients;
CREATE TRIGGER update_patients_timestamp
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 23. CATEGORY-SPECIFIC FINDINGS AND TRIAGE ON EACH ASSESSMENT
-- ============================================================

ALTER TABLE patient_vitals ADD COLUMN IF NOT EXISTS category_findings JSONB;
ALTER TABLE patient_vitals ADD COLUMN IF NOT EXISTS triage_level VARCHAR(10);

ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS zone VARCHAR(60);

-- Whether accepting this request reserved an ICU bed (only patients who need one get one),
-- so closing the case releases exactly the reservation it made.
-- Before this column existed every acceptance reserved a bed, so open ones are backfilled once.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'hospital_emergency_responses' AND column_name = 'icu_reserved') THEN
        ALTER TABLE hospital_emergency_responses ADD COLUMN icu_reserved BOOLEAN NOT NULL DEFAULT FALSE;
        UPDATE hospital_emergency_responses SET icu_reserved = TRUE
        WHERE status = 'ACCEPTED'
          AND request_id IN (SELECT request_id FROM emergency_requests WHERE status NOT IN ('CLOSED', 'CANCELLED'));
    END IF;
END $$;


-- ============================================================
-- END OF CRISIS CARE SCHEMA
-- ============================================================