import Link from "next/link";
import { formatDateRange, nightsOrDays } from "@/lib/domain/dates";
import { canVesselFitBerth, fmtFt } from "@/lib/domain/rules";
import type { ReservationView } from "@/lib/domain/types";
import { DeleteReservationButton } from "./DeleteReservationButton";
import { StatusBadge, TypeBadge } from "./ui";

/** Slide-over panel with the details of the selected reservation. */
export function ReservationDetail({ reservation: r, closeHref }: { reservation: ReservationView; closeHref: string }) {
  const days = nightsOrDays(r.startDate, r.endDate);
  const fit = r.vessel ? canVesselFitBerth(r.vessel, r.berth) : null;

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );

  return (
    <>
      <Link href={closeHref} scroll={false} aria-label="Close details" className="fixed inset-0 z-30 bg-slate-900/20" />
      <aside
        role="dialog"
        aria-labelledby="reservation-title"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="mb-1.5 flex gap-2">
              <TypeBadge type={r.type} />
              <StatusBadge status={r.status} />
            </div>
            <h2 id="reservation-title" className="text-lg font-semibold text-navy-900">
              {r.label}
            </h2>
            <p className="text-sm text-slate-600">{r.berth.name}</p>
          </div>
          <Link href={closeHref} scroll={false} className="rounded px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100" aria-label="Close">
            ×
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          <dl className="divide-y divide-slate-100">
            {row("Dates", formatDateRange(r.startDate, r.endDate))}
            {row("Duration", `${days} day${days === 1 ? "" : "s"} (inclusive)`)}
            {row("Berth", `${r.berth.name} · up to ${fmtFt(r.berth.lengthFt)}`)}
            {r.vessel && (
              <>
                {row(
                  "Vessel",
                  <Link href={`/vessels/${r.vessel.id}`} className="font-medium text-navy-700 underline decoration-navy-200 underline-offset-2">
                    {r.vessel.name}
                  </Link>,
                )}
                {row("Operator", r.vessel.operator || "—")}
                {row("LOA / draft", `${fmtFt(r.vessel.loaFt)} / ${r.vessel.draftFt !== null ? fmtFt(r.vessel.draftFt) : "—"}`)}
                {row("Contact", [r.vessel.contactName, r.vessel.phone].filter(Boolean).join(" · ") || "—")}
                {r.vessel.email && row("Email", <a href={`mailto:${r.vessel.email}`} className="text-navy-700 underline">{r.vessel.email}</a>)}
              </>
            )}
            {r.type === "event" && row("Event", r.eventName)}
            {row("Notes", r.notes ? <span className="whitespace-pre-line">{r.notes}</span> : <span className="text-slate-400">None</span>)}
          </dl>

          {fit && (
            <p className={`mt-4 rounded border px-3 py-2 ${fit.fits ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {fit.fits ? `✓ Vessel fits berth (${fmtFt(fit.marginFt)} spare)` : `✕ ${fit.message}`}
            </p>
          )}
          {r.type === "event" && (
            <p className="mt-4 rounded border border-teal-200 bg-teal-50 px-3 py-2 text-teal-800">
              Non-vessel event: occupies the berth, no length check required.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <DeleteReservationButton id={r.id} label={r.label} redirectTo={closeHref} />
          <Link href={`/reservations/${r.id}/edit`} className="rounded bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">
            Edit reservation
          </Link>
        </div>
      </aside>
    </>
  );
}
