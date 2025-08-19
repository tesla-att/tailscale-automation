const BASE = import.meta.env.VITE_API || "http://localhost:8000";

export async function api<T=any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers||{}) },
    ...init
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
