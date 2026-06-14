import type { Candle } from '../data/demoMarketData';

export type TraderId = 'ict' | 'trend' | 'breakout';
export type Bias = 'Bullish' | 'Bearish' | 'Neutral';
export type TraderStatus =
  | 'ANALYZING'
  | 'THINKING'
  | 'WAITING'
  | 'RESEARCHING'
  | 'DISCUSSING'
  | 'IN TRADE'
  | 'REHAB';

export interface Position {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  size: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: number;
  unrealizedPL: number;
}

export interface ClosedTrade {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  result: number;
  rMultiple: number;
  balanceChange: number;
  reason: string;
  exitTime: number;
}

export interface ReasoningEntry {
  time: string;
  note: string;
}

export interface RiskPlan {
  entryArea: string;
  invalidation: string;
  target: string;
  rr: string;
}

export interface TraderState {
  id: TraderId;
  name: string;
  strategyVersion: string;
  status: TraderStatus;
  bias: Bias;
  confidence: number;
  currentAction: string;
  internalReasoning: string;
  recentDecision: string;
  timeframesReviewed: string[];
  strategyFocus: string;
  alternativeScenario: string;
  // ── Deep thinking fields ──────────────────────────────────────────────────
  thesis: string;
  marketNarrative: string;
  bullCase: string;
  bearCase: string;
  waitingFor: string;
  tradeTrigger: string;
  noTradeReason: string;
  riskPlan: RiskPlan;
  whatWouldChangeMind: string;
  reasoningMemory: ReasoningEntry[];
  // ── Trading ───────────────────────────────────────────────────────────────
  openPosition: Position | null;
  closedTrades: ClosedTrade[];
  balance: number;
  personality: { discipline: number; aggression: number; patience: number };
}

export interface SimEvent {
  traderId: TraderId;
  msg: string;
}

