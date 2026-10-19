import { useState } from 'react';
import './PositionsPanel.css';

const inr = (v) => (Number.isFinite(v)
  ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  : '—');

const signedPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export default function PositionsPanel({ lots, strategy, result, addLot, removeLot, updateStrategy }) {
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    const q = Number(qty);
    const p = Number(price);
    if (!Number.isFinite(q) || q <= 0) return setError('Enter a share quantity greater than 0.');
    if (!Number.isFinite(p) || p <= 0) return setError('Enter a buy price greater than 0.');
    addLot({ qty: q, price: p, date: date || null });
    setQty('');
    setPrice('');
    setDate('');
    setError('');
  };

  const handleStrategy = (key) => (e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 0) updateStrategy({ [key]: v });
  };

  const hasCost = result?.hasPosition;

  return (
    <section className="positions-panel">
      <div className="pp-header">
        <div>
          <h3>My Position</h3>
          <p className="pp-subtitle">
            Enter what you bought — the app tracks your cost and tells you when to sell.
            Saved only in this browser.
          </p>
        </div>
      </div>

      <form className="pp-form" onSubmit={handleAdd}>
        <label className="pp-field">
          <span>Shares</span>
          <input type="number" min="1" step="1" inputMode="numeric" value={qty}
            onChange={(e) => setQty(e.target.value)} placeholder="e.g. 50" />
        </label>
        <label className="pp-field">
          <span>Buy price (₹)</span>
          <input type="number" min="0" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 20.50" />
        </label>
        <label className="pp-field">
          <span>Date (optional)</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="submit" className="pp-add">Add buy</button>
      </form>

      {error && <p className="pp-error">{error}</p>}

      {lots.length === 0 ? (
        <p className="pp-empty">No holdings yet. Add your first buy above.</p>
      ) : (
        <>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Buy price</th>
                  <th>Cost</th>
                  <th>P&amp;L</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => {
                  const cost = lot.qty * lot.price;
                  const lotPnl = lot.qty * ((result?.currentPrice ?? lot.price) - lot.price);
                  const lotPnlPct = lot.price > 0 ? ((result?.currentPrice ?? lot.price) - lot.price) / lot.price * 100 : 0;
                  return (
                    <tr key={lot.id}>
                      <td className="pp-muted">{lot.date || '—'}</td>
                      <td>{lot.qty}</td>
                      <td>₹{inr(lot.price)}</td>
                      <td>₹{inr(cost)}</td>
                      <td className={lotPnl >= 0 ? 'pp-up' : 'pp-down'}>
                        ₹{inr(lotPnl)} <span className="pp-pct">({signedPct(lotPnlPct)})</span>
                      </td>
                      <td>
                        <button className="pp-remove" onClick={() => removeLot(lot.id)} title="Remove">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasCost && (
            <div className="pp-totals">
              <div className="pp-total">
                <span className="pp-total-label">Shares</span>
                <span className="pp-total-value">{result.qty}</span>
              </div>
              <div className="pp-total">
                <span className="pp-total-label">Avg cost</span>
                <span className="pp-total-value">₹{inr(result.avgCost)}</span>
              </div>
              <div className="pp-total">
                <span className="pp-total-label">Invested</span>
                <span className="pp-total-value">₹{inr(result.invested)}</span>
              </div>
              <div className="pp-total">
                <span className="pp-total-label">Value</span>
                <span className="pp-total-value">
                  {result.hasPrice ? `₹${inr(result.currentValue)}` : '—'}
                </span>
              </div>
              <div className="pp-total">
                <span className="pp-total-label">P&amp;L</span>
                <span className={`pp-total-value ${(result.pnl ?? 0) >= 0 ? 'pp-up' : 'pp-down'}`}>
                  {result.hasPrice ? `₹${inr(result.pnl)} (${signedPct(result.pnlPct)})` : '—'}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="pp-strategy">
        <h4>Exit rules</h4>
        <div className="pp-strategy-grid">
          <label className="pp-field">
            <span>Target +%</span>
            <input type="number" min="0" step="0.5" value={strategy.targetPct} onChange={handleStrategy('targetPct')} />
          </label>
          <label className="pp-field">
            <span>Stop-loss −%</span>
            <input type="number" min="0" step="0.5" value={strategy.stopPct} onChange={handleStrategy('stopPct')} />
          </label>
          <label className="pp-field">
            <span>Trailing −%</span>
            <input type="number" min="0" step="0.5" value={strategy.trailingPct} onChange={handleStrategy('trailingPct')} />
          </label>
        </div>
        <p className="pp-hint">
          Target and stop are measured from your average cost; the trailing stop is measured
          from the highest close since your earliest buy.
        </p>
      </div>
    </section>
  );
}
