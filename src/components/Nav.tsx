"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/vessels", label: "Vessels" },
];

export function Nav({ demoMode }: { demoMode: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded bg-navy-800 text-sm font-bold text-white">
            DS
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-navy-900">Dock Scheduling</span>
            <span className="block text-xs text-slate-500">Marine Research Facility</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                isActive(l.href) ? "bg-navy-50 text-navy-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {demoMode && (
            <span
              className="hidden rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 sm:inline"
              title="No database configured. Using seeded in-memory data; changes are not durable."
            >
              Demo data
            </span>
          )}
          <Link
            href="/reservations/new"
            className="rounded bg-navy-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800"
          >
            + New reservation
          </Link>
        </div>
      </div>
    </header>
  );
}
