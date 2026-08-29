const NEWS_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEWS_API_KEY) || '';
const NEWS_API_BASE = 'https://newsapi.org/v2';

const MARKET_KEYWORDS = {
  strongPositive: [
    'rate cut', 'dovish', 'stimulus', 'easing', 'infrastructure',
    'beat expectations', 'FII inflow', 'rupee strength', 'India GDP',
    'PMI above', 'manufacturing growth', 'ceasefire', 'peace deal'
  ],
  positive: [
    'bullish', 'rally', 'surge', 'gain', 'boost', 'growth', 'boom',
    'recovery', 'strong', 'inflow', 'upgrade', 'cooperation', 'agreement',
    'record high', 'outperform', 'buyback', 'dividend'
  ],
  mildPositive: [
    'stable', 'steady', 'support', 'resilient', 'improve', 'recover',
    'hold steady', 'maintain', 'unchanged'
  ],
  mildNegative: [
    'cautious', 'uncertain', 'volatile', 'mixed', 'tepid', 'sluggish',
    'tepid', 'uneasy', 'wait and see'
  ],
  negative: [
    'bearish', 'decline', 'fall', 'drop', 'slip', 'weak', 'outflow',
    'downgrade', 'sell', 'pressure', 'headwind', 'slowdown'
  ],
  strongNegative: [
    'crash', 'plunge', 'slump', 'recession', 'war', 'sanctions',
    'tariff', 'tension', 'crisis', 'default', 'escalation',
    'disruption', 'geopolitical', 'trade war', 'capital flight'
  ],
  goldPositive: [
    'safe haven', 'gold', 'uncertainty', 'fear', 'inflation',
    'rate cut', 'dovish', 'central bank buying', 'geopolitical',
    'recession', 'crisis', 'currency weakness', 'debt', 'sovereign'
  ],
  goldNegative: [
    'risk on', 'equity rally', 'rate hike', 'hawkish',
    'strong dollar', 'bond yield rise', 'economic growth'
  ],
  silverPositive: [
    'solar', 'EV', 'industrial demand', 'manufacturing growth',
    'green energy', 'China recovery', 'PMI rise', 'commodity demand'
  ],
  silverNegative: [
    'China slowdown', 'manufacturing decline', 'industrial weakness',
    'PMI fall', 'commodity sell', 'demand destruction', 'USD strength',
    'dollar rally', 'risk off', 'recession fear', 'factory shutdown',
    'silver decline', 'metal drop', 'industrial output fall'
  ]
};

const CATEGORIES = {
  'fed': ['federal reserve', 'fed rate', 'fomc', 'powell', 'interest rate', 'monetary policy'],
  'rbi': ['rbi', 'repo rate', 'reserve bank of india', 'monetary policy committee', 'mpc'],
  'geopolitical': ['war', 'conflict', 'sanctions', 'nato', 'military', 'missile', 'attack', 'tension', 'strait of hormuz', 'iran'],
  'commodity': ['crude oil', 'gold', 'silver', 'copper', 'commodity', 'opec', 'brent'],
  'currency': ['dollar', 'dxy', 'forex', 'currency', 'rupee', 'yen', 'euro', 'exchange rate'],
  'economic-data': ['gdp', 'pmi', 'cpi', 'inflation', 'jobs', 'unemployment', 'nfp', 'payroll', 'retail sales'],
  'china': ['china', 'chinese', 'beijing', 'yuan', 'pboc', 'huawei'],
  'trade': ['tariff', 'trade war', 'trade deal', 'export', 'import', 'supply chain']
};

function categorizeNews(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }
  return 'general';
}

function analyzeSentiment(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;

  MARKET_KEYWORDS.strongPositive.forEach(kw => { if (text.includes(kw)) score += 3; });
  MARKET_KEYWORDS.positive.forEach(kw => { if (text.includes(kw)) score += 2; });
  MARKET_KEYWORDS.mildPositive.forEach(kw => { if (text.includes(kw)) score += 1; });
  MARKET_KEYWORDS.mildNegative.forEach(kw => { if (text.includes(kw)) score -= 1; });
  MARKET_KEYWORDS.negative.forEach(kw => { if (text.includes(kw)) score -= 2; });
  MARKET_KEYWORDS.strongNegative.forEach(kw => { if (text.includes(kw)) score -= 3; });

  // Context adjustments
  if (text.includes('crude oil') && text.includes('rise')) score -= 1;
  if (text.includes('crude oil') && text.includes('surge')) score -= 2;
  if (text.includes('geopolitical') && text.includes('tension')) score -= 1;
  if (text.includes('fii') && text.includes('buy')) score += 2;
  if (text.includes('fii') && text.includes('sell')) score -= 2;

  // More conservative magnitude scaling
  if (score > 4) return { direction: 'positive', magnitude: Math.min(65, 35 + score * 3) };
  if (score > 1) return { direction: 'positive', magnitude: Math.min(50, 25 + score * 4) };
  if (score < -4) return { direction: 'negative', magnitude: Math.min(65, 35 + Math.abs(score) * 3) };
  if (score < -1) return { direction: 'negative', magnitude: Math.min(50, 25 + Math.abs(score) * 4) };
  return { direction: 'mixed', magnitude: Math.min(35, 15 + Math.abs(score) * 3) };
}

