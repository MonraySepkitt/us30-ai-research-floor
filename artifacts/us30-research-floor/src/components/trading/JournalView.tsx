import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { TraderState } from "../../simulation/traderEngine";
import { fmtBal, fmtPL } from "../../lib/format";

export function JournalView({ trader, accent }: { trader: TraderState; accent: string }) {
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
