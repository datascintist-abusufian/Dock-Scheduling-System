import { todayIso } from "@/lib/domain/dates";
import { canVesselFitBerth, dateRangesOverlap, findReservationConflicts } from "@/lib/domain/rules";
import type { Berth, Reservation, Vessel } from "@/lib/domain/types";
import {
  type DockRepository,
  type NewReservation,
  NotFoundError,
  ReservationConflictError,
  type ReservationFilter,
  VesselTooLongError,
} from "./repository";
import { buildSeedReservations, SEED_BERTHS, SEED_VESSELS } from "./seed";

/**
 * In-memory repository used when Supabase isn't configured.
 *
 * It mirrors the database's guarantees (no overlapping active reservations
 * per berth; vessel must fit berth) so behaviour is identical in both modes.
 * State lives for the lifetime of the server process only — on serverless
 * hosting each instance has its own copy, so use Supabase for real use.
 */

interface Store {
  berths: Berth[];
  vessels: Vessel[];
  reservations: Reservation[];
  nextId: number;
}

const globalForStore = globalThis as unknown as { __dockStore?: Store };

function store(): Store {
  if (!globalForStore.__dockStore) {
    const reservations = buildSeedReservations(todayIso());
    globalForStore.__dockStore = {
      berths: structuredClone(SEED_BERTHS),
      vessels: structuredClone(SEED_VESSELS),
      reservations,
      nextId: reservations.length + 1,
    };
  }
  return globalForStore.__dockStore;
}

export class MemoryRepository implements DockRepository {
  readonly mode = "memory" as const;

  async listBerths() {
    return [...store().berths];
  }

  async listVessels() {
    return [...store().vessels].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getVessel(id: string) {
    return store().vessels.find((v) => v.id === id) ?? null;
  }

  async listReservations(filter: ReservationFilter = {}) {
    return store()
      .reservations.filter(
        (r) =>
          (filter.includeCancelled || r.status !== "cancelled") &&
          (!filter.berthId || r.berthId === filter.berthId) &&
          (!filter.vesselId || r.vesselId === filter.vesselId) &&
          dateRangesOverlap(r.startDate, r.endDate, filter.from ?? "0000-01-01", filter.to ?? "9999-12-31"),
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async getReservation(id: string) {
    return store().reservations.find((r) => r.id === id) ?? null;
  }

  async createReservation(data: NewReservation) {
    const s = store();
    this.enforceConstraints(data, null);
    const created: Reservation = { ...data, id: `res-${String(s.nextId++).padStart(3, "0")}` };
    s.reservations.push(created);
    return created;
  }

  async updateReservation(id: string, data: NewReservation) {
    const s = store();
    const index = s.reservations.findIndex((r) => r.id === id);
    if (index === -1) throw new NotFoundError("Reservation not found.");
    this.enforceConstraints(data, id);
    const updated: Reservation = { ...data, id };
    s.reservations[index] = updated;
    return updated;
  }

  async deleteReservation(id: string) {
    const s = store();
    const before = s.reservations.length;
    s.reservations = s.reservations.filter((r) => r.id !== id);
    if (s.reservations.length === before) throw new NotFoundError("Reservation not found.");
  }

  /** Equivalent of the PostgreSQL exclusion constraint and fit trigger. */
  private enforceConstraints(data: NewReservation, excludeId: string | null) {
    const s = store();
    if (data.status !== "cancelled" && findReservationConflicts(data, s.reservations, { excludeId }).length > 0) {
      throw new ReservationConflictError();
    }
    if (data.type === "vessel") {
      const vessel = s.vessels.find((v) => v.id === data.vesselId);
      const berth = s.berths.find((b) => b.id === data.berthId);
      if (!vessel || !berth) throw new NotFoundError("Vessel or berth not found.");
      if (!canVesselFitBerth(vessel, berth).fits) throw new VesselTooLongError();
    }
  }
}
