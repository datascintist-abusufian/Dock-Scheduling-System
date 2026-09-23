import Link from "next/link";
import { eachDay, formatDateRange, formatMonth, formatWeekday, isWeekend } from "@/lib/domain/dates";
import { fmtFt } from "@/lib/domain/rules";
import { layoutBerthRow, type ScheduleWindow } from "@/lib/domain/schedule";
import type { Berth, IsoDate, ReservationView } from "@/lib/domain/types";

interface Props {
  berths: Berth[];
  reservations: ReservationView[];
  window: ScheduleWindow;
  today: IsoDate;
  selectedId: string | null;
  /** Builds the schedule URL that selects a reservation (keeps current filters). */
  hrefFor: (selectedId: string) => string;
}

const LANE_HEIGHT = 30;
const ROW_PADDING = 7;

/**
 * Berth × date grid. Rows are berths, columns are days, and each reservation
 * is a bar spanning its (inclusive) date range. Empty days link to the new
 * reservation form prefilled with that berth and date.
 */
export function ScheduleGrid({ berths, reservations, window, today, selectedId, hrefFor }: Props) {
  const days = eachDay(window.start, window.days);
  const minCol = window.days <= 14 ? 60 : window.days <= 31 ? 38 : 22;
  const cols = { gridTemplateColumns: `repeat(${window.days}, minmax(0, 1fr))` };

  // Month bands for the header
  const months: { label: string; start: number; span: number }[] = [];
  days.forEach((d, i) => {
    const label = formatMonth(d);
    const last = months[months.length - 1];
    if (last?.label === label) last.span++;
    else months.push({ label, start: i, span: 1 });
  });

  return (
    <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
      <div style={{ minWidth: 190 + window.days * minCol }} className="text-sm">
        {/* Header */}
        <div className="flex border-b border-slate-300 bg-slate-50">
          <div className="sticky left-0 z-10 flex w-[140px] shrink-0 items-end border-r border-slate-300 bg-slate-50 px-3 pb-1.5 sm:w-[190px] text-xs font-semibold uppercase tracking-wide text-slate-500">
            Berth
          </div>
          <div className="flex-1">
            <div className="grid border-b border-slate-200" style={cols}>
              {months.map((m) => (
                <div key={m.label} style={{ gridColumn: `${m.start + 1} / span ${m.span}` }} className="truncate border-l border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 first:border-l-0">
                  {m.label}
                </div>
              ))}
            </div>
            <div className="grid" style={cols}>
              {days.map((d) => (
                <div
                  key={d}
                  className={`border-l border-slate-200 py-1 text-center first:border-l-0 ${d === today ? "bg-navy-700 text-white" : isWeekend(d) ? "bg-slate-100 text-slate-500" : "text-slate-600"}`}
                >
                  {minCol >= 30 && <div className="text-[10px] uppercase leading-tight">{formatWeekday(d).slice(0, 2)}</div>}
                  <div className="text-xs font-semibold leading-tight">{Number(d.slice(8))}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Berth rows */}
        {berths.map((berth) => {
          const { bars, lanes } = layoutBerthRow(
            reservations.filter((r) => r.berthId === berth.id),
            window,
          );
          const height = lanes * LANE_HEIGHT + ROW_PADDING * 2;
          return (
            <div key={berth.id} className="flex border-b border-slate-200 last:border-b-0">
              <div className="sticky left-0 z-20 flex w-[140px] shrink-0 flex-col justify-center border-r border-slate-300 bg-white px-3 py-2 sm:w-[190px]">
                <span className="text-[13px] font-semibold leading-tight text-slate-900 sm:text-sm">{berth.name}</span>
                <span className="text-xs text-slate-500">Up to {fmtFt(berth.lengthFt)}</span>
              </div>
              <div className="relative flex-1" style={{ height }}>
                {/* Day cells (clickable empty space) */}
                <div className="absolute inset-0 grid" style={cols}>
                  {days.map((d) => (
                    <Link
                      key={d}
                      href={`/reservations/new?berthId=${berth.id}&start=${d}`}
                      title={`Book ${berth.name} on ${formatDateRange(d, d)}`}
                      aria-label={`Book ${berth.name} on ${formatDateRange(d, d)}`}
                      className={`border-l border-slate-100 first:border-l-0 hover:bg-navy-50 ${d === today ? "bg-navy-50/70" : isWeekend(d) ? "bg-slate-50" : ""}`}
                    />
                  ))}
                </div>

                {/* Reservation bars */}
                {bars.map(({ reservation: r, column, span, lane, continuesBefore, continuesAfter }) => {
                  const selected = r.id === selectedId;
                  const color =
                    r.type === "event"
                      ? "bg-teal-600 text-white hover:bg-teal-700"
                      : r.status === "tentative"
                        ? "bg-navy-500 text-white hover:bg-navy-600 bar-tentative"
                        : "bg-navy-700 text-white hover:bg-navy-800";
                  return (
                    <Link
                      key={r.id}
                      href={hrefFor(r.id)}
                      scroll={false}
                      title={`${r.label} · ${berth.name} · ${formatDateRange(r.startDate, r.endDate)}${r.status === "tentative" ? " · tentative" : ""}`}
                      className={`absolute z-10 flex items-center overflow-hidden px-2 text-xs font-medium shadow-sm ${color} ${
                        continuesBefore ? "rounded-l-none" : "rounded-l"
                      } ${continuesAfter ? "rounded-r-none" : "rounded-r"} ${selected ? "ring-2 ring-amber-400 ring-offset-1" : ""}`}
                      style={{
                        left: `calc(${(column / window.days) * 100}% + 2px)`,
                        width: `calc(${(span / window.days) * 100}% - 4px)`,
                        top: ROW_PADDING + lane * LANE_HEIGHT,
                        height: LANE_HEIGHT - 4,
                      }}
                    >
                      <span className="truncate">
                        {continuesBefore && "‹ "}
                        {r.label}
                        {r.vessel && span * minCol > 150 && <span className="font-normal opacity-80"> · {fmtFt(r.vessel.loaFt)}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleLegend() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-5 rounded-sm ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
      {item("bg-navy-700", "Vessel (confirmed)")}
      {item("bg-navy-500 bar-tentative", "Vessel (tentative)")}
      {item("bg-teal-600", "Event")}
      {item("border border-slate-300 bg-white", "Available — click to book")}
      {item("bg-navy-50 border border-navy-200", "Today")}
    </div>
  );
}
