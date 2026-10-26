import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../api/socket';

/**
 * Load data, then reload it whenever one of `events` arrives on the socket, plus a slow
 * poll as a fallback for flaky mobile connections.
 */
export function useLive(load, { token = null, events = [], pollMs = 20000, enabled = true, track = null, key = '' } = {}) {
  const [data, setDataState] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  // A socket-triggered reload and a poll can be in flight together. Whichever STARTED last wins, so
  // a slow older response can never overwrite newer coordinates or a newer status.
  const startedRef = useRef(0);
  const appliedRef = useRef(0);

  /** Replace the data with a result that is newer than anything requested so far (e.g. an action's response). */
  const setData = useCallback((next) => {
    appliedRef.current = ++startedRef.current;
    setDataState(next);
  }, []);

  const refresh = useCallback(async () => {
    const ticket = ++startedRef.current;
    try {
      const result = await loadRef.current();
      if (ticket < appliedRef.current) return;
      appliedRef.current = ticket;
      setDataState(result);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    setLoading(true);
    refresh();

    const socket = getSocket(token);
    const onEvent = () => refresh();
    const onConnect = () => {
      if (track) socket.emit('emergency:track', track);
      refresh();
    };

    events.forEach((ev) => socket.on(ev, onEvent));
    socket.on('connect', onConnect);
    if (track && socket.connected) socket.emit('emergency:track', track);
    const timer = setInterval(refresh, pollMs);

    return () => {
      events.forEach((ev) => socket.off(ev, onEvent));
      socket.off('connect', onConnect);
      clearInterval(timer);
      if (track) socket.emit('emergency:untrack', track);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, track, key, pollMs, refresh]);

  return { data, setData, error, loading, refresh, updatedAt };
}
