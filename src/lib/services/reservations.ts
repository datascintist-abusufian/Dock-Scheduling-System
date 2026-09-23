import "server-only";
import {
  DatabaseError,
  getRepository,
  NotFoundError,
  ReservationConflictError,
  VesselTooLongError,
  type NewReservation,
} from "@/lib/data";
import { isValidIsoDate } from "@/lib/domain/dates";
import { reservationLabel, validateReservation, type FitResult, type ValidationError } from "@/lib/domain/rules";
import type { Berth, IsoDate, Reservation, ReservationInput, ReservationView, Vessel } from "@/lib/domain/types";

/**
 * Application services: orchestrate repository reads, the pure business
 * rules, and writes. Server actions and pages call these; they never call the
 * repository or rules directly for writes.
 */

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export function toViews(reservations: readonly Reservation[], vessels: readonly Vessel[], berths: readonly Berth[]): ReservationView[] {
  const vesselById = new Map(vessels.map((v) => [v.id, v]));
  const berthById = new Map(berths.map((b) => [b.id, b]));
  return reservations.flatMap((r) => {
    const berth = berthById.get(r.berthId);
    if (!berth) return [];
    const vessel = r.vesselId ? (vesselById.get(r.vesselId) ?? null) : null;
    return [{ ...r, berth, vessel, label: reservationLabel(r, vessel) }];
  });
}

/** Berths in pier order (largest to smallest within the facility layout). */
export function sortBerths(berths: Berth[]): Berth[] {
  const order = ["North Pier West", "North Pier Face", "North Pier East", "Inner Channel", "South Float West", "South Float East"];
  const rank = (b: Berth) => (order.indexOf(b.name) === -1 ? order.length : order.indexOf(b.name));
  return [...berths].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export async function loadReferenceData() {
  const repo = getRepository();
  const [berths, vessels] = await Promise.all([repo.listBerths(), repo.listVessels()]);
  return { berths: sortBerths(berths), vessels, mode: repo.mode };
}

export async function loadReservationViews(from: IsoDate, to: IsoDate) {
  const repo = getRepository();
  const [{ berths, vessels, mode }, reservations] = await Promise.all([
    loadReferenceData(),
    repo.listReservations({ from, to }),
  ]);
  return { berths, vessels, mode, reservations: toViews(reservations, vessels, berths) };
}

// ---------------------------------------------------------------------------
// Validation (used for live form feedback AND before every write)
// ---------------------------------------------------------------------------

export interface ConflictSummary {
  id: string;
  label: string;
  type: Reservation["type"];
  startDate: IsoDate;
  endDate: IsoDate;
  status: Reservation["status"];
}

/** Serializable result sent back to the form. */
export interface CheckResult {
  valid: boolean;
  errors: ValidationError[];
  fit: FitResult | null;
  conflicts: ConflictSummary[] | null;
  alternatives: Berth[];
}

export async function checkReservation(input: ReservationInput, excludeId: string | null = null): Promise<CheckResult> {
  const repo = getRepository();
  const { berths, vessels } = await loadReferenceData();

  // Only reservations that could overlap the requested range matter (across
  // all berths, so alternatives can be suggested).
  const hasRange = isValidIsoDate(input.startDate) && isValidIsoDate(input.endDate);
  const reservations = hasRange
    ? await repo.listReservations({ from: input.startDate!, to: input.endDate! })
    : [];

  const result = validateReservation(input, { vessels, berths, reservations, excludeId });
  return {
    valid: result.valid,
    errors: result.errors,
    fit: result.fit,
    alternatives: result.alternatives,
    conflicts:
      result.conflicts?.map((c) => ({
        id: c.id,
        type: c.type,
        label: reservationLabel(c, vessels.find((v) => v.id === c.vesselId)),
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
      })) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type SaveResult =
  | { ok: true; id: string; startDate: IsoDate }
  | { ok: false; check?: CheckResult; message: string };

export async function saveReservation(input: ReservationInput, id: string | null = null): Promise<SaveResult> {
  try {
    const repo = getRepository();
    if (id && !(await repo.getReservation(id))) return { ok: false, message: "This reservation no longer exists." };

    // 1. Authoritative server-side validation with fresh data.
    const check = await checkReservation(input, id);
    if (!check.valid) return { ok: false, check, message: "The reservation could not be saved. Fix the issues below." };

    // 2. Write. The database constraints are a final guard against races.
    const record: NewReservation = {
      type: input.type,
      vesselId: input.type === "vessel" ? input.vesselId : null,
      eventName: input.type === "event" ? input.eventName : null,
      berthId: input.berthId!,
      startDate: input.startDate!,
      endDate: input.endDate!,
      notes: input.notes,
      status: input.status,
    };
    const saved = id ? await repo.updateReservation(id, record) : await repo.createReservation(record);
    return { ok: true, id: saved.id, startDate: saved.startDate };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}

export async function deleteReservation(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await getRepository().deleteReservation(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}

function describeError(error: unknown): string {
  if (
    error instanceof ReservationConflictError ||
    error instanceof VesselTooLongError ||
    error instanceof NotFoundError ||
    error instanceof DatabaseError
  ) {
    return error.message;
  }
  console.error("[reservations] unexpected error", error);
  return "Something went wrong while saving. Please try again.";
}
