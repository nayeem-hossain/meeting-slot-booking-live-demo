import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import {
  cancelBookingReminders,
  enqueueBookingCancellation,
  enqueueBookingConfirmation,
  enqueueBookingReminders
} from "../jobs/queue.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { emitRoomAvailability } from "../socket/io.js";
import { calculatePrice, getQuarterHourBlocks, validateSlotRange } from "../utils/slot.js";

const createBookingSchema = z.object({
  roomId: z.uuid(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime()
});

const availabilityQuerySchema = z.object({
  roomId: z.uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
});

export const bookingRouter = Router();

bookingRouter.use(requireAuth);

bookingRouter.get("/", async (req, res, next) => {
  try {
    const user = req.user!;

    const where = user.role === "USER"
      ? { userId: user.id }
      : {};

    const bookings = await prisma.booking.findMany({
      where,
      include: { room: true, user: { select: { id: true, email: true, name: true } } },
      orderBy: { startTime: "asc" }
    });

    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

bookingRouter.get("/availability", async (req, res, next) => {
  try {
    const query = availabilityQuerySchema.parse(req.query);
    const [year, month, day] = query.date.split("-").map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const busyIntervals = await prisma.booking.findMany({
      where: {
        roomId: query.roomId,
        status: "ACTIVE",
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart }
      },
      select: {
        startTime: true,
        endTime: true
      },
      orderBy: { startTime: "asc" }
    });

    return res.json({
      roomId: query.roomId,
      date: query.date,
      busyIntervals
    });
  } catch (error) {
    next(error);
  }
});

bookingRouter.post("/", async (req, res, next) => {
  try {
    const user = req.user!;
    const payload = createBookingSchema.parse(req.body);

    const startTime = new Date(payload.startTime);
    const endTime = new Date(payload.endTime);

    validateSlotRange(startTime, endTime);

    const room = await prisma.room.findUnique({ where: { id: payload.roomId } });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const overlapping = await prisma.booking.findFirst({
      where: {
        roomId: payload.roomId,
        status: "ACTIVE",
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      }
    });

    if (overlapping) {
      return res.status(409).json({ message: "Requested slot is not available" });
    }

    const blocks = getQuarterHourBlocks(startTime, endTime);
    const totalPrice = calculatePrice(room.hourlyRate, blocks);

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        roomId: room.id,
        startTime,
        endTime,
        totalPrice,
        status: "ACTIVE"
      },
      include: { room: true, user: { select: { email: true } } }
    });

    await enqueueBookingConfirmation({
      to: booking.user.email,
      bookingId: booking.id
    });

    await enqueueBookingReminders({
      to: booking.user.email,
      bookingId: booking.id,
      startTime: booking.startTime.toISOString()
    });

    emitRoomAvailability(room.id);

    return res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
});

bookingRouter.patch("/:id/cancel", requireRole("MODERATOR", "ADMIN", "USER"), async (req, res, next) => {
  try {
    const user = req.user!;
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { email: true } } }
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (user.role === "USER" && booking.userId !== user.id) {
      return res.status(403).json({ message: "You can cancel only your own bookings" });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" }
    });

    await enqueueBookingCancellation({
      to: booking.user.email,
      bookingId: booking.id
    });

    await cancelBookingReminders(booking.id);

    emitRoomAvailability(booking.roomId);

    return res.json(updated);
  } catch (error) {
    next(error);
  }
});
