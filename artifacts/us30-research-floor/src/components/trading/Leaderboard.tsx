import { useMemo } from "react";
import type { TraderState } from "../../simulation/traderEngine";
import type { RankMetric } from "../../lib/types";
import { buildLeaderboardRows } from "../../lib/leaderboard";
import { fmtBal, fmtPL } from "../../lib/format";

const RANK_LABELS: Record<RankMetric, string> = {
  balance: "BALANCE",
  winRate: "WIN RATE",
  totalPL: "TOTAL P/L",
  avgR: "AVG R",
};

export function Leaderboard({
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
