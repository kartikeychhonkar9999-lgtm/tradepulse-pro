import React, { useState, useMemo } from 'react';
import { Activity, Zap, ShieldAlert, TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';
import { LiveChart } from './components/LiveChart';
import { Candle, scanAllPatterns, analyzeCandleAnatomy, SignalResult, CandleAnatomy } from './engine/allPatternsEngine';

function generateSampleCandles(basePrice: number, count = 60): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  for (let i = count; i > 0; i--) {
    const move = (Math.random() - 0.49) * (basePrice * 0.003);
    const open = price;
    const close = open + move;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.0015);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.0015);
    candles.push({
      time: now - i * 300,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2))
    });
    price = close;
  }
  return candles;
}

const OPTION_CHAINS = {
  NIFTY: [
    { strike: 24400, callLtp: 185.4, callOi: '42.1L', putLtp: 62.8, putOi: '68.5L' },
    { strike: 24500, callLtp: 118.2, callOi: '58.9L', putLtp: 98.5, putOi: '74.2L' },
    { strike: 24600, callLtp: 68.7, callOi: '71.4L', putLtp: 152.1, putOi: '49.0L' }
  ],
  CRUDEOIL: [
    { strike: 5800, callLtp: 142.0, callOi: '12.4K', putLtp: 64.5, putOi: '19.8K' },
    { strike: 5850, callLtp: 98.5, callOi: '16.2K', putLtp: 96.0, putOi: '21.1K' },
    { strike: 5900, callLtp: 61.0, callOi: '22.8K', putLtp: 138.5, putOi: '14.3K' }
  ]
};

