import type { Metadata } from "next";
import Link from "next/link";
import { ReservationDetail } from "@/components/ReservationDetail";
import { ScheduleGrid, ScheduleLegend } from "@/components/ScheduleGrid";
import { EmptyRow, PageHeader, StatusBadge, td, th, TypeBadge } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { addDays, formatDateRange, isValidIsoDate, todayIso } from "@/lib/domain/dates";
import { windowEnd } from "@/lib/domain/schedule";
import { loadReservationViews, toViews } from "@/lib/services/reservations";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

const RANGES = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const today = todayIso();
  const start = isValidIsoDate(param("start")) ? param("start")! : addDays(today, -3);
  const days = RANGES.some((r) => String(r.days) === param("days")) ? Number(param("days")) : 28;
  const window = { start, days };
  const end = windowEnd(window);
  const selectedId = param("selected") ?? null;

  const { berths, vessels, reservations } = await loadReservationViews(start, end);

  // The selected reservation may lie outside the visible window.
  let selected = reservations.find((r) => r.id === selectedId) ?? null;
  if (selectedId && !selected) {
    const r = await getRepository().getReservation(selectedId);
    selected = r ? (toViews([r], vessels, berths)[0] ?? null) : null;
  }

  const href = (next: { start?: string; days?: number; selected?: string | null }) => {
    const q = new URLSearchParams({ start: next.start ?? start, days: String(next.days ?? days) });
    const sel = next.selected === undefined ? null : next.selected;
    if (sel) q.set("selected", sel);
    return `/schedule?${q}`;
  };
  const step = Math.max(7, Math.floor(days / 2));

  return (
    <>
      <PageHeader
        title="Berth schedule"
        subtitle={
          <>
            {formatDateRange(start, end)} · {reservations.length} reservation{reservations.length === 1 ? "" : "s"} in view. Click a
            booking for details, or an empty day to book it.
          </>
        }
      />

      {/* Date filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form action="/schedule" className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-600">From</span>
            <input type="date" name="start" defaultValue={start} className="mt-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-600">Show</span>
            <select name="days" defaultValue={days} className="mt-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded border border-navy-700 bg-navy-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
            Apply
          </button>
        </form>

        <div className="flex items-center rounded border border-slate-300 bg-white text-sm">
          <Link href={href({ start: addDays(start, -step) })} className="px-3 py-1.5 hover:bg-slate-50" aria-label="Earlier">
            ‹ Earlier
          </Link>
          <Link href={href({ start: addDays(today, -3) })} className="border-x border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
            Today
          </Link>
          <Link href={href({ start: addDays(start, step) })} className="px-3 py-1.5 hover:bg-slate-50" aria-label="Later">
            Later ›
          </Link>
        </div>
        <div className="ml-auto">
          <ScheduleLegend />
        </div>
      </div>

      <ScheduleGrid
        berths={berths}
        reservations={reservations}
        window={window}
        today={today}
        selectedId={selected?.id ?? null}
        hrefFor={(id) => href({ selected: id })}
      />

      {/* Text list of the same reservations: full names, and usable on small screens. */}
      <div className="mt-6 overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full">
          <caption className="border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-slate-700">
            Reservations in this period
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={th}>Vessel / event</th>
              <th className={th}>Berth</th>
              <th className={th}>Dates</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reservations.length === 0 && <EmptyRow colSpan={4}>No reservations in this period. Every berth is available.</EmptyRow>}
            {[...reservations]
              .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.berth.name.localeCompare(b.berth.name))
              .map((r) => (
                <tr key={r.id} className={r.id === selected?.id ? "bg-amber-50" : "hover:bg-slate-50"}>
                  <td className={td}>
                    <Link href={href({ selected: r.id })} scroll={false} className="font-medium text-navy-700 hover:underline">
                      {r.label}
                    </Link>{" "}
                    <TypeBadge type={r.type} />
                  </td>
                  <td className={td}>{r.berth.name}</td>
                  <td className={`${td} whitespace-nowrap text-slate-700`}>{formatDateRange(r.startDate, r.endDate)}</td>
                  <td className={td}>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {selectedId && !selected && (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">That reservation no longer exists.</p>
      )}
      {selected && <ReservationDetail reservation={selected} closeHref={href({})} />}
    </>
  );
}
