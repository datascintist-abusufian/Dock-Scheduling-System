"use server";

import { revalidatePath } from "next/cache";
import { parseReservationInput } from "@/lib/domain/input";
import {
  checkReservation,
  deleteReservation,
  saveReservation,
  type CheckResult,
  type SaveResult,
} from "@/lib/services/reservations";

/**
 * Thin server-action layer: parse untrusted input, delegate to the service,
 * revalidate pages. No business rules live here.
 */

export async function checkReservationAction(raw: Record<string, unknown>, excludeId: string | null): Promise<CheckResult | { error: string }> {
  try {
    return await checkReservation(parseReservationInput(raw), excludeId);
  } catch (error) {
    console.error("[checkReservationAction]", error);
    return { error: "Couldn't check availability right now. Please try again." };
  }
}

export async function saveReservationAction(raw: Record<string, unknown>, id: string | null): Promise<SaveResult> {
  const result = await saveReservation(parseReservationInput(raw), id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteReservationAction(id: string) {
  const result = await deleteReservation(id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
