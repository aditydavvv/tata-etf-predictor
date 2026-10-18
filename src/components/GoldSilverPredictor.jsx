import { useState, useEffect } from 'react';
import { fetchIndianETFs } from '../services/marketDataService.js';
import { globalEvents } from '../data/events.js';
import { computeLivePrediction } from '../services/livePredictionService.js';
import { loadModel } from '../services/predictionEngine.js';
import { loadSnapshot, getHistory } from '../services/priceSnapshot.js';
import useSilverDepth from '../hooks/useSilverDepth.js';
import usePredictionEngine from '../hooks/usePredictionEngine.js';
import MetalPriceChart from './MetalPriceChart.jsx';
import SilverLivePrediction from './SilverLivePrediction.jsx';
import SilverBuyersSellers from './SilverBuyersSellers.jsx';
import PredictionAccuracyEngine from './PredictionAccuracyEngine.jsx';
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
  const [model, setModel] = useState(() => loadModel());
  const [history, setHistory] = useState([]);
  const { depth, loading: depthLoading } = useSilverDepth();

  useEffect(() => {
    const loadETFs = async () => {
      const etfs = await fetchIndianETFs();
      if (etfs) setIndianETFs(etfs);
    };
    loadETFs();
    const etfInterval = setInterval(loadETFs, 300000);
    return () => clearInterval(etfInterval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSnapshot().then(() => {
      if (!cancelled) setHistory(getHistory('TATSILV.NS'));
    });
    return () => { cancelled = true; };
  }, []);

  const tataSilver = indianETFs?.tataSilverETF ?? null;
  const asOfLabel = formatAsOf(tataSilver?.asOf);

  const price = tataSilver?.price ?? null;

  const prediction = computeLivePrediction({
    marketDepth: depth,
    events: globalEvents,
    history,
    adjustments: model
  });

  const engine = usePredictionEngine({ prediction, price, ready: !depthLoading });

  useEffect(() => {
    if (engine.model) setModel(engine.model);
  }, [engine.model]);

  return (
    <section className="gold-silver-section">
      <div className="section-header">
        <h2>Silver ETF Predictor</h2>
        {asOfLabel && <span className="data-asof">Prices as of {asOfLabel} IST</span>}
      </div>

      <MetalPriceChart etfType="tata-silver-etf" />

      <SilverLivePrediction prediction={prediction} depth={depth} loading={depthLoading} />

      <PredictionAccuracyEngine stats={engine.stats} model={engine.model ?? model} loading={engine.loading} />

      <SilverBuyersSellers depth={depth} loading={depthLoading} />

      {!tataSilver && (
        <p className="data-warning">
          ⚠️ Live ETF prices are temporarily unavailable.
        </p>
      )}
    </section>
  );
}
