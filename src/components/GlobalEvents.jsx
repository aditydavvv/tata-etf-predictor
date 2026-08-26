import { useState, useMemo } from 'react';
import { globalEvents, categoryColors } from '../data/events';
import EventCard from './EventCard';
import './GlobalEvents.css';

export default function GlobalEvents() {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('severity');

  const categories = useMemo(() => [
    { key: 'all', label: 'All Events', count: globalEvents.length },
    ...Object.entries(categoryColors).map(([key, val]) => ({
      key,
      label: val.label,
      count: globalEvents.filter(e => e.category === key).length
    }))
  ], []);

  const filtered = useMemo(() => {
    let result = filter === 'all' ? [...globalEvents] : globalEvents.filter(e => e.category === filter);

    if (sortBy === 'severity') {
      const order = { high: 0, medium: 1, low: 2 };
      result.sort((a, b) => order[a.severity] - order[b.severity]);
    } else if (sortBy === 'impact') {
      result.sort((a, b) => b.impact.magnitude - a.impact.magnitude);
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    return result;
  }, [filter, sortBy]);

  const sentimentCounts = useMemo(() => ({
    positive: globalEvents.filter(e => e.impact.direction === 'positive').length,
    negative: globalEvents.filter(e => e.impact.direction === 'negative').length,
    mixed: globalEvents.filter(e => e.impact.direction === 'mixed').length
  }), []);

  return (
    <section className="global-events">
      <div className="section-header">
        <h2>Global Events Affecting Indian Markets</h2>
      </div>

      <div className="sentiment-bar">
        <div className="sentiment-label">Overall Market Sentiment:</div>
        <div className="sentiment-indicators">
          <span className="sentiment-item positive">
            <span className="dot"></span> Bullish: {sentimentCounts.positive}
          </span>
          <span className="sentiment-item negative">
            <span className="dot"></span> Bearish: {sentimentCounts.negative}
          </span>
          <span className="sentiment-item mixed">
            <span className="dot"></span> Mixed: {sentimentCounts.mixed}
          </span>
        </div>
      </div>

      <div className="controls">
        <div className="filter-tabs">
          {categories.map(cat => (
            <button
              key={cat.key}
              className={`filter-tab ${filter === cat.key ? 'active' : ''}`}
              onClick={() => setFilter(cat.key)}
            >
              {cat.label}
              <span className="count">{cat.count}</span>
            </button>
          ))}
        </div>

        <div className="sort-controls">
          <label className="sort-label">Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            <option value="severity">Severity</option>
            <option value="impact">Impact Level</option>
            <option value="recent">Most Recent</option>
          </select>
        </div>
      </div>

      <div className="events-list">
        {filtered.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="no-events">
          <p>No events found for this category.</p>
        </div>
      )}
    </section>
  );
}
