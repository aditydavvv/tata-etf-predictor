const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Keep this in sync with navDataService.NAV_DATA_DIR so the cache written by
// the startup sync is the same cache that is read here. Previously these two
// pointed at different folders, so a stale file was served forever.
const NAV_DATA_DIR = path.join(__dirname, '..', '..', 'nav_data');
const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';

const INITIAL_CATEGORIES = {
    "nifty50": {
        "label": "Nifty 50",
        "description": "ETFs tracking the Nifty 50 index",
        "amfiCodes": {},
        "keywords": ["nifty 50", "niftybees", "niftyetf", "nifty bees"]
    },
    "banking": {
        "label": "Banking",
        "description": "ETFs focused on banking sector stocks",
        "amfiCodes": {},
        "keywords": ["bank", "banking", "bankbees", "nifty bank"]
    },
    "psuBanking": {
        "label": "PSU Banking",
        "description": "ETFs focused on public sector banks",
        "amfiCodes": {},
        "keywords": ["psu bank", "psubnkbees"]
    },
    "privateBanking": {
        "label": "Private Banking",
        "description": "ETFs focused on private sector banks",
        "amfiCodes": {},
        "keywords": ["private bank", "pvt bank"]
    },
    "largeCap": {
        "label": "Large Cap",
        "description": "ETFs focused on large cap companies",
        "amfiCodes": {},
        "keywords": ["largecap", "top 100", "nifty 100"]
    },
    "midCap": {
        "label": "Mid Cap",
        "description": "ETFs focused on mid cap companies",
        "amfiCodes": {},
        "keywords": ["midcap", "midcap 150", "juniorbees"]
    },
    "smallCap": {
        "label": "Small Cap",
        "description": "ETFs focused on small cap companies",
        "amfiCodes": {},
        "keywords": ["smallcap", "small cap 250"]
    },
    "it": {
        "label": "Information Technology",
        "description": "ETFs focused on information technology sector",
        "amfiCodes": {},
        "keywords": ["it", "tech", "nifty it", "itbees"]
    },
    "sensex": {
        "label": "Sensex",
        "description": "ETFs tracking the Sensex index",
        "amfiCodes": {},
        "keywords": ["sensex"]
    },
    "gold": {
        "label": "Precious Metals - Gold",
        "description": "ETFs investing in gold",
        "amfiCodes": {},
        "keywords": ["gold", "goldbees"]
    },
    "silver": {
        "label": "Precious Metals - Silver",
        "description": "ETFs investing in silver",
        "amfiCodes": {},
        "keywords": ["silver", "silverbees"]
    },
    "next50": {
        "label": "Next 50",
        "description": "ETFs tracking Next 50 index",
        "amfiCodes": {},
        "keywords": ["nifty next 50", "juniorbees"]
    },
    "liquid": {
        "label": "Liquid",
        "description": "Liquid ETFs for short term investments",
        "amfiCodes": {},
        "keywords": ["liquid", "liquidbees"]
    },
    "international": {
        "label": "International",
        "description": "ETFs with international exposure",
        "amfiCodes": {},
        "keywords": ["nasdaq", "sp 500", "international", "global"]
    },
    "consumption": {
        "label": "Consumption",
        "description": "ETFs focused on consumer goods and services",
        "amfiCodes": {},
        "keywords": ["consumption", "consumer"]
    },
    "healthcare": {
        "label": "Healthcare",
        "description": "ETFs focused on healthcare sector",
        "amfiCodes": {},
        "keywords": ["healthcare", "pharma"]
    },
    "gilt": {
        "label": "Gilt",
        "description": "Government securities ETFs",
        "amfiCodes": {},
        "keywords": ["gsec", "gilt", "government bond"]
    },
    "momentum": {
        "label": "Momentum",
        "description": "Momentum factor based ETFs",
        "amfiCodes": {},
        "keywords": ["momentum"]
    },
    "value": {
        "label": "Value",
        "description": "Value factor based ETFs",
        "amfiCodes": {},
        "keywords": ["value"]
    },
    "quality": {
        "label": "Quality",
        "description": "Quality factor based ETFs",
        "amfiCodes": {},
        "keywords": ["quality"]
    },
    "infrastructure": {
        "label": "Infrastructure",
        "description": "Infrastructure sector ETFs",
        "amfiCodes": {},
        "keywords": ["infra", "infrastructure"]
    },
    "lowVolatility": {
        "label": "Low Volatility",
        "description": "Low volatility ETFs",
        "amfiCodes": {},
        "keywords": ["low vol", "lowvol"]
    },
    "equalWeight": {
        "label": "Equal Weight",
        "description": "Equal weighted index ETFs",
        "amfiCodes": {},
        "keywords": ["equal weight", "equalo"]
    },
    "metals": {
        "label": "Metals",
        "description": "Metal sector ETFs",
        "amfiCodes": {},
        "keywords": ["metal"]
    },
    "misc": {
        "label": "Miscellaneous / Uncategorized",
        "description": "ETFs that didn't fit other categories or are newly discovered and require manual review.",
        "amfiCodes": {},
        "keywords": []
    }
};

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayNavFilePath() {
  return path.join(NAV_DATA_DIR, `etf_navs_categorized_${getTodayDateString()}.json`);
}

