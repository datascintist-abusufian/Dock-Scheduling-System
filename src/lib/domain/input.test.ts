import { describe, expect, it } from "vitest";
import { parseReservationInput } from "./input";

describe("parseReservationInput", () => {
  it("trims strings and turns blanks into null", () => {
    expect(parseReservationInput({ type: "vessel", vesselId: " v1 ", berthId: "", startDate: "2019-06-01", notes: "   " })).toEqual({
      type: "vessel",
      vesselId: "v1",
      eventName: null,
      berthId: null,
      startDate: "2019-06-01",
      endDate: null,
      notes: null,
      status: "confirmed",
    });
  });

  it("drops the field that doesn't apply to the reservation type", () => {
    const r = parseReservationInput({ type: "event", vesselId: "v1", eventName: "Community Sail Day" });
    expect(r.vesselId).toBeNull();
    expect(r.eventName).toBe("Community Sail Day");
  });

  it("falls back to safe defaults for unknown type/status values", () => {
    const r = parseReservationInput({ type: "boat", status: "maybe" });
    expect(r.type).toBe("vessel");
    expect(r.status).toBe("confirmed");
  });
});
