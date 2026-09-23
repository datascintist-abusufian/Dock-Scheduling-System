/**
 * Core domain types.
 *
 * Dates are ISO calendar dates ("YYYY-MM-DD") with no time component. A
 * reservation occupies its berth on every day from startDate to endDate
 * INCLUSIVE — see dates.ts and rules.ts for the consequences of that choice.
 */

export type IsoDate = string;

export interface Berth {
  id: string;
  name: string;
  lengthFt: number;
}

export interface Vessel {
  id: string;
  name: string;
  operator: string;
  loaFt: number;
  draftFt: number | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export const RESERVATION_TYPES = ["vessel", "event"] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];

export const RESERVATION_STATUSES = ["confirmed", "tentative", "cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface Reservation {
  id: string;
  type: ReservationType;
  vesselId: string | null;
  eventName: string | null;
  berthId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  notes: string | null;
  status: ReservationStatus;
}

/** What a user submits when creating or editing a reservation. */
export interface ReservationInput {
  type: ReservationType;
  vesselId: string | null;
  eventName: string | null;
  berthId: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  notes: string | null;
  status: ReservationStatus;
}

/** A reservation joined with the records needed to display it. */
export interface ReservationView extends Reservation {
  berth: Berth;
  vessel: Vessel | null;
  label: string;
}
