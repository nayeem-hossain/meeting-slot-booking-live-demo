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

## Implemented logic

- 15-minute slot boundary validation
- overlap check (`start < existing.end && end > existing.start`)
- pricing by quarter-hour blocks (`hourlyRate * blocks / 4`)
- role model: `ADMIN`, `MODERATOR`, `USER`

## Next implementation targets

- transactional overlap prevention with stricter DB-level constraints
- moderator/admin dashboards and CRUD completion
- JWT hardening (rate limit and refresh-token reuse detection)
- worker dead-letter/retry strategy and richer email templates

## Vercel live demo deployment runbook

### Frontend (Vercel)

1. Create a Vercel project from this repository.
2. Set the project root to `frontend`.
3. Configure env var:

	- `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>`

4. Trigger deployment and verify the Vercel URL loads.

### Backend (public host)

Deploy backend separately (Railway/Render/Fly.io/etc.) and set:

- `NODE_ENV=production`
- `CLIENT_ORIGIN=https://<your-frontend>.vercel.app`
- `CLIENT_ORIGINS=https://<your-frontend>.vercel.app,https://<optional-custom-domain>`
- `CLIENT_ORIGIN_REGEX=^https://.*\.vercel\.app$` (optional for preview URLs)
- `DATABASE_URL=<managed-postgres-url>`
- `REDIS_URL=<managed-redis-url>`
- `JWT_ACCESS_SECRET=<secure-random-secret>`
- `JWT_REFRESH_SECRET=<secure-random-secret>`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

### Smoke test checklist

After both deployments are live, verify:

- Login/register works on Vercel frontend.
- Room list loads from backend API.
- Booking create/cancel works and UI updates.
- Admin and Moderator protected pages are accessible by role.
- Socket availability updates arrive on bookings page.
