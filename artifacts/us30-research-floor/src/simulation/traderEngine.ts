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
      internalReasoning:
        'Price above 4H order block. Watching for liquidity sweep above recent high.',
      recentDecision: 'Skipped — liquidity sweep not confirmed',
      timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'Order blocks & FVGs',
      alternativeScenario: 'If price drops below 38,600, flip to bearish',
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
      internalReasoning:
        'SMA20 and SMA50 converging on 1H. Waiting for clear directional close.',
      recentDecision: 'No trade — trend not confirmed',
      timeframesReviewed: ['4H', '1H'],
      strategyFocus: 'SMA trend & momentum',
      alternativeScenario: 'If 4H closes above 38,900, look for 1H pullback entry',
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
      internalReasoning:
        'Compression forming on 1H. ATR contracting. Waiting for breakout trigger.',
      recentDecision: 'Entered early — range not fully formed',
      timeframesReviewed: ['1H'],
      strategyFocus: 'Range breakout & volatility',
      alternativeScenario: 'If range holds 3+ more candles, breakout probability increases',
      openPosition: null,
      closedTrades: [],
      balance: 1000,
      personality: { discipline: 50, aggression: 80, patience: 35 },
    },
  ];
}

// ─── Position management ───────────────────────────────────────────────────

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
    return {
      state: {
        ...state,
        openPosition: null,
        balance: newBalance,
        closedTrades: [closed, ...state.closedTrades].slice(0, 20),
        status: 'ANALYZING',
        currentAction: rMult >= 0 ? 'Reviewing winning trade' : 'Reviewing loss — checking process',
        recentDecision: msg,
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
