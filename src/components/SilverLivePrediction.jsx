import './SilverLivePrediction.css';

const SEVERITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

export default function SilverLivePrediction({ prediction, depth, loading }) {
  const p = prediction ?? {};
  const tone = p.direction === 'positive' ? 'positive' : p.direction === 'negative' ? 'negative' : 'neutral';
  const badge = p.direction === 'positive' ? '📈 BULLISH' : p.direction === 'negative' ? '📉 BEARISH' : '↔️ NEUTRAL';

  const updated = depth?.lastUpdated
    ? new Date(depth.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : null;

  return (
    <section className="live-prediction-section">
      <div className="lp-header">
        <div>
          <h3>Live Prediction — Tata Silver ETF</h3>
          <p className="lp-subtitle">Calculated from live order-book buyers &amp; sellers and global event impacts</p>
        </div>
        {updated && <span className="lp-updated">Updated {updated} IST</span>}
      </div>

      {loading ? (
        <div className="lp-skeleton"><div className="lp-skeleton-card"></div></div>
      ) : !p.hasData ? (
        <p className="lp-unavailable">⚠️ No live order-book or event data available right now. Prediction will appear once data arrives.</p>
      ) : (
        <>
          <div className={`lp-hero ${tone}`}>
            <div className={`lp-badge ${tone}`}>{badge}</div>
            <div className="lp-hero-stats">
              <div className="lp-stat">
                <span className="lp-stat-label">Expected Move</span>
                <span className={`lp-stat-value ${tone}`}>{p.expectedMove}</span>
              </div>
              <div className="lp-stat lp-stat-confidence">
                <span className="lp-stat-label">Confidence</span>
                <div className="lp-confidence-wrapper">
                  <div className="lp-confidence-bar" style={{ width: `${p.confidence}%` }}></div>
                  <span className="lp-confidence-text">{p.confidence}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-inputs">
            <div className="lp-input-card">
              <span className="lp-input-label">Order-book buyers vs sellers</span>
              <span className={`lp-input-value ${(p.orderBook?.value ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                {p.orderBook ? `${p.orderBook.value >= 0 ? '+' : ''}${(p.orderBook.value * 100).toFixed(0)}%` : '—'}
              </span>
              <span className="lp-input-sub">{p.orderBook?.detail ?? 'Order book unavailable'}</span>
            </div>
            <div className="lp-input-card">
              <span className="lp-input-label">Global events (net)</span>
              <span className={`lp-input-value ${(p.eventScore ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                {p.eventScore != null ? `${p.eventScore >= 0 ? '+' : ''}${(p.eventScore * 100).toFixed(0)}%` : '—'}
              </span>
              <span className="lp-input-sub">{p.events?.length ?? 0} events evaluated</span>
            </div>
          </div>

          {p.drivers && p.drivers.length > 0 && (
            <div className="lp-drivers">
              <h4>What is driving the call</h4>
              {p.drivers.map((d, i) => (
                <div key={i} className="lp-driver">
                  <span className={`lp-driver-dot ${d.value >= 0 ? 'positive' : 'negative'}`}></span>
                  <div className="lp-driver-body">
                    <span className="lp-driver-label">{d.label}</span>
                    <span className="lp-driver-detail">{d.detail}</span>
                  </div>
                  <div className="lp-driver-track">
                    <div
                      className={`lp-driver-fill ${d.value >= 0 ? 'positive' : 'negative'}`}
                      style={{ width: `${Math.min(100, Math.abs(d.value) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {p.events && p.events.length > 0 && (
            <div className="lp-events">
              <h4>Global events considered</h4>
              <div className="lp-event-list">
                {p.events.map(ev => (
                  <div key={ev.id} className="lp-event">
                    <span className={`lp-event-tag ${ev.direction}`}>
                      {ev.direction === 'positive' ? '▲' : ev.direction === 'negative' ? '▼' : '↔'} {SEVERITY_LABEL[ev.severity] ?? '—'}
                    </span>
                    <span className="lp-event-title">{ev.title}</span>
                    <span className={`lp-event-move ${ev.direction}`}>{ev.expectedMove}</span>
                    <span className="lp-event-conf">{ev.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="lp-note">
            Weighted blend of live order-book pressure (buyers vs sellers) and the historical silver reaction to each active global event. Informational only — not financial advice.
          </p>
        </>
      )}
    </section>
  );
}
