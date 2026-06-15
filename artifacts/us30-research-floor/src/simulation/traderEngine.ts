import type { Candle } from '../data/demoMarketData';

export type TraderId = 'ict' | 'trend' | 'breakout';
export type Bias = 'Bullish' | 'Bearish' | 'Neutral';
export type TraderStatus =
  | 'ANALYZING' | 'THINKING' | 'WAITING' | 'RESEARCHING'
  | 'DISCUSSING' | 'IN TRADE' | 'REHAB';

export interface Position {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  size: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: number;
  unrealizedPL: number;
  entryReason: string;
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

export interface JournalEntry {
  tradeNumber: number;
  entryTimeSAST: string;
  exitTimeSAST: string;
  traderName: string;
  strategyVersion: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryReason: string;
  exitReason: string;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  rMultiple: number;
  balanceChange: number;
  marketContext: string;
  timeframesReviewed: string[];
  mistakes: string;
  lessonLearned: string;
  proposedImprovement: string;
}

export interface LossProtocol {
  tradeNumber: number;
  timestamp: string;
  lossDescription: string;
  whyItHappened: string;
  lessonLearned: string;
  proposedImprovement: string;
  futureTestIdea: string;
}

export interface ResearchProject {
  id: string;
  question: string;
  reason: string;
  status: 'ACTIVE' | 'COMPLETE' | 'REJECTED';
  progress: number;
  tradesReviewed: number;
  currentFindings: string;
  proposedStrategyChange: string;
  lastUpdated: string;
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
  openPosition: Position | null;
  closedTrades: ClosedTrade[];
  balance: number;
  personality: { discipline: number; aggression: number; patience: number };
  journal: JournalEntry[];
  lossProtocol: LossProtocol[];
  researchProjects: ResearchProject[];
}

export interface SimEvent {
  traderId: TraderId;
  msg: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getSASTHHMM(): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

function getSASTDateTime(): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replace(',', '');
}

export function appendReasoning(memory: ReasoningEntry[], note: string): ReasoningEntry[] {
  return [{ time: getSASTHHMM(), note }, ...memory].slice(0, 10);
}

// ─── Loss protocol generators ─────────────────────────────────────────────

function makeLossProtocol(
  id: TraderId,
  tradeNumber: number,
  direction: 'BUY' | 'SELL',
  entryReason: string,
  exitPrice: number
): LossProtocol {
  const ict = {
    whyItHappened: pickOne([
      'Entered before liquidity sweep was fully confirmed — price had not yet taken short-term liquidity.',
      'Stop was placed too close to recent market structure — normal volatility triggered premature exit.',
      'Entry occurred outside optimal NY session window — low liquidity widened spread and increased slippage.',
      'FVG entry was taken without prior 15M market structure shift confirmation.',
      'Entered against HTF bias — 4H structure was not fully aligned with the 1H setup.',
    ]),
    lessonLearned: pickOne([
      'Wait for the full liquidity sweep candle to close before considering any entry.',
      'Place stops below the actual sweep low, not the nearest obvious structure level.',
      'Restrict ICT entries to the 15:30–18:00 SAST New York Open window only.',
      'MSS must form and close on 15M before any FVG fill entry — no exceptions.',
      'Confirm HTF 4H structure aligns with 1H entry bias before executing.',
    ]),
    proposedImprovement: pickOne([
      'Add a sweep confirmation checklist: sweep close inside range + follow-through displacement candle.',
      'Widen stop to 1.5× ATR to account for volatility spikes during session opens.',
      'Require 15M MSS to close before any FVG retracement entry is taken.',
      'Add session filter — mark any trade taken outside NY session as observation only.',
    ]),
    futureTestIdea: pickOne([
      'Test: Do ICT setups taken during NY Open (15:30–17:30 SAST) show higher win rates vs all-session entries?',
      'Test: Does requiring a full candle close inside range after sweep improve confluence score from 2/3 to 3/3?',
      'Test: Does 1.5× ATR stop placement reduce stop-out rate without meaningfully impacting net R?',
      'Test: Does 15M MSS requirement filter out 40%+ of losing trades?',
    ]),
  };

  const trend = {
    whyItHappened: pickOne([
      'Entered without sufficient momentum confirmation — only 2 of 3 required candles aligned.',
      'HTF 4H structure was opposing the trade direction — higher timeframe conflict was ignored.',
      'SMA20/SMA50 gap was too narrow at entry — trend was not firmly established.',
      'Entered during SMA convergence — choppy market conditions negated trend bias.',
      'Pulled back to SMA20 but counter-momentum candle appeared — premature entry.',
    ]),
    lessonLearned: pickOne([
      'Never enter with fewer than 3 momentum-confirming candles in the trend direction.',
      'Always check 4H SMA alignment before any 1H entry — higher timeframe takes priority.',
      'Require SMA20/SMA50 gap of at least 50pts before considering the trend tradeable.',
      'SMA convergence (gap < 30pts) is a hard no-trade condition — do not override.',
      'If a counter-trend candle appears during pullback, skip the entry and wait for the next.',
    ]),
    proposedImprovement: pickOne([
      'Add mandatory 4H SMA alignment check before any 1H pullback entry.',
      'Increase minimum SMA gap requirement from 40pts to 55pts.',
      'Require 3+ confirming candles to close before entry, not just form.',
      'Add a counter-momentum candle filter to the pullback entry checklist.',
    ]),
    futureTestIdea: pickOne([
      'Test: Do 4H-aligned pullbacks show a higher win rate than non-aligned 1H pullbacks?',
      'Test: Does requiring SMA gap > 55pts at entry reduce losses without cutting too many winners?',
      'Test: Does adding a "no counter-momentum candle" rule improve entry quality?',
      'Test: Does requiring 4+ confirming candles (vs 3) meaningfully improve win rate?',
    ]),
  };

  const breakout = {
    whyItHappened: pickOne([
      'Entered on the first breakout candle without waiting for confirmation or retest.',
      'Range compression period was insufficient — fewer than 4 candles of tight compression.',
      'ATR was elevated before entry — entered during an existing high-volatility expansion period.',
      'Breakout candle had a long wick back inside the range — false break signal was not spotted.',
      'Entered breakout without checking if range size met minimum compression ratio.',
    ]),
    lessonLearned: pickOne([
      'Require at least 4 candles of tight compression before any breakout entry is considered valid.',
      'Never enter on the first breakout candle — wait for at least one additional candle to confirm direction.',
      'Check ATR before entry: do not enter if ATR is already > 1.3× the recent average.',
      'A wick re-entry on the breakout candle is an automatic no-trade condition.',
      'Confirm range size is below 1.6× ATR before the breakout — tight compression only.',
    ]),
    proposedImprovement: pickOne([
      'Add a minimum 4-candle compression rule to the entry checklist.',
      'Require a second confirmation candle to close outside range before entry.',
      'Add an ATR pre-entry filter: ATR must be below 1.3× 20-period ATR average.',
      'Add a wick re-entry filter: any wick back inside range on breakout candle = skip.',
    ]),
    futureTestIdea: pickOne([
      'Test: Do breakout trades after 4+ candle compression show higher follow-through than 2–3 candle setups?',
      'Test: Does requiring a second confirmation candle reduce false breakout entries by 30%+?',
      'Test: Does adding ATR filter at entry improve overall R multiple on winners?',
      'Test: Measure false breakout rate specifically when breakout candle has wick > 30% of body.',
    ]),
  };

  const src = id === 'ict' ? ict : id === 'trend' ? trend : breakout;

  return {
    tradeNumber,
    timestamp: getSASTDateTime(),
    lossDescription: `${direction} trade at ${exitPrice.toFixed(0)} stopped out. Reason: ${entryReason}.`,
    whyItHappened: src.whyItHappened,
    lessonLearned: src.lessonLearned,
    proposedImprovement: src.proposedImprovement,
    futureTestIdea: src.futureTestIdea,
  };
}

// ─── Journal entry builder ────────────────────────────────────────────────

function makeJournalEntry(
  state: TraderState,
  pos: Position,
  exitPrice: number,
  rMult: number,
  exitReason: string,
  pnl: number
): JournalEntry {
  const outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' =
    pnl > 0.05 ? 'WIN' : pnl < -0.05 ? 'LOSS' : 'BREAKEVEN';
  const isLoss = outcome === 'LOSS';
  const tradeNum = state.journal.length + 1;

  const ictMistakes = isLoss ? pickOne([
    'Entered before sweep candle closed — confirmation was incomplete.',
    'Stop was too tight relative to the recent swing structure.',
    'Session timing was not optimal — entered outside NY session window.',
    'FVG entry taken without prior 15M MSS confirmation.',
  ]) : '';

  const trendMistakes = isLoss ? pickOne([
    'Momentum confirmation was marginal — only 2 candles aligned vs required 3.',
    'HTF structure conflict was present but ignored.',
    'SMA gap was below threshold — trend was not clearly established.',
    'Counter-momentum candle appeared on pullback but entry was not deferred.',
  ]) : '';

  const breakoutMistakes = isLoss ? pickOne([
    'Entered on the first breakout candle without secondary confirmation.',
    'Compression period was too short — less than 4 candles of range.',
    'Wick back inside range on breakout candle was not flagged.',
    'ATR was elevated before entry — volatility filter was not applied.',
  ]) : '';

  const mistakes = state.id === 'ict' ? ictMistakes
    : state.id === 'trend' ? trendMistakes
    : breakoutMistakes;

  const ictLesson = isLoss
    ? pickOne(['Confirm sweep on close. No entry without closed sweep candle.', 'Stop below sweep low, not nearest swing.', 'NY session only for ICT setups.'])
    : pickOne(['Setup confirmed — continue requiring 2+ conditions before entry.', 'Process followed correctly. Maintain patience for next setup.', 'Confluence score of 2+/3 working as intended.']);

  const trendLesson = isLoss
    ? pickOne(['3 candles minimum before entry. No exceptions.', 'Check 4H SMA before any 1H entry.', 'SMA gap > 50pts required.'])
    : pickOne(['SMA trend + momentum alignment continues to work.', 'Pullback to SMA20 entry confirmed.', 'Hold the process — trend entries require patience.']);

  const breakoutLesson = isLoss
    ? pickOne(['4+ candle compression required. First candle is never the entry.', 'ATR filter needed pre-entry.', 'Wick re-entry = automatic skip.'])
    : pickOne(['Compression breakout confirmed — range setup continues to perform.', 'First candle confirmation rule paid off.', 'Keep requiring minimum compression before entry.']);

  const lessonLearned = state.id === 'ict' ? ictLesson
    : state.id === 'trend' ? trendLesson
    : breakoutLesson;

  const ictImprovement = isLoss
    ? 'Add sweep confirmation checklist before every entry.'
    : 'Document session timing for each win — track NY Open performance separately.';

  const trendImprovement = isLoss
    ? 'Add 4H alignment gate to entry process.'
    : 'Continue tracking SMA gap size at entry — monitor if > 60pts improves result.';

  const breakoutImprovement = isLoss
    ? 'Add minimum 4-candle compression requirement as hard rule.'
    : 'Track range size at entry — confirm < 1.5× ATR is the sweet spot.';

  const proposedImprovement = state.id === 'ict' ? ictImprovement
    : state.id === 'trend' ? trendImprovement
    : breakoutImprovement;

  return {
    tradeNumber: tradeNum,
    entryTimeSAST: getSASTDateTime(),
    exitTimeSAST: getSASTDateTime(),
    traderName: state.name,
    strategyVersion: state.strategyVersion,
    direction: pos.direction,
    entryPrice: pos.entryPrice,
    exitPrice,
    entryReason: pos.entryReason || state.internalReasoning,
    exitReason,
    outcome,
    rMultiple: Math.round(rMult * 10) / 10,
    balanceChange: Math.round(pnl * 100) / 100,
    marketContext: state.marketNarrative,
    timeframesReviewed: [...state.timeframesReviewed],
    mistakes,
    lessonLearned,
    proposedImprovement,
  };
}

// ─── Initial state ────────────────────────────────────────────────────────

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
      journal: [],
      lossProtocol: [],
      researchProjects: [
        {
          id: 'ict-r1',
          question: 'Do liquidity sweep entries perform better during NY Open (15:30–18:00 SAST)?',
          reason: 'Multiple sweep entries taken outside optimal session hours are showing lower confluence scores and higher stop rates.',
          status: 'ACTIVE',
          progress: 15,
          tradesReviewed: 2,
          currentFindings: 'Early data: NY session sweeps showing ~65% confluence alignment vs ~40% outside session. Sample too small to conclude.',
          proposedStrategyChange: 'Restrict sweep entries to 15:30–18:00 SAST window only. Mark all off-session entries as "observation" to build data.',
          lastUpdated: '--:--',
        },
      ],
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
      journal: [],
      lossProtocol: [],
      researchProjects: [
        {
          id: 'trend-r1',
          question: 'Do 4H-aligned pullbacks produce significantly higher win-rate continuation trades than non-aligned 1H entries?',
          reason: 'Several 1H pullback entries were taken without first confirming 4H SMA alignment, resulting in lower-quality setups.',
          status: 'ACTIVE',
          progress: 20,
          tradesReviewed: 3,
          currentFindings: 'Preliminary: 4H-aligned pullbacks show ~70% win rate vs ~52% for non-aligned entries. Requires 10+ trade sample to confirm.',
          proposedStrategyChange: 'Add mandatory 4H SMA check as first gate before any 1H pullback entry is considered.',
          lastUpdated: '--:--',
        },
      ],
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
      journal: [],
      lossProtocol: [],
      researchProjects: [
        {
          id: 'breakout-r1',
          question: 'Do breakout trades after 4+ candle compression show better follow-through than 2–3 candle setups?',
          reason: 'Short compression periods are producing more false breakouts than extended ones. Need to quantify the minimum compression requirement.',
          status: 'ACTIVE',
          progress: 25,
          tradesReviewed: 4,
          currentFindings: '4+ candle compression shows cleaner breakouts in 3 of 4 cases reviewed. 2-candle setups failed 2 of 3 times. Early result supports longer compression requirement.',
          proposedStrategyChange: 'Add minimum 4-candle compression rule as a hard entry gate. Any setup with fewer candles is automatically skipped.',
          lastUpdated: '--:--',
        },
      ],
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
    const tradeNum = state.closedTrades.length + 1;

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

