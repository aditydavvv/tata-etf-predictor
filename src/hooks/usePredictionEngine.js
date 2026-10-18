import { useState, useEffect, useRef } from 'react';
import { runEngine } from '../services/predictionEngine.js';

const RUN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Drives the self-correcting prediction engine. Journals the current prediction,
 * scores past ones against realised prices, and retrains the model. Re-runs on a
 * timer so that a new trading day is picked up without a reload.
 */
export default function usePredictionEngine({ prediction, price, ready }) {
  const [state, setState] = useState({ stats: null, loading: true });
  const runningRef = useRef(false);
  const predictionRef = useRef(prediction);
  const priceRef = useRef(price);
  predictionRef.current = prediction;
  priceRef.current = price;

  const hasPrice = Number.isFinite(price);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const tick = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const result = await runEngine({
          prediction: predictionRef.current,
          price: priceRef.current
        });
        if (!cancelled) {
          setState({ stats: result.stats, model: result.model, loading: false, lastRunAt: Date.now() });
        }
      } catch {
        if (!cancelled) setState(prev => ({ ...prev, loading: false }));
      } finally {
        runningRef.current = false;
      }
    };

    tick();
    const interval = setInterval(tick, RUN_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, hasPrice]);

  return state;
}
