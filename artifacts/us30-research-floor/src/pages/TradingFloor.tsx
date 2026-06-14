import { useState, useEffect, useRef } from "react";

const TRADER_CONFIG = {
  ict: {
    accent: "#00ccff",
    glowColor: "rgba(0, 204, 255, 0.4)",
    deskColor: "#1a3a4a",
    shirtColor: "#004488",
    monitorBg: "#001a2a",
    monitorLine: "#00ccff",
    statusCycle: ["THINKING", "ANALYZING", "WAITING", "RESEARCHING", "WAITING"],
    statusColor: "#00ccff",
  },
  trend: {
    accent: "#00ff88",
    glowColor: "rgba(0, 255, 136, 0.4)",
    deskColor: "#1a3a2a",
    shirtColor: "#005522",
    monitorBg: "#001a0f",
    monitorLine: "#00ff88",
    statusCycle: ["ANALYZING", "RESEARCHING", "THINKING", "WAITING", "IN TRADE"],
    statusColor: "#00ff88",
  },
  breakout: {
    accent: "#ff6600",
    glowColor: "rgba(255, 102, 0, 0.4)",
    deskColor: "#3a2010",
    shirtColor: "#882200",
    monitorBg: "#1a0800",
    monitorLine: "#ff6600",
    statusCycle: ["REHAB", "THINKING", "WAITING", "REHAB", "ANALYZING"],
    statusColor: "#ff6600",
  },
};

const traders = [
  {
    id: "ict" as const,
    name: "ICT TRADER",
    shortName: "ICT",
    status: "Active",
    balance: "R1,000",
    action: "Waiting for OTE setup on 15M",
    bias: "Bullish",
    confidence: "72%",
    position: "None",
    strategyVersion: "v1.0",
    personality: { discipline: 68, aggression: 45, patience: 82 },
  },
  {
    id: "trend" as const,
    name: "TREND TRADER",
    shortName: "TREND",
    status: "Observation",
    balance: "R1,000",
    action: "Monitoring 4H structure break",
    bias: "Neutral",
    confidence: "55%",
    position: "None",
    strategyVersion: "v1.0",
    personality: { discipline: 75, aggression: 60, patience: 70 },
  },
  {
    id: "breakout" as const,
    name: "BREAKOUT TRADER",
    shortName: "BRKOUT",
    status: "Rehabilitation",
    balance: "R1,000",
    action: "Reviewing last 3 losses",
    bias: "Bearish",
    confidence: "40%",
    position: "None",
    strategyVersion: "v1.0",
    personality: { discipline: 50, aggression: 80, patience: 35 },
  },
];

const ACTIVITY_POOL = [
  { traderId: "ict", msg: "rejected long setup — OTE not clean" },
  { traderId: "trend", msg: "analyzing 1H structure break" },
  { traderId: "breakout", msg: "watching range compression on M15" },
  { traderId: "ict", msg: "waiting for liquidity sweep below 43,100" },
  { traderId: "trend", msg: "updated bias to neutral — waiting for 4H close" },
  { traderId: "breakout", msg: "reviewing last 3 losses — rehab protocol active" },
  { traderId: "ict", msg: "identified order block at 43,180" },
  { traderId: "trend", msg: "structure break confirmed on 1H" },
  { traderId: "breakout", msg: "noted stop hunt on previous session" },
  { traderId: "ict", msg: "FVG filled — monitoring for reaction" },
  { traderId: "trend", msg: "EMA stack aligning — bias shifting bullish" },
  { traderId: "breakout", msg: "compression tightening — breakout imminent" },
  { traderId: "ict", msg: "session bias: BULLISH above 43,100" },
  { traderId: "trend", msg: "risk adjusted to 0.5% pending confirmation" },
  { traderId: "breakout", msg: "passed patience check — no trade taken" },
];

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
  const day = now.toLocaleDateString("en-ZA", {
    weekday: "long",
    timeZone: "Africa/Johannesburg",
  });
  const time = now.toLocaleTimeString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour12: false,
  });
  const [h, m] = time.split(":").map(Number);
  const mins = h * 60 + m;
  const isWeekday = !["Saturday", "Sunday"].includes(day);
  return isWeekday && mins >= 15 * 60 + 30 && mins < 22 * 60;
}

