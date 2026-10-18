import { useState, useEffect } from 'react';
import { fetchMarketDepth } from '../services/marketDepthService.js';

const REFRESH_MS = 5 * 60 * 1000;

/**
 * Live order-book depth for the Tata Silver ETF, refreshed every 5 minutes.
 * Shared by the Buyers & Sellers panel and the live prediction so both read
 * from a single fetch.
 */
export default function useSilverDepth() {
  const [depth, setDepth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchMarketDepth('tata-silver-etf');
      if (!cancelled) {
        setDepth(data);
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { depth, loading };
}
