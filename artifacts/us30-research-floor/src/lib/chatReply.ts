import type { TraderState } from "../simulation/traderEngine";
import type { ChatMessage } from "./types";
import { getSASTTime, fmtBal } from "./format";
import { buildLeaderboardRows } from "./leaderboard";
import { TRADER_CONFIG } from "./traderConfig";

export function generateChatReply(message: string, traderStates: TraderState[], forcedSpeaker?: TraderState): ChatMessage {
  const lower = message.toLowerCase();
  const nowTime = getSASTTime();

  const mentioned = traderStates.find((t) => lower.includes(t.id) || lower.includes(t.name.toLowerCase()));
  const rows = buildLeaderboardRows(traderStates);

  const speaker = forcedSpeaker ?? mentioned ?? traderStates[Math.floor(Math.random() * traderStates.length)];
  const cfg = TRADER_CONFIG[speaker.id];
  const row = rows.find((r) => r.id === speaker.id);
  const rank = rows.findIndex((r) => r.id === speaker.id) + 1;

  let msg: string;

  if (lower.includes("rank") || lower.includes("leaderboard") || lower.includes("place")) {
    msg = `Currently ranked #${rank} of ${rows.length}. Balance ${fmtBal(speaker.balance)}, win rate ${row?.winRate ?? 0}%.`;
  } else if (lower.includes("position") || lower.includes("trade") || lower.includes("open")) {
    msg = speaker.openPosition
      ? `In a live ${speaker.openPosition.direction} from ${speaker.openPosition.entryPrice.toFixed(0)}. ${speaker.openPosition.entryReason}`
      : `No open position right now. ${speaker.currentAction}.`;
  } else if (lower.includes("research")) {
    const active = speaker.researchProjects.filter((p) => p.status === "ACTIVE");
    msg = active.length > 0
      ? `Working on: "${active[0].question}" — ${active[0].progress}% complete.`
      : "No active research projects right now.";
  } else if (lower.includes("lesson") || lower.includes("journal") || lower.includes("mistake")) {
    const lastEntry = speaker.journal[0];
    msg = lastEntry
      ? `Last lesson: ${lastEntry.lessonLearned}`
      : "No trades closed yet — nothing to journal.";
  } else if (lower.includes("balance") || lower.includes("pnl") || lower.includes("p/l") || lower.includes("profit")) {
    msg = `Balance: ${fmtBal(speaker.balance)}. Total trades: ${speaker.journal.length}.`;
  } else if (lower.includes("bias") || lower.includes("confidence") || lower.includes("think")) {
    msg = `Bias is ${speaker.bias.toUpperCase()} at ${speaker.confidence}% confidence. ${speaker.strategyFocus}`;
  } else {
    msg = `${speaker.currentAction}. Bias ${speaker.bias.toUpperCase()}, confidence ${speaker.confidence}%.`;
  }

  return { time: nowTime, name: speaker.name.replace(/\s+/g, "_").toUpperCase(), color: cfg.accent, msg };
}
