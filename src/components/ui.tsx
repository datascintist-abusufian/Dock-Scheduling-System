import type { Reservation } from "@/lib/domain/types";

/** Small presentational primitives shared across pages. */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: Reservation["status"] }) {
  const styles = {
    confirmed: "bg-emerald-50 text-emerald-800 border-emerald-200",
    tentative: "bg-amber-50 text-amber-800 border-amber-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  }[status];
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium capitalize ${styles}`}>{status}</span>;
}

export function TypeBadge({ type }: { type: Reservation["type"] }) {
  return type === "event" ? (
    <span className="inline-block rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-800">Event</span>
  ) : (
    <span className="inline-block rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy-700">Vessel</span>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export const th = "px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
export const td = "px-4 py-2.5 text-sm";
