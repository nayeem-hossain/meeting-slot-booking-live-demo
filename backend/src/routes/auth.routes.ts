import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role } from "../generated/prisma/index.js";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash,
        role: Role.USER
      }
    });

    const authUser = { id: user.id, email: user.email, role: user.role };
    const token = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return res.status(201).json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const authUser = { id: user.id, email: user.email, role: user.role };
    const token = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return res.status(200).json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const payload = refreshSchema.parse(req.body);
    const dbToken = await prisma.refreshToken.findUnique({ where: { token: payload.refreshToken } });

    if (!dbToken || dbToken.expiresAt <= new Date()) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const decoded = verifyRefreshToken(payload.refreshToken);
    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    await prisma.refreshToken.delete({ where: { id: dbToken.id } });

    const authUser = { id: user.id, email: user.email, role: user.role };
    const token = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return res.json({ token, refreshToken });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const payload = refreshSchema.parse(req.body);
    await prisma.refreshToken.deleteMany({ where: { token: payload.refreshToken } });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});
