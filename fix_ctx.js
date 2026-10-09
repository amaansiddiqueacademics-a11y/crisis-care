const fs = require('fs');
let code = fs.readFileSync('frontend/frontend/src/context/CrisisCareContext.jsx', 'utf8');

// 1. Add state variables
code = code.replace(
  'const [hospitalDecisions, setHospitalDecisions] = useState({});',
  'const [hospitalDecisions, setHospitalDecisions] = useState({});\n  const [liveAttendants, setLiveAttendants] = useState([]);\n  const [attendantsLoading, setAttendantsLoading] = useState(false);\n  const [resourceChanges, setResourceChanges] = useState([]);\n  const [resourceChangesLoading, setResourceChangesLoading] = useState(false);'
);

// 2. Replace loginAmbulance
const newLogin = `const loginAmbulance = useCallback(async (badgeId, password) => {
    try {
      const result = await api.loginAmbulanceApi(badgeId, password);
      const user = {
        badgeId: result.badgeId,
        name: result.name,
        email: result.email,
        callsign: result.callsign,
        assignedAmbulanceId: result.assignedAmbulanceId,
        token: result.token,
      };
      setAmbulanceAuth(user);
      showToast('Attendant Logged In', \`Session active for \${user.name}\`, 'success');
      return true;
    } catch (err) {
      if (backendOnline === false && password && password.length >= 4) {
        const user = {
          badgeId: badgeId || 'PARA-409',
          name: 'Dr. Ananya Roy (Paramedic Lead)',
          email: 'ananya.roy@crisiscare.in',
          callsign: 'Delta-101 (ALS Unit)',
          assignedAmbulanceId: 'amb-101',
        };
        setAmbulanceAuth(user);
        showToast('Demo Mode', 'Logged in as paramedic (backend offline)', 'info');
        return true;
      }
      showToast('Login Failed', err.message, 'warning');
      return false;
    }
  }, [showToast, backendOnline]);`;

const regex = /const loginAmbulance = useCallback\(\(badgeId, password\) => \{[\s\S]*?showToast\('Login Failed', 'Password must be at least 4 characters\.', 'warning'\);\s*return false;\s*\}, \[showToast\]\);/;
code = code.replace(regex, newLogin);


// 3. Insert fetch functions
const fetches = `  // ── Admin: fetch live resource changes from DB ────────────────────────────
  const fetchAdminResourceChanges = useCallback(async (filters = {}) => {
    setResourceChangesLoading(true);
    try {
      const data = await api.fetchResourceChanges(filters);
      setResourceChanges(data.changes || []);
    } catch (err) {
      console.warn('[Admin] fetchResourceChanges failed:', err.message);
    } finally {
      setResourceChangesLoading(false);
    }
  }, []);

  // ── Admin: fetch live ambulance attendants ────────────────────────────────
  const fetchLiveAttendants = useCallback(async () => {
    setAttendantsLoading(true);
    try {
      const data = await api.fetchAttendants();
      setLiveAttendants(data.attendants || []);
    } catch (err) {
      console.warn('[Admin] fetchAttendants failed:', err.message);
    } finally {
      setAttendantsLoading(false);
    }
  }, []);

  // ── Citizen Emergency Report`;
code = code.replace('  // ── Citizen Emergency Report', fetches);

// 4. Expose in provider
const expose = `      submitAttendantAssessment,

      // Admin extras
      liveAttendants, attendantsLoading,
      resourceChanges, resourceChangesLoading,
      fetchAdminResourceChanges, fetchLiveAttendants,`;
code = code.replace('      submitAttendantAssessment,', expose);

fs.writeFileSync('frontend/frontend/src/context/CrisisCareContext.jsx', code);
