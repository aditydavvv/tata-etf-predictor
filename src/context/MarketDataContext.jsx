import { createContext } from 'react';
import { useMarketData } from '../hooks/useMarketData';

export const MarketDataContext = createContext(null);

export function MarketDataProvider({ children }) {
  const marketData = useMarketData();
  return (
    <MarketDataContext.Provider value={marketData}>
      {children}
    </MarketDataContext.Provider>
  );
}
