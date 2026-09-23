"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkReservationAction, saveReservationAction } from "@/app/reservations/actions";
import { addDays, formatDateRange, isValidIsoDate } from "@/lib/domain/dates";
import { canVesselFitBerth, fmtFt, type ValidationField } from "@/lib/domain/rules";
import type { Berth, ReservationStatus, ReservationType, Vessel } from "@/lib/domain/types";
import type { CheckResult } from "@/lib/services/reservations";

export interface FormValues {
  type: ReservationType;
  vesselId: string;
  eventName: string;
  berthId: string;
  startDate: string;
  endDate: string;
  notes: string;
  status: ReservationStatus;
}

interface Props {
  berths: Berth[];
  vessels: Vessel[];
  initial: FormValues;
  reservationId: string | null;
}

/**
 * The reservation form. It holds no business rules of its own: berth fit is
 * computed with the shared canVesselFitBerth() for instant feedback, and full
 * validation (including availability) comes from the server via
 * checkReservationAction, which runs the same validateReservation() used on save.
 */
export function ReservationForm({ berths, vessels, initial, reservationId }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initial);
  const [touched, setTouched] = useState<Partial<Record<ValidationField, boolean>>>(
    reservationId ? { vesselId: true, eventName: true, berthId: true, startDate: true, endDate: true } : {},
  );
  const [check, setCheck] = useState<{ key: string; result: CheckResult } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key !== "notes" && key !== "type" && key !== "status") setTouched((t) => ({ ...t, [key]: true }));
    setSaveError(null);
  };

  const vessel = vessels.find((v) => v.id === values.vesselId) ?? null;
  const berth = berths.find((b) => b.id === values.berthId) ?? null;

  // Everything except notes affects validity.
  const checkInput = useMemo(() => {
    const { notes: _notes, ...rest } = values;
    return rest;
  }, [values]);
  const checkKey = JSON.stringify(checkInput);

  // Debounced server-side validation whenever a relevant field changes.
  const latestKey = useRef(checkKey);
  useEffect(() => {
    latestKey.current = checkKey;
    const timer = setTimeout(async () => {
      const result = await checkReservationAction(checkInput, reservationId);
      if (latestKey.current !== checkKey) return; // a newer edit superseded this check
      if ("error" in result) {
        setCheckError(result.error);
        setCheck(null);
      } else {
        setCheckError(null);
        setCheck({ key: checkKey, result });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [checkKey, checkInput, reservationId]);

  const current = check?.key === checkKey ? check.result : null;
  const checking = !current && !checkError;

  const datesReady = isValidIsoDate(values.startDate) && isValidIsoDate(values.endDate);
  const datesOrdered = datesReady && values.endDate >= values.startDate;
  const fit = values.type === "vessel" && vessel && berth ? canVesselFitBerth(vessel, berth) : null;

  const fieldError = (field: ValidationField) => {
    if (!touched[field] || !current) return null;
    return current.errors.find((e) => e.field === field && e.code !== "VESSEL_TOO_LONG" && e.code !== "DATE_CONFLICT")?.message ?? null;
  };
  const endBeforeStart = datesReady && !datesOrdered;

  const canSave = !!current?.valid && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveReservationAction(values as unknown as Record<string, unknown>, reservationId);
    if (result.ok) {
      router.push(`/schedule?start=${addDays(result.startDate, -3)}&selected=${result.id}`);
      return;
    }
    setSaving(false);
    setSaveError(result.message);
    if (result.check) setCheck({ key: checkKey, result: result.check });
  }

  const labelCls = "block text-sm font-medium text-slate-800";
  const inputCls =
    "mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500";
  const errCls = "mt-1 text-sm text-red-700";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      {/* ---------------- Fields ---------------- */}
      <div className="space-y-5 rounded-md border border-slate-200 bg-white p-5">
        <fieldset>
          <legend className={labelCls}>Reservation type</legend>
          <div className="mt-2 inline-flex rounded border border-slate-300 p-0.5">
            {(["vessel", "event"] as const).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded px-4 py-1.5 text-sm font-medium ${
                  values.type === t ? "bg-navy-700 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <input type="radio" name="type" value={t} checked={values.type === t} onChange={() => set("type", t)} className="sr-only" />
                {t === "vessel" ? "Vessel" : "Event"}
              </label>
            ))}
          </div>
        </fieldset>

        {values.type === "vessel" ? (
          <div>
            <label htmlFor="vesselId" className={labelCls}>
              Vessel <span className="text-red-700">*</span>
            </label>
            <select id="vesselId" value={values.vesselId} onChange={(e) => set("vesselId", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, vesselId: true }))} className={inputCls} aria-invalid={!!fieldError("vesselId")}>
              <option value="">Select a vessel…</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {fmtFt(v.loaFt)} LOA
                </option>
              ))}
            </select>
            {fieldError("vesselId") && <p className={errCls}>{fieldError("vesselId")}</p>}
          </div>
        ) : (
          <div>
            <label htmlFor="eventName" className={labelCls}>
              Event name <span className="text-red-700">*</span>
            </label>
            <input id="eventName" value={values.eventName} onChange={(e) => set("eventName", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, eventName: true }))} placeholder="e.g. Community Sail Day" className={inputCls} aria-invalid={!!fieldError("eventName")} />
            {fieldError("eventName") && <p className={errCls}>{fieldError("eventName")}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="startDate" className={labelCls}>
              Start date <span className="text-red-700">*</span>
            </label>
            <input id="startDate" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} aria-invalid={!!fieldError("startDate")} />
            {fieldError("startDate") && <p className={errCls}>{fieldError("startDate")}</p>}
          </div>
          <div>
            <label htmlFor="endDate" className={labelCls}>
              End date <span className="text-red-700">*</span>
            </label>
            <input id="endDate" type="date" value={values.endDate} min={values.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} className={inputCls} aria-invalid={endBeforeStart || !!fieldError("endDate")} />
            {endBeforeStart ? (
              <p className={errCls}>End date cannot be before the start date.</p>
            ) : (
              fieldError("endDate") && <p className={errCls}>{fieldError("endDate")}</p>
            )}
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Both dates are inclusive: the berth is occupied from the start date through the end date.
          </p>
        </div>

        <div>
          <label htmlFor="berthId" className={labelCls}>
            Berth <span className="text-red-700">*</span>
          </label>
          <select id="berthId" value={values.berthId} onChange={(e) => set("berthId", e.target.value)} onBlur={() => setTouched((t) => ({ ...t, berthId: true }))} className={inputCls} aria-invalid={!!fieldError("berthId") || (fit ? !fit.fits : false)}>
            <option value="">Select a berth…</option>
            {berths.map((b) => {
              const tooShort = values.type === "vessel" && vessel && !canVesselFitBerth(vessel, b).fits;
              return (
                <option key={b.id} value={b.id}>
                  {b.name} — up to {fmtFt(b.lengthFt)}
                  {tooShort ? " (too short)" : ""}
                </option>
              );
            })}
          </select>
          {fieldError("berthId") && <p className={errCls}>{fieldError("berthId")}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="status" className={labelCls}>
              Status
            </label>
            <select id="status" value={values.status} onChange={(e) => set("status", e.target.value as ReservationStatus)} className={inputCls}>
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
              {reservationId && <option value="cancelled">Cancelled</option>}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className={labelCls}>
            Notes
          </label>
          <textarea id="notes" rows={3} value={values.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} placeholder="Shore power, crew contact, gear load-out…" />
        </div>
      </div>

      {/* ---------------- Live checks + save ---------------- */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-live="polite">
        <CheckPanel title="Berth fit">
          {values.type === "event" ? (
            <p className="text-sm text-slate-600">Events occupy the berth but don&apos;t need a vessel-length check.</p>
          ) : !vessel || !berth ? (
            <p className="text-sm text-slate-500">Select a vessel and berth to check fit.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Vessel LOA</dt>
                  <dd className="font-mono text-base font-medium text-slate-900">{fmtFt(vessel.loaFt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Berth capacity</dt>
                  <dd className="font-mono text-base font-medium text-slate-900">{fmtFt(berth.lengthFt)}</dd>
                </div>
              </dl>
              {fit!.fits ? (
                <Verdict ok>
                  Vessel fits berth <span className="font-normal text-emerald-700">({fmtFt(fit!.marginFt)} spare)</span>
                </Verdict>
              ) : (
                <>
                  <Verdict ok={false}>Vessel exceeds berth capacity</Verdict>
                  <p className="mt-1 text-sm text-red-800">{fit!.message}</p>
                </>
              )}
            </>
          )}
        </CheckPanel>

        <CheckPanel title="Availability">
          {!berth || !datesReady ? (
            <p className="text-sm text-slate-500">Select a berth and dates to check availability.</p>
          ) : !datesOrdered ? (
            <p className="text-sm text-slate-500">Fix the dates to check availability.</p>
          ) : checkError ? (
            <p className="text-sm text-red-700">{checkError}</p>
          ) : !current || current.conflicts === null ? (
            <p className="text-sm text-slate-500">Checking availability…</p>
          ) : current.conflicts.length === 0 ? (
            <Verdict ok>
              No scheduling conflict
              <span className="block text-sm font-normal text-emerald-700">
                {berth.name} is free {formatDateRange(values.startDate, values.endDate)}.
              </span>
            </Verdict>
          ) : (
            <>
              <Verdict ok={false}>Berth unavailable</Verdict>
              <ul className="mt-2 space-y-2">
                {current.conflicts.map((c) => (
                  <li key={c.id} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm">
                    <div>
                      <span className="text-red-900/70">Existing reservation: </span>
                      <Link href={`/schedule?start=${addDays(c.startDate, -3)}&selected=${c.id}`} className="font-semibold text-red-900 underline decoration-red-300 underline-offset-2">
                        {c.label}
                      </Link>
                      {c.type === "event" && <span className="text-red-900/70"> (event)</span>}
                    </div>
                    <div>
                      <span className="text-red-900/70">Dates: </span>
                      <span className="font-medium text-red-900">{formatDateRange(c.startDate, c.endDate)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CheckPanel>

        {current && current.alternatives.length > 0 && (
          <CheckPanel title="Suggested berths">
            <p className="mb-2 text-sm text-slate-600">
              {datesOrdered ? "Available for these dates" : "Long enough for this vessel"}
              {values.type === "vessel" && vessel ? ` and able to take ${vessel.name}` : ""}:
            </p>
            <div className="flex flex-wrap gap-2">
              {current.alternatives.map((b) => (
                <button key={b.id} type="button" onClick={() => set("berthId", b.id)} className="rounded border border-navy-200 bg-navy-50 px-2.5 py-1 text-sm font-medium text-navy-800 hover:bg-navy-100">
                  {b.name} <span className="font-normal text-navy-600">· {fmtFt(b.lengthFt)}</span>
                </button>
              ))}
            </div>
          </CheckPanel>
        )}
        {current && current.alternatives.length === 0 && ((fit && !fit.fits) || (current.conflicts?.length ?? 0) > 0) && (
          <p className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            No other berth can take this reservation for these dates.
          </p>
        )}

        <div className="rounded-md border border-slate-200 bg-white p-4">
          {saveError && <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{saveError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!canSave} className="rounded bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
              {saving ? "Saving…" : reservationId ? "Save changes" : "Save reservation"}
            </button>
            <Link href="/schedule" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Cancel
            </Link>
          </div>
          {!canSave && !saving && (
            <SaveBlockers checking={checking} result={current} />
          )}
        </div>
      </aside>
    </form>
  );
}

function CheckPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className={`mt-3 flex items-start gap-2 text-[15px] font-semibold ${ok ? "text-emerald-800" : "text-red-800"}`}>
      <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs text-white ${ok ? "bg-emerald-600" : "bg-red-600"}`}>
        {ok ? "✓" : "✕"}
      </span>
      <span>{children}</span>
    </p>
  );
}

function SaveBlockers({ checking, result }: { checking: boolean; result: CheckResult | null }) {
  if (checking || !result) return <p className="mt-3 text-sm text-slate-500">Checking…</p>;
  const messages = [...new Set(result.errors.map((e) => e.message))];
  return (
    <div className="mt-3 text-sm text-slate-600">
      <p className="font-medium">To save this reservation:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
