import { fetchResilient } from '../utils/fetchResilient';

const GROWW_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ? '/groww' : 'https://www.groww.in';

const ETF_PAGES = {
  'gold-etf': { path: '/etfs/nippon-india-gold-bes', name: 'Gold ETF', symbol: 'GOLDBEES' },
  'tata-silver-etf': { path: '/etfs/tata-silver-exchange-traded-fund', name: 'Tata Silver ETF', symbol: 'TATSILV' }
};

export async function fetchMarketDepth(etfType) {
  const config = ETF_PAGES[etfType];
  if (!config) return null;

  try {
    const response = await fetchResilient(`${GROWW_BASE}${config.path}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    const jsonPattern = /\{"close"[^}]*"cumulativeBuyQty":\d+[^}]*"cumulativeSellQty":\d+[^}]*\}/g;
    const matches = html.match(jsonPattern) || [];

    for (const match of matches) {
      try {
        const data = JSON.parse(match);
        const buy = data.cumulativeBuyQty || 0;
        const sell = data.cumulativeSellQty || 0;
        const total = buy + sell;

        if (total > 0) {
          const buyPct = (buy / total) * 100;
          const sellPct = (sell / total) * 100;
          const ratio = sell > 0 ? buy / sell : buy > 0 ? Infinity : 0;

          let sentiment;
          if (ratio > 1.2) sentiment = 'strong-buyers';
          else if (ratio > 1.05) sentiment = 'buyers';
          else if (ratio > 0.95) sentiment = 'neutral';
          else if (ratio > 0.8) sentiment = 'sellers';
          else sentiment = 'strong-sellers';

          return {
            symbol: config.symbol,
            name: config.name,
            buyers: buy,
            sellers: sell,
            total,
            buyPct: parseFloat(buyPct.toFixed(1)),
            sellPct: parseFloat(sellPct.toFixed(1)),
            ratio: parseFloat(ratio.toFixed(2)),
            sentiment,
            price: data.close,
            dayChange: data.dayChange,
            dayChangePerc: data.dayChangePerc,
            lastUpdated: new Date().toISOString()
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch market depth for ${etfType}:`, error);
    return null;
  }
}

export async function fetchAllMarketDepth() {
  const [gold, tataSilver] = await Promise.allSettled([
    fetchMarketDepth('gold-etf'),
    fetchMarketDepth('tata-silver-etf')
  ]);
  return {
    gold: gold.status === 'fulfilled' ? gold.value : null,
    tataSilver: tataSilver.status === 'fulfilled' ? tataSilver.value : null
  };
}