export function getInitialTraderStates(): TraderState[] {
  return [
    {
      id: 'ict',
      name: 'ICT TRADER',
      strategyVersion: 'v1.0',
      status: 'WAITING',
      bias: 'Bullish',
      confidence: 72,
      currentAction: 'Waiting for OTE setup on 15M',
      internalReasoning: 'Price above 4H order block. Watching for liquidity sweep above recent high.',
      recentDecision: 'Skipped — liquidity sweep not confirmed',
      timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'Order blocks & FVGs',
      alternativeScenario: 'If price drops below 38,600, flip to bearish',
      thesis: 'Bullish continuation likely after liquidity sweep below current low.',
      marketNarrative: 'US30 is holding above the 4H discount zone. Short-term liquidity remains below the current range. Not interested in chasing price until a clean sweep and reclaim forms.',
      bullCase: 'Sweep below short-term low, bullish MSS on 15M, then FVG entry.',
      bearCase: 'Failure to reclaim after sweep and break below 4H support level.',
      waitingFor: 'Liquidity sweep below current range low + 15M market structure shift.',
      tradeTrigger: 'Bullish FVG retracement entry after MSS confirmation.',
      noTradeReason: 'Session timing not optimal and liquidity has not been taken yet.',
      riskPlan: {
        entryArea: 'Premium zone after MSS, ~38,650–38,700',
        invalidation: 'Clean 4H close below 38,500',
        target: 'Nearest opposing liquidity at swing high',
        rr: '1:2 minimum, targeting 2R',
      },
      whatWouldChangeMind: 'A clean 4H candle close below 38,500 would fully invalidate the bullish bias.',
      reasoningMemory: [
        { time: '--:--', note: 'Simulation initialised. Bias set to Bullish. Monitoring 4H structure.' },
      ],
      openPosition: null,
      closedTrades: [],
      balance: 1000,
      personality: { discipline: 68, aggression: 45, patience: 82 },
    },
    {
      id: 'trend',
      name: 'TREND TRADER',
      strategyVersion: 'v1.0',
      status: 'ANALYZING',
      bias: 'Neutral',
      confidence: 55,
      currentAction: 'Monitoring 4H structure break',
      internalReasoning: 'SMA20 and SMA50 converging on 1H. Waiting for clear directional close.',
      recentDecision: 'No trade — trend not confirmed',
      timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'SMA trend & momentum',
      alternativeScenario: 'If 4H closes above 38,900, look for 1H pullback entry',
      thesis: 'Neutral until SMAs give clear separation. No trade in choppy market.',
      marketNarrative: 'US30 is in a transitional phase. SMA20 and SMA50 are converging, suggesting indecision. Will not enter until trend is clearly re-established on 1H.',
      bullCase: 'SMA20 crosses above SMA50 with price maintaining higher highs on 1H.',
      bearCase: 'SMA20 crosses below SMA50 with 3+ bearish closes confirming downtrend.',
      waitingFor: 'SMA stack alignment: price > SMA20 > SMA50 with momentum confirmation.',
      tradeTrigger: '3+ consecutive bullish candles on 1H while price pulls back to SMA20.',
      noTradeReason: 'SMAs too close together — trend not confirmed in either direction.',
      riskPlan: {
        entryArea: 'Pullback to SMA20 from above or below',
        invalidation: 'SMA20 crossing SMA50 in opposite direction',
        target: 'Previous swing high/low with 1.5R minimum',
        rr: '1:1.5 baseline, extending to 1:2 in strong trend',
      },
      whatWouldChangeMind: 'SMA crossover in the opposite direction to any active bias would force a re-evaluation.',
      reasoningMemory: [
        { time: '--:--', note: 'Simulation initialised. Neutral stance. Waiting for SMA alignment.' },
      ],
      openPosition: null,
      closedTrades: [],
      balance: 1000,
      personality: { discipline: 75, aggression: 60, patience: 70 },
    },
    {
      id: 'breakout',
      name: 'BREAKOUT TRADER',
      strategyVersion: 'v1.0',
      status: 'REHAB',
      bias: 'Bearish',
      confidence: 40,
      currentAction: 'Reviewing last 3 losses',
      internalReasoning: 'Compression forming on 1H. ATR contracting. Waiting for breakout trigger.',
      recentDecision: 'Entered early — range not fully formed',
      timeframesReviewed: ['1H'],
      strategyFocus: 'Range breakout & volatility',
      alternativeScenario: 'If range holds 3+ more candles, breakout probability increases',
      thesis: 'Neutral until range breaks. Bearish lean based on recent price action.',
      marketNarrative: 'US30 is forming a compression range on 1H. ATR is contracting. I am watching for the first clean breakout candle with volume expansion. Will not trade until range is clearly defined.',
      bullCase: 'Clean break above range high with strong bullish close and volume.',
      bearCase: 'Break below range low with immediate follow-through and no re-entry.',
      waitingFor: 'Range to tighten further, then a clean close outside the range boundaries.',
      tradeTrigger: 'Candle close outside range by at least 0.15 ATR with no wick back inside.',
      noTradeReason: 'Currently in rehab protocol. Reviewing process before next trade.',
      riskPlan: {
        entryArea: 'Just beyond range boundary on breakout confirmation',
        invalidation: 'Price re-enters range after breakout (false break)',
        target: 'Range size projected from breakout point',
        rr: '1:2 targeting full range projection',
      },
      whatWouldChangeMind: 'A false breakout followed by range re-entry would reset the entire setup.',
      reasoningMemory: [
        { time: '--:--', note: 'Simulation initialised. In rehab. Reviewing previous losses.' },
      ],
      openPosition: null,
      closedTrades: [],
      balance: 1000,
      personality: { discipline: 50, aggression: 80, patience: 35 },
    },
  ];
}

// ─── Position management ───────────────────────────────────────────────────

function getSASTHHMM(): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export function appendReasoning(
  memory: ReasoningEntry[],
  note: string
): ReasoningEntry[] {
  return [{ time: getSASTHHMM(), note }, ...memory].slice(0, 10);
}

