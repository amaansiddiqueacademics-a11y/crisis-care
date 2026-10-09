BEGIN;

CREATE TABLE IF NOT EXISTS resource_audit_logs (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    resource_type VARCHAR(100),
    previous_qty INTEGER,
    new_qty INTEGER,
    action VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to create audit log
CREATE OR REPLACE FUNCTION audit_resource_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.quantity_available IS DISTINCT FROM NEW.quantity_available) THEN
        INSERT INTO resource_audit_logs(
            hospital_id, admin_id, resource_type, previous_qty, new_qty, action, created_at
        )
        VALUES (
            NEW.hospital_id, NULL, NEW.resource_type, OLD.quantity_available, NEW.quantity_available, 'Resource updated via system', NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_audit_resource_changes ON resources;
CREATE TRIGGER trigger_audit_resource_changes
AFTER UPDATE ON resources
FOR EACH ROW
EXECUTE FUNCTION audit_resource_changes();

-- Seed some initial logs for demo
INSERT INTO resource_audit_logs (hospital_id, resource_type, previous_qty, new_qty, action, created_at)
SELECT h.id, r.resource_type, r.quantity_available + 2, r.quantity_available, 'Initial adjustment', NOW() - interval '2 hours'
FROM resources r
JOIN hospitals h ON h.id = r.hospital_id
LIMIT 50;

COMMIT;
