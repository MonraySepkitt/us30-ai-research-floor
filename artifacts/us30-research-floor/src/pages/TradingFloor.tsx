import { useState, useEffect, useRef, useCallback } from "react";
import { candles1H, candles4H, getLatestPrice } from "../data/demoMarketData";
import { getInitialTraderStates, type TraderState, type TraderId } from "../simulation/traderEngine";
import { runICTCycle, runTrendCycle, runBreakoutCycle } from "../simulation/traderStrategies";

// ─── Visual config (accent colours, no simulation data) ───────────────────

const TRADER_CONFIG: Record<TraderId, {
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

// ─── Helpers ──────────────────────────────────────────────────────────────

function getSASTTime() {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function getMarketStatus() {
  const now = new Date();
  const day = now.toLocaleDateString("en-ZA", { weekday: "long", timeZone: "Africa/Johannesburg" });
  const time = now.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour12: false });
  const [h, m] = time.split(":").map(Number);
  const mins = h * 60 + m;
  return !["Saturday", "Sunday"].includes(day) && mins >= 15 * 60 + 30 && mins < 22 * 60;
}

function statusBadgeColor(status: string) {
  switch (status) {
    case "Active": case "IN TRADE": return "#00ff88";
    case "Observation": return "#ffcc00";
    case "Rehabilitation": case "REHAB": return "#ff6600";
    case "Suspended": return "#ff2222";
    default: return "#00ccff";
  }
}

function fmtBal(n: number) {
  return `R${n.toFixed(2)}`;
}

function fmtPL(n: number) {
  return (n >= 0 ? "+" : "") + `R${n.toFixed(2)}`;
}

// ─── Activity log entry ───────────────────────────────────────────────────

interface ActivityEntry {
  id: number;
  time: string;
  traderId: string;
  msg: string;
}

// ─── Animated trader desk ─────────────────────────────────────────────────

