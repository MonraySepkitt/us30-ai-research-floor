import type { TraderState } from "../simulation/traderEngine";
import type { LeaderboardRow } from "./types";
import { TRADER_CONFIG } from "./traderConfig";

export function buildLeaderboardRows(traderStates: TraderState[]): LeaderboardRow[] {
  return traderStates.map((t) => {
    const cfg = TRADER_CONFIG[t.id];
    const trades = t.closedTrades;
    const totalTrades = trades.length;
    const wins = t.journal.filter((j) => j.outcome === "WIN").length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    const totalPL = trades.reduce((sum, tr) => sum + tr.balanceChange, 0);
    const avgR = totalTrades > 0 ? trades.reduce((sum, tr) => sum + tr.rMultiple, 0) / totalTrades : 0;
    const bestTrade = totalTrades > 0 ? Math.max(...trades.map((tr) => tr.rMultiple)) : 0;
    const worstTrade = totalTrades > 0 ? Math.min(...trades.map((tr) => tr.rMultiple)) : 0;
    const activeResearch = t.researchProjects.filter((p) => p.status === "ACTIVE").length;

    return {
      id: t.id,
      name: t.name,
      accent: cfg.accent,
      status: t.status,
      balance: t.balance,
      totalTrades,
      winRate,
      totalPL,
      avgR,
      bestTrade,
      worstTrade,
      activeResearch,
    };
  });
}
