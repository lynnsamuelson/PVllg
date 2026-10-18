import { describe, expect, it } from "vitest";
import { formatDate, formatLongDate, formatMiles, formatPickup, formatWindow, resourceArea } from "./format.js";

describe("format", () => {
  it("writes dates in the local day, not UTC", () => {
    expect(formatDate("2030-10-22")).toBe("Tue, Oct 22");
  });

  it("writes time windows like the mockups", () => {
    expect(formatWindow("10:00:00", "14:00:00")).toBe("10 am - 2 pm");
    expect(formatWindow("17:00", "19:00")).toBe("5 - 7 pm");
    expect(formatWindow("17:30:00", "19:00:00")).toBe("5:30 - 7 pm");
    expect(formatWindow("00:15", "12:00")).toBe("12:15 am - 12 pm");
  });

  it("puts them together", () => {
    expect(formatPickup({ pickup_date: "2030-10-22", pickup_start: "10:00", pickup_end: "14:00" })).toBe(
      "Tue, Oct 22 · 10 am - 2 pm"
    );
  });
});

describe("formatMiles", () => {
  it("writes whole miles, at least 1", () => {
    expect(formatMiles(0)).toBe("About 1 mile");
    expect(formatMiles(3)).toBe("About 3 miles");
    expect(formatMiles(3, { lower: true })).toBe("about 3 miles");
  });
});

describe("resource helpers", () => {
  it("writes the long date and where a resource works", () => {
    expect(formatLongDate("2026-10-17")).toBe("Oct 17, 2026");
    expect(resourceArea({ area_type: "statewide", area_served: "Tennessee" })).toBe("Statewide");
    expect(resourceArea({ area_type: "national" })).toBe("National");
    expect(resourceArea({ area_type: "local", distance_miles: 0 })).toBe("About 1 mile");
    expect(resourceArea({ area_type: "local", area_served: "Davidson County" })).toBe("Davidson County");
    expect(resourceArea({ area_type: "local" })).toBe("Area not listed");
  });
});
