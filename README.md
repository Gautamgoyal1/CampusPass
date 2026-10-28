# CampusPass

CampusPass is a college event discovery and seat-booking platform that replaces fragmented WhatsApp announcements and Google Forms registrations with an accessible, concurrency-safe, end-to-end full-stack platform.

---

## Architecture & Technology Stack

- **Frontend:** React 18, Vite, React Router v7, TanStack Query, React Context (Authentication), Plain mobile-first CSS.
- **Backend:** Node.js, Express, PostgreSQL 16 (connection pooling), Redis 7 (cache-aside & rate limiting), Zod validation, JWT authentication in memory + HttpOnly refresh cookies, bcrypt password hashing.
- **Containerization:** Docker Compose running PostgreSQL 16 Alpine, Redis 7, Express API backend, and Vite frontend.

---

## Role Permissions (RBAC)

- **Visitor:** Browse and search approved upcoming events, filter by category.
- **Student:** Register, log in, book available seats, view personal bookings, cancel bookings (>2h cutoff), submit post-event reviews.
- **Organiser:** Create new events (pending admin approval), edit owned events, inspect attendee rosters.
- **Admin:** Review and approve/reject pending events, manage and update user roles.

---

## Quickstart with Docker Compose

To run the entire stack (PostgreSQL, Redis, Backend, and Frontend) with health checks:

```bash
docker compose up --build -d
```

Verify all 4 services are healthy:
```bash
docker compose ps
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api/v1
- **API Health Check:** http://localhost:3000/api/v1/health

---

## Local Development Setup

### 1. Prerequisites
- Node.js v20+ and npm
- Docker (for PostgreSQL and Redis)

### 2. Start PostgreSQL & Redis
```bash
docker compose up -d postgres redis
```

### 3. Server Setup
```bash
cd server
cp .env.example .env
npm install
npm run migrate    # Runs PostgreSQL migrations
npm run seed       # Populates deterministic sample users and events
npm run dev        # Starts Express server on http://localhost:3000
```

### 4. Client Setup
```bash
cd ../client
cp .env.example .env
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

---

## Deterministic Demo Accounts

