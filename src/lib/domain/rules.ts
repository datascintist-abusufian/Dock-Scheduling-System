/**
 * Business rules for dock scheduling.
 *
 * Everything in this file is pure: no database, no React, no I/O. The same
 * functions run in the browser (live form feedback) and on the server (the
 * authoritative check before a write), so the two can never disagree.
 *
 * DATE-RANGE ASSUMPTION
 * ---------------------
 * start_date and end_date are both INCLUSIVE calendar days. A reservation for
 * 10–12 June occupies the berth on the 10th, 11th and 12th. Therefore:
 *   - a booking ending 12 June and one starting 13 June are adjacent → OK
 *   - a booking ending 12 June and one starting 12 June overlap → CONFLICT
 * This matches the spreadsheet (one column per day; a filled cell = occupied)
 * and the rule in the brief: new_start <= existing_end AND new_end >= existing_start.
 */

import { formatDateRange, isValidIsoDate } from "./dates";
import type { Berth, IsoDate, Reservation, ReservationInput, Vessel } from "./types";

// ---------------------------------------------------------------------------
// Rule 1: berth fit
// ---------------------------------------------------------------------------

export interface FitResult {
  fits: boolean;
  vesselLoaFt: number;
  berthLengthFt: number;
  /** Spare length in feet; negative when the vessel is too long. */
  marginFt: number;
  message: string;
}

/** A vessel fits when its length overall is less than or equal to the berth length. */
export function canVesselFitBerth(vessel: Pick<Vessel, "name" | "loaFt">, berth: Pick<Berth, "name" | "lengthFt">): FitResult {
  const fits = vessel.loaFt <= berth.lengthFt;
  return {
    fits,
    vesselLoaFt: vessel.loaFt,
    berthLengthFt: berth.lengthFt,
    marginFt: berth.lengthFt - vessel.loaFt,
    message: fits
      ? `${vessel.name} (${fmtFt(vessel.loaFt)}) fits ${berth.name} (up to ${fmtFt(berth.lengthFt)}).`
      : `${vessel.name} is ${fmtFt(vessel.loaFt)} long. ${berth.name} supports vessels up to ${fmtFt(berth.lengthFt)}. Select another berth.`,
  };
}

// ---------------------------------------------------------------------------
// Rule 2: date conflicts (applies to vessels AND events — Rule 3)
// ---------------------------------------------------------------------------

/** Inclusive range overlap: aStart <= bEnd AND aEnd >= bStart. */
export function dateRangesOverlap(aStart: IsoDate, aEnd: IsoDate, bStart: IsoDate, bEnd: IsoDate): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

/** Cancelled reservations no longer occupy a berth. */
export function occupiesBerth(r: Pick<Reservation, "status">): boolean {
  return r.status !== "cancelled";
}

export interface BerthBooking {
  berthId: string;
  startDate: IsoDate;
  endDate: IsoDate;
}

/**
 * Existing reservations that clash with a proposed booking: same berth and
 * overlapping dates. Cancelled reservations are ignored, as is `excludeId`
 * (the reservation being edited, so it doesn't conflict with itself).
 * Results are sorted by start date.
 */