interface ActivityEntry {
  id: number;
  time: string;
  traderId: string;
  msg: string;
}

function TraderDesk({ trader }: { trader: typeof traders[0] }) {
  const cfg = TRADER_CONFIG[trader.id];
  const [statusIdx, setStatusIdx] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const [chartFrame, setChartFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIdx((i) => (i + 1) % cfg.statusCycle.length);
    }, 2800 + trader.id.length * 400);
    return () => clearInterval(id);
  }, [cfg.statusCycle.length, trader.id]);

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setChartFrame((f) => (f + 1) % 8), 700);
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

  const currentBars = chartBars[chartFrame];
  const currentStatus = cfg.statusCycle[statusIdx];

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
        {currentStatus}
      </div>

      {/* Figure + Desk */}
      <div className="relative flex flex-col items-center" style={{ width: 64, height: 68 }}>
        {/* Head */}
        <div
          className="absolute"
          style={{
            bottom: 28,
            width: 12,
            height: 12,
            backgroundColor: "#ffcc88",
            border: "2px solid #333",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
        {/* Body / shirt */}
        <div
          className="absolute"
          style={{
            bottom: 16,
            width: 16,
            height: 12,
            backgroundColor: cfg.shirtColor,
            border: `2px solid ${cfg.accent}`,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
        {/* Desk */}
        <div
          className="absolute bottom-0"
          style={{
            width: 64,
            height: 14,
            backgroundColor: cfg.deskColor,
            border: `2px solid ${cfg.accent}`,
            boxShadow: `0 0 8px ${cfg.glowColor}`,
          }}
        />
        {/* Monitor */}
        <div
          className="absolute"
          style={{
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 30,
            height: 22,
            backgroundColor: "#111",
            border: `2px solid ${cfg.accent}`,
            boxShadow: `0 0 8px ${cfg.glowColor}`,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Screen */}
          <div
            style={{
              width: 24,
              height: 16,
              backgroundColor: cfg.monitorBg,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "flex-start",
              padding: "1px",
              gap: 1,
              overflow: "hidden",
            }}
          >
            {/* Mini chart bars */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "1px", height: 10, width: "100%" }}>
              {currentBars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 2,
                    height: h,
                    backgroundColor: i % 3 === 0 ? cfg.monitorLine : i % 3 === 1 ? "#ff4444" : cfg.monitorLine,
                    opacity: 0.9,
                    transition: "height 0.3s ease",
                  }}
                />
              ))}
            </div>
            {/* Cursor row */}
            <div style={{ display: "flex", alignItems: "center", height: 3 }}>
              <div
                style={{
                  width: 2,
                  height: 3,
                  backgroundColor: cursorOn ? cfg.monitorLine : "transparent",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Name tag */}
      <div
        className="text-center text-[7px] leading-tight"
        style={{ color: cfg.accent, maxWidth: 72 }}
      >
        <div>{trader.shortName}</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 6 }}>TRADER</div>
      </div>
    </div>
  );
}

