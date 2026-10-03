import { loadSnapshot, getQuote, getHistory } from './priceSnapshot.js';

/**
 * Builds the historical dataset the forecasting model trains on, using only real
 * prices from the CI snapshot.
 *
 * The previous implementation trained on a synthetic random walk
 * (data/fiveYearSilverData.js) that claimed prices from 2021 for an ETF that only
 * listed on 12 Jan 2024. Those rows are gone from the live path; the synthetic
 * series remains exported purely as an explicitly-labelled last resort.
 */

const SYMBOLS = {
  close: 'TATSILV.NS',
  spotSilver: 'SI=F',
  spotGold: 'GC=F',
  usdInr: 'USDINR=X'
};

/** Trainer warmup plus a usable test split. */
const MIN_SESSIONS = 120;

const toISODate = timestamp => {
  const date = new Date(timestamp);
  const ist = new Date(date.getTime() + (date.getTimezoneOffset() + 330) * 60000);
  return ist.toISOString().slice(0, 10);
};

function indexByDate(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(toISODate(row.date.getTime()), row);
  }
  return map;
}

/**
 * @returns {Promise<{rows: object[], stats: object, provenance: object} | null>}
 *   null when the snapshot does not carry enough real history.
 */
export async function buildRealSilverDataset() {
  await loadSnapshot();

  const series = {};
  for (const [field, symbol] of Object.entries(SYMBOLS)) {
    const rows = getHistory(symbol);
    if (rows.length === 0) return null;
    series[field] = { rows, byDate: indexByDate(rows) };
  }

  const dates = [...series.close.byDate.keys()]
    .filter(date => series.spotSilver.byDate.has(date) && series.spotGold.byDate.has(date) && series.usdInr.byDate.has(date))
    .sort();

  if (dates.length < MIN_SESSIONS) return null;

  const rows = dates.map((date, dayIndex) => {
    const close = series.close.byDate.get(date);
    const spotSilver = series.spotSilver.byDate.get(date).close;
    const spotGold = series.spotGold.byDate.get(date).close;

    return {
      date,
      dayIndex,
      close: close.close,
      open: close.open,
      high: close.high,
      low: close.low,
      volume: close.volume,
      spotSilver,
      spotGold,
      goldSilverRatio: parseFloat((spotGold / spotSilver).toFixed(2)),
      usdInr: series.usdInr.byDate.get(date).close
    };
  });

  appendLiveQuote(rows);

  return {
    rows,
    stats: computeStats(rows),
    provenance: {
      kind: 'real',
      label: 'Live market history',
      sources: Object.values(SYMBOLS),
      sessions: rows.length,
      startDate: rows[0].date,
      endDate: rows[rows.length - 1].date
    }
  };
}

/**
 * The snapshot's last completed session trails the live quote, which would leave
 * the model's "current price" a session stale. Extend the series with the live
 * print so the forecast is anchored to the number the user is actually looking at.
 */
function appendLiveQuote(rows) {
  const quote = getQuote(SYMBOLS.close);
  if (!quote?.marketTime) return;

  const last = rows[rows.length - 1];
  const quoteDate = toISODate(quote.marketTime);

  if (quoteDate === last.date) {
    last.close = quote.price;
    last.open = quote.open ?? quote.price;
    last.high = quote.dayHigh ?? quote.price;
    last.low = quote.dayLow ?? quote.price;
    last.volume = quote.volume ?? last.volume;
    return;
  }

  const spotSilver = getQuote(SYMBOLS.spotSilver)?.price ?? last.spotSilver;
  const spotGold = getQuote(SYMBOLS.spotGold)?.price ?? last.spotGold;

  rows.push({
    date: quoteDate,
    dayIndex: rows.length,
    close: quote.price,
    open: quote.open ?? quote.price,
    high: quote.dayHigh ?? quote.price,
    low: quote.dayLow ?? quote.price,
    volume: quote.volume ?? null,
    spotSilver,
    spotGold,
    goldSilverRatio: parseFloat((spotGold / spotSilver).toFixed(2)),
    usdInr: getQuote(SYMBOLS.usdInr)?.price ?? last.usdInr
  });
}

export function computeStats(rows) {
  if (!rows?.length) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const closes = rows.map(row => row.close);
  const years = Math.max((new Date(last.date) - new Date(first.date)) / (365.25 * 24 * 3600 * 1000), 0.01);

  return {
    totalDays: rows.length,
    startDate: first.date,
    endDate: last.date,
    startPrice: first.close,
    latestPrice: last.close,
    minPrice: Math.min(...closes),
    maxPrice: Math.max(...closes),
    cagr: ((Math.pow(last.close / first.close, 1 / years) - 1) * 100).toFixed(2)
  };
}
