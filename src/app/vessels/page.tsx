import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { fmtFt } from "@/lib/domain/rules";
import { loadReferenceData } from "@/lib/services/reservations";

export const metadata: Metadata = { title: "Vessels" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function VesselsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const { vessels } = await loadReferenceData();

  const needle = q.toLowerCase();
  const results = needle
    ? vessels.filter((v) =>
        [v.name, v.operator, v.contactName, v.email].some((field) => field?.toLowerCase().includes(needle)),
      )
    : vessels;

  return (
    <>
      <PageHeader title="Vessel directory" subtitle={`${vessels.length} vessels on file`} />

      <form action="/vessels" className="mb-4 flex max-w-xl gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search vessels
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by vessel, operator, contact or email"
          className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
          Search
        </button>
        {q && (
          <Link href="/vessels" className="self-center text-sm text-slate-600 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={th}>Vessel</th>
              <th className={th}>Operator</th>
              <th className={`${th} text-right`}>LOA</th>
              <th className={`${th} text-right`}>Draft</th>
              <th className={th}>Contact</th>
              <th className={th}>Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.length === 0 && <EmptyRow colSpan={6}>No vessels match &ldquo;{q}&rdquo;.</EmptyRow>}
            {results.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link href={`/vessels/${v.id}`} className="font-semibold text-navy-700 hover:underline">
                    {v.name}
                  </Link>
                </td>
                <td className={`${td} text-slate-700`}>{v.operator || "—"}</td>
                <td className={`${td} text-right font-mono`}>{fmtFt(v.loaFt)}</td>
                <td className={`${td} text-right font-mono`}>{v.draftFt !== null ? fmtFt(v.draftFt) : "—"}</td>
                <td className={`${td} text-slate-700`}>
                  {v.contactName ?? "—"}
                  {v.phone && <span className="block text-xs text-slate-500">{v.phone}</span>}
                </td>
                <td className={td}>
                  {v.email ? (
                    <a href={`mailto:${v.email}`} className="text-navy-700 hover:underline">
                      {v.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
