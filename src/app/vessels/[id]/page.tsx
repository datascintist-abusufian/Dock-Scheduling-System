import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyRow, PageHeader, Section, StatusBadge, td, th } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { addDays, formatDateRange, todayIso } from "@/lib/domain/dates";
import { canVesselFitBerth, fmtFt } from "@/lib/domain/rules";
import { loadReferenceData, toViews } from "@/lib/services/reservations";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const vessel = await getRepository().getVessel((await params).id);
  return { title: vessel?.name ?? "Vessel" };
}

export default async function VesselPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const [vessel, { berths, vessels }, reservations] = await Promise.all([
    repo.getVessel(id),
    loadReferenceData(),
    repo.listReservations({ vesselId: id }),
  ]);
  if (!vessel) notFound();

  const today = todayIso();
  const history = toViews(reservations, vessels, berths).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const fits = berths.map((b) => ({ berth: b, fit: canVesselFitBerth(vessel, b) }));

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[120px_1fr] gap-2 px-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value || "—"}</dd>
    </div>
  );

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/vessels" className="text-navy-700 hover:underline">
          ← Vessel directory
        </Link>
      </div>
      <PageHeader
        title={vessel.name}
        subtitle={vessel.operator}
        actions={
          <Link href={`/reservations/new?vesselId=${vessel.id}`} className="rounded bg-navy-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800">
            Book this vessel
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Particulars & contact">
          <dl className="divide-y divide-slate-100">
            {row("LOA", <span className="font-mono">{fmtFt(vessel.loaFt)}</span>)}
            {row("Draft", vessel.draftFt !== null ? <span className="font-mono">{fmtFt(vessel.draftFt)}</span> : null)}
            {row("Operator", vessel.operator)}
            {row("Contact", vessel.contactName)}
            {row("Phone", vessel.phone)}
            {row("Email", vessel.email && <a href={`mailto:${vessel.email}`} className="text-navy-700 hover:underline">{vessel.email}</a>)}
            {row("Notes", vessel.notes)}
          </dl>
        </Section>

        <Section title="Berth compatibility">
          <ul className="divide-y divide-slate-100">
            {fits.map(({ berth, fit }) => (
              <li key={berth.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{berth.name}</span> <span className="text-slate-500">· up to {fmtFt(berth.lengthFt)}</span>
                </span>
                {fit.fits ? (
                  <span className="text-emerald-700">✓ Fits ({fmtFt(fit.marginFt)} spare)</span>
                ) : (
                  <span className="text-red-700">✕ {fmtFt(-fit.marginFt)} too long</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Reservations">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Dates</th>
                  <th className={th}>Berth</th>
                  <th className={th}>Status</th>
                  <th className={th}>Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.length === 0 && <EmptyRow colSpan={4}>No reservations on record.</EmptyRow>}
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className={`${td} whitespace-nowrap`}>
                      <Link href={`/schedule?start=${addDays(r.startDate, -3)}&selected=${r.id}`} className="font-medium text-navy-700 hover:underline">
                        {formatDateRange(r.startDate, r.endDate)}
                      </Link>
                      {r.startDate <= today && r.endDate >= today && <span className="ml-2 text-xs font-medium text-emerald-700">in port</span>}
                    </td>
                    <td className={td}>{r.berth.name}</td>
                    <td className={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={`${td} text-slate-600`}>{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
