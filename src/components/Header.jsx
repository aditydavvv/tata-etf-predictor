import './Header.css';

const STATUS_CONFIG = {
  open: { label: 'Market Open', dot: 'open', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)' },
  closed: { label: 'Market Closed', dot: 'closed', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)' },
  'pre-market': { label: 'Pre-Market', dot: 'pre-market', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.2)', color: 'var(--accent-yellow)' },
  weekend: { label: 'Weekend', dot: 'weekend', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-muted)' },
  loading: { label: 'Loading...', dot: 'loading', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-muted)' }
};

export default function Header({ marketStatus = 'loading' }) {
  const status = STATUS_CONFIG[marketStatus] || STATUS_CONFIG.loading;

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo-icon">
            <span className="logo-symbol">📊</span>
          </div>
          <div className="logo-text">
            <h1 className="text-gradient">Tata ETF Predictor</h1>
            <p className="tagline">Gold & Silver ETF Intelligence</p>
          </div>
        </div>
        <div className="header-info">
          <div className="market-status" style={{ background: status.bg, borderColor: status.border }}>
            <span className={`status-dot ${status.dot}`}></span>
            <span className="status-text" style={{ color: status.color }}>{status.label}</span>
          </div>
          <div className="market-hours">
            <span className="hours-label">NSE/BSE</span>
            <span className="hours-time">9:15 AM – 3:30 PM IST</span>
          </div>
          <div className="date-display">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
