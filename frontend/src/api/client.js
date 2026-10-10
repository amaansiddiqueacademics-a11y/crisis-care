// Thin fetch wrapper for the Crisis Care REST API (`{ success, message, data }` envelopes).

const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, token, raw = false } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach Crisis Care right now. Call 108 or 112 directly.', 0);
  }

  if (raw && res.ok) return res;

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.success === false) {
    const details = json.errors?.map((e) => e.msg).filter(Boolean);
    const message = json.message || `Request failed (${res.status})`;
    throw new ApiError(details?.length ? `${message}: ${[...new Set(details)].join(', ')}` : message, res.status);
  }

  return json.data;
}
