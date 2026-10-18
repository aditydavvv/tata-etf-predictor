import { predictETFReaction } from '../data/metals.js';

const SEVERITY_WEIGHT = { high: 1.25, medium: 1, low: 0.6 };

/**
 * Live prediction for the Tata Silver ETF, computed from two live inputs:
 *   1. Order-book buyers vs sellers (Groww / NSE market depth)
 *   2. Global events, mapped onto silver's historical reaction library
 *
 * Every input becomes a weighted vote. The weighted average is the score.
 * Returns `hasData: false` when neither input is available.
 */
export function computeLivePrediction({ marketDepth, events = [] }) {
  const components = [];

  // 1. Order book: net buyer/seller pressure.
  if (marketDepth && marketDepth.total > 0 && Number.isFinite(marketDepth.buyPct)) {
    const bias = Math.max(-1, Math.min(1, (marketDepth.buyPct - 50) / 50));
    const detail = `${marketDepth.buyPct}% buyers · ${marketDepth.sellPct}% sellers · ratio ${marketDepth.ratio}`;
    components.push({
      kind: 'order-book',
      label: 'Buyers vs Sellers',
      detail,
      value: bias,
      weight: 1.5
    });
  }

  // 2. Global events scored against silver's historical reactions.
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
      components: [],
      events: [],
      orderBook: null
    };
  }

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0) || 1;
  const score = components.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight;
  const agreement = components.reduce((sum, c) => sum + Math.sign(c.value) * c.weight, 0) / totalWeight;

  const direction = score > 0.12 ? 'positive' : score < -0.12 ? 'negative' : 'neutral';
  const confidence = Math.max(30, Math.min(94, Math.round(45 + Math.abs(agreement) * 40 + Math.abs(score) * 15)));

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
    orderBook,
    eventScore,
    drivers,
    components,
    events: eventBreakdown
  };
}
