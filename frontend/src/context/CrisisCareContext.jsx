import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { closeSocket } from '../api/socket';

const CrisisCareContext = createContext();

// ---------------------------------------------------------------------------
// Routing: the URL hash is the source of truth, so links, refresh and Back all work.
// ---------------------------------------------------------------------------
const ROUTES = { '': 'overview', report: 'client', ambulance: 'ambulance', hospital: 'hospital', dispatch: 'admin', help: 'info' };
const PATHS = Object.fromEntries(Object.entries(ROUTES).map(([path, id]) => [id, path]));

const parseHash = () => {
  const [path = '', sub = null] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { section: ROUTES[path] || 'overview', sub };
};

// ---------------------------------------------------------------------------
// Staff sessions: kept per browser tab (sessionStorage), locked after inactivity.
// ---------------------------------------------------------------------------
const ROLES = { ambulance: 'ambulance', hospital: 'hospital', admin: 'admin' };
const IDLE_LIMIT_MS = { hospital: 15 * 60 * 1000, admin: 15 * 60 * 1000, ambulance: 12 * 60 * 60 * 1000 };
const storeKey = (role) => `cc_session_${role}`;
const TRACKING_KEY = 'cc_tracking_code';

const tokenExpiry = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
  } catch {
    return 0;
  }
};

const readSession = (role) => {
  try {
    const s = JSON.parse(sessionStorage.getItem(storeKey(role)));
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
};

export const CrisisCareProvider = ({ children }) => {
  const [route, setRoute] = useState(parseHash);
  const [sessions, setSessions] = useState(() => ({
    ambulance: readSession('ambulance'),
    hospital: readSession('hospital'),
    admin: readSession('admin'),
  }));
  const [trackingCode, setTrackingCodeState] = useState(() => localStorage.getItem(TRACKING_KEY));
  const [toastMessage, setToastMessage] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const toastTimer = useRef(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setActiveSection = useCallback((id, sub) => {
    window.location.hash = `#/${PATHS[id] ?? ''}${sub ? `/${sub}` : ''}`;
  }, []);

  const showToast = useCallback((title, message, type = 'info') => {
    clearTimeout(toastTimer.current);
    setToastMessage({ title, message, type, id: Date.now() });
    toastTimer.current = setTimeout(() => setToastMessage(null), 5000);
  }, []);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // --- sessions -------------------------------------------------------------
  const logout = useCallback((role, reason) => {
    setSessions((prev) => {
      if (prev[role]?.token) closeSocket(prev[role].token);
      return { ...prev, [role]: null };
    });
    sessionStorage.removeItem(storeKey(role));
    if (reason) showToast('Signed out', reason, 'warning');
  }, [showToast]);

  const login = useCallback(async (role, username, password) => {
    const { token, user } = await api(`/auth/${ROLES[role]}/login`, { method: 'POST', body: { username, password } });
    const session = { token, user, expiresAt: tokenExpiry(token), signedInAt: Date.now() };
    sessionStorage.setItem(storeKey(role), JSON.stringify(session));
    lastActivity.current = Date.now();
    setSessions((prev) => ({ ...prev, [role]: session }));
    return session;
  }, []);

  /** API call as a signed-in role; an expired or revoked session signs out cleanly. */
  const authed = useCallback(
    async (role, path, options = {}) => {
      const session = sessions[role];
      if (!session) throw new ApiError('Please sign in again.', 401);
      try {
        return await api(path, { ...options, token: session.token });
      } catch (e) {
        if (e.status === 401) logout(role, 'Your session expired. Please sign in again.');
        throw e;
      }
    },
    [sessions, logout],
  );

  // Lock staff screens after inactivity or token expiry: a shared ER computer must not stay open.
  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(() => {
      Object.entries(sessions).forEach(([role, s]) => {
        if (!s) return;
        if (Date.now() > s.expiresAt) logout(role, 'Your session expired. Please sign in again.');
        else if (Date.now() - lastActivity.current > IDLE_LIMIT_MS[role]) logout(role, 'Signed out after 15 minutes without activity, to protect patient data.');
      });
    }, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(timer);
    };
  }, [sessions, logout]);

  // --- citizen tracking -----------------------------------------------------
  const setTrackingCode = useCallback((code) => {
    if (code) localStorage.setItem(TRACKING_KEY, code);
    else localStorage.removeItem(TRACKING_KEY);
    setTrackingCodeState(code);
  }, []);

  // A finished request must not reopen on the next visit: forget it for next time, keep showing it now.
  const forgetTracking = useCallback(() => localStorage.removeItem(TRACKING_KEY), []);

  return (
    <CrisisCareContext.Provider
      value={{
        activeSection: route.section,
        subRoute: route.sub,
        setActiveSection,
        sessions,
        login,
        logout,
        authed,
        trackingCode,
        setTrackingCode,
        forgetTracking,
        toastMessage,
        showToast,
        isOffline,
      }}
    >
      {children}
    </CrisisCareContext.Provider>
  );
};

export const useCrisisCare = () => {
  const context = useContext(CrisisCareContext);
  if (!context) throw new Error('useCrisisCare must be used within a CrisisCareProvider');
  return context;
};