The database seed provides predefined accounts for immediate testing:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@campuspass.edu` | `admin123` |
| **Organiser** | `organiser@campuspass.edu` | `organiser123` |
| **Student** | `alice@student.campuspass.edu` | `password123` |
| **Student** | `bob@student.campuspass.edu` | `password123` |

---

## Automated Test Suite

Run the comprehensive integration test suite (covering RBAC, concurrent seat reservations, and cancellation cutoffs):

```bash
cd server
npm test
```

### Test Coverage Summary:
- **`booking.concurrency.test.js`:**
  - Fires 20 parallel requests competing for 5 remaining seats using `SELECT ... FOR UPDATE` transactions. Verifies that exactly 5 succeed (201) and 15 are rejected with `EVENT_FULL` (409).
  - Fires 5 concurrent duplicate booking requests by the same student. Verifies that exactly 1 succeeds (201) and 4 are rejected with `ALREADY_BOOKED` (409).
- **`cancel.test.js`:** Tests cancellation within the permitted window (>2h) and rejection inside the cutoff window (`CANCEL_WINDOW_CLOSED`, 409). Tests rebooking after cancellation.
- **`rbac.test.js`:** Tests visitor access restrictions, student admin blocks, organiser event ownership boundaries, and attendee access.
- **`schedule.conflict.test.js`:**
  - Tests 9 discrete schedule conflict interval scenarios (strict overlap rejection, adjacent start/end boundaries permitted, cancelled bookings ignored, separate days permitted).
  - Tests 3 concurrency serialization scenarios using PostgreSQL transaction advisory locks (`SELECT pg_advisory_xact_lock(user_id)`): concurrent overlapping bookings by the same student serialize with exactly 1 success and 1 `SCHEDULE_CONFLICT` (409); simultaneous non-overlapping bookings both succeed; distinct students booking the same event both succeed.
- **`dashboard.test.js`:**
  - Tests live metrics endpoints (`GET /me/stats`, `GET /admin/stats`).
  - Tests admin user management with search, role filtering, and pagination.
  - Tests administrator self-demotion protection (`SELF_DEMOTION_PROHIBITED`, 403).
  - Tests capacity reduction safety guard against active bookings.
- **`e2e.journeys.test.js`:** Full automated validation of all 5 user journeys (Visitor, Student, Organiser, Admin, and Reviews) against real PostgreSQL and Redis.
- **`notifications.calendar.test.js`:**
  - Tests in-app notification triggers on booking confirmation, student cancellation, organiser event time/venue updates, and admin/organiser event cancellation.
  - Tests user notification isolation and security boundaries (preventing unauthorized reading or marking others' notifications).
  - Tests notification deduplication and idempotent creation via unique `dedup_key`.
  - Tests RFC 5545 compliant `.ics` calendar export endpoint formatting (`DTSTART`, `DTEND`, `DTSTAMP`, `UID`, `SUMMARY`, `LOCATION`) and nonexistent event 404 handling.
- **`security.audit.test.js`:** Tests cancellation concurrency serialization, notification parameter validation, PostgreSQL error translation, and event status lifecycle.
- **`e2e.complete.verification.test.js`:** Comprehensive verification of live health check, complete student lifecycle (register $\rightarrow$ login $\rightarrow$ book $\rightarrow$ conflict rejection $\rightarrow$ notification $\rightarrow$ calendar .ics $\rightarrow$ cancel), organiser approval & capacity safety, admin workflows, and serialized cancellation integrity.
- **`large.dataset.benchmark.js`:** Benchmark testing 5,000 bulk-inserted events with lateral subquery calculation and cursor pagination (sub-50ms query response times).

---

## Database Backup & Restoration

### 1. PostgreSQL Backup (Docker or Local)
```bash
# Export full database dump
docker exec -t campuspass-postgres-1 pg_dump -U campuspass -d campuspass -F c -b -v -f /tmp/campuspass_backup.dump
docker cp campuspass-postgres-1:/tmp/campuspass_backup.dump ./campuspass_backup.dump
```

### 2. PostgreSQL Restoration
```bash
# Restore clean dump to database
docker cp ./campuspass_backup.dump campuspass-postgres-1:/tmp/campuspass_backup.dump
docker exec -t campuspass-postgres-1 pg_restore -U campuspass -d campuspass -c -v /tmp/campuspass_backup.dump
```

---

## Production Deployment Checklist

1. **Environment Variables:**
   - Set `NODE_ENV=production`.
   - Provide a cryptographically strong, random `JWT_ACCESS_SECRET` (at least 32 bytes).
   - Set `CLIENT_ORIGIN` to the production domain (e.g. `https://campuspass.college.edu`).
2. **Reverse Proxy & TLS:**
   - Terminate SSL/TLS at your ingress/proxy (e.g. Nginx, Traefik, or AWS ALB).
   - Express has `trust proxy` configured so rate limiting accurately uses the client's real IP from `X-Forwarded-For`.
3. **Database Migrations:**
   - The backend runs `migrate()` automatically upon startup before binding to port 3000, ensuring schema changes apply cleanly.
4. **Health Probes:**
   - Use `GET /api/v1/health` for container orchestration readiness checks; it validates real PostgreSQL and Redis connectivity.

---

## Phase 6 API Additions

### In-App Notifications
- `GET /api/v1/notifications` — List notifications for authenticated user (supports `?unreadOnly=true`, `?limit=50`, `?offset=0`).
- `GET /api/v1/notifications/unread-count` — Retrieve live unread notification count.
- `PATCH /api/v1/notifications/:id/read` — Mark an individual notification as read.
- `PATCH /api/v1/notifications/read-all` — Mark all unread notifications as read.

### Calendar Export (.ics)
- `GET /api/v1/events/:id/calendar.ics` (and `/api/v1/events/:id/ics`) — Download an RFC 5545 compliant iCalendar `.ics` file for importing directly into personal calendars (Google Calendar, Apple Calendar, Outlook).

---

## Troubleshooting

1. **Port Conflicts (5432 or 5173):**
   - If port 5432 or 5173 is already in use by another local database or container, stop conflicting containers:
     ```bash
     docker stop <conflicting_container_id>
     ```
2. **Database Reset:**
   - To re-apply all migrations and re-seed clean sample data:
     ```bash
     cd server
     npm run migrate && npm run seed
     ```
3. **Session Refresh Issues in Development:**
   - Refresh tokens are transmitted via HttpOnly cookies with `SameSite=Lax`. Ensure requests to `http://localhost:3000` include credentials (`credentials: 'include'`).
