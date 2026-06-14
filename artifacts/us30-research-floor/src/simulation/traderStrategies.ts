import type { Candle } from '../data/demoMarketData';
import {
  type TraderState,
  type SimEvent,
  type Bias,
  type TraderStatus,
  checkAndUpdatePosition,
  buildPosition,
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

  const sweepUp = hasLiquiditySweepUp(c1);
  const sweepDown = hasLiquiditySweepDown(c1);
  const bullFVG = hasBullishFVG(c1.slice(-5));
  const bearFVG = hasBearishFVG(c1.slice(-5));
  const sH = swingHigh(c4, 20);
  const sL = swingLow(c4, 20);
  const price = latest1H.close;
  const above4HMidpoint = price > (sH + sL) / 2;
  const atr1H = atr(c1);

  const bullConditions = (sweepDown ? 1 : 0) + (bullFVG ? 1 : 0) + (above4HMidpoint ? 1 : 0);
  const bearConditions = (sweepUp ? 1 : 0) + (bearFVG ? 1 : 0) + (!above4HMidpoint ? 1 : 0);

  const bias: Bias = bullConditions > bearConditions ? 'Bullish' : bearConditions > bullConditions ? 'Bearish' : s.bias;
  const confidence = jitter(Math.max(bullConditions, bearConditions) * 25 + 20, 12);
  const maxCond = Math.max(bullConditions, bearConditions);

  const statusOptions: TraderStatus[] = ['ANALYZING', 'THINKING', 'WAITING', 'RESEARCHING'];

  // ICT is patient — needs 2+ conditions to enter
  if (maxCond >= 2 && confidence >= 55 && s.balance > 50) {
    const direction = bullConditions >= bearConditions ? 'BUY' : 'SELL';
    const slDist = atr1H * 1.2;
    const pos = buildPosition(s, direction, price, slDist, latest1H.time);
    const reasonParts = [];
    if (direction === 'BUY') {
      if (sweepDown) reasonParts.push('liquidity sweep below');
      if (bullFVG) reasonParts.push('bullish FVG present');
      if (above4HMidpoint) reasonParts.push('above 4H midpoint');
    } else {
      if (sweepUp) reasonParts.push('liquidity sweep above');
      if (bearFVG) reasonParts.push('bearish FVG present');
      if (!above4HMidpoint) reasonParts.push('below 4H midpoint');
    }
    const reason = reasonParts.join(', ');
    const msg = `entered ${direction} at ${price.toFixed(0)} — ${reason}`;
    return {
      state: {
        ...s,
        bias,
        confidence: Math.min(95, confidence),
        status: 'IN TRADE',
        openPosition: pos,
        currentAction: `${direction} position open — monitoring for TP`,
        internalReasoning: `Entered on ${reason}. SL: ${pos.stopLoss.toFixed(0)}, TP: ${pos.takeProfit.toFixed(0)}.`,
        recentDecision: msg,
        timeframesReviewed: ['4H', '1H'],
        alternativeScenario: direction === 'BUY'
          ? `If price closes below ${pos.stopLoss.toFixed(0)}, thesis invalidated`
          : `If price closes above ${pos.stopLoss.toFixed(0)}, thesis invalidated`,
      },
      event: { traderId: 'ict', msg },
    };
  }

  const skipReasons = [
    'liquidity sweep not confirmed',
    'FVG not yet formed — waiting for displacement',
    'insufficient confluence — need 2+ conditions',
    'order block not yet tested',
    'session timing not optimal',
    'waiting for 4H structure to develop',
  ];

  const status: TraderStatus = pick(statusOptions);
  const skipReason = pick(skipReasons);
  const msg = `skipped setup — ${skipReason}`;

  return {
    state: {
      ...s,
      bias,
      confidence: Math.min(85, Math.max(25, confidence)),
      status,
      currentAction: pick([
        'Scanning for FVG on 1H',
        'Reviewing 4H order block levels',
        'Watching for liquidity sweep',
        'Mapping premium/discount zones',
        'Checking HTF bias alignment',
      ]),
      internalReasoning: `${bullConditions} bullish / ${bearConditions} bearish conditions. ${skipReason.charAt(0).toUpperCase() + skipReason.slice(1)}.`,
      recentDecision: msg,
      timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'Order blocks & FVGs',
      alternativeScenario: above4HMidpoint
        ? `Bullish bias holds above ${(sL + (sH - sL) * 0.5).toFixed(0)}`
        : `Bearish bias holds below ${(sL + (sH - sL) * 0.5).toFixed(0)}`,
    },
    event: Math.random() < 0.5 ? { traderId: 'ict', msg } : null,
  };
}

// ─── Trend Trader ─────────────────────────────────────────────────────────

