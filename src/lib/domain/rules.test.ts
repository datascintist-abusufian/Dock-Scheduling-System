import { describe, expect, it } from "vitest";
import {
  canVesselFitBerth,
  dateRangesOverlap,
  detectScheduleIssues,
  findReservationConflicts,
  findSuitableBerths,
  validateReservation,
} from "./rules";
import type { Berth, Reservation, ReservationInput, Vessel } from "./types";

// --- fixtures (capacities from the supplied workbook) -----------------------

const berth = (id: string, name: string, lengthFt: number): Berth => ({ id, name, lengthFt });
const NPW = berth("npw", "North Pier West", 410);
const NPF = berth("npf", "North Pier Face", 75);
const NPE = berth("npe", "North Pier East", 240);
const IC = berth("ic", "Inner Channel", 55);
const SFW = berth("sfw", "South Float West", 90);
const SFE = berth("sfe", "South Float East", 90);
const BERTHS = [NPW, NPF, NPE, IC, SFW, SFE];

const vessel = (id: string, name: string, loaFt: number): Vessel => ({
  id,
  name,
  loaFt,
  operator: "Test",
  draftFt: null,
  contactName: null,
  phone: null,
  email: null,
  notes: null,
});
const HIGH_DRIFT = vessel("hd", "R/V High Drift", 120);
const IRON_SKUA = vessel("is", "R/V Iron Skua", 72);
const BRIGHT_DORY = vessel("bd", "R/V Bright Dory", 52);
const VESSELS = [HIGH_DRIFT, IRON_SKUA, BRIGHT_DORY];

let seq = 0;
const res = (berthId: string, startDate: string, endDate: string, extra: Partial<Reservation> = {}): Reservation => ({
  id: `r${++seq}`,
  type: "vessel",
  vesselId: IRON_SKUA.id,
  eventName: null,
  berthId,
  startDate,
  endDate,
  notes: null,
  status: "confirmed",
  ...extra,
});

// Existing booking used by the conflict tests: 10–15 June (inclusive).
const EXISTING = res("sfw", "2019-06-10", "2019-06-15");
const conflictsFor = (start: string, end: string, berthId = "sfw") =>
  findReservationConflicts({ berthId, startDate: start, endDate: end }, [EXISTING]);

// --- Rule 1: berth fit -------------------------------------------------------

describe("canVesselFitBerth", () => {
  it("vessel shorter than berth → valid", () => {
    const r = canVesselFitBerth(BRIGHT_DORY, IC); // 52 ≤ 55
    expect(r.fits).toBe(true);
    expect(r.marginFt).toBe(3);
  });

  it("vessel equal to berth → valid", () => {
    expect(canVesselFitBerth(vessel("x", "Exact", 75), NPF).fits).toBe(true);
  });

  it("vessel longer than berth → invalid, with an actionable message", () => {
    const r = canVesselFitBerth(HIGH_DRIFT, NPF); // 120 > 75
    expect(r.fits).toBe(false);
    expect(r.marginFt).toBe(-45);
    expect(r.message).toBe(
      "R/V High Drift is 120 ft long. North Pier Face supports vessels up to 75 ft. Select another berth.",
    );
  });
});

// --- Rule 2: date conflicts --------------------------------------------------

