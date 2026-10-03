import { useState, useEffect } from 'react';
import { trainFullTataSilverModel } from '../services/etfModelTrainer';
import { buildRealSilverDataset } from '../services/silverDataset';
import './ModelTrainingDashboard.css';

export default function ModelTrainingDashboard({ onPredictionUpdate }) {
  const [isTraining, setIsTraining] = useState(false);
  const [modelType, setModelType] = useState('ensemble');
  const [selectedHorizon, setSelectedHorizon] = useState('7D');

  // Real market history from the price snapshot; null while loading or if the
  // snapshot is missing, in which case the trainer falls back to a series that
  // is explicitly labelled as modelled rather than real.
  const [dataset, setDataset] = useState(null);

  // Train model on the available history
  const [modelResult, setModelResult] = useState(() => trainFullTataSilverModel(null));

  useEffect(() => {
    let cancelled = false;
    buildRealSilverDataset().then(built => {
      if (!cancelled && built) {
        setDataset(built);
        setModelResult(trainFullTataSilverModel(built));
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Notify parent if needed
  useEffect(() => {
    if (onPredictionUpdate && modelResult) {
      onPredictionUpdate(modelResult);
    }
  }, [modelResult, onPredictionUpdate]);

  const handleRetrain = () => {
    setIsTraining(true);
    setTimeout(() => {
      setModelResult(trainFullTataSilverModel(dataset));
      setIsTraining(false);
    }, 600);
  };

  if (!modelResult) return null;

  const { metrics, predictions, currentPrice, provenance } = modelResult;
  const activePred = predictions[selectedHorizon];
  const isRealData = provenance?.kind === 'real';

  return (
    <section className="model-dashboard-section">
      <div className="dashboard-header">
        <div className="header-left">
          <div className="title-row">
            <span className="brain-icon">🧠</span>
            <h2>AI/ML ETF Training & Forecasting Engine</h2>
          </div>
          <p className="dashboard-sub">
            Trained on <strong>{metrics.totalDays} trading days ({metrics.dataRange})</strong> across Tata Silver ETF closes, COMEX Silver Spot, Gold/Silver Ratio, USD/INR FX & Technical Oscillators.
          </p>
          <p className={`dashboard-provenance ${isRealData ? 'real' : 'synthetic'}`}>
            {isRealData
              ? `✅ Real market history (${provenance.sources.join(', ')})`
              : '⚠️ Modelled series — live price history unavailable, figures below are not market prices'}
          </p>
          {metrics.hasPredictiveSkill === false && (
            <p className="dashboard-provenance synthetic">
              ⚠️ Measured out-of-sample R² is {metrics.r2Score} — this model does not beat
              predicting the historical mean, so treat every target below as a trend
              extrapolation rather than a forecast.
            </p>
          )}
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
            {isTraining ? '⚙️ Training Model...' : '🔄 Retrain on Latest Data'}
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
          <span className="metric-caption">Out-of-sample variance explained</span>
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
          <span className="metric-label">Historical CAGR</span>
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
