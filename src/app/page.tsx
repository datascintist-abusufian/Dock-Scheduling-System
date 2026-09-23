import Link from "next/link";
import { EmptyRow, PageHeader, Section, StatusBadge, td, th, TypeBadge } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { addDays, diffDays, formatDate, formatDateRange, formatShortDate, todayIso } from "@/lib/domain/dates";
import { detectScheduleIssues, fmtFt, reservationLabel, type ScheduleIssue } from "@/lib/domain/rules";
import { berthOccupancyOn, reservationsOn } from "@/lib/domain/schedule";
import type { Reservation, Vessel } from "@/lib/domain/types";
import { loadReferenceData, toViews } from "@/lib/services/reservations";

export const dynamic = "force-dynamic";

const UPCOMING_DAYS = 14;

export default async function DashboardPage() {
  const today = todayIso();
  const [{ berths, vessels }, all] = await Promise.all([loadReferenceData(), getRepository().listReservations()]);
  const views = toViews(all, vessels, berths);

  const inPort = reservationsOn(views, today).sort((a, b) => a.endDate.localeCompare(b.endDate));
  const { occupied, available } = berthOccupancyOn(berths, all, today);
  const upcoming = views.filter((r) => r.startDate > today && r.startDate <= addDays(today, UPCOMING_DAYS));
  const arrivals = views.filter((r) => r.startDate === today).length;
  const departures = views.filter((r) => r.endDate === today).length;

  // Data checks: rule violations in stored data, plus operational attention items.
  const issues = detectScheduleIssues(all, vessels, berths);
  const needsConfirmation = views.filter(
    (r) => r.status === "tentative" && r.startDate >= today && diffDays(today, r.startDate) <= 7,
  );

  const occupantOf = new Map(inPort.map((r) => [r.berthId, r]));

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        subtitle={formatDate(today)}
        actions={
          <Link href="/schedule" className="text-sm font-medium text-navy-700 hover:underline">
            Open schedule →
          </Link>
        }
      />

      {/* Key figures */}
      <dl className="mb-6 grid grid-cols-2 divide-slate-200 rounded-md border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x">
        {[
          ["Berths occupied", `${occupied.length} / ${berths.length}`],
          ["Berths available", String(available.length)],
          ["Arrivals today", String(arrivals)],
          ["Departures today", String(departures)],
        ].map(([label, value]) => (
          <div key={label} className="px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-navy-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Section title="Today's reservations" aside={<span className="text-xs text-slate-500">{inPort.length} active</span>}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={th}>Berth</th>
                    <th className={th}>Vessel / event</th>
                    <th className={th}>Dates</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inPort.length === 0 && <EmptyRow colSpan={4}>No reservations today.</EmptyRow>}
                  {inPort.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className={`${td} font-medium`}>{r.berth.name}</td>
                      <td className={td}>
                        <Link href={`/schedule?selected=${r.id}`} className="font-medium text-navy-700 hover:underline">
                          {r.label}
                        </Link>{" "}
                        {r.type === "event" && <TypeBadge type="event" />}
                      </td>
                      <td className={`${td} whitespace-nowrap text-slate-600`}>
                        {formatShortDate(r.startDate)} – {formatShortDate(r.endDate)}
                        {r.endDate === today && <span className="ml-2 text-xs font-medium text-amber-700">departs today</span>}
                      </td>
                      <td className={td}>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`Upcoming · next ${UPCOMING_DAYS} days`} aside={<span className="text-xs text-slate-500">{upcoming.length} arriving</span>}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={th}>Starts</th>
                    <th className={th}>Vessel / event</th>
                    <th className={th}>Berth</th>
                    <th className={th}>Until</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcoming.length === 0 && <EmptyRow colSpan={5}>Nothing scheduled in the next {UPCOMING_DAYS} days.</EmptyRow>}
                  {upcoming.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className={`${td} whitespace-nowrap font-medium`}>
                        {formatShortDate(r.startDate)} <span className="text-xs font-normal text-slate-500">in {diffDays(today, r.startDate)}d</span>
                      </td>
                      <td className={td}>
                        <Link href={`/schedule?start=${addDays(r.startDate, -3)}&selected=${r.id}`} className="font-medium text-navy-700 hover:underline">
                          {r.label}
                        </Link>{" "}
                        {r.type === "event" && <TypeBadge type="event" />}
                      </td>
                      <td className={td}>{r.berth.name}</td>
                      <td className={`${td} whitespace-nowrap text-slate-600`}>{formatShortDate(r.endDate)}</td>
                      <td className={td}>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Berth status">
            <ul className="divide-y divide-slate-100">
              {berths.map((b) => {
                const occ = occupantOf.get(b.id);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">{b.name}</div>
                      <div className="text-xs text-slate-500">Up to {fmtFt(b.lengthFt)}</div>
                    </div>
                    {occ ? (
                      <div className="text-right">
                        <span className="inline-block rounded bg-navy-700 px-2 py-0.5 text-xs font-medium text-white">Occupied</span>
                        <div className="mt-0.5 max-w-[180px] truncate text-xs text-slate-600">
                          {occ.label} · until {formatShortDate(occ.endDate)}
                        </div>
                      </div>
                    ) : (
                      <Link href={`/reservations/new?berthId=${b.id}&start=${today}`} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
                        Available · book
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Conflicts & data checks">
            <div className="space-y-3 px-4 py-3 text-sm">
              {issues.length === 0 ? (
                <p className="flex items-start gap-2 text-emerald-800">
                  <span aria-hidden>✓</span>
                  <span>
                    No double bookings or oversize vessels found across {all.length} active reservations.
                  </span>
                </p>
              ) : (
                <ul className="space-y-2">
                  {issues.map((issue, i) => (
                    <li key={i} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-900">
                      {describeIssue(issue, vessels, berths)}
                    </li>
                  ))}
                </ul>
              )}
              {needsConfirmation.map((r) => (
                <p key={r.id} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <span className="font-medium">{r.label}</span> is still tentative and arrives {formatShortDate(r.startDate)} at {r.berth.name}.{" "}
                  <Link href={`/reservations/${r.id}/edit`} className="underline">
                    Review
                  </Link>
                </p>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function describeIssue(issue: ScheduleIssue, vessels: Vessel[], berths: { id: string; name: string }[]) {
  const label = (r: Reservation) => reservationLabel(r, vessels.find((v) => v.id === r.vesselId));
  const berthName = (id: string) => berths.find((b) => b.id === id)?.name ?? "Unknown berth";
  switch (issue.kind) {
    case "overlap":
      return (
        <>
          <strong>Double booking</strong> at {berthName(issue.berthId)}: {label(issue.a)} ({formatDateRange(issue.a.startDate, issue.a.endDate)}) overlaps{" "}
          {label(issue.b)} ({formatDateRange(issue.b.startDate, issue.b.endDate)}).
        </>
      );
    case "too-long":
      return (
        <>
          <strong>Vessel too long:</strong> {issue.fit.message.replace(" Select another berth.", "")} (
          {formatDateRange(issue.reservation.startDate, issue.reservation.endDate)})
        </>
      );
    case "missing-reference":
      return (
        <>
          <strong>Incomplete record:</strong> {issue.detail} for reservation {formatDateRange(issue.reservation.startDate, issue.reservation.endDate)}.
        </>
      );
  }
}
