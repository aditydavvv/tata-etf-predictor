import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import ETFCard from '../components/etf/ETFCard';
import FilterBar from '../components/etf/Filters';
import ETFGrid from '../components/etf/ETFGrid';
import ETFTable from '../components/etf/ETFTable';
import useCategories from '../hooks/useCategories';
import useEtfsByCategory from '../hooks/useEtfsByCategory';
import { ETFCardSkeleton, StatsCardSkeleton, FilterBarSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/ui/ErrorState';
import { BarChart3, TrendingUp, RotateCcw, Grid, List } from 'lucide-react';
import { fetchLiveEtfs } from '../api/etfApi';
import { formatPrice, formatPercent, formatVolume, formatCurrency } from '../utils/format';
import AdvancedFilter from '../components/etf/AdvancedFilter';
import ReactModal from 'react-modal';

const StatsCard = ({ title, value, change, icon: Icon, subtitle }) => (
  <div className="card p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {change && (
          <p className={`text-sm mt-1 ${change.startsWith('+') ? 'text-success-600' : 'text-danger-600'}`}>{change}</p>
        )}
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
      <div className="p-3 bg-primary-50 rounded-full">
        <Icon className="w-6 h-6 text-primary-600" />
      </div>
    </div>
  </div>
);

// Category keywords mapping for live filtering
const CATEGORY_KEYWORDS = {
  nifty50: ['nifty 50', 'niftybees', 'niftyetf', 'nifty bees'],
  banking: ['bank', 'banking', 'bankbees', 'nifty bank'],
  largeCap: ['largecap', 'top 100', 'nifty 100'],
  midCap: ['midcap', 'midcap 150', 'juniorbees'],
  smallCap: ['smallcap', 'small cap 250'],
  it: ['it', 'tech', 'nifty it', 'itbees'],
  sensex: ['sensex'],
  gold: ['gold', 'goldbees'],
  silver: ['silver', 'silverbees'],
  next50: ['nifty next 50', 'juniorbees'],
  liquid: ['liquid', 'liquidbees'],
  international: ['nasdaq', 'sp 500', 'international', 'global'],
  consumption: ['consumption', 'consumer'],
  healthcare: ['healthcare', 'pharma'],
  gilt: ['gsec', 'gilt', 'government bond'],
  momentum: ['momentum'],
  value: ['value'],
  quality: ['quality'],
  infrastructure: ['infra', 'infrastructure'],
  lowVolatility: ['low vol', 'lowvol'],
  equalWeight: ['equal weight', 'equalo'],
  metals: ['metal'],
  misc: [],
};

function filterLiveEtfsByCategory(liveEtfs, selectedCategory) {
  const keywords = CATEGORY_KEYWORDS[selectedCategory] || [];
  if (!keywords.length) return liveEtfs;
  return liveEtfs.filter(etf => {
    const name = ((etf.assets || '') + ' ' + (etf.symbol || '')).toLowerCase();
    return keywords.some(keyword => name.includes(keyword));
  });
}

const LiveDataIndicator = ({ timestamp, isConnected }) => (
  <div className="flex items-center gap-2 text-sm">
    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-gray-400'}`}></div>
    {timestamp && (
      <span className="text-gray-500 ml-1">
        {new Date(timestamp).toLocaleTimeString('en-IN', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })}
      </span>
    )}
    {!isConnected && <span className="text-gray-400 ml-2">Connecting...</span>}
  </div>
);

