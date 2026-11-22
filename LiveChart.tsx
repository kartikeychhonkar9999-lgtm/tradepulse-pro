import React, { useEffect, useRef } from 'react';
import { createChart, ISeriesApi } from 'lightweight-charts';
import { Candle } from '../engine/allPatternsEngine';

interface Props {
  candles: Candle[];
  onSelectCandle: (candle: Candle) => void;
}

export const LiveChart: React.FC<Props> = ({ candles, onSelectCandle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0b101b' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#162033' }, horzLines: { color: '#162033' } },
      width: containerRef.current.clientWidth,
      height: 340,
      timeScale: { timeVisible: true, secondsVisible: false }
    });

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });

    seriesRef.current = series;
    series.setData(candles as any);
    chart.timeScale().fitContent();

    chart.subscribeClick((param) => {
      if (!param.time) return;
      const found = candles.find((c) => c.time === param.time);
      if (found) onSelectCandle(found);
    });

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, onSelectCandle]);

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden border border-slate-800" />;
};
