"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReservationAction } from "@/app/reservations/actions";

export function DeleteReservationButton({ id, label, redirectTo = "/schedule" }: { id: string; label: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-red-700">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete the reservation for ${label}? This cannot be undone.`)) return;
          startTransition(async () => {
            const result = await deleteReservationAction(id);
            if (result.ok) router.push(redirectTo);
            else setError(result.message);
          });
        }}
        className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
