import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import type { Berth, Reservation, Vessel } from "@/lib/domain/types";
import {
  DatabaseError,
  type DockRepository,
  type NewReservation,
  NotFoundError,
  ReservationConflictError,
  type ReservationFilter,
  VesselTooLongError,
} from "./repository";

// --- row shapes (snake_case, as stored) -------------------------------------

interface BerthRow {
  id: string;
  name: string;
  length_ft: number | string;
}
interface VesselRow {
  id: string;
  name: string;
  operator: string;
  loa_ft: number | string;
  draft_ft: number | string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}
interface ReservationRow {
  id: string;
  type: Reservation["type"];
  vessel_id: string | null;
  event_name: string | null;
  berth_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  status: Reservation["status"];
}

// numeric columns come back as strings from PostgREST
const num = (x: number | string) => Number(x);

const toBerth = (r: BerthRow): Berth => ({ id: r.id, name: r.name, lengthFt: num(r.length_ft) });
const toVessel = (r: VesselRow): Vessel => ({
  id: r.id,
  name: r.name,
  operator: r.operator,
  loaFt: num(r.loa_ft),
  draftFt: r.draft_ft === null ? null : num(r.draft_ft),
  contactName: r.contact_name,
  phone: r.phone,
  email: r.email,
  notes: r.notes,
});
const toReservation = (r: ReservationRow): Reservation => ({
  id: r.id,
  type: r.type,
  vesselId: r.vessel_id,
  eventName: r.event_name,
  berthId: r.berth_id,
  startDate: r.start_date,
  endDate: r.end_date,
  notes: r.notes,
  status: r.status,
});
const fromReservation = (r: NewReservation): Omit<ReservationRow, "id"> => ({
  type: r.type,
  vessel_id: r.vesselId,
  event_name: r.eventName,
  berth_id: r.berthId,
  start_date: r.startDate,
  end_date: r.endDate,
  notes: r.notes,
  status: r.status,
});

/** Translate PostgreSQL errors raised by our constraints into domain errors. */
function mapError(error: PostgrestError, action: string): Error {
  if (error.code === "23P01") return new ReservationConflictError(); // exclusion_violation
  if (error.message?.includes("VESSEL_EXCEEDS_BERTH")) return new VesselTooLongError();
  console.error(`[supabase] ${action} failed`, error);
  return new DatabaseError(`Database error while trying to ${action}. Please try again.`, error);
}

export class SupabaseRepository implements DockRepository {
  readonly mode = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }

  async listBerths() {
    const { data, error } = await this.db.from("berths").select("*").order("name");
    if (error) throw mapError(error, "load berths");
    return (data as BerthRow[]).map(toBerth);
  }

  async listVessels() {
    const { data, error } = await this.db.from("vessels").select("*").order("name");
    if (error) throw mapError(error, "load vessels");
    return (data as VesselRow[]).map(toVessel);
  }

  async getVessel(id: string) {
    const { data, error } = await this.db.from("vessels").select("*").eq("id", id).maybeSingle();
    if (error) throw mapError(error, "load the vessel");
    return data ? toVessel(data as VesselRow) : null;
  }

  async listReservations(filter: ReservationFilter = {}) {
    let q = this.db.from("reservations").select("*").order("start_date");
    // Inclusive overlap with [from, to]: start_date <= to AND end_date >= from
    if (filter.to) q = q.lte("start_date", filter.to);
    if (filter.from) q = q.gte("end_date", filter.from);
    if (filter.berthId) q = q.eq("berth_id", filter.berthId);
    if (filter.vesselId) q = q.eq("vessel_id", filter.vesselId);
    if (!filter.includeCancelled) q = q.neq("status", "cancelled");
    const { data, error } = await q;
    if (error) throw mapError(error, "load reservations");
    return (data as ReservationRow[]).map(toReservation);
  }

  async getReservation(id: string) {
    const { data, error } = await this.db.from("reservations").select("*").eq("id", id).maybeSingle();
    if (error) throw mapError(error, "load the reservation");
    return data ? toReservation(data as ReservationRow) : null;
  }

  async createReservation(input: NewReservation) {
    const { data, error } = await this.db.from("reservations").insert(fromReservation(input)).select().single();
    if (error) throw mapError(error, "save the reservation");
    return toReservation(data as ReservationRow);
  }

  async updateReservation(id: string, input: NewReservation) {
    const { data, error } = await this.db
      .from("reservations")
      .update(fromReservation(input))
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw mapError(error, "update the reservation");
    if (!data) throw new NotFoundError("Reservation not found.");
    return toReservation(data as ReservationRow);
  }

  async deleteReservation(id: string) {
    const { data, error } = await this.db.from("reservations").delete().eq("id", id).select("id");
    if (error) throw mapError(error, "delete the reservation");
    if (!data?.length) throw new NotFoundError("Reservation not found.");
  }
}
