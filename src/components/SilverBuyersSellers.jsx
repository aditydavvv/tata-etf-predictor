import { useState, useEffect } from 'react';
import { fetchMarketDepth } from '../services/marketDepthService.js';
import './SilverBuyersSellers.css';

const REFRESH_MS = 5 * 60 * 1000;

const SENTIMENT_LABELS = {
  'strong-buyers': { text: '🟢 Strong Buying', tone: 'buyers' },
  buyers: { text: '🟢 Buying', tone: 'buyers' },
  neutral: { text: '🟡 Neutral', tone: 'neutral' },
  sellers: { text: '🔴 Selling', tone: 'sellers' },
  'strong-sellers': { text: '🔴 Strong Selling', tone: 'sellers' }
};

export default function SilverBuyersSellers() {
  const [depth, setDepth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchMarketDepth('tata-silver-etf');
      if (!cancelled) {
        setDepth(data);
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const sentiment = depth ? SENTIMENT_LABELS[depth.sentiment] : null;
  const updated = depth?.lastUpdated
    ? new Date(depth.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : null;

  return (
    <section className="buyers-sellers-section">
      <div className="bs-header">
        <div>
          <h3>Buyers &amp; Sellers — Tata Silver ETF</h3>
          <p className="bs-subtitle">NSE: TATSILV • Live order book depth</p>
        </div>
        {updated && <span className="bs-updated">Updated {updated} IST</span>}
      </div>

      {loading ? (
        <div className="bs-skeleton">
          <div className="bs-skeleton-bar"></div>
          <div className="bs-skeleton-grid">
            {[...Array(4)].map((_, i) => <div key={i} className="bs-skeleton-card"></div>)}
          </div>
        </div>
      ) : !depth ? (
        <p className="bs-unavailable">⚠️ Live order book data is temporarily unavailable. It refreshes every 5 minutes during market hours.</p>
      ) : (
        <>
          <div className="bs-split-bar" role="img" aria-label={`${depth.buyPct}% buyers versus ${depth.sellPct}% sellers`}>
            <div className="bs-split-buy" style={{ width: `${depth.buyPct}%` }}></div>
            <div className="bs-split-sell" style={{ width: `${depth.sellPct}%` }}></div>
            <span className="bs-split-label buy" style={{ left: `${Math.max(depth.buyPct / 2, 8)}%` }}>{depth.buyPct}%</span>
            <span className="bs-split-label sell" style={{ right: `${Math.max(depth.sellPct / 2, 8)}%` }}>{depth.sellPct}%</span>
          </div>

          <div className="bs-grid">
            <div className="bs-card buyers">
              <span className="bs-label">Buyers</span>
              <span className="bs-value">{depth.buyers?.toLocaleString('en-IN')}</span>
              <span className="bs-sub">{depth.buyPct}% of total orders</span>
            </div>
            <div className="bs-card sellers">
              <span className="bs-label">Sellers</span>
              <span className="bs-value">{depth.sellers?.toLocaleString('en-IN')}</span>
              <span className="bs-sub">{depth.sellPct}% of total orders</span>
            </div>
            <div className={`bs-card ratio ${depth.sentiment}`}>
              <span className="bs-label">Buy / Sell Ratio</span>
              <span className="bs-value">{depth.ratio}</span>
              <span className="bs-sub">{depth.total?.toLocaleString('en-IN')} total orders</span>
            </div>
            <div className={`bs-card sentiment ${sentiment?.tone ?? 'neutral'}`}>
              <span className="bs-label">Sentiment</span>
              <span className="bs-value bs-sentiment-text">{sentiment?.text ?? '—'}</span>
              <span className="bs-sub">
                {depth.sentiment === 'buyers' || depth.sentiment === 'strong-buyers'
                  ? 'Demand pressure supports price'
                  : depth.sentiment === 'sellers' || depth.sentiment === 'strong-sellers'
                    ? 'Supply pressure weighs on price'
                    : 'Balanced buy/sell interest'}
              </span>
            </div>
          </div>

          <p className="bs-note">
            Order book depth from Groww (NSE). Buyers = cumulative buy quantity, Sellers = cumulative sell quantity at the top price levels.
          </p>
        </>
      )}
    </section>
  );
}
