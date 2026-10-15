import React from 'react';
import { formatPrice, formatPercent } from '../../utils/format';

const ETF52WeekStats = ({ etf, liveData }) => {
  // Use live data if available, otherwise use cached data
  const data = liveData || etf;
  
  // Debug logging for live data
  if (liveData) {
    console.log('Live ETF data for 52-week stats:', data);
  }
  
  // Extract current price first
  const currentPrice = data?.ltP || data?.latestNav || data?.currentPrice || data?.nav || data?.lastPrice;
  
  // Extract 52-week stats from live data or calculate from available data
  // For live data from NSE, use the actual 52-week fields
  let weekHigh = data?.wkhi || data?.weekHigh || data?.high52Week || data?.high || data?.high52W || data?.high52;
  let weekLow = data?.wklo || data?.weekLow || data?.low52Week || data?.low || data?.low52W || data?.low52;
  
  // Extract daily stats from live data
  const dailyHigh = data?.high;
  const dailyLow = data?.low;
  const openPrice = data?.open;
  const prevClose = data?.prevClose;
  const volume = data?.qty;
  const tradeValue = data?.trdVal;
  
  // Extract percentage changes
  const dailyChange = data?.per;
  const yearlyChange = data?.yPC;
  const monthlyChange = data?.mPC;
  const perChange365d = data?.perChange365d;
  const perChange30d = data?.perChange30d;
  
  // Never fabricate figures. If real 52-week data is missing we show a clear
  // "not available" state below instead of inventing random high/low values.
  
  // Calculate fall from high
  const fallFromHigh = weekHigh && currentPrice ? 
    ((weekHigh - currentPrice) / weekHigh * 100) : null;
  
  // Calculate rise from low
  const riseFromLow = weekLow && currentPrice ? 
    ((currentPrice - weekLow) / weekLow * 100) : null;

  // Only show stats if we have meaningful data (high and low should be different)
  const hasValidData = weekHigh && weekLow && currentPrice && 
    Math.abs(weekHigh - weekLow) > 0.01; // Ensure high and low are different

  if (!hasValidData) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">52 Week Stats</h3>
        <div className="text-sm text-gray-500 text-center py-2">
          {liveData ? 'Live 52-week data not available' : 'Data not available'}
        </div>
        {liveData && currentPrice && (
          <div className="text-xs text-gray-400 text-center mt-2">
            Current: {formatPrice(currentPrice)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        {liveData ? 'Live Market Stats' : '52 Week Stats'}
      </h3>
      
      <div className="space-y-2">
        {/* 52-Week Range */}
        {weekHigh && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">52 Week High:</span>
            <span className="font-medium text-gray-900">
              {formatPrice(weekHigh)}
            </span>
          </div>
        )}
        
        {weekLow && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">52 Week Low:</span>
            <span className="font-medium text-gray-900">
              {formatPrice(weekLow)}
            </span>
          </div>
        )}
        
        {/* Daily Stats (Live Mode Only) */}
        {liveData && dailyHigh && dailyLow && (
          <>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Today's High:</span>
              <span className="font-medium text-gray-900">
                {formatPrice(dailyHigh)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Today's Low:</span>
              <span className="font-medium text-gray-900">
                {formatPrice(dailyLow)}
              </span>
            </div>
            {openPrice && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Open:</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(openPrice)}
                </span>
              </div>
            )}
          </>
        )}
        
        {/* Percentage Changes */}
        {fallFromHigh !== null && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Fall from High:</span>
            <span className={`font-medium ${fallFromHigh > 0 ? 'text-danger-600' : 'text-success-600'}`}>
              {fallFromHigh > 0 ? '-' : '+'}{formatPercent(Math.abs(fallFromHigh))}
            </span>
          </div>
        )}
        
        {riseFromLow !== null && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Rise from Low:</span>
            <span className="font-medium text-success-600">
              +{formatPercent(riseFromLow)}
            </span>
          </div>
        )}
        
        {/* Additional Live Stats */}
        {liveData && (
          <>
            {dailyChange !== undefined && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Today's Change:</span>
                <span className={`font-medium ${dailyChange >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {dailyChange >= 0 ? '+' : ''}{formatPercent(dailyChange)}
                </span>
              </div>
            )}
            
            {yearlyChange !== undefined && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">1Y Change:</span>
                <span className={`font-medium ${yearlyChange >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {yearlyChange >= 0 ? '+' : ''}{formatPercent(yearlyChange)}
                </span>
              </div>
            )}
            
            {monthlyChange !== undefined && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">1M Change:</span>
                <span className={`font-medium ${monthlyChange >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {monthlyChange >= 0 ? '+' : ''}{formatPercent(monthlyChange)}
                </span>
              </div>
            )}
            
            {volume && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Volume:</span>
                <span className="font-medium text-gray-900">
                  {new Intl.NumberFormat('en-IN').format(volume)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Price Range Visualization */}
      {weekHigh && weekLow && currentPrice && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{formatPrice(weekLow)}</span>
            <span>{formatPrice(weekHigh)}</span>
          </div>
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-gradient-to-r from-danger-500 to-success-500 rounded-full"
              style={{ width: '100%' }}
            />
            <div 
              className="absolute top-0 h-full w-1 bg-gray-900 rounded-full shadow-sm"
              style={{ 
                left: `${((currentPrice - weekLow) / (weekHigh - weekLow)) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center mt-1">
            Current: {formatPrice(currentPrice)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ETF52WeekStats; 