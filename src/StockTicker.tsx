import { useEffect, useMemo, useRef, useState } from 'react';
import { searchStockPrices } from './agent';
import type { StockSearchResult } from './agent';

interface Stock {
  symbol: string;
  name: string;
  base: number;
}

const STOCKS: Stock[] = [
  { symbol: 'NOKIA.HE',  name: 'Nokia',  base: 3.82  },
  { symbol: 'NDA-FI.HE', name: 'Nordea', base: 11.24 },
  { symbol: 'NESTE.HE',  name: 'Neste',  base: 14.61 },
  { symbol: 'SAMPO.HE',  name: 'Sampo',  base: 44.90 },
  { symbol: 'FORTUM.HE', name: 'Fortum', base: 12.33 },
];

function randomWalk(start: number, steps: number, volatility = 0.005): number[] {
  const pts = [start];
  for (let i = 1; i < steps; i++) {
    pts.push(pts[i - 1] * (1 + (Math.random() - 0.5) * volatility * 2));
  }
  return pts;
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map(p => h - ((p - min) / range) * h * 0.85 - h * 0.075);
  const color = positive ? '#176343' : '#b83535';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface StockCardProps {
  stock: Stock;
  price: number;
  history: number[];
  headline?: string;
}

function StockCard({ stock, price, history, headline }: StockCardProps) {
  const [showTip, setShowTip] = useState(false);
  const change = ((price - stock.base) / stock.base) * 100;
  const positive = change >= 0;
  const color = positive ? '#176343' : '#b83535';
  const arrow = positive ? '▲' : '▼';

  return (
    <div
      className="stock-card"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      style={{ position: 'relative', cursor: headline ? 'help' : 'default' }}
    >
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.symbol}</div>
      </div>
      <Sparkline points={history} positive={positive} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
          €{price.toFixed(2)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {arrow} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      {showTip && headline && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--ink)', color: '#fff', fontSize: 11, lineHeight: 1.5,
          padding: '8px 10px', borderRadius: 8, zIndex: 50, pointerEvents: 'none',
          boxShadow: '0 4px 16px #202c3540',
        }}>
          {headline}
        </div>
      )}
    </div>
  );
}

export function StockTicker() {
  // Generate initial history + prices once on mount
  const initialData = useMemo(() =>
    STOCKS.map(s => {
      const history = randomWalk(s.base, 8);
      return { price: history.at(-1)!, history };
    }),
  []);

  const [prices, setPrices] = useState(() => initialData.map(d => d.price));
  const [histories, setHistories] = useState(() => initialData.map(d => d.history));
  const [headlines, setHeadlines] = useState<Record<string, string>>({});

  // Drift prices every 3 s
  useEffect(() => {
    const id = setInterval(() => {
      setPrices(prev => prev.map(p => p * (1 + (Math.random() - 0.5) * 0.01)));
      setHistories(prev => prev.map((hist, i) => {
        const next = [...hist.slice(1), prices[i] * (1 + (Math.random() - 0.5) * 0.01)];
        return next;
      }));
    }, 3000);
    return () => clearInterval(id);
  }, [prices]);

  // Fetch headlines once
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    searchStockPrices().then((results: StockSearchResult[]) => {
      const map: Record<string, string> = {};
      for (const r of results) map[r.symbol] = r.headline;
      setHeadlines(map);
    }).catch(() => {});
  }, []);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', marginBottom: 14, letterSpacing: 0 }}>
        Market snapshot · Simulated prices
      </h2>
      <div className="stock-ticker-row">
        {STOCKS.map((stock, i) => (
          <StockCard
            key={stock.symbol}
            stock={stock}
            price={prices[i]}
            history={histories[i]}
            headline={headlines[stock.symbol]}
          />
        ))}
      </div>
    </div>
  );
}
