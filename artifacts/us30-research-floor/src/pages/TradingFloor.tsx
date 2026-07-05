import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { candles1H, candles4H, getLatestPrice } from "../data/demoMarketData";
import { getInitialTraderStates, getSASTHHMM, type TraderState, type TraderId } from "../simulation/traderEngine";
import { runICTCycle, runTrendCycle, runBreakoutCycle } from "../simulation/traderStrategies";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../lib/persistence";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getSASTTime, getMarketStatus, statusBadgeColor, fmtBal, fmtPL } from "../lib/format";
import type { ActivityEntry, ChatMessage, RankMetric, LeaderboardRow } from "../lib/types";
import { buildLeaderboardRows } from "../lib/leaderboard";
import { TRADER_CONFIG } from "../lib/traderConfig";
import { TraderDesk } from "../components/trading/TraderDesk";
import { PCSection } from "../components/trading/PCSection";

// ─── Rule-based chat reply generator (no external AI/API calls) ──────────

function generateChatReply(message: string, traderStates: TraderState[], forcedSpeaker?: TraderState): ChatMessage {
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

// ─── PC View component (collapsible sections) ─────────────────────────────

function PCView({
  trader, accent, chatMessages, chatInput, onChatInputChange, onSendChat,
}: {
  trader: TraderState;
  accent: string;
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
}) {
  const pos = trader.openPosition;
  return (
    <div className="flex flex-col gap-0 font-mono text-[7px]" style={{ color: accent }}>

      {/* ── Header block ─────────────────────────────────── */}
      <div className="flex flex-col gap-[4px] pb-3 mb-1 border-b" style={{ borderColor: accent + "44" }}>
        <div><span className="text-muted-foreground">&gt; TRADER: </span>{trader.name}</div>
        <div><span className="text-muted-foreground">&gt; STRATEGY: </span>{trader.strategyVersion} — {trader.strategyFocus}</div>
        <div><span className="text-muted-foreground">&gt; STATUS: </span>{trader.status}</div>
        <div><span className="text-muted-foreground">&gt; TFs: </span>{trader.timeframesReviewed.join(", ")}</div>
        <div>
          <span className="text-muted-foreground">&gt; BIAS: </span>
          <span style={{ color: trader.bias === "Bullish" ? "#00ff88" : trader.bias === "Bearish" ? "#ff4444" : "#ffcc00" }}>
            {trader.bias.toUpperCase()}
          </span>
          <span className="text-muted-foreground"> ({trader.confidence}% confidence)</span>
        </div>
        <div><span className="text-muted-foreground">&gt; ACTION: </span>{trader.currentAction}</div>
        <div><span className="text-muted-foreground">&gt; BALANCE: </span>{fmtBal(trader.balance)}</div>
      </div>

      {/* ── Current Thesis ───────────────────────────────── */}
      <PCSection title="// CURRENT THESIS" accent={accent}>
        <div className="opacity-90">{trader.thesis}</div>
      </PCSection>

      {/* ── Market Narrative ─────────────────────────────── */}
      <PCSection title="// MARKET NARRATIVE" accent={accent}>
        <div className="opacity-85 leading-[1.6]">{trader.marketNarrative}</div>
      </PCSection>

      {/* ── Bull / Bear Case ─────────────────────────────── */}
      <PCSection title="// BULL CASE / BEAR CASE" accent={accent}>
        <div>
          <span style={{ color: "#00ff88" }} className="font-bold">BULL: </span>
          <span className="opacity-85">{trader.bullCase}</span>
        </div>
        <div>
          <span style={{ color: "#ff4444" }} className="font-bold">BEAR: </span>
          <span className="opacity-85">{trader.bearCase}</span>
        </div>
      </PCSection>

      {/* ── Entry Conditions ─────────────────────────────── */}
      <PCSection title="// ENTRY CONDITIONS" accent={accent}>
        <div><span className="text-muted-foreground">WAITING FOR:  </span>{trader.waitingFor}</div>
        <div className="mt-1"><span className="text-muted-foreground">TRIGGER:      </span>{trader.tradeTrigger}</div>
        {!pos && (
          <div className="mt-1"><span className="text-muted-foreground">NO-TRADE:     </span>{trader.noTradeReason}</div>
        )}
      </PCSection>

      {/* ── Risk Plan ────────────────────────────────────── */}
      <PCSection title="// RISK PLAN" accent={accent}>
        <div><span className="text-muted-foreground">ENTRY AREA:   </span>{trader.riskPlan.entryArea}</div>
        <div><span className="text-muted-foreground">INVALIDATION: </span>{trader.riskPlan.invalidation}</div>
        <div><span className="text-muted-foreground">TARGET:       </span>{trader.riskPlan.target}</div>
        <div><span className="text-muted-foreground">R:R:          </span>{trader.riskPlan.rr}</div>
      </PCSection>

      {/* ── What Would Change Mind ───────────────────────── */}
      <PCSection title="// WHAT WOULD CHANGE MY MIND" accent={accent}>
        <div className="opacity-90">{trader.whatWouldChangeMind}</div>
      </PCSection>

      {/* ── Open Position ────────────────────────────────── */}
      {pos && (
        <PCSection title="// OPEN POSITION" accent={accent}>
          <div>
            <span style={{ color: pos.direction === "BUY" ? "#00ff88" : "#ff4444" }} className="font-bold">{pos.direction}</span>
            <span className="text-muted-foreground"> @ </span>{pos.entryPrice.toFixed(1)}
          </div>
          <div><span className="text-muted-foreground">SL: </span>{pos.stopLoss.toFixed(1)}<span className="text-muted-foreground"> | TP: </span>{pos.takeProfit.toFixed(1)}</div>
          <div><span className="text-muted-foreground">SIZE: </span>{pos.size.toFixed(3)} lots</div>
          <div style={{ color: pos.unrealizedPL >= 0 ? "#00ff88" : "#ff4444" }}>
            UNREAL P/L: {fmtPL(pos.unrealizedPL)}
          </div>
        </PCSection>
      )}

      {/* ── Recent Trade ─────────────────────────────────── */}
      {trader.closedTrades.length > 0 && (
        <PCSection title="// MOST RECENT TRADE" accent={accent} defaultOpen={false}>
          {(() => {
            const t = trader.closedTrades[0];
            return (
              <>
                <div>
                  <span style={{ color: t.direction === "BUY" ? "#00ff88" : "#ff4444" }}>{t.direction}</span>
                  <span className="text-muted-foreground"> </span>
                  {t.entryPrice.toFixed(0)} → {t.exitPrice.toFixed(0)}
                </div>
                <div style={{ color: t.result >= 0 ? "#00ff88" : "#ff4444" }}>
                  RESULT: {t.rMultiple >= 0 ? "+" : ""}{t.rMultiple.toFixed(1)}R ({fmtPL(t.result)})
                </div>
                <div className="text-muted-foreground">REASON: {t.reason}</div>
              </>
            );
          })()}
        </PCSection>
      )}

      {/* ── Reasoning Memory ─────────────────────────────── */}
      <PCSection title={`// REASONING MEMORY (${trader.reasoningMemory.length})`} accent={accent} defaultOpen={false}>
        {trader.reasoningMemory.length === 0 ? (
          <div className="text-muted-foreground">No entries yet.</div>
        ) : (
          trader.reasoningMemory.map((entry, i) => (
            <div key={i} className="flex gap-2 items-baseline">
              <span className="text-muted-foreground shrink-0">[{entry.time}]</span>
              <span className="opacity-85">{entry.note}</span>
            </div>
          ))
        )}
      </PCSection>

      {/* ── Research Projects ────────────────────────────── */}
      <PCSection title={`// RESEARCH PROJECTS (${trader.researchProjects.length})`} accent={accent} defaultOpen={false}>
        {trader.researchProjects.length === 0 ? (
          <div className="text-muted-foreground">No active research.</div>
        ) : (
          trader.researchProjects.map((rp) => (
            <div key={rp.id} className="flex flex-col gap-1 pb-3 mb-2 border-b" style={{ borderColor: accent + "22" }}>
              <div>
                <span className="text-muted-foreground">Q: </span>
                <span className="opacity-90">{rp.question}</span>
              </div>
              <div>
                <span className="text-muted-foreground">REASON: </span>
                <span className="opacity-85">{rp.reason}</span>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <span>
                  <span className="text-muted-foreground">STATUS: </span>
                  <span style={{ color: rp.status === "COMPLETE" ? "#00ff88" : rp.status === "REJECTED" ? "#ff4444" : "#ffcc00" }}>
                    {rp.status}
                  </span>
                </span>
                <span><span className="text-muted-foreground">PROGRESS: </span>{rp.progress}%</span>
                <span><span className="text-muted-foreground">TRADES REVIEWED: </span>{rp.tradesReviewed}</span>
              </div>
              <div className="w-full h-[6px] border" style={{ borderColor: accent + "55" }}>
                <div className="h-full" style={{ width: `${rp.progress}%`, backgroundColor: accent }} />
              </div>
              <div className="mt-1">
                <span className="text-muted-foreground">FINDINGS: </span>
                <span className="opacity-85">{rp.currentFindings}</span>
              </div>
              <div>
                <span className="text-muted-foreground">PROPOSED CHANGE: </span>
                <span className="opacity-90">{rp.proposedStrategyChange}</span>
              </div>
            </div>
          ))
        )}
      </PCSection>

      {/* ── Trader Chat ──────────────────────────────────── */}
      <PCSection title="// TRADER CHAT" accent={accent} defaultOpen={false}>
        <div className="flex flex-col gap-[6px] max-h-[160px] overflow-y-auto pb-2">
          {chatMessages.length === 0 ? (
            <div className="text-muted-foreground">No messages yet. Ask about bias, position, research, journal, mistakes, or performance.</div>
          ) : (
            chatMessages.map((entry, i) => (
              <div key={i} className="flex gap-2 items-baseline">
                <span className="text-muted-foreground shrink-0 text-[6px]">[{entry.time}]</span>
                <span className="font-bold shrink-0" style={{ color: entry.color }}>{entry.name}:</span>
                <span className="opacity-90">{entry.msg}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 border-t pt-2 flex items-center gap-2" style={{ borderColor: accent + "33" }}>
          <span>&gt;</span>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSendChat();
            }}
            placeholder={`[ask ${trader.name}...]`}
            className="bg-transparent border-none outline-none flex-1 text-[7px]"
            style={{ color: accent }}
            data-testid={`pc-chat-input-${trader.id}`}
          />
          <button
            onClick={onSendChat}
            className="border px-2 py-[2px] text-[7px] hover:opacity-80 transition-all"
            style={{ borderColor: accent, color: accent }}
            data-testid={`btn-pc-send-chat-${trader.id}`}
          >
            [SEND]
          </button>
        </div>
      </PCSection>

      {/* ── Cursor ───────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-1">
        <span>&gt;</span>
        <span className="inline-block" style={{ width: 6, height: 12, backgroundColor: accent, animation: "cursorBlink 1s step-end infinite" }} />
      </div>
    </div>
  );
}

function JournalView({ trader, accent }: { trader: TraderState; accent: string }) {
  const [tab, setTab] = useState<"SUMMARY" | "TRADES" | "LESSONS" | "MISTAKES" | "IMPROVEMENTS">("SUMMARY");
  const journal = trader.journal;
  const losses = trader.lossProtocol;
  const tabs: Array<typeof tab> = ["SUMMARY", "TRADES", "LESSONS", "MISTAKES", "IMPROVEMENTS"];

  const wins = journal.filter((j) => j.outcome === "WIN").length;
  const lossCount = journal.filter((j) => j.outcome === "LOSS").length;
  const winRate = journal.length > 0 ? Math.round((wins / journal.length) * 100) : 0;
  const totalPL = journal.reduce((sum, j) => sum + j.balanceChange, 0);
  const activeResearch = trader.researchProjects.filter((p) => p.status === "ACTIVE");

  // ── Equity curve (full-session history, not windowed) ──────────────────
  const equityCurve = trader.equityHistory;

  return (
    <div className="flex flex-col gap-0 font-mono text-[7px]" style={{ color: accent }}>
      {/* ── Tab bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 pb-3 mb-3 border-b" style={{ borderColor: accent + "44" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-2 py-1 text-[7px]"
            style={{
              border: `1px solid ${tab === t ? accent : accent + "44"}`,
              color: tab === t ? accent : "#666",
              backgroundColor: tab === t ? accent + "20" : "transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── SUMMARY ──────────────────────────────────────── */}
      {tab === "SUMMARY" && (
        <div className="flex flex-col gap-4">
          <div className="border p-3 flex flex-col gap-2" style={{ borderColor: accent + "44", backgroundColor: accent + "0a" }}>
            <div className="text-muted-foreground mb-1">SESSION STATS</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div><span className="text-muted-foreground">TRADES LOGGED: </span>{journal.length}</div>
              <div><span className="text-muted-foreground">WIN RATE: </span>{winRate}%</div>
              <div><span className="text-muted-foreground">WINS: </span><span style={{ color: "#00ff88" }}>{wins}</span></div>
              <div><span className="text-muted-foreground">LOSSES: </span><span style={{ color: "#ff4444" }}>{lossCount}</span></div>
              <div><span className="text-muted-foreground">TOTAL P/L: </span><span style={{ color: totalPL >= 0 ? "#00ff88" : "#ff4444" }}>{fmtPL(totalPL)}</span></div>
              <div><span className="text-muted-foreground">BALANCE: </span>{fmtBal(trader.balance)}</div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">EQUITY CURVE (FULL SESSION — {Math.max(trader.equityHistory.length - 1, 0)} TRADES)</div>
            {journal.length === 0 ? (
              <div className="text-muted-foreground border p-3" style={{ borderColor: accent + "33" }}>
                No trades closed yet. Equity curve will populate as trades complete.
              </div>
            ) : (
              <div className="border p-2" style={{ borderColor: accent + "33", backgroundColor: accent + "08" }}>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={equityCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`equityFill-${trader.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={accent + "22"} vertical={false} />
                    <XAxis dataKey="trade" tick={{ fill: "#666", fontSize: 6 }} stroke={accent + "44"} />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#666", fontSize: 6 }}
                      stroke={accent + "44"}
                      width={40}
                      tickFormatter={(v: number) => `R${v}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#04040a", border: `1px solid ${accent}`, fontSize: 7, fontFamily: "monospace" }}
                      labelStyle={{ color: accent }}
                      formatter={(value: number) => [fmtBal(value), "BALANCE"]}
                      labelFormatter={(label: number) => (label === 0 ? "START" : `TRADE #${label}`)}
                    />
                    <Area type="monotone" dataKey="balance" stroke={accent} strokeWidth={1.5} fill={`url(#equityFill-${trader.id})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground mb-1">CURRENT BIAS &amp; FOCUS</div>
            <div>Bias: <span style={{ color: trader.bias === "Bullish" ? "#00ff88" : trader.bias === "Bearish" ? "#ff4444" : "#ffcc00" }}>{trader.bias.toUpperCase()}</span> ({trader.confidence}% confidence)</div>
            <div className="opacity-85 mt-1">Strategy focus: {trader.strategyFocus}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">ACTIVE RESEARCH ({activeResearch.length})</div>
            {activeResearch.length === 0 ? (
              <div className="text-muted-foreground">No active research projects.</div>
            ) : (
              activeResearch.map((rp) => (
                <div key={rp.id} className="mb-2 opacity-90">
                  <div>{rp.question}</div>
                  <div className="w-full h-[5px] border mt-1" style={{ borderColor: accent + "55" }}>
                    <div className="h-full" style={{ width: `${rp.progress}%`, backgroundColor: accent }} />
                  </div>
                  <div className="text-muted-foreground mt-1">{rp.progress}% complete — {rp.tradesReviewed} trades reviewed</div>
                </div>
              ))
            )}
          </div>
          {journal.length === 0 && (
            <div className="text-muted-foreground">No trades closed yet. Journal will populate as trades complete.</div>
          )}
        </div>
      )}

      {/* ── TRADES ───────────────────────────────────────── */}
      {tab === "TRADES" && (
        <div className="flex flex-col gap-3">
          {journal.length === 0 ? (
            <div className="text-muted-foreground">No trade entries yet. Waiting for the first closed trade.</div>
          ) : (
            journal.map((j) => (
              <div key={j.tradeNumber} className="border p-3 flex flex-col gap-1" style={{ borderColor: accent + "33" }}>
                <div className="flex justify-between">
                  <span>
                    <span className="text-muted-foreground">#{j.tradeNumber} </span>
                    <span style={{ color: j.direction === "BUY" ? "#00ff88" : "#ff4444" }} className="font-bold">{j.direction}</span>
                    <span className="text-muted-foreground"> @ </span>{j.entryPrice.toFixed(0)} → {j.exitPrice.toFixed(0)}
                  </span>
                  <span style={{ color: j.outcome === "WIN" ? "#00ff88" : j.outcome === "LOSS" ? "#ff4444" : "#ffcc00" }}>
                    {j.outcome} {j.rMultiple >= 0 ? "+" : ""}{j.rMultiple.toFixed(1)}R
                  </span>
                </div>
                <div className="text-muted-foreground">{j.entryTimeSAST} SAST</div>
                <div><span className="text-muted-foreground">ENTRY REASON: </span><span className="opacity-85">{j.entryReason}</span></div>
                <div><span className="text-muted-foreground">EXIT REASON: </span><span className="opacity-85">{j.exitReason}</span></div>
                <div><span className="text-muted-foreground">BALANCE CHANGE: </span><span style={{ color: j.balanceChange >= 0 ? "#00ff88" : "#ff4444" }}>{fmtPL(j.balanceChange)}</span></div>
                <div><span className="text-muted-foreground">MARKET CONTEXT: </span><span className="opacity-80">{j.marketContext}</span></div>
                <div><span className="text-muted-foreground">TFs REVIEWED: </span>{j.timeframesReviewed.join(", ")}</div>
                {j.mistakes && <div><span className="text-muted-foreground">MISTAKES: </span><span style={{ color: "#ff4444" }}>{j.mistakes}</span></div>}
                <div><span className="text-muted-foreground">LESSON: </span><span className="opacity-90">{j.lessonLearned}</span></div>
                <div><span className="text-muted-foreground">IMPROVEMENT: </span><span className="opacity-90">{j.proposedImprovement}</span></div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── LESSONS ──────────────────────────────────────── */}
      {tab === "LESSONS" && (
        <div className="flex flex-col gap-2">
          {journal.length === 0 ? (
            <div className="text-muted-foreground">No lessons logged yet.</div>
          ) : (
            journal.map((j) => (
              <div key={j.tradeNumber} className="flex gap-2 items-baseline">
                <span className="text-muted-foreground shrink-0">#{j.tradeNumber}</span>
                <span className="opacity-90">{j.lessonLearned}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MISTAKES ─────────────────────────────────────── */}
      {tab === "MISTAKES" && (
        <div className="flex flex-col gap-3">
          {losses.length === 0 ? (
            <div className="text-muted-foreground">No losses recorded yet — no mistakes to review.</div>
          ) : (
            losses.map((lp) => (
              <div key={lp.tradeNumber} className="border p-3 flex flex-col gap-1" style={{ borderColor: "#ff444444" }}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">#{lp.tradeNumber} LOSS PROTOCOL</span>
                  <span className="text-muted-foreground">{lp.timestamp}</span>
                </div>
                <div style={{ color: "#ff4444" }}>{lp.lossDescription}</div>
                <div><span className="text-muted-foreground">WHY: </span><span className="opacity-85">{lp.whyItHappened}</span></div>
                <div><span className="text-muted-foreground">LESSON: </span><span className="opacity-90">{lp.lessonLearned}</span></div>
                <div><span className="text-muted-foreground">IMPROVEMENT: </span><span className="opacity-90">{lp.proposedImprovement}</span></div>
                <div><span className="text-muted-foreground">FUTURE TEST: </span><span className="opacity-80">{lp.futureTestIdea}</span></div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── IMPROVEMENTS ─────────────────────────────────── */}
      {tab === "IMPROVEMENTS" && (
        <div className="flex flex-col gap-2">
          {journal.length === 0 ? (
            <div className="text-muted-foreground">No improvements logged yet.</div>
          ) : (
            journal.map((j) => (
              <div key={j.tradeNumber} className="flex gap-2 items-baseline">
                <span className="text-muted-foreground shrink-0">#{j.tradeNumber}</span>
                <span className="opacity-90">{j.proposedImprovement}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Cursor ───────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-1">
        <span>&gt;</span>
        <span className="inline-block" style={{ width: 6, height: 12, backgroundColor: accent, animation: "cursorBlink 1s step-end infinite" }} />
      </div>
    </div>
  );
}

// ─── Leaderboard ────────────────────────────────────────────────────────

const RANK_LABELS: Record<RankMetric, string> = {
  balance: "BALANCE",
  winRate: "WIN RATE",
  totalPL: "TOTAL P/L",
  avgR: "AVG R",
};

function Leaderboard({
  traderStates,
  rankBy,
  onRankByChange,
}: {
  traderStates: TraderState[];
  rankBy: RankMetric;
  onRankByChange: (m: RankMetric) => void;
}) {
  const rows = useMemo(() => {
    const built = buildLeaderboardRows(traderStates);
    return [...built].sort((a, b) => b[rankBy] - a[rankBy]);
  }, [traderStates, rankBy]);

  return (
    <section className="border-b border-border bg-[#04040a] px-4 py-3" data-testid="leaderboard">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-[7px] text-muted-foreground">// LEADERBOARD — RANKED BY {RANK_LABELS[rankBy]}</div>
        <div className="flex gap-1">
          {(Object.keys(RANK_LABELS) as RankMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => onRankByChange(m)}
              className="px-2 py-1 text-[6px] border transition-all"
              style={{
                borderColor: rankBy === m ? "#00ff88" : "#333",
                color: rankBy === m ? "#00ff88" : "#666",
                backgroundColor: rankBy === m ? "#00ff8820" : "transparent",
              }}
              data-testid={`btn-rank-${m}`}
            >
              {RANK_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[6.5px] border-collapse">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">TRADER</th>
              <th className="py-1 pr-2">STATUS</th>
              <th className="py-1 pr-2 text-right">BALANCE</th>
              <th className="py-1 pr-2 text-right">TRADES</th>
              <th className="py-1 pr-2 text-right">WIN%</th>
              <th className="py-1 pr-2 text-right">P/L</th>
              <th className="py-1 pr-2 text-right">AVG R</th>
              <th className="py-1 pr-2 text-right">BEST</th>
              <th className="py-1 pr-2 text-right">WORST</th>
              <th className="py-1 pr-2 text-right">RESEARCH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isTop = idx === 0;
              const inTrade = row.status === "IN TRADE";
              return (
                <tr
                  key={row.id}
                  data-testid={`leaderboard-row-${row.id}`}
                  style={{
                    backgroundColor: isTop ? row.accent + "14" : "transparent",
                    borderTop: `1px solid ${row.accent}22`,
                    boxShadow: isTop ? `0 0 8px ${row.accent}55 inset` : "none",
                  }}
                >
                  <td className="py-1 pr-2">
                    {isTop ? <span style={{ color: "#ffcc00" }}>#1 ★</span> : `#${idx + 1}`}
                  </td>
                  <td className="py-1 pr-2 font-bold" style={{ color: row.accent }}>{row.name}</td>
                  <td className="py-1 pr-2 text-muted-foreground">{inTrade ? "IN TRADE" : "WAITING"}</td>
                  <td className="py-1 pr-2 text-right">{fmtBal(row.balance)}</td>
                  <td className="py-1 pr-2 text-right">{row.totalTrades}</td>
                  <td className="py-1 pr-2 text-right">{row.winRate}%</td>
                  <td className="py-1 pr-2 text-right" style={{ color: row.totalPL >= 0 ? "#00ff88" : "#ff4444" }}>{fmtPL(row.totalPL)}</td>
                  <td className="py-1 pr-2 text-right">{row.avgR >= 0 ? "+" : ""}{row.avgR.toFixed(1)}R</td>
                  <td className="py-1 pr-2 text-right" style={{ color: "#00ff88" }}>{row.bestTrade > 0 ? "+" : ""}{row.bestTrade.toFixed(1)}R</td>
                  <td className="py-1 pr-2 text-right" style={{ color: "#ff4444" }}>{row.worstTrade.toFixed(1)}R</td>
                  <td className="py-1 pr-2 text-right">{row.activeResearch}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function TradingFloor() {
  const [time, setTime] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [traderStates, setTraderStates] = useState<TraderState[]>(() => {
    const persisted = loadPersistedState<TraderState, ActivityEntry>();
    const loaded = persisted?.traderStates ?? getInitialTraderStates();
    return loaded.map((t) => ({
      ...t,
      equityHistory: t.equityHistory ?? [{ trade: 0, balance: t.balance }],
    }));
  });
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(() => {
    const persisted = loadPersistedState<TraderState, ActivityEntry>();
    return persisted?.activityLog ?? [];
  });
  const [activeModal, setActiveModal] = useState<{ type: string; traderId?: TraderId } | null>(null);
  const [nextCycleIn, setNextCycleIn] = useState(35);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [rankBy, setRankBy] = useState<RankMetric>("balance");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    { time: "08:12", name: "FLOOR_MASTER", color: "#00ccff", msg: "Morning briefing. All traders check in." },
    { time: "08:13", name: "ICT_TRADER", color: TRADER_CONFIG.ict.accent, msg: `Checked in. Bias ${traderStates[0].bias.toUpperCase()}. Confidence ${traderStates[0].confidence}%.` },
    { time: "08:15", name: "TREND_TRADER", color: TRADER_CONFIG.trend.accent, msg: `${traderStates[1].currentAction}.` },
    { time: "08:18", name: "BREAKOUT_TRADER", color: TRADER_CONFIG.breakout.accent, msg: `${traderStates[2].currentAction}.` },
    { time: "08:20", name: "FLOOR_MASTER", color: "#00ccff", msg: "Risk below 1% today. Stay disciplined. No FOMO." },
    { time: "08:28", name: "SYSTEM", color: "#555", msg: "Simulation active." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [pcChatMessages, setPcChatMessages] = useState<Record<TraderId, ChatMessage[]>>({
    ict: [], trend: [], breakout: [],
  });
  const [pcChatInput, setPcChatInput] = useState<Record<TraderId, string>>({
    ict: "", trend: "", breakout: "",
  });
  const cycleCounterRef = useRef(0);
  const activityIdRef = useRef(0);

  // ── Persistence: auto-save (debounced) ──────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      savePersistedState(traderStates, activityLog);
      setLastSavedAt(Date.now());
    }, 1200);
    return () => clearTimeout(id);
  }, [traderStates, activityLog]);

  const handleSaveNow = useCallback(() => {
    savePersistedState(traderStates, activityLog);
    setLastSavedAt(Date.now());
  }, [traderStates, activityLog]);

  const handleResetSimulation = useCallback(() => {
    const fresh = getInitialTraderStates();
    setTraderStates(fresh);
    setActivityLog([]);
    cycleCounterRef.current = 0;
    activityIdRef.current = 0;
    savePersistedState(fresh, []);
    setLastSavedAt(Date.now());
  }, []);

  const handleClearSavedData = useCallback(() => {
    clearPersistedState();
    setLastSavedAt(null);
  }, []);

  const handleDemote = useCallback((traderId: TraderId) => {
    const original = getInitialTraderStates().find((t) => t.id === traderId);
    if (!original) return;

    setTraderStates((prev) =>
      prev.map((t) => {
        if (t.id !== traderId) return t;
        return {
          ...t,
          status: original.status,
          bias: original.bias,
          confidence: original.confidence,
          currentAction: original.currentAction,
          internalReasoning: original.internalReasoning,
          recentDecision: original.recentDecision,
          thesis: original.thesis,
          marketNarrative: original.marketNarrative,
          bullCase: original.bullCase,
          bearCase: original.bearCase,
          waitingFor: original.waitingFor,
          tradeTrigger: original.tradeTrigger,
          noTradeReason: original.noTradeReason,
          riskPlan: original.riskPlan,
          whatWouldChangeMind: original.whatWouldChangeMind,
          reasoningMemory: [{ time: getSASTHHMM(), note: `Demoted and restarted. ${original.reasoningMemory[0]?.note ?? ""}` }],
          openPosition: null,
          closedTrades: [],
          balance: original.balance,
          journal: [],
          lossProtocol: [],
          researchProjects: original.researchProjects.map((p) => ({ ...p })),
          equityHistory: [{ trade: 0, balance: original.balance }],
        };
      })
    );

    setActivityLog((prev) => [
      { id: ++activityIdRef.current, time: getSASTHHMM(), traderId, msg: `${original.name} was demoted and restarted from scratch.` },
      ...prev,
    ].slice(0, 8));
  }, []);

  const handleSendChat = useCallback(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { time: getSASTTime(), name: "YOU", color: "#ffffff", msg: trimmed };
    const reply = generateChatReply(trimmed, traderStates);
    setChatMessages((prev) => [...prev, userMsg, reply]);
    setChatInput("");
  }, [chatInput, traderStates]);

  const handleSendPCChat = useCallback((traderId: TraderId) => {
    setPcChatInput((prevInput) => {
      const trimmed = (prevInput[traderId] ?? "").trim();
      if (!trimmed) return prevInput;
      const forcedSpeaker = traderStates.find((t) => t.id === traderId);
      const userMsg: ChatMessage = { time: getSASTTime(), name: "YOU", color: "#ffffff", msg: trimmed };
      const reply = generateChatReply(trimmed, traderStates, forcedSpeaker);
      setPcChatMessages((prev) => ({
        ...prev,
        [traderId]: [...prev[traderId], userMsg, reply],
      }));
      return { ...prevInput, [traderId]: "" };
    });
  }, [traderStates]);

  // ── Clock & market status ───────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const sast = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
      setTime(sast + " SAST");
      setMarketOpen(getMarketStatus());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Simulation engine ───────────────────────────────────────────────────
  const runSimCycle = useCallback(() => {
    cycleCounterRef.current++;
    const newEvents: ActivityEntry[] = [];

    setTraderStates((prev) =>
      prev.map((t) => {
        let result: { state: TraderState; event: { traderId: string; msg: string } | null };
        if (t.id === "ict") result = runICTCycle(t, candles1H, candles4H);
        else if (t.id === "trend") result = runTrendCycle(t, candles1H, candles4H);
        else result = runBreakoutCycle(t, candles1H);

        if (result.event) {
          newEvents.push({
            id: ++activityIdRef.current,
            time: getSASTTime(),
            traderId: result.event.traderId,
            msg: result.event.msg,
          });
        }
        return result.state;
      })
    );

    if (newEvents.length > 0) {
      setActivityLog((prev) => [...newEvents, ...prev].slice(0, 8));
    }
  }, []);

  // Run first cycle after short delay, then every 35–50s
  useEffect(() => {
    const firstRun = setTimeout(() => {
      runSimCycle();
    }, 2000);

    const intervalMs = 35000 + Math.random() * 15000;
    const interval = setInterval(() => {
      runSimCycle();
      setNextCycleIn(Math.round(intervalMs / 1000));
    }, intervalMs);

    return () => { clearTimeout(firstRun); clearInterval(interval); };
  }, [runSimCycle]);

  // Countdown display
  useEffect(() => {
    const id = setInterval(() => setNextCycleIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const openModal = (type: string, traderId?: TraderId) => setActiveModal({ type, traderId });
  const closeModal = () => setActiveModal(null);

  const activeTrader = activeModal?.traderId
    ? traderStates.find((t) => t.id === activeModal.traderId)
    : null;

  function getTraderAccent(id: string) {
    return TRADER_CONFIG[id as TraderId]?.accent ?? "#00ff88";
  }

  const currentPrice = getLatestPrice();

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen font-sans pb-10">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card p-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <h1 className="text-primary text-[10px] md:text-sm" style={{ textShadow: "0 0 10px #00ff88" }}>
          US30 AI RESEARCH FLOOR
        </h1>
        <div className="flex items-center gap-3 text-[8px] flex-wrap justify-center">
          <div className="text-secondary" data-testid="sast-clock">{time}</div>
          <div
            className={`border px-2 py-1 ${marketOpen ? "border-primary text-primary" : "border-destructive text-destructive"}`}
            style={{ boxShadow: marketOpen ? "0 0 6px rgba(0,255,136,0.3)" : "0 0 6px rgba(255,0,0,0.3)" }}
            data-testid="market-status"
          >
            {marketOpen ? "[OPEN]" : "[CLOSED]"}
          </div>
          <div className="border border-[#ffaa00] text-[#ffaa00] px-2 py-1" data-testid="demo-badge">[DEMO DATA]</div>
          <div className="text-muted-foreground text-[7px]">US30 {currentPrice.toFixed(0)}</div>
        </div>
      </header>

      {/* ── Trading Floor Scene ─────────────────────────────────────────── */}
      <section
        className="w-full border-b border-border flex flex-col overflow-hidden relative"
        style={{
          height: 200,
          backgroundImage: "linear-gradient(rgba(0, 255, 136, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 136, 0.06) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundColor: "#040408",
        }}
      >
        <div className="absolute top-2 left-3 text-[6px] text-muted-foreground opacity-50">
          FLOOR.VIEW // SIM ACTIVE // CYCLE #{cycleCounterRef.current}
        </div>
        <div className="absolute top-2 right-3 text-[6px] text-muted-foreground opacity-50">
          NEXT: {nextCycleIn}s
        </div>

        <div className="flex-1 flex justify-center items-end pb-6 gap-6 md:gap-14">
          {traderStates.map((t) => (
            <TraderDesk key={t.id} trader={t} />
          ))}
        </div>

        {/* Price ticker */}
        <div className="absolute bottom-0 w-full h-[18px] bg-black border-t border-border overflow-hidden flex items-center">
          <div className="animate-ticker text-[7px] text-primary whitespace-nowrap inline-block">
            &nbsp;&nbsp;US30 {currentPrice.toFixed(2)}&nbsp;&nbsp;|&nbsp;&nbsp;BIAS: DEMO&nbsp;&nbsp;|&nbsp;&nbsp;SESSION: SIMULATION&nbsp;&nbsp;|&nbsp;&nbsp;SPREAD: 1.2pts&nbsp;&nbsp;|&nbsp;&nbsp;ICT: {traderStates[0].bias.toUpperCase()}&nbsp;&nbsp;|&nbsp;&nbsp;TREND: {traderStates[1].bias.toUpperCase()}&nbsp;&nbsp;|&nbsp;&nbsp;BRKOUT: {traderStates[2].bias.toUpperCase()}&nbsp;&nbsp;|&nbsp;&nbsp;US30 {currentPrice.toFixed(2)}&nbsp;&nbsp;|&nbsp;&nbsp;BIAS: DEMO&nbsp;&nbsp;|&nbsp;&nbsp;SESSION: SIMULATION&nbsp;&nbsp;|&nbsp;&nbsp;SPREAD: 1.2pts&nbsp;&nbsp;|&nbsp;&nbsp;ICT: {traderStates[0].bias.toUpperCase()}&nbsp;&nbsp;|&nbsp;&nbsp;TREND: {traderStates[1].bias.toUpperCase()}&nbsp;&nbsp;|&nbsp;&nbsp;BRKOUT: {traderStates[2].bias.toUpperCase()}&nbsp;&nbsp;
          </div>
        </div>
      </section>

      {/* ── Activity Feed ───────────────────────────────────────────────── */}
      <section className="border-b border-border bg-[#04040a] px-4 py-2" data-testid="activity-feed">
        <div className="flex justify-between items-center mb-1">
          <div className="text-[7px] text-muted-foreground">// ACTIVITY LOG</div>
          <div className="text-[6px] text-muted-foreground opacity-60">LIVE SIM</div>
        </div>
        <div className="flex flex-col gap-[3px] min-h-[56px]">
          {activityLog.length === 0 && (
            <div className="text-[7px] text-muted-foreground opacity-50">Awaiting first simulation cycle...</div>
          )}
          {activityLog.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-baseline gap-2 text-[7px] overflow-hidden"
              style={{ opacity: 1 - idx * 0.13 }}
            >
              <span className="text-muted-foreground shrink-0">[{entry.time}]</span>
              <span className="font-bold shrink-0" style={{ color: getTraderAccent(entry.traderId) }}>
                {traderStates.find(t => t.id === entry.traderId)?.name ?? entry.traderId.toUpperCase()}:
              </span>
              <span className="text-foreground truncate">{entry.msg}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Control Panel ───────────────────────────────────────────────── */}
      <section className="border-b border-border bg-[#04040a] px-4 py-2 flex flex-wrap items-center gap-3" data-testid="control-panel">
        <div className="text-[7px] text-muted-foreground">// CONTROL PANEL</div>
        <button
          onClick={handleSaveNow}
          className="border border-primary text-primary px-2 py-1 text-[7px] hover:bg-primary/20 transition-all"
          data-testid="btn-save-now"
        >
          [SAVE STATE NOW]
        </button>
        <button
          onClick={handleResetSimulation}
          className="border border-border px-2 py-1 text-[7px] hover:bg-white/10 transition-all"
          data-testid="btn-reset-simulation"
        >
          [RESET SIMULATION]
        </button>
        <button
          onClick={handleClearSavedData}
          className="border border-destructive text-destructive px-2 py-1 text-[7px] hover:bg-destructive/20 transition-all"
          data-testid="btn-clear-saved-data"
        >
          [CLEAR SAVED DATA]
        </button>
        <div className="text-[6px] text-muted-foreground opacity-60 ml-auto">
          {lastSavedAt ? `LAST SAVED: ${new Date(lastSavedAt).toLocaleTimeString("en-ZA", { hour12: false })}` : "NOT SAVED YET"}
        </div>
      </section>

      {/* ── Leaderboard ──────────────────────────────────────────────────── */}
      <Leaderboard traderStates={traderStates} rankBy={rankBy} onRankByChange={setRankBy} />

      {/* ── Trader Cards ────────────────────────────────────────────────── */}
      <main className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto w-full flex-1">
        {traderStates.map((trader) => {
          const cfg = TRADER_CONFIG[trader.id];
          const statusColor = statusBadgeColor(trader.status);
          const plColor = trader.openPosition
            ? trader.openPosition.unrealizedPL >= 0 ? "#00ff88" : "#ff4444"
            : undefined;

          return (
            <div
              key={trader.id}
              className="border bg-card p-4 flex flex-col gap-3"
              style={{ borderColor: cfg.accent, boxShadow: `0 0 12px ${cfg.glowColor.replace("0.4", "0.07")}` }}
              data-testid={`card-${trader.id}`}
            >
              {/* Card header */}
              <div className="flex justify-between items-start border-b pb-2" style={{ borderColor: cfg.accent + "44" }}>
                <h2 className="text-[10px]" style={{ color: cfg.accent }}>{trader.name}</h2>
                <span className="text-[7px] px-1 py-[2px] border" style={{ borderColor: statusColor, color: statusColor }}>
                  [{trader.status.toUpperCase()}]
                </span>
              </div>

              {/* Stats */}
              <div className="text-[8px] flex flex-col gap-[5px]">
                <div className="flex justify-between" style={{ color: cfg.accent }}>
                  <span>BALANCE:</span>
                  <span>{fmtBal(trader.balance)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0">ACTION:</span>
                  <span className="text-right leading-snug">{trader.currentAction}</span>
                </div>
                <div className="flex justify-between">
                  <span>BIAS:</span>
                  <span style={{ color: cfg.accent }}>[{trader.bias.toUpperCase()}]</span>
                </div>
                <div className="flex justify-between">
                  <span>CONFIDENCE:</span>
                  <span>{trader.confidence}%</span>
                </div>

                {/* Open position */}
                {trader.openPosition ? (
                  <div className="border border-dashed p-2 text-[7px] flex flex-col gap-[3px]" style={{ borderColor: cfg.accent + "66" }}>
                    <div className="flex justify-between">
                      <span>POSITION:</span>
                      <span style={{ color: trader.openPosition.direction === "BUY" ? "#00ff88" : "#ff4444" }}>
                        [{trader.openPosition.direction}] @ {trader.openPosition.entryPrice.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>SL / TP:</span>
                      <span className="text-muted-foreground">
                        {trader.openPosition.stopLoss.toFixed(0)} / {trader.openPosition.takeProfit.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>UNREAL P/L:</span>
                      <span style={{ color: plColor }}>{fmtPL(trader.openPosition.unrealizedPL)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span>POSITION:</span>
                    <span className="text-muted-foreground">NONE</span>
                  </div>
                )}

                {/* Last closed trade */}
                {trader.closedTrades.length > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>LAST TRADE:</span>
                    <span style={{ color: trader.closedTrades[0].result >= 0 ? "#00ff88" : "#ff4444" }}>
                      {trader.closedTrades[0].direction} {trader.closedTrades[0].rMultiple >= 0 ? "+" : ""}{trader.closedTrades[0].rMultiple.toFixed(1)}R
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>STRATEGY:</span>
                  <span>{trader.strategyVersion}</span>
                </div>
              </div>

              {/* Personality bars */}
              <div>
                <h3 className="text-[7px] mb-2" style={{ color: cfg.accent }}>PERSONALITY:</h3>
                <div className="flex flex-col gap-[5px]">
                  {[
                    { label: "DISCIPLINE", val: trader.personality.discipline },
                    { label: "AGGRESSION", val: trader.personality.aggression },
                    { label: "PATIENCE", val: trader.personality.patience },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <span className="text-[7px] w-[72px] shrink-0">{stat.label}</span>
                      <div className="flex-1 h-[6px] bg-[#111] border border-[#333]">
                        <div className="h-full" style={{ width: `${stat.val}%`, backgroundColor: cfg.accent }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2 mt-auto pt-2">
                <button
                  className="w-full p-2 text-[8px] transition-all border"
                  style={{ borderColor: cfg.accent, color: cfg.accent }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 10px ${cfg.glowColor}`; (e.currentTarget as HTMLElement).style.backgroundColor = cfg.accent + "22"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  onClick={() => openModal("pc", trader.id)}
                  data-testid={`btn-pc-${trader.id}`}
                >
                  [OPEN PC]
                </button>
                <button
                  className="w-full border border-secondary text-secondary p-2 text-[8px] transition-all"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(0,204,255,0.4)"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,204,255,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  onClick={() => openModal("journal", trader.id)}
                  data-testid={`btn-journal-${trader.id}`}
                >
                  [OPEN JOURNAL]
                </button>
                <button
                  className="w-full p-2 text-[8px] transition-all border"
                  style={{ borderColor: "#ffaa00", color: "#ffaa00" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(255,170,0,0.4)"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,170,0,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  onClick={() => openModal("history", trader.id)}
                  data-testid={`btn-history-${trader.id}`}
                >
                  [TRADE HISTORY] {trader.closedTrades.length > 0 ? `(${trader.closedTrades.length})` : ""}
                </button>
                <button
                  className="w-full border border-destructive text-destructive p-2 text-[8px] transition-all"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(255,0,0,0.4)"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,0,0,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                  onClick={() => openModal("demote", trader.id)}
                  data-testid={`btn-demote-${trader.id}`}
                >
                  [DEMOTE]
                </button>
              </div>
            </div>
          );
        })}
      </main>

      {/* ── Global chat button ──────────────────────────────────────────── */}
      <div className="p-4 flex justify-center pb-8 mt-4">
        <button
          className="w-full md:w-auto px-8 py-4 border-2 border-primary text-primary text-[9px] transition-all"
          style={{ boxShadow: "0 0 15px rgba(0,255,136,0.4)", animation: "globalChatPulse 2.5s ease-in-out infinite" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,255,136,0.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          onClick={() => openModal("chat")}
          data-testid="btn-chat"
        >
          [OPEN TRADING FLOOR CHAT]
        </button>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/85 z-[10000] flex items-center justify-center p-4" onClick={closeModal}>
          <div
            className="w-full max-w-2xl bg-card border-2 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderColor: activeModal.traderId ? TRADER_CONFIG[activeModal.traderId].accent : "#00ff88",
              boxShadow: `0 0 30px ${activeModal.traderId ? TRADER_CONFIG[activeModal.traderId].glowColor : "rgba(0,255,136,0.3)"}`,
            }}
          >
            {/* Modal header */}
            <div className="border-b p-3 flex justify-between items-center bg-[#080810]" style={{ borderColor: (activeModal.traderId ? TRADER_CONFIG[activeModal.traderId].accent : "#00ff88") + "55" }}>
              <h2 className="text-[9px] text-primary">
                {activeModal.type === "chat" ? "// TRADING FLOOR CHAT"
                  : activeModal.type === "demote" ? "// SYSTEM ALERT"
                  : activeModal.type === "history" ? `// ${activeTrader?.name} — TRADE HISTORY`
                  : `// ${activeTrader?.name} — ${activeModal.type === "pc" ? "PC VIEW" : "JOURNAL"}`}
              </h2>
              <button onClick={closeModal} className="text-primary hover:text-white text-[9px] px-2" data-testid="btn-close-modal">[X]</button>
            </div>

            <div className="p-4 overflow-y-auto text-[8px] text-foreground flex-1 leading-relaxed">

              {/* ── PC View ──────────────────────────────────────────────── */}
              {activeModal.type === "pc" && activeTrader && (
                <PCView
                  trader={activeTrader}
                  accent={TRADER_CONFIG[activeTrader.id].accent}
                  chatMessages={pcChatMessages[activeTrader.id]}
                  chatInput={pcChatInput[activeTrader.id]}
                  onChatInputChange={(value) =>
                    setPcChatInput((prev) => ({ ...prev, [activeTrader.id]: value }))
                  }
                  onSendChat={() => handleSendPCChat(activeTrader.id)}
                />
              )}

              {/* ── Journal ──────────────────────────────────────────────── */}
              {activeModal.type === "journal" && activeTrader && (
                <JournalView
                  trader={activeTrader}
                  accent={TRADER_CONFIG[activeTrader.id].accent}
                />
              )}

              {/* ── Chat ─────────────────────────────────────────────────── */}
              {activeModal.type === "chat" && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex flex-col gap-[6px]">
                    {chatMessages.map((entry, i) => (
                      <div key={i} className="flex gap-2 items-baseline">
                        <span className="text-muted-foreground shrink-0 text-[7px]">[{entry.time}]</span>
                        <span className="font-bold shrink-0" style={{ color: entry.color }}>{entry.name}:</span>
                        <span>{entry.msg}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-border pt-3 flex items-center gap-2">
                    <span className="text-primary">&gt;</span>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendChat();
                      }}
                      placeholder="[type message...]"
                      className="bg-transparent border-none outline-none flex-1 text-[8px] text-foreground"
                      data-testid="chat-input"
                    />
                    <button
                      onClick={handleSendChat}
                      className="border border-primary px-3 py-1 text-primary text-[8px] hover:bg-primary/20 transition-all"
                      data-testid="btn-send-chat"
                    >
                      [SEND]
                    </button>
                  </div>
                </div>
              )}

              {/* ── Trade History ────────────────────────────────────────── */}
              {activeModal.type === "history" && activeTrader && (() => {
                const cfg = TRADER_CONFIG[activeTrader.id];
                const trades = activeTrader.closedTrades;
                const wins = trades.filter((t) => t.result >= 0).length;
                const losses = trades.length - wins;
                const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
                const totalPL = trades.reduce((s, t) => s + t.balanceChange, 0);
                const bestTrade = trades.length > 0 ? trades.reduce((b, t) => t.rMultiple > b.rMultiple ? t : b) : null;
                const worstTrade = trades.length > 0 ? trades.reduce((w, t) => t.rMultiple < w.rMultiple ? t : w) : null;

                // running balance (trades are newest-first, so reverse to replay)
                const ordered = [...trades].reverse();
                const startBal = 1000;
                const runningBals: number[] = [];
                let bal = startBal;
                for (const t of ordered) {
                  bal += t.balanceChange;
                  runningBals.push(Math.round(bal * 100) / 100);
                }
                runningBals.reverse();

                // streak
                let streak = 0;
                let streakType = "";
                for (const t of trades) {
                  if (streak === 0) { streakType = t.result >= 0 ? "W" : "L"; streak = 1; }
                  else if ((t.result >= 0 && streakType === "W") || (t.result < 0 && streakType === "L")) streak++;
                  else break;
                }

                return (
                  <div className="flex flex-col gap-4" style={{ color: cfg.accent }}>

                    {/* Summary stats */}
                    <div className="border p-3 flex flex-col gap-2" style={{ borderColor: cfg.accent + "44", backgroundColor: cfg.accent + "08" }}>
                      <div className="text-[7px] text-muted-foreground mb-1">PERFORMANCE SUMMARY</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[8px]">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">TRADES:</span>
                          <span>{trades.length}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">WIN RATE:</span>
                          <span style={{ color: winRate >= 50 ? "#00ff88" : "#ff4444" }}>{winRate}%</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">WINS:</span>
                          <span style={{ color: "#00ff88" }}>{wins}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">LOSSES:</span>
                          <span style={{ color: "#ff4444" }}>{losses}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">TOTAL P/L:</span>
                          <span style={{ color: totalPL >= 0 ? "#00ff88" : "#ff4444" }}>
                            {totalPL >= 0 ? "+" : ""}R{totalPL.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">BALANCE:</span>
                          <span>{fmtBal(activeTrader.balance)}</span>
                        </div>
                        {bestTrade && (
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">BEST:</span>
                            <span style={{ color: "#00ff88" }}>+{bestTrade.rMultiple.toFixed(1)}R</span>
                          </div>
                        )}
                        {worstTrade && (
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">WORST:</span>
                            <span style={{ color: "#ff4444" }}>{worstTrade.rMultiple.toFixed(1)}R</span>
                          </div>
                        )}
                      </div>

                      {/* Win/loss streak */}
                      {streak > 0 && (
                        <div className="flex items-center gap-2 mt-1 pt-2 border-t" style={{ borderColor: cfg.accent + "33" }}>
                          <span className="text-[7px] text-muted-foreground">CURRENT STREAK:</span>
                          <div className="flex gap-[3px]">
                            {Array.from({ length: Math.min(streak, 8) }).map((_, i) => (
                              <div
                                key={i}
                                style={{
                                  width: 8, height: 8,
                                  backgroundColor: streakType === "W" ? "#00ff88" : "#ff4444",
                                  opacity: 1 - (Math.min(streak, 8) - 1 - i) * 0.1,
                                }}
                              />
                            ))}
                          </div>
                          <span
                            className="text-[7px]"
                            style={{ color: streakType === "W" ? "#00ff88" : "#ff4444" }}
                          >
                            {streak}{streakType} STREAK
                          </span>
                        </div>
                      )}

                      {/* Mini equity bar */}
                      {trades.length > 0 && (
                        <div className="mt-1 pt-2 border-t" style={{ borderColor: cfg.accent + "33" }}>
                          <div className="text-[7px] text-muted-foreground mb-1">EQUITY CURVE</div>
                          <div className="flex items-end gap-[2px] h-[20px]">
                            {[startBal, ...runningBals.slice().reverse()].map((b, i) => {
                              const min = Math.min(startBal, ...runningBals);
                              const max = Math.max(startBal, ...runningBals);
                              const range = Math.max(max - min, 1);
                              const pct = Math.round(((b - min) / range) * 18) + 2;
                              return (
                                <div
                                  key={i}
                                  style={{
                                    width: 4, height: pct,
                                    backgroundColor: b >= startBal ? "#00ff88" : "#ff4444",
                                    opacity: 0.85,
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Trade table */}
                    {trades.length === 0 ? (
                      <div className="text-[8px] text-muted-foreground text-center py-6">
                        No closed trades yet.<br />
                        <span style={{ color: cfg.accent }}>Simulation running...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0">
                        {/* Table header */}
                        <div
                          className="grid text-[7px] text-muted-foreground pb-1 mb-1 border-b"
                          style={{
                            gridTemplateColumns: "1.2rem 3.5rem 3.5rem 3.5rem 2.5rem 3rem 1fr",
                            borderColor: cfg.accent + "33",
                          }}
                        >
                          <span>#</span>
                          <span>DIR</span>
                          <span>ENTRY</span>
                          <span>EXIT</span>
                          <span>R</span>
                          <span>P/L</span>
                          <span>BAL AFTER</span>
                        </div>

                        {/* Table rows (newest first) */}
                        {trades.map((t, i) => {
                          const isWin = t.result >= 0;
                          const rowBal = runningBals[i];
                          return (
                            <div
                              key={i}
                              className="grid py-[3px] border-b text-[7px]"
                              style={{
                                gridTemplateColumns: "1.2rem 3.5rem 3.5rem 3.5rem 2.5rem 3rem 1fr",
                                borderColor: cfg.accent + "18",
                                backgroundColor: i % 2 === 0 ? cfg.accent + "05" : "transparent",
                              }}
                            >
                              <span className="text-muted-foreground">{trades.length - i}</span>
                              <span style={{ color: t.direction === "BUY" ? "#00ff88" : "#ff4444" }}>
                                {t.direction}
                              </span>
                              <span>{t.entryPrice.toFixed(0)}</span>
                              <span>{t.exitPrice.toFixed(0)}</span>
                              <span style={{ color: isWin ? "#00ff88" : "#ff4444" }}>
                                {isWin ? "+" : ""}{t.rMultiple.toFixed(1)}R
                              </span>
                              <span style={{ color: isWin ? "#00ff88" : "#ff4444" }}>
                                {isWin ? "+" : ""}R{t.result.toFixed(0)}
                              </span>
                              <span style={{ color: rowBal >= startBal ? "#00ff88" : "#ff4444" }}>
                                {fmtBal(rowBal)}
                              </span>
                            </div>
                          );
                        })}

                        {/* Reason column separately */}
                        <div className="mt-3">
                          <div className="text-[7px] text-muted-foreground mb-1">TRADE NOTES</div>
                          {trades.map((t, i) => (
                            <div key={i} className="flex gap-2 text-[7px] py-[2px] border-b" style={{ borderColor: cfg.accent + "18" }}>
                              <span className="text-muted-foreground shrink-0">#{trades.length - i}</span>
                              <span
                                className="shrink-0"
                                style={{ color: t.result >= 0 ? "#00ff88" : "#ff4444" }}
                              >
                                {t.direction}
                              </span>
                              <span className="text-muted-foreground">{t.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Demote ───────────────────────────────────────────────── */}
              {activeModal.type === "demote" && activeTrader && (
                <div className="flex flex-col gap-6 items-center justify-center py-8 text-center">
                  <div className="text-destructive leading-loose text-[8px]">
                    WARNING: You are about to DEMOTE<br />
                    <span style={{ color: TRADER_CONFIG[activeTrader.id].accent }}>{activeTrader.name}</span>.<br />
                    This action will be logged in the system.
                  </div>
                  <div className="flex gap-4">
                    <button onClick={closeModal} className="border border-border px-4 py-2 text-[8px] hover:bg-white/10 transition-all" data-testid="btn-demote-cancel">[CANCEL]</button>
                    <button
                      onClick={() => {
                        handleDemote(activeTrader.id);
                        closeModal();
                      }}
                      className="border border-destructive text-destructive px-4 py-2 text-[8px] hover:bg-destructive/20 transition-all"
                      style={{ boxShadow: "0 0 10px rgba(255,0,0,0.4)" }}
                      data-testid="btn-demote-confirm"
                    >
                      [CONFIRM]
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
