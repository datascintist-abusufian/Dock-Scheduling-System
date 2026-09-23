import type { Metadata } from "next";
import { ReservationForm } from "@/components/ReservationForm";
import { PageHeader } from "@/components/ui";
import { isValidIsoDate } from "@/lib/domain/dates";
import { loadReferenceData } from "@/lib/services/reservations";

export const metadata: Metadata = { title: "New reservation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewReservationPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const { berths, vessels } = await loadReferenceData();

  // Allow prefilling from links, e.g. "Book this vessel" or clicking an empty day.
  const start = isValidIsoDate(param("start")) ? param("start") : "";
  return (
    <>
      <PageHeader title="New reservation" subtitle="Berth fit and availability are checked automatically as you fill in the form." />
      <ReservationForm
        berths={berths}
        vessels={vessels}
        reservationId={null}
        initial={{
          type: param("type") === "event" ? "event" : "vessel",
          vesselId: vessels.some((v) => v.id === param("vesselId")) ? param("vesselId") : "",
          eventName: "",
          berthId: berths.some((b) => b.id === param("berthId")) ? param("berthId") : "",
          startDate: start,
          endDate: start,
          notes: "",
          status: "confirmed",
        }}
      />
    </>
  );
}