// Newest cached file on disk (used only as an explicit last-resort fallback).
function getLatestNavFile() {
  if (!fs.existsSync(NAV_DATA_DIR)) return null;
  const files = fs.readdirSync(NAV_DATA_DIR)
    .filter(f => f.startsWith('etf_navs_categorized_') && f.endsWith('.json'))
    .sort();
  return files.length > 0 ? path.join(NAV_DATA_DIR, files[files.length - 1]) : null;
}

// A cache is only usable if it actually contains funds.
function hasFunds(categories) {
  return !!categories &&
    typeof categories === 'object' &&
    Object.values(categories).some(cat => cat && Array.isArray(cat.funds) && cat.funds.length > 0);
}

async function fetchAmfiNavTxt() {
  try {
    const response = await axios.get(AMFI_NAV_URL, { timeout: 20000 });
    return response.data;
  } catch (err) {
    console.error('Failed to fetch NAVAll.txt from AMFI:', err.message);
    return null;
  }
}

// Pick one growth row per scheme, preferring Direct plans.
// AMFI changed NAVAll.txt from a 6-column layout (plan/option embedded in the
// scheme name) to an 8-column layout (dedicated Plan and Option columns), so we
// handle both instead of assuming a fixed field count.
function selectLatestGrowthEtfs(records) {
  const etfKeywords = ['ETF', 'BEES', 'EXCHANGE TRADED FUND'];
  const chosen = new Map();

  for (const record of records) {
    const rawName = (record['Scheme Name'] || '').trim();
    const name = rawName.toUpperCase();
    if (!etfKeywords.some(keyword => name.includes(keyword))) continue;

    const hasPlanColumns = Object.prototype.hasOwnProperty.call(record, 'Plan') ||
      Object.prototype.hasOwnProperty.call(record, 'Option');

    let rank;
    let dedupeKey;

    if (hasPlanColumns) {
      const plan = (record['Plan'] || '').toUpperCase();
      const option = (record['Option'] || '').toUpperCase();

      // Keep growth options only; drop IDCW / dividend / payout variants.
      if (option && !option.includes('GROWTH')) continue;
      if (/IDCW|DIVIDEND|PAYOUT|REINVEST|BONUS/.test(option)) continue;

      rank = plan.includes('DIRECT') ? 0 : plan.includes('REGULAR') ? 2 : 1;
      dedupeKey = name;
    } else {
      // Legacy format: plan/option were part of the scheme name.
      if (/REGULAR|IDCW|DIVIDEND|PAYOUT|REINVEST|BONUS/.test(name)) continue;
      rank = name.includes('DIRECT') ? 0 : 1;
      dedupeKey = name
        .replace(/\b(DIRECT|REGULAR)\s*PLAN\b/g, '')
        .replace(/\b(GROWTH|IDCW|DIVIDEND|PAYOUT|REINVEST|BONUS)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const existing = chosen.get(dedupeKey);
    if (!existing || rank < existing.rank) {
      chosen.set(dedupeKey, { rank, record });
    }
  }

  return Array.from(chosen.values()).map(entry => entry.record);
}

function parseEtfFromRawTxt(rawTxt) {
  try {
    const { parse } = require('csv-parse/sync');
    const lines = rawTxt.replace(/\r/g, '').split('\n');
    // Step 1: Find the actual header index
    const headerIndex = lines.findIndex(line =>
      line.startsWith('Scheme Code;')
    );
    if (headerIndex === -1) {
      throw new Error('No valid header line found in AMFI response.');
    }
    // Step 2: Derive the expected field count from the header itself.
    // AMFI can and does add/remove columns, so hardcoding a number here is what
    // silently broke the dashboard before.
    const expectedFields = lines[headerIndex].split(';').length;
    const validData = lines.slice(headerIndex).filter(line => {
      // Filter out empty lines and AMC headings like "Axis Mutual Fund"
      return line.includes(';') && line.split(';').length === expectedFields;
    }).join('\n');
    // Step 3: Parse using csv-parse
    const records = parse(validData, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    // Step 4: Keep only ETFs, one growth row per scheme (Direct preferred)
    return selectLatestGrowthEtfs(records);
  } catch (err) {
    return { error: `Failed to parse AMFI data: ${err.message}` };
  }
}

function categorizeEtfs(etfs, categories) {
  // Deep clone categories to avoid mutation
  const result = JSON.parse(JSON.stringify(categories));
  // Clear funds arrays
  Object.values(result).forEach(cat => { cat.funds = []; });

  for (const etf of etfs) {
    const name = (etf['Scheme Name'] || etf.schemeName || '').toUpperCase();
    // Filter out ETFs with 'Regular' in the name
    if (name.includes('REGULAR')) continue;
    let matched = false;
    for (const [catKey, cat] of Object.entries(result)) {
      if (cat.keywords && cat.keywords.some(keyword => name.includes(keyword.toUpperCase()))) {
        cat.funds.push({
          symbol: '', // or infer from name
          schemeName: etf['Scheme Name'] || etf.schemeName,
          amfiCode: etf['Scheme Code'] || etf.amfiCode,
          latestNav: etf['Net Asset Value'] || etf.latestNav,
          navDate: etf['Date'] || etf.navDate
        });
        matched = true;
        break;
      }
    }
    if (!matched && result.misc) {
      result.misc.funds.push({
        symbol: '',
        schemeName: etf['Scheme Name'] || etf.schemeName,
        amfiCode: etf['Scheme Code'] || etf.amfiCode,
        latestNav: etf['Net Asset Value'] || etf.latestNav,
        navDate: etf['Date'] || etf.navDate
      });
    }
  }
  // Remove empty categories
  Object.keys(result).forEach(key => {
    if (!result[key].funds.length) delete result[key];
  });
  return result;
}

async function readCategoriesFromFile(filePath) {
  const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  return parsed.categories || parsed; // support both {categories: ...} and direct
}

async function getCategorizedEtfList({ force = false } = {}) {
  const todayFile = getTodayNavFilePath();

  // 1. Only ever serve TODAY's cache. Serving an old file (the previous bug)
  //    is what made the dashboard show stale/wrong NAVs after a few days.
  if (!force) {
    try {
      const categories = await readCategoriesFromFile(todayFile);
      if (hasFunds(categories)) return categories;
      console.warn('[NAV] Today\'s cache is empty, refetching from AMFI...');
    } catch (err) {
      // No cache for today yet – fall through to a live fetch.
    }
  }

  // 2. Fetch fresh data from AMFI.
  console.log('[NAV] Fetching live NAV data from AMFI...');
  const rawTxt = await fetchAmfiNavTxt();
  if (rawTxt) {
    const etfs = parseEtfFromRawTxt(rawTxt);
    if (etfs.error) {
      console.error('Parsing error:', etfs.error);
    } else {
      const categorized = categorizeEtfs(etfs, INITIAL_CATEGORIES);
      if (hasFunds(categorized)) {
        try {
          await fs.promises.mkdir(NAV_DATA_DIR, { recursive: true });
          await fs.promises.writeFile(todayFile, JSON.stringify({ categories: categorized }, null, 4));
        } catch (writeErr) {
          console.error('[NAV] Failed to write today\'s cache:', writeErr.message);
        }
        return categorized;
      }
      console.error('[NAV] Parsed AMFI data but no ETF funds were categorized.');
    }
  }

  // 3. Last resort: an old cache, but make the staleness loud and obvious.
  const latestNavFile = getLatestNavFile();
  if (latestNavFile) {
    console.warn(`[NAV] Live fetch failed – falling back to STALE cache ${path.basename(latestNavFile)}.`);
    const stale = await readCategoriesFromFile(latestNavFile);
    if (hasFunds(stale)) return stale;
  }

  return { error: 'Failed to fetch live NAV data from AMFI.' };
}

module.exports = {
  getCategorizedEtfList,
  fetchAmfiNavTxt,
  parseEtfFromRawTxt,
  getTodayNavFilePath,
  getTodayDateString,
  hasFunds,
  NAV_DATA_DIR
}; 