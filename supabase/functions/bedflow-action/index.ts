// chantan:role=admin,ADMIN,DOCTOR,NURSE,CLEANING_STAFF
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const cors = (origin: string | null) => ({ "Access-Control-Allow-Origin": origin || "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" })
const json = (body: Record<string, unknown>, status = 200, origin: string | null = null) => new Response(JSON.stringify(body), { status, headers: cors(origin) })
const roles = new Set(["ADMIN", "DOCTOR", "NURSE", "CLEANING_STAFF"])
const statuses = new Set(["AVAILABLE", "OCCUPIED", "TO_CLEAN", "CLEANING", "OUT_OF_SERVICE", "RESERVED"])
const roomTypes = new Set(["SINGLE", "DOUBLE", "ICU", "ISOLATION"])
const text = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : ""
const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value)
const strongPassword = (value: string) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)
const temporaryPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return `Bf!${Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("")}7`
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) })
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin)
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
    if (!token) return json({ error: "Please sign in to continue." }, 401, origin)
    const url = Deno.env.get("SUPABASE_URL")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) return json({ error: "Your session could not be verified. Please sign in again." }, 401, origin)
    const role = String(user.app_metadata?.role ?? "").toUpperCase()
    if (!roles.has(role)) return json({ error: "This account does not have a BedFlow staff role." }, 403, origin)
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400, origin)
    const action = text(body.action, 50)
    const audit = async (targetId: string, event: string, details: Record<string, unknown>) => {
      const { error } = await db.from("account_audit_logs").insert({ actor_id: user.id, target_id: targetId, action: event, details })
      if (error) throw error
    }

    if (action === "profile-update") {
      const name = text(body.name, 100)
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""
      if (name.length < 2) return json({ error: "Enter a name with at least 2 characters." }, 400, origin)
      if (!currentPassword) return json({ error: "Enter your current password to confirm this change." }, 400, origin)
      if (newPassword && !strongPassword(newPassword)) return json({ error: "Use a 12+ character password with uppercase, lowercase, a number, and a symbol." }, 400, origin)
      if (user.app_metadata?.password_change_required && !newPassword) return json({ error: "Choose a new password to finish setting up your account." }, 400, origin)
      const credentials = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data: verified, error: verifyError } = await credentials.auth.signInWithPassword({ email: user.email ?? "", password: currentPassword })
      if (verifyError || verified.user?.id !== user.id) return json({ error: "Your current password is incorrect." }, 401, origin)
      const updates: Record<string, unknown> = { user_metadata: { ...user.user_metadata, display_name: name } }
      if (newPassword) {
        updates.password = newPassword
        updates.app_metadata = { ...user.app_metadata, password_change_required: false }
      }
      const { error: updateError } = await db.auth.admin.updateUserById(user.id, updates)
      if (updateError) throw updateError
      const { error: profileError } = await db.from("profiles").upsert({ id: user.id, email: user.email, full_name: name, role, department_id: user.app_metadata?.department_id ?? null, is_active: true }, { onConflict: "id" })
      if (profileError) throw profileError
      await audit(user.id, newPassword ? "profile.updated_and_password_changed" : "profile.updated", { nameChanged: name !== String(user.user_metadata?.display_name ?? ""), passwordChanged: Boolean(newPassword) })
      return json({ ok: true }, 200, origin)
    }

    if (action === "users-list") {
      if (role !== "ADMIN") return json({ error: "Administrator access required." }, 403, origin)
      const [{ data, error }, { data: profiles, error: profileError }] = await Promise.all([db.auth.admin.listUsers({ page: 1, perPage: 200 }), db.from("profiles").select("id,is_active")])
      if (error) throw error
      if (profileError) throw profileError
      const activeById = new Map((profiles ?? []).map((item) => [item.id, item.is_active !== false]))
      return json({ users: data.users.map((item) => ({ id: item.id, email: item.email, name: item.user_metadata?.display_name ?? "", role: String(item.app_metadata?.role ?? "NURSE").toUpperCase(), departmentId: item.app_metadata?.department_id ?? "", createdAt: item.created_at, active: activeById.get(item.id) !== false && (!item.banned_until || new Date(item.banned_until).getTime() <= Date.now()), passwordChangeRequired: Boolean(item.app_metadata?.password_change_required) })) }, 200, origin)
    }

    if (action === "account-audit-list") {
      if (role !== "ADMIN") return json({ error: "Administrator access required." }, 403, origin)
      const { data, error } = await db.from("account_audit_logs").select("id,actor_id,target_id,action,details,created_at").order("created_at", { ascending: false }).limit(100)
      if (error) throw error
      return json({ logs: data ?? [] }, 200, origin)
    }

    if (action.startsWith("user-")) {
      if (role !== "ADMIN") return json({ error: "Administrator access required." }, 403, origin)
      const id = text(body.id, 50)
      if (action === "user-create") {
        const email = text(body.email, 160).toLowerCase(), name = text(body.name, 100), newRole = text(body.role, 30).toUpperCase(), departmentId = text(body.departmentId, 50) || null
        if (!validEmail(email) || name.length < 2 || !roles.has(newRole)) return json({ error: "Enter a valid email, a name, and a staff role." }, 400, origin)
        if (departmentId) { const { data: dept, error } = await db.from("departments").select("id").eq("id", departmentId).maybeSingle(); if (error || !dept) return json({ error: "Select a valid department." }, 400, origin) }
        const password = temporaryPassword()
        const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name }, app_metadata: { role: newRole, department_id: departmentId, password_change_required: true } })
        if (error) throw error
        const { error: profileError } = await db.from("profiles").upsert({ id: data.user.id, email, full_name: name, role: newRole, department_id: departmentId, is_active: true }, { onConflict: "id" })
        if (profileError) throw profileError
        await audit(data.user.id, "user.created", { email, role: newRole, departmentId })
        return json({ ok: true, userId: data.user.id, temporaryPassword: password }, 200, origin)
      }
      if (!id) return json({ error: "User ID is required." }, 400, origin)
      if (action === "user-deactivate" || action === "user-reactivate") {
        if (id === user.id && action === "user-deactivate") return json({ error: "You cannot deactivate your own administrator account." }, 400, origin)
        const active = action === "user-reactivate"
        const { data: target, error: getError } = await db.auth.admin.getUserById(id)
        if (getError || !target.user) throw getError ?? new Error("User not found.")
        const { error: authUpdateError } = await db.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" })
        if (authUpdateError) throw authUpdateError
        const { error: profileError } = await db.from("profiles").upsert({ id, email: target.user.email, full_name: target.user.user_metadata?.display_name ?? "", role: target.user.app_metadata?.role ?? "NURSE", department_id: target.user.app_metadata?.department_id ?? null, is_active: active }, { onConflict: "id" })
        if (profileError) throw profileError
        await audit(id, active ? "user.reactivated" : "user.deactivated", { email: target.user.email })
        return json({ ok: true }, 200, origin)
      }
      if (action === "user-password-reset") {
        const { data: target, error: getError } = await db.auth.admin.getUserById(id)
        if (getError || !target.user) throw getError ?? new Error("User not found.")
        const password = temporaryPassword()
        const { error } = await db.auth.admin.updateUserById(id, { password, app_metadata: { ...target.user.app_metadata, password_change_required: true } })
        if (error) throw error
        await audit(id, "user.password_reset", { email: target.user.email })
        return json({ ok: true, temporaryPassword: password }, 200, origin)
      }
      if (action === "user-update") {
        const email = text(body.email, 160).toLowerCase(), name = text(body.name, 100), newRole = text(body.role, 30).toUpperCase(), departmentId = text(body.departmentId, 50) || null
        if (!validEmail(email) || name.length < 2 || !roles.has(newRole)) return json({ error: "Enter a valid email, a name, and a staff role." }, 400, origin)
        if (departmentId) { const { data: dept, error } = await db.from("departments").select("id").eq("id", departmentId).maybeSingle(); if (error || !dept) return json({ error: "Select a valid department." }, 400, origin) }
        const { data: current, error: getError } = await db.auth.admin.getUserById(id)
        if (getError || !current.user) throw getError ?? new Error("User not found.")
        const { error } = await db.auth.admin.updateUserById(id, { email, email_confirm: true, user_metadata: { ...current.user.user_metadata, display_name: name }, app_metadata: { ...current.user.app_metadata, role: newRole, department_id: departmentId } })
        if (error) throw error
        const { error: profileError } = await db.from("profiles").upsert({ id, email, full_name: name, role: newRole, department_id: departmentId }, { onConflict: "id" })
        if (profileError) throw profileError
        await audit(id, "user.updated", { previousEmail: current.user.email, email, previousRole: current.user.app_metadata?.role ?? null, role: newRole, departmentId, name })
        return json({ ok: true }, 200, origin)
      }
      return json({ error: "Unknown user-management action." }, 400, origin)
    }

    if (action === "assign") {
      if (!(role === "ADMIN" || role === "DOCTOR")) return json({ error: "Only doctors and administrators can assign beds." }, 403, origin)
      const bedId = text(body.bedId, 50), patientCode = text(body.patientCode, 20).toUpperCase()
      if (!/^(PAT|BED)-[A-Z0-9]{4,10}$/.test(patientCode)) return json({ error: "Use an anonymous code such as PAT-A12B34. Do not enter a patient's name or medical details." }, 400, origin)
      const { data: bed, error: bedError } = await db.from("beds").select("id,status").eq("id", bedId).single()
      if (bedError || !bed || !["AVAILABLE", "RESERVED"].includes(bed.status)) return json({ error: "That bed is no longer available. Refresh the bed map and try again." }, 409, origin)
      const { error: updateError } = await db.from("beds").update({ status: "OCCUPIED", status_changed_at: new Date().toISOString(), notes: "" }).eq("id", bedId).eq("status", bed.status)
      if (updateError) throw updateError
      const { error: admissionError } = await db.from("admissions").insert({ bed_id: bedId, patient_code: patientCode, assigned_by_id: user.id })
      if (admissionError) { await db.from("beds").update({ status: bed.status }).eq("id", bedId); throw admissionError }
      await db.from("bed_status_logs").insert({ bed_id: bedId, old_status: bed.status, new_status: "OCCUPIED", changed_by_id: user.id, notes: `Assigned ${patientCode}` })
      return json({ ok: true }, 200, origin)
    }
    if (action === "discharge") {
      if (!(role === "ADMIN" || role === "DOCTOR")) return json({ error: "Only doctors and administrators can discharge a patient." }, 403, origin)
      const admissionId = text(body.admissionId, 50)
      const { data: admission, error: findError } = await db.from("admissions").select("id,bed_id").eq("id", admissionId).is("discharged_at", null).single()
      if (findError || !admission) return json({ error: "The active admission could not be found." }, 404, origin)
      const { data: bed } = await db.from("beds").select("status").eq("id", admission.bed_id).single()
      const { error: closeError } = await db.from("admissions").update({ discharged_at: new Date().toISOString() }).eq("id", admission.id)
      if (closeError) throw closeError
      const { error: bedError } = await db.from("beds").update({ status: "TO_CLEAN", status_changed_at: new Date().toISOString() }).eq("id", admission.bed_id)
      if (bedError) throw bedError
      await db.from("bed_status_logs").insert({ bed_id: admission.bed_id, old_status: bed?.status ?? "OCCUPIED", new_status: "TO_CLEAN", changed_by_id: user.id, notes: "Discharged; bed needs cleaning" })
      return json({ ok: true }, 200, origin)
    }
    if (action === "status") {
      const bedId = text(body.bedId, 50), next = text(body.status, 30), reason = text(body.reason, 300)
      if (!statuses.has(next)) return json({ error: "Choose a valid bed status." }, 400, origin)
      if (next === "OUT_OF_SERVICE" && reason.length < 3) return json({ error: "Add a short reason for taking this bed out of service." }, 400, origin)
      const { data: bed, error: findError } = await db.from("beds").select("id,status").eq("id", bedId).single()
      if (findError || !bed) return json({ error: "Bed not found." }, 404, origin)
      if (role === "DOCTOR") return json({ error: "Doctors can assign or discharge beds, but cannot change operational status." }, 403, origin)
      if (role === "CLEANING_STAFF" && !((bed.status === "TO_CLEAN" && next === "CLEANING") || (bed.status === "CLEANING" && next === "AVAILABLE"))) return json({ error: "Cleaning staff can only start or complete bed cleaning." }, 403, origin)
      if (role === "NURSE") { const allowed = (bed.status === "AVAILABLE" && next === "RESERVED") || (bed.status === "RESERVED" && next === "AVAILABLE") || (bed.status === "TO_CLEAN" && next === "CLEANING") || (bed.status === "CLEANING" && next === "AVAILABLE") || (bed.status === "OUT_OF_SERVICE" && next === "AVAILABLE") || (next === "OUT_OF_SERVICE" && bed.status !== "OCCUPIED"); if (!allowed) return json({ error: "That status change is not permitted for this bed. Discharge occupied beds through a doctor first." }, 403, origin) }
      const { error: updateError } = await db.from("beds").update({ status: next, status_changed_at: new Date().toISOString(), notes: next === "OUT_OF_SERVICE" ? reason : "" }).eq("id", bedId).eq("status", bed.status)
      if (updateError) throw updateError
      const { error: logError } = await db.from("bed_status_logs").insert({ bed_id: bedId, old_status: bed.status, new_status: next, changed_by_id: user.id, notes: reason })
      if (logError) throw logError
      return json({ ok: true }, 200, origin)
    }
    if (["department-create", "department-update", "department-delete", "room-create", "room-update", "room-delete", "bed-create", "bed-update", "bed-delete"].includes(action)) {
      if (role !== "ADMIN") return json({ error: "Administrator access required." }, 403, origin)
      const id = text(body.id, 50), table = action.startsWith("department-") ? "departments" : action.startsWith("room-") ? "rooms" : "beds"
      if (action.endsWith("-delete")) { if (!id) return json({ error: "Select a record first." }, 400, origin); const { error } = await db.from(table).delete().eq("id", id); if (error) throw error; return json({ ok: true }, 200, origin) }
      let values: Record<string, unknown>
      if (table === "departments") { const name = text(body.name, 80); if (!name) return json({ error: "Department name is required." }, 400, origin); values = { name, floor: Math.max(0, Math.min(30, Number(body.floor) || 0)), color: text(body.color, 20) || "teal" } }
      else if (table === "rooms") { const type = text(body.type, 20); if (!text(body.number, 20) || !text(body.departmentId, 50) || !roomTypes.has(type)) return json({ error: "Provide a room number, department, and room type." }, 400, origin); values = { number: text(body.number, 20), department_id: text(body.departmentId, 50), type } }
      else { const status = text(body.status, 30) || "AVAILABLE"; if (!text(body.label, 40) || !text(body.roomId, 50) || !statuses.has(status)) return json({ error: "Provide a bed label, room, and valid status." }, 400, origin); values = { label: text(body.label, 40), room_id: text(body.roomId, 50), status, status_changed_at: new Date().toISOString(), notes: text(body.notes, 300) } }
      const result = id ? await db.from(table).update(values).eq("id", id) : await db.from(table).insert(values)
      if (result.error) throw result.error
      return json({ ok: true }, 200, origin)
    }
    return json({ error: "Unknown action." }, 400, origin)
  } catch (error) {
    console.error("bedflow-action failure", error)
    return json({ error: error instanceof Error ? error.message : "The action could not be completed." }, 500, origin)
  }
})