function analyzeMetalImpact(title, description, metal) {
  const text = `${title} ${description}`.toLowerCase();
  const keywords = metal === 'gold'
    ? { pos: MARKET_KEYWORDS.goldPositive, neg: MARKET_KEYWORDS.goldNegative }
    : { pos: MARKET_KEYWORDS.silverPositive, neg: MARKET_KEYWORDS.silverNegative };

  let score = 0;
  let posCount = 0;
  let negCount = 0;
  keywords.pos.forEach(kw => { if (text.includes(kw)) { score += 2; posCount++; } });
  keywords.neg.forEach(kw => { if (text.includes(kw)) { score -= 2; negCount++; } });

  const totalMatches = posCount + negCount;
  const netBias = totalMatches > 0 ? (posCount - negCount) / totalMatches : 0;

  if (score > 4 && netBias > 0.3) return { direction: 'positive', magnitude: Math.min(55, 30 + score * 3) };
  if (score < -4 && netBias < -0.3) return { direction: 'negative', magnitude: Math.min(55, 30 + Math.abs(score) * 3) };
  if (score > 2) return { direction: 'positive', magnitude: Math.min(40, 20 + score * 3) };
  if (score < -2) return { direction: 'negative', magnitude: Math.min(40, 20 + Math.abs(score) * 3) };
  return { direction: 'neutral', magnitude: 15 };
}

function getSeverity(score) {
  if (Math.abs(score) > 50) return 'high';
  if (Math.abs(score) > 30) return 'medium';
  return 'low';
}

function predictIndexImpact(sentiment, category, title) {
  const text = (title || '').toLowerCase();

  // Crude oil specific logic
  if (text.includes('crude oil') || text.includes('brent') || text.includes('oil price')) {
    if (sentiment.direction === 'negative') {
      return {
        'NIFTY 50': { impact: '-0.3% to -0.5%', direction: 'down' },
        'SENSEX': { impact: '-0.4% to -0.6%', direction: 'down' },
        'BANK NIFTY': { impact: '-0.3% to -0.5%', direction: 'down' },
        'NIFTY IT': { impact: '-0.5% to -1.0%', direction: 'down' },
        'NIFTY PHARMA': { impact: '+0.2% to +0.5%', direction: 'up' },
        'NIFTY AVIATION': { impact: '-0.8% to -1.5%', direction: 'down' }
      };
    }
  }

  // Geopolitical tensions (war, conflict)
  if (text.includes('war') || text.includes('conflict') || text.includes('geopolitical')) {
    if (sentiment.direction === 'negative') {
      return {
        'NIFTY 50': { impact: '-0.2% to -0.5%', direction: 'down' },
        'SENSEX': { impact: '-0.3% to -0.5%', direction: 'down' },
        'INDIA VIX': { impact: '+3% to +8%', direction: 'up' },
        'NIFTY DEFENCE': { impact: '+0.5% to +1.5%', direction: 'up' },
        'NIFTY PHARMA': { impact: '+0.2% to +0.5%', direction: 'up' }
      };
    }
  }

  // Fed rate related
  if (category === 'fed') {
    if (sentiment.direction === 'positive') {
      return {
        'NIFTY 50': { impact: '+0.3% to +0.6%', direction: 'up' },
        'SENSEX': { impact: '+0.25% to +0.5%', direction: 'up' },
        'BANK NIFTY': { impact: '+0.5% to +0.8%', direction: 'up' },
        'NIFTY IT': { impact: '+0.6% to +1.0%', direction: 'up' }
      };
    }
  }

  // Default conservative estimates
  const impacts = {
    positive: {
      'NIFTY 50': { impact: '+0.2% to +0.5%', direction: 'up' },
      'SENSEX': { impact: '+0.15% to +0.4%', direction: 'up' },
      'BANK NIFTY': category === 'rbi' || category === 'fed'
        ? { impact: '+0.4% to +0.7%', direction: 'up' }
        : { impact: '+0.15% to +0.4%', direction: 'up' },
    },
    negative: {
      'NIFTY 50': { impact: '-0.2% to -0.5%', direction: 'down' },
      'SENSEX': { impact: '-0.25% to -0.5%', direction: 'down' },
      'INDIA VIX': { impact: '+2% to +5%', direction: 'up' },
    },
    mixed: {
      'NIFTY 50': { impact: '-0.1% to +0.15%', direction: 'neutral' },
    }
  };
  return impacts[sentiment.direction] || impacts.mixed;
}

