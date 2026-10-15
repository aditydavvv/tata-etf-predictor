const fs = require('fs/promises');
const {
  getCategorizedEtfList,
  getTodayNavFilePath,
  getTodayDateString,
  hasFunds,
  NAV_DATA_DIR
} = require('./amfiNavService');
const EtfNavCategorized = require('../models/EtfNavCategorized');
const connectDB = require('../db');
const HighLiquidityEtf = require('../models/HighLiquidityEtf');
const HistoricalNav = require('../models/HistoricalNav');
const axios = require('axios');

let navCache = null;
let navCacheDate = null;

// Save categorized ETF NAVs to MongoDB
async function saveCategorizedNavsToMongo(categorized) {
  await connectDB();
  const docs = Object.entries(categorized).map(([categoryKey, cat]) => ({
    categoryKey,
    label: cat.label,
    description: cat.description,
    keywords: cat.keywords,
    funds: cat.funds,
    importedAt: new Date()
  }));
  const categoryKeys = docs.map(doc => doc.categoryKey);
  await EtfNavCategorized.deleteMany({ categoryKey: { $in: categoryKeys } });
  await EtfNavCategorized.insertMany(docs);
}

// Ensure we have today's categorized NAV data in memory.
// getCategorizedEtfList owns the on-disk cache: it reads today's file, and only
// fetches/writes when today's data is missing or empty. We never reuse a file
// from a previous day, which is what previously caused stale numbers.
async function ensureNavData() {
  const today = getTodayDateString();
  if (navCache && navCacheDate === today && hasFunds(navCache)) return navCache;

  const navFilePath = getTodayNavFilePath();

  // Prefer today's on-disk cache.
  try {
    const fileData = JSON.parse(await fs.readFile(navFilePath, 'utf8'));
    const categories = fileData.categories || fileData;
    if (hasFunds(categories)) {
      navCache = categories;
      navCacheDate = today;
      return navCache;
    }
    console.warn('[NAV] Today\'s cache contains no funds, refetching...');
  } catch (err) {
    // No cache for today yet – will fetch below.
  }

  // Fetch fresh data (getCategorizedEtfList writes today's cache on success).
  const categorized = await getCategorizedEtfList();
  if (!categorized || categorized.error) {
    throw new Error(categorized?.error || 'Failed to fetch and categorize NAV data.');
  }
  if (!hasFunds(categorized)) {
    throw new Error('Fetched NAV data contained no ETF funds.');
  }

  navCache = categorized;
  navCacheDate = today;
  await saveCategorizedNavsToMongo(categorized);
  return navCache;
}

// Force a fresh fetch from AMFI, write today's cache and persist to MongoDB.
// Used by POST /api/fetch-navs.
async function fetchAndSaveNavData() {
  const categorized = await getCategorizedEtfList({ force: true });
  if (!categorized || categorized.error) {
    return { error: categorized?.error || 'Failed to fetch NAV data.' };
  }
  if (!hasFunds(categorized)) {
    return { error: 'Fetched NAV data contained no ETF funds.' };
  }
  navCache = categorized;
  navCacheDate = getTodayDateString();
  await saveCategorizedNavsToMongo(categorized);
  return { file: getTodayNavFilePath() };
}

// Get all available categories (key and label)
async function getAllCategories() {
  const navData = await ensureNavData();
  return Object.entries(navData).map(([key, cat]) => ({ key, label: cat.label }));
}

// Get ETFs for a specific category
async function getEtfsByCategory(categoryKey) {
  const navData = await ensureNavData();
  return navData[categoryKey] || null;
}

// Utility: Fetch all unique schemeIds (schemeCodes) from high-liquidity ETFs
async function getAllHighLiquiditySchemeIds() {
  const etfs = await HighLiquidityEtf.find({ schemeCode: { $exists: true, $ne: null } }).lean();
  return etfs.map(e => e.schemeCode).filter(Boolean);
}

// Fetch and save historical NAV data for a single schemeId
async function fetchAndSaveHistoricalNav(schemeId) {
  try {
    const url = `https://api.mfapi.in/mf/${schemeId}`;
    const response = await axios.get(url, { timeout: 15000 });
    if (response.data && response.data.meta && Array.isArray(response.data.data)) {
      await HistoricalNav.findOneAndUpdate(
        { schemeId: String(schemeId) },
        {
          schemeId: String(schemeId),
          meta: response.data.meta,
          data: response.data.data,
          status: response.data.status || 'SUCCESS',
          fetchedAt: new Date()
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      return { success: true, schemeId };
    } else {
      return { success: false, schemeId, error: 'Invalid response structure' };
    }
  } catch (err) {
    return { success: false, schemeId, error: err.message };
  }
}

module.exports = {
  NAV_DATA_DIR,
  ensureNavData,
  fetchAndSaveNavData,
  getAllCategories,
  getEtfsByCategory,
  getAllHighLiquiditySchemeIds,
  fetchAndSaveHistoricalNav
};
