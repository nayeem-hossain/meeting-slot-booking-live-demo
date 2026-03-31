import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
});

export async function sendBookingEmail(to: string, subject: string, text: string): Promise<void> {
  await transporter.sendMail({
    from: "no-reply@meeting-slot-booking.local",
    to,
    subject,
    text
  });
}
