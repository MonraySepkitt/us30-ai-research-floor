# PROJECT_STATUS.md

## Project Name
**US30 AI Research Floor**

A dark, 8-bit pixel-art React web app simulating three AI-styled traders (ICT, Trend, Breakout) trading a demo US30 market. All logic is rule-based/local — there is no real AI model, no real market data feed, and no external API calls. Everything is deterministic/randomized demo data for entertainment and UI/UX exploration purposes.

## Current Completed Phase
**Phase 13 — Per-Trader Chat Inside PC View**

## Completed Phases (1–13)

1. **Foundation / Trading Floor Base** — Core layout: floor view, trader desks, status bubbles, animated pixel-art monitors, base dark theme.
2. **Trader Simulation Core** — `TraderState` model, per-trader bias/confidence/action simulation, simulated cycle ticking.
3. **Journal / Research UI** — Journal view (summary, trades, lessons, mistakes, improvements tabs) and research project display panels.
4. **LocalStorage Persistence** — Auto-save/load of `traderStates` and `activityLog` via `persistence.ts`, debounced auto-save, manual save/clear controls.
5. **Control Panel** — Save state now, reset simulation, clear saved data controls.
6. **Leaderboard** — Ranked trader comparison table (balance, win rate, P/L, avg R, best/worst, research count), sortable by metric.
7. **Equity Chart (recharts)** — Visual equity curve per trader (originally windowed to last 20 trades).
8. **Functional Trader Chat (global)** — Floor-wide chat modal with rule-based reply generator (`generateChatReply`) that answers using live trader state (bias, position, research, journal, balance) based on keyword matching. No external AI/API calls.
9. **Working Demote Button** — Resets a single trader back to its initial seeded state (balance, journal, research, reasoning memory, equity history) without affecting the other two traders.
10. **Personality-Driven Entry Thresholds** — Each trader's entry threshold is adjusted by a personality profile (discipline/aggression sliders) via `personalityAdjustedThreshold`.
11. **Research-Completion Threshold Bonus + Full-Session Equity History** —
    - A flat, one-time confidence/threshold bonus (`researchAdjustedThreshold`) once a trader has at least one `COMPLETE` research project.
    - `equityHistory` field added to `TraderState`, tracking every closed-trade balance point for the entire session (not just the last 20 trades). Backward-compatible backfill for old saved sessions. Chart now reads directly from `equityHistory`.
12. **Research Project Lifecycle** — When an `ACTIVE` research project reaches `COMPLETE`, a new `ACTIVE` follow-up project is automatically generated for that trader from a small hardcoded per-trader question pool (2 follow-ups each), capped at 5 total projects per trader, using unique IDs (`ict-r2`, `trend-r2`, etc.). Reuses the existing `generateResearchFinding()` text generator.
13. **Per-Trader Chat Inside PC View** — Each trader's PC View modal now has its own independent chat panel (separate message history + input, keyed by trader id). Replies are always forced to come from that specific trader (via `forcedSpeaker` param on `generateChatReply`), using the same rule-based logic as the global chat. Global floor-wide chat is unchanged and still works exactly as before.

## Major Systems Implemented

- **Simulation Engine** (`traderEngine.ts`): Trader state shape, initial seed data for all 3 traders, position open/close logic, balance/P/L updates, equity history tracking, journal/reasoning memory logging.
- **Strategy Logic** (`traderStrategies.ts`): Per-trader cycle runners (`runICTCycle`, `runTrendCycle`, `runBreakoutCycle`), entry threshold logic (personality + research bonuses), research tick/progress/completion logic, follow-up research generation.
- **Persistence** (`persistence.ts`): Generic, shape-agnostic localStorage save/load/clear for `traderStates` + `activityLog`. Does not persist chat, modal state, or UI-only state.
- **UI / Trading Floor Page** (`TradingFloor.tsx`): Main page component — floor view, trader desks, leaderboard, control panel, PC View, Journal View, global chat modal, per-trader chat, demote handling, activity log, simulation tick loop.
- **Rule-Based Chat** (`generateChatReply` in `TradingFloor.tsx`): Keyword-matched canned responses driven by live trader state; used by both the global chat and per-trader PC View chat (via `forcedSpeaker`).

