export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PatternMatch {
  name: string;
  category: 'Candlestick' | 'Reversal' | 'Continuation' | 'Harmonic' | 'Price Action';
  bias: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number; // 0-100
  description: string;
}

export interface CandleAnatomy {
  open: number;
  high: number;
  low: number;
  close: number;
  bodyPct: number;
  upperWickPct: number;
  lowerWickPct: number;
  verdict: string;
}

export interface SignalResult {
  status: 'STRONG BUY' | 'STRONG SELL' | 'NO SIGNAL';
  confidence: number;
  entry: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  reason: string;
  matchedPatterns: PatternMatch[];
  latestAnatomy: CandleAnatomy;
}

export function analyzeCandleAnatomy(c: Candle): CandleAnatomy {
  const range = Math.max(c.high - c.low, 0.0001);
  const body = Math.abs(c.close - c.open);
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;

  const bodyPct = Number(((body / range) * 100).toFixed(1));
  const upperWickPct = Number(((upperWick / range) * 100).toFixed(1));
  const lowerWickPct = Number(((lowerWick / range) * 100).toFixed(1));

  let verdict = 'Balanced Price Action';
  if (lowerWickPct >= 55 && bodyPct <= 30) {
    verdict = 'Strong Lower Wick Rejection (Buyers Defending Support)';
  } else if (upperWickPct >= 55 && bodyPct <= 30) {
    verdict = 'Strong Upper Wick Rejection (Sellers Defending Resistance)';
  } else if (bodyPct >= 75) {
    verdict = c.close > c.open ? 'Bullish Marubozu Momentum' : 'Bearish Marubozu Momentum';
  } else if (bodyPct <= 10) {
    verdict = 'Doji Indecision Candle';
  }

  return {
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    bodyPct,
    upperWickPct,
    lowerWickPct,
    verdict
  };
}

function findPivots(candles: Candle[], window = 3) {
  const highs: { idx: number; val: number }[] = [];
  const lows: { idx: number; val: number }[] = [];
  for (let i = window; i < candles.length - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (candles[j].high > candles[i].high) isHigh = false;
      if (candles[j].low < candles[i].low) isLow = false;
    }
    if (isHigh) highs.push({ idx: i, val: candles[i].high });
    if (isLow) lows.push({ idx: i, val: candles[i].low });
  }
  return { highs, lows };
}

