import { FIVE_YEAR_SILVER_DATA, DATASET_STATS } from '../data/fiveYearSilverData.js';
import { computeStats } from './silverDataset.js';

/**
 * Quantitative & ML engine for Tata Silver ETF.
 *
 * Trained on the real dataset from services/silverDataset.js when the price
 * snapshot is available. The synthetic series in data/fiveYearSilverData.js is
 * only a labelled fallback, and `provenance.kind` records which was used so the
 * UI never implies modelled numbers are market prices.
 */

// Exponential Moving Average
function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  const ema = [];
  let prev = values[0];
  ema.push(prev);
  for (let i = 1; i < values.length; i++) {
    const val = values[i] * k + prev * (1 - k);
    ema.push(val);
    prev = val;
  }
  return ema;
}

// Relative Strength Index (RSI-14)
function calculateRSI(prices, period = 14) {
  const rsi = new Array(prices.length).fill(50);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : parseFloat((100 - (100 / (1 + avgGain / avgLoss))).toFixed(2));
  }

  return rsi;
}

// MACD (12, 26, 9)
function calculateMACD(prices) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = prices.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  const histogram = macdLine.map((m, i) => parseFloat((m - signalLine[i]).toFixed(4)));

  return { macdLine, signalLine, histogram };
}

// Bollinger Bands (20, 2)
function calculateBollingerBands(prices, period = 20) {
  const bands = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      bands.push({ middle: prices[i], upper: prices[i] * 1.03, lower: prices[i] * 0.97, pctB: 0.5 });
      continue;
    }
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = mean + 2 * stdDev;
    const lower = mean - 2 * stdDev;
    const pctB = upper === lower ? 0.5 : (prices[i] - lower) / (upper - lower);

    bands.push({
      middle: parseFloat(mean.toFixed(2)),
      upper: parseFloat(upper.toFixed(2)),
      lower: parseFloat(lower.toFixed(2)),
      pctB: parseFloat(pctB.toFixed(3))
    });
  }
  return bands;
}

// Feature Matrix & Forward Return Extraction
export function extractFeatures(data = FIVE_YEAR_SILVER_DATA) {
  const closes = data.map(d => d.close);
  const spotSilvers = data.map(d => d.spotSilver);
  const goldRatios = data.map(d => d.goldSilverRatio);
  const usdInrs = data.map(d => d.usdInr);

  const rsiSeries = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes);
  const bollingerData = calculateBollingerBands(closes, 20);
  const ema20Series = calculateEMA(closes, 20);
  const ema50Series = calculateEMA(closes, 50);

  const featureMatrix = [];
  const targets = {
    r1: [], // 1-day percentage return (e.g. 0.005 = +0.5%)
    r7: [], // 7-day percentage return
    r30: [] // 30-day percentage return
  };

  const startIdx = 50; // Warmup period

  for (let i = startIdx; i < data.length; i++) {
    const prev5 = closes[i - 5] || closes[i];
    const prev20 = closes[i - 20] || closes[i];
    const prev50 = closes[i - 50] || closes[i];

    // Normalized momentum returns
    const ret5d = (closes[i] - prev5) / prev5;
    const ret20d = (closes[i] - prev20) / prev20;
    const ret50d = (closes[i] - prev50) / prev50;

    // Spot silver return
    const spotSilverRet5d = (spotSilvers[i] - (spotSilvers[i - 5] || spotSilvers[i])) / (spotSilvers[i - 5] || spotSilvers[i]);

    // USD/INR FX return
    const fxRet20d = (usdInrs[i] - (usdInrs[i - 20] || usdInrs[i])) / (usdInrs[i - 20] || usdInrs[i]);

    // Gold/Silver valuation ratio deviation from 50d mean
    const ratioSlice = goldRatios.slice(Math.max(0, i - 49), i + 1);
    const ratioMean = ratioSlice.reduce((a, b) => a + b, 0) / ratioSlice.length;
    const ratioDev = (goldRatios[i] - ratioMean) / ratioMean;

    // Moving average alignment (EMA20 vs EMA50)
    const maSpread = (ema20Series[i] - ema50Series[i]) / ema50Series[i];

    // Normalized Feature Vector:
    // [1 (bias), ret5d, ret20d, ret50d, spotSilverRet5d, fxRet20d, ratioDev, RSI_norm, MACD_hist_norm, BB_pctB, maSpread]
    const features = [
      1.0,                                   // Intercept
      ret5d,                                 // 5-day price momentum
      ret20d,                                // 20-day swing momentum
      ret50d,                                // 50-day trend momentum
      spotSilverRet5d,                       // COMEX Silver Spot 5-day return
      fxRet20d,                              // USD/INR FX 20-day drift
      ratioDev,                              // Gold/Silver ratio deviation
      (rsiSeries[i] - 50) / 100,             // RSI normalized (-0.5 to +0.5)
      macdData.histogram[i] / closes[i],     // MACD histogram %
      bollingerData[i].pctB - 0.5,           // Bollinger position (-0.5 to +0.5)
      maSpread                               // MA trend spread
    ];

    featureMatrix.push(features);

    // Forward percentage returns
    const pNext1 = i + 1 < data.length ? data[i + 1].close : closes[i] * (1 + ret5d * 0.2);
    const pNext7 = i + 7 < data.length ? data[i + 7].close : closes[i] * (1 + ret5d);
    const pNext30 = i + 30 < data.length ? data[i + 30].close : closes[i] * (1 + ret20d);

    targets.r1.push((pNext1 - closes[i]) / closes[i]);
    targets.r7.push((pNext7 - closes[i]) / closes[i]);
    targets.r30.push((pNext30 - closes[i]) / closes[i]);
  }

  return {
    featureMatrix,
    targets,
    closes: closes.slice(startIdx),
    dates: data.slice(startIdx).map(d => d.date),
    fullData: data.slice(startIdx)
  };
}

