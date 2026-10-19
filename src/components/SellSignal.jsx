import './SellSignal.css';

const inr = (v) => (Number.isFinite(v)
  ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  : '—');

const signedPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const VERDICT = {
  SELL: { tone: 'sell', label: 'SELL', sub: 'Your exit rule has triggered' },
  HOLD: { tone: 'hold', label: 'HOLD', sub: 'No exit rule triggered yet' },
  '—': { tone: 'none', label: '—', sub: 'Add a position to get a signal' }
};

function TriggerRow({ label, price, distancePct }) {
  const tone = !Number.isFinite(distancePct) ? '' : distancePct >= 0 ? 'positive' : 'negative';
  return (
    <tr>
      <td className="ss-trigger-label">{label}</td>
      <td className="ss-trigger-price">₹{inr(price)}</td>
      <td className={`ss-trigger-dist ${tone}`}>
        {Number.isFinite(distancePct) ? `${signedPct(distancePct)} away` : '—'}
      </td>
    </tr>
  );
}

export default function SellSignal({ result, priceAsOf }) {
  const v = VERDICT[result?.verdict] ?? VERDICT['—'];
  const hasPosition = result?.hasPosition;
  const hasPrice = result?.hasPrice;

  return (
    <section className="sell-signal">
      <div className="ss-header">
        <h3>Sell Signal</h3>
        {priceAsOf && <span className="ss-asof">Price as of {priceAsOf} IST</span>}
      </div>

      {!hasPosition ? (
        <p className="ss-empty">Add your shares in “My Position” and a sell recommendation will appear here.</p>
      ) : (
        <>
          <div className={`ss-verdict ${v.tone}`}>
            <span className="ss-badge">{v.label}</span>
            <div className="ss-verdict-text">
              <span className="ss-verdict-sub">{v.sub}</span>
              {hasPrice && (
                <span className="ss-verdict-pnl">
                  Unrealized P&amp;L{' '}
                  <strong className={result.pnl >= 0 ? 'up' : 'down'}>
                    ₹{inr(result.pnl)} ({signedPct(result.pnlPct)})
                  </strong>
                </span>
              )}
            </div>
          </div>

          {!hasPrice ? (
            <p className="ss-empty">Current price is unavailable right now, so no signal can be computed.</p>
          ) : (
            <>
              {result.reasons?.length > 0 && (
                <ul className="ss-reasons">
                  {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}

              <div className="ss-triggers">
                <table className="ss-table">
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Level</th>
                      <th>Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <TriggerRow
                      label={`Target (+${result.strategy.targetPct}%)`}
                      price={result.targetPrice}
                      distancePct={result.distanceToTargetPct}
                      tone="up"
                    />
                    <TriggerRow
                      label={`Stop-loss (−${result.strategy.stopPct}%)`}
                      price={result.stopPrice}
                      distancePct={result.distanceToStopPct}
                      tone="down"
                    />
                    <TriggerRow
                      label={`Trailing stop (−${result.strategy.trailingPct}% from peak)`}
                      price={result.trailingStopPrice}
                      distancePct={result.distanceToTrailingPct}
                      tone={result.currentPrice <= result.trailingStopPrice ? 'down' : ''}
                    />
                  </tbody>
                </table>
                <p className="ss-peak">
                  Peak close since your earliest buy: <strong>₹{inr(result.peakPrice)}</strong>
                  {' · '}current ₹{inr(result.currentPrice)}
                </p>
              </div>
            </>
          )}

          <p className="ss-note">
            Rule-based decision aid — not financial advice. Prices come from the delayed daily
            snapshot, not a live feed.
          </p>
        </>
      )}
    </section>
  );
}
