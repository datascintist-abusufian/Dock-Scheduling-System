/**
 * Representative records normalised from the supplied workbook
 * (annual schedules 1997–2019 plus vessel information sheets).
 *
 * The workbook is semi-structured: berths are rows, days are columns, and a
 * booking is free text typed into consecutive cells, with inconsistent vessel
 * naming and occasional merged cells. Rather than attempt a lossy automatic
 * import, this prototype seeds a small, hand-normalised set:
 *   - the six berths and their capacities as recorded in the workbook
 *   - vessels named in the workbook (contact details are placeholders)
 *   - a few historical bookings in the style of the source sheets
 *   - a handful of bookings relative to "today" so the dashboard and
 *     schedule have something live to show during a demo
 *
 * supabase/seed.sql contains the same records for PostgreSQL.
 */

import { addDays } from "@/lib/domain/dates";
import type { Berth, IsoDate, Reservation, Vessel } from "@/lib/domain/types";

export const SEED_BERTHS: Berth[] = [
  { id: "berth-npw", name: "North Pier West", lengthFt: 410 },
  { id: "berth-npf", name: "North Pier Face", lengthFt: 75 },
  { id: "berth-npe", name: "North Pier East", lengthFt: 240 },
  { id: "berth-ic", name: "Inner Channel", lengthFt: 55 },
  { id: "berth-sfw", name: "South Float West", lengthFt: 90 },
  { id: "berth-sfe", name: "South Float East", lengthFt: 90 },
];

const v = (
  id: string,
  name: string,
  operator: string,
  loaFt: number,
  draftFt: number | null,
  contactName: string,
  phone: string,
  email: string,
  notes: string | null = null,
): Vessel => ({ id, name, operator, loaFt, draftFt, contactName, phone, email, notes });

export const SEED_VESSELS: Vessel[] = [
  v("vessel-high-drift", "R/V High Drift", "Oceanographic Institute", 120, 11.5, "Marine Operations Desk", "555-0101", "ops@high-drift.example.org", "Regional-class research vessel. Requires North Pier West or East."),
  v("vessel-iron-skua", "R/V Iron Skua", "University Marine Lab", 72, 7, "Vessel Coordinator", "555-0102", "skua@marinelab.example.edu"),
  v("vessel-bright-dory", "R/V Bright Dory", "Coastal Survey Programme", 52, 5, "Survey Coordinator", "555-0103", "dory@coastalsurvey.example.org"),
  v("vessel-wild-marlin", "R/V Wild Marlin", "Facility Research Fleet", 32, 3.5, "Small Boats Office", "555-0104", "smallboats@facility.example.org", "Facility-owned. Long-term berth holder."),
  v("vessel-northern-tern", "S/Y Northern Tern", "Private owner", 46, 6.5, "Owner", "555-0105", "tern@example.com", "Visiting yacht."),
  v("vessel-kelp-runner", "M/V Kelp Runner", "Kelp Ecology Group", 64, 5.5, "Field Logistics", "555-0106", "logistics@kelp.example.org"),
];

type SeedRow = Omit<Reservation, "id" | "status" | "notes"> & { status?: Reservation["status"]; notes?: string | null };

const vesselRes = (vesselId: string, berthId: string, startDate: IsoDate, endDate: IsoDate, extra: Partial<SeedRow> = {}): SeedRow => ({
  type: "vessel",
  vesselId,
  eventName: null,
  berthId,
  startDate,
  endDate,
  ...extra,
});

const eventRes = (eventName: string, berthId: string, startDate: IsoDate, endDate: IsoDate, notes?: string): SeedRow => ({
  type: "event",
  vesselId: null,
  eventName,
  berthId,
  startDate,
  endDate,
  notes,
});

/** Historical examples in the style of the source sheets. */
const HISTORICAL: SeedRow[] = [
  vesselRes("vessel-high-drift", "berth-npw", "1997-08-04", "1997-08-15", { notes: "From 1997 sheet." }),
  vesselRes("vessel-wild-marlin", "berth-sfw", "2019-05-01", "2019-09-30", { notes: "Seasonal berth, 2019 sheet." }),
  vesselRes("vessel-high-drift", "berth-npw", "2019-06-03", "2019-06-21", { notes: "2019 sheet." }),
  vesselRes("vessel-iron-skua", "berth-npf", "2019-06-10", "2019-06-14", { notes: "2019 sheet." }),
  vesselRes("vessel-bright-dory", "berth-ic", "2019-07-01", "2019-07-19", { notes: "2019 sheet." }),
  eventRes("Community Sail Day", "berth-sfe", "2019-07-13", "2019-07-13", "2019 sheet. Non-vessel event."),
];

/** Current bookings, positioned relative to today (offset in days). */
function currentSeason(today: IsoDate): SeedRow[] {
  const d = (offset: number) => addDays(today, offset);
  return [
    vesselRes("vessel-high-drift", "berth-npw", d(-5), d(9), { notes: "Mid-cruise port call; shore power requested." }),
    vesselRes("vessel-iron-skua", "berth-npf", d(-2), d(3)),
    vesselRes("vessel-wild-marlin", "berth-sfw", d(-30), d(45), { notes: "Seasonal berth." }),
    vesselRes("vessel-bright-dory", "berth-ic", d(1), d(12)),
    eventRes("Community Sail Day", "berth-sfe", d(4), d(4), "Public event. Float closed to vessel traffic."),
    vesselRes("vessel-northern-tern", "berth-sfe", d(6), d(13), { status: "tentative", notes: "Awaiting arrival confirmation." }),
    vesselRes("vessel-kelp-runner", "berth-npf", d(5), d(11)),
    vesselRes("vessel-iron-skua", "berth-npe", d(8), d(18), { notes: "Gear load-out before survey leg." }),
  ];
}

export function buildSeedReservations(today: IsoDate): Reservation[] {
  return [...HISTORICAL, ...currentSeason(today)].map((row, i) => ({
    id: `res-${String(i + 1).padStart(3, "0")}`,
    notes: null,
    status: "confirmed",
    ...row,
  }));
}
