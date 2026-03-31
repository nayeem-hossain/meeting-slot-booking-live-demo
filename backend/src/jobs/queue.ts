import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const emailQueue = new Queue("email-notifications", { connection });

type EmailJobName =
  | "booking-confirmation"
  | "booking-cancellation"
  | "booking-reminder-24h"
  | "booking-reminder-1h";

interface EmailJobPayload {
  to: string;
  bookingId: string;
  startTime?: string;
}

interface EnqueueOptions {
  delay?: number;
  jobId?: string;
}

async function enqueueEmailJob(name: EmailJobName, payload: EmailJobPayload, options: EnqueueOptions = {}): Promise<void> {
  await emailQueue.add(name, payload, {
    delay: options.delay,
    jobId: options.jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
}

export async function enqueueBookingConfirmation(payload: { to: string; bookingId: string }): Promise<void> {
  await enqueueEmailJob("booking-confirmation", payload);
}

export async function enqueueBookingCancellation(payload: { to: string; bookingId: string }): Promise<void> {
  await enqueueEmailJob("booking-cancellation", payload);
}

export async function enqueueBookingReminders(payload: { to: string; bookingId: string; startTime: string }): Promise<void> {
  const bookingStart = new Date(payload.startTime).getTime();
  if (Number.isNaN(bookingStart)) {
    return;
  }

  const now = Date.now();
  const reminders: Array<{ name: EmailJobName; offsetMs: number }> = [
    { name: "booking-reminder-24h", offsetMs: 24 * 60 * 60 * 1000 },
    { name: "booking-reminder-1h", offsetMs: 60 * 60 * 1000 }
  ];

  for (const reminder of reminders) {
    const delay = bookingStart - now - reminder.offsetMs;
    if (delay <= 0) {
      continue;
    }

    await enqueueEmailJob(reminder.name, payload, {
      delay,
      jobId: `${reminder.name}:${payload.bookingId}`
    });
  }
}

export async function cancelBookingReminders(bookingId: string): Promise<void> {
  const reminderJobIds = [
    `booking-reminder-24h:${bookingId}`,
    `booking-reminder-1h:${bookingId}`
  ];

  for (const jobId of reminderJobIds) {
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}
