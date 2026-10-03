import { useState, useEffect } from 'react';
import { metalETFs, predictETFReaction } from '../data/metals.js';
import { globalEvents } from '../data/events.js';
import { fetchCommodityPrices, fetchIndianETFs } from '../services/marketDataService.js';
import { fetchAllMarketDepth } from '../services/marketDepthService.js';
import { fetchSilverAnalysis, predictTataSilverETF } from '../services/silverAnalysisService.js';
import MetalPriceChart from './MetalPriceChart.jsx';
import ModelTrainingDashboard from './ModelTrainingDashboard.jsx';
import './GoldSilverPredictor.css';

const GRAMS_PER_KG = 1000;
const TROY_OUNCE_GRAMS = 31.1035;
/** Indian bullion quotes carry GST plus fabrication; used only for the spot card. */
const DOMESTIC_PREMIUM = 1.15;

function formatINR(value, fractionDigits = 2) {
  return Number.isFinite(value) ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}` : '—';
}

function formatUSD(value, fractionDigits = 2) {
  return Number.isFinite(value) ? `$${value.toLocaleString('en-IN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}` : '—';
}

function formatAsOf(isoString) {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  });
}

export default function GoldSilverPredictor() {
  const [selectedEvent, setSelectedEvent] = useState(globalEvents[0]);
  const [activeTab, setActiveTab] = useState('both');
  const [activeChart, setActiveChart] = useState('tata-silver-etf');
  const [priceChanges, setPriceChanges] = useState({ gold: null, silver: null });
  const [marketDepth, setMarketDepth] = useState({ gold: null, silver: null, tataSilver: null });
  const [silverAnalysis, setSilverAnalysis] = useState(null);
  const [indianETFs, setIndianETFs] = useState(null);
  const [mlModelOutput, setMlModelOutput] = useState(null);

  useEffect(() => {
    const loadPrices = async () => {
      const prices = await fetchCommodityPrices();
      if (prices?.silver) setPriceChanges(prev => ({ ...prev, silver: prices.silver.changePercent }));
      if (prices?.gold) setPriceChanges(prev => ({ ...prev, gold: prices.gold.changePercent }));
    };
    const loadDepth = async () => {
      const depth = await fetchAllMarketDepth();
      setMarketDepth(depth);
    };
    const loadSilverAnalysis = async () => {
      const analysis = await fetchSilverAnalysis();
      setSilverAnalysis(analysis);
    };
    const loadETFs = async () => {
      const etfs = await fetchIndianETFs();
      if (etfs) setIndianETFs(etfs);
    };
    loadPrices();
    loadDepth();
    loadSilverAnalysis();
    loadETFs();
    const priceInterval = setInterval(loadPrices, 300000);
    const depthInterval = setInterval(loadDepth, 300000);
    const analysisInterval = setInterval(loadSilverAnalysis, 300000);
    const etfInterval = setInterval(loadETFs, 300000);
    return () => {
      clearInterval(priceInterval);
      clearInterval(depthInterval);
      clearInterval(analysisInterval);
      clearInterval(etfInterval);
    };
  }, []);

  const goldPrediction = predictETFReaction(selectedEvent, 'gold', priceChanges.gold, marketDepth.gold);
  const tataSilverPrediction = predictTataSilverETF(silverAnalysis, marketDepth.tataSilver, selectedEvent, mlModelOutput);

  const goldData = metalETFs.gold;
  const silverData = metalETFs.silver;

  // Live market prices. These are null when data is genuinely unavailable —
  // never a hardcoded or modelled substitute.
  const tataSilver = indianETFs?.tataSilverETF ?? null;
  const tataGold = indianETFs?.tataGoldETF ?? null;
  const spotSilverUSD = silverAnalysis?.silver?.price ?? null;
  const spotGoldUSD = silverAnalysis?.gold?.price ?? null;
  const usdRate = silverAnalysis?.usdInr?.rate ?? null;
  const liveRatio = Number.isFinite(spotSilverUSD) && spotSilverUSD > 0 && Number.isFinite(spotGoldUSD)
    ? parseFloat((spotGoldUSD / spotSilverUSD).toFixed(1))
    : null;

  const spotSilverINRkg = Number.isFinite(spotSilverUSD) && Number.isFinite(usdRate)
    ? Math.round(spotSilverUSD * (GRAMS_PER_KG / TROY_OUNCE_GRAMS) * usdRate * DOMESTIC_PREMIUM)
    : null;
  const spotGoldINR10g = Number.isFinite(spotGoldUSD) && Number.isFinite(usdRate)
    ? Math.round((spotGoldUSD / TROY_OUNCE_GRAMS) * 10 * usdRate * DOMESTIC_PREMIUM)
    : null;

  const asOf = tataSilver?.asOf ?? tataGold?.asOf ?? null;
  const asOfLabel = formatAsOf(asOf);

  const renderPrediction = (prediction, metal, data) => {
    if (!prediction) return null;

    const dirColor = prediction.prediction === 'positive' ? 'positive' :
                     prediction.prediction === 'negative' ? 'negative' : 'neutral';

    return (
      <div className={`prediction-card ${dirColor}`}>
        <div className="pred-header">
          <div className="pred-metal-icon">
            {metal === 'gold' ? '🥇' : '🥈'}
          </div>
          <div>
            <h3 className="pred-metal-name">{data.name} Prediction</h3>
            <p className="pred-etf">{data.etfIndia}</p>
          </div>
          <div className={`pred-direction-badge ${dirColor}`}>
            {prediction.prediction === 'positive' ? '📈 BULLISH' :
             prediction.prediction === 'negative' ? '📉 BEARISH' : '↔️ NEUTRAL'}
          </div>
        </div>

        <div className="pred-stats">
          <div className="pred-stat">
            <span className="pred-stat-label">Expected Move</span>
            <span className={`pred-stat-value ${dirColor}`}>{prediction.expectedMove}</span>
          </div>
          <div className="pred-stat">
            <span className="pred-stat-label">Confidence</span>
            <div className="confidence-bar-wrapper">
              <div className="confidence-bar" style={{ width: `${prediction.confidence}%` }}></div>
              <span className="confidence-text">{prediction.confidence}%</span>
            </div>
          </div>
          <div className="pred-stat">
            <span className="pred-stat-label">Timeframe</span>
            <span className="pred-stat-value timeframe">{prediction.timeframe}</span>
          </div>
          <div className="pred-stat">
            <span className="pred-stat-label">Avg Historical Reaction</span>
            <span className={`pred-stat-value ${dirColor}`}>{prediction.avgReaction || '±3.5%'}</span>
          </div>
        </div>

        <div className="pred-reasoning">
          <h4>Why This Prediction?</h4>
          <p>{prediction.reasoning}</p>
        </div>

        {prediction.historicalPattern && (
          <div className="pred-pattern">
            <h4>Historical Pattern</h4>
            <p>{prediction.historicalPattern}</p>
          </div>
        )}

        {prediction.pastInstances && prediction.pastInstances.length > 0 && (
          <div className="past-instances">
            <h4>Past Instances</h4>
            <div className="instances-grid">
              {prediction.pastInstances.map((inst, i) => (
                <div key={i} className="instance-item">
                  <span className="inst-date">{inst.date}</span>
                  <span className={`inst-reaction ${inst.reaction.startsWith('+') ? 'positive' : 'negative'}`}>
                    {inst.reaction}
                  </span>
                  <span className="inst-timeframe">{inst.timeframe}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {prediction.marketDepth && (
          <div className="market-depth-section">
            <h4>📊 Market Depth (Live)</h4>
            <div className="depth-grid">
              <div className="depth-item">
                <span className="depth-label">Buyers</span>
                <span className="depth-value buyers">{prediction.marketDepth.buyers?.toLocaleString()}</span>
                <span className="depth-pct">{prediction.marketDepth.buyPct}%</span>
              </div>
              <div className="depth-item">
                <span className="depth-label">Sellers</span>
                <span className="depth-value sellers">{prediction.marketDepth.sellers?.toLocaleString()}</span>
                <span className="depth-pct">{prediction.marketDepth.sellPct}%</span>
              </div>
              <div className="depth-item">
                <span className="depth-label">Buy/Sell Ratio</span>
                <span className={`depth-ratio ${prediction.marketDepth.sentiment}`}>{prediction.marketDepth.ratio}</span>
              </div>
              <div className="depth-item">
                <span className="depth-label">Sentiment</span>
                <span className={`depth-sentiment ${prediction.marketDepth.sentiment}`}>
                  {prediction.marketDepth.sentiment === 'strong-buyers' && '🟢 Strong Buying'}
                  {prediction.marketDepth.sentiment === 'buyers' && '🟢 Buying'}
                  {prediction.marketDepth.sentiment === 'neutral' && '🟡 Neutral'}
                  {prediction.marketDepth.sentiment === 'sellers' && '🔴 Selling'}
                  {prediction.marketDepth.sentiment === 'strong-sellers' && '🔴 Strong Selling'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="gold-silver-section">
      <div className="section-header">
        <h2>Tata ETF Predictions & Quantitative Forecasting</h2>
        <span className="subtitle">Live market prices, precious metals, event shocks & order book depth</span>
        {asOfLabel && <span className="data-asof">Prices as of {asOfLabel} IST</span>}
      </div>

      {/* AI/ML ETF Training & Forecasting Engine */}
      <ModelTrainingDashboard onPredictionUpdate={setMlModelOutput} />

      <div className="chart-tabs">
        <button className={`chart-tab ${activeChart === 'tata-silver-etf' ? 'active tata' : ''}`} onClick={() => setActiveChart('tata-silver-etf')}>Tata Silver ETF</button>
        <button className={`chart-tab ${activeChart === 'tata-gold-etf' ? 'active tata' : ''}`} onClick={() => setActiveChart('tata-gold-etf')}>Tata Gold ETF</button>
      </div>

      <MetalPriceChart etfType={activeChart} />

      <div className="current-prices">
        {/* Tata Silver ETF Card */}
        <div className="price-card silver">
          <span className="price-icon">🥈</span>
          <div className="price-info">
            <span className="price-label">Tata Silver ETF (TATSILV)</span>
            <span className="price-value">{formatINR(tataSilver?.price)}</span>
            <span className="price-unit">
              Spot Silver: {formatUSD(spotSilverUSD)}/oz
              {Number.isFinite(spotSilverINRkg) && ` (₹${(spotSilverINRkg / 100000).toFixed(2)}L/kg)`}
            </span>
          </div>
        </div>

        {/* Tata Gold ETF Card */}
        <div className="price-card gold">
          <span className="price-icon">🥇</span>
          <div className="price-info">
            <span className="price-label">Tata Gold ETF (TATAGOLD)</span>
            <span className="price-value">{formatINR(tataGold?.price)}</span>
            <span className="price-unit">
              Spot Gold: {formatUSD(spotGoldUSD, 0)}/oz
              {Number.isFinite(spotGoldINR10g) && ` (₹${(spotGoldINR10g / 1000).toFixed(0)}K/10g)`}
            </span>
          </div>
        </div>

        {/* Gold / Silver Valuation Ratio */}
        <div className="price-card ratio">
          <span className="price-icon">⚖️</span>
          <div className="price-info">
            <span className="price-label">Gold/Silver Spot Ratio</span>
            <span className="price-value">{liveRatio ?? '—'}</span>
            <span className="price-unit">
              {!Number.isFinite(liveRatio)
                ? 'Live spot prices unavailable'
                : liveRatio >= 80 ? 'Silver undervalued vs Gold' : liveRatio <= 60 ? 'Silver rich vs Gold' : 'Fair historical range'}
            </span>
          </div>
        </div>
      </div>

      {(!tataSilver || !tataGold) && (
        <p className="data-warning">
          ⚠️ Live ETF prices are unavailable right now. No placeholder is shown because a
          fabricated price is worse than no price — the snapshot is refreshed roughly every
          20 minutes during market hours.
        </p>
      )}

      <div className="event-selector">
        <label>Select a Global Event to Predict Impact:</label>
        <div className="event-buttons">
          {globalEvents.map(event => (
            <button
              key={event.id}
              className={`event-btn ${selectedEvent.id === event.id ? 'active' : ''}`}
              onClick={() => setSelectedEvent(event)}
            >
              {event.title.length > 40 ? event.title.substring(0, 40) + '...' : event.title}
            </button>
          ))}
        </div>
      </div>

      <div className="selected-event-preview">
        <h4>Selected Event:</h4>
        <div className="event-preview-card">
          <span className="ep-title">{selectedEvent.title}</span>
          <span className="ep-desc">{selectedEvent.description}</span>
        </div>
      </div>

      <div className="metal-tabs">
        <button className={`metal-tab ${activeTab === 'both' ? 'active' : ''}`} onClick={() => setActiveTab('both')}>Both</button>
        <button className={`metal-tab silver ${activeTab === 'silver' ? 'active' : ''}`} onClick={() => setActiveTab('silver')}>Tata Silver Only</button>
        <button className={`metal-tab gold ${activeTab === 'gold' ? 'active' : ''}`} onClick={() => setActiveTab('gold')}>Tata Gold Only</button>
      </div>

      <div className="predictions-container">
        {(activeTab === 'both' || activeTab === 'silver') && tataSilverPrediction && (
          <div className={`prediction-card ${tataSilverPrediction.prediction === 'positive' ? 'positive' : tataSilverPrediction.prediction === 'negative' ? 'negative' : 'neutral'}`}>
            <div className="pred-header">
              <div className="pred-metal-icon">🏆</div>
              <div>
                <h3 className="pred-metal-name">Tata Silver ETF Prediction</h3>
                <p className="pred-etf">Tata Silver Exchange Traded Fund (NSE: TATSILV)</p>
              </div>
              <div className={`pred-direction-badge ${tataSilverPrediction.prediction === 'positive' ? 'positive' : tataSilverPrediction.prediction === 'negative' ? 'negative' : 'neutral'}`}>
                {tataSilverPrediction.prediction === 'positive' ? '📈 BULLISH' :
                 tataSilverPrediction.prediction === 'negative' ? '📉 BEARISH' : '↔️ NEUTRAL'}
              </div>
            </div>

            <div className="pred-stats">
              <div className="pred-stat">
                <span className="pred-stat-label">Expected Move</span>
                <span className={`pred-stat-value ${tataSilverPrediction.prediction === 'positive' ? 'positive' : tataSilverPrediction.prediction === 'negative' ? 'negative' : 'neutral'}`}>{tataSilverPrediction.expectedMove}</span>
              </div>
              <div className="pred-stat">
                <span className="pred-stat-label">Confidence</span>
                <div className="confidence-bar-wrapper">
                  <div className="confidence-bar" style={{ width: `${tataSilverPrediction.confidence}%` }}></div>
                  <span className="confidence-text">{tataSilverPrediction.confidence}%</span>
                </div>
              </div>
              <div className="pred-stat">
                <span className="pred-stat-label">Timeframe</span>
                <span className="pred-stat-value timeframe">{tataSilverPrediction.timeframe}</span>
              </div>
              <div className="pred-stat">
                <span className="pred-stat-label">Trend Momentum</span>
                <span className={`pred-stat-value ${tataSilverPrediction.silverData?.trend?.direction === 'up' ? 'positive' : tataSilverPrediction.silverData?.trend?.direction === 'down' ? 'negative' : 'neutral'}`}>
                  {tataSilverPrediction.silverData?.trend?.direction?.toUpperCase()} ({tataSilverPrediction.silverData?.trend?.strength}%)
                </span>
              </div>
            </div>

            <div className="pred-reasoning">
              <h4>Why This Prediction?</h4>
              <p>{tataSilverPrediction.reasoning}</p>
            </div>

            {tataSilverPrediction.analysis && tataSilverPrediction.analysis.signals.length > 0 && (
              <div className="pred-pattern">
                <h4>Market & Fundamental Signals</h4>
                <div className="signal-tags">
                  {tataSilverPrediction.analysis.signals.map((signal, i) => (
                    <span key={i} className="signal-tag">{signal}</span>
                  ))}
                </div>
              </div>
            )}

            {tataSilverPrediction.marketDepth && (
              <div className="market-depth-section">
                <h4>📊 Market Depth (Live)</h4>
                <div className="depth-grid">
                  <div className="depth-item">
                    <span className="depth-label">Buyers</span>
                    <span className="depth-value buyers">{tataSilverPrediction.marketDepth.buyers?.toLocaleString()}</span>
                    <span className="depth-pct">{tataSilverPrediction.marketDepth.buyPct}%</span>
                  </div>
                  <div className="depth-item">
                    <span className="depth-label">Sellers</span>
                    <span className="depth-value sellers">{tataSilverPrediction.marketDepth.sellers?.toLocaleString()}</span>
                    <span className="depth-pct">{tataSilverPrediction.marketDepth.sellPct}%</span>
                  </div>
                  <div className="depth-item">
                    <span className="depth-label">Buy/Sell Ratio</span>
                    <span className={`depth-ratio ${tataSilverPrediction.marketDepth.sentiment}`}>{tataSilverPrediction.marketDepth.ratio}</span>
                  </div>
                  <div className="depth-item">
                    <span className="depth-label">Sentiment</span>
                    <span className={`depth-sentiment ${tataSilverPrediction.marketDepth.sentiment}`}>
                      {tataSilverPrediction.marketDepth.sentiment === 'strong-buyers' && '🟢 Strong Buying'}
                      {tataSilverPrediction.marketDepth.sentiment === 'buyers' && '🟢 Buying'}
                      {tataSilverPrediction.marketDepth.sentiment === 'neutral' && '🟡 Neutral'}
                      {tataSilverPrediction.marketDepth.sentiment === 'sellers' && '🔴 Selling'}
                      {tataSilverPrediction.marketDepth.sentiment === 'strong-sellers' && '🔴 Strong Selling'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {(activeTab === 'both' || activeTab === 'gold') && renderPrediction(goldPrediction, 'gold', goldData)}
      </div>

      <div className="historical-reference">
        <h3>📚 Historical Event-Reaction Reference</h3>
        <p className="ref-subtitle">How Gold & Silver ETFs typically react to major global events</p>

        <div className="reference-grid">
          <div className="ref-column">
            <h4>🥈 Tata Silver ETF Reactions</h4>
            {silverData.historicalReactions.map((reaction, i) => (
              <div key={i} className="ref-item">
                <div className="ref-event-name">{reaction.event}</div>
                <div className={`ref-direction ${reaction.direction}`}>
                  {reaction.direction === 'positive' ? '▲' : reaction.direction === 'negative' ? '▼' : '↔'} {reaction.avgReaction}
                </div>
                <div className="ref-pattern">{reaction.pattern}</div>
              </div>
            ))}
          </div>
          <div className="ref-column">
            <h4>🥇 Tata Gold ETF Reactions</h4>
            {goldData.historicalReactions.map((reaction, i) => (
              <div key={i} className="ref-item">
                <div className="ref-event-name">{reaction.event}</div>
                <div className={`ref-direction ${reaction.direction}`}>
                  {reaction.direction === 'positive' ? '▲' : '▼'} {reaction.avgReaction}
                </div>
                <div className="ref-pattern">{reaction.pattern}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
