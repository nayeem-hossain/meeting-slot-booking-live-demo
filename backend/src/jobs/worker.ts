import { Job, Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { sendBookingEmail } from "../services/emailService.js";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  "email-notifications",
  async (job: Job<{ to: string; bookingId: string; startTime?: string }>) => {
    if (job.name === "booking-confirmation") {
      await sendBookingEmail(
        job.data.to,
        "Booking Confirmation",
        `Your booking ${job.data.bookingId} has been confirmed.`
      );
      return;
    }

    if (job.name === "booking-cancellation") {
      await sendBookingEmail(
        job.data.to,
        "Booking Cancelled",
        `Your booking ${job.data.bookingId} has been cancelled.`
      );
      return;
    }

    if (job.name === "booking-reminder-24h" || job.name === "booking-reminder-1h") {
      const reminderWindow = job.name === "booking-reminder-24h" ? "24 hours" : "1 hour";
      const startTimeLabel = job.data.startTime
        ? new Date(job.data.startTime).toLocaleString()
        : "your scheduled time";

      await sendBookingEmail(
        job.data.to,
        `Booking Reminder (${reminderWindow})`,
        `Reminder: your booking ${job.data.bookingId} starts at ${startTimeLabel}.`
      );
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  // eslint-disable-next-line no-console
  console.log(`[worker] completed job ${job.name} (${job.id})`);
});

worker.on("failed", (job, error) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] failed job ${job?.name} (${job?.id}): ${error.message}`);
});
