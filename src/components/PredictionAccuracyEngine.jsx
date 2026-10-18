import './PredictionAccuracyEngine.css';

const fmtSigned = v => `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}`;

export default function PredictionAccuracyEngine({ stats, model, loading }) {
  if (loading) {
    return (
      <section className="prediction-accuracy-section">
        <div className="pa-header">
          <div>
            <h3>Prediction Accuracy Engine</h3>
            <p className="pa-subtitle">Scoring each day's call against the real close…</p>
          </div>
        </div>
        <div className="pa-skeleton" />
      </section>
    );
  }

  if (!stats) return null;

  const samples = model?.samples ?? 0;
  const active = samples >= 3;
  const biasPp = (model?.bias ?? 0) * 6;
  const hitRatePct = stats.evaluated > 0 && Number.isFinite(model?.hitRate)
    ? Math.round(model.hitRate * 100)
    : null;

  return (
    <section className="prediction-accuracy-section">
      <div className="pa-header">
        <div>
          <h3>Prediction Accuracy Engine</h3>
          <p className="pa-subtitle">
            Logs each day's call, scores it against the real close, then rewrites its own
            bias, order-book weight and confidence scale to correct the next prediction.
          </p>
        </div>
        <span className={`pa-status ${active ? 'active' : 'learning'}`}>
          {active ? '● Auto-correcting' : `● Learning ${samples}/3`}
        </span>
      </div>

      <div className="pa-stats-grid">
        <div className="pa-stat-card">
          <span className="pa-stat-label">Evaluated</span>
          <span className="pa-stat-value">{stats.evaluated}</span>
        </div>
        <div className="pa-stat-card">
          <span className="pa-stat-label">Hit rate</span>
          <span className="pa-stat-value">{hitRatePct != null ? `${hitRatePct}%` : '—'}</span>
        </div>
        <div className="pa-stat-card">
          <span className="pa-stat-label">Avg |error|</span>
          <span className="pa-stat-value">
            {stats.evaluated > 0 ? `${(model?.avgAbsError ?? 0).toFixed(2)} pp` : '—'}
          </span>
        </div>
        <div className="pa-stat-card">
          <span className="pa-stat-label">Pending</span>
          <span className="pa-stat-value">{Math.max(0, stats.total - stats.evaluated)}</span>
        </div>
      </div>

      <div className="pa-body">
        <div className="pa-today">
          <h4>Today's logged call</h4>
          {stats.today ? (
            <>
              <div className={`pa-today-dir ${stats.today.direction}`}>
                {stats.today.expectedMove}
              </div>
              <div className="pa-today-meta">
                <span>{stats.today.confidence}% confidence</span>
                <span>entry ₹{Number(stats.today.price).toFixed(2)}</span>
              </div>
              <div className="pa-today-status">
                {stats.today.evaluation
                  ? `Resolved: ${fmtSigned(stats.today.evaluation.realizedReturn)}% → ${stats.today.evaluation.hit ? 'hit' : 'miss'}`
                  : 'Awaiting the next close'}
              </div>
            </>
          ) : (
            <p className="pa-empty">No call logged yet today.</p>
          )}
        </div>

        <div className="pa-corrections">
          <h4>Auto-corrections applied</h4>
          <CorrectionRow
            label="Score bias"
            value={`${biasPp >= 0 ? '+' : ''}${biasPp.toFixed(1)} pp`}
            note="added to every expected move"
          />
          <CorrectionRow
            label="Order-book weight"
            value={`×${(model?.orderBookFactor ?? 1).toFixed(2)}`}
            note="scales the buyers/sellers signal"
          />
          <CorrectionRow
            label="Confidence scale"
            value={`×${(model?.confidenceScale ?? 1).toFixed(2)}`}
            note="calibrates stated confidence"
          />
        </div>
      </div>

      {stats.recent?.length > 0 && (
        <div className="pa-recent">
          <h4>Recent predictions vs actual</h4>
          <div className="pa-table-wrap">
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Predicted</th>
                  <th>Actual</th>
                  <th>Error</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.recent.map(e => (
                  <tr key={e.date}>
                    <td className="pa-day">{e.date}</td>
                    <td className={`pa-dir ${e.direction}`}>{e.expectedMove}</td>
                    <td className={`pa-actual ${e.evaluation.realizedDirection}`}>
                      {fmtSigned(e.evaluation.realizedReturn)}%
                    </td>
                    <td className="pa-error">{fmtSigned(e.evaluation.errorPp)} pp</td>
                    <td>
                      <span className={`pa-hit ${e.evaluation.hit ? 'hit' : 'miss'}`}>
                        {e.evaluation.hit ? '✓ hit' : '✗ miss'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="pa-note">
        Predictions resolve against the next available TATSILV close from the daily price
        snapshot. A move under ±0.15% counts as flat.
      </p>
    </section>
  );
}

function CorrectionRow({ label, value, note }) {
  return (
    <div className="pa-correction-row">
      <div className="pa-correction-text">
        <span className="pa-correction-label">{label}</span>
        <span className="pa-correction-note">{note}</span>
      </div>
      <span className="pa-correction-value">{value}</span>
    </div>
  );
}
