import type { IsoDate } from "./types";

/**
 * Calendar-date helpers. All arithmetic is done in UTC on "YYYY-MM-DD"
 * strings so results never shift with the server's or browser's timezone.
 * ISO dates compare correctly as plain strings, which the rules rely on.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isValidIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Number of calendar days a reservation occupies (inclusive range). */
export function nightsOrDays(start: IsoDate, end: IsoDate): number {
  return diffDays(start, end) + 1;
}

export function eachDay(start: IsoDate, count: number): IsoDate[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function isWeekend(date: IsoDate): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

/** Today's date at the facility (configurable; defaults to UTC). */
export function todayIso(timeZone = process.env.NEXT_PUBLIC_FACILITY_TIME_ZONE || "UTC"): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const fmtLong = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmtShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const fmtMonth = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export const formatDate = (d: IsoDate) => fmtLong.format(new Date(toUtc(d)));
export const formatShortDate = (d: IsoDate) => fmtShort.format(new Date(toUtc(d)));
export const formatWeekday = (d: IsoDate) => fmtWeekday.format(new Date(toUtc(d)));
export const formatMonth = (d: IsoDate) => fmtMonth.format(new Date(toUtc(d)));

export function formatDateRange(start: IsoDate, end: IsoDate): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}
