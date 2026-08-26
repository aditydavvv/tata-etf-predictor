const TIMEOUT_MS = 3000;

const PROXY_STRATEGIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(withCacheBust(url))}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(withCacheBust(url))}`
];

function withCacheBust(url) {
  return `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
}

async function attempt(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
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
