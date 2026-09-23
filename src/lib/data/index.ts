import "server-only";
import { MemoryRepository } from "./memory-repository";
import type { DockRepository } from "./repository";
import { SupabaseRepository } from "./supabase-repository";

export * from "./repository";

let instance: DockRepository | null = null;

/**
 * Returns the configured repository. Supabase is used when both env vars are
 * present; otherwise the seeded in-memory store ("demo mode").
 * The service-role key is only ever read on the server.
 */
export function getRepository(): DockRepository {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    instance = url && key ? new SupabaseRepository(url, key) : new MemoryRepository();
  }
  return instance;
}
