/**
 * Custom retry policy with exponential backoff and jitter.
 * 
 * Retry rules:
 * - YES on timeouts, 429 rate limits, and 5xx server errors
 * - NEVER on 400, 401, or 403 (bad request, auth failure, permission denied)
 * - Obey Retry-After header if provided (either seconds or HTTP-Date)
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseRetryAfter(headerValue) {
  if (!headerValue) return null;

  // Check if integer seconds
  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Check if HTTP date
  const date = Date.parse(headerValue);
  if (!Number.isNaN(date)) {
    const diff = date - Date.now();
    return Math.max(0, diff);
  }

  return null;
}

export function isRetryableError(err) {
  const status = err.status || err.statusCode;

  // Never retry client authentication or authorization errors
  if (status === 400 || status === 401 || status === 403) {
    return false;
  }

  // Timeouts are retryable
  if (
    err.name === "APIConnectionTimeoutError" ||
    err.code === "ETIMEDOUT" ||
    (err.message && err.message.toLowerCase().includes("timeout")) ||
    status === 504
  ) {
    return true;
  }

  // Rate limits (429) and Server errors (5xx) are retryable
  if (status === 429 || (status >= 500 && status <= 599)) {
    return true;
  }

  // Network connection errors
  if (err.code === "ECONNRESET" || err.code === "ENOTFOUND" || err.name === "APIConnectionError") {
    return true;
  }

  return false;
}

export async function callWithRetry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelaysMs = [1000, 2000, 4000];

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;

      if (!isRetryableError(err) || attempt > maxRetries) {
        throw err;
      }

      // Determine delay
      let delayMs = baseDelaysMs[attempt - 1] || 4000;

      // Check for Retry-After header
      const retryAfterHeader = err.headers?.get?.("retry-after") || err.headers?.["retry-after"];
      const headerDelay = parseRetryAfter(retryAfterHeader);
      if (headerDelay !== null) {
        delayMs = headerDelay;
      } else {
        // Add random jitter (0-250ms)
        const jitter = Math.floor(Math.random() * 250);
        delayMs += jitter;
      }

      console.warn(`[Retry Policy] Attempt ${attempt} failed with ${err.status || err.name}: ${err.message}. Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
}