function TraderDesk({ trader }: { trader: TraderState }) {
  const cfg = TRADER_CONFIG[trader.id];
  const [cursorOn, setCursorOn] = useState(true);
  const [chartFrame, setChartFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setChartFrame((f) => (f + 1) % 8), 650);
    return () => clearInterval(id);
  }, []);

  const chartBars = [
    [3, 6, 4, 7, 5, 8, 6, 5],
    [4, 5, 7, 4, 8, 5, 7, 6],
    [5, 7, 3, 8, 4, 6, 5, 7],
    [6, 4, 8, 5, 7, 3, 8, 4],
    [4, 8, 5, 6, 3, 7, 5, 8],
    [7, 5, 6, 4, 8, 5, 6, 4],
    [3, 7, 5, 8, 4, 6, 7, 5],
    [8, 4, 7, 5, 6, 4, 7, 8],
  ];

  const isInTrade = trader.status === "IN TRADE";

  return (
    <div className="flex flex-col items-center gap-1" style={{ minWidth: 72 }}>
      {/* Status bubble */}
      <div
        className="px-[5px] py-[2px] text-[6px] border"
        style={{
          borderColor: cfg.accent,
          color: cfg.accent,
          boxShadow: `0 0 6px ${cfg.glowColor}`,
          animation: "statusPulse 2s ease-in-out infinite",
        }}
        data-testid={`status-bubble-${trader.id}`}
      >
        {trader.status}
      </div>

      {/* Figure + Desk */}
      <div className="relative flex flex-col items-center" style={{ width: 64, height: 68 }}>
        <div className="absolute" style={{ bottom: 28, width: 12, height: 12, backgroundColor: "#ffcc88", border: "2px solid #333", left: "50%", transform: "translateX(-50%)" }} />
        <div className="absolute" style={{ bottom: 16, width: 16, height: 12, backgroundColor: cfg.shirtColor, border: `2px solid ${cfg.accent}`, left: "50%", transform: "translateX(-50%)" }} />
        <div className="absolute bottom-0" style={{ width: 64, height: 14, backgroundColor: cfg.deskColor, border: `2px solid ${cfg.accent}`, boxShadow: `0 0 8px ${cfg.glowColor}` }} />

        {/* Monitor */}
        <div
          className="absolute"
          style={{
            bottom: 14, left: "50%", transform: "translateX(-50%)",
            width: 30, height: 22,
            backgroundColor: "#111",
            border: `2px solid ${isInTrade ? "#00ff44" : cfg.accent}`,
            boxShadow: `0 0 ${isInTrade ? 14 : 8}px ${isInTrade ? "rgba(0,255,68,0.6)" : cfg.glowColor}`,
            zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            animation: "monitorFlicker 8s step-start infinite",
          }}
        >
          <div style={{ width: 24, height: 16, backgroundColor: cfg.monitorBg, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "1px", gap: 1, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "1px", height: 10, width: "100%" }}>
              {chartBars[chartFrame].map((h, i) => (
                <div key={i} style={{ width: 2, height: h, backgroundColor: i % 3 === 1 ? "#ff4444" : cfg.monitorLine, opacity: 0.9, transition: "height 0.25s ease" }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", height: 3 }}>
              <div style={{ width: 2, height: 3, backgroundColor: cursorOn ? cfg.monitorLine : "transparent" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Name tag */}
      <div className="text-center text-[7px] leading-tight" style={{ color: cfg.accent, maxWidth: 72 }}>
        <div>{trader.id === "ict" ? "ICT" : trader.id === "trend" ? "TREND" : "BRKOUT"}</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 6 }}>TRADER</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function TradingFloor() {
  const [time, setTime] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [traderStates, setTraderStates] = useState<TraderState[]>(getInitialTraderStates);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activeModal, setActiveModal] = useState<{ type: string; traderId?: TraderId } | null>(null);
  const [nextCycleIn, setNextCycleIn] = useState(35);
  const cycleCounterRef = useRef(0);
  const activityIdRef = useRef(0);

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
                  : `// ${activeTrader?.name} — ${activeModal.type === "pc" ? "PC VIEW" : "JOURNAL"}`}
              </h2>
              <button onClick={closeModal} className="text-primary hover:text-white text-[9px] px-2" data-testid="btn-close-modal">[X]</button>
            </div>

            <div className="p-4 overflow-y-auto text-[8px] text-foreground flex-1 leading-relaxed">

              {/* ── PC View ──────────────────────────────────────────────── */}
              {activeModal.type === "pc" && activeTrader && (() => {
                const cfg = TRADER_CONFIG[activeTrader.id];
                const pos = activeTrader.openPosition;
                return (
                  <div className="flex flex-col gap-[6px] font-mono" style={{ color: cfg.accent }}>
                    <div className="text-[7px] text-muted-foreground mb-1">─────────────────────────────────</div>
                    <div>&gt; TRADER: {activeTrader.name}</div>
                    <div>&gt; STRATEGY: {activeTrader.strategyVersion} — {activeTrader.strategyFocus}</div>
                    <div>&gt; STATUS: {activeTrader.status}</div>
                    <div>&gt; TIMEFRAMES: {activeTrader.timeframesReviewed.join(", ")}</div>
                    <div className="text-[7px] text-muted-foreground my-1">─────────────────────────────────</div>
                    <div>&gt; BIAS: {activeTrader.bias.toUpperCase()} ({activeTrader.confidence}% confidence)</div>
                    <div>&gt; ACTION: {activeTrader.currentAction}</div>
                    <div className="text-[7px] text-muted-foreground my-1">─────────────────────────────────</div>
                    <div className="text-[7px] text-muted-foreground">INTERNAL REASONING:</div>
                    <div className="text-[7px] leading-relaxed pl-2 opacity-90">{activeTrader.internalReasoning}</div>
                    <div className="text-[7px] text-muted-foreground mt-1">ALTERNATIVE SCENARIO:</div>
                    <div className="text-[7px] leading-relaxed pl-2 opacity-80">{activeTrader.alternativeScenario}</div>
                    <div className="text-[7px] text-muted-foreground my-1">─────────────────────────────────</div>
                    <div>&gt; LAST DECISION: {activeTrader.recentDecision}</div>
                    {pos ? (
                      <>
                        <div className="text-[7px] text-muted-foreground my-1">─────────────────────────────────</div>
                        <div className="text-[7px] text-muted-foreground">OPEN POSITION:</div>
                        <div className="pl-2 flex flex-col gap-[3px] text-[7px]">
                          <div>&gt; {pos.direction} @ {pos.entryPrice.toFixed(1)}</div>
                          <div>&gt; SL: {pos.stopLoss.toFixed(1)} | TP: {pos.takeProfit.toFixed(1)}</div>
                          <div>&gt; SIZE: {pos.size.toFixed(3)} lots</div>
                          <div style={{ color: pos.unrealizedPL >= 0 ? "#00ff88" : "#ff4444" }}>
                            &gt; UNREAL P/L: {fmtPL(pos.unrealizedPL)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div>&gt; POSITION: NONE</div>
                    )}
                    {activeTrader.closedTrades.length > 0 && (
                      <>
                        <div className="text-[7px] text-muted-foreground my-1">─────────────────────────────────</div>
                        <div className="text-[7px] text-muted-foreground">RECENT TRADE:</div>
                        <div className="pl-2 text-[7px] flex flex-col gap-[2px]">
                          <div>&gt; {activeTrader.closedTrades[0].direction} {activeTrader.closedTrades[0].entryPrice.toFixed(0)} → {activeTrader.closedTrades[0].exitPrice.toFixed(0)}</div>
                          <div style={{ color: activeTrader.closedTrades[0].result >= 0 ? "#00ff88" : "#ff4444" }}>
                            &gt; RESULT: {activeTrader.closedTrades[0].rMultiple >= 0 ? "+" : ""}{activeTrader.closedTrades[0].rMultiple.toFixed(1)}R ({fmtPL(activeTrader.closedTrades[0].result)})
                          </div>
                          <div className="text-muted-foreground">&gt; REASON: {activeTrader.closedTrades[0].reason}</div>
                        </div>
                      </>
                    )}
                    <div className="text-[7px] text-muted-foreground my-1">─────────────────────────────────</div>
                    <div>&gt; BALANCE: {fmtBal(activeTrader.balance)}</div>
                    <div className="mt-3 flex items-center gap-1">
                      <span>&gt;</span>
                      <span className="inline-block" style={{ width: 6, height: 12, backgroundColor: cfg.accent, animation: "cursorBlink 1s step-end infinite" }} />
                    </div>
                  </div>
                );
              })()}

              {/* ── Journal ──────────────────────────────────────────────── */}
              {activeModal.type === "journal" && activeTrader && (() => {
                const cfg = TRADER_CONFIG[activeTrader.id];
                const today = new Date().toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" });
                return (
                  <div className="flex flex-col gap-5" style={{ color: cfg.accent }}>
                    <div>
                      <div className="text-secondary">[{today}] Entry {String(1 + (activeTrader.closedTrades.length)).padStart(3, "0")}</div>
                      <div className="text-[#222]">{"─".repeat(32)}</div>
                      <div>Session started. Current bias: {activeTrader.bias.toUpperCase()}.</div>
                      <div>Confidence: {activeTrader.confidence}%.</div>
                      <div>Strategy focus: {activeTrader.strategyFocus}.</div>
                      <div>{activeTrader.currentAction}.</div>
                    </div>
                    {activeTrader.closedTrades.slice(0, 3).map((t, i) => (
                      <div key={i}>
                        <div className="text-secondary">[{today}] Trade Log #{i + 1}</div>
                        <div className="text-[#222]">{"─".repeat(32)}</div>
                        <div>{t.direction} @ {t.entryPrice.toFixed(0)} → {t.exitPrice.toFixed(0)}</div>
                        <div style={{ color: t.result >= 0 ? "#00ff88" : "#ff4444" }}>
                          Result: {t.rMultiple >= 0 ? "+" : ""}{t.rMultiple.toFixed(1)}R ({fmtPL(t.result)})
                        </div>
                        <div className="text-muted-foreground">Reason: {t.reason}</div>
                      </div>
                    ))}
                    {activeTrader.closedTrades.length === 0 && (
                      <div>
                        <div className="text-secondary">[{today}] Entry 001</div>
                        <div className="text-[#222]">{"─".repeat(32)}</div>
                        <div>No trades taken yet. Observing structure.</div>
                        <div>Focus area: patience and entry timing.</div>
                        <div>Next session target: clean execution.</div>
                        <div>Risk limit: 1% per trade.</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground">[NOTE] {activeTrader.internalReasoning}</div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Chat ─────────────────────────────────────────────────── */}
              {activeModal.type === "chat" && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex flex-col gap-[6px]">
                    {[
                      { time: "08:12", name: "FLOOR_MASTER", color: "#00ccff", msg: "Morning briefing. All traders check in." },
                      { time: "08:13", name: "ICT_TRADER", color: TRADER_CONFIG.ict.accent, msg: `Checked in. Bias ${traderStates[0].bias.toUpperCase()}. Confidence ${traderStates[0].confidence}%.` },
                      { time: "08:15", name: "TREND_TRADER", color: TRADER_CONFIG.trend.accent, msg: `${traderStates[1].currentAction}.` },
                      { time: "08:18", name: "BREAKOUT_TRADER", color: TRADER_CONFIG.breakout.accent, msg: `${traderStates[2].currentAction}.` },
                      { time: "08:20", name: "FLOOR_MASTER", color: "#00ccff", msg: "Risk below 1% today. Stay disciplined. No FOMO." },
                      { time: "08:28", name: "SYSTEM", color: "#555", msg: `Simulation active. Cycle #${cycleCounterRef.current}. Next cycle in ~${nextCycleIn}s.` },
                    ].map((entry, i) => (
                      <div key={i} className="flex gap-2 items-baseline">
                        <span className="text-muted-foreground shrink-0 text-[7px]">[{entry.time}]</span>
                        <span className="font-bold shrink-0" style={{ color: entry.color }}>{entry.name}:</span>
                        <span>{entry.msg}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-border pt-3 flex items-center gap-2">
                    <span className="text-primary">&gt;</span>
                    <input type="text" placeholder="[type message...]" className="bg-transparent border-none outline-none flex-1 text-[8px] text-foreground" data-testid="chat-input" />
                    <button className="border border-primary px-3 py-1 text-primary text-[8px] hover:bg-primary/20 transition-all" data-testid="btn-send-chat">[SEND]</button>
                  </div>
                </div>
              )}

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
                    <button onClick={closeModal} className="border border-destructive text-destructive px-4 py-2 text-[8px] hover:bg-destructive/20 transition-all" style={{ boxShadow: "0 0 10px rgba(255,0,0,0.4)" }} data-testid="btn-demote-confirm">[CONFIRM]</button>
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
