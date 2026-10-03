/**
 * Builds public/prices.json — a server-side market data snapshot.
 *
 * Why this exists: the site is a static GitHub Pages bundle, and neither Yahoo
 * Finance nor Groww send CORS headers, so the browser cannot fetch them
 * directly. Every public CORS relay we previously relied on is dead
 * (allorigins 522, codetabs 522, corsproxy.io 401), which used to leave the
 * UI rendering fabricated prices. This script runs in CI where there is no
 * CORS restriction and bakes the real numbers into the build.
 *
 * Usage: node scripts/fetchPrices.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'public/prices.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

/** Quotes are cheap and needed for every tile/ticker. */
const QUOTE_SYMBOLS = [
  'TATSILV.NS',
  'TATAGOLD.NS',
  'GOLDBEES.NS',
  'SILVERBEES.NS',
  'GLD',
  'SLV',
  'GC=F',
  'SI=F',
  'CL=F',
  'BZ=F',
  'USDINR=X',
  '^NSEI',
  '^BSESN',
  '^NSEBANK',
  '^CNXIT',
  '^CNXPHARMA'
];

/**
 * Daily history is much heavier, so it is limited to what actually drives
 * charts and the forecasting model.
 */
const HISTORY_SYMBOLS = {
  'TATSILV.NS': { range: '5y', interval: '1d' },
  'TATAGOLD.NS': { range: '5y', interval: '1d' },
  'SI=F': { range: '5y', interval: '1d' },
  'GC=F': { range: '5y', interval: '1d' },
  'USDINR=X': { range: '5y', interval: '1d' }
};

const round = (value, digits = 4) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJSON(path, { attempts = 4 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    const url = `https://${host}${path}`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000)
      });

      if (response.status === 429) {
        lastError = new Error(`${host} rate limited (429)`);
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        lastError = new Error(`${host} HTTP ${response.status}`);
        await sleep(800 * (attempt + 1));
        continue;
      }

      const payload = await response.json();
      if (payload?.chart?.error) {
        lastError = new Error(`${host} ${payload.chart.error.code}: ${payload.chart.error.description}`);
        continue;
      }
      return payload?.chart?.result?.[0] || null;
    } catch (error) {
      lastError = error;
      await sleep(800 * (attempt + 1));
    }
  }

  throw lastError || new Error(`failed to fetch ${path}`);
}

/**
 * Yahoo's `chartPreviousClose` is the close *before the requested range*, so on
 * a 1mo/5y request it is a month old and must never be used as "yesterday's
 * close". `previousClose` is absent on the chart endpoint, so we derive the
 * real prior close from the daily series and only fall back to
 * `chartPreviousClose` for intraday ranges where it is genuinely the prior day.
 */
function resolvePrevClose(result, { interval }) {
  const meta = result.meta || {};
  const isIntraday = /m$/.test(interval || '');

  if (Number.isFinite(meta.previousClose)) return meta.previousClose;
  if (isIntraday && Number.isFinite(meta.chartPreviousClose)) return meta.chartPreviousClose;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const usable = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (Number.isFinite(closes[i])) usable.push(closes[i]);
  }
  if (usable.length >= 2) return usable[usable.length - 2];
  if (usable.length === 1) return usable[0];
  return meta.chartPreviousClose ?? null;
}

function buildQuote(result, { range, interval }) {
  const meta = result.meta || {};
  const price = Number.isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : null;
  if (price == null) return null;

  const prevClose = resolvePrevClose(result, { range, interval });
  const change = prevClose != null ? price - prevClose : null;

  return {
    symbol: meta.symbol,
    name: meta.longName || meta.shortName || meta.symbol,
    price: round(price, 4),
    prevClose: round(prevClose, 4),
    change: round(change, 4),
    changePercent: round(change != null && prevClose ? (change / prevClose) * 100 : null, 3),
    dayHigh: round(meta.regularMarketDayHigh, 4),
    dayLow: round(meta.regularMarketDayLow, 4),
    open: round(meta.regularMarketOpen ?? meta.chartPreviousClose, 4),
    volume: Number.isFinite(meta.regularMarketVolume) ? meta.regularMarketVolume : null,
    fiftyTwoWeekHigh: round(meta.fiftyTwoWeekHigh, 4),
    fiftyTwoWeekLow: round(meta.fiftyTwoWeekLow, 4),
    currency: meta.currency || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    marketTime: Number.isFinite(meta.regularMarketTime) ? meta.regularMarketTime * 1000 : null
  };
}