export function scanAllPatterns(candles: Candle[], pcr: number): SignalResult {
  if (candles.length < 20) {
    const fallback = analyzeCandleAnatomy(candles[candles.length - 1]);
    return {
      status: 'NO SIGNAL',
      confidence: 0,
      entry: null,
      stopLoss: null,
      target1: null,
      target2: null,
      reason: 'Not enough candles to confirm high-probability patterns.',
      matchedPatterns: [],
      latestAnatomy: fallback
    };
  }

  const matches: PatternMatch[] = [];
  const n = candles.length;
  const c1 = candles[n - 3];
  const c2 = candles[n - 2];
  const c3 = candles[n - 1];

  const body = (c: Candle) => Math.abs(c.close - c.open);
  const rng = (c: Candle) => Math.max(c.high - c.low, 0.0001);
  const bull = (c: Candle) => c.close > c.open;
  const bear = (c: Candle) => c.close < c.open;
  const uw = (c: Candle) => c.high - Math.max(c.open, c.close);
  const lw = (c: Candle) => Math.min(c.open, c.close) - c.low;

  // --- 1. SINGLE CANDLESTICK PATTERNS ---
  if (lw(c3) >= 2 * body(c3) && uw(c3) <= 0.25 * rng(c3)) {
    matches.push({ name: 'Hammer / Dragonfly Doji', category: 'Candlestick', bias: 'BUY', strength: 78, description: 'Strong lower wick rejection.' });
  }
  if (uw(c3) >= 2 * body(c3) && lw(c3) <= 0.25 * rng(c3)) {
    matches.push({ name: 'Shooting Star / Gravestone Doji', category: 'Candlestick', bias: 'SELL', strength: 78, description: 'Strong upper wick rejection.' });
  }
  if (body(c3) / rng(c3) >= 0.85) {
    matches.push({
      name: bull(c3) ? 'Bullish Marubozu' : 'Bearish Marubozu',
      category: 'Candlestick',
      bias: bull(c3) ? 'BUY' : 'SELL',
      strength: 76,
      description: 'Full-body momentum candle with minimal wicks.'
    });
  }

  // --- 2. TWO-CANDLE PATTERNS ---
  if (bear(c2) && bull(c3) && c3.close > c2.open && c3.open <= c2.close) {
    matches.push({ name: 'Bullish Engulfing', category: 'Candlestick', bias: 'BUY', strength: 85, description: 'Green candle completely engulfs prior red candle.' });
  }
  if (bull(c2) && bear(c3) && c3.close < c2.open && c3.open >= c2.close) {
    matches.push({ name: 'Bearish Engulfing', category: 'Candlestick', bias: 'SELL', strength: 85, description: 'Red candle completely engulfs prior green candle.' });
  }
  if (bear(c2) && bull(c3) && c3.open > c2.close && c3.close < c2.open) {
    matches.push({ name: 'Bullish Harami', category: 'Candlestick', bias: 'BUY', strength: 72, description: 'Inside bullish reversal bar.' });
  }
  if (bull(c2) && bear(c3) && c3.open < c2.close && c3.close > c2.open) {
    matches.push({ name: 'Bearish Harami', category: 'Candlestick', bias: 'SELL', strength: 72, description: 'Inside bearish reversal bar.' });
  }
  if (bear(c2) && bull(c3) && c3.open < c2.low && c3.close > (c2.open + c2.close) / 2) {
    matches.push({ name: 'Piercing Line', category: 'Candlestick', bias: 'BUY', strength: 80, description: 'Bullish close above midpoint of prior red candle.' });
  }
  if (bull(c2) && bear(c3) && c3.open > c2.high && c3.close < (c2.open + c2.close) / 2) {
    matches.push({ name: 'Dark Cloud Cover', category: 'Candlestick', bias: 'SELL', strength: 80, description: 'Bearish close below midpoint of prior green candle.' });
  }
  if (Math.abs(c2.low - c3.low) / c3.low < 0.0008 && bear(c2) && bull(c3)) {
    matches.push({ name: 'Tweezer Bottom', category: 'Candlestick', bias: 'BUY', strength: 78, description: 'Matching lows rejecting lower prices.' });
  }
  if (Math.abs(c2.high - c3.high) / c3.high < 0.0008 && bull(c2) && bear(c3)) {
    matches.push({ name: 'Tweezer Top', category: 'Candlestick', bias: 'SELL', strength: 78, description: 'Matching highs rejecting higher prices.' });
  }

  // --- 3. THREE-CANDLE PATTERNS ---
  if (bear(c1) && body(c2) < 0.35 * body(c1) && bull(c3) && c3.close > (c1.open + c1.close) / 2) {
    matches.push({ name: 'Morning Star', category: 'Candlestick', bias: 'BUY', strength: 88, description: 'Classic 3-candle bottom reversal.' });
  }
  if (bull(c1) && body(c2) < 0.35 * body(c1) && bear(c3) && c3.close < (c1.open + c1.close) / 2) {
    matches.push({ name: 'Evening Star', category: 'Candlestick', bias: 'SELL', strength: 88, description: 'Classic 3-candle top reversal.' });
  }
  if (bull(c1) && bull(c2) && bull(c3) && c3.close > c2.close && c2.close > c1.close) {
    matches.push({ name: 'Three White Soldiers', category: 'Candlestick', bias: 'BUY', strength: 84, description: 'Three consecutive strong bullish candles.' });
  }
  if (bear(c1) && bear(c2) && bear(c3) && c3.close < c2.close && c2.close < c1.close) {
    matches.push({ name: 'Three Black Crows', category: 'Candlestick', bias: 'SELL', strength: 84, description: 'Three consecutive strong bearish candles.' });
  }

  // --- 4. STRUCTURAL CHART PATTERNS (REVERSAL, CONTINUATION, HARMONIC) ---
  const { highs, lows } = findPivots(candles, 3);

  if (highs.length >= 2) {
    const h1 = highs[highs.length - 2].val;
    const h2 = highs[highs.length - 1].val;
    if (Math.abs(h1 - h2) / h1 < 0.004) {
      if (highs.length >= 3 && Math.abs(highs[highs.length - 3].val - h2) / h2 < 0.005) {
        matches.push({ name: 'Triple Top', category: 'Reversal', bias: 'SELL', strength: 88, description: 'Three failed resistance tests signaling breakdown.' });
      } else {
        matches.push({ name: 'Double Top', category: 'Reversal', bias: 'SELL', strength: 82, description: 'M-shaped bearish reversal at resistance.' });
      }
    }
  }

  if (lows.length >= 2) {
    const l1 = lows[lows.length - 2].val;
    const l2 = lows[lows.length - 1].val;
    if (Math.abs(l1 - l2) / l1 < 0.004) {
      if (lows.length >= 3 && Math.abs(lows[lows.length - 3].val - l2) / l2 < 0.005) {
        matches.push({ name: 'Triple Bottom', category: 'Reversal', bias: 'BUY', strength: 88, description: 'Three strong support tests signaling breakout.' });
      } else {
        matches.push({ name: 'Double Bottom', category: 'Reversal', bias: 'BUY', strength: 82, description: 'W-shaped bullish reversal at support.' });
      }
    }
  }

  if (highs.length >= 3) {
    const ls = highs[highs.length - 3].val;
    const hd = highs[highs.length - 2].val;
    const rs = highs[highs.length - 1].val;
    if (hd > ls && hd > rs && Math.abs(ls - rs) / hd < 0.012) {
      matches.push({ name: 'Head & Shoulders', category: 'Reversal', bias: 'SELL', strength: 90, description: 'Major bearish trend reversal structure.' });
    }
  }

  if (lows.length >= 3) {
    const ls = lows[lows.length - 3].val;
    const hd = lows[lows.length - 2].val;
    const rs = lows[lows.length - 1].val;
    if (hd < ls && hd < rs && Math.abs(ls - rs) / hd < 0.012) {
      matches.push({ name: 'Inverse Head & Shoulders', category: 'Reversal', bias: 'BUY', strength: 90, description: 'Major bullish trend reversal structure.' });
    }
  }

  if (highs.length >= 2 && lows.length >= 2) {
    const hPrev = highs[highs.length - 2].val;
    const hLast = highs[highs.length - 1].val;
    const lPrev = lows[lows.length - 2].val;
    const lLast = lows[lows.length - 1].val;

    if (hLast < hPrev && lLast > lPrev) {
      matches.push({
        name: 'Symmetrical Triangle / Pennant',
        category: 'Continuation',
        bias: bull(c3) ? 'BUY' : 'SELL',
        strength: 80,
        description: 'Volatility squeeze preparing for directional breakout.'
      });
    } else if (Math.abs(hLast - hPrev) / hPrev < 0.003 && lLast > lPrev) {
      matches.push({ name: 'Ascending Triangle', category: 'Continuation', bias: 'BUY', strength: 84, description: 'Flat resistance with rising higher lows.' });
    } else if (Math.abs(lLast - lPrev) / lPrev < 0.003 && hLast < hPrev) {
      matches.push({ name: 'Descending Triangle', category: 'Continuation', bias: 'SELL', strength: 84, description: 'Flat support with falling lower highs.' });
    } else if (hLast < hPrev && lLast < lPrev && (hPrev - hLast) > (lPrev - lLast)) {
      matches.push({ name: 'Falling Wedge', category: 'Reversal', bias: 'BUY', strength: 83, description: 'Converging downward wedge signaling bullish breakout.' });
    } else if (hLast > hPrev && lLast > lPrev && (lLast - lPrev) > (hLast - hPrev)) {
      matches.push({ name: 'Rising Wedge', category: 'Reversal', bias: 'SELL', strength: 83, description: 'Converging upward wedge signaling bearish breakdown.' });
    } else if (hLast > hPrev && lLast < lPrev) {
      matches.push({ name: 'Broadening Formation (Megaphone)', category: 'Reversal', bias: 'NEUTRAL', strength: 70, description: 'Expanding Higher Highs and Lower Lows — high volatility.' });
    }
  }

  // --- 5. HARMONIC ABCD CHECK ---
  if (highs.length >= 2 && lows.length >= 2) {
    const ab = Math.abs(highs[highs.length - 2].val - lows[lows.length - 2].val);
    const cd = Math.abs(highs[highs.length - 1].val - lows[lows.length - 1].val);
    if (ab > 0 && Math.abs(cd / ab - 1.0) < 0.12) {
      matches.push({
        name: 'Harmonic ABCD Completion',
        category: 'Harmonic',
        bias: bull(c3) ? 'BUY' : 'SELL',
        strength: 82,
        description: 'Equal leg harmonic symmetry detected.'
      });
    }
  }

  // --- 6. STRICT STRONG-SIGNAL CONFLUENCE ENGINE ---
  let buyScore = matches.filter(m => m.bias === 'BUY').reduce((s, m) => s + m.strength, 0);
  let sellScore = matches.filter(m => m.bias === 'SELL').reduce((s, m) => s + m.strength, 0);

  // Option Chain PCR Confirmation
  if (pcr >= 1.15) buyScore += 20;
  if (pcr <= 0.85) sellScore += 20;

  // ATR for Stop Loss & Targets
  let atrSum = 0;
  for (let i = n - 14; i < n; i++) atrSum += candles[i].high - candles[i].low;
  const atr = atrSum / 14;
  const latestAnatomy = analyzeCandleAnatomy(c3);

  // STRICT THRESHOLD: Must be >= 95 combined score (e.g., strong pattern + PCR or 2 confirming patterns)
  // AND clear dominance over the opposite side. Otherwise -> NO SIGNAL!
  const STRONG_THRESHOLD = 95;

  if (buyScore >= STRONG_THRESHOLD && buyScore >= sellScore + 40) {
    const confidence = Math.min(97, Math.round(65 + buyScore / 6));
    const entry = Number(c3.close.toFixed(2));
    return {
      status: 'STRONG BUY',
      confidence,
      entry,
      stopLoss: Number((entry - 1.2 * atr).toFixed(2)),
      target1: Number((entry + 1.8 * atr).toFixed(2)),
      target2: Number((entry + 3.0 * atr).toFixed(2)),
      reason: `Strong bullish confluence (${matches.filter(m => m.bias === 'BUY').map(m => m.name).join(' + ')}) with PCR ${pcr}.`,
      matchedPatterns: matches,
      latestAnatomy
    };
  }

  if (sellScore >= STRONG_THRESHOLD && sellScore >= buyScore + 40) {
    const confidence = Math.min(97, Math.round(65 + sellScore / 6));
    const entry = Number(c3.close.toFixed(2));
    return {
      status: 'STRONG SELL',
      confidence,
      entry,
      stopLoss: Number((entry + 1.2 * atr).toFixed(2)),
      target1: Number((entry - 1.8 * atr).toFixed(2)),
      target2: Number((entry - 3.0 * atr).toFixed(2)),
      reason: `Strong bearish confluence (${matches.filter(m => m.bias === 'SELL').map(m => m.name).join(' + ')}) with PCR ${pcr}.`,
      matchedPatterns: matches,
      latestAnatomy
    };
  }

  return {
    status: 'NO SIGNAL',
    confidence: Math.max(buyScore, sellScore) > 0 ? 45 : 15,
    entry: null,
    stopLoss: null,
    target1: null,
    target2: null,
    reason: 'No high-conviction setup right now. Waiting for stronger pattern + Option Chain confirmation.',
    matchedPatterns: matches,
    latestAnatomy
  };
}
