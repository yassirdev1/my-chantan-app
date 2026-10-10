import { useMemo } from "react"
import { BedDouble, Clock3, DoorOpen } from "lucide-react"
import type { Admission, Bed, BedStatus, Department, Room } from "@/lib/bedflow"
import { statusPresentation } from "@/lib/bedflow"

export function elapsedLabel(when: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(when).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

type Props = {
  departments: Department[]; rooms: Room[]; beds: Bed[]; admissions: Admission[]
  selectedDepartment: string; search: string; statusFilter: string; roomTypeFilter: string
  onDepartmentChange: (value: string) => void; onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void; onRoomTypeChange: (value: string) => void
  onSelectBed: (bed: Bed) => void; cleanerMode?: boolean
}

export default function BedMap(props: Props) {
  const activeAdmissions = new Map(props.admissions.filter((item) => !item.discharged_at).map((item) => [item.bed_id, item]))
  const filteredBeds = useMemo(() => props.beds.filter((bed) => {
    const room = props.rooms.find((item) => item.id === bed.room_id)
    const term = props.search.trim().toLowerCase()
    const code = activeAdmissions.get(bed.id)?.patient_code.toLowerCase() ?? ""
    return (!props.selectedDepartment || room?.department_id === props.selectedDepartment)
      && (!props.statusFilter || bed.status === props.statusFilter)
      && (!props.roomTypeFilter || room?.type === props.roomTypeFilter)
      && (!props.cleanerMode || ["TO_CLEAN", "CLEANING"].includes(bed.status))
      && (!term || bed.label.toLowerCase().includes(term) || code.includes(term) || (room?.number ?? "").toLowerCase().includes(term))
  }), [props.beds, props.rooms, props.admissions, props.selectedDepartment, props.search, props.statusFilter, props.roomTypeFilter, props.cleanerMode])
  const departments = props.departments.filter((department) => !props.selectedDepartment || department.id === props.selectedDepartment)

  return <section className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center">
      <input value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Search bed label or anonymous patient code…" className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" aria-label="Search beds" />
      <select value={props.selectedDepartment} onChange={(event) => props.onDepartmentChange(event.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm"><option value="">All departments</option>{props.departments.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select value={props.statusFilter} onChange={(event) => props.onStatusChange(event.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm"><option value="">All statuses</option>{Object.entries(statusPresentation).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select>
      <select value={props.roomTypeFilter} onChange={(event) => props.onRoomTypeChange(event.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm"><option value="">All room types</option>{["SINGLE","DOUBLE","ICU","ISOLATION"].map((value)=><option key={value} value={value}>{value}</option>)}</select>
    </div>
    <div className="flex flex-wrap gap-2">{Object.entries(statusPresentation).map(([key,value])=><span key={key} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${value.tone}`}>{value.label}</span>)}</div>
    {departments.map((department) => {
      const deptRooms = props.rooms.filter((room) => room.department_id === department.id)
      const shownCount = filteredBeds.filter((bed)=>deptRooms.some((room)=>room.id===bed.room_id)).length
      if (!shownCount) return null
      return <div key={department.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Floor {department.floor}</p><h2 className="mt-1 text-xl font-semibold">{department.name}</h2></div><div className="rounded-xl bg-muted px-3 py-2 text-right"><div className="text-lg font-semibold tabular-nums">{shownCount}</div><div className="text-[10px] text-muted-foreground">beds shown</div></div></div>
        <div className="grid gap-3 xl:grid-cols-2">{deptRooms.map((room)=>{
          const roomBeds = filteredBeds.filter((bed)=>bed.room_id===room.id)
          if(!roomBeds.length)return null
          return <article key={room.id} className="rounded-xl border border-border/80 bg-background/70 p-3">
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-muted-foreground"/><span className="text-sm font-semibold">Room {room.number}</span><span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{room.type}</span></div><span className="text-xs text-muted-foreground">{roomBeds.length} beds</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{roomBeds.map((bed)=>{
              const status=statusPresentation[bed.status as BedStatus]
              const admission=activeAdmissions.get(bed.id)
              return <button key={bed.id} onClick={()=>props.onSelectBed(bed)} className={`group min-h-[92px] rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${status.tile}`}>
                <span className="flex items-center justify-between"><BedDouble className="h-4 w-4 opacity-70"/><span className="text-xs font-semibold">{bed.label}</span></span>
                <span className="mt-2 block truncate text-[11px] font-medium">{status.label}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] opacity-75"><Clock3 className="h-3 w-3"/>{elapsedLabel(bed.status_changed_at)}</span>
                {admission&&<span className="mt-1 block truncate font-mono text-[10px] opacity-75">{admission.patient_code}</span>}
              </button>
            })}</div>
          </article>
        })}</div>
      </div>
    })}
    {filteredBeds.length===0&&<div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center"><BedDouble className="mx-auto h-8 w-8 text-muted-foreground/50"/><h3 className="mt-3 font-semibold">No beds match these filters</h3><p className="mt-1 text-sm text-muted-foreground">Try another department or clear the search.</p></div>}
  </section>
}
