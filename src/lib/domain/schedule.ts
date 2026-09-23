/**
 * Pure helpers for laying out and summarising the schedule. Kept out of the
 * React components so they can be unit-tested.
 */

import { addDays, diffDays } from "./dates";
import { dateRangesOverlap, occupiesBerth } from "./rules";
import type { Berth, IsoDate, Reservation } from "./types";

export interface ScheduleWindow {
  start: IsoDate;
  days: number;
}

export function windowEnd(w: ScheduleWindow): IsoDate {
  return addDays(w.start, w.days - 1);
}

export interface PlacedBar<R extends Reservation> {
  reservation: R;
  /** 0-based column index of the first visible day. */
  column: number;
  /** Number of visible day columns. */
  span: number;
  /** Row within the berth; > 0 only when legacy data overlaps. */
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * Places the reservations of one berth onto the visible window: clips each to
 * the window and assigns lanes so that (should overlapping data exist) bars
 * stack instead of hiding each other.
 */
export function layoutBerthRow<R extends Reservation>(reservations: readonly R[], w: ScheduleWindow): { bars: PlacedBar<R>[]; lanes: number } {
  const end = windowEnd(w);
  const visible = reservations
    .filter((r) => occupiesBerth(r) && dateRangesOverlap(r.startDate, r.endDate, w.start, end))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate));

  const laneEnds: IsoDate[] = [];
  const bars = visible.map((r) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < r.startDate);
    if (lane === -1) lane = laneEnds.push(r.endDate) - 1;
    else laneEnds[lane] = r.endDate;

    const clippedStart = r.startDate < w.start ? w.start : r.startDate;
    const clippedEnd = r.endDate > end ? end : r.endDate;
    return {
      reservation: r,
      column: diffDays(w.start, clippedStart),
      span: diffDays(clippedStart, clippedEnd) + 1,
      lane,
      continuesBefore: r.startDate < w.start,
      continuesAfter: r.endDate > end,
    };
  });
  return { bars, lanes: Math.max(1, laneEnds.length) };
}

/** Active reservations occupying any berth on `date`. */
export function reservationsOn<R extends Reservation>(reservations: readonly R[], date: IsoDate): R[] {
  return reservations.filter((r) => occupiesBerth(r) && r.startDate <= date && r.endDate >= date);
}

export function berthOccupancyOn(berths: readonly Berth[], reservations: readonly Reservation[], date: IsoDate) {
  const today = reservationsOn(reservations, date);
  const occupiedIds = new Set(today.map((r) => r.berthId));
  return {
    occupied: berths.filter((b) => occupiedIds.has(b.id)),
    available: berths.filter((b) => !occupiedIds.has(b.id)),
  };
}
