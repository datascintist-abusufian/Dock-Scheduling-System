import type { Berth, IsoDate, Reservation, Vessel } from "@/lib/domain/types";

/**
 * Persistence boundary. The app talks to this interface only; there are two
 * implementations:
 *   - SupabaseRepository  (PostgreSQL, used when Supabase env vars are set)
 *   - MemoryRepository    (seeded in-memory store for demos and local dev)
 */

export type NewReservation = Omit<Reservation, "id">;

export interface ReservationFilter {
  /** Only reservations overlapping [from, to] (inclusive). */
  from?: IsoDate;
  to?: IsoDate;
  berthId?: string;
  vesselId?: string;
  includeCancelled?: boolean;
}

export interface DockRepository {
  readonly mode: "supabase" | "memory";
  listBerths(): Promise<Berth[]>;
  listVessels(): Promise<Vessel[]>;
  getVessel(id: string): Promise<Vessel | null>;
  listReservations(filter?: ReservationFilter): Promise<Reservation[]>;
  getReservation(id: string): Promise<Reservation | null>;
  createReservation(data: NewReservation): Promise<Reservation>;
  updateReservation(id: string, data: NewReservation): Promise<Reservation>;
  deleteReservation(id: string): Promise<void>;
}

// Errors raised by repositories. The database enforces the core rules too
// (exclusion constraint + fit trigger), so a write that races past the
// application-level check still fails safely with one of these.

export class ReservationConflictError extends Error {
  constructor(message = "The berth was booked by someone else for overlapping dates. Refresh and try again.") {
    super(message);
    this.name = "ReservationConflictError";
  }
}

export class VesselTooLongError extends Error {
  constructor(message = "The vessel is longer than the berth.") {
    super(message);
    this.name = "VesselTooLongError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Record not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class DatabaseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
  }
}
