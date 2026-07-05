import type { TraderId } from "../simulation/traderEngine";

// ─── Visual config (accent colours, no simulation data) ───────────────────

export const TRADER_CONFIG: Record<TraderId, {
  accent: string;
  glowColor: string;
  deskColor: string;
  shirtColor: string;
  monitorBg: string;
  monitorLine: string;
  statusColor: string;
}> = {
  ict: {
    accent: "#00ccff",
    glowColor: "rgba(0, 204, 255, 0.4)",
    deskColor: "#1a3a4a",
    shirtColor: "#004488",
    monitorBg: "#001a2a",
    monitorLine: "#00ccff",
    statusColor: "#00ccff",
  },
  trend: {
    accent: "#00ff88",
    glowColor: "rgba(0, 255, 136, 0.4)",
    deskColor: "#1a3a2a",
    shirtColor: "#005522",
    monitorBg: "#001a0f",
    monitorLine: "#00ff88",
    statusColor: "#00ff88",
  },
  breakout: {
    accent: "#ff6600",
    glowColor: "rgba(255, 102, 0, 0.4)",
    deskColor: "#3a2010",
    shirtColor: "#882200",
    monitorBg: "#1a0800",
    monitorLine: "#ff6600",
    statusColor: "#ff6600",
  },
};
