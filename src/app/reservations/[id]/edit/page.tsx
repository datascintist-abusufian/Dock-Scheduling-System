import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteReservationButton } from "@/components/DeleteReservationButton";
import { ReservationForm } from "@/components/ReservationForm";
import { PageHeader } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { reservationLabel } from "@/lib/domain/rules";
import { loadReferenceData } from "@/lib/services/reservations";

export const metadata: Metadata = { title: "Edit reservation" };
export const dynamic = "force-dynamic";

export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [reservation, { berths, vessels }] = await Promise.all([getRepository().getReservation(id), loadReferenceData()]);
  if (!reservation) notFound();
  const label = reservationLabel(reservation, vessels.find((v) => v.id === reservation.vesselId));

  return (
    <>
      <PageHeader
        title={`Edit reservation: ${label}`}
        subtitle="Changes are re-checked for berth fit and conflicts before saving."
        actions={<DeleteReservationButton id={reservation.id} label={label} />}
      />
      <ReservationForm
        berths={berths}
        vessels={vessels}
        reservationId={reservation.id}
        initial={{
          type: reservation.type,
          vesselId: reservation.vesselId ?? "",
          eventName: reservation.eventName ?? "",
          berthId: reservation.berthId,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
          notes: reservation.notes ?? "",
          status: reservation.status,
        }}
      />
    </>
  );
}
