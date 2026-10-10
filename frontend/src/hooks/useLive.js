import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../api/socket';

/**
 * Load data, then reload it whenever one of `events` arrives on the socket, plus a slow
 * poll as a fallback for flaky mobile connections.
 */
export function useLive(load, { token = null, events = [], pollMs = 20000, enabled = true, track = null, key = '' } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
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