describe("findReservationConflicts (inclusive date ranges)", () => {
  it("non-overlapping reservations → valid", () => {
    expect(conflictsFor("2019-06-20", "2019-06-25")).toEqual([]);
    expect(conflictsFor("2019-06-01", "2019-06-05")).toEqual([]);
  });

  it("partially overlapping (start inside existing) → conflict", () => {
    expect(conflictsFor("2019-06-14", "2019-06-20")).toEqual([EXISTING]);
  });

  it("partially overlapping (end inside existing) → conflict", () => {
    expect(conflictsFor("2019-06-05", "2019-06-10")).toEqual([EXISTING]);
  });

  it("contained reservation → conflict", () => {
    expect(conflictsFor("2019-06-11", "2019-06-12")).toEqual([EXISTING]);
  });

  it("containing reservation → conflict", () => {
    expect(conflictsFor("2019-06-01", "2019-06-30")).toEqual([EXISTING]);
  });

  it("same dates → conflict", () => {
    expect(conflictsFor("2019-06-10", "2019-06-15")).toEqual([EXISTING]);
  });

  it("adjacent reservation (starts the day after existing ends) → valid", () => {
    expect(conflictsFor("2019-06-16", "2019-06-20")).toEqual([]);
    expect(conflictsFor("2019-06-05", "2019-06-09")).toEqual([]);
  });

  it("same-day turnover (starts on the day existing ends) → conflict, because end dates are inclusive", () => {
    expect(conflictsFor("2019-06-15", "2019-06-18")).toEqual([EXISTING]);
  });

  it("different berth, same dates → valid", () => {
    expect(conflictsFor("2019-06-10", "2019-06-15", "sfe")).toEqual([]);
  });

  it("ignores cancelled reservations", () => {
    const cancelled = res("sfw", "2019-06-10", "2019-06-15", { status: "cancelled" });
    expect(findReservationConflicts({ berthId: "sfw", startDate: "2019-06-12", endDate: "2019-06-12" }, [cancelled])).toEqual([]);
  });

  it("ignores the reservation being edited", () => {
    expect(
      findReservationConflicts({ berthId: "sfw", startDate: "2019-06-11", endDate: "2019-06-16" }, [EXISTING], {
        excludeId: EXISTING.id,
      }),
    ).toEqual([]);
  });

  it("dateRangesOverlap is symmetric", () => {
    expect(dateRangesOverlap("2019-01-01", "2019-01-05", "2019-01-05", "2019-01-09")).toBe(true);
    expect(dateRangesOverlap("2019-01-05", "2019-01-09", "2019-01-01", "2019-01-05")).toBe(true);
  });
});

// --- Rule 3: events ----------------------------------------------------------

describe("events", () => {
  const sailDay: ReservationInput = {
    type: "event",
    vesselId: null,
    eventName: "Community Sail Day",
    berthId: "sfw",
    startDate: "2019-07-13",
    endDate: "2019-07-13",
    notes: null,
    status: "confirmed",
  };
  const ctx = { vessels: VESSELS, berths: BERTHS, reservations: [] as Reservation[] };

  it("do not require vessel-length validation", () => {
    const r = validateReservation({ ...sailDay, berthId: "ic" }, ctx);
    expect(r.valid).toBe(true);
    expect(r.fit).toBeNull();
  });

  it("still conflict with vessel reservations on the same berth", () => {
    const r = validateReservation(sailDay, { ...ctx, reservations: [res("sfw", "2019-07-10", "2019-07-14")] });
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("DATE_CONFLICT");
  });

  it("block later vessel reservations", () => {
    const event = res("sfw", "2019-07-13", "2019-07-13", { type: "event", vesselId: null, eventName: "Community Sail Day" });
    const r = validateReservation(
      { ...sailDay, type: "vessel", vesselId: IRON_SKUA.id, eventName: null },
      { ...ctx, reservations: [event] },
    );
    expect(r.errors.find((e) => e.code === "DATE_CONFLICT")?.message).toContain("Community Sail Day");
  });

  it("require an event name", () => {
    const r = validateReservation({ ...sailDay, eventName: "   " }, ctx);
    expect(r.errors.map((e) => e.code)).toEqual(["MISSING_EVENT_NAME"]);
  });
});

// --- Alternatives ------------------------------------------------------------

describe("findSuitableBerths", () => {
  it("returns only berths long enough, smallest first", () => {
    expect(findSuitableBerths(HIGH_DRIFT, BERTHS).map((b) => b.id)).toEqual(["npe", "npw"]);
    expect(findSuitableBerths(IRON_SKUA, BERTHS).map((b) => b.id)).toEqual(["npf", "sfe", "sfw", "npe", "npw"]);
  });

  it("excludes berths that are booked for the requested dates", () => {
    const booked = res("npe", "2019-06-01", "2019-06-30");
    expect(
      findSuitableBerths(HIGH_DRIFT, BERTHS, [booked], { startDate: "2019-06-10", endDate: "2019-06-12" }).map((b) => b.id),
    ).toEqual(["npw"]);
  });

  it("considers every berth for events", () => {
    expect(findSuitableBerths(null, BERTHS)).toHaveLength(BERTHS.length);
  });
});