export default function App() {
  const [market, setMarket] = useState<'NIFTY' | 'CRUDEOIL'>('NIFTY');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50 SPOT');
  const [pcr, setPcr] = useState<number>(1.22);
  const [candles, setCandles] = useState<Candle[]>(() => generateSampleCandles(24510));
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const [selectedAnatomy, setSelectedAnatomy] = useState<CandleAnatomy | null>(null);

  const switchMarket = (m: 'NIFTY' | 'CRUDEOIL') => {
    setMarket(m);
    setSelectedSymbol(m === 'NIFTY' ? 'NIFTY 50 SPOT' : 'MCX CRUDE OIL FUT');
    setPcr(m === 'NIFTY' ? 1.22 : 0.82);
    setCandles(generateSampleCandles(m === 'NIFTY' ? 24510 : 5852));
    setSignal(null);
    setSelectedAnatomy(null);
  };

  const openOptionStrike = (strike: number, type: 'CE' | 'PE', ltp: number) => {
    setSelectedSymbol(`${market} ${strike} ${type}`);
    setCandles(generateSampleCandles(ltp));
    setSignal(null);
    setSelectedAnatomy(null);
  };

  const handleAnalyzeClick = () => {
    const result = scanAllPatterns(candles, pcr);
    setSignal(result);
    setSelectedAnatomy(result.latestAnatomy);
  };

  const latestPrice = useMemo(() => candles[candles.length - 1]?.close ?? 0, [candles]);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0b101b]/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <span className="font-bold tracking-tight text-base">TradePulse Pro</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => switchMarket('NIFTY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${market === 'NIFTY' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            NIFTY F&O
          </button>
          <button
            onClick={() => switchMarket('CRUDEOIL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${market === 'CRUDEOIL' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            CRUDE OIL
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Active Symbol Bar */}
        <div className="flex items-center justify-between bg-[#0f1626] p-3 rounded-xl border border-slate-800">
          <div>
            <div className="text-xs text-slate-400">ACTIVE CHART</div>
            <div className="text-lg font-bold">{selectedSymbol}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">LTP / PCR: {pcr}</div>
            <div className="text-lg font-mono font-bold text-emerald-400">₹{latestPrice}</div>
          </div>
        </div>

        {/* Live Chart */}
        <LiveChart
          candles={candles}
          onSelectCandle={(c) => setSelectedAnatomy(analyzeCandleAnatomy(c))}
        />

        {/* DEDICATED ANALYZE & GET SIGNAL BUTTON */}
        <button
          onClick={handleAnalyzeClick}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition"
        >
          <Zap className="w-4 h-4" />
          ANALYZE ALL PATTERNS & GET SIGNAL
        </button>

        {/* Strict Signal Result Card */}
        {signal && (
          <div className={`p-4 rounded-xl border ${
            signal.status === 'STRONG BUY' ? 'bg-emerald-950/40 border-emerald-500/60' :
            signal.status === 'STRONG SELL' ? 'bg-rose-950/40 border-rose-500/60' :
            'bg-slate-900 border-slate-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {signal.status === 'STRONG BUY' && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                {signal.status === 'STRONG SELL' && <TrendingDown className="w-5 h-5 text-rose-400" />}
                {signal.status === 'NO SIGNAL' && <MinusCircle className="w-5 h-5 text-slate-400" />}
                <span className="text-xl font-black tracking-tight">{signal.status}</span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 font-semibold">
                Confidence: {signal.confidence}%
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-3">{signal.reason}</p>

            {signal.status !== 'NO SIGNAL' && (
              <div className="grid grid-cols-4 gap-2 text-center bg-slate-950/60 p-2.5 rounded-lg">
                <div><div className="text-[10px] text-slate-400">ENTRY</div><div className="font-mono font-bold text-sm">{signal.entry}</div></div>
                <div><div className="text-[10px] text-rose-400">STOP LOSS</div><div className="font-mono font-bold text-sm text-rose-400">{signal.stopLoss}</div></div>
                <div><div className="text-[10px] text-emerald-400">TARGET 1</div><div className="font-mono font-bold text-sm text-emerald-400">{signal.target1}</div></div>
                <div><div className="text-[10px] text-emerald-300">TARGET 2</div><div className="font-mono font-bold text-sm text-emerald-300">{signal.target2}</div></div>
              </div>
            )}

            {signal.matchedPatterns.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {signal.matchedPatterns.map((p, idx) => (
                  <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {p.name} ({p.bias})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deep Candle Anatomy Inspector */}
        {selectedAnatomy && (
          <div className="bg-[#0f1626] p-4 rounded-xl border border-slate-800">
            <div className="text-xs font-bold text-cyan-400 mb-2">DEEP CANDLE ANATOMY INSPECTOR</div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div className="bg-slate-900 p-2 rounded">Upper Wick: <b>{selectedAnatomy.upperWickPct}%</b></div>
              <div className="bg-slate-900 p-2 rounded">Body: <b>{selectedAnatomy.bodyPct}%</b></div>
              <div className="bg-slate-900 p-2 rounded">Lower Wick: <b>{selectedAnatomy.lowerWickPct}%</b></div>
            </div>
            <div className="text-xs text-slate-300">Verdict: <span className="font-semibold text-white">{selectedAnatomy.verdict}</span></div>
          </div>
        )}

        {/* Connected Option Chain */}
        <div className="bg-[#0f1626] p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-bold text-slate-300 mb-2">CONNECTED OPTION CHAIN (TAP ANY LTP TO OPEN CHART)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2">CALL OI</th>
                  <th className="py-2">CALL LTP</th>
                  <th className="py-2">STRIKE</th>
                  <th className="py-2">PUT LTP</th>
                  <th className="py-2">PUT OI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {OPTION_CHAINS[market].map((row) => (
                  <tr key={row.strike}>
                    <td className="py-2 text-slate-400">{row.callOi}</td>
                    <td className="py-2">
                      <button
                        onClick={() => openOptionStrike(row.strike, 'CE', row.callLtp)}
                        className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 font-mono font-bold hover:bg-emerald-500/30"
                      >
                        ₹{row.callLtp}
                      </button>
                    </td>
                    <td className="py-2 font-bold">{row.strike}</td>
                    <td className="py-2">
                      <button
                        onClick={() => openOptionStrike(row.strike, 'PE', row.putLtp)}
                        className="px-2 py-1 rounded bg-rose-500/15 text-rose-400 font-mono font-bold hover:bg-rose-500/30"
                      >
                        ₹{row.putLtp}
                      </button>
                    </td>
                    <td className="py-2 text-slate-400">{row.putOi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Educational analysis tool. Connect your free Angel One SmartAPI backend in production for live NSE/MCX ticks.</span>
        </div>
      </main>
    </div>
  );
}
