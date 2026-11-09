const BASE = import.meta.env?.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  health: () => request("/api/health"),
  listSessions: () => request("/api/sessions"),
  getSession: (id) => request(`/api/sessions/${id}`),
  createSession: (name) => request("/api/sessions", { method: "POST", body: JSON.stringify({ name }) }),
  stopSession: (id) => request(`/api/sessions/${id}/stop`, { method: "POST" }),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: "DELETE" }),
  analyze: (id) => request(`/api/sessions/${id}/analyze`, { method: "POST" }),
};