export default function TradingFloor() {
  const [time, setTime] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<{ type: string; traderId?: string } | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const activityCounter = useRef(0);
  const activityPoolRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const sast = new Intl.DateTimeFormat("en-ZA", {
        timeZone: "Africa/Johannesburg",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      setTime(sast + " SAST");
      setMarketOpen(getMarketStatus());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const addEntry = () => {
      const pool = ACTIVITY_POOL[activityPoolRef.current % ACTIVITY_POOL.length];
      activityPoolRef.current++;
      activityCounter.current++;
      const entry: ActivityEntry = {
        id: activityCounter.current,
        time: getSASTTime(),
        traderId: pool.traderId,
        msg: pool.msg,
      };
      setActivityLog((prev) => [entry, ...prev].slice(0, 6));
    };
    addEntry();
    const id = setInterval(addEntry, 4200);
    return () => clearInterval(id);
  }, []);

  const openModal = (type: string, traderId?: string) => setActiveModal({ type, traderId });
  const closeModal = () => setActiveModal(null);
  const activeTrader = activeModal?.traderId ? traders.find((t) => t.id === activeModal.traderId) : null;

  function getTraderLabel(traderId: string) {
    const t = traders.find((t) => t.id === traderId);
    return t ? t.name : traderId.toUpperCase();
  }

  function getTraderAccent(traderId: string) {
    return TRADER_CONFIG[traderId as keyof typeof TRADER_CONFIG]?.accent ?? "#00ff88";
  }

  return (
    <div className="flex flex-col min-h-screen font-sans pb-10">
      {/* Header */}
      <header className="border-b border-border bg-card p-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <h1
          className="text-primary text-[10px] md:text-sm"
          style={{ textShadow: "0 0 10px #00ff88" }}
        >
          US30 AI RESEARCH FLOOR
        </h1>
        <div className="flex items-center gap-3 text-[8px] flex-wrap justify-center">
          <div className="text-secondary" data-testid="sast-clock">{time}</div>
          <div
            className={`border px-2 py-1 ${
              marketOpen ? "border-primary text-primary" : "border-destructive text-destructive"
            }`}
            style={{ boxShadow: marketOpen ? "0 0 6px rgba(0,255,136,0.3)" : "0 0 6px rgba(255,0,0,0.3)" }}
            data-testid="market-status"
          >
            {marketOpen ? "[OPEN]" : "[CLOSED]"}
          </div>
          <div className="border border-[#ffaa00] text-[#ffaa00] px-2 py-1" data-testid="demo-badge">
            [DEMO DATA]
          </div>
        </div>
      </header>

      {/* Trading Floor Scene */}
      <section
        className="w-full border-b border-border flex flex-col overflow-hidden relative"
        style={{
          height: 200,
          backgroundImage:
            "linear-gradient(rgba(0, 255, 136, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 136, 0.06) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundColor: "#040408",
        }}
      >
        {/* Scene label */}
        <div className="absolute top-2 left-3 text-[6px] text-muted-foreground opacity-60">
          FLOOR.VIEW // ACTIVE
        </div>

        <div className="flex-1 flex justify-center items-end pb-6 gap-6 md:gap-14">
          {traders.map((trader) => (
            <TraderDesk key={trader.id} trader={trader} />
          ))}
        </div>

        {/* Market price ticker */}
        <div className="absolute bottom-0 w-full h-[18px] bg-black border-t border-border overflow-hidden flex items-center">
          <div className="animate-ticker text-[7px] text-primary whitespace-nowrap inline-block">
            &nbsp;&nbsp;US30 43,250.00&nbsp;&nbsp;|&nbsp;&nbsp;BIAS: BULLISH&nbsp;&nbsp;|&nbsp;&nbsp;SESSION: NY PRE-MARKET&nbsp;&nbsp;|&nbsp;&nbsp;SPREAD: 1.2pts&nbsp;&nbsp;|&nbsp;&nbsp;VOL: MEDIUM&nbsp;&nbsp;|&nbsp;&nbsp;ATR: 85pts&nbsp;&nbsp;|&nbsp;&nbsp;US30 43,250.00&nbsp;&nbsp;|&nbsp;&nbsp;BIAS: BULLISH&nbsp;&nbsp;|&nbsp;&nbsp;SESSION: NY PRE-MARKET&nbsp;&nbsp;|&nbsp;&nbsp;SPREAD: 1.2pts&nbsp;&nbsp;|&nbsp;&nbsp;VOL: MEDIUM&nbsp;&nbsp;|&nbsp;&nbsp;ATR: 85pts&nbsp;&nbsp;
          </div>
        </div>
      </section>

      {/* Activity Feed */}
      <section className="border-b border-border bg-[#04040a] px-4 py-2" data-testid="activity-feed">
        <div className="text-[7px] text-muted-foreground mb-1">// ACTIVITY LOG</div>
        <div className="flex flex-col gap-[3px] min-h-[60px]">
          {activityLog.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-baseline gap-2 text-[7px] overflow-hidden"
              style={{ opacity: 1 - idx * 0.14, transition: "opacity 0.5s" }}
            >
              <span className="text-muted-foreground shrink-0">[{entry.time}]</span>
              <span
                className="shrink-0 font-bold"
                style={{ color: getTraderAccent(entry.traderId) }}
              >
                {getTraderLabel(entry.traderId)}:
              </span>
              <span className="text-foreground truncate">{entry.msg}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Trader Cards */}
      <main className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto w-full flex-1">
        {traders.map((trader) => {
          const cfg = TRADER_CONFIG[trader.id];
          return (
            <div
              key={trader.id}
              className="border bg-card p-4 flex flex-col gap-4"
              style={{
                borderColor: cfg.accent,
                boxShadow: `0 0 12px ${cfg.glowColor.replace("0.4", "0.08")}`,
              }}
              data-testid={`card-${trader.id}`}
            >
              <div
                className="flex justify-between items-start border-b pb-2"
                style={{ borderColor: cfg.accent + "44" }}
              >
                <h2 className="text-[10px]" style={{ color: cfg.accent }}>
                  {trader.name}
                </h2>
                <span
                  className="text-[7px] px-1 py-[2px] border"
                  style={{
                    borderColor:
                      trader.status === "Active"
                        ? cfg.accent
                        : trader.status === "Observation"
                        ? "#ffcc00"
                        : trader.status === "Rehabilitation"
                        ? "#ff6600"
                        : "#ff2222",
                    color:
                      trader.status === "Active"
                        ? cfg.accent
                        : trader.status === "Observation"
                        ? "#ffcc00"
                        : trader.status === "Rehabilitation"
                        ? "#ff6600"
                        : "#ff2222",
                  }}
                >
                  [{trader.status.toUpperCase()}]
                </span>
              </div>

              <div className="text-[8px] flex flex-col gap-[6px]">
                <div className="flex justify-between" style={{ color: cfg.accent }}>
                  <span>BALANCE:</span>
                  <span>{trader.balance}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0">ACTION:</span>
                  <span className="text-right">{trader.action}</span>
                </div>
                <div className="flex justify-between">
                  <span>BIAS:</span>
                  <span style={{ color: cfg.accent }}>[{trader.bias.toUpperCase()}]</span>
                </div>
                <div className="flex justify-between">
                  <span>CONFIDENCE:</span>
                  <span>{trader.confidence}</span>
                </div>
                <div className="flex justify-between">
                  <span>POSITION:</span>
                  <span>{trader.position.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>STRATEGY:</span>
                  <span>{trader.strategyVersion}</span>
                </div>
              </div>

              <div className="mt-1">
                <h3 className="text-[7px] mb-2" style={{ color: cfg.accent }}>
                  PERSONALITY:
                </h3>
                <div className="flex flex-col gap-[6px]">
                  {[
                    { label: "DISCIPLINE", val: trader.personality.discipline },
                    { label: "AGGRESSION", val: trader.personality.aggression },
                    { label: "PATIENCE", val: trader.personality.patience },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <span className="text-[7px] w-[72px] shrink-0">{stat.label}</span>
                      <div className="flex-1 h-[6px] flex bg-[#111] border border-[#333]">
                        <div
                          className="h-full"
                          style={{ width: `${stat.val}%`, backgroundColor: cfg.accent }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-auto pt-3">
                <button
                  className="w-full p-2 text-[8px] transition-all border"
                  style={{
                    borderColor: cfg.accent,
                    color: cfg.accent,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 10px ${cfg.glowColor}`;
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = cfg.accent + "22";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                  onClick={() => openModal("pc", trader.id)}
                  data-testid={`btn-pc-${trader.id}`}
                >
                  [OPEN PC]
                </button>
                <button
                  className="w-full border border-secondary text-secondary p-2 text-[8px] transition-all"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 10px rgba(0,204,255,0.4)";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,204,255,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                  onClick={() => openModal("journal", trader.id)}
                  data-testid={`btn-journal-${trader.id}`}
                >
                  [OPEN JOURNAL]
                </button>
                <button
                  className="w-full border border-destructive text-destructive p-2 text-[8px] transition-all"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 10px rgba(255,0,0,0.4)";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
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

      <div className="p-4 flex justify-center pb-8 mt-4">
        <button
          className="w-full md:w-auto px-8 py-4 border-2 border-primary text-primary text-[9px] transition-all"
          style={{
            boxShadow: "0 0 15px rgba(0,255,136,0.4)",
            animation: "globalChatPulse 2.5s ease-in-out infinite",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,255,136,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          }}
          onClick={() => openModal("chat")}
          data-testid="btn-chat"
        >
          [OPEN TRADING FLOOR CHAT]
        </button>
      </div>

      {/* MODALS */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/85 z-[10000] flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl bg-card border-2 flex flex-col max-h-[80vh]"
            style={{
              borderColor:
                activeModal.traderId
                  ? TRADER_CONFIG[activeModal.traderId as keyof typeof TRADER_CONFIG]?.accent ?? "#00ff88"
                  : "#00ff88",
              boxShadow: `0 0 30px ${
                activeModal.traderId
                  ? TRADER_CONFIG[activeModal.traderId as keyof typeof TRADER_CONFIG]?.glowColor ?? "rgba(0,255,136,0.3)"
                  : "rgba(0,255,136,0.3)"
              }`,
            }}
          >
            <div
              className="border-b p-3 flex justify-between items-center bg-[#080810]"
              style={{
                borderColor:
                  activeModal.traderId
                    ? TRADER_CONFIG[activeModal.traderId as keyof typeof TRADER_CONFIG]?.accent + "55" ?? "#00ff8855"
                    : "#00ff8855",
              }}
            >
              <h2 className="text-[9px] text-primary">
                {activeModal.type === "chat"
                  ? "// TRADING FLOOR CHAT"
                  : activeModal.type === "demote"
                  ? "// SYSTEM ALERT"
                  : `// ${activeTrader?.name} — ${activeModal.type === "pc" ? "PC VIEW" : "JOURNAL"}`}
              </h2>
              <button
                onClick={closeModal}
                className="text-primary hover:text-white text-[9px] px-2"
                data-testid="btn-close-modal"
              >
                [X]
              </button>
            </div>

            <div className="p-4 overflow-y-auto text-[8px] text-foreground flex-1 leading-relaxed">
              {activeModal.type === "pc" && activeTrader && (
                <div className="flex flex-col gap-[6px] text-primary font-mono">
                  <div className="text-muted-foreground text-[7px] mb-2">
                    ┌─────────────────────────────────────────┐
                  </div>
                  <div>&gt; SYSTEM ONLINE</div>
                  <div>&gt; CONNECTING TO MARKET FEED...</div>
                  <div style={{ color: TRADER_CONFIG[activeTrader.id].accent }}>
                    &gt; US30 FEED: ACTIVE
                  </div>
                  <div>&gt; LAST PRICE: 43,250.00</div>
                  <div>&gt; STRATEGY: {activeTrader.strategyVersion}</div>
                  <div>&gt; TRADER STATUS: {activeTrader.status.toUpperCase()}</div>
                  <div>&gt; SESSION BIAS: {activeTrader.bias.toUpperCase()}</div>
                  <div>&gt; CONFIDENCE: {activeTrader.confidence}</div>
                  <div>&gt; AWAITING SIGNAL...</div>
                  <div className="mt-2 text-[7px]">
                    <span style={{ color: TRADER_CONFIG[activeTrader.id].accent }}>
                      {"█".repeat(8)}
                    </span>
                    <span className="text-[#333]">{"░".repeat(8)}</span>
                    <span className="ml-2">52% LOADED</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    <span>&gt;</span>
                    <span
                      className="inline-block"
                      style={{
                        width: 6,
                        height: 12,
                        backgroundColor: TRADER_CONFIG[activeTrader.id].accent,
                        animation: "cursorBlink 1s step-end infinite",
                      }}
                    />
                  </div>
                </div>
              )}

              {activeModal.type === "journal" && activeTrader && (
                <div className="flex flex-col gap-5 text-primary">
                  <div className="flex flex-col gap-1">
                    <div className="text-secondary">[2026-06-14] Entry 001</div>
                    <div className="text-[#333]">{"─".repeat(32)}</div>
                    <div>Session started. Bias set to {activeTrader.bias.toUpperCase()}.</div>
                    <div>No trades taken. Observing structure.</div>
                    <div>Confidence level: {activeTrader.confidence}</div>
                    <div>Strategy version: {activeTrader.strategyVersion}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-secondary">[2026-06-14] Entry 002</div>
                    <div className="text-[#333]">{"─".repeat(32)}</div>
                    <div>Reviewed previous session results.</div>
                    <div>Focus area: patience and entry timing.</div>
                    <div>Next session target: Clean execution.</div>
                    <div>Risk limit confirmed: 1% max per trade.</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-secondary">[2026-06-13] Entry 003</div>
                    <div className="text-[#333]">{"─".repeat(32)}</div>
                    <div>Mental state: focused. No emotional trades.</div>
                    <div>Bias was invalidated at 43,050. Stayed out.</div>
                    <div>Discipline score: PASS.</div>
                  </div>
                </div>
              )}

              {activeModal.type === "chat" && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex flex-col gap-[6px]">
                    {[
                      { time: "08:12", name: "FLOOR_MASTER", color: "#00ccff", msg: "Morning briefing starting. All traders check in." },
                      { time: "08:13", name: "ICT_TRADER", color: TRADER_CONFIG.ict.accent, msg: "Checked in. Bias BULLISH above 43,100." },
                      { time: "08:15", name: "TREND_TRADER", color: TRADER_CONFIG.trend.accent, msg: "Watching 4H close for structure confirmation." },
                      { time: "08:18", name: "BREAKOUT_TRADER", color: TRADER_CONFIG.breakout.accent, msg: "Yesterday's stop hunt at 43,050 noted." },
                      { time: "08:20", name: "FLOOR_MASTER", color: "#00ccff", msg: "Risk below 1% today. Stay disciplined." },
                      { time: "08:28", name: "SYSTEM", color: "#888888", msg: "Market opens in 62 minutes." },
                    ].map((entry, i) => (
                      <div key={i} className="flex gap-2 items-baseline">
                        <span className="text-muted-foreground shrink-0 text-[7px]">[{entry.time}]</span>
                        <span className="font-bold shrink-0" style={{ color: entry.color }}>
                          {entry.name}:
                        </span>
                        <span>{entry.msg}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-border pt-3 flex items-center gap-2">
                    <span className="text-primary">&gt;</span>
                    <input
                      type="text"
                      placeholder="[type message...]"
                      className="bg-transparent border-none outline-none flex-1 text-[8px] text-foreground"
                      data-testid="chat-input"
                    />
                    <button
                      className="border border-primary px-3 py-1 text-primary text-[8px] hover:bg-primary/20 transition-all"
                      data-testid="btn-send-chat"
                    >
                      [SEND]
                    </button>
                  </div>
                </div>
              )}

              {activeModal.type === "demote" && activeTrader && (
                <div className="flex flex-col gap-6 items-center justify-center py-8 text-center">
                  <div className="text-destructive leading-loose text-[8px]">
                    WARNING: You are about to DEMOTE<br />
                    <span style={{ color: TRADER_CONFIG[activeTrader.id].accent }}>
                      {activeTrader.name}
                    </span>.<br />
                    This action will be logged in the system.
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={closeModal}
                      className="border border-border px-4 py-2 text-[8px] hover:bg-white/10 transition-all"
                      data-testid="btn-demote-cancel"
                    >
                      [CANCEL]
                    </button>
                    <button
                      onClick={closeModal}
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
