import { useMemo } from 'react';
import { sectorImpactData } from '../data/events';
import './SectorImpact.css';

function SectorImpact() {
  const sorted = useMemo(() => [...sectorImpactData].sort((a, b) => b.impact - a.impact), []);

  return (
    <section className="sector-impact">
      <div className="section-header">
        <h2>Sector-wise Global Impact</h2>
        <span className="subtitle">How global events affect Indian market sectors</span>
      </div>

      <div className="sector-grid">
        {sorted.map((sector, i) => (
          <div key={sector.name} className={`sector-card ${sector.direction}`}>
            <div className="sector-rank">#{i + 1}</div>
            <div className="sector-info">
              <h3 className="sector-name">{sector.name}</h3>
              <div className="sector-bar-container">
                <div
                  className={`sector-bar ${sector.direction}`}
                  style={{ width: `${sector.impact}%` }}
                ></div>
              </div>
              <div className="sector-events">
                {sector.events.map((evt, j) => (
                  <span key={j} className="event-ref">{evt}</span>
                ))}
              </div>
            </div>
            <div className={`sector-score ${sector.direction}`}>
              <span className="score-value">{sector.impact}</span>
              <span className="score-label">{sector.direction === 'positive' ? '▲ Bullish' : '▼ Bearish'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SectorImpact;
