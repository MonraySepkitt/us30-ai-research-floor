// ─── Phase 4: Persistence & Control Layer ─────────────────────────────────
// Small localStorage helper for saving/loading/clearing simulation state.
// Deliberately generic — TradingFloor.tsx owns the actual shape being saved.

const STORAGE_KEY = "us30-research-floor:state";
const STORAGE_VERSION = 1;

export interface PersistedState<TTrader, TActivity> {
  version: number;
  savedAt: number;
  traderStates: TTrader[];
  activityLog: TActivity[];
}

export function loadPersistedState<TTrader, TActivity>(): PersistedState<TTrader, TActivity> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState<TTrader, TActivity>;
    if (!parsed || parsed.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(parsed.traderStates) || !Array.isArray(parsed.activityLog)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedState<TTrader, TActivity>(
  traderStates: TTrader[],
  activityLog: TActivity[]
): void {
  try {
    const payload: PersistedState<TTrader, TActivity> = {
      version: STORAGE_VERSION,
      savedAt: Date.now(),
      traderStates,
      activityLog,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable — fail silently, simulation keeps running in-memory.
  }
}

export function clearPersistedState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
