const express = require('express');
const cors = require('cors');
const path = require('path');
const getEtfListHandler = require('./src/api/etf/getEtfList');
const fetchNavsHandler = require('./src/api/etf/fetchNavs');
const getNavBySchemeIdHandler = require('./src/api/etf/getNavBySchemeId');
const getCategoriesHandler = require('./src/api/etf/getCategories');
const getEtfsByCategoryHandler = require('./src/api/etf/getEtfsByCategory');
const fetchNseEtfsHandler = require('./src/api/etf/fetchNseEtfs');
const connectDB = require('./src/db');
const getHighLiquidityEtfsHandler = require('./src/api/etf/getHighLiquidityEtfs');
const { ensureNavData } = require('./src/services/navDataService');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const syncHighLiquidityHistoricalHandler = require('./src/api/etf/syncHighLiquidityHistorical');

// Import stock sector routes
const stockSectorRoutes = require('./src/api/stock/getStockSector');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json()); // Add JSON body parser for POST requests

// Serve static files from the project root
app.use(express.static(path.join(__dirname, '..')));

// Serve invom_ai.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'invom_ai.html'));
});

// Serve a blank favicon to silence 404s
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.get('/api/etfs', getEtfListHandler);
app.get('/api/etfs/list', getEtfListHandler);
app.get('/api/etfs/categories', getCategoriesHandler);
app.get('/api/etfs/category/:categoryKey', getEtfsByCategoryHandler);
app.get('/api/nav', getNavBySchemeIdHandler);
app.post('/api/fetch-navs', fetchNavsHandler);
app.get('/api/etfs/live', fetchNseEtfsHandler);
app.get('/api/etfs/high-liquidity', getHighLiquidityEtfsHandler);
app.post('/api/sync/high-liquidity/historical-navs', syncHighLiquidityHistoricalHandler);

// Add stock sector routes
app.use('/api/stock', stockSectorRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// On server startup, ensure today's NAV data is present (fetch/write/save if missing)
(async () => {
  try {
    await ensureNavData();
    console.log('[Startup] ETF NAV data ensured for today.');
  } catch (err) {
    console.error('[Startup] Failed to ensure ETF NAV data:', err);
  }
})();

connectDB()
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

