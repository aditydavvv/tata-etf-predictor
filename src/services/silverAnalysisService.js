import { fetchResilient } from '../utils/fetchResilient.js';
import { loadSnapshot, getQuote, getHistory } from './priceSnapshot.js';
import { YAHOO_CHART_BASE } from './marketDataService.js';

const YAHOO_BASE = YAHOO_CHART_BASE;

const SYMBOLS = { silver: 'SI=F', gold: 'GC=F', usdInr: 'USDINR=X' };

async function fetchYahooChart(symbol, range, interval) {
  try {
    const response = await fetchResilient(`${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.chart?.result?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Snapshot-first quote. Live Yahoo is only reachable in dev; in production the
 * CI snapshot is the only source, so a missing entry stays null instead of
 * falling back to an invented number.
 */
async function resolveQuote(symbol) {
  await loadSnapshot();

  const snapshotted = getQuote(symbol);
  if (snapshotted) {
    return {
      price: snapshotted.price,
      prevClose: snapshotted.prevClose,
      change: snapshotted.change,
      changePercent: snapshotted.changePercent,
      source: snapshotted.source,
      asOf: snapshotted.asOf
    };
  }

  const result = await fetchYahooChart(symbol, '1d', '5m');
  const price = result?.meta?.regularMarketPrice;
  if (!Number.isFinite(price)) return null;

  const prevClose = Number.isFinite(result.meta.previousClose)
    ? result.meta.previousClose
    : result.meta.chartPreviousClose ?? null;

  return {
    price,
    prevClose,
    change: prevClose != null ? price - prevClose : null,
    changePercent: Number.isFinite(result.meta.regularMarketChangePercent)
      ? result.meta.regularMarketChangePercent
      : prevClose
        ? ((price - prevClose) / prevClose) * 100
        : null,
    source: 'Yahoo Finance',
    asOf: null
  };
}

/** Daily closes, oldest first. Empty when nothing real is available. */
async function resolveDailyCloses(symbol) {
  await loadSnapshot();

  const history = getHistory(symbol);
  if (history.length > 0) return history.map(row => row.close);

  const result = await fetchYahooChart(symbol, '3mo', '1d');
  const closes = result?.indicators?.quote?.[0]?.close || [];
  return closes.filter(Number.isFinite);
}

export async function fetchSilverAnalysis() {
  const [silverQuote, goldQuote, usdInrQuote, silverCloses, goldCloses] = await Promise.all([
    resolveQuote(SYMBOLS.silver),
    resolveQuote(SYMBOLS.gold),
    resolveQuote(SYMBOLS.usdInr),
    resolveDailyCloses(SYMBOLS.silver),
    resolveDailyCloses(SYMBOLS.gold)
  ]);

  if (!silverQuote) return null;

  const currentSilver = silverQuote.price;
  const currentGold = goldQuote?.price ?? null;
  const currentUSDRate = usdInrQuote?.price ?? null;

  const prevSilver = silverQuote.prevClose ?? silverCloses[silverCloses.length - 2] ?? currentSilver;
  const silverChange = prevSilver ? ((currentSilver - prevSilver) / prevSilver) * 100 : 0;
  const goldChange = goldQuote?.prevClose ? ((currentGold - goldQuote.prevClose) / goldQuote.prevClose) * 100 : 0;
  const usdChange = usdInrQuote?.prevClose ? ((currentUSDRate - usdInrQuote.prevClose) / usdInrQuote.prevClose) * 100 : 0;

  const goldSilverRatio = currentGold ? currentGold / currentSilver : null;

  let goldSilverRatioChange = 0;
  if (goldSilverRatio && goldCloses.length >= 6 && silverCloses.length >= 6) {
    const pairs = Math.min(goldCloses.length, silverCloses.length);
    const ratioSeries = [];
    for (let i = 1; i <= pairs; i++) {
      const g = goldCloses[goldCloses.length - i];
      const s = silverCloses[silverCloses.length - i];
      if (g && s) ratioSeries.push(g / s);
    }
    if (ratioSeries.length >= 3) {
      const ratioAvg = ratioSeries.reduce((sum, r) => sum + r, 0) / ratioSeries.length;
      if (ratioAvg) goldSilverRatioChange = ((goldSilverRatio - ratioAvg) / ratioAvg) * 100;
    }
  }

  const momentumOver = (series, sessions) => {
    if (series.length < sessions + 1) return 0;
    const from = series[series.length - 1 - sessions];
    const to = series[series.length - 1];
    return from ? ((to - from) / from) * 100 : 0;
  };

  const momentum3d = momentumOver(silverCloses, 3);
  const momentum5d = momentumOver(silverCloses, 5);

  let volatility = 0;
  const volWindow = silverCloses.slice(-21);
  if (volWindow.length >= 3) {
    const returns = [];
    for (let i = 1; i < volWindow.length; i++) {
      returns.push((volWindow[i] - volWindow[i - 1]) / volWindow[i - 1]);
    }
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    volatility = Math.sqrt(variance) * 100;
  }

  const trend = calculateTrend(silverCloses);

  return {
    silver: {
      price: currentSilver,
      change: parseFloat(silverChange.toFixed(2)),
      momentum3d: parseFloat(momentum3d.toFixed(2)),
      momentum5d: parseFloat(momentum5d.toFixed(2)),
      trend,
      volatility: parseFloat(volatility.toFixed(2))
    },
    gold: currentGold
      ? {
          price: currentGold,
          change: parseFloat(goldChange.toFixed(2))
        }
      : null,
    goldSilverRatio: goldSilverRatio ? parseFloat(goldSilverRatio.toFixed(1)) : null,
    goldSilverRatioChange: parseFloat(goldSilverRatioChange.toFixed(2)),
    usdInr: currentUSDRate
      ? {
          rate: currentUSDRate,
          change: parseFloat(usdChange.toFixed(2))
        }
      : null,
    provenance: {
      source: silverQuote.source,
      asOf: silverQuote.asOf,
      silverSessions: silverCloses.length,
      goldSessions: goldCloses.length
    },
    analysis: generateAnalysis(silverChange, goldChange, goldSilverRatio, goldSilverRatioChange, momentum3d, momentum5d, trend, volatility)
  };
}

function calculateTrend(prices) {
  if (!Array.isArray(prices) || prices.length < 3) {
    return { direction: 'neutral', strength: 0, r2: 0 };
  }
  const n = prices.length;
  const xMean = (n - 1) / 2;
  const yMean = prices.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (prices[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    sse += Math.pow(prices[i] - (intercept + slope * i), 2);
  }
  const sst = prices.reduce((s, p) => s + Math.pow(p - yMean, 2), 0);
  const r2 = sst > 0 ? Math.max(0, 1 - sse / sst) : 0;
  const driftPctPerDay = yMean > 0 ? (slope / yMean) * 100 : 0;
  const effectiveDrift = driftPctPerDay * r2;
  return {
    direction: effectiveDrift > 0.05 ? 'up' : effectiveDrift < -0.05 ? 'down' : 'neutral',
    strength: Math.min(100, Math.round(Math.abs(effectiveDrift) * 100 + 40)),
    r2: parseFloat(r2.toFixed(2))
  };
}

function generateAnalysis(silverChange, goldChange, goldSilverRatio, goldSilverRatioChange, momentum3d, momentum5d, trend, volatility) {
  const signals = [];
  let bullishScore = 0;
  let bearishScore = 0;

  if (silverChange > 0.4) {
    signals.push('Silver showing positive momentum today (+ ' + silverChange.toFixed(1) + '%)');
    bullishScore += 2;
  } else if (silverChange < -0.4) {
    signals.push('Silver under mild pressure today (' + silverChange.toFixed(1) + '%)');
    bearishScore += 2;
  }

  if (goldChange > 0.4) {
    signals.push('Gold rallying provides macro tailwind for silver');
    bullishScore += 1;
  } else if (goldChange < -0.4) {
    signals.push('Gold consolidation may weigh on silver');
    bearishScore += 1;
  }

  if (goldSilverRatio && goldSilverRatio > 80) {
    signals.push(`Gold/Silver ratio ${goldSilverRatio.toFixed(0)} historically elevated (>80) - Silver is undervalued vs Gold`);
    bullishScore += 2;
  } else if (goldSilverRatio && goldSilverRatio < 60) {
    signals.push(`Gold/Silver ratio ${goldSilverRatio.toFixed(0)} low - Silver rich vs Gold`);
    bearishScore += 1;
  }

  if (goldSilverRatioChange < -0.5) {
    signals.push('Silver outperforming gold this week (Ratio compressing)');
    bullishScore += 1;
  } else if (goldSilverRatioChange > 0.5) {
    signals.push('Silver lagging gold this week');
    bearishScore += 1;
  }

  if (momentum3d > 1.5) {
    signals.push(`Strong 3-day momentum (+${momentum3d.toFixed(1)}%)`);
    bullishScore += 1;
  } else if (momentum3d < -1.5) {
    signals.push(`Weak 3-day momentum (${momentum3d.toFixed(1)}%)`);
    bearishScore += 1;
  }

  if (trend.direction === 'up') {
    signals.push(`Robust uptrend intact (Trend Strength ${trend.strength}%)`);
    bullishScore += 2;
  } else if (trend.direction === 'down') {
    signals.push(`Downtrend in place (Strength ${trend.strength}%)`);
    bearishScore += 2;
  }

  if (volatility > 2.5) {
    signals.push('High volatility regime (Realized Vol > 2.5%)');
  }

  signals.push('Structural green energy & solar PV demand supports long-term base');
  bullishScore += 1;

  const netScore = bullishScore - bearishScore;
  let outlook;
  if (netScore > 2) outlook = 'bullish';
  else if (netScore > 0) outlook = 'slightly-bullish';
  else if (netScore < -2) outlook = 'bearish';
  else if (netScore < 0) outlook = 'slightly-bearish';
  else outlook = 'neutral';

  return {
    outlook,
    signals,
    bullishScore,
    bearishScore,
    netScore
  };
}

export function predictTataSilverETF(silverAnalysis, marketDepth = null, selectedEvent = null, mlModelOutput = null) {
  if (!silverAnalysis?.silver) return null;
  const { silver, gold, goldSilverRatio, goldSilverRatioChange, usdInr } = silverAnalysis;

  const votes = [];
  const addVote = (weight, value, reason) => {
    if (!Number.isFinite(value)) return;
    votes.push({ weight, value: Math.max(-1, Math.min(1, value)), reason });
  };

  // 1. Trend Signal
  const trendDir = silver.trend.direction === 'up' ? 1 : silver.trend.direction === 'down' ? -1 : 0;
  if (trendDir !== 0) {
    addVote(2.0, trendDir * Math.min(1, (silver.trend.r2 ?? 0.7) + 0.2),
      `${silver.trend.direction}trend with ${silver.trend.strength}% momentum`);
  }

  // 1b. Gold-Silver Ratio dynamics
  if (Number.isFinite(goldSilverRatioChange) && Math.abs(goldSilverRatioChange) > 0.2) {
    addVote(1.0, -goldSilverRatioChange, `Gold/Silver ratio moving ${goldSilverRatioChange >= 0 ? '+' : ''}${goldSilverRatioChange.toFixed(2)}%`);
  }

  // 2. Momentum
  if (Math.abs(silver.momentum3d) > 0.4) {
    addVote(1.5, silver.momentum3d / 3, `${Math.abs(silver.momentum3d).toFixed(1)}% 3-day momentum`);
  }
  if (Math.abs(silver.momentum5d) > 0.6) {
    addVote(1.0, silver.momentum5d / 5, `${Math.abs(silver.momentum5d).toFixed(1)}% 5-day momentum`);
  }

  // 3. Intraday Move
  if (Math.abs(silver.change) > 0.3) {
    addVote(1.5, silver.change / 2, `Spot silver ${silver.change >= 0 ? '+' : ''}${silver.change.toFixed(1)}% move`);
  }

  // 4. Gold correlation
  if (gold && Number.isFinite(gold.change) && Math.abs(gold.change) > 0.3) {
    addVote(1.0, gold.change / 2, `Gold ${gold.change >= 0 ? '+' : ''}${gold.change.toFixed(1)}% co-movement`);
  }

  // 5. USD/INR Currency Impact
  if (usdInr && Number.isFinite(usdInr.change) && Math.abs(usdInr.change) > 0.1) {
    addVote(0.8, usdInr.change > 0 ? 0.6 : -0.6,
      `USD/INR ${usdInr.change >= 0 ? 'up' : 'down'} ${Math.abs(usdInr.change).toFixed(2)}% (Import parity)`);
  }

  // 6. Gold/Silver Valuation Ratio
  if (Number.isFinite(goldSilverRatio)) {
    if (goldSilverRatio > 80) {
      addVote(1.5, 0.75, `Gold/Silver ratio ${goldSilverRatio.toFixed(0)} indicates silver is historically undervalued`);
    } else if (goldSilverRatio < 60) {
      addVote(1.0, -0.6, `Gold/Silver ratio ${goldSilverRatio.toFixed(0)} indicates silver rich`);
    }
  }

  // 7. Selected Global Event Impact
  if (selectedEvent) {
    let eventImpactVal = 0;
    if (selectedEvent.impact?.direction === 'positive') eventImpactVal = 0.7;
    else if (selectedEvent.impact?.direction === 'negative') eventImpactVal = -0.7;
    else eventImpactVal = 0.1;

    addVote(1.8, eventImpactVal, `Global Event Impact: "${selectedEvent.title}"`);
  }

  // 8. Historical ML Model Prediction integration
  if (mlModelOutput?.predictions?.['7D']) {
    const ml7d = mlModelOutput.predictions['7D'];
    const mlSignalVal = ml7d.signal === 'BULLISH' ? 0.85 : ml7d.signal === 'BEARISH' ? -0.85 : 0;
    addVote(2.5, mlSignalVal, `Historical model forecast: ${ml7d.expectedMovePct > 0 ? '+' : ''}${ml7d.expectedMovePct}% in 7 days`);
  }

  // 9. Live Market Depth (Order Book)
  if (marketDepth && marketDepth.total > 0 && Number.isFinite(marketDepth.buyPct)) {
    addVote(1.5, (marketDepth.buyPct - 50) / 25, `Order book depth: ${marketDepth.buyPct}% buyers`);
  }

  const totalWeight = votes.reduce((s, v) => s + v.weight, 0) || 1;
  const score = votes.reduce((s, v) => s + v.weight * v.value, 0) / totalWeight;
  const agreement = votes.reduce((s, v) => s + Math.sign(v.value) * v.weight, 0) / totalWeight;

  const direction = score > 0.18 ? 'positive' : score < -0.18 ? 'negative' : 'neutral';

  let confidence = Math.round(52 + Math.abs(agreement) * 32);
  confidence = Math.max(35, Math.min(92, confidence));

  const dailyVol = Math.max(0.6, silver.volatility || 1.6);
  const band = dailyVol * Math.sqrt(3);
  const expectedMove = direction === 'positive'
    ? `+${(band * 0.6).toFixed(1)}% to +${(band * 1.4).toFixed(1)}%`
    : direction === 'negative'
      ? `-${(band * 0.6).toFixed(1)}% to -${(band * 1.4).toFixed(1)}%`
      : `±${(band * 0.7).toFixed(1)}%`;

  const topReasons = votes
    .filter(v => Math.sign(v.value) === (direction === 'negative' ? -1 : 1))
    .sort((a, b) => Math.abs(b.weight * b.value) - Math.abs(a.weight * a.value))
    .slice(0, 4)
    .map(v => v.reason);

  const reasoning = direction === 'neutral'
    ? 'Signals are balanced across macroeconomic factors, momentum, and valuation ratios.'
    : `${direction === 'positive' ? 'Bullish' : 'Bearish'} bias driven by: ${topReasons.join('; ')}.`;

  return {
    prediction: direction,
    confidence,
    expectedMove,
    reasoning,
    analysis: silverAnalysis.analysis,
    silverData: silver,
    goldData: gold,
    goldSilverRatio,
    usdInr,
    provenance: silverAnalysis.provenance,
    timeframe: '1-7 days',
    modelTrainedDays: mlModelOutput?.metrics?.totalDays ?? null
  };
}
