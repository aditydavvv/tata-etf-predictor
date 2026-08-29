export const metalETFs = {
  gold: {
    name: "Tata Gold ETF",
    symbol: "TATAGOLD",
    etfIndia: "Tata Gold Exchange Traded Fund (NSE: TATAGOLD)",
    currentPrice: 15.36,
    etfPrice: 15.36,
    bullionPrice: 155000,
    currency: "INR",
    unit: "per ETF unit",
    bullionUnit: "₹1,55,000 per 10g spot",
    historicalReactions: [
      {
        event: "Fed Rate Cut (Dovish Signal)",
        category: "monetary-policy",
        direction: "positive",
        magnitude: 85,
        avgReaction: "+3.2% in 1 week",
        description: "Lower rates reduce opportunity cost of holding gold. Historically gold rallies 3-5% within 2 weeks of dovish Fed signals.",
        pastInstances: [
          { date: "Sep 2024", reaction: "+4.1%", timeframe: "2 weeks" },
          { date: "Dec 2023", reaction: "+2.8%", timeframe: "1 week" },
          { date: "Mar 2023", reaction: "+3.5%", timeframe: "10 days" }
        ],
        pattern: "Gold consistently rallies on rate cut signals as USD weakens and real yields drop."
      },
      {
        event: "Geopolitical Tensions (Middle East / Wars)",
        category: "geopolitical",
        direction: "positive",
        magnitude: 90,
        avgReaction: "+4.5% in 2 weeks",
        description: "Safe-haven demand surges. Gold is the first asset class to benefit from flight-to-safety during global uncertainty.",
        pastInstances: [
          { date: "Oct 2023 (Israel-Hamas)", reaction: "+8.2%", timeframe: "3 weeks" },
          { date: "Feb 2022 (Russia-Ukraine)", reaction: "+6.5%", timeframe: "2 weeks" },
          { date: "Jan 2020 (US-Iran)", reaction: "+5.1%", timeframe: "1 week" }
        ],
        pattern: "Gold spikes immediately during conflict escalation, then consolidates. Silver follows with 2-3 day lag."
      },
      {
        event: "US Dollar Weakness (DXY Fall)",
        category: "currency",
        direction: "positive",
        magnitude: 75,
        avgReaction: "+2.8% in 1 week",
        description: "Gold is inversely correlated with USD. When DXY drops 1%+, gold typically gains 1.5-3%.",
        pastInstances: [
          { date: "Jul 2024", reaction: "+3.0%", timeframe: "1 week" },
          { date: "Nov 2023", reaction: "+2.5%", timeframe: "5 days" },
          { date: "Aug 2023", reaction: "+2.9%", timeframe: "1 week" }
        ],
        pattern: "Strong inverse correlation. Dollar weakness is the most reliable driver of gold rallies."
      },
      {
        event: "Central Bank Gold Buying",
        category: "monetary-policy",
        direction: "positive",
        magnitude: 70,
        avgReaction: "+2.0% in 2 weeks",
        description: "China, India, Turkey central banks buying gold signals de-dollarization trend, supporting long-term prices.",
        pastInstances: [
          { date: "Q1 2024", reaction: "+5.8%", timeframe: "3 months" },
          { date: "Q3 2023", reaction: "+4.2%", timeframe: "3 months" },
          { date: "Q1 2023", reaction: "+3.9%", timeframe: "2 months" }
        ],
        pattern: "Slow but steady upward pressure. Central bank buying creates a floor price for gold."
      },
      {
        event: "Recession Fears / GDP Slowdown",
        category: "economic-data",
        direction: "positive",
        magnitude: 80,
        avgReaction: "+3.8% in 2 weeks",
        description: "Recession fears drive investors to safe havens. Gold ETF inflows surge during economic uncertainty.",
        pastInstances: [
          { date: "Mar 2020 (COVID)", reaction: "+12.5%", timeframe: "1 month" },
          { date: "Jun 2022 (Recession fears)", reaction: "+4.1%", timeframe: "2 weeks" },
          { date: "Oct 2023 (Bank crisis fears)", reaction: "+3.2%", timeframe: "10 days" }
        ],
        pattern: "Gold is a recession hedge. Initial spike may be followed by profit booking, but trend remains bullish."
      },
      {
        event: "Strong US Jobs / Economic Data",
        category: "economic-data",
        direction: "negative",
        magnitude: 55,
        avgReaction: "-1.5% in 3 days",
        description: "Strong US economy delays rate cuts, strengthening USD and reducing gold's appeal.",
        pastInstances: [
          { date: "Jul 2024 (NFP beat)", reaction: "-2.1%", timeframe: "3 days" },
          { date: "Jan 2024 (CPI hot)", reaction: "-1.8%", timeframe: "2 days" },
          { date: "Sep 2023 (Jobs beat)", reaction: "-1.2%", timeframe: "3 days" }
        ],
        pattern: "Short-term pullback, usually recovers within a week if broader trend is bullish."
      },
      {
        event: "Rising Bond Yields",
        category: "monetary-policy",
        direction: "negative",
        magnitude: 60,
        avgReaction: "-2.0% in 1 week",
        description: "Higher real yields make non-yielding gold less attractive. 10Y yield above 4.5% pressures gold.",
        pastInstances: [
          { date: "Oct 2023 (10Y at 5%)", reaction: "-3.5%", timeframe: "2 weeks" },
          { date: "Jul 2023 (Yield spike)", reaction: "-2.2%", timeframe: "1 week" },
          { date: "Mar 2023 (Yield surge)", reaction: "-1.8%", timeframe: "5 days" }
        ],
        pattern: "Inversely correlated. Yields above 4.5% historically pressure gold, below 4% supports it."
      },
      {
        event: "Inflation Data (CPI above expectations)",
        category: "economic-data",
        direction: "positive",
        magnitude: 65,
        avgReaction: "+2.0% in 1 week",
        description: "Gold is a traditional inflation hedge. Higher-than-expected CPI drives gold buying as store of value.",
        pastInstances: [
          { date: "Jun 2024 (CPI 3.5%)", reaction: "+2.8%", timeframe: "1 week" },
          { date: "Jan 2024 (CPI hot)", reaction: "+1.5%", timeframe: "3 days" },
          { date: "Jul 2023 (CPI spike)", reaction: "+2.2%", timeframe: "5 days" }
        ],
        pattern: "Initial spike on high CPI, but sustained inflation that forces rate hikes can eventually weigh on gold."
      }
    ]
  },
  silver: {
    name: "Tata Silver ETF",
    symbol: "TATSILV",
    etfIndia: "Tata Silver Exchange Traded Fund (NSE: TATSILV)",
    currentPrice: 23.37,
    etfPrice: 23.37,
    bullionPrice: 230000,
    currency: "INR",
    unit: "per ETF unit",
    bullionUnit: "₹2,30,000 per 1kg spot",
    historicalReactions: [
      {
        event: "Fed Rate Cut (Dovish Signal)",
        category: "monetary-policy",
        direction: "positive",
        magnitude: 90,
        avgReaction: "+5.0% in 1 week",
        description: "Silver amplifies gold's move. As a hybrid metal (industrial + monetary), rate cuts boost both investment and industrial demand.",
        pastInstances: [
          { date: "Sep 2024", reaction: "+6.8%", timeframe: "2 weeks" },
          { date: "Dec 2023", reaction: "+5.2%", timeframe: "1 week" },
          { date: "Mar 2023", reaction: "+4.9%", timeframe: "10 days" }
        ],
        pattern: "Silver typically moves 1.5-2x the percentage of gold during rate cycles. Higher beta play."
      },
      {
        event: "Geopolitical Tensions (Middle East / Wars)",
        category: "geopolitical",
        direction: "positive",
        magnitude: 80,
        avgReaction: "+4.0% in 2 weeks",
        description: "Silver benefits from safe-haven demand but less than gold. Industrial demand concerns can limit upside during recessions.",
        pastInstances: [
          { date: "Oct 2023 (Israel-Hamas)", reaction: "+5.5%", timeframe: "3 weeks" },
          { date: "Feb 2022 (Russia-Ukraine)", reaction: "+4.8%", timeframe: "2 weeks" },
          { date: "Jan 2020 (US-Iran)", reaction: "+3.2%", timeframe: "1 week" }
        ],
        pattern: "Silver follows gold with a lag. More volatile than gold - bigger swings both ways."
      },
      {
        event: "China Manufacturing PMI Rise",
        category: "economic-data",
        direction: "positive",
        magnitude: 75,
        avgReaction: "+3.5% in 1 week",
        description: "Silver has strong industrial demand (50% from industry). China is the largest silver consumer. Strong PMI = higher silver demand.",
        pastInstances: [
          { date: "Mar 2024 (PMI 50.8)", reaction: "+4.2%", timeframe: "1 week" },
          { date: "Sep 2023 (PMI rise)", reaction: "+3.0%", timeframe: "5 days" },
          { date: "Feb 2023 (Recovery)", reaction: "+3.8%", timeframe: "1 week" }
        ],
        pattern: "Unique to silver - industrial demand driver. China recovery = silver outperformance vs gold."
      },
      {
        event: "Solar/EV Industry Growth",
        category: "economic-data",
        direction: "positive",
        magnitude: 85,
        avgReaction: "+8.0% in 3 months",
        description: "Silver is critical for solar panels and EVs. Green energy boom creates structural demand increase.",
        pastInstances: [
          { date: "Q1 2024 (Solar boom)", reaction: "+12.5%", timeframe: "3 months" },
          { date: "Q3 2023 (EV push)", reaction: "+9.8%", timeframe: "3 months" },
          { date: "Q1 2023 (Green policy)", reaction: "+7.2%", timeframe: "2 months" }
        ],
        pattern: "Long-term structural tailwind. Silver demand from solar/EV expected to double by 2030."
      },
      {
        event: "Gold/Silver Ratio Above 85",
        category: "commodity",
        direction: "positive",
        magnitude: 80,
        avgReaction: "+6.0% in 2 weeks",
        description: "When gold/silver ratio exceeds 85, silver is historically undervalued relative to gold and tends to catch up.",
        pastInstances: [
          { date: "Mar 2020 (Ratio 120)", reaction: "+45%", timeframe: "3 months" },
          { date: "Jul 2022 (Ratio 95)", reaction: "+12%", timeframe: "1 month" },
          { date: "Oct 2023 (Ratio 88)", reaction: "+8%", timeframe: "3 weeks" }
        ],
        pattern: "Mean reversion trade. When ratio >85, silver outperforms gold. Below 60, gold outperforms."
      },
      {
        event: "US Dollar Weakness (DXY Fall)",
        category: "currency",
        direction: "positive",
        magnitude: 70,
        avgReaction: "+3.5% in 1 week",
        description: "Silver is even more correlated with USD than gold due to global trade denomination.",
        pastInstances: [
          { date: "Jul 2024", reaction: "+4.8%", timeframe: "1 week" },
          { date: "Nov 2023", reaction: "+3.9%", timeframe: "5 days" },
          { date: "Aug 2023", reaction: "+3.2%", timeframe: "1 week" }
        ],
        pattern: "Higher volatility than gold on USD moves. DXY drop = outsized silver rally."
      },
      {
        event: "Strong US Jobs / Economic Data",
        category: "economic-data",
        direction: "mixed",
        magnitude: 50,
        avgReaction: "-2.5% in 3 days",
        description: "Mixed for silver - strong economy boosts industrial demand but delays rate cuts. Net effect depends on context.",
        pastInstances: [
          { date: "Jul 2024 (NFP beat)", reaction: "-3.2%", timeframe: "3 days" },
          { date: "Jan 2024 (CPI hot)", reaction: "-2.8%", timeframe: "2 days" },
          { date: "Sep 2023 (Jobs beat)", reaction: "-1.9%", timeframe: "3 days" }
        ],
        pattern: "More volatile downside than gold. Silver drops harder during risk-off but recovers faster."
      },
      {
        event: "China Economic Slowdown",
        category: "economic-data",
        direction: "negative",
        magnitude: 75,
        avgReaction: "-4.0% in 2 weeks",
        description: "Unlike gold, silver suffers from weak China data due to industrial demand component.",
        pastInstances: [
          { date: "Aug 2024 (PMI 49.1)", reaction: "-5.2%", timeframe: "2 weeks" },
          { date: "Jun 2023 (Property crisis)", reaction: "-4.8%", timeframe: "2 weeks" },
          { date: "Oct 2022 (Lockdowns)", reaction: "-6.1%", timeframe: "3 weeks" }
        ],
        pattern: "Silver is more sensitive to China than gold. China slowdown = silver underperforms gold significantly."
      }
    ]
  }
};

