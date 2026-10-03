import { fetchResilient } from '../utils/fetchResilient.js';
import { loadSnapshot, getQuote, getHistory } from './priceSnapshot.js';

const YAHOO_FINANCE_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.DEV)
  ? '/yahoo/v8/finance/chart'
  : 'https://query2.finance.yahoo.com/v8/finance/chart';

const SYMBOLS = {
  nifty50: '^NSEI',
  sensex: '^BSESN',
  bankNifty: '^NSEBANK',
  niftyIT: '^CNXIT',
  niftyPharma: '^CNXPHARMA',
  gold: 'GC=F',
  silver: 'SI=F',
  crudeOil: 'CL=F',
  brentCrude: 'BZ=F',
  usdInr: 'USDINR=X',
  goldETF: 'GLD',
  silverETF: 'SLV',
  goldETFIndia: 'GOLDBEES.NS',
  silverETFIndia: 'SILVERBEES.NS',
  tataSilverETF: 'TATSILV.NS',
  tataGoldETF: 'TATAGOLD.NS'
};

export const YAHOO_CHART_BASE = YAHOO_FINANCE_BASE;

/**
 * Live Yahoo is only reachable in dev (via the Vite proxy). In production the
 * browser is blocked by CORS, so the CI snapshot is the primary source and this
 * is only a best-effort secondary. Returns null rather than inventing numbers.
 */
