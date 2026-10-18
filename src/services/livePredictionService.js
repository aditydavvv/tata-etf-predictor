import { predictETFReaction } from '../data/metals.js';

const SEVERITY_WEIGHT = { high: 1.25, medium: 1, low: 0.6 };

/**
 * Live prediction for the Tata Silver ETF, computed from three inputs:
 *   1. Order-book buyers vs sellers (Groww / NSE market depth) — live only
 *   2. Price momentum from the daily close series (available historically too)
 *   3. Global events, mapped onto silver's historical reaction library
 *
 * Every input becomes a weighted vote. The weighted average is the score.
 * Returns `hasData: false` when no input is available.
 */
export function computeLivePrediction({ marketDepth, events = [], history = [], adjustments = null }) {
  const bias = adjustments?.bias ?? 0;
  const orderBookFactor = adjustments?.orderBookFactor ?? 1;
  const confidenceScale = adjustments?.confidenceScale ?? 1;

  const components = [];

  // 1. Order book: net buyer/seller pressure.
  if (marketDepth && marketDepth.total > 0 && Number.isFinite(marketDepth.buyPct)) {
    const biasValue = Math.max(-1, Math.min(1, (marketDepth.buyPct - 50) / 50));
    const detail = `${marketDepth.buyPct}% buyers · ${marketDepth.sellPct}% sellers · ratio ${marketDepth.ratio}`;
    components.push({
      kind: 'order-book',
      label: 'Buyers vs Sellers',
      detail,
      value: biasValue,
      weight: 1.5 * orderBookFactor
    });
  }

  // 2. Price momentum: trailing 5-session return from the daily closes. This is
  // the one signal that can also be replayed over history for a backtest.
  const momentum = computeMomentum(history);
  if (momentum) {
    components.push({
      kind: 'momentum',
      label: 'Price momentum',
      detail: `${momentum.changePct >= 0 ? '+' : ''}${momentum.changePct.toFixed(1)}% over ${momentum.lookback} sessions`,
      value: momentum.value,
      weight: 1
    });
  }

  // 3. Global events scored against silver's historical reactions.
  const eventBreakdown = [];
  for (const event of events) {
    const reaction = predictETFReaction(event, 'silver', null, null);
    if (!reaction) continue;

    const dir = reaction.prediction === 'positive' ? 1 : reaction.prediction === 'negative' ? -1 : 0;
    const value = dir * Math.min(1, reaction.confidence / 100);
    const weight = (SEVERITY_WEIGHT[event.severity] ?? 1) * (dir !== 0 ? 1 : 0.35);

    eventBreakdown.push({
      id: event.id,
      title: event.title,
      category: event.category,
      severity: event.severity,
      direction: reaction.prediction,
      confidence: reaction.confidence,
      expectedMove: reaction.expectedMove,
      value,
      weight
    });

    components.push({
      kind: 'event',
      label: event.title,
      detail: `${dir > 0 ? '+' : dir < 0 ? '-' : ''}${reaction.expectedMove} · ${reaction.confidence}% confidence`,
      value,
      weight
    });
  }

  if (components.length === 0) {
    return {
      hasData: false,
      direction: 'neutral',
      confidence: 0,
      expectedMove: '—',
      score: 0,
      rawScore: 0,
      components: [],
      events: [],
      orderBook: null,
      adjustments: { bias, orderBookFactor, confidenceScale }
    };
  }

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0) || 1;
  const rawScore = components.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight;
  // Self-correcting bias learned from prior prediction errors (predictionEngine).
  const score = Math.max(-1, Math.min(1, rawScore + bias));
  const agreement = components.reduce((sum, c) => sum + Math.sign(c.value) * c.weight, 0) / totalWeight;

  const direction = score > 0.12 ? 'positive' : score < -0.12 ? 'negative' : 'neutral';
  const confidence = Math.max(30, Math.min(94,
    Math.round((45 + Math.abs(agreement) * 40 + Math.abs(score) * 15) * confidenceScale)
  ));

  const band = Math.max(0.5, Math.abs(score) * 6);
  const expectedMove = direction === 'positive'
    ? `+${(band * 0.6).toFixed(1)}% to +${(band * 1.3).toFixed(1)}%`
    : direction === 'negative'
      ? `-${(band * 0.6).toFixed(1)}% to -${(band * 1.3).toFixed(1)}%`
      : `±${(band * 0.7).toFixed(1)}%`;

  const orderBook = components.find(c => c.kind === 'order-book') ?? null;
  const eventVotes = eventBreakdown.reduce((sum, e) => sum + e.value * e.weight, 0);
  const eventWeight = eventBreakdown.reduce((sum, e) => sum + e.weight, 0) || 1;
  const eventScore = eventVotes / eventWeight;

  const drivers = components
    .filter(c => Math.sign(c.value) === (direction === 'negative' ? -1 : direction === 'positive' ? 1 : 0))
    .sort((a, b) => Math.abs(b.value * b.weight) - Math.abs(a.value * a.weight))
    .slice(0, 5);

  return {
    hasData: true,
    direction,
    confidence,
    expectedMove,
    score,
    rawScore,
    orderBook,
    eventScore,
    drivers,
    components,
    events: eventBreakdown,
    adjustments: { bias, orderBookFactor, confidenceScale }
  };
}

const MOMENTUM_LOOKBACK = 5;
/** Trailing return (in %) that maps to a full ±1 momentum vote. */
const MOMENTUM_FULL_PCT = 3;

/** Trailing-return momentum from a close series, or null when there isn't enough. */
function computeMomentum(history) {
  if (!Array.isArray(history) || history.length < MOMENTUM_LOOKBACK + 1) return null;

  const last = history[history.length - 1]?.close;
  const past = history[history.length - 1 - MOMENTUM_LOOKBACK]?.close;
  if (!Number.isFinite(last) || !Number.isFinite(past) || past <= 0) return null;

  const changePct = ((last - past) / past) * 100;
  const value = Math.max(-1, Math.min(1, changePct / MOMENTUM_FULL_PCT));
  return { changePct, value, lookback: MOMENTUM_LOOKBACK };
}