export function findReservationConflicts<R extends Reservation>(
  candidate: BerthBooking,
  existing: readonly R[],
  options: { excludeId?: string | null } = {},
): R[] {
  return existing
    .filter(
      (r) =>
        r.id !== options.excludeId &&
        occupiesBerth(r) &&
        r.berthId === candidate.berthId &&
        dateRangesOverlap(candidate.startDate, candidate.endDate, r.startDate, r.endDate),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// ---------------------------------------------------------------------------
// Alternatives
// ---------------------------------------------------------------------------

/**
 * Berths that can take the booking: long enough for the vessel (skipped for
 * events, i.e. vessel = null) and, when dates are given, free for the whole
 * range. Sorted smallest-first so the tightest fit is suggested before large
 * berths that bigger vessels may need.
 */
export function findSuitableBerths(
  vessel: Pick<Vessel, "name" | "loaFt"> | null,
  berths: readonly Berth[],
  reservations: readonly Reservation[] = [],
  range: { startDate: IsoDate; endDate: IsoDate } | null = null,
  options: { excludeId?: string | null } = {},
): Berth[] {
  return berths
    .filter((b) => (vessel ? canVesselFitBerth(vessel, b).fits : true))
    .filter(
      (b) =>
        !range ||
        findReservationConflicts({ berthId: b.id, ...range }, reservations, options).length === 0,
    )
    .sort((a, b) => a.lengthFt - b.lengthFt || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Full validation of a reservation request
// ---------------------------------------------------------------------------

export type ValidationField = "type" | "vesselId" | "eventName" | "berthId" | "startDate" | "endDate" | "status";

export type ValidationCode =
  | "MISSING_VESSEL"
  | "UNKNOWN_VESSEL"
  | "MISSING_EVENT_NAME"
  | "MISSING_BERTH"
  | "UNKNOWN_BERTH"
  | "MISSING_START_DATE"
  | "MISSING_END_DATE"
  | "INVALID_DATE"
  | "END_BEFORE_START"
  | "VESSEL_TOO_LONG"
  | "DATE_CONFLICT"
  | "INVALID_TYPE"
  | "INVALID_STATUS";

export interface ValidationError {
  field: ValidationField;
  code: ValidationCode;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** Null until both a vessel and a berth are known (always null for events). */
  fit: FitResult | null;
  /** Null until berth and a valid date range are known. */
  conflicts: Reservation[] | null;
  /** Berths that would work instead, when fit or availability fails. */
  alternatives: Berth[];
}

export interface ValidationContext {
  vessels: readonly Vessel[];
  berths: readonly Berth[];
  /** Existing reservations that may overlap the requested range. */
  reservations: readonly Reservation[];
  /** Id of the reservation being edited, if any. */
  excludeId?: string | null;
}

export function validateReservation(input: ReservationInput, ctx: ValidationContext): ValidationResult {
  const errors: ValidationError[] = [];
  const add = (field: ValidationField, code: ValidationCode, message: string) =>
    errors.push({ field, code, message });

  if (input.type !== "vessel" && input.type !== "event") {
    add("type", "INVALID_TYPE", "Choose a reservation type.");
  }
  if (!["confirmed", "tentative", "cancelled"].includes(input.status)) {
    add("status", "INVALID_STATUS", "Choose a valid status.");
  }

  // Who / what
  let vessel: Vessel | null = null;
  if (input.type === "vessel") {
    if (!input.vesselId) add("vesselId", "MISSING_VESSEL", "Select a vessel.");
    else {
      vessel = ctx.vessels.find((v) => v.id === input.vesselId) ?? null;
      if (!vessel) add("vesselId", "UNKNOWN_VESSEL", "The selected vessel no longer exists.");
    }
  } else if (input.type === "event" && !input.eventName?.trim()) {
    add("eventName", "MISSING_EVENT_NAME", "Enter an event name.");
  }

  // Where
  let berth: Berth | null = null;
  if (!input.berthId) add("berthId", "MISSING_BERTH", "Select a berth.");
  else {
    berth = ctx.berths.find((b) => b.id === input.berthId) ?? null;
    if (!berth) add("berthId", "UNKNOWN_BERTH", "The selected berth no longer exists.");
  }

  // When
  let range: { startDate: IsoDate; endDate: IsoDate } | null = null;
  const startOk = checkDate(input.startDate, "startDate", "start", add);
  const endOk = checkDate(input.endDate, "endDate", "end", add);
  if (startOk && endOk) {
    if (input.endDate! < input.startDate!) {
      add("endDate", "END_BEFORE_START", "End date cannot be before the start date.");
    } else {
      range = { startDate: input.startDate!, endDate: input.endDate! };
    }
  }

  // Rule 1 — vessel fit (events are exempt)
  let fit: FitResult | null = null;
  if (vessel && berth) {
    fit = canVesselFitBerth(vessel, berth);
    if (!fit.fits) add("berthId", "VESSEL_TOO_LONG", fit.message);
  }

  // Rule 2 — date conflicts (vessels and events alike). A cancelled
  // reservation doesn't occupy the berth, so it can't conflict.
  let conflicts: Reservation[] | null = null;
  if (berth && range) {
    conflicts =
      input.status === "cancelled"
        ? []
        : findReservationConflicts({ berthId: berth.id, ...range }, ctx.reservations, { excludeId: ctx.excludeId });
    for (const c of conflicts) {
      const existingLabel = reservationLabel(c, ctx.vessels.find((v) => v.id === c.vesselId));
      add(
        "berthId",
        "DATE_CONFLICT",
        `${berth.name} is unavailable: already reserved for ${existingLabel}, ${formatDateRange(c.startDate, c.endDate)}.`,
      );
    }
  }

  // Suggest alternatives when the chosen berth is the problem.
  const berthProblem = (fit && !fit.fits) || (conflicts !== null && conflicts.length > 0);
  const alternatives =
    berthProblem && (input.type === "event" || vessel)
      ? findSuitableBerths(vessel, ctx.berths, ctx.reservations, range, { excludeId: ctx.excludeId }).filter(
          (b) => b.id !== berth?.id,
        )
      : [];

  return { valid: errors.length === 0, errors, fit, conflicts, alternatives };
}

function checkDate(
  value: string | null,
  field: "startDate" | "endDate",
  word: string,
  add: (f: ValidationField, c: ValidationCode, m: string) => void,
): boolean {
  if (!value) {
    add(field, field === "startDate" ? "MISSING_START_DATE" : "MISSING_END_DATE", `Select a ${word} date.`);
    return false;
  }
  if (!isValidIsoDate(value)) {
    add(field, "INVALID_DATE", `The ${word} date is not a valid date.`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Whole-schedule audit (dashboard "data warnings")
// ---------------------------------------------------------------------------

export type ScheduleIssue =
  | { kind: "overlap"; berthId: string; a: Reservation; b: Reservation }
  | { kind: "too-long"; reservation: Reservation; fit: FitResult }
  | { kind: "missing-reference"; reservation: Reservation; detail: string };

/**
 * Re-checks every active reservation against the rules. New writes are
 * already validated (and guarded by database constraints), so this exists to
 * surface problems in imported legacy data or caused by later edits, e.g. a
 * berth's recorded length being reduced.
 */
export function detectScheduleIssues(
  reservations: readonly Reservation[],
  vessels: readonly Vessel[],
  berths: readonly Berth[],
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const active = reservations.filter(occupiesBerth);
  const vesselById = new Map(vessels.map((v) => [v.id, v]));
  const berthById = new Map(berths.map((b) => [b.id, b]));

  // Overlaps: sort per berth by start date and compare each booking with the
  // later ones that start before it ends.
  const byBerth = new Map<string, Reservation[]>();
  for (const r of active) byBerth.set(r.berthId, [...(byBerth.get(r.berthId) ?? []), r]);
  for (const [berthId, list] of byBerth) {
    list.sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && list[j].startDate <= list[i].endDate; j++) {
        issues.push({ kind: "overlap", berthId, a: list[i], b: list[j] });
      }
    }
  }

  for (const r of active) {
    const berth = berthById.get(r.berthId);
    if (!berth) {
      issues.push({ kind: "missing-reference", reservation: r, detail: "Berth not found" });
      continue;
    }
    if (r.type === "vessel") {
      const vessel = r.vesselId ? vesselById.get(r.vesselId) : undefined;
      if (!vessel) {
        issues.push({ kind: "missing-reference", reservation: r, detail: "Vessel not found" });
        continue;
      }
      const fit = canVesselFitBerth(vessel, berth);
      if (!fit.fits) issues.push({ kind: "too-long", reservation: r, fit });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function reservationLabel(r: Pick<Reservation, "type" | "eventName" | "vesselId">, vessel: Pick<Vessel, "name"> | null | undefined): string {
  if (r.type === "event") return r.eventName?.trim() || "Unnamed event";
  return vessel?.name ?? "Unknown vessel";
}

export function fmtFt(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ft`;
}