export function runTrendCycle(
  state: TraderState,
  candles1H: Candle[],
  candles4H: Candle[]
): { state: TraderState; event: SimEvent | null } {
  const c1 = candles1H;
  const latest1H = c1[c1.length - 1];

  const posCheck = checkAndUpdatePosition(state, latest1H);
  let s = posCheck.state;
  const event = posCheck.event;
  if (event) return { state: s, event };

  if (s.openPosition) return { state: s, event: null };

  const price = latest1H.close;
  const sma20 = sma(c1, 20);
  const sma50 = sma(c1, 50);
  const sma4H = sma(candles4H, 10);
  const atr1H = atr(c1);

  const bullTrend = price > sma20 && sma20 > sma50;
  const bearTrend = price < sma20 && sma20 < sma50;
  const pullbackToBuy = price <= sma20 * 1.002 && price >= sma20 * 0.998 && bullTrend;
  const pullbackToSell = price >= sma20 * 0.998 && price <= sma20 * 1.002 && bearTrend;

  const last5 = c1.slice(-5);
  const bullMomentum = last5.filter((c) => c.close > c.open).length >= 3;
  const bearMomentum = last5.filter((c) => c.close < c.open).length >= 3;

  const bias: Bias = bullTrend ? 'Bullish' : bearTrend ? 'Bearish' : 'Neutral';
  const confidence = jitter(
    bullTrend ? (bullMomentum ? 75 : 58) : bearTrend ? (bearMomentum ? 72 : 56) : 40,
    15
  );

  const statusOptions: TraderStatus[] = ['ANALYZING', 'RESEARCHING', 'THINKING', 'WAITING'];

  const canEnter =
    ((pullbackToBuy && bullMomentum) || (pullbackToSell && bearMomentum)) &&
    confidence >= 60 &&
    s.balance > 50;

  if (canEnter) {
    const direction = pullbackToBuy ? 'BUY' : 'SELL';
    const slDist = atr1H * 1.4;
    const pos = buildPosition(s, direction, price, slDist, latest1H.time);
    const momentumDesc = direction === 'BUY' ? 'bullish momentum confirmed' : 'bearish momentum confirmed';
    const trendDesc = direction === 'BUY' ? 'price above SMA20 > SMA50' : 'price below SMA20 < SMA50';
    const msg = `entered ${direction} at ${price.toFixed(0)} — pullback to SMA20, ${momentumDesc}`;

    return {
      state: {
        ...s,
        bias,
        confidence: Math.min(90, confidence),
        status: 'IN TRADE',
        openPosition: pos,
        currentAction: `${direction} trade open — riding trend`,
        internalReasoning: `${trendDesc}. Pullback to SMA20 at ${sma20.toFixed(0)}. ${momentumDesc}.`,
        recentDecision: msg,
        timeframesReviewed: ['4H', '1H'],
        alternativeScenario: direction === 'BUY'
          ? `Trend fails if SMA20 crosses below SMA50`
          : `Trend fails if SMA20 crosses above SMA50`,
      },
      event: { traderId: 'trend', msg },
    };
  }

  const waitReasons = [
    `waiting for price to pull back to SMA20 (${sma20.toFixed(0)})`,
    'no momentum confirmation yet — watching 1H closes',
    `trend ${bias === 'Neutral' ? 'unclear — SMAs converging' : 'active but no entry trigger'}`,
    'looking for 3+ candles in trend direction',
    `4H SMA at ${sma4H.toFixed(0)} — confirming HTF alignment`,
    'monitoring momentum strength before entry',
  ];

  const status: TraderStatus = pick(statusOptions);
  const waitReason = pick(waitReasons);
  const msg = `analyzing — ${waitReason}`;

  return {
    state: {
      ...s,
      bias,
      confidence: Math.min(85, Math.max(20, confidence)),
      status,
      currentAction: pick([
        `Monitoring SMA20 at ${sma20.toFixed(0)}`,
        'Checking momentum candles on 1H',
        'Reviewing HTF trend structure',
        `Watching SMA50 at ${sma50.toFixed(0)} for support`,
        'Checking for trend continuation pattern',
      ]),
      internalReasoning: `SMA20: ${sma20.toFixed(0)}, SMA50: ${sma50.toFixed(0)}, Price: ${price.toFixed(0)}. ${bias} trend ${bullTrend || bearTrend ? 'confirmed' : 'not confirmed'}.`,
      recentDecision: msg,
      timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'SMA trend & momentum',
      alternativeScenario: bias === 'Neutral'
        ? 'Wait for SMA cross to confirm direction'
        : `Hold ${bias} bias while price remains on correct side of SMA50`,
    },
    event: Math.random() < 0.5 ? { traderId: 'trend', msg } : null,
  };
}

// ─── Breakout Trader ──────────────────────────────────────────────────────

