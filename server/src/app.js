const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const httpRoutes = require('./routes/http');
const { env } = require('./config/env');

function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined'));

  app.use(httpRoutes);

  const webPath = path.resolve(__dirname, '../../webapp/public');
  app.use('/app', express.static(webPath));

  return app;
}

module.exports = { buildApp };
