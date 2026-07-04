import type { Candle } from '../data/demoMarketData';
import {
  type TraderState,
  type SimEvent,
  type Bias,
  type TraderStatus,
  type RiskPlan,
  getSASTHHMM,
  checkAndUpdatePosition,
  buildPosition,
  appendReasoning,
} from './traderEngine';

// ─── Shared technical helpers ──────────────────────────────────────────────

function sma(candles: Candle[], period: number): number {
  const slice = candles.slice(-period);
  return slice.reduce((s, c) => s + c.close, 0) / slice.length;
}

function atr(candles: Candle[], period = 14): number {
  const slice = candles.slice(-period);
  const trs = slice.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = slice[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.reduce((s, v) => s + v, 0) / trs.length;
}

function swingHigh(candles: Candle[], lookback = 20): number {
  return Math.max(...candles.slice(-lookback).map((c) => c.high));
}

function swingLow(candles: Candle[], lookback = 20): number {
  return Math.min(...candles.slice(-lookback).map((c) => c.low));
}

function hasBullishFVG(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const [a, , c] = candles.slice(-3);
  return c.low > a.high;
}

function hasBearishFVG(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const [a, , c] = candles.slice(-3);
  return c.high < a.low;
}

function hasLiquiditySweepUp(candles: Candle[], lookback = 15): boolean {
  const recentHigh = swingHigh(candles.slice(0, -1), lookback);
  const last = candles[candles.length - 1];
  return last.high > recentHigh && last.close < recentHigh;
}

function hasLiquiditySweepDown(candles: Candle[], lookback = 15): boolean {
  const recentLow = swingLow(candles.slice(0, -1), lookback);
  const last = candles[candles.length - 1];
  return last.low < recentLow && last.close > recentLow;
}

function rangeHighLow(candles: Candle[], lookback = 12): { rangeH: number; rangeL: number; rangeSize: number } {
  const slice = candles.slice(-lookback);
  const rangeH = Math.max(...slice.map((c) => c.high));
  const rangeL = Math.min(...slice.map((c) => c.low));
  return { rangeH, rangeL, rangeSize: rangeH - rangeL };
}

function jitter(base: number, range: number): number {
  return Math.round(base + (Math.random() - 0.5) * range);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Personality-adjusted entry threshold.
// Aggression slightly lowers the required confidence (more willing to enter).
// Discipline slightly raises the required confidence (more selective about entries).
// Patience is intentionally not applied here — it requires tracking how long a
// setup has persisted across cycles, which doesn't exist yet. Deferred to a
// future phase once setup-persistence tracking is added.
function personalityAdjustedThreshold(base: number, personality: TraderState['personality']): number {
  const aggressionPull = (personality.aggression - 50) * 0.1;
  const disciplinePull = (personality.discipline - 50) * 0.1;
  return base - aggressionPull + disciplinePull;
}

// ─── Research project ticker ───────────────────────────────────────────────

function generateResearchFinding(id: TraderState['id'], progress: number, tradesReviewed: number): string {
  if (id === 'ict') {
    if (progress < 30) return `Logging session time for each sweep entry. ${tradesReviewed} trades recorded. Too early to conclude.`;
    if (progress < 55) return `NY session sweeps (15:30–18:00 SAST) showing stronger FVG formation. ${tradesReviewed} trades reviewed. Pattern emerging.`;
    if (progress < 80) return `${tradesReviewed} trades reviewed. ~70% of winning setups occurred within 90min of NY Open. Off-session entries underperforming.`;
    if (progress < 100) return `Strong pattern: NY Open window outperforming all-session entries. Recommending session filter. ${tradesReviewed} trades in sample.`;
    return `Research COMPLETE (${tradesReviewed} trades). NY Open window (15:30–18:00 SAST) consistently outperforms. Session filter validated.`;
  }
  if (id === 'trend') {
    if (progress < 30) return `Tracking SMA gap size at each entry. ${tradesReviewed} trades logged. Data collection phase.`;
    if (progress < 55) return `4H-aligned pullbacks showing ~68% win rate vs ~49% non-aligned in ${tradesReviewed}-trade sample. Gap threshold testing at 55pts.`;
    if (progress < 80) return `SMA gap > 60pts filtering out most choppy-market entries. ${tradesReviewed} trades reviewed. Gap threshold refinement ongoing.`;
    if (progress < 100) return `Research near complete (${tradesReviewed} trades). 4H alignment adds ~20% win rate improvement. Gap > 55pts validated as minimum.`;
    return `Research COMPLETE (${tradesReviewed} trades). 4H SMA alignment gate validated. Implementing gap > 55pts and 4H check as permanent rules.`;
  }
  // breakout
  if (progress < 30) return `Logging compression candle count per setup. ${tradesReviewed} trades. 2-candle setups showing early signs of higher false-break rate.`;
  if (progress < 55) return `4+ candle compression setups succeeding at 3× rate of shorter ones in ${tradesReviewed}-trade sample. ATR filter also being tested.`;
  if (progress < 80) return `${tradesReviewed} trades reviewed. ATR pre-entry filter (> 1.3× avg) cutting losers. 4-candle minimum rule validated in ${tradesReviewed} setups.`;
  if (progress < 100) return `Near complete (${tradesReviewed} trades). Minimum 4-candle compression rule reducing false breakouts by ~40%. ATR filter adds incremental edge.`;
  return `Research COMPLETE (${tradesReviewed} trades). 4-candle compression minimum validated. ATR < 1.3× avg confirmed. Both rules added as hard entry gates.`;
}

function tickResearch(state: TraderState): TraderState {
  if (Math.random() > 0.28) return state;
  const active = state.researchProjects.filter((p) => p.status === 'ACTIVE');
  if (!active.length) return state;

  const project = active[Math.floor(Math.random() * active.length)];
  const gain = Math.floor(Math.random() * 9) + 4;
  const newProgress = Math.min(100, project.progress + gain);
  const newStatus = newProgress >= 100 ? 'COMPLETE' : 'ACTIVE';
  const newTradesReviewed = Math.max(project.tradesReviewed, state.closedTrades.length);
  const findings = generateResearchFinding(state.id, newProgress, newTradesReviewed);

  return {
    ...state,
    researchProjects: state.researchProjects.map((p) =>
      p.id === project.id
        ? { ...p, progress: newProgress, status: newStatus, tradesReviewed: newTradesReviewed, currentFindings: findings, lastUpdated: getSASTHHMM() }
        : p
    ),
  };
}

// ─── ICT Trader ───────────────────────────────────────────────────────────

export function runICTCycle(
  state: TraderState,
  candles1H: Candle[],
  candles4H: Candle[]
): { state: TraderState; event: SimEvent | null } {
  const c1 = candles1H;
  const c4 = candles4H;
  const latest1H = c1[c1.length - 1];

  const posCheck = checkAndUpdatePosition(state, latest1H);
  let s = posCheck.state;
  const event = posCheck.event;
  if (event) return { state: s, event };
  if (s.openPosition) return { state: s, event: null };

  const sweepUp    = hasLiquiditySweepUp(c1);
  const sweepDown  = hasLiquiditySweepDown(c1);
  const bullFVG    = hasBullishFVG(c1.slice(-5));
  const bearFVG    = hasBearishFVG(c1.slice(-5));
  const sH         = swingHigh(c4, 20);
  const sL         = swingLow(c4, 20);
  const price      = latest1H.close;
  const mid4H      = (sH + sL) / 2;
  const above4HMid = price > mid4H;
  const atr1H      = atr(c1);

  const bullConditions = (sweepDown ? 1 : 0) + (bullFVG ? 1 : 0) + (above4HMid ? 1 : 0);
  const bearConditions = (sweepUp ? 1 : 0) + (bearFVG ? 1 : 0) + (!above4HMid ? 1 : 0);
  const bias: Bias = bullConditions > bearConditions ? 'Bullish' : bearConditions > bullConditions ? 'Bearish' : s.bias;
  const biasChanged = bias !== s.bias;
  const confidence = jitter(Math.max(bullConditions, bearConditions) * 25 + 20, 12);
  const maxCond = Math.max(bullConditions, bearConditions);
  const statusOptions: TraderStatus[] = ['ANALYZING', 'THINKING', 'WAITING', 'RESEARCHING'];

  const thesis = above4HMid
    ? sweepDown ? 'Bullish continuation probable. Sweep below confirmed. Waiting for FVG entry.'
      : bullFVG ? 'Bullish FVG present. Monitoring for price reaction and MSS.'
      : 'Bullish bias intact above 4H midpoint. No entry trigger yet.'
    : sweepUp ? 'Bearish continuation probable. Sweep above confirmed. Monitoring for entry.'
      : bearFVG ? 'Bearish FVG detected. Waiting for MSS to confirm continuation.'
      : 'Bearish lean below 4H midpoint. Insufficient confluence for entry.';

  const marketNarrative = above4HMid
    ? `US30 is holding above the 4H discount zone at ${mid4H.toFixed(0)}. ${sweepDown ? 'A liquidity sweep has occurred below the recent low — this is the first piece of confluence.' : 'Short-term liquidity below the range has not been swept yet.'} ${bullFVG ? 'A bullish FVG is present on 1H, offering a potential entry area.' : 'No FVG has formed yet — waiting for displacement.'} I will not chase price.`
    : `US30 is trading below the 4H midpoint at ${mid4H.toFixed(0)}, putting me in a bearish posture. ${sweepUp ? 'A sweep above the recent high occurred — potential distribution signal.' : 'No sweep above recent highs yet.'} ${bearFVG ? 'A bearish FVG is visible — would consider a short if MSS confirms.' : 'No bearish FVG formed yet.'}`;

  const bullCase  = `Sweep below ${swingLow(c1, 15).toFixed(0)}, bullish MSS on 15M, then FVG retracement entry. 4H structure remains bullish.`;
  const bearCase  = `Failure to reclaim after any sweep. Break below ${(mid4H - atr1H).toFixed(0)} on 4H close. Bearish FVG forms and holds.`;

  const waitingFor = above4HMid
    ? sweepDown ? 'Bullish MSS on 15M + FVG formation after the sweep.'
      : `Liquidity sweep below ${swingLow(c1, 15).toFixed(0)} + displacement candle.`
    : sweepUp ? 'Bearish MSS confirmation + FVG fill on 1H.'
      : `Liquidity sweep above ${swingHigh(c1, 15).toFixed(0)} + rejection candle.`;

  const tradeTrigger = above4HMid
    ? 'Bullish FVG retracement after MSS. Entry at 50% of FVG with SL below sweep low.'
    : 'Bearish FVG fill from below after MSS. Entry with SL above sweep high.';

  const noTradeReason = bullConditions < 2 && bearConditions < 2
    ? 'Insufficient confluence — need at least 2 of 3 conditions aligned.'
    : sweepDown || sweepUp ? 'Sweep confirmed but MSS not yet formed — waiting for structure shift.'
    : bullFVG || bearFVG ? 'FVG present but no liquidity sweep — incomplete setup.'
    : 'Session timing not optimal. Liquidity not yet engineered.';

  const entryEst   = above4HMid ? (price - atr1H * 0.5).toFixed(0) : (price + atr1H * 0.5).toFixed(0);
  const invalidLvl = above4HMid ? (mid4H - atr1H * 0.5).toFixed(0) : (mid4H + atr1H * 0.5).toFixed(0);
  const riskPlan: RiskPlan = {
    entryArea:    `Around ${entryEst} — on FVG fill after MSS`,
    invalidation: `${above4HMid ? '4H close below' : '4H close above'} ${invalidLvl}`,
    target:       `Opposing swing ${above4HMid ? 'high' : 'low'} at ~${(above4HMid ? sH : sL).toFixed(0)}`,
    rr:           '1:2 minimum — targeting 2R clean',
  };

  const whatWouldChangeMind = above4HMid
    ? `A clean 4H close below ${(mid4H - atr1H * 0.3).toFixed(0)} would invalidate the bullish structure entirely.`
    : `A reclaim of ${(mid4H + atr1H * 0.3).toFixed(0)} on 4H close would force a re-evaluation to neutral.`;

  const memNote = biasChanged
    ? `Bias shifted to ${bias}. ${bullConditions} bull / ${bearConditions} bear conditions active.`
    : maxCond >= 2
    ? `${maxCond} conditions aligned. ${sweepDown || sweepUp ? 'Sweep confirmed.' : ''} ${bullFVG || bearFVG ? 'FVG present.' : ''} Awaiting entry trigger.`
    : pick([
        `Monitoring: ${bullConditions} bull / ${bearConditions} bear conditions. No trigger yet.`,
        `Price at ${price.toFixed(0)}. 4H mid at ${mid4H.toFixed(0)}. ${above4HMid ? 'Above' : 'Below'} midpoint.`,
        `${sweepDown || sweepUp ? 'Sweep detected on 1H.' : 'No sweep formed.'} ${bullFVG || bearFVG ? 'FVG visible.' : 'No FVG.'}`,
        `Patience. Setup not ready. Conditions: ${bullConditions}/3 bull, ${bearConditions}/3 bear.`,
      ]);

  if (maxCond >= 2 && confidence >= personalityAdjustedThreshold(55, s.personality) && s.balance > 50) {
    const direction = bullConditions >= bearConditions ? 'BUY' : 'SELL';
    const slDist    = atr1H * 1.2;
    const reasonParts: string[] = [];
    if (direction === 'BUY') {
      if (sweepDown) reasonParts.push('liquidity sweep below');
      if (bullFVG)   reasonParts.push('bullish FVG present');
      if (above4HMid) reasonParts.push('above 4H midpoint');
    } else {
      if (sweepUp)    reasonParts.push('liquidity sweep above');
      if (bearFVG)    reasonParts.push('bearish FVG present');
      if (!above4HMid) reasonParts.push('below 4H midpoint');
    }
    const reason = reasonParts.join(', ');
    const pos    = buildPosition(s, direction, price, slDist, latest1H.time, reason);
    const msg    = `entered ${direction} at ${price.toFixed(0)} — ${reason}`;
    const note   = `Entered ${direction} at ${price.toFixed(0)}. Reason: ${reason}. SL: ${pos.stopLoss.toFixed(0)}, TP: ${pos.takeProfit.toFixed(0)}.`;
    return {
      state: tickResearch({
        ...s, bias, confidence: Math.min(95, confidence),
        status: 'IN TRADE', openPosition: pos,
        currentAction: `${direction} position open — monitoring for TP`,
        internalReasoning: `Entered on ${reason}. SL: ${pos.stopLoss.toFixed(0)}, TP: ${pos.takeProfit.toFixed(0)}.`,
        recentDecision: msg, timeframesReviewed: ['4H', '1H'],
        thesis, marketNarrative, bullCase, bearCase,
        waitingFor: 'Monitoring open position — TP or SL.',
        tradeTrigger: `Already in ${direction} trade.`,
        noTradeReason: 'In active position.',
        riskPlan: { ...riskPlan, entryArea: `Entered at ${pos.entryPrice.toFixed(0)}`, invalidation: `SL at ${pos.stopLoss.toFixed(0)}`, target: `TP at ${pos.takeProfit.toFixed(0)}` },
        whatWouldChangeMind,
        reasoningMemory: appendReasoning(s.reasoningMemory, note),
        alternativeScenario: direction === 'BUY'
          ? `Close below ${pos.stopLoss.toFixed(0)} invalidates thesis`
          : `Close above ${pos.stopLoss.toFixed(0)} invalidates thesis`,
      }),
      event: { traderId: 'ict', msg },
    };
  }

  const skipReason = noTradeReason;
  const msg = `skipped setup — ${skipReason.toLowerCase()}`;
  return {
    state: tickResearch({
      ...s, bias, confidence: Math.min(85, Math.max(25, confidence)),
      status: pick(statusOptions),
      currentAction: pick(['Scanning for FVG on 1H', 'Reviewing 4H order block levels', 'Watching for liquidity sweep', 'Mapping premium/discount zones', 'Checking HTF bias alignment']),
      internalReasoning: `${bullConditions} bullish / ${bearConditions} bearish conditions. ${skipReason}`,
      recentDecision: msg, timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'Order blocks & FVGs',
      alternativeScenario: above4HMid ? `Bullish bias holds above 4H midpoint ${mid4H.toFixed(0)}` : `Bearish bias holds below 4H midpoint ${mid4H.toFixed(0)}`,
      thesis, marketNarrative, bullCase, bearCase,
      waitingFor, tradeTrigger, noTradeReason: skipReason, riskPlan, whatWouldChangeMind,
      reasoningMemory: appendReasoning(s.reasoningMemory, memNote),
    }),
    event: Math.random() < 0.5 ? { traderId: 'ict', msg } : null,
  };
}

// ─── Trend Trader ─────────────────────────────────────────────────────────

export function runTrendCycle(
  state: TraderState,
  candles1H: Candle[],
  candles4H: Candle[]
): { state: TraderState; event: SimEvent | null } {
  const c1       = candles1H;
  const latest1H = c1[c1.length - 1];

  const posCheck = checkAndUpdatePosition(state, latest1H);
  let s = posCheck.state;
  const event = posCheck.event;
  if (event) return { state: s, event };
  if (s.openPosition) return { state: s, event: null };

  const price      = latest1H.close;
  const sma20      = sma(c1, 20);
  const sma50      = sma(c1, 50);
  const sma4H      = sma(candles4H, 10);
  const atr1H      = atr(c1);
  const bullTrend  = price > sma20 && sma20 > sma50;
  const bearTrend  = price < sma20 && sma20 < sma50;
  const atSMA20bull = price <= sma20 * 1.002 && price >= sma20 * 0.998 && bullTrend;
  const atSMA20bear = price >= sma20 * 0.998 && price <= sma20 * 1.002 && bearTrend;
  const last5      = c1.slice(-5);
  const bullMom    = last5.filter((c) => c.close > c.open).length >= 3;
  const bearMom    = last5.filter((c) => c.close < c.open).length >= 3;
  const bias: Bias = bullTrend ? 'Bullish' : bearTrend ? 'Bearish' : 'Neutral';
  const biasChanged = bias !== s.bias;
  const confidence = jitter(bullTrend ? (bullMom ? 75 : 58) : bearTrend ? (bearMom ? 72 : 56) : 40, 15);
  const smaDiff    = Math.abs(sma20 - sma50);

  const thesis = bullTrend
    ? atSMA20bull && bullMom ? 'Bullish trend pullback entry forming. Price at SMA20 with momentum confirmation.'
      : `Bullish trend intact. SMA20 (${sma20.toFixed(0)}) above SMA50 (${sma50.toFixed(0)}). Waiting for pullback.`
    : bearTrend
    ? atSMA20bear && bearMom ? 'Bearish trend pullback entry forming. Price at SMA20 with bearish momentum.'
      : `Bearish trend confirmed. SMA20 (${sma20.toFixed(0)}) below SMA50 (${sma50.toFixed(0)}). Waiting for rally to fade.`
    : `No trend. SMAs converging (${smaDiff.toFixed(0)}pt gap). Neutral until direction resolves.`;

  const marketNarrative = bullTrend
    ? `US30 is in a defined uptrend on 1H. SMA20 at ${sma20.toFixed(0)} is holding above SMA50 at ${sma50.toFixed(0)}, confirming the structure. ${bullMom ? '3+ bullish candles confirm momentum.' : 'Momentum is mild — waiting for it to strengthen.'} ${atSMA20bull ? 'Price is currently testing SMA20 — this is my preferred entry zone.' : `Price is ${(price - sma20).toFixed(0)}pts above SMA20 — too extended for entry.`}`
    : bearTrend
    ? `US30 is in a downtrend on 1H. SMA20 at ${sma20.toFixed(0)} is below SMA50 at ${sma50.toFixed(0)}. ${bearMom ? 'Bearish momentum confirmed on 1H.' : 'Bearish pressure is moderate.'} ${atSMA20bear ? 'Price retesting SMA20 from below — potential short entry.' : `Price is ${(sma20 - price).toFixed(0)}pts below SMA20 — too far to short.`}`
    : `US30 is in a choppy, ranging state. The gap between SMA20 (${sma20.toFixed(0)}) and SMA50 (${sma50.toFixed(0)}) is only ${smaDiff.toFixed(0)}pts — too close to define a trend. I am sitting out until a clear directional close occurs.`;

  const bullCase = `SMA20 maintains position above SMA50. Price pulls back to SMA20 at ${sma20.toFixed(0)} and 3+ bullish closes confirm. HTF ${sma4H.toFixed(0)} aligns.`;
  const bearCase = `SMA20 crosses below SMA50. Bearish momentum accelerates with 3+ red candles. 4H SMA at ${sma4H.toFixed(0)} turns down.`;

  const waitingFor = bullTrend
    ? atSMA20bull ? 'Momentum confirmation: 3+ bullish closes while touching SMA20.'
      : `Price to pull back to SMA20 at ${sma20.toFixed(0)} from current ${price.toFixed(0)}.`
    : bearTrend
    ? atSMA20bear ? 'Bearish momentum: 3+ bearish closes while testing SMA20.'
      : `Price to rally back to SMA20 at ${sma20.toFixed(0)} from current ${price.toFixed(0)}.`
    : 'SMA separation to widen. Need SMA20/SMA50 gap > 50pts for trend confidence.';

  const tradeTrigger = bullTrend ? 'Buy at SMA20 with 3+ bullish candles confirming. SL below SMA50.'
    : bearTrend ? 'Sell at SMA20 test with 3+ bearish candles. SL above SMA50.'
    : 'No trigger — wait for SMA cross and momentum to align.';

  const noTradeReason = !bullTrend && !bearTrend
    ? `SMAs are ${smaDiff.toFixed(0)}pts apart — no clear trend. Will not trade chop.`
    : atSMA20bull || atSMA20bear
    ? `At SMA20 but momentum not confirmed. Need ${bullTrend ? '3+ bullish' : '3+ bearish'} closes.`
    : `Price is ${bullTrend ? (price - sma20).toFixed(0) + 'pts above' : (sma20 - price).toFixed(0) + 'pts below'} SMA20 — waiting for pullback.`;

  const riskPlan: RiskPlan = {
    entryArea:    `SMA20 at ${sma20.toFixed(0)} ± ${(atr1H * 0.2).toFixed(0)}pts`,
    invalidation: bullTrend ? `SMA20 crosses below SMA50 (currently ${sma50.toFixed(0)})` : bearTrend ? `SMA20 crosses above SMA50` : 'SMA cross in either direction',
    target:       bullTrend ? `Previous swing high — approx ${(price + atr1H * 2).toFixed(0)}` : bearTrend ? `Previous swing low — approx ${(price - atr1H * 2).toFixed(0)}` : 'N/A',
    rr:           '1:1.5 minimum, 1:2 in strong trends',
  };

  const whatWouldChangeMind = bullTrend
    ? `SMA20 crossing below SMA50 at ${sma50.toFixed(0)} would fully negate the bullish thesis.`
    : bearTrend
    ? `SMA20 crossing back above SMA50 at ${sma50.toFixed(0)} would invalidate the bearish setup.`
    : `A strong trending close in either direction breaking SMA separation past 60pts.`;

  const memNote = biasChanged
    ? `Bias changed to ${bias}. SMA20: ${sma20.toFixed(0)}, SMA50: ${sma50.toFixed(0)}, gap: ${smaDiff.toFixed(0)}pts.`
    : bias !== 'Neutral'
    ? pick([
        `${bias} trend: SMA gap ${smaDiff.toFixed(0)}pts. ${atSMA20bull || atSMA20bear ? 'Price at SMA20 — monitoring for entry trigger.' : 'Price away from SMA20. No entry yet.'}`,
        `SMA20 at ${sma20.toFixed(0)}, SMA50 at ${sma50.toFixed(0)}. Price: ${price.toFixed(0)}. ${bullMom || bearMom ? 'Momentum confirmed.' : 'Momentum pending.'}`,
        `${bullMom ? '3+ bull candles' : bearMom ? '3+ bear candles' : 'Mixed candles'} on 1H. Trend: ${bias}.`,
      ])
    : `Neutral. SMA gap only ${smaDiff.toFixed(0)}pts. Not tradeable yet.`;

  const canEnter = ((atSMA20bull && bullMom) || (atSMA20bear && bearMom)) && confidence >= personalityAdjustedThreshold(60, s.personality) && s.balance > 50;

  if (canEnter) {
    const direction = atSMA20bull ? 'BUY' : 'SELL';
    const slDist    = atr1H * 1.4;
    const momDesc   = direction === 'BUY' ? 'bullish momentum confirmed' : 'bearish momentum confirmed';
    const entryReason = `Pullback to SMA20 at ${sma20.toFixed(0)}, ${momDesc}, SMA gap ${smaDiff.toFixed(0)}pts`;
    const pos       = buildPosition(s, direction, price, slDist, latest1H.time, entryReason);
    const msg       = `entered ${direction} at ${price.toFixed(0)} — pullback to SMA20, ${momDesc}`;
    const note      = `Entered ${direction} at ${price.toFixed(0)}. SMA20 pullback + ${momDesc}. SL: ${pos.stopLoss.toFixed(0)}.`;
    return {
      state: tickResearch({
        ...s, bias, confidence: Math.min(90, confidence),
        status: 'IN TRADE', openPosition: pos,
        currentAction: `${direction} trade open — riding trend`,
        internalReasoning: `${bias} trend. Pullback to SMA20 at ${sma20.toFixed(0)}. ${momDesc}.`,
        recentDecision: msg, timeframesReviewed: ['4H', '1H'],
        thesis, marketNarrative, bullCase, bearCase,
        waitingFor: 'Monitoring open position.',
        tradeTrigger: `Already in ${direction} trade.`,
        noTradeReason: 'In active position.',
        riskPlan: { ...riskPlan, entryArea: `Entered at ${pos.entryPrice.toFixed(0)}`, invalidation: `SL at ${pos.stopLoss.toFixed(0)}`, target: `TP at ${pos.takeProfit.toFixed(0)}` },
        whatWouldChangeMind,
        reasoningMemory: appendReasoning(s.reasoningMemory, note),
        alternativeScenario: direction === 'BUY' ? 'Trend fails if SMA20 crosses below SMA50' : 'Trend fails if SMA20 crosses above SMA50',
      }),
      event: { traderId: 'trend', msg },
    };
  }

  const msg = `analyzing — ${noTradeReason.toLowerCase()}`;
  return {
    state: tickResearch({
      ...s, bias, confidence: Math.min(85, Math.max(20, confidence)),
      status: pick(['ANALYZING', 'RESEARCHING', 'THINKING', 'WAITING']),
      currentAction: pick([`Monitoring SMA20 at ${sma20.toFixed(0)}`, 'Checking momentum candles on 1H', 'Reviewing HTF trend structure', `Watching SMA50 at ${sma50.toFixed(0)} for support`, 'Checking for trend continuation pattern']),
      internalReasoning: `SMA20: ${sma20.toFixed(0)}, SMA50: ${sma50.toFixed(0)}, gap: ${smaDiff.toFixed(0)}pts. ${bias} ${bullTrend || bearTrend ? 'confirmed' : 'not confirmed'}.`,
      recentDecision: msg, timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'SMA trend & momentum',
      alternativeScenario: bias === 'Neutral' ? 'Wait for SMA cross to confirm direction' : `Hold ${bias} bias while price remains on correct side of SMA50`,
      thesis, marketNarrative, bullCase, bearCase,
      waitingFor, tradeTrigger, noTradeReason, riskPlan, whatWouldChangeMind,
      reasoningMemory: appendReasoning(s.reasoningMemory, memNote),
    }),
    event: Math.random() < 0.5 ? { traderId: 'trend', msg } : null,
  };
}

// ─── Breakout Trader ──────────────────────────────────────────────────────

export function runBreakoutCycle(
  state: TraderState,
  candles1H: Candle[]
): { state: TraderState; event: SimEvent | null } {
  const c1       = candles1H;
  const latest1H = c1[c1.length - 1];

  const posCheck = checkAndUpdatePosition(state, latest1H);
  let s = posCheck.state;
  const event = posCheck.event;
  if (event) return { state: s, event };
  if (s.openPosition) return { state: s, event: null };

  const price       = latest1H.close;
  const atr1H       = atr(c1);
  const { rangeH, rangeL, rangeSize } = rangeHighLow(c1, 12);
  const isCompressed = rangeSize < atr1H * 1.6;
  const breakoutUp  = price > rangeH + atr1H * 0.15;
  const breakoutDown = price < rangeL - atr1H * 0.15;
  const volDesc     = atr1H > 80 ? 'high' : atr1H > 50 ? 'medium' : 'low';
  const bias: Bias  = breakoutUp ? 'Bullish' : breakoutDown ? 'Bearish' : 'Neutral';
  const biasChanged = bias !== s.bias;
  const confidence  = jitter(isCompressed ? (breakoutUp || breakoutDown ? 72 : 55) : (breakoutUp || breakoutDown ? 60 : 35), 18);

  const thesis = isCompressed
    ? breakoutUp ? `Bullish breakout confirmed above ${rangeH.toFixed(0)}. Riding expansion.`
      : breakoutDown ? `Bearish breakout confirmed below ${rangeL.toFixed(0)}. Riding expansion.`
      : `Compression active. Range ${rangeSize.toFixed(0)}pts vs ATR ${atr1H.toFixed(0)}. Waiting for the break.`
    : `Range too wide (${rangeSize.toFixed(0)}pts). Need tighter compression before breakout is tradeable.`;

  const marketNarrative = isCompressed
    ? `US30 has compressed into a ${rangeSize.toFixed(0)}-point range between ${rangeL.toFixed(0)} and ${rangeH.toFixed(0)}. ATR is ${atr1H.toFixed(0)} — volatility is ${volDesc}. ${breakoutUp ? `Price has broken above ${rangeH.toFixed(0)} — looking to ride expansion.` : breakoutDown ? `Price has broken below ${rangeL.toFixed(0)} — bearish expansion underway.` : 'Range is holding. The longer it compresses, the stronger the eventual breakout.'}`
    : `US30 is ranging but not tight enough for a high-probability breakout setup. Range is ${rangeSize.toFixed(0)}pts against an ATR of ${atr1H.toFixed(0)}pts. I need the range to tighten to below ${(atr1H * 1.6).toFixed(0)}pts before I consider an entry.`;

  const bullCase = `Clean close above ${rangeH.toFixed(0)} with body confirming. No wick re-entry. Volume expansion on breakout candle.`;
  const bearCase = `Clean close below ${rangeL.toFixed(0)} with follow-through. No re-entry into range. ATR expands on break.`;

  const waitingFor = isCompressed
    ? breakoutUp || breakoutDown ? 'Confirmation that breakout holds — no wick back inside range.'
      : `Close outside range: above ${rangeH.toFixed(0)} or below ${rangeL.toFixed(0)} by at least ${(atr1H * 0.15).toFixed(0)}pts.`
    : `Range to tighten below ${(atr1H * 1.6).toFixed(0)}pts. Currently ${rangeSize.toFixed(0)}pts.`;

  const tradeTrigger = `Candle close ${bias === 'Bullish' ? 'above' : 'below'} range boundary by 0.15 ATR (${(atr1H * 0.15).toFixed(0)}pts). SL inside range, target = range projection.`;

  const noTradeReason = !isCompressed
    ? `Range at ${rangeSize.toFixed(0)}pts is too wide relative to ATR ${atr1H.toFixed(0)}.`
    : !(breakoutUp || breakoutDown)
    ? `Compression active but no breakout yet. H: ${rangeH.toFixed(0)}, L: ${rangeL.toFixed(0)}.`
    : 'Confidence below threshold — monitoring for fake-out before committing.';

  const riskPlan: RiskPlan = {
    entryArea:    breakoutUp ? `Just above ${rangeH.toFixed(0)} on breakout close` : breakoutDown ? `Just below ${rangeL.toFixed(0)} on breakout close` : `Breakout of range: ${rangeL.toFixed(0)}–${rangeH.toFixed(0)}`,
    invalidation: breakoutUp ? `Re-entry below ${rangeH.toFixed(0)} (false break)` : breakoutDown ? `Re-entry above ${rangeL.toFixed(0)} (false break)` : `Any false break back inside range`,
    target:       `Range projection: ${rangeSize.toFixed(0)}pts from breakout point`,
    rr:           '1:2 targeting full range projection',
  };

  const whatWouldChangeMind = breakoutUp
    ? `Price closing back below ${rangeH.toFixed(0)} would confirm a false breakout — immediate exit and re-evaluation.`
    : breakoutDown
    ? `Price closing back above ${rangeL.toFixed(0)} — false breakdown. Neutral until new setup forms.`
    : `A compression resolution in the opposite direction to current lean. Would flip accordingly.`;

  const memNote = biasChanged
    ? `Bias changed to ${bias}. ${breakoutUp ? `Break above ${rangeH.toFixed(0)}.` : breakoutDown ? `Break below ${rangeL.toFixed(0)}.` : 'Still ranging.'}`
    : isCompressed
    ? pick([
        `Compression: range ${rangeSize.toFixed(0)}pts, ATR ${atr1H.toFixed(0)}. ${breakoutUp || breakoutDown ? 'Breakout forming.' : 'Watching boundaries.'}`,
        `H: ${rangeH.toFixed(0)}, L: ${rangeL.toFixed(0)}, size: ${rangeSize.toFixed(0)}pts. ${volDesc} volatility.`,
        `Price at ${price.toFixed(0)}. ${(rangeH - price).toFixed(0)}pts from top, ${(price - rangeL).toFixed(0)}pts from bottom of range.`,
      ])
    : `Range too wide at ${rangeSize.toFixed(0)}pts. ATR: ${atr1H.toFixed(0)}. Need < ${(atr1H * 1.6).toFixed(0)}pts.`;

  const canEnter = (breakoutUp || breakoutDown) && isCompressed && confidence >= personalityAdjustedThreshold(50, s.personality) && s.balance > 50;

  if (canEnter) {
    const direction  = breakoutUp ? 'BUY' : 'SELL';
    const slDist     = atr1H * 1.1;
    const brkDesc    = direction === 'BUY' ? `broke above ${rangeH.toFixed(0)}` : `broke below ${rangeL.toFixed(0)}`;
    const entryReason = `Breakout: ${brkDesc}. Range was ${rangeSize.toFixed(0)}pts (ATR ${atr1H.toFixed(0)}). Compressed < 1.6× ATR.`;
    const pos        = buildPosition(s, direction, price, slDist, latest1H.time, entryReason);
    const msg        = `entered ${direction} at ${price.toFixed(0)} — breakout: ${brkDesc}`;
    const note       = `Entered ${direction} at ${price.toFixed(0)}. ${brkDesc}. Range was ${rangeSize.toFixed(0)}pts. SL: ${pos.stopLoss.toFixed(0)}.`;
    return {
      state: tickResearch({
        ...s, bias, confidence: Math.min(88, confidence),
        status: 'IN TRADE', openPosition: pos,
        currentAction: `${direction} breakout trade open — riding expansion`,
        internalReasoning: `Compression ${rangeSize.toFixed(0)}pts, ATR ${atr1H.toFixed(0)}. ${brkDesc}. Expansion expected.`,
        recentDecision: msg, timeframesReviewed: ['1H'],
        thesis, marketNarrative, bullCase, bearCase,
        waitingFor: 'Monitoring breakout trade — watching for false break.',
        tradeTrigger: `Already in ${direction} breakout trade.`,
        noTradeReason: 'In active position.',
        riskPlan: { ...riskPlan, entryArea: `Entered at ${pos.entryPrice.toFixed(0)}`, invalidation: `SL at ${pos.stopLoss.toFixed(0)}`, target: `TP at ${pos.takeProfit.toFixed(0)}` },
        whatWouldChangeMind,
        reasoningMemory: appendReasoning(s.reasoningMemory, note),
        alternativeScenario: direction === 'BUY'
          ? `Breakout fails if price re-enters range below ${rangeH.toFixed(0)}`
          : `Breakout fails if price re-enters range above ${rangeL.toFixed(0)}`,
      }),
      event: { traderId: 'breakout', msg },
    };
  }

  const msg = `monitoring — ${noTradeReason.toLowerCase()}`;
  return {
    state: tickResearch({
      ...s, bias, confidence: Math.min(80, Math.max(20, confidence)),
      status: isCompressed ? pick(['ANALYZING', 'WAITING']) : pick(['THINKING', 'RESEARCHING']),
      currentAction: pick([`Watching range compression (${rangeSize.toFixed(0)}pts)`, `Monitoring breakout level at ${rangeH.toFixed(0)}`, `Tracking ATR contraction — ATR: ${atr1H.toFixed(0)}`, 'Waiting for breakout candle confirmation', `Range: ${rangeL.toFixed(0)} – ${rangeH.toFixed(0)}`]),
      internalReasoning: `Range ${rangeSize.toFixed(0)}pts, ATR ${atr1H.toFixed(0)}. ${isCompressed ? 'Compressed.' : 'Too wide.'} ${breakoutUp || breakoutDown ? 'Possible break forming.' : 'No signal.'}`,
      recentDecision: msg, timeframesReviewed: ['1H'],
      strategyFocus: 'Range breakout & volatility',
      alternativeScenario: isCompressed
        ? `Longer compression → stronger breakout. Watching for 2+ more ranging cycles.`
        : `Wait for range < ${(atr1H * 1.6).toFixed(0)}pts before setup is valid.`,
      thesis, marketNarrative, bullCase, bearCase,
      waitingFor, tradeTrigger, noTradeReason, riskPlan, whatWouldChangeMind,
      reasoningMemory: appendReasoning(s.reasoningMemory, memNote),
    }),
    event: Math.random() < 0.55 ? { traderId: 'breakout', msg } : null,
  };
}