/**
 * Column-oriented history. Rows with a null close (holidays, halted days) are
 * dropped so every column stays index-aligned.
 */
function buildHistory(result) {
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjclose = result.indicators?.adjclose?.[0]?.adjclose;

  const dates = [];
  const open = [];
  const high = [];
  const low = [];
  const close = [];
  const volume = [];

  for (let i = 0; i < timestamps.length; i++) {
    const c = quote.close?.[i];
    if (!Number.isFinite(c)) continue;

    const o = Number.isFinite(quote.open?.[i]) ? quote.open[i] : c;
    const h = Number.isFinite(quote.high?.[i]) ? quote.high[i] : c;
    const l = Number.isFinite(quote.low?.[i]) ? quote.low[i] : c;

    dates.push(timestamps[i] * 1000);
    open.push(round(o, 4));
    high.push(round(h, 4));
    low.push(round(l, 4));
    close.push(round(Number.isFinite(adjclose?.[i]) ? adjclose[i] : c, 4));
    volume.push(Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : null);
  }

  return { dates, open, high, low, close, volume };
}

async function collect() {
  const quotes = {};
  const history = {};
  const errors = {};

  for (const symbol of QUOTE_SYMBOLS) {
    try {
      const result = await getJSON(
        `/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`
      );
      const quote = result ? buildQuote(result, { range: '1d', interval: '5m' }) : null;
      if (quote) quotes[symbol] = quote;
      else errors[symbol] = 'no quote returned';
    } catch (error) {
      errors[symbol] = error.message;
    }
    await sleep(250);
  }

  for (const [symbol, config] of Object.entries(HISTORY_SYMBOLS)) {
    try {
      const result = await getJSON(
        `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${config.range}&interval=${config.interval}`
      );
      if (!result) {
        errors[`${symbol}:history`] = 'no history returned';
        continue;
      }
      const series = buildHistory(result);
      if (series.close.length > 0) {
        history[symbol] = {
          range: config.range,
          interval: config.interval,
          currency: result.meta?.currency || null,
          ...series
        };
      } else {
        errors[`${symbol}:history`] = 'history empty';
      }
    } catch (error) {
      errors[`${symbol}:history`] = error.message;
    }
    await sleep(250);
  }

  return { quotes, history, errors };
}

async function main() {
  const startedAt = Date.now();
  const { quotes, history, errors } = await collect();

  const snapshot = {
    generatedAt: new Date().toISOString(),
    provider: 'Yahoo Finance',
    quoteCount: Object.keys(quotes).length,
    historyCount: Object.keys(history).length,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
    quotes,
    history
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`, 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(snapshot));
  console.log(
    `prices.json written in ${Date.now() - startedAt}ms — ` +
      `${snapshot.quoteCount}/${QUOTE_SYMBOLS.length} quotes, ` +
      `${snapshot.historyCount}/${Object.keys(HISTORY_SYMBOLS).length} histories, ` +
      `${(bytes / 1024).toFixed(1)} KiB`
  );

  for (const [symbol, message] of Object.entries(errors)) {
    console.warn(`  ! ${symbol}: ${message}`);
  }

  const critical = ['TATSILV.NS', 'TATAGOLD.NS'];
  const missingCritical = critical.filter(symbol => !quotes[symbol]);
  if (missingCritical.length > 0) {
    console.error(`Missing critical quotes: ${missingCritical.join(', ')}`);
    process.exit(1);
  }

  const silver = quotes['TATSILV.NS'];
  console.log(`  TATSILV.NS ₹${silver.price} (prev ₹${silver.prevClose})`);
  console.log(`  TATAGOLD.NS ₹${quotes['TATAGOLD.NS'].price}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
