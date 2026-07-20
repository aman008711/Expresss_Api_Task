const express = require('express');
const swaggerUi = require('swagger-ui-express');
const taskRoutes = require('./client/routes/taskroutes');
const errorHandler = require('./client/middleware/errorhandler');
const swaggerDocument = require('./client/swagger/openapi.json');
require('./database/database'); // Initialize database

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json());

// Root routes
app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks']
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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
