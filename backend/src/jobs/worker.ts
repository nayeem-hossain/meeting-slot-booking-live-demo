import { Job, Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { EmailJobPayload, enqueueDeadLetterEmailJob } from "./queue.js";
import { sendBookingEmail } from "../services/emailService.js";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  "email-notifications",
  async (job: Job<EmailJobPayload>) => {
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
  const attempts = job?.attemptsMade ?? 0;
  const maxAttempts = Number(job?.opts?.attempts ?? 1);

  // eslint-disable-next-line no-console
  console.error(`[worker] failed job ${job?.name} (${job?.id}) attempt ${attempts}/${maxAttempts}: ${error.message}`);

  if (!job || !job.name || attempts < maxAttempts) {
    return;
  }

  if (job.name === "booking-confirmation"
    || job.name === "booking-cancellation"
    || job.name === "booking-reminder-24h"
    || job.name === "booking-reminder-1h") {
    void enqueueDeadLetterEmailJob({
      jobName: job.name,
      payload: job.data,
      failedReason: error.message,
      attemptsMade: attempts
    }).catch((deadLetterError) => {
      // eslint-disable-next-line no-console
      console.error(`[worker] failed to enqueue dead-letter record for job ${job.id}: ${deadLetterError.message}`);
    });
  }
});