export async function fetchGlobalNews(page = 1, pageSize = 20) {
  try {
    const queries = [
      'gold price today',
      'silver price today',
      'Federal Reserve interest rate',
      'geopolitical tension market',
      'safe haven assets gold silver',
      'US dollar index DXY'
    ];

    const allArticles = [];

    for (const query of queries.slice(0, 3)) {
      const url = `${NEWS_API_BASE}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${Math.ceil(pageSize / 3)}&page=${page}&apiKey=${NEWS_API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      if (data.articles) {
        allArticles.push(...data.articles);
      }
    }

    const uniqueArticles = allArticles
      .filter((article, index, self) =>
        index === self.findIndex(a => a.title === article.title)
      )
      .slice(0, pageSize);

    return uniqueArticles.map(article => processArticle(article));
  } catch (error) {
    console.error('NewsAPI fetch failed:', error);
    return [];
  }
}

function processArticle(article) {
  const category = categorizeNews(article.title, article.description || '');
  const sentiment = analyzeSentiment(article.title, article.description || '');
  const goldImpact = analyzeMetalImpact(article.title, article.description || '', 'gold');
  const silverImpact = analyzeMetalImpact(article.title, article.description || '', 'silver');
  const indexImpact = predictIndexImpact(sentiment, category, article.title);

  return {
    id: article.url,
    title: article.title,
    description: article.description,
    source: article.source?.name || 'Unknown',
    url: article.url,
    publishedAt: article.publishedAt,
    urlToImage: article.urlToImage,
    category,
    sentiment,
    severity: getSeverity(sentiment.magnitude),
    impact: {
      direction: sentiment.direction,
      magnitude: sentiment.magnitude,
      affectedIndices: Object.entries(indexImpact).map(([name, data]) => ({
        name,
        ...data
      })),
      goldETF: goldImpact,
      silverETF: silverImpact,
      description: generateImpactDescription(sentiment, category, article.title)
    }
  };
}

function generateImpactDescription(sentiment, category, title) {
  const text = (title || '').toLowerCase();

  if (text.includes('crude oil') || text.includes('brent') || text.includes('oil price')) {
    return 'Crude oil price movements directly impact India\'s import bill ($120B+ annually). Higher oil widens trade deficit, pressures INR, and raises inflation. Aviation, OMCs, and FMCG face margin pressure. Pharma and IT may show defensive rotation.';
  }

  if (text.includes('geopolitical') || text.includes('war') || text.includes('conflict')) {
    return 'Geopolitical tensions trigger risk-off sentiment. FII may reduce exposure temporarily. Defensive sectors (Pharma, Gold, Defence) tend to outperform. VIX rises. Impact is usually short-lived unless actual supply disruption occurs.';
  }

  const descs = {
    positive: {
      fed: 'Dovish Fed signals boost Indian markets. Rate-sensitive sectors (Banking, IT, Real Estate) benefit. FII inflows expected. Typical impact: NIFTY +0.3-0.6%.',
      geopolitical: 'Positive geopolitical development reduces risk premium. Market sentiment improves. Typical impact: NIFTY +0.1-0.3%.',
      commodity: 'Favorable commodity price movement supports Indian manufacturing. Typical impact: NIFTY +0.1-0.2%.',
      default: 'Positive global development supports Indian market sentiment. Risk-on mood expected. Typical impact: NIFTY +0.1-0.3%.'
    },
    negative: {
      fed: 'Hawkish Fed stance pressures Indian markets. Higher US rates may trigger FII outflows. USD strength weighs on INR. Typical impact: NIFTY -0.2-0.5%.',
      geopolitical: 'Geopolitical tensions increase risk aversion. Defensive sectors (Pharma, Gold) may outperform. Impact depends on actual disruption vs. threat. Typical impact: NIFTY -0.2-0.5%.',
      commodity: 'Rising commodity prices increase input costs. Impact is gradual, not immediate. Typical impact: NIFTY -0.1-0.3%.',
      default: 'Negative global development pressures Indian market sentiment. Defensive positioning recommended. Typical impact: NIFTY -0.2-0.4%.'
    },
    mixed: {
      default: 'Mixed signals from global markets. Sector-specific movements expected rather than broad directional move. Typical impact: NIFTY ±0.1-0.2%.'
    }
  };

  return descs[sentiment.direction]?.[category] || descs[sentiment.direction]?.default || descs.mixed.default;
}

export function isNewsAPIConfigured() {
  return NEWS_API_KEY && NEWS_API_KEY !== 'YOUR_NEWSAPI_KEY';
}
