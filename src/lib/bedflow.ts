import { z } from "zod"
import { supabase } from "@/lib/chantan-db"

export const bedStatusSchema = z.enum(["AVAILABLE", "OCCUPIED", "TO_CLEAN", "CLEANING", "OUT_OF_SERVICE", "RESERVED"])
export const roomTypeSchema = z.enum(["SINGLE", "DOUBLE", "ICU", "ISOLATION"])
export const roleSchema = z.enum(["ADMIN", "DOCTOR", "NURSE", "CLEANING_STAFF"])
export type BedStatus = z.infer<typeof bedStatusSchema>
export type RoomType = z.infer<typeof roomTypeSchema>
export type StaffRole = z.infer<typeof roleSchema>
export type Department = { id: string; name: string; floor: number; color: string }
export type Room = { id: string; number: string; department_id: string; type: RoomType }
export type Bed = { id: string; label: string; room_id: string; status: BedStatus; status_changed_at: string; notes: string }
export type Admission = { id: string; bed_id: string; patient_code: string; admitted_at: string; discharged_at: string | null; assigned_by_id: string | null }
export type BedStatusLog = { id: string; bed_id: string; old_status: BedStatus | null; new_status: BedStatus; changed_by_id: string | null; changed_at: string; notes: string }
export type BedFlowData = { departments: Department[]; rooms: Room[]; beds: Bed[]; admissions: Admission[]; logs: BedStatusLog[] }
export type ActionPayload = Record<string, unknown> & { action: string }

export async function loadBedFlow(options: { role?: string } = {}): Promise<BedFlowData> {
  const bedsQuery = supabase.from("beds").select("*").order("label")
  const admissionsQuery = supabase.from("admissions").select("*").order("admitted_at", { ascending: false }).limit(1000)
  if (options.role === "CLEANING_STAFF") {
    bedsQuery.in("status", ["TO_CLEAN", "CLEANING"])
    admissionsQuery.limit(0)
  }
  const [departments, rooms, beds, admissions, logs] = await Promise.all([
    supabase.from("departments").select("*").order("floor"),
    supabase.from("rooms").select("*").order("number"),
    bedsQuery,
    admissionsQuery,
    supabase.from("bed_status_logs").select("*").order("changed_at", { ascending: false }).limit(300),
  ])
  const failure = [departments, rooms, beds, admissions, logs].find((result) => result.error)
  if (failure?.error) throw new Error(failure.error.message)
  return {
    departments: (departments.data ?? []) as Department[],
    rooms: (rooms.data ?? []) as Room[],
    beds: (beds.data ?? []) as Bed[],
    admissions: (admissions.data ?? []) as Admission[],
    logs: (logs.data ?? []) as BedStatusLog[],
  }
}

export async function runBedAction(payload: ActionPayload): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("bedflow-action", { body: payload })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== "object") throw new Error("The server returned an unexpected response.")
  const result = data as Record<string, unknown>
  if (result.error) throw new Error(String(result.error))
  return result
}

export const statusPresentation: Record<BedStatus, { label: string; tone: string; tile: string }> = {
  AVAILABLE: { label: "Available", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", tile: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60" },
  OCCUPIED: { label: "Occupied", tone: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", tile: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60" },
  TO_CLEAN: { label: "To clean", tone: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", tile: "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/60" },
  CLEANING: { label: "Cleaning", tone: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", tile: "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/60" },
  OUT_OF_SERVICE: { label: "Out of service", tone: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300", tile: "border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900" },
  RESERVED: { label: "Reserved", tone: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", tile: "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/60" },
}

export const roleLabel: Record<StaffRole, string> = {
  ADMIN: "Administrator", DOCTOR: "Doctor", NURSE: "Nurse", CLEANING_STAFF: "Cleaning staff",
}
