const TIMEOUT_MS = 5000;

/**
 * Best-effort CORS relays, only used as a last resort when the CI price snapshot
 * is missing a symbol. They are unreliable — allorigins and codetabs have both
 * returned 522 and corsproxy.io now demands an API key — so nothing depends on
 * them and every failure path must degrade to "no data" rather than a guess.
 * Override with VITE_CORS_PROXIES (comma separated) if you run your own relay.
 */
const DEFAULT_PROXY_TEMPLATES = [
  'https://api.allorigins.win/raw?url={url}',
  'https://api.codetabs.com/v1/proxy?quest={url}'
];

function buildProxyStrategies() {
  const configured = (import.meta.env?.VITE_CORS_PROXIES || '')
    .split(',')
    .map(template => template.trim())
    .filter(Boolean);

  const templates = configured.length > 0 ? configured : DEFAULT_PROXY_TEMPLATES;
  return templates.map(template => url => template.replace('{url}', encodeURIComponent(url)));
}

const PROXY_STRATEGIES = buildProxyStrategies();

async function attempt(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fetchResilient(url, options = {}) {
  let lastError;

  try {
    const response = await attempt(url, options);
    if (response.ok) return response;
    lastError = new Error(`HTTP ${response.status}`);
  } catch (error) {
    lastError = error;
  }

  for (const wrap of PROXY_STRATEGIES) {
    try {
      const response = await attempt(wrap(url), options);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
