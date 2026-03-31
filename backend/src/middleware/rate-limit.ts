import { NextFunction, Request, Response } from "express";

interface RateLimiterConfig {
  windowMs: number;
  max: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function cleanupExpiredEntries(now: number): void {
  if (store.size < 1000) {
    return;
  }

  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function createRateLimiter(config: RateLimiterConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const key = `${req.method}:${req.path}:${getClientIp(req)}`;
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, {
        count: 1,
        resetAt: now + config.windowMs
      });
      next();
      return;
    }

    existing.count += 1;

    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));

    if (existing.count > config.max) {
      res.status(429).json({
        message: "Too many requests. Please try again shortly."
      });
      return;
    }

    next();
  };
}
