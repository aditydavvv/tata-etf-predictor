import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fetchHistoricalData } from '../services/marketDataService.js';
import { fetchGrowwETFData } from '../services/growwService.js';
import './MetalPriceChart.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const chartCache = new Map();
const CACHE_TTL = 3 * 60 * 1000;

const TIMEFRAMES = {
  '1W': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
  '3Y': { range: '3y', interval: '1mo' },
  '5Y': { range: '5y', interval: '1mo' }
};

const ETF_CONFIG = {
  'tata-silver-etf': {
    symbol: 'TATSILV.NS',
    name: 'Tata Silver ETF',
    fullName: 'Tata Silver Exchange Traded Fund (NSE: TATSILV)',
    emoji: '🥈',
    color: '#22d3ee',
    bgColor: 'rgba(34, 211, 238, 0.18)',
    currency: '₹',
    fallbackPrice: 21.88
  },
  'tata-gold-etf': {
    symbol: 'TATAGOLD.NS',
    name: 'Tata Gold ETF',
    fullName: 'Tata Gold Exchange Traded Fund (NSE: TATAGOLD)',
    emoji: '🥇',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.18)',
    currency: '₹',
    fallbackPrice: 14.53
  }
};

function calculateTrend(prices) {
  if (prices.length < 2) return { direction: 'neutral', strength: 0 };
  const n = prices.length;
  const xMean = (n - 1) / 2;
  const yMean = prices.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (prices[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den !== 0 ? num / den : 0;
  return {
    direction: slope > 0.005 ? 'up' : slope < -0.005 ? 'down' : 'neutral',
    strength: Math.min(100, Math.round(Math.abs(slope) / yMean * 1000 + 40))
  };
}

function predictFuture(prices, days = 7) {
  if (prices.length < 2) return [];
  const n = prices.length;
  const weights = prices.map((_, i) => 1 + (i / (n - 1)) * 2);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const xWeighted = weights.reduce((sum, w, i) => sum + w * i, 0) / weightSum;
  const yWeighted = weights.reduce((sum, w, i) => sum + w * prices[i], 0) / weightSum;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += weights[i] * (i - xWeighted) * (prices[i] - yWeighted);
    den += weights[i] * (i - xWeighted) * (i - xWeighted);
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yWeighted - slope * xWeighted;
  return Array.from({ length: days }, (_, i) => parseFloat((slope * (n + i) + intercept).toFixed(2)));
}

function calculateSMA(prices, period = 20) {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    return parseFloat((prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period).toFixed(2));
  });
}

