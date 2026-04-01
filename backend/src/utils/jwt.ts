import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AuthUser } from "../types.js";

interface RefreshTokenPayload {
  sub: string;
  email: string;
  role: AuthUser["role"];
  type: "refresh";
}

const signJwt = jwt.sign as unknown as (
  payload: object,
  secret: string,
  options: { expiresIn: number }
) => string;

function parseDurationToSeconds(raw: string): number {
  const match = raw.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    throw new Error(`Invalid JWT duration format: ${raw}. Use formats like 15m, 7d, 12h.`);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const factor = unit === "s"
    ? 1
    : unit === "m"
      ? 60
      : unit === "h"
        ? 3600
        : 86400;

  return value * factor;
}

export function signAccessToken(user: AuthUser): string {
  return signJwt(user, env.JWT_ACCESS_SECRET, {
    expiresIn: parseDurationToSeconds(env.JWT_ACCESS_EXPIRES_IN)
  });
}

export function signRefreshToken(user: AuthUser): string {
  const payload: RefreshTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: "refresh"
  };

  return signJwt(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN)
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