async function fetchYahooData(symbol, range = '1d', interval = '5m') {
  try {
    const url = `${YAHOO_FINANCE_BASE}/${encodeURIComponent(symbol).replace(/%3D/g, '=')}?range=${range}&interval=${interval}`;
    const response = await fetchResilient(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.chart?.result?.[0] || null;
  } catch (error) {
    console.warn(`Live fetch unavailable for ${symbol}:`, error?.message || error);
    return null;
  }
}

/**
 * Yahoo's `chartPreviousClose` is the close *before the requested range*, so on
 * anything wider than intraday it can be weeks stale and must not be used as
 * "yesterday's close". `previousClose` is absent on the chart endpoint, so the
 * real prior close is derived from the daily series instead.
 */
function resolvePrevClose(result, { range, interval } = {}) {
  const meta = result?.meta;
  if (!meta) return null;
  if (Number.isFinite(meta.previousClose)) return meta.previousClose;

  const isIntraday = /m$/.test(interval || '') || range === '1d';
  if (isIntraday && Number.isFinite(meta.chartPreviousClose)) return meta.chartPreviousClose;

  const closes = result.indicators?.quote?.[0]?.close || [];
  const usable = closes.filter(Number.isFinite);
  if (usable.length >= 2) return usable[usable.length - 2];
  if (usable.length === 1) return usable[0];
  return Number.isFinite(meta.chartPreviousClose) ? meta.chartPreviousClose : null;
}

function toQuote(symbol, result, name, sector) {
  const price = result?.meta?.regularMarketPrice;
  if (!Number.isFinite(price)) return null;

  const prevClose = resolvePrevClose(result);
  const change = prevClose != null ? price - prevClose : null;

  return {
    symbol,
    name: result.meta.longName || result.meta.shortName || name,
    value: price,
    price,
    change: change != null ? parseFloat(change.toFixed(2)) : null,
    changePercent: change != null && prevClose ? parseFloat(((change / prevClose) * 100).toFixed(2)) : null,
    dayHigh: result.meta.regularMarketDayHigh || price,
    dayLow: result.meta.regularMarketDayLow || price,
    prevClose,
    volume: formatVolume(result.meta.regularMarketVolume),
    currency: result.meta.currency || 'USD',
    sector,
    source: 'Yahoo Finance',
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Quote lookup order: CI snapshot, then a live fetch. Never fabricates.
 */
async function getQuoteWithFallback(symbol, { range = '1d', interval = '5m', name, sector } = {}) {
  await loadSnapshot();

  const snapshotted = getQuote(symbol);
  if (snapshotted) {
    const prevClose = snapshotted.prevClose;
    return {
      symbol,
      name: name || snapshotted.name,
      value: snapshotted.price,
      price: snapshotted.price,
      change: snapshotted.change,
      changePercent: snapshotted.changePercent,
      dayHigh: snapshotted.dayHigh,
      dayLow: snapshotted.dayLow,
      prevClose,
      volume: formatVolume(snapshotted.volume),
      currency: snapshotted.currency || 'USD',
      sector,
      source: snapshotted.source,
      asOf: snapshotted.asOf,
      marketTime: snapshotted.marketTime,
      lastUpdated: new Date().toISOString()
    };
  }

  const result = await fetchYahooData(symbol, range, interval);
  return result ? toQuote(symbol, result, name, sector) : null;
}

function formatVolume(vol) {
  if (!Number.isFinite(vol)) return 'N/A';
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
  return vol.toString();
}

export async function fetchMarketIndices() {
  const wanted = [
    [SYMBOLS.nifty50, 'NIFTY 50', 'Benchmark'],
    [SYMBOLS.sensex, 'SENSEX', 'Benchmark'],
    [SYMBOLS.bankNifty, 'BANK NIFTY', 'Banking'],
    [SYMBOLS.niftyIT, 'NIFTY IT', 'IT'],
    [SYMBOLS.niftyPharma, 'NIFTY PHARMA', 'Pharma']
  ];

  const quotes = await Promise.all(wanted.map(([symbol, name, sector]) => getQuoteWithFallback(symbol, { name, sector })));
  return quotes.filter(Boolean);
}

export async function fetchCommodityPrices() {
  const wanted = [
    [SYMBOLS.gold, 'per oz', 'Gold'],
    [SYMBOLS.silver, 'per oz', 'Silver'],
    [SYMBOLS.crudeOil, 'per barrel', 'WTI'],
    [SYMBOLS.brentCrude, 'per barrel', 'Brent']
  ];

  const quotes = await Promise.all(wanted.map(([symbol, , type]) => getQuoteWithFallback(symbol, { name: type, sector: type })));

  const empty = { price: null, currency: null, change: null, changePercent: null, prevClose: null, unit: null, type: null };
  const result = {};

  wanted.forEach(([, unit, type], i) => {
    const quote = quotes[i];
    result[type === 'WTI' ? 'crudeOil' : type === 'Brent' ? 'brentCrude' : type.toLowerCase()] = quote
      ? {
          price: quote.price,
          currency: quote.currency,
          change: quote.change,
          changePercent: quote.changePercent,
          prevClose: quote.prevClose,
          unit,
          type,
          source: quote.source,
          asOf: quote.asOf
        }
      : { ...empty, unit, type };
  });

  return result;
}

export async function fetchCurrencyRates() {
  const quote = await getQuoteWithFallback(SYMBOLS.usdInr, { name: 'USD/INR' });
  return {
    usdInr: quote
      ? {
          rate: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          source: quote.source,
          asOf: quote.asOf,
          lastUpdated: quote.lastUpdated
        }
      : null
  };
}

export async function fetchMetalETFs() {
  const wanted = [
    [SYMBOLS.goldETF, 'GLD', 'SPDR Gold Shares'],
    [SYMBOLS.silverETF, 'SLV', 'iShares Silver Trust']
  ];

  const quotes = await Promise.all(wanted.map(([symbol, , name]) => getQuoteWithFallback(symbol, { name })));
  return {
    goldETF: toETF(quotes[0], 'GLD', 'SPDR Gold Shares'),
    silverETF: toETF(quotes[1], 'SLV', 'iShares Silver Trust')
  };
}

function toETF(quote, symbol, name) {
  if (!quote) return null;
  return {
    symbol,
    name,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    currency: quote.currency,
    source: quote.source,
    asOf: quote.asOf
  };
}

export async function fetchIndianETFs() {
  const wanted = [
    [SYMBOLS.goldETFIndia, 'GOLDBEES.NS', 'Nippon India Gold BeES'],
    [SYMBOLS.silverETFIndia, 'SILVERBEES.NS', 'Nippon India Silver BeES'],
    [SYMBOLS.tataSilverETF, 'TATSILV.NS', 'Tata Silver ETF'],
    [SYMBOLS.tataGoldETF, 'TATAGOLD.NS', 'Tata Gold ETF']
  ];

  const quotes = await Promise.all(wanted.map(([symbol, , name]) => getQuoteWithFallback(symbol, { name })));

  return {
    goldETFIndia: toETF(quotes[0], 'GOLDBEES.NS', 'Nippon India Gold BeES'),
    silverETFIndia: toETF(quotes[1], 'SILVERBEES.NS', 'Nippon India Silver BeES'),
    tataSilverETF: toETF(quotes[2], 'TATSILV.NS', 'Tata Silver ETF'),
    tataGoldETF: toETF(quotes[3], 'TATAGOLD.NS', 'Tata Gold ETF')
  };
}

/**
 * Real daily history. The old implementation invented a random walk whenever
 * Yahoo was unreachable, which is how the UI ended up quoting prices that never
 * existed. Now an unavailable series is simply an empty one.
 */
export async function fetchHistoricalData(symbol, range = '1mo', interval = '1d') {
  await loadSnapshot();

  const snapshotRows = getHistory(symbol);
  if (snapshotRows.length > 0) return sliceToRange(snapshotRows, range, interval);

  const result = await fetchYahooData(symbol, range, interval);
  if (!result?.indicators) return [];

  const timestamps = result.timestamp || [];
  const quotes = result.indicators.quote?.[0] || {};

  const rows = timestamps
    .map((time, i) => ({
      date: new Date(time * 1000),
      open: quotes.open?.[i],
      high: quotes.high?.[i],
      low: quotes.low?.[i],
      close: quotes.close?.[i],
      volume: quotes.volume?.[i]
    }))
    .filter(row => Number.isFinite(row.close));

  return rows.length > 0 ? rows : [];
}

/**
 * The snapshot stores one long daily series per symbol; chart timeframes ask
 * for different ranges, so trim to match rather than refetching.
 */
function sliceToRange(rows, range, interval) {
  const counts = {
    '5d': 5,
    '1d': 1,
    '1mo': 22,
    '3mo': 66,
    '6mo': 130,
    '1y': 252,
    '2y': 504,
    '3y': 756,
    '5y': rows.length,
    max: rows.length
  };

  if (/^\d+(d|wk|mo|y)$/.test(range)) {
    const match = range.match(/^(\d+)(d|wk|mo|y)$/);
    const amount = Number(match[1]);
    const unitDays = { d: 1, wk: 7, mo: 30, y: 365 }[match[2]];
    return rows.slice(-Math.min(rows.length, Math.round(amount * unitDays)));
  }

  const wanted = counts[range] ?? counts['1mo'];

  // Sub-daily intervals need finer bars than the daily snapshot provides;
  // return the tail we do have rather than pretending to be intraday.
  if (/m$/.test(interval) && wanted <= 5) return rows.slice(-Math.min(rows.length, 5));

  return rows.slice(-Math.min(rows.length, wanted));
}