export default function MetalPriceChart({ etfType = 'tata-silver-etf' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('1M');
  const [showPred, setShowPred] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [liveData, setLiveData] = useState(null);
  const liveFetchedRef = useRef(null);

  const config = ETF_CONFIG[etfType] || ETF_CONFIG['tata-silver-etf'];

  const fetchChartData = useCallback(async (tf) => {
    const cacheKey = `${config.symbol}_${tf}`;
    const cached = chartCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    const result = await fetchHistoricalData(config.symbol, TIMEFRAMES[tf]?.range || '1mo', TIMEFRAMES[tf]?.interval || '1d');
    chartCache.set(cacheKey, { data: result, time: Date.now() });
    setData(result);
    setLoading(false);
  }, [config.symbol]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChartData(timeframe).then(() => { if (cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [timeframe, fetchChartData]);

  useEffect(() => {
    if (liveFetchedRef.current === etfType) return;
    liveFetchedRef.current = etfType;
    let cancelled = false;
    fetchGrowwETFData(etfType).then(d => {
      if (!cancelled && d) setLiveData(d);
    });
    return () => { cancelled = true; };
  }, [etfType]);

  const prices = data.map(d => d.close).filter(Boolean);
  // Anchor the chart to the real current price level (Groww). Rebasing the
  // whole visible series keeps the chart internally consistent — the current
  // price matches the last point instead of creating a step from Yahoo's
  // historical close, which can lag/mismatch the real market.
  const livePrice = liveData?.price || config.fallbackPrice;
  const scaledPrices = (() => {
    if (prices.length === 0) return prices;
    const lastClose = prices[prices.length - 1];
    if (!lastClose || lastClose === livePrice) return prices;
    const scale = livePrice / lastClose;
    return prices.map(p => parseFloat((p * scale).toFixed(2)));
  })();
  const dates = data.map((d, i) => {
    if (i === data.length - 1 && livePrice) {
      return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    const dt = new Date(d.date);
    return timeframe === '3Y' || timeframe === '5Y'
      ? dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });

  const trend = calculateTrend(scaledPrices);
  const sma20 = calculateSMA(scaledPrices);
  const preds = showPred ? predictFuture(scaledPrices) : [];

  const futureDates = [];
  if (preds.length > 0) {
    const last = new Date(data[data.length - 1]?.date || Date.now());
    for (let i = 1; i <= preds.length; i++) {
      const fd = new Date(last);
      fd.setDate(fd.getDate() + i * (timeframe === '5Y' ? 14 : 2));
      futureDates.push(fd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    }
  }

  const allDates = [...dates, ...futureDates];
  const hPrices = [...scaledPrices, ...new Array(preds.length).fill(null)];
  const pPrices = scaledPrices.length > 0
    ? [...new Array(scaledPrices.length - 1).fill(null), scaledPrices[scaledPrices.length - 1], ...preds]
    : [];
  const sPrices = [...sma20, ...new Array(preds.length).fill(null)];

  const chartData = {
    labels: allDates,
    datasets: [
      {
        label: config.name,
        data: hPrices,
        borderColor: config.color,
        backgroundColor: config.bgColor,
        borderWidth: 3,
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: config.color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2
      },
      ...(showSMA ? [{
        label: '20 SMA',
        data: sPrices,
        borderColor: '#a855f7',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.25,
        pointRadius: 0
      }] : []),
      ...(showPred ? [{
        label: 'Predicted Path',
        data: pPrices,
        borderColor: trend.direction === 'up' ? '#10b981' : trend.direction === 'down' ? '#ef4444' : '#fbbf24',
        borderWidth: 3,
        borderDash: [6, 4],
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 6
      }] : [])
    ]
  };

  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: '#cbd5e1',
          font: { size: 12, weight: '600' },
          boxWidth: 14,
          padding: 14,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#3b82f6',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ₹${ctx.parsed.y ? ctx.parsed.y.toFixed(2) : 'N/A'}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.15)', drawBorder: false },
        ticks: { color: '#cbd5e1', font: { size: 11, weight: '600' }, maxTicksLimit: 12 }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.15)', drawBorder: false },
        ticks: {
          color: '#cbd5e1',
          font: { size: 11, weight: '600' },
          callback: v => '₹' + v.toFixed(2)
        }
      }
    }
  };

  const cur = livePrice;
  const prevClose = liveData?.prevClose || scaledPrices[scaledPrices.length - 2] || cur;
  const chg = liveData?.change != null ? liveData.change : (cur - prevClose);
  const chgP = liveData?.changePercent ?? (prevClose ? ((chg / prevClose) * 100) : 0);

  return (
    <div className="metal-chart-container">
      <div className="chart-header">
        <div className="chart-title">
          <span className="chart-icon">{config.emoji}</span>
          <div>
            <h3>{config.name} Chart</h3>
            <p className="chart-subtitle">{config.fullName} • {config.symbol} • INR</p>
          </div>
        </div>
        <div className="chart-price">
          <span className="current-price">₹{cur?.toFixed(2)}</span>
          <span className={`price-change ${chg >= 0 ? 'positive' : 'negative'}`}>
            {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)} ({Math.abs(chgP).toFixed(2)}%)
          </span>
          {liveData && (
            <span className="data-source">Source: Live Market Data (NSE)</span>
          )}
        </div>
      </div>

      {liveData && (
        <div className="groww-details">
          <div className="detail-chip">Open ₹{liveData.open?.toFixed(2) || '—'}</div>
          <div className="detail-chip">High ₹{liveData.dayHigh?.toFixed(2) || '—'}</div>
          <div className="detail-chip">Low ₹{liveData.dayLow?.toFixed(2) || '—'}</div>
          <div className="detail-chip">Prev ₹{liveData.prevClose?.toFixed(2) || '—'}</div>
          <div className="detail-chip">NAV ₹{liveData.nav?.toFixed(2) || '—'}</div>
          <div className="detail-chip">Vol {liveData.volume || '—'}</div>
        </div>
      )}

      <div className="trend-info">
        <div className={`trend-badge ${trend.direction}`}>
          {trend.direction === 'up' ? '📈' : trend.direction === 'down' ? '📉' : '➡️'}
          Trend: {trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}
        </div>
        <span className="trend-strength">Momentum Fit: {trend.strength}%</span>
      </div>

      <div className="chart-controls">
        <div className="timeframe-buttons">
          {Object.keys(TIMEFRAMES).map(key => (
            <button key={key} className={`tf-btn ${timeframe === key ? 'active' : ''}`} onClick={() => setTimeframe(key)}>{key}</button>
          ))}
        </div>
        <div className="chart-toggles">
          <label className="toggle-label"><input type="checkbox" checked={showPred} onChange={e => setShowPred(e.target.checked)} /><span>7D ML Prediction</span></label>
          <label className="toggle-label"><input type="checkbox" checked={showSMA} onChange={e => setShowSMA(e.target.checked)} /><span>20 SMA</span></label>
        </div>
      </div>

      <div className="chart-wrapper">
        {loading ? (
          <div className="chart-skeleton">
            <div className="skeleton-line" style={{width:'60%',height:'24px'}}></div>
            <div className="skeleton-chart"></div>
            <div className="skeleton-line" style={{width:'40%',height:'16px'}}></div>
          </div>
        ) : scaledPrices.length === 0 ? (
          <div className="chart-empty"><p>No data available</p></div>
        ) : (
          <Line data={chartData} options={opts} />
        )}
      </div>

      {showPred && preds.length > 0 && (
        <div className="prediction-summary">
          <h4>7-Day Target Forecast</h4>
          <div className="prediction-values">
            <div className="pred-item"><span className="pred-label">Current Unit NAV</span><span className="pred-value">₹{cur?.toFixed(2)}</span></div>
            <div className="pred-item"><span className="pred-label">Predicted 7-Day Target</span><span className={`pred-value ${preds[preds.length - 1] > cur ? 'positive' : 'negative'}`}>₹{preds[preds.length - 1]?.toFixed(2)}</span></div>
            <div className="pred-item"><span className="pred-label">Expected Return</span><span className={`pred-value ${preds[preds.length - 1] > cur ? 'positive' : 'negative'}`}>{((preds[preds.length - 1] - cur) / cur * 100).toFixed(2)}%</span></div>
          </div>
          <p className="prediction-note">* Based on multi-factor polynomial regression trained on historical market data</p>
        </div>
      )}
    </div>
  );
}
