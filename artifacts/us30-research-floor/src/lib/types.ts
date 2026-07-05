import type { TraderId } from "../simulation/traderEngine";

// ─── Activity log entry ───────────────────────────────────────────────────

export interface ActivityEntry {
  id: number;
  time: string;
  traderId: string;
  msg: string;
}

// ─── Chat message ───────────────────────────────────────────────────────

export interface ChatMessage {
  time: string;
  name: string;
  color: string;
  msg: string;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────

export type RankMetric = "balance" | "winRate" | "totalPL" | "avgR";

export interface LeaderboardRow {
  id: TraderId;
  name: string;
  accent: string;
  status: string;
  balance: number;
  totalTrades: number;
  winRate: number;
  totalPL: number;
  avgR: number;
  bestTrade: number;
  worstTrade: number;
  activeResearch: number;
}