// --- validateReservation -----------------------------------------------------

describe("validateReservation", () => {
  const base: ReservationInput = {
    type: "vessel",
    vesselId: HIGH_DRIFT.id,
    eventName: null,
    berthId: NPW.id,
    startDate: "2019-06-03",
    endDate: "2019-06-21",
    notes: null,
    status: "confirmed",
  };
  const ctx = { vessels: VESSELS, berths: BERTHS, reservations: [] as Reservation[] };
  const codes = (input: Partial<ReservationInput>, c = ctx) => validateReservation({ ...base, ...input }, c).errors.map((e) => e.code);

  it("accepts a valid reservation", () => {
    const r = validateReservation(base, ctx);
    expect(r.valid).toBe(true);
    expect(r.fit?.fits).toBe(true);
    expect(r.conflicts).toEqual([]);
  });

  it("rejects end date before start date", () => {
    expect(codes({ startDate: "2019-06-10", endDate: "2019-06-09" })).toEqual(["END_BEFORE_START"]);
  });

  it("accepts a single-day reservation", () => {
    expect(codes({ startDate: "2019-06-10", endDate: "2019-06-10" })).toEqual([]);
  });

  it("rejects missing vessel, berth and dates", () => {
    expect(codes({ vesselId: null, berthId: null, startDate: null, endDate: null })).toEqual([
      "MISSING_VESSEL",
      "MISSING_BERTH",
      "MISSING_START_DATE",
      "MISSING_END_DATE",
    ]);
  });

  it("rejects impossible dates", () => {
    expect(codes({ startDate: "2019-02-30" })).toEqual(["INVALID_DATE"]);
  });

  it("rejects an unknown vessel or berth", () => {
    expect(codes({ vesselId: "nope", berthId: "nope" })).toEqual(["UNKNOWN_VESSEL", "UNKNOWN_BERTH"]);
  });

  it("rejects a vessel that is too long and suggests alternatives", () => {
    const r = validateReservation({ ...base, berthId: NPF.id }, ctx);
    expect(r.errors.map((e) => e.code)).toEqual(["VESSEL_TOO_LONG"]);
    expect(r.alternatives.map((b) => b.id)).toEqual(["npe", "npw"]);
  });

  it("rejects an overlap, names the existing reservation, and suggests free berths", () => {
    const existing = res(NPW.id, "2019-06-15", "2019-06-30", { vesselId: IRON_SKUA.id });
    const r = validateReservation(base, { ...ctx, reservations: [existing] });
    expect(r.valid).toBe(false);
    expect(r.conflicts).toEqual([existing]);
    expect(r.errors[0].message).toContain("R/V Iron Skua");
    expect(r.alternatives.map((b) => b.id)).toEqual(["npe"]);
  });

  it("allows editing a reservation without conflicting with itself", () => {
    const existing = res(NPW.id, "2019-06-03", "2019-06-21", { vesselId: HIGH_DRIFT.id });
    expect(codes({}, { ...ctx, reservations: [existing], excludeId: existing.id } as typeof ctx)).toEqual([]);
  });
});

// --- Audit -------------------------------------------------------------------

describe("detectScheduleIssues", () => {
  it("reports overlaps and oversize vessels in existing data", () => {
    const a = res("npf", "2004-05-01", "2004-05-10", { vesselId: IRON_SKUA.id });
    const b = res("npf", "2004-05-08", "2004-05-12", { vesselId: HIGH_DRIFT.id });
    const issues = detectScheduleIssues([a, b], VESSELS, BERTHS);
    expect(issues.map((i) => i.kind).sort()).toEqual(["overlap", "too-long"]);
  });

  it("reports nothing for a clean schedule", () => {
    const a = res("npf", "2004-05-01", "2004-05-10");
    const b = res("npf", "2004-05-11", "2004-05-12");
    expect(detectScheduleIssues([a, b], VESSELS, BERTHS)).toEqual([]);
  });
});
