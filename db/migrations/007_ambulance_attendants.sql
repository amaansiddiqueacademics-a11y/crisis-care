CREATE TABLE IF NOT EXISTS ambulance_attendants (
  id SERIAL PRIMARY KEY,
  badge_id VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  callsign VARCHAR(50),
  assigned_ambulance_id VARCHAR(50)
);

-- Seed an attendant (password is paramedic123)
INSERT INTO ambulance_attendants (badge_id, password_hash, name, callsign, assigned_ambulance_id) 
VALUES ('PARA-409', '$2b$12$ashv3XcnuBHcPVRebGUeq.sZAsTGoBFBN3Fl8QnrM/rQT8ZBCVqeG', 'Dr. Ananya Roy (Paramedic Lead)', 'Delta-101 (ALS Unit)', 'amb-101') 
ON CONFLICT (badge_id) DO NOTHING;
