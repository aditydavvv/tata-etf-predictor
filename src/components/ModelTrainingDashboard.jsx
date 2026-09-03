import { useState, useEffect } from 'react';
import { trainFullTataSilverModel } from '../services/etfModelTrainer';
import { fetchIndianETFs } from '../services/marketDataService.js';
import './ModelTrainingDashboard.css';

export default function ModelTrainingDashboard({ onPredictionUpdate }) {
  const [isTraining, setIsTraining] = useState(false);
  const [modelType, setModelType] = useState('ensemble');
  const [selectedHorizon, setSelectedHorizon] = useState('7D');

  // Train model on 5-year data (re-aligned to the live Tata Silver ETF price)
  const [modelResult, setModelResult] = useState(() => trainFullTataSilverModel());

  // Fetch live Tata Silver ETF price and re-anchor the model's current price
  useEffect(() => {
    let cancelled = false;
    let timer;
    const rebase = async () => {
      try {
        const etfs = await fetchIndianETFs();
        if (cancelled) return;
        const live = etfs?.tataSilverETF?.price;
        if (live) {
          setModelResult(prev => {
            if (prev && Math.abs(prev.currentPrice - live) < 0.05) return prev;
            return trainFullTataSilverModel(live);
          });
        }
      } catch {
        /* ignore, keep synthetic based model */
      }
    };
    rebase();
    timer = setInterval(rebase, 300000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Notify parent if needed
  useEffect(() => {
    if (onPredictionUpdate && modelResult) {
      onPredictionUpdate(modelResult);
    }
  }, [modelResult, onPredictionUpdate]);

  const handleRetrain = async () => {
    setIsTraining(true);
    let live = null;
    try {
      const etfs = await fetchIndianETFs();
      live = etfs?.tataSilverETF?.price || null;
    } catch { /* keep current */ }
    setTimeout(() => {
      const updated = trainFullTataSilverModel(live);
      setModelResult(updated);
      setIsTraining(false);
    }, 600);
  };

  if (!modelResult) return null;

  const { metrics, predictions, currentPrice } = modelResult;
  const activePred = predictions[selectedHorizon];

  return (
    <section className="model-dashboard-section">
      <div className="dashboard-header">
        <div className="header-left">
          <div className="title-row">
            <span className="brain-icon">🧠</span>
            <h2>5-Year AI/ML ETF Training & Forecasting Engine</h2>
          </div>
          <p className="dashboard-sub">
            Trained on <strong>{metrics.totalDays} trading days (2021–2026)</strong> across COMEX Silver Spot, Gold/Silver Ratio, USD/INR FX, Solar/EV Demand & Technical Oscillators.
          </p>
        </div>
        <div className="header-actions">
          <div className="model-badge">
            <span className="live-dot"></span>
            Model Active • {metrics.trainingDays} Train / {metrics.testingDays} Test Split
          </div>
          <button
            className={`retrain-btn ${isTraining ? 'training' : ''}`}
            onClick={handleRetrain}
            disabled={isTraining}
          >
            {isTraining ? '⚙️ Training Model...' : '🔄 Retrain on 5-Year Data'}
          </button>
        </div>
      </div>

      <div className="algo-selector-row">
        <span className="algo-label">Model Pipeline:</span>
        <div className="algo-chips">
          <button className={`algo-chip ${modelType === 'ensemble' ? 'active' : ''}`} onClick={() => setModelType('ensemble')}>✨ Ensemble Hybrid (Recommended)</button>
          <button className={`algo-chip ${modelType === 'ridge' ? 'active' : ''}`} onClick={() => setModelType('ridge')}>📊 Multi-Factor Ridge Regression</button>
          <button className={`algo-chip ${modelType === 'holt-winters' ? 'active' : ''}`} onClick={() => setModelType('holt-winters')}>📈 Holt-Winters Smoothing</button>
          <button className={`algo-chip ${modelType === 'monte-carlo' ? 'active' : ''}`} onClick={() => setModelType('monte-carlo')}>🎲 Monte Carlo (3,000 Paths)</button>
        </div>
      </div>

      {/* Model Performance Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Model Fit ($R^2$ Score)</span>
          <span className="metric-value r2">{(metrics.r2Score * 100).toFixed(1)}%</span>
          <span className="metric-caption">Variance explained across 5 years</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Directional Hit Rate</span>
          <span className="metric-value accuracy">{metrics.directionalAccuracy}</span>
          <span className="metric-caption">Out-of-sample directional accuracy</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Root Mean Sq. Error</span>
          <span className="metric-value rmse">{metrics.rmse}</span>
          <span className="metric-caption">Average price dispersion per share</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Mean Absolute Error</span>
          <span className="metric-value mae">{metrics.mae}</span>
          <span className="metric-caption">MAPE: {metrics.mape}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">5-Year Historical CAGR</span>
          <span className="metric-value cagr">+{metrics.cagr}</span>
          <span className="metric-caption">Annualized silver ETF return</span>
        </div>
      </div>

      {/* Horizon Prediction Badges */}
      <div className="horizon-selector-container">
        <label className="horizon-label">Select Forecast Horizon:</label>
        <div className="horizon-tabs">
          {Object.keys(predictions).map(key => {
            const pred = predictions[key];
            const isBull = pred.signal.includes('BULLISH');
            return (
              <button
                key={key}
                className={`horizon-btn ${selectedHorizon === key ? 'active' : ''}`}
                onClick={() => setSelectedHorizon(key)}
              >
                <span className="h-key">{key}</span>
                <span className="h-target">₹{pred.targetPrice}</span>
                <span className={`h-move ${isBull ? 'positive' : 'negative'}`}>
                  {pred.expectedMovePct >= 0 ? '+' : ''}{pred.expectedMovePct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Horizon Spotlight Banner */}
      <div className="active-forecast-spotlight">
        <div className="spotlight-left">
          <div className="spotlight-badge-row">
            <span className={`signal-tag ${activePred.signal.toLowerCase().replace(' ', '-')}`}>
              {activePred.signal === 'BULLISH' || activePred.signal === 'STRONG BULLISH' ? '🚀 ' : '📉 '}
              {activePred.signal}
            </span>
            <span className="timeframe-tag">{activePred.horizon}</span>
          </div>
          <div className="spotlight-prices">
            <div className="spotlight-item">
              <span className="spotlight-sub">Current Price</span>
              <span className="spotlight-val">₹{currentPrice.toFixed(2)}</span>
            </div>
            <div className="spotlight-arrow">➔</div>
            <div className="spotlight-item">
              <span className="spotlight-sub">Model Target</span>
              <span className={`spotlight-val target ${activePred.expectedMovePct >= 0 ? 'positive' : 'negative'}`}>
                ₹{activePred.targetPrice.toFixed(2)}
              </span>
            </div>
            <div className="spotlight-item">
              <span className="spotlight-sub">Expected Delta</span>
              <span className={`spotlight-val move ${activePred.expectedMovePct >= 0 ? 'positive' : 'negative'}`}>
                {activePred.expectedMovePct >= 0 ? '+' : ''}{activePred.expectedMovePct}%
              </span>
            </div>
          </div>
        </div>

        <div className="spotlight-right">
          <div className="confidence-box">
            <div className="conf-label-row">
              <span>Model Confidence</span>
              <span className="conf-num">{activePred.confidence}%</span>
            </div>
            <div className="conf-bar-bg">
              <div className="conf-bar-fill" style={{ width: `${activePred.confidence}%` }}></div>
            </div>
            <div className="bounds-row">
              <span>95% Range: <strong>₹{activePred.lowerBound}</strong> – <strong>₹{activePred.upperBound}</strong></span>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
