import { lazy } from 'react';
import Header from './components/Header';
import MarketTicker from './components/MarketTicker';
import GoldSilverPredictor from './components/GoldSilverPredictor';
import { MarketDataProvider } from './context/MarketDataContext.jsx';
import { useMarketDataContext } from './hooks/useMarketDataContext.js';
import './App.css';

const MarketOverview = lazy(() => import('./components/MarketOverview'));
const EventTimeline = lazy(() => import('./components/EventTimeline'));
const SectorImpact = lazy(() => import('./components/SectorImpact'));
const GlobalEvents = lazy(() => import('./components/GlobalEvents'));
const LiveNews = lazy(() => import('./components/LiveNews'));

function AppContent() {
  const { marketStatus } = useMarketDataContext();

  return (
    <div className="app">
      <Header marketStatus={marketStatus} />
      <MarketTicker />
      <main className="main-content">
        <GoldSilverPredictor />
        <MarketOverview />
        <EventTimeline />
        <SectorImpact />
        <GlobalEvents />
        <LiveNews />
      </main>
      <footer className="app-footer">
        <p>Tata ETF Predictor | Data is for informational purposes only | Not financial advice</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <MarketDataProvider>
      <AppContent />
    </MarketDataProvider>
  );
}

export default App;
