import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-md border border-slate-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-navy-900">Not found</h1>
      <p className="mt-2 text-sm text-slate-700">That record doesn&apos;t exist or has been removed.</p>
      <Link href="/schedule" className="mt-4 inline-block text-sm font-medium text-navy-700 hover:underline">
        Back to the schedule
      </Link>
    </div>
  );
}