export function predictETFReaction(event, metal, recentPriceChange = null, marketDepth = null) {
  const data = metalETFs[metal];
  if (!data) return null;

  const matchingReactions = data.historicalReactions.filter(r =>
    (event?.category && r.category === event.category) ||
    event?.tags?.some(tag =>
      r.event.toLowerCase().includes(tag.toLowerCase()) ||
      tag.toLowerCase().includes(r.event.toLowerCase().split(' ')[0].toLowerCase())
    )
  );

  if (matchingReactions.length === 0) {
    return {
      prediction: "neutral",
      confidence: 30,
      expectedMove: "0% to ±1%",
      reasoning: "No strong historical pattern found for this event type with " + metal + ".",
      historicalPattern: null,
      timeframe: "N/A"
    };
  }

  const positiveCount = matchingReactions.filter(r => r.direction === 'positive').length;
  const negativeCount = matchingReactions.filter(r => r.direction === 'negative').length;
  const total = matchingReactions.length;
  const positiveBias = (positiveCount - negativeCount) / total;

  const avgMagnitude = matchingReactions.reduce((sum, r) => sum + r.magnitude, 0) / matchingReactions.length;

  let direction;
  if (positiveBias > 0.34) {
    direction = 'positive';
  } else if (positiveBias < -0.34) {
    direction = 'negative';
  } else {
    const weightedScore = matchingReactions.reduce((sum, r) => {
      const weight = r.direction === 'positive' ? 1 : r.direction === 'negative' ? -1 : 0;
      return sum + (weight * r.magnitude);
    }, 0) / matchingReactions.length;
    direction = weightedScore > 10 ? 'positive' : weightedScore < -10 ? 'negative' : 'neutral';
  }

  let confidence = Math.round(42 + Math.abs(positiveBias) * 28 + Math.min(16, (total - 1) * 4));

  if (recentPriceChange !== null && recentPriceChange !== undefined && Math.abs(recentPriceChange) > 0.5) {
    const priceDir = recentPriceChange > 0 ? 1 : -1;
    const histDir = direction === 'positive' ? 1 : direction === 'negative' ? -1 : 0;
    if (histDir !== 0 && histDir === priceDir) {
      confidence += 6;
    } else if (histDir !== 0) {
      confidence -= 12;
    } else {
      direction = priceDir > 0 ? 'positive' : 'negative';
      confidence = Math.max(confidence, 45);
    }
  }

  let depthSignal = null;
  if (marketDepth && marketDepth.total > 0) {
    const ratio = marketDepth.ratio;

    if (ratio > 1.2) {
      depthSignal = { bias: 'buyers', strength: Math.min(20, (ratio - 1) * 50) };
      if (direction === 'negative') {
        confidence -= ratio > 1.4 ? 15 : 8;
        if (ratio > 1.4) direction = 'neutral';
      } else if (direction === 'positive') {
        confidence += 8;
      }
    } else if (ratio < 0.8) {
      depthSignal = { bias: 'sellers', strength: Math.min(20, (1 - ratio) * 50) };
      if (direction === 'positive') {
        confidence -= ratio < 0.6 ? 15 : 8;
        if (ratio < 0.6) direction = 'neutral';
      } else if (direction === 'negative') {
        confidence += 8;
      }
    } else {
      depthSignal = { bias: 'neutral', strength: 0 };
    }
  }

  confidence = Math.max(25, Math.min(88, confidence));

  const bestMatch = matchingReactions.reduce((best, curr) => {
    if (curr.direction !== direction && direction !== 'neutral') return best;
    return curr.magnitude > best.magnitude ? curr : best;
  }, matchingReactions[0]);

  const histPct = parseFloat((bestMatch.avgReaction?.match(/([+-]?\d+\.?\d*)\s*%/) || [])[1]) || avgMagnitude * 0.05;
  const expectedMove = direction === 'positive'
    ? `+${(histPct * 0.4).toFixed(1)}% to +${(histPct * 0.9).toFixed(1)}%`
    : direction === 'negative'
      ? `-${(histPct * 0.4).toFixed(1)}% to -${(histPct * 0.9).toFixed(1)}%`
      : `±${(histPct * 0.5).toFixed(1)}%`;

  return {
    prediction: direction,
    confidence,
    expectedMove,
    reasoning: bestMatch.description,
    historicalPattern: bestMatch.pattern,
    pastInstances: bestMatch.pastInstances,
    avgReaction: bestMatch.avgReaction,
    timeframe: metal === 'silver' ? '3-10 days (higher volatility)' : '2-7 days',
    metal: metal,
    etf: data.etfIndia,
    relatedEvents: matchingReactions.map(r => r.event),
    directionBias: positiveBias > 0.3 ? 'historically-positive' : positiveBias < -0.3 ? 'historically-negative' : 'mixed',
    marketDepth: marketDepth ? {
      buyers: marketDepth.buyers,
      sellers: marketDepth.sellers,
      buyPct: marketDepth.buyPct,
      sellPct: marketDepth.sellPct,
      ratio: marketDepth.ratio,
      sentiment: marketDepth.sentiment,
      signal: depthSignal
    } : null
  };
}
