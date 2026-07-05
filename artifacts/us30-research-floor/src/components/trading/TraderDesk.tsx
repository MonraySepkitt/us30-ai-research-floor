import { useState, useEffect } from "react";
import type { TraderState } from "../../simulation/traderEngine";
import { TRADER_CONFIG } from "../../lib/traderConfig";

export function TraderDesk({ trader }: { trader: TraderState }) {
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
