import { useEffect, useState, type FormEvent } from "react"
import { Building2, Copy, KeyRound, Pencil, Plus, RotateCcw, ShieldCheck, Trash2, UserRoundCheck, UserRoundX, Users, X } from "lucide-react"
import { toast } from "sonner"
import type { Bed, Department, Room } from "@/lib/bedflow"
import { runBedAction, statusPresentation, type ActionPayload } from "@/lib/bedflow"

type Props = { departments: Department[]; rooms: Room[]; beds: Bed[]; onChanged: () => void }
type Entry = { id: string; label: string; detail: string; raw: Record<string, unknown> }
type Kind = "department" | "room" | "bed" | "user"
const initial: Record<string, string> = { department: "", floor: "0", color: "teal", number: "", departmentId: "", type: "SINGLE", label: "", roomId: "", status: "AVAILABLE", notes: "", name: "", email: "", role: "NURSE" }
const staffRoles = ["ADMIN", "DOCTOR", "NURSE", "CLEANING_STAFF"]

export default function BedFlowAdmin({ departments, rooms, beds, onChanged }: Props) {
  const [kind, setKind] = useState<Kind>("department")
  const [form, setForm] = useState(initial)
  const [editId, setEditId] = useState("")
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState("")
  const [pendingUserChange, setPendingUserChange] = useState("")
  const [users, setUsers] = useState<Entry[]>([])
  const [userError, setUserError] = useState("")
  const [temporaryPassword, setTemporaryPassword] = useState("")

  const loadUsers = async () => {
    try {
      const result = await runBedAction({ action: "users-list" })
      const rows = Array.isArray(result.users) ? result.users : []
      setUsers(rows.map((row) => {
        const item = row as Record<string, unknown>
        const active = item.active !== false
        return { id: String(item.id), label: String(item.name || item.email || "Staff member"), detail: `${String(item.role)} · ${String(item.email ?? "")} · ${active ? "Active" : "Deactivated"}`, raw: item }
      }))
      setUserError("")
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Staff accounts could not be loaded.")
    }
  }
  useEffect(() => { void loadUsers() }, [])
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const entries: Entry[] = kind === "department"
    ? departments.map((item) => ({ id: item.id, label: item.name, detail: `Floor ${item.floor} · ${item.color}`, raw: item as unknown as Record<string, unknown> }))
    : kind === "room"
      ? rooms.map((item) => ({ id: item.id, label: `Room ${item.number}`, detail: `${departments.find((d) => d.id === item.department_id)?.name ?? "Department"} · ${item.type}`, raw: item as unknown as Record<string, unknown> }))
      : kind === "bed"
        ? beds.map((item) => ({ id: item.id, label: item.label, detail: `${rooms.find((r) => r.id === item.room_id)?.number ?? "Room"} · ${statusPresentation[item.status].label}`, raw: item as unknown as Record<string, unknown> }))
        : users

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      let payload: ActionPayload
      if (kind === "user") {
        payload = { action: editId ? "user-update" : "user-create", ...(editId ? { id: editId } : {}), name: form.name, email: form.email, role: form.role, departmentId: form.departmentId }
      } else {
        payload = { action: `${kind}-${editId ? "update" : "create"}`, ...(editId ? { id: editId } : {}) }
        if (kind === "department") Object.assign(payload, { name: form.department, floor: Number(form.floor), color: form.color })
        if (kind === "room") Object.assign(payload, { number: form.number, departmentId: form.departmentId, type: form.type })
        if (kind === "bed") Object.assign(payload, { label: form.label, roomId: form.roomId, status: form.status, notes: form.notes })
      }
      const result = await runBedAction(payload)
      const oneTimePassword = typeof result.temporaryPassword === "string" ? result.temporaryPassword : ""
      if (oneTimePassword) setTemporaryPassword(oneTimePassword)
      toast.success(editId ? "Changes saved" : kind === "user" ? "Staff account created" : "Record created")
      setEditId("")
      setForm(initial)
      setPendingDelete("")
      onChanged()
      if (kind === "user") await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The change could not be saved.")
    } finally {
      setBusy(false)
    }
  }

  const edit = (entry: Entry) => {
    setEditId(entry.id)
    const raw = entry.raw
    setForm({ ...initial, department: String(raw.name ?? ""), floor: String(raw.floor ?? 0), color: String(raw.color ?? "teal"), number: String(raw.number ?? ""), departmentId: String(raw.department_id ?? raw.departmentId ?? ""), type: String(raw.type ?? "SINGLE"), label: String(raw.label ?? ""), roomId: String(raw.room_id ?? ""), status: String(raw.status ?? "AVAILABLE"), notes: String(raw.notes ?? ""), name: String(raw.name ?? ""), email: String(raw.email ?? ""), role: String(raw.role ?? "NURSE") })
    setPendingDelete("")
  }

  const remove = async (id: string) => {
    if (pendingDelete !== id) { setPendingDelete(id); return }
    setBusy(true)
    try {
      await runBedAction({ action: `${kind}-delete`, id })
      toast.success("Record removed")
      setPendingDelete("")
      onChanged()
    } catch (error) { toast.error(error instanceof Error ? error.message : "This record could not be removed.") }
    finally { setBusy(false) }
  }

  const toggleUserActive = async (entry: Entry) => {
    const active = entry.raw.active !== false
    if (pendingUserChange !== entry.id) { setPendingUserChange(entry.id); return }
    setBusy(true)
    try {
      await runBedAction({ action: active ? "user-deactivate" : "user-reactivate", id: entry.id })
      toast.success(active ? "Account deactivated" : "Account reactivated")
      setPendingUserChange("")
      await loadUsers()
    } catch (error) { toast.error(error instanceof Error ? error.message : "The account status could not be changed.") }
    finally { setBusy(false) }
  }

  const resetPassword = async (entry: Entry) => {
    setBusy(true)
    try {
      const result = await runBedAction({ action: "user-password-reset", id: entry.id })
      setTemporaryPassword(String(result.temporaryPassword ?? ""))
      await loadUsers()
      toast.success("Temporary password created")
    } catch (error) { toast.error(error instanceof Error ? error.message : "The password could not be reset.") }
    finally { setBusy(false) }
  }

  const copyTemporaryPassword = async () => {
    try { await navigator.clipboard.writeText(temporaryPassword); toast.success("Temporary password copied") }
    catch { toast.error("Copy is unavailable in this browser. Select the password and copy it manually.") }
  }

  return <section className="space-y-5">
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Hospital setup</p><h2 className="mt-1 text-xl font-semibold">Manage departments, rooms, beds, and staff</h2><p className="mt-1 text-sm text-muted-foreground">Staff-account changes are recorded in the audit history.</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2">{(["department", "room", "bed", "user"] as const).map((item) => <button key={item} onClick={() => { setKind(item); setEditId(""); setPendingDelete(""); setPendingUserChange("") }} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${kind === item ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-muted"}`}>{item === "user" ? "Staff users" : `${item}s`}</button>)}</div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between"><h3 className="font-semibold">{editId ? `Edit ${kind}` : `Add ${kind}`}</h3>{editId && <button type="button" onClick={() => { setEditId(""); setForm(initial) }} className="text-xs text-muted-foreground">Cancel edit</button>}</div>
        {kind === "department" && <><Field label="Department name" value={form.department} onChange={(v) => update("department", v)} /><Field label="Floor" type="number" value={form.floor} onChange={(v) => update("floor", v)} /><Field label="Color key" value={form.color} onChange={(v) => update("color", v)} /></>}
        {kind === "room" && <><Field label="Room number" value={form.number} onChange={(v) => update("number", v)} /><SelectField label="Department" value={form.departmentId} onChange={(v) => update("departmentId", v)} options={departments.map((d) => [d.id, d.name])} /><SelectField label="Room type" value={form.type} onChange={(v) => update("type", v)} options={[["SINGLE", "Single"], ["DOUBLE", "Double"], ["ICU", "ICU"], ["ISOLATION", "Isolation"]]} /></>}
        {kind === "bed" && <><Field label="Bed label" value={form.label} onChange={(v) => update("label", v)} /><SelectField label="Room" value={form.roomId} onChange={(v) => update("roomId", v)} options={rooms.map((r) => [r.id, `${r.number} · ${departments.find((d) => d.id === r.department_id)?.name ?? ""}`])} /><SelectField label="Initial status" value={form.status} onChange={(v) => update("status", v)} options={Object.entries(statusPresentation).map(([key, item]) => [key, item.label])} />{form.status === "OUT_OF_SERVICE" && <Field label="Reason" value={form.notes} onChange={(v) => update("notes", v)} />}</>}
        {kind === "user" && <><Field label="Full name" value={form.name} onChange={(v) => update("name", v)} /><Field label="Work email" type="email" value={form.email} onChange={(v) => update("email", v)} /><SelectField label="Staff role" value={form.role} onChange={(v) => update("role", v)} options={staffRoles.map((role) => [role, role.replace("_", " ").toLowerCase()])} /><SelectField label="Department" value={form.departmentId} onChange={(v) => update("departmentId", v)} options={departments.map((d) => [d.id, d.name])} optional />{!editId && <p className="rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">A strong temporary password will be generated and shown once after account creation. The new staff member must change it at first sign-in.</p>}</>}
        <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"><Plus className="h-4 w-4" />{busy ? "Saving…" : editId ? "Save changes" : `Add ${kind}`}</button>
      </form>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">{kind === "user" ? "Staff accounts" : `Current ${kind}s`}</h3><p className="mt-1 text-xs text-muted-foreground">{entries.length} records</p></div>{kind === "user" && <button onClick={() => void loadUsers()} className="grid h-9 w-9 place-items-center rounded-lg border border-border" aria-label="Refresh staff"><RotateCcw className="h-4 w-4" /></button>}</div>
        {userError && kind === "user" && <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{userError}</p>}
        <div className="max-h-[560px] space-y-2 overflow-y-auto">{entries.map((entry) => <div key={entry.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0"><span className="block truncate text-sm font-medium">{entry.label}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{entry.detail}</span></span><span className="flex shrink-0 flex-wrap gap-1">{kind === "user" ? <><button onClick={() => edit(entry)} aria-label={`Edit ${entry.label}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button><button disabled={busy} onClick={() => void resetPassword(entry)} aria-label={`Reset password for ${entry.label}`} title="Reset password" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><KeyRound className="h-3.5 w-3.5" /></button><button disabled={busy} onClick={() => void toggleUserActive(entry)} className={`flex h-8 items-center gap-1 rounded-lg px-2 text-xs ${pendingUserChange === entry.id ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}>{entry.raw.active === false ? <><UserRoundCheck className="h-3.5 w-3.5" />Reactivate</> : <><UserRoundX className="h-3.5 w-3.5" />{pendingUserChange === entry.id ? "Confirm" : "Deactivate"}</>}</button></> : <><button onClick={() => edit(entry)} aria-label={`Edit ${entry.label}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button><button disabled={busy} onClick={() => void remove(entry.id)} aria-label={`${pendingDelete === entry.id ? "Confirm delete" : "Delete"} ${entry.label}`} className={`grid h-8 place-items-center rounded-lg px-2 text-xs ${pendingDelete === entry.id ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}`}>{pendingDelete === entry.id ? "Confirm" : <Trash2 className="h-3.5 w-3.5" />}</button></>}</span></div>)}{entries.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 h-5 w-5" />No records here yet.</div>}</div>
      </div>
    </div>
    {temporaryPassword && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="temporary-password-title" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><button onClick={() => setTemporaryPassword("")} aria-label="Close temporary password" className="grid h-9 w-9 place-items-center rounded-lg border border-border"><X className="h-4 w-4" /></button></div><h3 id="temporary-password-title" className="mt-4 text-lg font-semibold">Temporary password — shown once</h3><p className="mt-1 text-sm text-muted-foreground">Share it securely with the staff member. They must replace it after signing in.</p><code className="mt-4 block break-all rounded-xl border border-border bg-background p-4 font-mono text-sm">{temporaryPassword}</code><button onClick={() => void copyTemporaryPassword()} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"><Copy className="h-4 w-4" />Copy temporary password</button><button onClick={() => setTemporaryPassword("")} className="mt-2 h-10 w-full rounded-xl border border-border text-sm font-medium">Close</button></section></div>}
  </section>
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block text-xs font-medium text-muted-foreground">{label}<input required value={value} type={type} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /></label> }
function SelectField({ label, value, onChange, options, optional = false }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; optional?: boolean }) { return <label className="block text-xs font-medium text-muted-foreground">{label}<select required={!optional} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"><option value="">{optional ? "Unassigned" : "Select one"}</option>{options.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label> }
