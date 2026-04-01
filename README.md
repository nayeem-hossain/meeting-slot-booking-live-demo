# Meeting Slot Booking App

Initial implementation started with:

- Frontend: Next.js (App Router)
- Backend: Express + TypeScript
- Database: PostgreSQL + Prisma
- Real-time: Socket.io
- Worker: BullMQ + Nodemailer

## 1. Start infrastructure

```powershell
docker compose up -d
```

## 2. Configure backend env

Copy [backend/.env.example](backend/.env.example) to `backend/.env` and update values.

## 3. Run Prisma migration and generate client

```powershell
cd backend
"C:\Program Files\nodejs\npm.cmd" run prisma:generate
"C:\Program Files\nodejs\npm.cmd" run prisma:migrate
"C:\Program Files\nodejs\npm.cmd" run prisma:seed
```

## 4. Run apps

```powershell
# backend
cd backend
"C:\Program Files\nodejs\npm.cmd" run dev

# worker (new terminal)
cd backend
"C:\Program Files\nodejs\npm.cmd" run worker:dev

# frontend (new terminal)
cd frontend
"C:\Program Files\nodejs\npm.cmd" run dev
```

## Current API (phase-1/2 baseline)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/rooms`
- `POST /api/rooms` (Admin)
- `PUT /api/rooms/:id` (Admin)
- `DELETE /api/rooms/:id` (Admin)
- `GET /api/bookings`
- `GET /api/bookings/availability?roomId=<id>&date=YYYY-MM-DD`
- `POST /api/bookings`
- `PATCH /api/bookings/:id/cancel`
- `GET /api/ops/queues` (Admin)

## Implemented logic

- 15-minute slot boundary validation
- overlap check (`start < existing.end && end > existing.start`)
- pricing by quarter-hour blocks (`hourlyRate * blocks / 4`)
- role model: `ADMIN`, `MODERATOR`, `USER`
- auth endpoint rate limiting (register/login/refresh/logout)
- refresh-token reuse detection with token-family revocation
- dead-letter capture for exhausted email worker jobs
- admin queue health snapshot endpoint for worker monitoring

## Next implementation targets

- transactional overlap prevention with stricter DB-level constraints
- moderator/admin dashboards and CRUD completion
- worker dead-letter/retry strategy and richer email templates

## Vercel live demo deployment runbook

### Frontend (Vercel)

1. Create a Vercel project from this repository.
2. Set the project root to `frontend`.
3. Configure env var:

   - `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>`

4. Trigger deployment and verify the Vercel URL loads.

### Backend (Vercel Functions supported)

This backend can be deployed on Vercel as an Express API function.

Important Vercel platform constraints for this codebase:

- Vercel Functions do not support acting as a WebSocket server (`socket.io` server mode is not available).
- BullMQ worker is not suitable inside request/response serverless functions.

Use Vercel backend deployment for REST API hosting, then run the worker on a separate always-on host.

1. Create a second Vercel project from this repository with root directory set to `backend`.
2. Ensure `backend/vercel.json` and `backend/api/index.ts` are present (already included in this repo).
3. Set production environment variables in the backend Vercel project:

- `NODE_ENV=production`
- `CLIENT_ORIGIN=https://<your-frontend>.vercel.app`
- `CLIENT_ORIGINS=https://<your-frontend>.vercel.app,https://<optional-custom-domain>`
- `CLIENT_ORIGIN_REGEX=^https://.*\.vercel\.app$` (optional for preview URLs)
- `DATABASE_URL=<managed-postgres-url>`
- `REDIS_URL=<managed-redis-url>`
- `JWT_ACCESS_SECRET=<secure-random-secret>`
- `JWT_REFRESH_SECRET=<secure-random-secret>`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (optional for demo mode)

1. Deploy backend and copy live backend URL.
2. In frontend Vercel project, set `NEXT_PUBLIC_API_BASE_URL` to backend live URL and redeploy.

### Worker host (separate from Vercel Functions)

Deploy worker process (`npm run worker:start`) on an always-on host (Railway/Render/Fly.io/VM) with same `DATABASE_URL`/`REDIS_URL`/SMTP vars.

#### Demo mode (no email notifications)

For live demos where email is not required, you can skip SMTP and worker hosting:

1. Keep backend API deployed on Vercel.
2. Keep frontend API base URL pointing to backend.
3. Do not deploy worker yet.

In this mode, auth/rooms/bookings flows continue to work. Email notification jobs are simply not processed until worker + SMTP are enabled.

#### Worker deployment quickstart (recommended next step)

Use the template file `backend/worker.env.example` to configure the worker host.

Required env vars on worker host:

- `NODE_ENV=production`
- `DATABASE_URL` (same Neon DB as backend API)
- `REDIS_URL` (same Upstash Redis as backend API)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

Option A: Render Worker (Docker)

1. Create a new **Worker** service in Render from this repository.
2. Set Root Directory to `backend`.
3. Use Docker deployment and set Dockerfile path to `backend/Dockerfile.worker` (or `Dockerfile.worker` if root is already `backend`).
4. Add environment variables listed above.
5. Deploy and verify worker logs show completed/failed job events.

Option B: Railway Worker (Nixpacks)

1. Create a new Railway project from this repository.
2. Set root directory to `backend`.
3. Configure Start Command: `npm run worker:start`.
4. Configure Build Command: `npm run prisma:generate:vercel && npm run build`.
5. Add environment variables listed above.
6. Deploy and verify worker logs show completed/failed job events.

Post-deploy worker smoke checks:

1. Create a booking from frontend.
2. Confirm job enters `email-notifications` queue and worker logs process it.
3. Cancel booking and confirm cancellation/reminder cleanup job processing.

### Smoke test checklist

After both deployments are live, verify:

- Login/register works on Vercel frontend.
- Room list loads from backend API.
- Booking create/cancel works and UI updates.
- Admin and Moderator protected pages are accessible by role.
- REST API calls succeed against deployed backend URL.
- Queue jobs are processed by external worker host (only when worker is enabled).
