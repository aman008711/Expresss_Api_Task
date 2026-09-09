import express from "express";
import triageRouter from "./routes/triage.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser
app.use(express.json());

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/triage", triageRouter);

// Malformed JSON handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: "Bad Request",
      field: "body",
      message: "Malformed JSON payload in request body",
    });
  }
  return next(err);
});

// Generic error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  return res.status(status).json({
    error: err.name || "Internal Server Error",
    message: err.message || "An unexpected error occurred",
  });
});

let server;
export function startServer(port = PORT) {
  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Triage API server listening on port ${port}`);
      resolve(server);
    });
  });
}

export function closeServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
}

// Start if run directly
if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  startServer();
}

export default app;
