import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AuthUser } from "../types.js";

interface RefreshTokenPayload {
  sub: string;
  email: string;
  role: AuthUser["role"];
  type: "refresh";
}

export function signAccessToken(user: AuthUser): string {
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"];
  return jwt.sign(user, env.JWT_ACCESS_SECRET, {
    expiresIn
  });
}

export function signRefreshToken(user: AuthUser): string {
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"];
  const payload: RefreshTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: "refresh"
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
