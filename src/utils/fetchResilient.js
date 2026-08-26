const TIMEOUT_MS = 5000;

const PROXY_STRATEGIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

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
