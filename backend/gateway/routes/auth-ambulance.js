// Route for ambulance login
router.post('/ambulance-login', async (req, res) => {
  const { badgeId, password } = req.body ?? {};

  if (!badgeId || !password) {
    return res.status(400).json({ error: 'badgeId and password are required' });
  }

  let attendant;
  try {
    const { rows } = await db.query(
      `SELECT id, badge_id, password_hash, name, callsign, assigned_ambulance_id
       FROM ambulance_attendants
       WHERE badge_id = $1
       LIMIT 1`,
      [badgeId]
    );
    attendant = rows[0] ?? null;
  } catch (err) {
    console.error('[auth] DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  let passwordMatch = false;
  try {
    const hashToCompare = attendant?.password_hash ?? DUMMY_HASH;
    passwordMatch = await bcrypt.compare(password, hashToCompare);
  } catch (err) {
    console.error('[auth] bcrypt error:', err.message);
    passwordMatch = false;
  }

  if (!attendant || !passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  let token;
  try {
    token = jwt.sign(
      {
        badge_id: attendant.badge_id,
        role: 'ambulance',
      },
      JWT_SECRET,
      {
        subject: String(attendant.id),
        expiresIn: JWT_EXPIRES_IN,
      }
    );
  } catch (err) {
    console.error('[auth] JWT signing error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.json({
    token,
    badgeId: attendant.badge_id,
    name: attendant.name,
    callsign: attendant.callsign,
    assignedAmbulanceId: attendant.assigned_ambulance_id,
  });
});
