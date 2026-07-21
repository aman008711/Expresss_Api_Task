const fs = require('fs');
const path = require('path');

// Load environment variables from .env if it exists
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn('Could not load .env file:', err);
  }
}

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const taskRoutes = require('./routes/taskRoutes');
const errorHandler = require('./middleware/errorHandler');
const swaggerDocument = require('./swagger/openapi.json');
require('./database/database'); // Initialize database

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json());

// Root routes
app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '3.0',
    database: 'PostgreSQL'
  });
});

app.get('/health', async (req, res) => {
  try {
    const { pool } = require('./database/database');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'down', error: err.message });
  }
});

// Swagger documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes
app.use('/tasks', taskRoutes);

// Handle malformed JSON bodies gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  return next(err);
});

// Error handling middleware
app.use(errorHandler);

function startServer(port = DEFAULT_PORT) {
  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

function startWithFallback(port = DEFAULT_PORT, maxAttempts = 10) {
  const server = startServer(port);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxAttempts > 0) {
      const nextPort = port + 1;
      console.log(`Port ${port} is busy. Trying ${nextPort} instead.`);
      server.close();
      startWithFallback(nextPort, maxAttempts - 1);
      return;
    }

    throw err;
  });
}

if (require.main === module) {
  startWithFallback();
}

module.exports = { app, startServer };