## Key Files and What They Control

| File | Controls |
|---|---|
| `src/simulation/traderEngine.ts` | `TraderState` interface, initial trader seed data (`getInitialTraderStates`), position lifecycle (open/close), balance updates, equity history appends. |
| `src/simulation/traderStrategies.ts` | Per-trader cycle logic (bias/action/entry decisions), entry threshold adjustments (personality + research bonus), research tick/progress/completion, follow-up research question pools. |
| `src/pages/TradingFloor.tsx` | Main page: floor layout, trader desks, leaderboard, control panel, modals (PC View, Journal, Chat, History, Demote confirm), global chat, per-trader chat, simulation tick loop, activity log. |
| `src/lib/persistence.ts` | Generic localStorage save/load/clear for trader + activity state. Shape-agnostic — do not assume it knows about specific fields. |

## Current Limitations

- No real AI/LLM integration — all "trader intelligence" is deterministic/randomized rule-based logic, by design.
- No real market data — price/candle data is simulated/demo only.
- Chat (both global and per-trader) is **not persisted** — history resets on page reload. Only `traderStates` and `activityLog` survive reloads.
- Research follow-up pool is finite (2 follow-ups per trader, 3 total questions per trader lifetime) — once exhausted, `generateResearchFinding()` and `generateNextResearchProject()` will stop producing new projects for that trader (capped at 5 stored projects per trader).
- Per-trader PC chat and global chat both call the same `generateChatReply` function but do not share reply history or context — a question asked in one is not visible to the other.
- `TradingFloor.tsx` is a large, single-file page component (all major UI sections, modals, and simulation tick logic live in one file) — no code-splitting yet.
- No automated test suite; all verification has been manual (type-check + screenshot per phase).

## Next Recommended Phase

**Phase 14 — Codebase Audit & Safe Refactor Plan**

Goal: With 13 phases of additive patches now merged into a single large page file, audit `TradingFloor.tsx` (and related simulation files) for structural health — file size, duplicated patterns, prop-drilling, and opportunities to safely extract components/hooks — and produce a refactor plan *before* any code changes, following the same audit-first workflow used throughout this project.

## Safety Rules for Future Development

1. **Audit first, always.** Every new phase begins with an audit-only pass (no code changes) covering: what exists today, what's missing, which files need editing, the smallest safe patch, and risks to persistence/strategy logic. Code changes only proceed after explicit user confirmation.
2. **Small, additive patches only.** Prefer adding new fields/functions/optional parameters with safe defaults over modifying existing logic in place. Avoid broad rewrites.
3. **Respect file boundaries per phase.** Each phase's confirmed patch specifies exactly which files may be touched — do not edit files outside that scope (e.g. a UI-only phase should not touch `traderEngine.ts` or `traderStrategies.ts`).
4. **Do not change strategy/entry logic unless the phase is explicitly about strategy.** Entry thresholds, personality adjustments, and research bonuses are sensitive and load-bearing for simulation behavior.
5. **Do not change `persistence.ts` unless required.** It is intentionally generic/shape-agnostic; new fields on persisted objects should work automatically without modifying it. Only touch it if a phase explicitly requires a new persistence mechanism.
6. **Backward compatibility for persisted state.** Any new field added to `TraderState` must be backfilled/defaulted on load for old saved sessions (see `equityHistory` backfill in Phase 11 as the reference pattern).
7. **No external AI/API calls.** All trader "intelligence" and chat replies must remain local, rule-based, and deterministic/randomized — consistent with the project's demo-data design constraint.
8. **Type-check before declaring a phase done.** Run `npx tsc --noEmit` after every patch; it must pass clean before restarting the workflow and screenshotting for visual regressions.
9. **Screenshot and confirm before closing out a phase.** Visually verify the floor, leaderboard, and modals render without regressions, and report back to the user with the exact files changed.
