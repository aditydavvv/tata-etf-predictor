import { useState, useEffect } from 'react';
import { fetchIndianETFs } from '../services/marketDataService.js';
import MetalPriceChart from './MetalPriceChart.jsx';
import SilverBuyersSellers from './SilverBuyersSellers.jsx';
import './GoldSilverPredictor.css';

function formatAsOf(isoString) {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  });
}

export default function GoldSilverPredictor() {
  const [indianETFs, setIndianETFs] = useState(null);

  useEffect(() => {
    const loadETFs = async () => {
      const etfs = await fetchIndianETFs();
      if (etfs) setIndianETFs(etfs);
    };
    loadETFs();
    const etfInterval = setInterval(loadETFs, 300000);
    return () => clearInterval(etfInterval);
  }, []);

  const tataSilver = indianETFs?.tataSilverETF ?? null;
  const asOfLabel = formatAsOf(tataSilver?.asOf);

  return (
    <section className="gold-silver-section">
      <div className="section-header">
        <h2>Silver ETF Predictor</h2>
        {asOfLabel && <span className="data-asof">Prices as of {asOfLabel} IST</span>}
      </div>

      <MetalPriceChart etfType="tata-silver-etf" />

      <SilverBuyersSellers />

      {!tataSilver && (
        <p className="data-warning">
          ⚠️ Live ETF prices are temporarily unavailable.
        </p>
      )}
    </section>
  );
}
