import React, { useState, useEffect } from "react";

const traders = [
  {
    id: "ict",
    name: "ICT TRADER",
    status: "Active",
    balance: "R1,000",
    action: "Waiting for OTE setup on 15M",
    bias: "Bullish",
    confidence: "72%",
    position: "None",
    strategyVersion: "v1.0",
    personality: { discipline: 68, aggression: 45, patience: 82 },
    shirtColor: "#0044ff",
  },
  {
    id: "trend",
    name: "TREND TRADER",
    status: "Observation",
    balance: "R1,000",
    action: "Monitoring 4H structure break",
    bias: "Neutral",
    confidence: "55%",
    position: "None",
    strategyVersion: "v1.0",
    personality: { discipline: 75, aggression: 60, patience: 70 },
    shirtColor: "#ff4400",
  },
  {
    id: "breakout",
    name: "BREAKOUT TRADER",
    status: "Rehabilitation",
    balance: "R1,000",
    action: "Reviewing last 3 losses",
    bias: "Bearish",
    confidence: "40%",
    position: "None",
    strategyVersion: "v1.0",
    personality: { discipline: 50, aggression: 80, patience: 35 },
    shirtColor: "#8800ff",
  },
];

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

export default function TradingFloor() {
  const [time, setTime] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<{ type: string; traderId?: string } | null>(null);

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

  const openModal = (type: string, traderId?: string) => {
    setActiveModal({ type, traderId });
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const activeTrader = activeModal?.traderId
    ? traders.find((t) => t.id === activeModal.traderId)
    : null;

  return (
    <div className="flex flex-col min-h-screen font-sans pb-10">
      {/* Header */}
      <header className="border-b border-border bg-card p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1
          className="text-primary text-sm md:text-base"
          style={{ textShadow: "0 0 10px #00ff88" }}
        >
          US30 AI RESEARCH FLOOR
        </h1>
        <div className="flex items-center gap-4 text-[10px]">
          <div className="text-secondary">{time}</div>
          <div
            className={`border px-2 py-1 ${
              marketOpen
                ? "border-primary text-primary"
                : "border-destructive text-destructive"
            }`}
          >
            {marketOpen ? "[OPEN]" : "[CLOSED]"}
          </div>
          <div className="border border-[#ffaa00] text-[#ffaa00] px-2 py-1">
            [DEMO DATA]
          </div>
        </div>
      </header>

      {/* Trading Floor Scene */}
      <section className="w-full h-[200px] border-b border-border flex flex-col overflow-hidden relative" style={{
        backgroundImage: 'linear-gradient(rgba(0, 255, 136, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 136, 0.1) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        backgroundColor: '#050508'
      }}>
        <div className="flex-1 flex justify-center items-end pb-4 gap-8 md:gap-16">
          {traders.map((trader) => (
            <div key={trader.id} className="flex flex-col items-center gap-2">
              {/* Trader Figure & Desk container */}
              <div className="relative w-[60px] h-[60px] flex justify-center items-end">
                {/* Figure */}
                <div className="absolute bottom-[12px] flex flex-col items-center">
                  <div className="w-[12px] h-[12px] bg-[#ffcc88] border-2 border-[#333]" />
                  <div
                    className="w-[16px] h-[12px] border-2 border-[#333]"
                    style={{ backgroundColor: trader.shirtColor }}
                  />
                </div>
                {/* Desk */}
                <div className="absolute bottom-0 w-[60px] h-[12px] bg-[#8B4513] border-2 border-[#333] z-10" />
                {/* Monitor */}
                <div className="absolute bottom-[12px] w-[24px] h-[20px] bg-[#111] border-2 border-[#333] z-20 flex justify-center items-center">
                  <div className="w-[16px] h-[12px] bg-[#0a2a1a] flex justify-start items-start p-[1px]">
                    <div className="w-[2px] h-[4px] bg-primary animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[8px] text-foreground">
                <div
                  className={`w-2 h-2 rounded-none ${
                    trader.status === "Active"
                      ? "bg-primary"
                      : trader.status === "Observation"
                      ? "bg-yellow-500"
                      : "bg-orange-500"
                  }`}
                />
                <span>{trader.name.split(" ")[0]}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Ticker */}
        <div className="absolute bottom-0 w-full h-[20px] bg-black border-t border-border overflow-hidden flex items-center">
          <div className="animate-ticker text-[8px] text-primary">
            US30 ▲ 43,250 | BIAS: BULLISH | SESSION: NY OPEN | SPREAD: 1.2 | VOLATILITY: MEDIUM | US30 ▲ 43,250 | BIAS: BULLISH | SESSION: NY OPEN | SPREAD: 1.2 | VOLATILITY: MEDIUM | US30 ▲ 43,250 | BIAS: BULLISH | SESSION: NY OPEN | SPREAD: 1.2 | VOLATILITY: MEDIUM
          </div>
        </div>
      </section>

      {/* Trader Cards */}
      <main className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto w-full flex-1">
        {traders.map((trader) => (
          <div
            key={trader.id}
            className="border border-border bg-card p-4 flex flex-col gap-4 shadow-[0_0_15px_rgba(0,255,136,0.05)]"
          >
            <div className="flex justify-between items-start border-b border-border pb-2">
              <h2 className="text-[10px] text-primary">{trader.name}</h2>
              <span
                className={`text-[8px] px-1 py-[2px] border ${
                  trader.status === "Active"
                    ? "border-primary text-primary"
                    : trader.status === "Observation"
                    ? "border-yellow-500 text-yellow-500"
                    : "border-orange-500 text-orange-500"
                }`}
              >
                [{trader.status.toUpperCase()}]
              </span>
            </div>

            <div className="text-[9px] flex flex-col gap-2">
              <div className="flex justify-between text-secondary">
                <span>BALANCE:</span>
                <span>{trader.balance}</span>
              </div>
              <div className="flex justify-between">
                <span>ACTION:</span>
                <span className="text-right max-w-[60%]">{trader.action}</span>
              </div>
              <div className="flex justify-between">
                <span>BIAS:</span>
                <span className="text-secondary">[{trader.bias.toUpperCase()}]</span>
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

            <div className="mt-2">
              <h3 className="text-[8px] text-secondary mb-2">PERSONALITY:</h3>
              <div className="flex flex-col gap-2">
                {[
                  { label: "DISCIPLINE", val: trader.personality.discipline },
                  { label: "AGGRESSION", val: trader.personality.aggression },
                  { label: "PATIENCE", val: trader.personality.patience },
                ].map((stat) => (
                  <div key={stat.label} className="flex justify-between items-center gap-2">
                    <span className="text-[8px] w-20">{stat.label}</span>
                    <div className="flex-1 h-2 flex bg-[#111] border border-[#333]">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${stat.val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto pt-4">
              <button
                className="w-full border border-primary text-primary p-2 text-[8px] hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(0,255,136,0.5)] transition-all"
                onClick={() => openModal("pc", trader.id)}
                data-testid={`btn-pc-${trader.id}`}
              >
                [OPEN PC]
              </button>
              <button
                className="w-full border border-secondary text-secondary p-2 text-[8px] hover:bg-secondary/20 hover:shadow-[0_0_10px_rgba(0,204,255,0.5)] transition-all"
                onClick={() => openModal("journal", trader.id)}
                data-testid={`btn-journal-${trader.id}`}
              >
                [OPEN JOURNAL]
              </button>
              <button
                className="w-full border border-destructive text-destructive p-2 text-[8px] hover:bg-destructive/20 hover:shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-all"
                onClick={() => openModal("demote", trader.id)}
                data-testid={`btn-demote-${trader.id}`}
              >
                [DEMOTE]
              </button>
            </div>
          </div>
        ))}
      </main>

      <div className="p-4 flex justify-center pb-8 mt-4">
        <button
          className="w-full md:w-auto px-8 py-4 border-2 border-primary text-primary text-[10px] shadow-[0_0_15px_rgba(0,255,136,0.5)] hover:bg-primary hover:text-primary-foreground transition-all animate-pulse"
          onClick={() => openModal("chat")}
          data-testid="btn-chat"
        >
          [OPEN TRADING FLOOR CHAT]
        </button>
      </div>

      {/* MODALS */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-card border-2 border-primary shadow-[0_0_30px_rgba(0,255,136,0.2)] flex flex-col max-h-[80vh]">
            <div className="border-b border-primary p-3 flex justify-between items-center bg-[#0a1a10]">
              <h2 className="text-[10px] text-primary">
                {activeModal.type === "chat"
                  ? "TRADING FLOOR CHAT"
                  : activeModal.type === "demote"
                  ? "SYSTEM ALERT"
                  : `${activeTrader?.name} - ${
                      activeModal.type === "pc" ? "PC VIEW" : "JOURNAL"
                    }`}
              </h2>
              <button
                onClick={closeModal}
                className="text-primary hover:text-white text-[10px]"
                data-testid="btn-close-modal"
              >
                [X]
              </button>
            </div>

            <div className="p-4 overflow-y-auto text-[9px] text-foreground flex-1 whitespace-pre-wrap leading-relaxed">
              {activeModal.type === "pc" && activeTrader && (
                <div className="flex flex-col gap-2">
                  <div>&gt; SYSTEM ONLINE</div>
                  <div>&gt; CONNECTING TO MARKET FEED...</div>
                  <div>&gt; US30 FEED: ACTIVE</div>
                  <div>&gt; LAST PRICE: 43,250.00</div>
                  <div>&gt; STRATEGY: {activeTrader.strategyVersion}</div>
                  <div>&gt; STATUS: {activeTrader.status.toUpperCase()}</div>
                  <div>&gt; AWAITING SIGNAL...</div>
                  <div>████████░░░░░░░░ 52% LOADED</div>
                  <div className="mt-4 flex">
                    <span>&gt; </span>
                    <span className="w-2 h-3 bg-primary animate-pulse ml-1 inline-block" />
                  </div>
                </div>
              )}

              {activeModal.type === "journal" && activeTrader && (
                <div className="flex flex-col gap-4">
                  <div>
                    <div>[2026-06-14] Entry 001</div>
                    <div className="text-primary opacity-50">─────────────────────</div>
                    <div>Session started. Bias set to {activeTrader.bias}.</div>
                    <div>No trades taken. Observing structure.</div>
                    <div>Confidence level: {activeTrader.confidence}</div>
                  </div>
                  <div>
                    <div>[2026-06-14] Entry 002</div>
                    <div className="text-primary opacity-50">─────────────────────</div>
                    <div>Reviewed previous session.</div>
                    <div>Focus area: patience and entry timing.</div>
                    <div>Next session target: Clean execution.</div>
                  </div>
                </div>
              )}

              {activeModal.type === "chat" && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex flex-col gap-2">
                    <div><span className="text-secondary">[08:12] FLOOR_MASTER:</span> Morning briefing starting</div>
                    <div><span className="text-primary">[08:15] ICT_TRADER:</span> Bias confirmed bullish above 43,100</div>
                    <div><span className="text-orange-500">[08:17] TREND_TRADER:</span> Watching 4H close for confirmation</div>
                    <div><span className="text-[#8800ff]">[08:20] BREAKOUT_TRADER:</span> Yesterday's stop hunt noted</div>
                    <div><span className="text-secondary">[08:22] FLOOR_MASTER:</span> Keep risk below 1%. Stay disciplined.</div>
                    <div><span className="text-muted-foreground">[08:30] SYSTEM:</span> Market opens in 30 mins</div>
                  </div>
                  <div className="mt-6 border-t border-border pt-4 flex items-center gap-2">
                    <span className="text-primary">&gt;</span>
                    <input 
                      type="text" 
                      placeholder="[type message...]" 
                      className="bg-transparent border-none outline-none flex-1 text-[9px] text-foreground"
                    />
                    <button className="border border-primary px-3 py-1 text-primary hover:bg-primary/20">
                      [SEND]
                    </button>
                  </div>
                </div>
              )}

              {activeModal.type === "demote" && activeTrader && (
                <div className="flex flex-col gap-6 items-center justify-center py-8">
                  <div className="text-destructive text-center leading-loose">
                    WARNING: You are about to DEMOTE {activeTrader.name}.
                    <br />
                    This action will be logged in the system.
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={closeModal}
                      className="border border-border px-4 py-2 hover:bg-white/10"
                    >
                      [CANCEL]
                    </button>
                    <button
                      onClick={closeModal}
                      className="border border-destructive text-destructive px-4 py-2 hover:bg-destructive/20 shadow-[0_0_10px_rgba(255,0,0,0.5)]"
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
