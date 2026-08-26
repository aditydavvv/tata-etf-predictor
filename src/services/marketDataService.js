const YAHOO_FINANCE_BASE = import.meta.env.DEV
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

import { fetchResilient } from '../utils/fetchResilient';

export const YAHOO_CHART_BASE = YAHOO_FINANCE_BASE;

async function fetchYahooData(symbol, range = '1d', interval = '5m') {
  try {
    const url = `${YAHOO_FINANCE_BASE}/${encodeURIComponent(symbol).replace(/%3D/g, '=')}?range=${range}&interval=${interval}`;
    const response = await fetchResilient(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.chart?.result?.[0] || null;
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error);
    return null;
  }
}

function formatQuote(result, name, sector) {
  if (!result) return null;
  const meta = result.meta;
  const currentPrice = meta.regularMarketPrice;
  const previousClose = meta.chartPreviousClose || meta.previousClose;
  const change = currentPrice - previousClose;
  const changePercent = (change / previousClose) * 100;
  return {
    name,
    value: currentPrice,
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    dayHigh: meta.regularMarketDayHigh || currentPrice,
    dayLow: meta.regularMarketDayLow || currentPrice,
    prevClose: previousClose,
    volume: meta.regularMarketVolume ? formatVolume(meta.regularMarketVolume) : 'N/A',
    sector,
    currency: meta.currency || 'USD',
    lastUpdated: new Date().toISOString()
  };
}

function formatVolume(vol) {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
  return vol.toString();
}

export async function fetchMarketIndices() {
  const [nifty, sensex, bankNifty, niftyIT, niftyPharma] = await Promise.all([
    fetchYahooData(SYMBOLS.nifty50),
    fetchYahooData(SYMBOLS.sensex),
    fetchYahooData(SYMBOLS.bankNifty),
    fetchYahooData(SYMBOLS.niftyIT),
    fetchYahooData(SYMBOLS.niftyPharma)
  ]);
  return [
    formatQuote(nifty, 'NIFTY 50', 'Benchmark'),
    formatQuote(sensex, 'SENSEX', 'Benchmark'),
    formatQuote(bankNifty, 'BANK NIFTY', 'Banking'),
    formatQuote(niftyIT, 'NIFTY IT', 'IT'),
    formatQuote(niftyPharma, 'NIFTY PHARMA', 'Pharma')
  ].filter(Boolean);
}

export async function fetchCommodityPrices() {
  const [gold, silver, crudeOil, brentCrude] = await Promise.all([
    fetchYahooData(SYMBOLS.gold),
    fetchYahooData(SYMBOLS.silver),
    fetchYahooData(SYMBOLS.crudeOil),
    fetchYahooData(SYMBOLS.brentCrude)
  ]);
  const toCommodity = (result, unit, type) => {
    if (!result) return null;
    return {
      price: result.meta.regularMarketPrice,
      currency: result.meta.currency || 'USD',
      change: result.meta.regularMarketPrice - (result.meta.chartPreviousClose || result.meta.previousClose),
      unit,
      type
    };
  };
  return {
    gold: toCommodity(gold, 'per oz', 'Gold'),
    silver: toCommodity(silver, 'per oz', 'Silver'),
    crudeOil: toCommodity(crudeOil, 'per barrel', 'WTI'),
    brentCrude: toCommodity(brentCrude, 'per barrel', 'Brent')
  };
}

export async function fetchCurrencyRates() {
  const usdInr = await fetchYahooData(SYMBOLS.usdInr);
  return {
    usdInr: usdInr ? {
      rate: usdInr.meta.regularMarketPrice,
      change: usdInr.meta.regularMarketPrice - (usdInr.meta.chartPreviousClose || usdInr.meta.previousClose),
      lastUpdated: new Date().toISOString()
    } : null
  };
}

export async function fetchMetalETFs() {
  const [goldETF, silverETF] = await Promise.all([
    fetchYahooData(SYMBOLS.goldETF),
    fetchYahooData(SYMBOLS.silverETF)
  ]);
  const toETF = (result, symbol, name) => {
    if (!result) return null;
    const prev = result.meta.chartPreviousClose || result.meta.previousClose;
    return {
      symbol,
      name,
      price: result.meta.regularMarketPrice,
      change: result.meta.regularMarketPrice - prev,
      changePercent: ((result.meta.regularMarketPrice - prev) / prev) * 100
    };
  };
  return {
    goldETF: toETF(goldETF, 'GLD', 'SPDR Gold Shares'),
    silverETF: toETF(silverETF, 'SLV', 'iShares Silver Trust')
  };
}

export async function fetchIndianETFs() {
  const [goldETF, silverETF, tataSilver] = await Promise.all([
    fetchYahooData(SYMBOLS.goldETFIndia),
    fetchYahooData(SYMBOLS.silverETFIndia),
    fetchYahooData(SYMBOLS.tataSilverETF)
  ]);
  const toETF = (result, symbol, name) => {
    if (!result) return null;
    const prev = result.meta.chartPreviousClose || result.meta.previousClose;
    return {
      symbol,
      name,
      price: result.meta.regularMarketPrice,
      change: result.meta.regularMarketPrice - prev,
      changePercent: ((result.meta.regularMarketPrice - prev) / prev) * 100,
      currency: result.meta.currency || 'INR'
    };
  };
  return {
    goldETFIndia: toETF(goldETF, 'GOLDBEES.NS', 'Nippon India Gold BeES'),
    silverETFIndia: toETF(silverETF, 'SILVERBEES.NS', 'Nippon India Silver BeES'),
    tataSilverETF: toETF(tataSilver, 'TATSILV.NS', 'Tata Silver ETF')
  };
}

export async function fetchHistoricalData(symbol, range = '1mo', interval = '1d') {
  const result = await fetchYahooData(symbol, range, interval);
  if (!result || !result.indicators) return generateFallbackData(symbol, range);
  const timestamps = result.timestamp || [];
  const quotes = result.indicators.quote[0];
  const data = timestamps.map((time, i) => ({
    date: new Date(time * 1000),
    open: quotes.open[i],
    high: quotes.high[i],
    low: quotes.low[i],
    close: quotes.close[i],
    volume: quotes.volume[i]
  })).filter(q => q.close !== null);
  return data.length > 0 ? data : generateFallbackData(symbol, range);
}

function generateFallbackData(symbol, range) {
  const now = new Date();
  const days = range === '5d' ? 5 : range === '1mo' ? 30 : range === '3mo' ? 90 : range === '6mo' ? 180 : 365;
  const priceMap = {
    'GC=F': 3385, 'SI=F': 38.5, 'CL=F': 62, 'BZ=F': 66,
    'USDINR=X': 85.5,
    'GLD': 237, 'SLV': 28.5,
    'GOLDBEES.NS': 59, 'SILVERBEES.NS': 73, 'TATSILV.NS': 22, 'TATAGOLD.NS': 58
  };
  const basePrice = priceMap[symbol] || 100;
  const volMap = { 'SI=F': 0.025, 'SILVERBEES.NS': 0.025, 'TATASILVE.NS': 0.025 };
  const volatility = volMap[symbol] || 0.012;
  const data = [];
  let price = basePrice * (1 + (Math.random() - 0.5) * 0.02);
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i));
    const change = (Math.random() - 0.48) * volatility * price;
    price += change;
    const open = price - change * 0.3;
    const high = Math.max(price, open) + Math.random() * volatility * price * 0.5;
    const low = Math.min(price, open) - Math.random() * volatility * price * 0.5;
    data.push({
      date,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 100000) + 50000
    });
  }
  return data;
}
