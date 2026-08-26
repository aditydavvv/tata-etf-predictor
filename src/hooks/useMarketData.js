import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchMarketIndices,
  fetchCommodityPrices,
  fetchCurrencyRates,
  fetchMetalETFs
} from '../services/marketDataService';

const CACHE_KEY = 'marketDataCache';
const CACHE_DURATION = 5 * 60 * 1000;

function getISTTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function isPreMarket() {
  const ist = getISTTime();
  const day = ist.getDay();
  const h = ist.getHours();
  const m = ist.getMinutes();
  return day >= 1 && day <= 5 && h * 60 + m < 570;
}

function isMarketOpen() {
  const ist = getISTTime();
  const day = ist.getDay();
  const h = ist.getHours();
  const m = ist.getMinutes();
  return day >= 1 && day <= 5 && h * 60 + m >= 570 && h * 60 + m <= 930;
}

function isWeekend() {
  const day = getISTTime().getDay();
  return day === 0 || day === 6;
}

function getCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch { /* full */ }
}

export function useMarketData() {
  const [indices, setIndices] = useState([]);
  const [commodities, setCommodities] = useState({});
  const [currency, setCurrency] = useState({});
  const [metalETFs, setMetalETFs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [marketStatus, setMarketStatus] = useState('loading');
  const fetchedRef = useRef(false);

  const fetchAllData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const [i, c, cu, m] = await Promise.allSettled([
        fetchMarketIndices(), fetchCommodityPrices(), fetchCurrencyRates(), fetchMetalETFs()
      ]);
      const newData = {
        indices: i.status === 'fulfilled' ? i.value : [],
        commodities: c.status === 'fulfilled' ? c.value : {},
        currency: cu.status === 'fulfilled' ? cu.value : {},
        metalETFs: m.status === 'fulfilled' ? m.value : {}
      };
      if (newData.indices.length > 0) setIndices(newData.indices);
      setCommodities(newData.commodities);
      setCurrency(newData.currency);
      setMetalETFs(newData.metalETFs);
      setCachedData(newData);
      setLastUpdated(new Date());
      setLoading(false);
      fetchedRef.current = true;
    } catch {
      setError('Failed to fetch market data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedData();
    if (cached) {
      setIndices(cached.indices || []);
      setCommodities(cached.commodities || {});
      setCurrency(cached.currency || {});
      setMetalETFs(cached.metalETFs || {});
      setLastUpdated(new Date(cached.timestamp));
      setLoading(false);
    }
    setMarketStatus(
      isWeekend() ? 'weekend' : isPreMarket() ? 'pre-market' : isMarketOpen() ? 'open' : 'closed'
    );
    if (!fetchedRef.current) fetchAllData(!cached);
    const interval = setInterval(() => fetchAllData(false), CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchAllData(true);
  }, [fetchAllData]);

  return {
    indices, commodities, currency, metalETFs,
    loading, error, lastUpdated, refresh, marketStatus,
    isPreMarket: isPreMarket(), isMarketOpen: isMarketOpen()
  };
}
