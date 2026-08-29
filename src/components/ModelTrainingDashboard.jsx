import { useState, useMemo, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { trainFullTataSilverModel, simulateCustomScenario } from '../services/etfModelTrainer';
import './ModelTrainingDashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function ModelTrainingDashboard({ onPredictionUpdate }) {
  const [isTraining, setIsTraining] = useState(false);
  const [modelType, setModelType] = useState('ensemble');
  const [selectedHorizon, setSelectedHorizon] = useState('7D');
  const [chartRange, setChartRange] = useState('1Y'); // '6M', '1Y', '3Y', '5Y'
  
  // Custom scenario sliders
  const [spotSilverDelta, setSpotSilverDelta] = useState(0);
  const [usdInrDelta, setUsdInrDelta] = useState(0);
  const [rateCutBps, setRateCutBps] = useState(0);
  const [solarDemandDelta, setSolarDemandDelta] = useState(0);

  // Train model on 5-year data
  const [modelResult, setModelResult] = useState(() => trainFullTataSilverModel());

  // Notify parent if needed
  useEffect(() => {
    if (onPredictionUpdate && modelResult) {
      onPredictionUpdate(modelResult);
    }
  }, [modelResult, onPredictionUpdate]);

  const handleRetrain = () => {
    setIsTraining(true);
    setTimeout(() => {
      const updated = trainFullTataSilverModel();
      setModelResult(updated);
      setIsTraining(false);
    }, 600);
  };

  // Scenario computation
  const simulatedScenario = useMemo(() => {
    if (!modelResult) return null;
    return simulateCustomScenario(modelResult, {
      spotSilverChangePct: spotSilverDelta,
      usdInrChangePct: usdInrDelta,
      fedRateCutBps: rateCutBps,
      solarDemandBoostPct: solarDemandDelta
    });
  }, [modelResult, spotSilverDelta, usdInrDelta, rateCutBps, solarDemandDelta]);

  // Chart data preparation based on chartRange
  const chartData = useMemo(() => {
    if (!modelResult) return null;

    const { dates, actualPrices, fittedHistory, predictions } = modelResult;
    const totalPoints = dates.length;

    let sliceCount = totalPoints;
    if (chartRange === '6M') sliceCount = Math.min(126, totalPoints);
    else if (chartRange === '1Y') sliceCount = Math.min(252, totalPoints);
    else if (chartRange === '3Y') sliceCount = Math.min(756, totalPoints);

    const rangeDates = dates.slice(totalPoints - sliceCount).map(d => {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    });
    const rangeActual = actualPrices.slice(totalPoints - sliceCount);
    const rangeFitted = fittedHistory.slice(totalPoints - sliceCount);

    // Future prediction projection points
    const futureDays = selectedHorizon === '1D' ? 1 : selectedHorizon === '7D' ? 7 : selectedHorizon === '30D' ? 30 : selectedHorizon === '90D' ? 90 : 252;
    const predObj = predictions[selectedHorizon];
    const currentPrice = modelResult.currentPrice;

    const futureDates = [];
    const lastDate = new Date(dates[dates.length - 1]);
    for (let i = 1; i <= Math.min(futureDays, 14); i++) {
      const fd = new Date(lastDate);
      fd.setDate(fd.getDate() + (selectedHorizon === '1Y' ? i * 25 : i * 2));
      futureDates.push(fd.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
    }

    const allLabels = [...rangeDates, ...futureDates];
    const actualDataPadded = [...rangeActual, ...new Array(futureDates.length).fill(null)];
    const fittedDataPadded = [...rangeFitted, ...new Array(futureDates.length).fill(null)];

    // Target trajectory line
    const futureTrajectory = [];
    const futureUpper = [];
    const futureLower = [];

    const steps = futureDates.length;
    for (let s = 1; s <= steps; s++) {
      const alpha = s / steps;
      futureTrajectory.push(parseFloat((currentPrice + (predObj.targetPrice - currentPrice) * alpha).toFixed(2)));
      futureUpper.push(parseFloat((currentPrice + (predObj.upperBound - currentPrice) * alpha).toFixed(2)));
      futureLower.push(parseFloat((currentPrice + (predObj.lowerBound - currentPrice) * alpha).toFixed(2)));
    }

    const forecastDataPadded = [
      ...new Array(rangeActual.length - 1).fill(null),
      currentPrice,
      ...futureTrajectory
    ];
    const upperDataPadded = [
      ...new Array(rangeActual.length - 1).fill(null),
      currentPrice,
      ...futureUpper
    ];
    const lowerDataPadded = [
      ...new Array(rangeActual.length - 1).fill(null),
      currentPrice,
      ...futureLower
    ];

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Tata Silver ETF (Historical Price)',
          data: actualDataPadded,
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34, 211, 238, 0.16)',
          borderWidth: 3,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#22d3ee',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          tension: 0.22
        },
        {
          label: '5-Year ML Model Fit Curve',
          data: fittedDataPadded,
          borderColor: '#c084fc',
          borderWidth: 2,
          borderDash: [5, 4],
          fill: false,
          pointRadius: 0,
          tension: 0.22
        },
        {
          label: `${selectedHorizon} ML Forecast Target (₹${predObj.targetPrice.toFixed(2)})`,
          data: forecastDataPadded,
          borderColor: predObj.signal === 'BULLISH' || predObj.signal === 'STRONG BULLISH' ? '#10b981' : '#ef4444',
          borderWidth: 3.5,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: predObj.signal === 'BULLISH' ? '#10b981' : '#ef4444',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          tension: 0.22
        },
        {
          label: '95% Confidence Upper Band',
          data: upperDataPadded,
          borderColor: 'rgba(52, 211, 153, 0.7)',
          borderWidth: 1.5,
          borderDash: [4, 3],
          fill: '+1',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          pointRadius: 0
        },
        {
          label: '95% Confidence Lower Band',
          data: lowerDataPadded,
          borderColor: 'rgba(248, 113, 113, 0.7)',
          borderWidth: 1.5,
          borderDash: [4, 3],
          fill: false,
          pointRadius: 0
        }
      ]
    };
  }, [modelResult, chartRange, selectedHorizon]);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: '#f1f5f9',
          font: { size: 12, weight: '600' },
          boxWidth: 14,
          padding: 14,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#3b82f6',
        borderWidth: 1.5,
        padding: 12,
        callbacks: {
          label: ctx => ctx.parsed.y ? `${ctx.dataset.label}: ₹${ctx.parsed.y.toFixed(2)}` : null
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.15)', drawBorder: false },
        ticks: { color: '#cbd5e1', font: { size: 11, weight: '600' }, maxTicksLimit: 12 }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.15)', drawBorder: false },
        ticks: {
          color: '#cbd5e1',
          font: { size: 11, weight: '600' },
          callback: v => '₹' + v.toFixed(2)
        }
      }
    }
  };

  if (!modelResult) return null;

  const { metrics, predictions, featureWeights, currentPrice } = modelResult;
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

      {/* 5-Year Chart with ML Regression Overlay */}
      <div className="model-chart-wrapper">
        <div className="chart-ctrl-row">
          <div className="chart-title-group">
            <h3>Tata Silver ETF: 5-Year Price & ML Fitted Trajectory</h3>
            <span className="chart-legend-sub">Actual Price vs Ridge Regularized & Holt-Winters Regression Forecast</span>
          </div>
          <div className="range-selector">
            {['6M', '1Y', '3Y', '5Y'].map(r => (
              <button
                key={r}
                className={`range-btn ${chartRange === r ? 'active' : ''}`}
                onClick={() => setChartRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-canvas-box">
          {chartData && <Line data={chartData} options={chartOpts} />}
        </div>
      </div>

      {/* Two Columns: Factor Weights + What-If Scenario Simulator */}
      <div className="analysis-dual-grid">
        {/* Feature Importance Panel */}
        <div className="panel-card factors-card">
          <div className="panel-header">
            <h4>⚖️ 5-Year Key Predictive Drivers & Factor Weights</h4>
            <span className="panel-sub">Normalized feature influence on price direction</span>
          </div>
          <div className="factors-list">
            {featureWeights.map((f, idx) => (
              <div key={idx} className="factor-row">
                <div className="factor-info">
                  <span className="factor-name">{f.name}</span>
                  <span className={`factor-impact ${f.impact.toLowerCase()}`}>{f.impact} Impact</span>
                </div>
                <div className="factor-bar-wrapper">
                  <div
                    className={`factor-bar ${f.direction.toLowerCase()}`}
                    style={{ width: `${Math.min(100, Math.abs(f.weight) * 35 + 10)}%` }}
                  ></div>
                  <span className="factor-weight-val">
                    {f.weight >= 0 ? '+' : ''}{f.weight}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Scenario / What-If Simulator */}
        <div className="panel-card scenario-card">
          <div className="panel-header">
            <h4>🧪 Interactive Scenario & Sensitivity Simulator</h4>
            <span className="panel-sub">Simulate macro shocks and assess instantaneous ETF price impact</span>
          </div>

          <div className="sliders-container">
            <div className="slider-group">
              <div className="slider-label-row">
                <span>COMEX Spot Silver Move</span>
                <span className={`slider-val ${spotSilverDelta >= 0 ? 'positive' : 'negative'}`}>
                  {spotSilverDelta >= 0 ? '+' : ''}{spotSilverDelta}%
                </span>
              </div>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={spotSilverDelta}
                onChange={e => setSpotSilverDelta(parseFloat(e.target.value))}
                className="custom-range"
              />
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <span>USD/INR Currency Shift</span>
                <span className={`slider-val ${usdInrDelta >= 0 ? 'positive' : 'negative'}`}>
                  {usdInrDelta >= 0 ? '+' : ''}{usdInrDelta}%
                </span>
              </div>
              <input
                type="range"
                min="-6"
                max="6"
                step="0.5"
                value={usdInrDelta}
                onChange={e => setUsdInrDelta(parseFloat(e.target.value))}
                className="custom-range"
              />
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <span>Fed Interest Rate Action</span>
                <span className={`slider-val ${rateCutBps > 0 ? 'positive' : rateCutBps < 0 ? 'negative' : ''}`}>
                  {rateCutBps > 0 ? `-${rateCutBps} bps Cut` : rateCutBps < 0 ? `+${Math.abs(rateCutBps)} bps Hike` : '0 bps (Hold)'}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="100"
                step="25"
                value={rateCutBps}
                onChange={e => setRateCutBps(parseFloat(e.target.value))}
                className="custom-range"
              />
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <span>Solar PV / EV Green Industrial Demand Boost</span>
                <span className="slider-val positive">+{solarDemandDelta}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="5"
                value={solarDemandDelta}
                onChange={e => setSolarDemandDelta(parseFloat(e.target.value))}
                className="custom-range"
              />
            </div>
          </div>

          {/* Scenario Result Box */}
          {simulatedScenario && (
            <div className="scenario-result-box">
              <div className="sc-header">
                <span className="sc-title">Simulated Tata Silver ETF Outcome:</span>
                <span className={`sc-badge ${simulatedScenario.signal.toLowerCase()}`}>
                  {simulatedScenario.signal}
                </span>
              </div>
              <div className="sc-numbers">
                <div>
                  <span className="sc-sub">Base Price</span>
                  <span className="sc-val">₹{simulatedScenario.currentPrice.toFixed(2)}</span>
                </div>
                <div className="sc-arrow">➔</div>
                <div>
                  <span className="sc-sub">Simulated Price</span>
                  <span className={`sc-val target ${simulatedScenario.simulatedMovePct >= 0 ? 'positive' : 'negative'}`}>
                    ₹{simulatedScenario.simulatedTarget.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="sc-sub">Net Impact</span>
                  <span className={`sc-val move ${simulatedScenario.simulatedMovePct >= 0 ? 'positive' : 'negative'}`}>
                    {simulatedScenario.simulatedMovePct >= 0 ? '+' : ''}{simulatedScenario.simulatedMovePct}%
                  </span>
                </div>
              </div>
              <div className="sc-breakdown">
                <span>Spot: {simulatedScenario.breakdown.spotSilverImpact}</span>
                <span>FX: {simulatedScenario.breakdown.fxImpact}</span>
                <span>Rates: {simulatedScenario.breakdown.rateCutImpact}</span>
                <span>Solar: {simulatedScenario.breakdown.solarDemandImpact}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
