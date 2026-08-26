import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fetchHistoricalData } from '../services/marketDataService';
import { fetchGrowwETFData } from '../services/growwService';
import './MetalPriceChart.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const chartCache = new Map();
const CACHE_TTL = 3 * 60 * 1000;

const TIMEFRAMES = {
  '1W': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' }
};

const ETF_CONFIG = {
  'tata-gold-etf': {
    symbol: 'TATAGOLD.NS',
    name: 'Tata Gold ETF',
    fullName: 'Tata Gold Exchange Traded Fund',
    emoji: '🏆',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
    currency: '₹'
  },
  'tata-silver-etf': {
    symbol: 'TATSILV.NS',
    name: 'Tata Silver ETF',
    fullName: 'Tata Silver Exchange Traded Fund',
    emoji: '🏆',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.1)',
    currency: '₹'
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
    direction: slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'neutral',
    strength: Math.min(100, Math.round(Math.abs(slope) / yMean * 1000))
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
  return Array.from({ length: days }, (_, i) => slope * (n + i) + intercept);
}

function calculateSMA(prices, period = 20) {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    return prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

export default function MetalPriceChart({ etfType = 'tata-gold-etf' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('1M');
  const [showPred, setShowPred] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [liveData, setLiveData] = useState(null);
  const liveFetchedRef = useRef(null);

  const config = ETF_CONFIG[etfType] || ETF_CONFIG['gold-etf'];

  const fetchChartData = useCallback(async (tf) => {
    const cacheKey = `${config.symbol}_${tf}`;
    const cached = chartCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    const result = await fetchHistoricalData(config.symbol, TIMEFRAMES[tf].range, TIMEFRAMES[tf].interval);
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
  if (liveData?.price && prices.length > 0) {
    prices[prices.length - 1] = liveData.price;
  }
  const dates = data.map((d, i) => {
    if (i === data.length - 1 && liveData?.price) {
      return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    return new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });
  const trend = calculateTrend(prices);
  const sma20 = calculateSMA(prices);
  const preds = showPred ? predictFuture(prices) : [];

  const futureDates = [];
  if (preds.length > 0) {
    const last = new Date(data[data.length - 1]?.date || Date.now());
    for (let i = 1; i <= preds.length; i++) {
      const fd = new Date(last);
      fd.setDate(fd.getDate() + i);
      futureDates.push(fd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    }
  }

  const allDates = [...dates, ...futureDates];
  const hPrices = [...prices, ...new Array(preds.length).fill(null)];
  const pPrices = prices.length > 0
    ? [...new Array(prices.length - 1).fill(null), prices[prices.length - 1], ...preds]
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
        borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5
      },
      ...(showSMA ? [{
        label: '20 SMA', data: sPrices,
        borderColor: '#4f8ffa', borderWidth: 1.5, borderDash: [5, 5],
        fill: false, tension: 0.4, pointRadius: 0
      }] : []),
      ...(showPred ? [{
        label: 'Predicted', data: pPrices,
        borderColor: trend.direction === 'up' ? '#00c896' : trend.direction === 'down' ? '#ff5c5c' : '#ffc107',
        borderWidth: 2, borderDash: [8, 4], fill: false, tension: 0.4, pointRadius: 0
      }] : [])
    ]
  };

  const opts = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: true, position: 'top', align: 'end', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 15, usePointStyle: true } },
      tooltip: {
        backgroundColor: '#1c2333', titleColor: '#f8fafc', bodyColor: '#e2e8f0',
        borderColor: '#2d3748', borderWidth: 1, padding: 12,
        callbacks: { label: ctx => `${ctx.dataset.label}: ₹${ctx.parsed.y?.toFixed(2) || 'N/A'}` }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(45,55,72,0.5)', drawBorder: false }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 } },
      y: { grid: { color: 'rgba(45,55,72,0.5)', drawBorder: false }, ticks: { color: '#64748b', font: { size: 10 }, callback: v => '₹' + v.toFixed(0) } }
    }
  };

  const cur = liveData?.price || prices[prices.length - 1];
  const prevClose = liveData?.prevClose || prices[prices.length - 2] || cur;
  const chg = liveData?.change ?? (cur - prevClose);
  const chgP = liveData?.changePercent ?? ((chg / prevClose) * 100);

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
          <span className="current-price">₹{cur?.toFixed(2) || 'N/A'}</span>
          <span className={`price-change ${chg >= 0 ? 'positive' : 'negative'}`}>
            {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)} ({Math.abs(chgP).toFixed(2)}%)
          </span>
          {liveData && (
            <span className="data-source">Source: Groww</span>
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
        <span className="trend-strength">Strength: {trend.strength}%</span>
      </div>

      <div className="chart-controls">
        <div className="timeframe-buttons">
          {Object.keys(TIMEFRAMES).map(key => (
            <button key={key} className={`tf-btn ${timeframe === key ? 'active' : ''}`} onClick={() => setTimeframe(key)}>{key}</button>
          ))}
        </div>
        <div className="chart-toggles">
          <label className="toggle-label"><input type="checkbox" checked={showPred} onChange={e => setShowPred(e.target.checked)} /><span>Predict</span></label>
          <label className="toggle-label"><input type="checkbox" checked={showSMA} onChange={e => setShowSMA(e.target.checked)} /><span>SMA 20</span></label>
        </div>
      </div>

      <div className="chart-wrapper">
        {loading ? (
          <div className="chart-skeleton">
            <div className="skeleton-line" style={{width:'60%',height:'20px'}}></div>
            <div className="skeleton-chart"></div>
            <div className="skeleton-line" style={{width:'40%',height:'14px'}}></div>
          </div>
        ) : prices.length === 0 ? (
          <div className="chart-empty"><p>No data available</p></div>
        ) : (
          <Line data={chartData} options={opts} />
        )}
      </div>

      {showPred && preds.length > 0 && (
        <div className="prediction-summary">
          <h4>7-Day Prediction</h4>
          <div className="prediction-values">
            <div className="pred-item"><span className="pred-label">Current</span><span className="pred-value">₹{cur?.toFixed(2)}</span></div>
            <div className="pred-item"><span className="pred-label">Predicted</span><span className={`pred-value ${preds[preds.length - 1] > cur ? 'positive' : 'negative'}`}>₹{preds[preds.length - 1]?.toFixed(2)}</span></div>
            <div className="pred-item"><span className="pred-label">Expected Move</span><span className={`pred-value ${preds[preds.length - 1] > cur ? 'positive' : 'negative'}`}>{((preds[preds.length - 1] - cur) / cur * 100).toFixed(2)}%</span></div>
          </div>
          <p className="prediction-note">* Based on weighted linear regression of historical data</p>
        </div>
      )}
    </div>
  );
}
