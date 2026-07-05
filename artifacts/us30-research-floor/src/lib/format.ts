// ─── Helpers ──────────────────────────────────────────────────────────────

export function getSASTTime() {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function getMarketStatus() {
  const now = new Date();
  const day = now.toLocaleDateString("en-ZA", { weekday: "long", timeZone: "Africa/Johannesburg" });
  const time = now.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour12: false });
  const [h, m] = time.split(":").map(Number);
  const mins = h * 60 + m;
  return !["Saturday", "Sunday"].includes(day) && mins >= 15 * 60 + 30 && mins < 22 * 60;
}

export function statusBadgeColor(status: string) {
  switch (status) {
    case "Active": case "IN TRADE": return "#00ff88";
    case "Observation": return "#ffcc00";
    case "Rehabilitation": case "REHAB": return "#ff6600";
    case "Suspended": return "#ff2222";
    default: return "#00ccff";
  }
}

export function fmtBal(n: number) {
  return `R${n.toFixed(2)}`;
}

export function fmtPL(n: number) {
  return (n >= 0 ? "+" : "") + `R${n.toFixed(2)}`;
}
