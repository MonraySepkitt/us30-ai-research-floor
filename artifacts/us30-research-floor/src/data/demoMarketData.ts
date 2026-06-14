export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 0xffffffff;
  };
}

function generateCandles(
  count: number,
  tfMs: number,
  volatility: number,
  seed: number,
  startPrice = 38500,
  meanPrice = 38750
): Candle[] {
  const rand = seededRand(seed);
  const now = Date.now();
  const candles: Candle[] = [];
  let price = startPrice;

  for (let i = count - 1; i >= 0; i--) {
    const drift = (meanPrice - price) * 0.025;
    const noise = (rand() - 0.5) * volatility * 2.2;
    const trendBias = Math.sin(i / 12) * volatility * 0.3;
    const move = drift + noise + trendBias;

    const open = price;
    const close = Math.max(37600, Math.min(39800, price + move));
    const bodySize = Math.abs(close - open);
    const wickUp = rand() * (volatility * 0.5 + bodySize * 0.3);
    const wickDown = rand() * (volatility * 0.5 + bodySize * 0.3);
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    const volume = Math.round(400 + rand() * 1800);

    candles.push({
      time: now - i * tfMs,
      open: Math.round(open * 10) / 10,
      high: Math.round(high * 10) / 10,
      low: Math.round(low * 10) / 10,
      close: Math.round(close * 10) / 10,
      volume,
    });

    price = close;
  }

  return candles;
}

export const candles1H: Candle[] = generateCandles(100, 3_600_000, 65, 42);
export const candles4H: Candle[] = generateCandles(36, 14_400_000, 185, 99);

export function getLatestPrice(): number {
  return candles1H[candles1H.length - 1].close;
}
