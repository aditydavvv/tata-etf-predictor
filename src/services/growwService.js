import { fetchResilient } from '../utils/fetchResilient';

const GROWW_URL = 'https://groww.in';

const ETF_PAGES = {
  'gold-etf': { path: '/etfs/nippon-india-gold-bes', name: 'Gold ETF', fullName: 'Nippon India Gold BeES', symbol: 'GOLDBEES' },
  'tata-gold-etf': { path: '/etfs/tata-gold-exchange-traded-fund', name: 'Tata Gold ETF', fullName: 'Tata Gold Exchange Traded Fund', symbol: 'TATAGOLD' },
  'tata-silver-etf': { path: '/etfs/tata-silver-exchange-traded-fund', name: 'Tata Silver ETF', fullName: 'Tata Silver Exchange Traded Fund', symbol: 'TATSILV' }
};

function parsePriceFromText(text) {
  const priceMatch = text.match(/₹([\d,.]+)\s*[-+]?([\d,.]+)\s*\(([-\d,.]+)%\)/);
  if (priceMatch) {
    return {
      price: parseFloat(priceMatch[1].replace(/,/g, '')),
      change: parseFloat(priceMatch[2].replace(/,/g, '')),
      changePercent: parseFloat(priceMatch[3].replace(/,/g, ''))
    };
  }
  const simplePrice = text.match(/₹([\d,.]+)/);
  if (simplePrice) {
    return {
      price: parseFloat(simplePrice[1].replace(/,/g, '')),
      change: 0,
      changePercent: 0
    };
  }
  return null;
}

function extractMetric(text, label) {
  const patterns = [
    new RegExp(label + '[\\s:]*([\\d,.]+[CrMK%]*)', 'i'),
    new RegExp(label + '[\\s]*([\\d,.]+)', 'i')
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchGrowwETFData(etfType) {
  const config = ETF_PAGES[etfType];
  if (!config) return null;

  try {
    const url = import.meta.env.DEV
      ? `/groww${config.path}`
      : `${GROWW_URL}${config.path}`;
    const response = await fetchResilient(url);
    const html = await response.text();

    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    const priceData = parsePriceFromText(text);
    if (!priceData) return null;

    const low = extractMetric(text, "Today's low");
    const high = extractMetric(text, "Today's high");
    const open = extractMetric(text, 'Open price');
    const prevClose = extractMetric(text, 'Previous close');
    const volume = extractMetric(text, 'Live volume');
    const nav = extractMetric(text, 'NAV');
    const week52Low = extractMetric(text, '52 week low');
    const week52High = extractMetric(text, '52 week high');
    const expenseRatio = extractMetric(text, 'Expense ratio');
    const aum = extractMetric(text, 'AUM');

    return {
      symbol: config.symbol,
      name: config.name,
      fullName: config.fullName,
      price: priceData.price,
      change: priceData.change,
      changePercent: priceData.changePercent,
      dayLow: low ? parseFloat(low.replace(/,/g, '')) : null,
      dayHigh: high ? parseFloat(high.replace(/,/g, '')) : null,
      open: open ? parseFloat(open.replace(/,/g, '')) : null,
      prevClose: prevClose ? parseFloat(prevClose.replace(/,/g, '')) : null,
      volume: volume || null,
      nav: nav ? parseFloat(nav.replace(/,/g, '')) : null,
      week52Low: week52Low ? parseFloat(week52Low.replace(/,/g, '')) : null,
      week52High: week52High ? parseFloat(week52High.replace(/,/g, '')) : null,
      expenseRatio: expenseRatio || null,
      aum: aum || null,
      currency: 'INR',
      source: 'Groww',
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to fetch Groww data for ${etfType}:`, error);
    return null;
  }
}

export async function fetchAllGrowwETFs() {
  const [goldETF, tataSilver] = await Promise.allSettled([
    fetchGrowwETFData('gold-etf'),
    fetchGrowwETFData('tata-silver-etf')
  ]);
  return {
    goldETF: goldETF.status === 'fulfilled' ? goldETF.value : null,
    tataSilverETF: tataSilver.status === 'fulfilled' ? tataSilver.value : null
  };
}
