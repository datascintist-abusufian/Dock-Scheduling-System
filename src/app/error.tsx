"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-md border border-red-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-red-800">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-700">
        The schedule could not be loaded. This is usually a temporary database problem.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-500">Reference: {error.digest}</p>}
      <button onClick={reset} className="mt-4 rounded bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
        Try again
      </button>
    </div>
  );
}
