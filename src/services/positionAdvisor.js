/**
 * Position advisor: turns a manually-entered holding (one or more buy lots)
 * into an exit recommendation against the latest available price.
 *
 * Pure functions only — no browser APIs — so it can be unit-tested and reused.
 * The verdict is rule-based and deliberately transparent: stop-loss, then
 * target, then trailing stop, otherwise hold.
 */

export const DEFAULT_STRATEGY = {
  targetPct: 10,
  stopPct: 5,
  trailingPct: 6
};

const toNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Normalise history rows ({ date: Date, close }) into sorted { ms, close }. */
function toRows(history) {
  return (Array.isArray(history) ? history : [])
    .map(r => {
      const ms = r?.date?.getTime?.() ?? new Date(r?.date).getTime();
      return { ms, close: r?.close };
    })
    .filter(r => Number.isFinite(r.close) && Number.isFinite(r.ms))
    .sort((a, b) => a.ms - b.ms);
}

/** Shares, money invested and average cost across all valid lots. */
export function averageCost(lots) {
  const valid = (Array.isArray(lots) ? lots : []).filter(
    l => toNumber(l?.qty) > 0 && toNumber(l?.price) > 0
  );
  const qty = valid.reduce((sum, l) => sum + l.qty, 0);
  const invested = valid.reduce((sum, l) => sum + l.qty * l.price, 0);
  return { qty, invested, avgCost: qty > 0 ? invested / qty : 0 };
}

/** Highest close on or after `sinceMs`; falls back to the whole series. */
export function peakSince(history, sinceMs) {
  const rows = toRows(history);
  const relevant = Number.isFinite(sinceMs) ? rows.filter(r => r.ms >= sinceMs) : rows;
  const use = relevant.length > 0 ? relevant : rows;
  return use.reduce((max, r) => Math.max(max, r.close), 0);
}

function earliestLotMs(lots) {
  return (Array.isArray(lots) ? lots : []).reduce((min, lot) => {
    if (!lot?.date) return min;
    const ms = new Date(lot.date).getTime();
    if (!Number.isFinite(ms)) return min;
    return min == null || ms < min ? ms : min;
  }, null);
}

/**
 * Evaluate a holding and return the exit recommendation.
 *
 * @param {object}   args
 * @param {Array}    args.lots         - [{ qty, price, date? }]
 * @param {object}   args.strategy     - { targetPct, stopPct, trailingPct }
 * @param {number}   args.currentPrice - latest available price
 * @param {Array}    args.history      - [{ date, close }] daily closes
 */
export function evaluatePosition({ lots, strategy, currentPrice, history }) {
  const strat = { ...DEFAULT_STRATEGY, ...(strategy || {}) };
  const { qty, invested, avgCost } = averageCost(lots);

  if (!(qty > 0)) {
    return { hasPosition: false, hasPrice: Number.isFinite(currentPrice), verdict: '—', strategy: strat, reasons: [] };
  }
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { hasPosition: true, hasPrice: false, qty, invested, avgCost, verdict: '—', strategy: strat, reasons: [] };
  }

  const currentValue = qty * currentPrice;
  const pnl = currentValue - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

  const peakPrice = Math.max(peakSince(history, earliestLotMs(lots)) || currentPrice, currentPrice);
  const targetPrice = avgCost * (1 + strat.targetPct / 100);
  const stopPrice = avgCost * (1 - strat.stopPct / 100);
  const trailingStopPrice = peakPrice * (1 - strat.trailingPct / 100);

  let verdict = 'HOLD';
  let trigger = null;
  const reasons = [];

  if (currentPrice <= stopPrice) {
    verdict = 'SELL';
    trigger = 'stop';
    reasons.push(`Stop-loss reached: ₹${currentPrice.toFixed(2)} is at or below your −${strat.stopPct}% stop of ₹${stopPrice.toFixed(2)} on an average cost of ₹${avgCost.toFixed(2)}.`);
  } else if (currentPrice >= targetPrice) {
    verdict = 'SELL';
    trigger = 'target';
    reasons.push(`Target reached: ₹${currentPrice.toFixed(2)} is at or above your +${strat.targetPct}% target of ₹${targetPrice.toFixed(2)} on an average cost of ₹${avgCost.toFixed(2)}.`);
  } else if (currentPrice <= trailingStopPrice) {
    verdict = 'SELL';
    trigger = 'trailing';
    reasons.push(`Trailing stop reached: ₹${currentPrice.toFixed(2)} has pulled back ${strat.trailingPct}% or more from the peak of ₹${peakPrice.toFixed(2)} (stop ₹${trailingStopPrice.toFixed(2)}).`);
  } else {
    reasons.push(`Holding: ₹${currentPrice.toFixed(2)} is between your stop (₹${stopPrice.toFixed(2)}) and target (₹${targetPrice.toFixed(2)}).`);
  }

  return {
    hasPosition: true,
    hasPrice: true,
    qty,
    invested,
    avgCost,
    currentPrice,
    currentValue,
    pnl,
    pnlPct,
    peakPrice,
    targetPrice,
    stopPrice,
    trailingStopPrice,
    distanceToTargetPct: (targetPrice - currentPrice) / currentPrice * 100,
    distanceToStopPct: (currentPrice - stopPrice) / currentPrice * 100,
    distanceToTrailingPct: (currentPrice - trailingStopPrice) / currentPrice * 100,
    verdict,
    trigger,
    strategy: strat,
    reasons
  };
}
