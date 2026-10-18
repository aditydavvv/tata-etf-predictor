/**
 * Self-correcting prediction engine.
 *
 * The deployed app is a static bundle, so there is no server to run a daily job.
 * Instead this engine works from the browser:
 *
 *   1. Every load it journals the live prediction (one entry per IST trading day).
 *   2. It scores each journalled prediction against the actual next-day close of
 *      TATSILV using the CI price snapshot history.
 *   3. It rewrites its own parameters (bias, order-book weight, confidence scale)
 *      from the accumulated error, so the next prediction is auto-corrected.
 *
 * Everything is derived from real prices — no outcome is ever invented. If there
 * is not enough evidence yet the model stays at its neutral defaults and the UI
 * says it is still learning.
 */

import { loadSnapshot, getHistory } from './priceSnapshot.js';

const JOURNAL_KEY = 'silver-etf-prediction-journal-v1';
const MODEL_KEY = 'silver-etf-prediction-model-v1';

/** Score -> percent move mapping, mirrored from livePredictionService (band = |score| * 6). */
const SCORE_TO_PCT = 6;
/** A move below this (in %) counts as flat when judging direction. */
const FLAT_EPSILON = 0.15;
/** Minimum scored predictions before the engine trusts its own corrections. */
const MIN_SAMPLES = 3;
/** EMA weight when blending freshly measured corrections into the stored model. */
const EMA = 0.4;

