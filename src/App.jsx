import Header from './components/Header';
import GoldSilverPredictor from './components/GoldSilverPredictor';
import { MarketDataProvider } from './context/MarketDataContext.jsx';
import { useMarketDataContext } from './hooks/useMarketDataContext.js';
import './App.css';

function AppContent() {
  const { marketStatus } = useMarketDataContext();

  return (
    <div className="app">
      <Header marketStatus={marketStatus} />
      <main className="main-content">
        <GoldSilverPredictor />
      </main>
      <footer className="app-footer">
        <p>Silver ETF Predictor | Data for informational purposes only | Not financial advice</p>
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