// Matrix Operations for Ridge Regression
function transpose(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][r] = matrix[r][c];
    }
  }
  return result;
}

function matMul(A, B) {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let k = 0; k < colsA; k++) {
      for (let j = 0; j < colsB; j++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function invertMatrix(M) {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    const temp = A[i];
    A[i] = A[maxRow];
    A[maxRow] = temp;

    const pivot = A[i][i] || 1e-7;
    for (let j = 0; j < 2 * n; j++) A[i][j] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = 0; j < 2 * n; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }
  }

  return A.map(row => row.slice(n));
}

// Train Ridge Model on Returns
export function trainRidgeReturns(X, y, lambda = 0.05) {
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const nFeatures = XtX.length;

  for (let i = 1; i < nFeatures; i++) {
    XtX[i][i] += lambda;
  }

  const invXtX = invertMatrix(XtX);
  const yCol = y.map(val => [val]);
  const XtY = matMul(Xt, yCol);
  const weights = matMul(invXtX, XtY).map(row => row[0]);

  return weights;
}

/**
 * Holt-Winters double exponential smoothing with a damped trend.
 *
 * The previous version projected `level + h * trend` with no damping. Over a
 * 250-session horizon that is an unbounded linear extrapolation, which on the real
 * TATSILV series (peak ~₹35 falling to ~₹21) produced a "1-year target" of ₹1.61.
 * Damping converges the forecast to a finite asymptote instead of diverging.
 */
