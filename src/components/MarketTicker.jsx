import { useMarketDataContext } from '../hooks/useMarketDataContext';
import './MarketTicker.css';

export default function MarketTicker() {
  const { commodities, currency, metalETFs } = useMarketDataContext();
  const items = [];

  const push = (label, icon, price, change) => {
    if (price != null && change != null && !isNaN(price)) {
      items.push({ label, icon, price, change });
    }
  };

  if (commodities?.gold?.price != null) push('Gold', '🥇', `$${commodities.gold.price.toFixed(2)}`, commodities.gold.change);
  if (commodities?.silver?.price != null) push('Silver', '🥈', `$${commodities.silver.price.toFixed(2)}`, commodities.silver.change);
  if (commodities?.brentCrude?.price != null) push('Brent', '🛢️', `$${commodities.brentCrude.price.toFixed(2)}`, commodities.brentCrude.change);
  if (commodities?.crudeOil?.price != null) push('WTI', '⛽', `$${commodities.crudeOil.price.toFixed(2)}`, commodities.crudeOil.change);
  if (currency?.usdInr?.rate != null) push('USD/INR', '💵', `₹${currency.usdInr.rate.toFixed(2)}`, currency.usdInr.change);
  if (metalETFs?.goldETF?.price != null) push('GLD', '📊', `$${metalETFs.goldETF.price.toFixed(2)}`, metalETFs.goldETF.change);
  if (metalETFs?.silverETF?.price != null) push('SLV', '📊', `$${metalETFs.silverETF.price.toFixed(2)}`, metalETFs.silverETF.change);

  if (items.length === 0) return null;

  return (
    <div className="market-ticker">
      <div className="ticker-content">
        {items.map((item, i) => (
          <div key={i} className="ticker-item">
            <span className="ticker-icon">{item.icon}</span>
            <span className="ticker-label">{item.label}</span>
            <span className="ticker-price">{item.price}</span>
            <span className={`ticker-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
              {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
