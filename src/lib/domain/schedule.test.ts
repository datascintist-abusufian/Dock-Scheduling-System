import { describe, expect, it } from "vitest";
import { addDays, diffDays, isValidIsoDate } from "./dates";
import { berthOccupancyOn, layoutBerthRow } from "./schedule";
import type { Reservation } from "./types";

const r = (id: string, startDate: string, endDate: string, status: Reservation["status"] = "confirmed"): Reservation => ({
  id,
  type: "vessel",
  vesselId: "v",
  eventName: null,
  berthId: "b",
  startDate,
  endDate,
  notes: null,
  status,
});

describe("dates", () => {
  it("handles month and leap-year boundaries", () => {
    expect(addDays("2020-02-28", 1)).toBe("2020-02-29");
    expect(addDays("2019-12-31", 1)).toBe("2020-01-01");
    expect(diffDays("2019-03-30", "2019-04-02")).toBe(3);
  });
  it("validates ISO dates", () => {
    expect(isValidIsoDate("2019-06-10")).toBe(true);
    expect(isValidIsoDate("2019-13-01")).toBe(false);
    expect(isValidIsoDate("10/06/2019")).toBe(false);
  });
});

describe("layoutBerthRow", () => {
  const window = { start: "2019-06-10", days: 7 }; // 10–16 June

  it("clips bars to the visible window", () => {
    const { bars } = layoutBerthRow([r("a", "2019-06-01", "2019-06-12"), r("b", "2019-06-15", "2019-06-30")], window);
    expect(bars.map(({ column, span, continuesBefore, continuesAfter }) => ({ column, span, continuesBefore, continuesAfter }))).toEqual([
      { column: 0, span: 3, continuesBefore: true, continuesAfter: false },
      { column: 5, span: 2, continuesBefore: false, continuesAfter: true },
    ]);
  });

  it("keeps adjacent bookings in one lane and stacks overlapping legacy data", () => {
    expect(layoutBerthRow([r("a", "2019-06-10", "2019-06-11"), r("b", "2019-06-12", "2019-06-13")], window).lanes).toBe(1);
    expect(layoutBerthRow([r("a", "2019-06-10", "2019-06-12"), r("b", "2019-06-12", "2019-06-13")], window).lanes).toBe(2);
  });

  it("hides cancelled and out-of-window reservations", () => {
    expect(layoutBerthRow([r("a", "2019-06-11", "2019-06-12", "cancelled"), r("b", "2019-07-01", "2019-07-02")], window).bars).toEqual([]);
  });
});

describe("berthOccupancyOn", () => {
  it("splits berths into occupied and available", () => {
    const berths = [{ id: "b", name: "B", lengthFt: 90 }, { id: "c", name: "C", lengthFt: 90 }];
    const { occupied, available } = berthOccupancyOn(berths, [r("a", "2019-06-10", "2019-06-12")], "2019-06-12");
    expect(occupied.map((b) => b.id)).toEqual(["b"]);
    expect(available.map((b) => b.id)).toEqual(["c"]);
  });
});
