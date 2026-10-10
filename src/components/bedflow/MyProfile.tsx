import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, UserRound } from "lucide-react"
import { toast } from "sonner"
import { runBedAction } from "@/lib/bedflow"

const strongPassword = z.string().refine((value) => !value || (value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)), "Use 12+ characters with uppercase, lowercase, a number, and a symbol.")
const schema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(100, "Use 100 characters or fewer."),
  currentPassword: z.string().min(1, "Enter your current password to confirm changes."),
  newPassword: strongPassword,
  confirmPassword: z.string(),
}).refine((values) => !values.newPassword || values.newPassword === values.confirmPassword, { path: ["confirmPassword"], message: "The new passwords do not match." })
type Values = z.infer<typeof schema>
type User = { email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }

export default function MyProfile({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: String(user.user_metadata?.display_name ?? ""), currentPassword: "", newPassword: "", confirmPassword: "" },
  })
  const submit = async (values: Values) => {
    setBusy(true)
    try {
      await runBedAction({ action: "profile-update", name: values.name, currentPassword: values.currentPassword, newPassword: values.newPassword || undefined })
      toast.success("Your profile has been updated.")
      reset({ name: values.name, currentPassword: "", newPassword: "", confirmPassword: "" })
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your profile could not be updated.")
    } finally {
      setBusy(false)
    }
  }
  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
  const mustChange = Boolean(user.app_metadata?.password_change_required)
  return <section className="mx-auto max-w-2xl space-y-5">
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></span>
      <h2 className="mt-4 text-xl font-semibold">My profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">Update your display name and password. Your current password is required to confirm any change.</p>
      <p className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm"><span className="text-muted-foreground">Work email · </span>{user.email}</p>
      {mustChange && <p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Your administrator issued a temporary password. Change it now to continue using BedFlow.</p>}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)}>
        <label className="block text-sm font-medium">Full name<input autoComplete="name" {...register("name")} className={inputClass} />{errors.name && <span className="mt-1 block text-xs text-destructive">{errors.name.message}</span>}</label>
        <label className="block text-sm font-medium">Current password<input type="password" autoComplete="current-password" {...register("currentPassword")} className={inputClass} />{errors.currentPassword && <span className="mt-1 block text-xs text-destructive">{errors.currentPassword.message}</span>}</label>
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" />Change password <span className="font-normal text-muted-foreground">(optional)</span></div>
          <p className="mt-1 text-xs text-muted-foreground">At least 12 characters, including uppercase, lowercase, a number, and a symbol.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">New password<input type="password" autoComplete="new-password" {...register("newPassword")} className={inputClass} />{errors.newPassword && <span className="mt-1 block text-xs text-destructive">{errors.newPassword.message}</span>}</label>
            <label className="block text-xs font-medium text-muted-foreground">Confirm new password<input type="password" autoComplete="new-password" {...register("confirmPassword")} className={inputClass} />{errors.confirmPassword && <span className="mt-1 block text-xs text-destructive">{errors.confirmPassword.message}</span>}</label>
          </div>
        </div>
        <button disabled={busy} className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">{busy ? "Saving…" : "Save profile"}</button>
      </form>
    </div>
    <p className="px-1 text-xs leading-5 text-muted-foreground">Passwords are processed by the hospital’s secure sign-in service; BedFlow does not store readable passwords.</p>
  </section>
}