import { useState, useEffect } from 'react';
import { DEFAULT_STRATEGY } from '../services/positionAdvisor.js';

const KEY = 'silver-etf-position-v1';

function read() {
  const fallback = { lots: [], strategy: { ...DEFAULT_STRATEGY } };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      lots: Array.isArray(parsed.lots) ? parsed.lots : [],
      strategy: { ...DEFAULT_STRATEGY, ...(parsed.strategy || {}) }
    };
  } catch {
    return fallback;
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — holding simply won't persist */
  }
}

/** Manually-entered holding, persisted to localStorage. */
export default function usePosition() {
  const [state, setState] = useState(read);

  useEffect(() => {
    write(state);
  }, [state]);

  const addLot = (lot) => {
    setState(prev => ({
      ...prev,
      lots: [...prev.lots, { id: globalThis.crypto?.randomUUID?.() ?? `lot-${Date.now()}`, ...lot }]
    }));
  };

  const removeLot = (id) => {
    setState(prev => ({ ...prev, lots: prev.lots.filter(l => l.id !== id) }));
  };

  const updateStrategy = (patch) => {
    setState(prev => ({ ...prev, strategy: { ...prev.strategy, ...patch } }));
  };

  const clearAll = () => {
    setState({ lots: [], strategy: { ...DEFAULT_STRATEGY } });
  };

  return { lots: state.lots, strategy: state.strategy, addLot, removeLot, updateStrategy, clearAll };
}