export function runBreakoutCycle(
  state: TraderState,
  candles1H: Candle[]
): { state: TraderState; event: SimEvent | null } {
  const c1 = candles1H;
  const latest1H = c1[c1.length - 1];

  const posCheck = checkAndUpdatePosition(state, latest1H);
  let s = posCheck.state;
  const event = posCheck.event;
  if (event) return { state: s, event };

  if (s.openPosition) return { state: s, event: null };

  const price = latest1H.close;
  const atr1H = atr(c1);
  const { rangeH, rangeL, rangeSize } = rangeHighLow(c1, 12);
  const isCompressed = rangeSize < atr1H * 1.6;
  const breakoutUp = price > rangeH + atr1H * 0.15;
  const breakoutDown = price < rangeL - atr1H * 0.15;

  const bias: Bias = breakoutUp ? 'Bullish' : breakoutDown ? 'Bearish' : 'Neutral';
  const confidence = jitter(
    isCompressed
      ? breakoutUp || breakoutDown ? 72 : 55
      : breakoutUp || breakoutDown ? 60 : 35,
    18
  );

  const statusOptions: TraderStatus[] = ['ANALYZING', 'WAITING', 'RESEARCHING', 'THINKING'];

  const canEnter =
    (breakoutUp || breakoutDown) &&
    isCompressed &&
    confidence >= 50 &&
    s.balance > 50;

  if (canEnter) {
    const direction = breakoutUp ? 'BUY' : 'SELL';
    const slDist = atr1H * 1.1;
    const pos = buildPosition(s, direction, price, slDist, latest1H.time);
    const rangeDesc = `range was ${rangeSize.toFixed(0)}pts (ATR: ${atr1H.toFixed(0)})`;
    const brkDesc = direction === 'BUY'
      ? `broke above ${rangeH.toFixed(0)}`
      : `broke below ${rangeL.toFixed(0)}`;
    const msg = `entered ${direction} at ${price.toFixed(0)} — breakout: ${brkDesc}`;

    return {
      state: {
        ...s,
        bias,
        confidence: Math.min(88, confidence),
        status: 'IN TRADE',
        openPosition: pos,
        currentAction: `${direction} breakout trade open — riding expansion`,
        internalReasoning: `Compression detected: ${rangeDesc}. ${brkDesc}. Volatility expansion expected.`,
        recentDecision: msg,
        timeframesReviewed: ['1H'],
        alternativeScenario: direction === 'BUY'
          ? `Breakout fails if price re-enters range below ${rangeH.toFixed(0)}`
          : `Breakout fails if price re-enters range above ${rangeL.toFixed(0)}`,
      },
      event: { traderId: 'breakout', msg },
    };
  }

  const watchReasons = [
    `watching range: H ${rangeH.toFixed(0)} / L ${rangeL.toFixed(0)} (${rangeSize.toFixed(0)}pts)`,
    isCompressed ? 'compression active — waiting for break trigger' : 'range too wide — waiting for tighter compression',
    `ATR ${atr1H.toFixed(0)} — volatility ${atr1H > 80 ? 'high' : atr1H > 50 ? 'medium' : 'low'}`,
    'monitoring for volume expansion on breakout candle',
    'watching for fake breakout / range re-entry',
  ];

  const status: TraderStatus = pick(statusOptions);
  const watchReason = pick(watchReasons);
  const msg = `monitoring — ${watchReason}`;

  return {
    state: {
      ...s,
      bias,
      confidence: Math.min(80, Math.max(20, confidence)),
      status: isCompressed ? pick(['ANALYZING', 'WAITING']) : pick(['THINKING', 'RESEARCHING']),
      currentAction: pick([
        `Watching range compression (${rangeSize.toFixed(0)}pts)`,
        `Monitoring breakout level at ${rangeH.toFixed(0)}`,
        `Tracking ATR contraction — ATR: ${atr1H.toFixed(0)}`,
        'Waiting for breakout candle confirmation',
        `Range: ${rangeL.toFixed(0)} – ${rangeH.toFixed(0)}`,
      ]),
      internalReasoning: `Range size: ${rangeSize.toFixed(0)}pts, ATR: ${atr1H.toFixed(0)}. ${isCompressed ? 'Compression active.' : 'Range not tight enough.'} ${breakoutUp || breakoutDown ? 'Possible breakout forming.' : 'No breakout signal yet.'}`,
      recentDecision: msg,
      timeframesReviewed: ['1H'],
      strategyFocus: 'Range breakout & volatility',
      alternativeScenario: isCompressed
        ? `If compression continues 2+ more cycles, probability of strong breakout increases`
        : `Wait for range to tighten below ATR x1.5 (${(atr1H * 1.5).toFixed(0)}pts)`,
    },
    event: Math.random() < 0.55 ? { traderId: 'breakout', msg } : null,
  };
}
