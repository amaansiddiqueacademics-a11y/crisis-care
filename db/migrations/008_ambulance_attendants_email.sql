-- Migration 008: Add email column to ambulance_attendants
-- Adds contact email for attendants and seeds a demo attendant (Ravi Kumar)

ALTER TABLE ambulance_attendants ADD COLUMN IF NOT EXISTS email VARCHAR(255);

UPDATE ambulance_attendants SET email = 'ananya.roy@crisiscare.in' WHERE badge_id = 'PARA-409';

INSERT INTO ambulance_attendants (badge_id, password_hash, name, callsign, assigned_ambulance_id, email)
VALUES ('PARA-101', '$2b$12$ashv3XcnuBHcPVRebGUeq.sZAsTGoBFBN3Fl8QnrM/rQT8ZBCVqeG', 'Ravi Kumar (EMT)', 'Alpha-205 (BLS Unit)', 'amb-205', 'ravi.kumar@crisiscare.in')
ON CONFLICT (badge_id) DO NOTHING;
