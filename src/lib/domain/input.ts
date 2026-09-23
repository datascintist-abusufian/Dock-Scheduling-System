import { RESERVATION_STATUSES, type ReservationInput, type ReservationStatus } from "./types";

/**
 * Normalises untrusted form input (FormData entries or a JSON object) into a
 * ReservationInput. It does not validate business rules — that's
 * validateReservation — it only trims strings, turns blanks into null and
 * drops fields that don't apply to the reservation type.
 */
export function parseReservationInput(raw: Record<string, unknown>): ReservationInput {
  const str = (key: string): string | null => {
    const value = raw[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const type = str("type") === "event" ? "event" : "vessel";
  const status = (RESERVATION_STATUSES as readonly string[]).includes(str("status") ?? "")
    ? (str("status") as ReservationStatus)
    : "confirmed";

  return {
    type,
    vesselId: type === "vessel" ? str("vesselId") : null,
    eventName: type === "event" ? str("eventName") : null,
    berthId: str("berthId"),
    startDate: str("startDate"),
    endDate: str("endDate"),
    notes: str("notes"),
    status,
  };
}
