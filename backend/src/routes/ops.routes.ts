import { Router } from "express";
import { getQueueHealthSnapshot } from "../jobs/queue.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

export const opsRouter = Router();

opsRouter.use(requireAuth, requireRole("ADMIN"));

opsRouter.get("/queues", async (_req, res, next) => {
  try {
    const snapshot = await getQueueHealthSnapshot();
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});