export const DEFAULT_MODEL = {
  bias: 0,
  orderBookFactor: 1,
  confidenceScale: 1,
  samples: 0,
  hitRate: 0,
  avgAbsError: 0,
  lastTrainedAt: null
};

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readJSON(key, fallback) {
  const store = safeStorage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — engine simply won't persist */
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** IST calendar day key (YYYY-MM-DD) for a timestamp. */
export function istDayKey(ms) {
  const shifted = new Date(ms + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Signed midpoint of an expected-move range like "+2.2% to +4.9%" or "±0.7%". */
export function expectedMoveMidpoint(expectedMove, direction) {
  if (!expectedMove || expectedMove === '—') return 0;
  const nums = (expectedMove.match(/-?\d+\.?\d*/g) || []).map(Number).filter(Number.isFinite);
  if (nums.length === 0) return 0;
  const magnitude = nums.reduce((a, b) => a + Math.abs(b), 0) / nums.length;
  if (direction === 'positive') return magnitude;
  if (direction === 'negative') return -magnitude;
  return 0;
}

function realizedDirection(ret) {
  if (ret > FLAT_EPSILON) return 'positive';
  if (ret < -FLAT_EPSILON) return 'negative';
  return 'neutral';
}

export function loadJournal() {
  const journal = readJSON(JOURNAL_KEY, []);
  return Array.isArray(journal) ? journal : [];
}

export function saveJournal(journal) {
  writeJSON(JOURNAL_KEY, journal.slice(-400));
}

export function loadModel() {
  const model = readJSON(MODEL_KEY, null);
  return model && typeof model === 'object' ? { ...DEFAULT_MODEL, ...model } : { ...DEFAULT_MODEL };
}

export function saveModel(model) {
  writeJSON(MODEL_KEY, model);
}

/** Record (or refresh) today's prediction. Idempotent per IST day. */
export function recordPrediction(journal, prediction, price, now = Date.now()) {
  if (!prediction?.hasData || !Number.isFinite(price) || price <= 0) return journal;
  const date = istDayKey(now);
  const entry = {
    date,
    ts: now,
    price,
    direction: prediction.direction,
    expectedMove: prediction.expectedMove,
    midpoint: expectedMoveMidpoint(prediction.expectedMove, prediction.direction),
    confidence: prediction.confidence,
    rawScore: prediction.rawScore ?? prediction.score ?? 0,
    score: prediction.score ?? 0,
    orderBook: prediction.orderBook?.value ?? null,
    eventScore: prediction.eventScore ?? null,
    adjustments: prediction.adjustments ?? null,
    evaluation: null
  };

  const idx = journal.findIndex(e => e.date === date);
  if (idx >= 0) {
    // Preserve any evaluation already attached to today's entry.
    const prior = journal[idx];
    journal[idx] = { ...entry, evaluation: prior.evaluation };
  } else {
    journal.push(entry);
    journal.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  return journal;
}

/**
 * Score every unevaluated entry against the first close strictly after its day.
 * Mutates the journal entries in place and returns the number newly scored.
 */
export function evaluateJournal(journal, history) {
  if (!Array.isArray(history) || history.length === 0) return 0;

  const rows = history
    .map(r => ({ day: istDayKey(r.date?.getTime?.() ?? new Date(r.date).getTime()), close: r.close }))
    .filter(r => Number.isFinite(r.close) && r.day)
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  let scored = 0;
  for (const entry of journal) {
    if (entry.evaluation || !Number.isFinite(entry.price) || entry.price <= 0) continue;
    const next = rows.find(r => r.day > entry.date);
    if (!next) continue;

    const realizedReturn = ((next.close - entry.price) / entry.price) * 100;
    const dir = realizedDirection(realizedReturn);
    const signedPredicted = entry.direction === 'neutral' ? 0 : entry.midpoint;
    const errorPp = realizedReturn - signedPredicted;

    entry.evaluation = {
      resolvedDay: next.day,
      realizedReturn: parseFloat(realizedReturn.toFixed(2)),
      realizedDirection: dir,
      hit: dir === entry.direction,
      errorPp: parseFloat(errorPp.toFixed(2)),
      absErrorPp: parseFloat(Math.abs(errorPp).toFixed(2)),
      evaluatedAt: Date.now()
    };
    scored += 1;
  }
  return scored;
}

/**
 * Rewrite the model from the accumulated error. Falls back to defaults until
 * there is enough evidence (MIN_SAMPLES) to trust a correction.
 */
export function updateModel(journal, prevModel = DEFAULT_MODEL) {
  const scored = journal.filter(e => e.evaluation);

  if (scored.length < MIN_SAMPLES) {
    return {
      ...DEFAULT_MODEL,
      samples: scored.length,
      lastTrainedAt: scored.length ? Date.now() : null
    };
  }

  // 1. Score bias: how far the raw score sits from the realised move, on average.
  const biasDeltas = scored.map(e => {
    const target = clamp(e.evaluation.realizedReturn / SCORE_TO_PCT, -1, 1);
    return target - clamp(e.rawScore ?? 0, -1, 1);
  });
  const measuredBias = clamp(
    biasDeltas.reduce((sum, v) => sum + v, 0) / biasDeltas.length,
    -0.5,
    0.5
  );

  // 2. Order-book weight: does its sign agree with realised direction?
  const obScored = scored.filter(e => Number.isFinite(e.orderBook) && Math.abs(e.orderBook) > 0.05);
  let measuredObFactor = prevModel.orderBookFactor ?? 1;
  if (obScored.length >= 2) {
    const correct = obScored.filter(
      e => Math.sign(e.orderBook) === Math.sign(e.evaluation.realizedReturn)
    ).length;
    const accuracy = correct / obScored.length;
    measuredObFactor = clamp(0.6 + accuracy * 0.8, 0.5, 1.6);
  }

  // 3. Confidence scale: calibrate against the realised hit rate.
  const hitRate = scored.filter(e => e.evaluation.hit).length / scored.length;
  const measuredConfScale = clamp(0.7 + hitRate * 0.6, 0.7, 1.25);

  const avgAbsError = scored.reduce((sum, e) => sum + e.evaluation.absErrorPp, 0) / scored.length;

  return {
    bias: clamp((prevModel.bias ?? 0) * (1 - EMA) + measuredBias * EMA, -0.5, 0.5),
    orderBookFactor: clamp((prevModel.orderBookFactor ?? 1) * (1 - EMA) + measuredObFactor * EMA, 0.5, 1.6),
    confidenceScale: clamp((prevModel.confidenceScale ?? 1) * (1 - EMA) + measuredConfScale * EMA, 0.7, 1.25),
    samples: scored.length,
    hitRate: parseFloat(hitRate.toFixed(3)),
    avgAbsError: parseFloat(avgAbsError.toFixed(2)),
    lastTrainedAt: Date.now()
  };
}

function summarize(journal, model) {
  const evaluated = journal.filter(e => e.evaluation);
  const hits = evaluated.filter(e => e.evaluation.hit).length;
  const recent = [...evaluated]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);
  const todayKey = istDayKey(Date.now());
  const today = journal.find(e => e.date === todayKey) ?? null;

  return {
    total: journal.length,
    evaluated: evaluated.length,
    hits,
    hitRate: evaluated.length ? parseFloat((hits / evaluated.length).toFixed(3)) : null,
    avgAbsError: evaluated.length
      ? parseFloat((evaluated.reduce((s, e) => s + e.evaluation.absErrorPp, 0) / evaluated.length).toFixed(2))
      : null,
    pending: journal.length - evaluated.length,
    recent,
    today,
    learning: evaluated.length < MIN_SAMPLES,
    model
  };
}

/** Load snapshot + history, journal today, score pending entries, retrain. */
export async function runEngine({ prediction, price }) {
  await loadSnapshot();
  const history = getHistory('TATSILV.NS');
  const journal = loadJournal();
  const prevModel = loadModel();

  if (prediction?.hasData && Number.isFinite(price)) {
    recordPrediction(journal, prediction, price);
  }
  const newlyScored = evaluateJournal(journal, history);
  const model = updateModel(journal, prevModel);

  saveJournal(journal);
  saveModel(model);

  return { journal, model, newlyScored, stats: summarize(journal, model) };
}

export { summarize };
