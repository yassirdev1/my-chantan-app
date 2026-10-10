import { readFile } from "node:fs/promises"

function loadEnvFile(source) {
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[match[1]] = value
  }
}

try { loadEnvFile(await readFile(new URL("../.env", import.meta.url), "utf8")) }
catch (error) { if (error?.code !== "ENOENT") throw error }

const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME?.trim() || "BedFlow Administrator"
if (!baseUrl || !serviceKey || !email || !password) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, and ADMIN_PASSWORD in .env first.")
  process.exit(1)
}
if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  console.error("ADMIN_EMAIL must be valid; ADMIN_PASSWORD must be 12+ characters with uppercase, lowercase, a number, and a symbol.")
  process.exit(1)
}

const base = baseUrl.replace(/\/$/, "")
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : null
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Supabase request failed (${response.status}).`)
  return data
}

let existing = null
for (let page = 1; !existing; page += 1) {
  const result = await request(`/auth/v1/admin/users?page=${page}&per_page=1000`)
  existing = result.users?.find((item) => item.email?.toLowerCase() === email) ?? null
  if (existing || (result.users?.length ?? 0) < 1000) break
}
const account = existing
  ? await request(`/auth/v1/admin/users/${existing.id}`, { method: "PUT", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { ...existing.user_metadata, display_name: name }, app_metadata: { ...existing.app_metadata, role: "ADMIN", department_id: null, password_change_required: false }, ban_duration: "none" }) })
  : await request("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: name }, app_metadata: { role: "ADMIN", department_id: null, password_change_required: false } }) })
const target = account.user ?? account
if (!target?.id) throw new Error("The administrator account could not be created or updated.")
await request("/rest/v1/profiles?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: target.id, email, full_name: name, role: "ADMIN", department_id: null, is_active: true }) })
await request("/rest/v1/account_audit_logs", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ actor_id: target.id, target_id: target.id, action: existing ? "admin.recovered" : "admin.created", details: { email } }) })
console.log(`BedFlow administrator ${existing ? "updated" : "created"}: ${email}`)