    const journalEntry = makeJournalEntry(state, pos, exitPrice, rMult, reason, pnl);
    const newLossProtocol = rMult < 0
      ? [makeLossProtocol(state.id, tradeNum, pos.direction, pos.entryReason, exitPrice), ...state.lossProtocol].slice(0, 20)
      : state.lossProtocol;

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
        noTradeReason: rMult >= 0
          ? 'Last trade closed in profit. Re-scanning for next setup.'
          : 'Last trade stopped out. Running post-trade review.',
        reasoningMemory: appendReasoning(state.reasoningMemory, memNote),
        journal: [journalEntry, ...state.journal].slice(0, 30),
        lossProtocol: newLossProtocol,
      },
      event: { traderId: state.id, msg },
    };
  };

  if (pos.direction === 'BUY') {
    if (high >= pos.takeProfit)
      return closeTrade(pos.takeProfit, riskAmt > 0 ? (pos.takeProfit - pos.entryPrice) * pos.size / riskAmt : 2, 'Take profit hit');
    if (low <= pos.stopLoss)
      return closeTrade(pos.stopLoss, -1, 'Stop loss hit');
  } else {
    if (low <= pos.takeProfit)
      return closeTrade(pos.takeProfit, riskAmt > 0 ? (pos.entryPrice - pos.takeProfit) * pos.size / riskAmt : 2, 'Take profit hit');
    if (high >= pos.stopLoss)
      return closeTrade(pos.stopLoss, -1, 'Stop loss hit');
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
  currentTime: number,
  entryReason = ''
): Position {
  const riskAmount = state.balance * 0.01;
  const size = Math.max(0.001, riskAmount / slDistance);
  const stopLoss = direction === 'BUY' ? entryPrice - slDistance : entryPrice + slDistance;
  const takeProfit = direction === 'BUY' ? entryPrice + slDistance * 2 : entryPrice - slDistance * 2;

  return {
    direction,
    entryPrice: Math.round(entryPrice * 10) / 10,
    size: Math.round(size * 1000) / 1000,
    stopLoss: Math.round(stopLoss * 10) / 10,
    takeProfit: Math.round(takeProfit * 10) / 10,
    entryTime: currentTime,
    unrealizedPL: 0,
    entryReason,
  };
}
