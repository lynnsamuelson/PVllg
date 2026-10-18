// Dates and times as the mockups write them: "Thu, Oct 22 · 10 am - 2 pm", "Wed, Oct 21 · 5:30 - 7 pm".

// "2030-10-22" -> a local Date (new Date("2030-10-22") would be UTC midnight, the day before in Nashville).
function localDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Oct 17, 2026" (resources' last-checked date).
export function formatLongDate(isoDate) {
  return localDate(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Where a resource works. Statewide and national programs are never called nearby; a local one shows its rounded
// distance when known (search results), else the area it serves.
export function resourceArea(resource) {
  if (resource.area_type === "statewide") return "Statewide";
  if (resource.area_type === "national") return "National";
  if (resource.distance_miles != null) return formatMiles(resource.distance_miles);
  return resource.area_served || "Area not listed";
}

export function formatDate(isoDate) {
  return localDate(isoDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// "17:00:00" -> { text: "5", half: "pm" }; minutes only when not on the hour ("5:30").
function clock(time) {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  return { text: m ? `${hour}:${String(m).padStart(2, "0")}` : String(hour), half: h < 12 ? "am" : "pm" };
}

export function formatWindow(start, end) {
  const a = clock(start);
  const b = clock(end);
  return a.half === b.half ? `${a.text} - ${b.text} ${b.half}` : `${a.text} ${a.half} - ${b.text} ${b.half}`;
}

// "About 3 miles"; whole miles, at least 1, so nothing reads as "About 0 miles". Lowercase with { lower: true }.
export function formatMiles(miles, { lower = false } = {}) {
  const shown = Math.max(1, miles);
  const text = `About ${shown} ${shown === 1 ? "mile" : "miles"}`;
  return lower ? text.toLowerCase() : text;
}

export function formatPickup(item) {
  return `${formatDate(item.pickup_date)} · ${formatWindow(item.pickup_start, item.pickup_end)}`;
}
