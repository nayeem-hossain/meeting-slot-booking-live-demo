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

const updateRoomSchema = roomSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required"
});

const roomIdParamSchema = z.object({
  id: z.uuid()
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

roomRouter.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { id } = roomIdParamSchema.parse(req.params);
    const payload = updateRoomSchema.parse(req.body);

    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Room not found" });
    }

    const room = await prisma.room.update({
      where: { id },
      data: payload
    });

    return res.json(room);
  } catch (error) {
    next(error);
  }
});

roomRouter.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { id } = roomIdParamSchema.parse(req.params);
    const existing = await prisma.room.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ message: "Room not found" });
    }

    await prisma.room.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});
