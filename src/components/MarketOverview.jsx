import { useMemo } from 'react';
import { marketIndices } from '../data/events';
import './MarketOverview.css';

export default function MarketOverview() {
  const indices = useMemo(() => marketIndices, []);

  return (
    <section className="market-overview">
      <div className="section-header">
        <h2>Indian Market Overview</h2>
      </div>
      <div className="indices-grid">
        {indices.map((idx) => (
          <div key={idx.name} className={`index-card ${idx.change >= 0 ? 'positive' : 'negative'}`}>
            <div className="index-header">
              <span className="index-name">{idx.name}</span>
              <span className="index-sector">{idx.sector}</span>
            </div>
            <div className="index-value">
              {idx.name === 'INDIA VIX' ? idx.value.toFixed(2) : idx.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="index-change">
              <span className={`change-badge ${idx.change >= 0 ? 'up' : 'down'}`}>
                {idx.change >= 0 ? '▲' : '▼'} {Math.abs(idx.change).toFixed(2)} ({Math.abs(idx.changePercent).toFixed(2)}%)
              </span>
            </div>
            <div className="index-details">
              <div className="detail-row">
                <span>High</span>
                <span>{idx.dayHigh.toLocaleString('en-IN')}</span>
              </div>
              <div className="detail-row">
                <span>Low</span>
                <span>{idx.dayLow.toLocaleString('en-IN')}</span>
              </div>
              <div className="detail-row">
                <span>Prev Close</span>
                <span>{idx.prevClose.toLocaleString('en-IN')}</span>
              </div>
              <div className="detail-row">
                <span>Volume</span>
                <span>{idx.volume}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