export function checkAndUpdatePosition(
  state: TraderState,
  latestCandle: Candle
): { state: TraderState; event: SimEvent | null } {
  const pos = state.openPosition;
  if (!pos) return { state, event: null };

  const { high, low, close } = latestCandle;
  const riskAmt = Math.abs(pos.entryPrice - pos.stopLoss) * pos.size;

  const closeTrade = (
    exitPrice: number,
    rMult: number,
    reason: string
  ): { state: TraderState; event: SimEvent } => {
    const pnl =
      pos.direction === 'BUY'
        ? (exitPrice - pos.entryPrice) * pos.size
        : (pos.entryPrice - exitPrice) * pos.size;
    const newBalance = Math.round((state.balance + pnl) * 100) / 100;
    const closed: ClosedTrade = {
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      exitPrice,
      result: Math.round(pnl * 100) / 100,
      rMultiple: Math.round(rMult * 10) / 10,
      balanceChange: Math.round(pnl * 100) / 100,
      reason,
      exitTime: latestCandle.time,
    };
    const sign = pnl >= 0 ? '+' : '';
    const msg =
      rMult >= 0
        ? `closed ${pos.direction} at ${exitPrice.toFixed(0)} — TP hit +${rMult.toFixed(1)}R (R${sign}${pnl.toFixed(0)})`
        : `stopped out ${pos.direction} at ${exitPrice.toFixed(0)} — SL hit -1R (R${pnl.toFixed(0)})`;

    const memNote = rMult >= 0
      ? `TP hit on ${pos.direction} at ${exitPrice.toFixed(0)}. +${rMult.toFixed(1)}R. Process confirmed.`
      : `SL hit on ${pos.direction} at ${exitPrice.toFixed(0)}. -1R. Reviewing execution.`;

    return {
      state: {
        ...state,
        openPosition: null,
        balance: newBalance,
        closedTrades: [closed, ...state.closedTrades].slice(0, 20),
        status: 'ANALYZING',
        currentAction: rMult >= 0 ? 'Reviewing winning trade' : 'Reviewing loss — checking process',
        recentDecision: msg,
        noTradeReason: rMult >= 0 ? 'Last trade closed in profit. Re-scanning for next setup.' : 'Last trade stopped out. Running post-trade review.',
        reasoningMemory: appendReasoning(state.reasoningMemory, memNote),
      },
      event: { traderId: state.id, msg },
    };
  };

  if (pos.direction === 'BUY') {
    if (high >= pos.takeProfit) return closeTrade(pos.takeProfit, riskAmt > 0 ? (pos.takeProfit - pos.entryPrice) * pos.size / riskAmt : 2, 'Take profit hit');
    if (low <= pos.stopLoss) return closeTrade(pos.stopLoss, -1, 'Stop loss hit');
  } else {
    if (low <= pos.takeProfit) return closeTrade(pos.takeProfit, riskAmt > 0 ? (pos.entryPrice - pos.takeProfit) * pos.size / riskAmt : 2, 'Take profit hit');
    if (high >= pos.stopLoss) return closeTrade(pos.stopLoss, -1, 'Stop loss hit');
  }

  const unrealizedPL =
    pos.direction === 'BUY'
      ? (close - pos.entryPrice) * pos.size
      : (pos.entryPrice - close) * pos.size;

  return {
    state: {
      ...state,
      openPosition: { ...pos, unrealizedPL: Math.round(unrealizedPL * 100) / 100 },
      status: 'IN TRADE',
      currentAction: `Holding ${pos.direction} — monitoring price action`,
    },
    event: null,
  };
}

export function buildPosition(
  state: TraderState,
  direction: 'BUY' | 'SELL',
  entryPrice: number,
  slDistance: number,
  currentTime: number
): Position {
  const riskAmount = state.balance * 0.01;
  const size = Math.max(0.001, riskAmount / slDistance);
  const stopLoss =
    direction === 'BUY' ? entryPrice - slDistance : entryPrice + slDistance;
  const takeProfit =
    direction === 'BUY' ? entryPrice + slDistance * 2 : entryPrice - slDistance * 2;

  return {
    direction,
    entryPrice: Math.round(entryPrice * 10) / 10,
    size: Math.round(size * 1000) / 1000,
    stopLoss: Math.round(stopLoss * 10) / 10,
    takeProfit: Math.round(takeProfit * 10) / 10,
    entryTime: currentTime,
    unrealizedPL: 0,
  };
}
