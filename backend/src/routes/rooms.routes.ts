import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const roomSchema = z.object({
  name: z.string().min(2),
  capacity: z.number().int().positive(),
  features: z.array(z.string()).default([]),
  hourlyRate: z.number().positive()
});

export const roomRouter = Router();

roomRouter.get("/", async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({ orderBy: { createdAt: "desc" } });
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

roomRouter.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const payload = roomSchema.parse(req.body);
    const room = await prisma.room.create({ data: payload });
    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
});
