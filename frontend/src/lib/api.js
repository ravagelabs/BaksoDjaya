const API_URL = import.meta.env.VITE_API_URL || "";

// fetch ke backend dengan cookie sesi Better Auth. Melempar Error berisi pesan dari server.
export async function api(path, { method = "GET", body } = {}) {
  const options = { method, credentials: "include" };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Permintaan gagal (${res.status})`);
  return json;
}