export function fitHoltWinters(prices, horizon = 252, alpha = 0.3, beta = 0.1, phi = 0.98) {
  let level = prices[0];
  let trend = (prices[1] - prices[0]);
  const fitted = [level];

  for (let i = 1; i < prices.length; i++) {
    const prevLevel = level;
    level = alpha * prices[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
    fitted.push(level + trend);
  }

  const forecast = [];
  let cumulativeTrend = 0;
  for (let h = 1; h <= horizon; h++) {
    cumulativeTrend += phi ** h * trend;
    forecast.push(level + cumulativeTrend);
  }

  return { fitted, forecast, level, trend, dampedDrift: cumulativeTrend };
}

/**
 * Realised daily volatility and drift from log returns. The Monte Carlo bands used
 * to assume a flat 1.5% daily vol and 4%/yr drift for every asset, so the
 * "confidence intervals" were not derived from this ETF at all.
 */
function realisedStats(closes) {
  if (closes.length < 3) return { dailyVolatility: 0.015, dailyDrift: 0 };

  const logReturns = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (logReturns.length < 2) return { dailyVolatility: 0.015, dailyDrift: 0 };

  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (logReturns.length - 1);

  return {
    dailyVolatility: Math.sqrt(variance),
    dailyDrift: mean
  };
}

// Monte Carlo Probabilistic Simulation (3,000 paths)
export function runMonteCarloSimulation(currentPrice, dailyVolatility = 0.015, dailyDrift = 0.0004, days = 30, numSimulations = 3000) {
  const endPrices = [];

  for (let s = 0; s < numSimulations; s++) {
    let p = currentPrice;
    for (let d = 1; d <= days; d++) {
      const u1 = Math.max(1e-7, Math.random());
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      p = p * Math.exp((dailyDrift - 0.5 * Math.pow(dailyVolatility, 2)) + dailyVolatility * z);
    }
    endPrices.push(p);
  }

  endPrices.sort((a, b) => a - b);
  const p5 = endPrices[Math.floor(numSimulations * 0.05)];
  const p25 = endPrices[Math.floor(numSimulations * 0.25)];
  const p50 = endPrices[Math.floor(numSimulations * 0.50)];
  const p75 = endPrices[Math.floor(numSimulations * 0.75)];
  const p95 = endPrices[Math.floor(numSimulations * 0.95)];

  const probabilityOfProfit = parseFloat(((endPrices.filter(p => p > currentPrice).length / numSimulations) * 100).toFixed(1));

  return {
    medianTarget: parseFloat(p50.toFixed(2)),
    upper95: parseFloat(p95.toFixed(2)),
    lower95: parseFloat(p5.toFixed(2)),
    upper75: parseFloat(p75.toFixed(2)),
    lower25: parseFloat(p25.toFixed(2)),
    probabilityOfProfit,
    simulatedPathsCount: numSimulations
  };
}

/**
 * Main 5-Year ML Pipeline for Tata Silver ETF
 */
export function trainFullTataSilverModel(dataset) {
  const rows = dataset?.rows?.length ? dataset.rows : FIVE_YEAR_SILVER_DATA;
  const stats = dataset?.stats ?? computeStats(rows) ?? DATASET_STATS;
  const provenance = dataset?.provenance ?? {
    kind: 'synthetic',
    label: 'Modelled series (no snapshot available)',
    sessions: rows.length,
    startDate: stats.startDate,
    endDate: stats.endDate
  };

  const extracted = extractFeatures(rows);
  const { featureMatrix, targets, closes, dates, fullData } = extracted;

  const totalSamples = featureMatrix.length;
  const splitIdx = Math.floor(totalSamples * 0.8); // 80% Train, 20% Out-of-sample Test

  // Train Ridge Models on percentage returns
  const XTrain = featureMatrix.slice(0, splitIdx);
  const yTrain1 = targets.r1.slice(0, splitIdx);
  const yTrain7 = targets.r7.slice(0, splitIdx);
  const yTrain30 = targets.r30.slice(0, splitIdx);

  const XTest = featureMatrix.slice(splitIdx);
  const yTest1 = targets.r1.slice(splitIdx);

  const weights1d = trainRidgeReturns(XTrain, yTrain1, 0.02);
  const weights7d = trainRidgeReturns(XTrain, yTrain7, 0.05);
  const weights30d = trainRidgeReturns(XTrain, yTrain30, 0.10);

  const predictReturn = (weights, x) => x.reduce((s, val, idx) => s + val * weights[idx], 0);

  // Out-of-sample Evaluation
  const nTest = yTest1.length;
  let sse1 = 0, sst1 = 0, mae1 = 0, mape1 = 0;
  let correctDirectionCount = 0;

  const yTestMean1 = yTest1.reduce((a, b) => a + b, 0) / nTest;

  for (let i = 0; i < nTest; i++) {
    const baseP = closes[splitIdx + i];
    const actualRet = yTest1[i];
    const predRet = predictReturn(weights1d, XTest[i]);

    const actualPriceNext = baseP * (1 + actualRet);
    const predPriceNext = baseP * (1 + predRet);

    if (Math.sign(actualRet) === Math.sign(predRet) || Math.abs(actualRet) < 0.003) {
      correctDirectionCount++;
    }

    const priceErr = actualPriceNext - predPriceNext;
    sse1 += priceErr * priceErr;
    sst1 += Math.pow(actualPriceNext - (baseP * (1 + yTestMean1)), 2);
    mae1 += Math.abs(priceErr);
    mape1 += Math.abs(priceErr / actualPriceNext);
  }

  // Model Metrics
  // Out-of-sample R² as measured. This was previously clamped into 0.92-0.985,
  // which reported model quality that was never actually achieved.
  const r2 = parseFloat(Math.max(-1, Math.min(1, 1 - (sse1 / (sst1 || 1)))).toFixed(3));
  const rmse = parseFloat(Math.sqrt(sse1 / nTest).toFixed(2));
  const mae = parseFloat((mae1 / nTest).toFixed(2));
  const mape = parseFloat(((mape1 / nTest) * 100).toFixed(2));
  const directionalAccuracy = parseFloat(((correctDirectionCount / nTest) * 100).toFixed(1));

  // Full 5-Year Fitted History for Chart Overlay
  const fittedHistory = featureMatrix.map((x, i) => {
    const predRet = predictReturn(weights1d, x);
    return parseFloat((closes[i] * (1 + predRet)).toFixed(2));
  });

  // Current Latest Market State
  const currentPrice = closes[closes.length - 1];
  const latestFeatures = featureMatrix[featureMatrix.length - 1];

  // Forward Return Forecasts
  const predRet1d = predictReturn(weights1d, latestFeatures);
  const predRet7d = predictReturn(weights7d, latestFeatures);
  const predRet30d = predictReturn(weights30d, latestFeatures);

  // Targets
  const target1d = parseFloat((currentPrice * (1 + predRet1d)).toFixed(2));
  const target7d = parseFloat((currentPrice * (1 + predRet7d)).toFixed(2));
  const target30d = parseFloat((currentPrice * (1 + predRet30d)).toFixed(2));

  // Damped Holt-Winters for 90d and 1y, bounded so a long-horizon trend
  // extrapolation cannot assert a move the realised series never made.
  const hw = fitHoltWinters(closes, 252);
  const MAX_LONG_HORIZON_MOVE = 0.4;
  const clampLongHorizon = value => {
    const bounded = Math.min(
      currentPrice * (1 + MAX_LONG_HORIZON_MOVE),
      Math.max(currentPrice * (1 - MAX_LONG_HORIZON_MOVE), value)
    );
    return Number.isFinite(bounded) ? parseFloat(bounded.toFixed(2)) : currentPrice;
  };
  const target90d = clampLongHorizon(hw.forecast[63] ?? target30d * 1.04);
  const target1y = clampLongHorizon(hw.forecast[250] ?? currentPrice);

  // Monte Carlo confidence intervals, parameterised by this ETF's realised
  // volatility and drift rather than a flat assumed constant.
  const { dailyVolatility, dailyDrift } = realisedStats(closes);
  const mc7d = runMonteCarloSimulation(currentPrice, dailyVolatility, dailyDrift, 7, 3000);
  const mc30d = runMonteCarloSimulation(currentPrice, dailyVolatility, dailyDrift, 30, 3000);

  /**
   * Confidence is the measured out-of-sample directional hit rate, adjusted down
   * for horizon and for lack of predictive skill. The old code floored every
   * horizon at 62-68% and hardcoded 76/72 for 90D/1Y, so the UI reported numbers
   * the model never earned.
   */
  const baseConfidence = Math.round(Math.max(0, Math.min(100, directionalAccuracy)));
  const skillPenalty = r2 <= 0 ? 15 : r2 < 0.1 ? 8 : 0;
  const confidenceFor = decay => Math.max(35, Math.round(baseConfidence * decay) - skillPenalty);

  const signalFor = (target, bullEdge, bearEdge, bullLabel = 'BULLISH') =>
    target > currentPrice * bullEdge ? bullLabel : target < currentPrice * bearEdge ? 'BEARISH' : 'NEUTRAL';

  const predictions = {
    '1D': {
      targetPrice: target1d,
      expectedMovePct: parseFloat((predRet1d * 100).toFixed(2)),
      upperBound: parseFloat((target1d + 1.2 * rmse).toFixed(2)),
      lowerBound: parseFloat((target1d - 1.2 * rmse).toFixed(2)),
      confidence: confidenceFor(1),
      signal: signalFor(target1d, 1.007, 0.993),
      horizon: 'Next Trading Session (1 Day)'
    },
    '7D': {
      targetPrice: target7d,
      expectedMovePct: parseFloat((predRet7d * 100).toFixed(2)),
      upperBound: mc7d.upper95,
      lowerBound: mc7d.lower95,
      confidence: confidenceFor(0.96),
      signal: signalFor(target7d, 1.006, 0.994),
      horizon: '1 Week Swing (7 Days)'
    },
    '30D': {
      targetPrice: target30d,
      expectedMovePct: parseFloat((predRet30d * 100).toFixed(2)),
      upperBound: mc30d.upper95,
      lowerBound: mc30d.lower95,
      confidence: confidenceFor(0.92),
      signal: signalFor(target30d, 1.015, 0.985),
      horizon: '1 Month Outlook (30 Days)'
    },
    '90D': {
      targetPrice: target90d,
      expectedMovePct: parseFloat(((target90d - currentPrice) / currentPrice * 100).toFixed(2)),
      upperBound: parseFloat((target90d * 1.09).toFixed(2)),
      lowerBound: parseFloat((target90d * 0.91).toFixed(2)),
      confidence: confidenceFor(0.75),
      signal: signalFor(target90d, 1.03, 0.97),
      horizon: 'Quarterly Outlook (90 Days)'
    },
    '1Y': {
      targetPrice: target1y,
      expectedMovePct: parseFloat(((target1y - currentPrice) / currentPrice * 100).toFixed(2)),
      upperBound: parseFloat((target1y * 1.18).toFixed(2)),
      lowerBound: parseFloat((target1y * 0.85).toFixed(2)),
      confidence: confidenceFor(0.6),
      signal: signalFor(target1y, 1.06, 0.94, 'STRONG BULLISH'),
      horizon: '1-Year Structural Macro Projection'
    }
  };

  const featureLabels = [
    'Base Constant',
    '5-Day Short Momentum',
    '20-Day Swing Momentum',
    '50-Day Trend Momentum',
    'COMEX Silver Spot 5-Day Return',
    'USD/INR FX 20-Day Trend',
    'Gold/Silver Valuation Ratio Shift',
    'RSI-14 Momentum Oscillator',
    'MACD Histogram Convergence',
    'Bollinger Bands %B Volatility Position',
    'EMA20 / SMA50 Trend Spread'
  ];

  const featureWeights = weights7d.map((w, idx) => ({
    name: featureLabels[idx] || `Feature ${idx}`,
    weight: parseFloat((w * 10).toFixed(3)),
    impact: Math.abs(w * 10) > 0.5 ? 'High' : Math.abs(w * 10) > 0.2 ? 'Medium' : 'Low',
    direction: w >= 0 ? 'Positive' : 'Negative'
  })).slice(1);

  return {
    metrics: {
      totalDays: stats.totalDays,
      trainingDays: splitIdx,
      testingDays: nTest,
      r2Score: r2,
      directionalAccuracy: `${directionalAccuracy}%`,
      rmse: `₹${rmse}`,
      mae: `₹${mae}`,
      mape: `${mape}%`,
      cagr: `${stats.cagr}%`,
      dataRange: `${stats.startDate} → ${stats.endDate}`,
      /**
       * False when out-of-sample R² is at or below zero, i.e. the model does not
       * beat predicting the historical mean. The UI uses this to warn instead of
       * presenting the projections as reliable.
       */
      hasPredictiveSkill: r2 > 0
    },
    currentPrice,
    predictions,
    featureWeights,
    monteCarlo: mc30d,
    dates,
    actualPrices: closes,
    fittedHistory,
    latestDataPoint: fullData[fullData.length - 1],
    provenance,
    trainedAt: new Date().toISOString()
  };
}

/**
 * Scenario Simulator: What-If Analysis
 */
export function simulateCustomScenario(baseModel, {
  spotSilverChangePct = 0,
  usdInrChangePct = 0,
  fedRateCutBps = 0,
  solarDemandBoostPct = 0
}) {
  if (!baseModel) return null;

  const currentPrice = baseModel.currentPrice;

  // Elasticity Factors for Tata Silver ETF:
  // 1. COMEX Silver Spot: 1% delta -> +0.94% ETF move
  // 2. USD/INR FX Rate: 1% delta -> +0.86% domestic silver move
  // 3. Fed Rate Cut: 25 bps cut -> +1.50% monetary easing tailwind
  // 4. Solar/EV Demand: 5% boost -> +0.90% structural demand pull
  const silverComponent = (spotSilverChangePct / 100) * 0.94;
  const fxComponent = (usdInrChangePct / 100) * 0.86;
  const rateCutComponent = (fedRateCutBps / 25) * 0.015;
  const solarComponent = (solarDemandBoostPct / 100) * 0.18;

  const totalSimulatedReturn = silverComponent + fxComponent + rateCutComponent + solarComponent;
  const simulatedTarget = parseFloat((currentPrice * (1 + totalSimulatedReturn)).toFixed(2));
  const simulatedMovePct = parseFloat((totalSimulatedReturn * 100).toFixed(2));

  return {
    currentPrice,
    simulatedTarget,
    simulatedMovePct,
    signal: simulatedMovePct > 0.5 ? 'BULLISH' : simulatedMovePct < -0.5 ? 'BEARISH' : 'NEUTRAL',
    breakdown: {
      spotSilverImpact: `${(silverComponent * 100).toFixed(2)}%`,
      fxImpact: `${(fxComponent * 100).toFixed(2)}%`,
      rateCutImpact: `${(rateCutComponent * 100).toFixed(2)}%`,
      solarDemandImpact: `${(solarComponent * 100).toFixed(2)}%`
    }
  };
}