// Compare Modal component
function CompareModal({ isOpen, onClose, etfs, liveMode }) {
  if (!isOpen) return null;
  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      overlayClassName="fixed inset-0 z-40 bg-black bg-opacity-40"
      ariaHideApp={false}
    >
      <div className="bg-white rounded-xl shadow-lg max-w-5xl w-full p-8 relative">
        <button className="absolute top-4 right-4 btn btn-secondary" onClick={onClose}>Close</button>
        <h2 className="text-2xl font-bold mb-6">Compare ETFs</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Symbol</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-right px-4 py-2">NAV</th>
                <th className="text-right px-4 py-2">1Y Return</th>
                <th className="text-right px-4 py-2">Volume</th>
              </tr>
            </thead>
            <tbody>
              {etfs.map((etf, idx) => {
                const name = liveMode ? (etf.assets || etf.symbol) : (etf.schemeName || etf.name);
                const symbol = liveMode ? etf.symbol : etf.symbol || etf.amfiCode;
                const category = etf.category && etf.category !== 'N/A' ? etf.category : '-';
                const nav = liveMode ? etf.ltP : etf.latestNav || etf.nav;
                const return1Y = liveMode ? etf.yPC : etf.return1Y;
                const volume = liveMode ? etf.qty : '-';
                return (
                  <tr key={symbol || idx} className="border-t">
                    <td className="px-4 py-2 font-medium text-gray-900">{name}</td>
                    <td className="px-4 py-2 text-gray-700">{symbol}</td>
                    <td className="px-4 py-2 text-gray-700">{category}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{formatPrice(nav)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${return1Y >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{return1Y !== undefined ? formatPercent(return1Y) : '-'}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{volume !== undefined ? volume : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ReactModal>
  );
}

export default function DashboardPage() {
  const { categories, loading: catLoading, error: catError, refetch: refetchCategories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState('');
  const { etfs, loading: etfLoading, error: etfError, refetch: refetchEtfs } = useEtfsByCategory(selectedCategory);
  const [viewMode, setViewMode] = useState('grid');
  const [liveMode, setLiveMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecommendation, setSelectedRecommendation] = useState('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState('All');

  // Live data state
  const [liveEtfs, setLiveEtfs] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);

  // Add timestamp state for live data
  const [liveTimestamp, setLiveTimestamp] = useState(null);

  // For bulk compare
  const [selectedEtfs, setSelectedEtfs] = useState([]);

  // Compare modal state
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Set default filters on mount and on refresh
  useEffect(() => {
    if (categories.length > 0) {
      // Set to 'nifty50' if available, otherwise first category
      const defaultCategory = categories.find(cat => cat.key === 'nifty50')?.key || categories[0]?.key || '';
      setSelectedCategory(defaultCategory);
      setSelectedRecommendation('All');
      setSelectedPriceRange('All');
      setSearchTerm('');
    }
  }, [categories]);

  // Additional effect to ensure defaults are set on page load/refresh
  useEffect(() => {
    // This runs on every page load/refresh
    if (categories.length > 0 && !selectedCategory) {
      const defaultCategory = categories.find(cat => cat.key === 'nifty50')?.key || categories[0]?.key || '';
      setSelectedCategory(defaultCategory);
    }
  }, []);

  // Reset filters and search when toggling live/cached data
  useEffect(() => {
    if (categories.length > 0) {
      const defaultCategory = categories.find(cat => cat.key === 'nifty50')?.key || categories[0]?.key || '';
      setSelectedCategory(defaultCategory);
      setSelectedRecommendation('All');
      setSelectedPriceRange('All');
      setSearchTerm('');
    }
  }, [liveMode]);

  // Fetch live ETF data when live mode is enabled
  useEffect(() => {
    if (!liveMode) {
      setLiveEtfs([]);
      setLiveError(null);
      setLiveTimestamp(null);
      return;
    }

    const fetchLiveData = async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const data = await fetchLiveEtfs();
        console.log('Live ETF data received:', data);
        console.log('First ETF sample:', data.data?.[0]);
        setLiveEtfs(data.data || []);
        setLiveTimestamp(data.timestamp || new Date().toISOString());
      } catch (err) {
        console.error('Error fetching live ETF data:', err);
        setLiveError(err.message || 'Failed to fetch live ETF data');
      } finally {
        setLiveLoading(false);
      }
    };

    fetchLiveData();
  }, [liveMode]);

  // Get the appropriate data source
  const dataSource = liveMode ? liveEtfs : etfs;
  const dataLoading = liveMode ? liveLoading : etfLoading;
  const dataError = liveMode ? liveError : etfError;

  // Filter live ETFs by category if in live mode
  const categoryFilteredData = liveMode 
    ? filterLiveEtfsByCategory(dataSource, selectedCategory)
    : dataSource;

  // Filtering logic (search, price, recommendation)
  const filteredEtfs = (dataSource || []).filter(etf => {
    // If 'All' is selected for category, skip category filtering
    const categoryIsAll = selectedCategory === 'All';
    const name = liveMode 
      ? (etf.assets || etf.symbol || '')
      : (etf.schemeName || etf.name || '');
    const nav = liveMode 
      ? parseFloat(etf.ltP || 0)
      : parseFloat(etf.latestNav || etf.nav || 0);

    // Get default category consistently
    const defaultCategory = categories.find(cat => cat.key === 'nifty50')?.key || categories[0]?.key || '';

    // If all filters are at default or all are 'All', show all ETFs (skip all filtering except search)
    const isDefault = (selectedCategory === defaultCategory || categoryIsAll) && selectedRecommendation === 'All' && selectedPriceRange === 'All' && searchTerm === '';
    if (isDefault) return true;

    let matches = name.toLowerCase().includes(searchTerm.toLowerCase());
    if (selectedPriceRange === 'lt100') matches = matches && nav < 100;
    if (selectedPriceRange === '100-500') matches = matches && nav >= 100 && nav <= 500;
    if (selectedPriceRange === 'gt500') matches = matches && nav > 500;
    if (selectedRecommendation !== 'All') {
      matches = matches && (etf.recommendation === selectedRecommendation);
    }
    // If not 'All' for category, filter by category as before
    if (!categoryIsAll && selectedCategory !== defaultCategory) {
      if (liveMode) {
        // Use your live category filter logic if needed
        // (already handled by filterLiveEtfsByCategory if you want)
      } else {
        matches = matches && etf.category === selectedCategory;
      }
    }
    return matches;
  });

  // Compute if all visible ETFs have the same NAV date
  let globalNavDate = null;
  if (!liveMode && filteredEtfs.length > 0) {
    const navDates = filteredEtfs.map(etf => etf.navDate).filter(Boolean);
    if (navDates.length > 0 && navDates.every(date => date === navDates[0])) {
      globalNavDate = navDates[0];
    }
  }

  const handleRefreshData = () => {
    refetchCategories();
    if (selectedCategory) {
      refetchEtfs();
    }
    if (liveMode) {
      // Re-fetch live data
      setLiveLoading(true);
      fetchLiveEtfs()
        .then(data => setLiveEtfs(data.data || []))
        .catch(err => setLiveError(err.message || 'Failed to fetch live ETF data'))
        .finally(() => setLiveLoading(false));
    }
    // Reset all filters and search with consistent default category
    const defaultCategory = categories.find(cat => cat.key === 'nifty50')?.key || categories[0]?.key || '';
    setSelectedCategory(defaultCategory);
    setSelectedRecommendation('All');
    setSelectedPriceRange('All');
    setSearchTerm('');
  };

  // Calculate enhanced stats for live mode
  const calculateLiveStats = () => {
    if (!liveMode || !liveEtfs.length) return {};
    
    const totalVolume = liveEtfs.reduce((sum, etf) => sum + (parseInt(etf.qty) || 0), 0);
    const totalTradeValue = liveEtfs.reduce((sum, etf) => sum + (parseFloat(etf.trdVal) || 0), 0);
    
    const changes = liveEtfs
      .map(etf => {
        const change = parseFloat(etf.per);
        return isNaN(change) ? 0 : change;
      })
      .filter(change => change !== 0);
    
    const avgChange = changes.length > 0 ? changes.reduce((sum, change) => sum + change, 0) / changes.length : 0;
    const positiveCount = changes.filter(change => change > 0).length;
    const negativeCount = changes.filter(change => change < 0).length;
    
    const prices = liveEtfs
      .map(etf => parseFloat(etf.ltP))
      .filter(price => !isNaN(price));
    
    const avgPrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
    
    return {
      totalVolume,
      totalTradeValue,
      avgChange,
      positiveCount,
      negativeCount,
      avgPrice,
      totalEtfs: liveEtfs.length
    };
  };

  const liveStats = calculateLiveStats();

  // Bulk compare handlers
  const handleToggleSelectEtf = useCallback((etfKey) => {
    setSelectedEtfs(prev =>
      prev.includes(etfKey)
        ? prev.filter(key => key !== etfKey)
        : [...prev, etfKey]
    );
  }, []);

  const handleClearSelectedEtfs = useCallback(() => setSelectedEtfs([]), []);

  // Compute if any filter is active (outside AdvancedFilter)
  const defaultCategory = categories.find(cat => cat.key === 'nifty50')?.key || categories[0]?.key || '';
  const isAnyFilterActive = categories.length > 0 && (
    selectedCategory !== defaultCategory ||
    selectedRecommendation !== 'All' ||
    selectedPriceRange !== 'All'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header liveMode={liveMode} />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {catLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatsCard 
                title="Total ETFs" 
                value={filteredEtfs.length.toString()} 
                change={liveMode ? `${liveStats.totalEtfs} live` : undefined}
                subtitle={liveMode ? "Active in market" : "Cached data"}
                icon={BarChart3}
              />
              <StatsCard 
                title={liveMode ? "Avg Price" : "Avg NAV"} 
                value={liveMode ? formatPrice(liveStats.avgPrice) : formatPrice(filteredEtfs.reduce((sum, etf) => sum + (parseFloat(etf.latestNav || etf.ltP || 0) || 0), 0) / Math.max(filteredEtfs.length, 1))}
                change={liveMode ? `${liveStats.avgChange >= 0 ? '+' : ''}${formatPercent(liveStats.avgChange)}` : undefined}
                subtitle={liveMode ? "Market average" : "Cached average"}
                icon={TrendingUp}
              />
              <StatsCard 
                title={liveMode ? "Market Sentiment" : "Categories"} 
                value={liveMode ? `${liveStats.positiveCount}/${liveStats.negativeCount}` : categories.length.toString()} 
                change={liveMode ? `${liveStats.positiveCount > liveStats.negativeCount ? 'Bullish' : 'Bearish'}` : "Active"}
                subtitle={liveMode ? "Gainers/Losers" : "Available categories"}
                icon={BarChart3}
              />
              <StatsCard 
                title={liveMode ? "Total Volume" : "Live Mode"} 
                value={liveMode ? formatVolume(liveStats.totalVolume) : (liveMode ? "Connected" : "Off")}
                change={liveMode ? formatCurrency(liveStats.totalTradeValue) : (liveMode ? "Real-time" : "Last updated")}
                subtitle={liveMode ? "Units traded" : "Data source: mfindia"}
                icon={TrendingUp}
              />
            </>
          )}
        </div>

        {/* Global NAV Date (if all the same) */}
        {!liveMode && globalNavDate && (
          <div className="mb-4 text-right text-sm text-gray-500">
            NAV Date: <span className="font-medium text-gray-900">{globalNavDate}</span>
          </div>
        )}

        {/* Market Activity Summary (Live Mode Only) */}
        {liveMode && liveEtfs.length > 0 && (
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Activity Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {liveStats.positiveCount}
                </div>
                <div className="text-sm text-success-600 font-medium">Gainers</div>
                <div className="text-xs text-gray-500">
                  {liveStats.totalEtfs > 0 ? `${((liveStats.positiveCount / liveStats.totalEtfs) * 100).toFixed(1)}%` : '0%'} of total
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {liveStats.negativeCount}
                </div>
                <div className="text-sm text-danger-600 font-medium">Losers</div>
                <div className="text-xs text-gray-500">
                  {liveStats.totalEtfs > 0 ? `${((liveStats.negativeCount / liveStats.totalEtfs) * 100).toFixed(1)}%` : '0%'} of total
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {formatVolume(liveStats.totalVolume)}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Volume</div>
                <div className="text-xs text-gray-500">
                  Units traded today
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(liveStats.totalTradeValue)}
                </div>
                <div className="text-sm text-gray-600 font-medium">Trade Value</div>
                <div className="text-xs text-gray-500">
                  Total value traded
                </div>
              </div>
            </div>
            
            {/* Market Sentiment Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Market Sentiment</span>
                <span>{liveStats.positiveCount > liveStats.negativeCount ? 'Bullish' : 'Bearish'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-danger-500 to-success-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${liveStats.totalEtfs > 0 ? (liveStats.positiveCount / liveStats.totalEtfs) * 100 : 50}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Bearish ({liveStats.negativeCount})</span>
                <span>Bullish ({liveStats.positiveCount})</span>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="card p-6 mb-8" style={{ overflow: 'visible' }}>
          {catLoading ? (
            <FilterBarSkeleton />
          ) : catError ? (
            <ErrorState error={catError} onRetry={refetchCategories} title="Failed to load categories" />
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 items-center">
              {/* Search Bar */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search ETFs..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="input w-full"
                />
              </div>
              {/* Advanced Filter Dropdown */}
              <AdvancedFilter
                category={selectedCategory}
                onCategoryChange={setSelectedCategory}
                categoryOptions={categories.map(cat => ({ value: cat.key, label: cat.label }))}
                recommendation={selectedRecommendation}
                onRecommendationChange={setSelectedRecommendation}
                price={selectedPriceRange}
                onPriceChange={setSelectedPriceRange}
                onClear={() => {
                  const defaultCategory = categories.find(cat => cat.key === 'nifty50')?.key || categories[0]?.key || '';
                  setSelectedCategory(defaultCategory);
                  setSelectedRecommendation('All');
                  setSelectedPriceRange('All');
                }}
              />
              {/* Live Toggle, View Toggle, Refresh Button (unchanged) */}
              <div className="flex items-center gap-4">
                {/* Live Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Live Updates</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={liveMode}
                      onChange={() => setLiveMode(!liveMode)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                {liveMode && (
                  <LiveDataIndicator 
                    timestamp={liveTimestamp} 
                    isConnected={!liveLoading && !liveError} 
                  />
                )}

                {/* View Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>

                {/* Refresh Button */}
                <button
                  onClick={handleRefreshData}
                  disabled={catLoading || dataLoading}
                  className="btn btn-secondary text-sm"
                >
                  {catLoading || dataLoading ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Show filter label above ETF list/grid if any filter is active */}
        {isAnyFilterActive && (
          <div className="mb-4 text-primary-700 font-semibold text-sm">Filters applied</div>
        )}

        {/* Compare Modal */}
        <CompareModal
          isOpen={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          etfs={filteredEtfs.filter(etf => {
            const etfKey = liveMode ? etf.symbol : (etf.amfiCode || etf.symbol || etf.schemeName);
            return selectedEtfs.includes(etfKey);
          })}
          liveMode={liveMode}
        />

        {/* ETF Grid or Table */}
        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <ETFCardSkeleton key={i} />
            ))}
          </div>
        ) : dataError ? (
          <ErrorState error={dataError} onRetry={() => window.location.reload()} />
        ) : filteredEtfs.length === 0 ? (
          <EmptyState 
            message="No ETFs found" 
            description="Try adjusting your filters or search terms."
          />
        ) : (
          viewMode === 'list' ? (
            <ETFTable 
              etfs={filteredEtfs} 
              liveMode={liveMode} 
              selectedEtfs={selectedEtfs}
              onToggleSelect={handleToggleSelectEtf}
            />
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
              {filteredEtfs.map(etf => {
                const etfKey = liveMode ? etf.symbol : (etf.amfiCode || etf.symbol || etf.schemeName);
                return (
                  <ETFCard
                    key={etfKey}
                    etf={etf}
                    liveMode={liveMode}
                    liveData={liveMode ? etf : null}
                    showNavDate={!globalNavDate}
                    selected={selectedEtfs.includes(etfKey)}
                    onToggleSelect={() => handleToggleSelectEtf(etfKey)}
                  />
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
} 