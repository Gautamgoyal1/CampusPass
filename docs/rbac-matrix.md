# Role-Based Access Control (RBAC) Matrix

CampusPass defines four system roles: **Visitor** (unauthenticated), **Student**, **Organiser**, and **Admin**. All permissions and ownership rules are enforced server-side.

---

## 1. Permission Matrix

| Operation / Endpoint | Visitor | Student | Organiser | Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Browse approved events** (`GET /events`) | ✅ | ✅ | ✅ | ✅ |
| **View event details** (`GET /events/:id`) | ✅ | ✅ | ✅ | ✅ |
| **Register new account** (`POST /auth/register`) | ✅ (Student) | ❌ | ❌ | ❌ |
| **Log in / Refresh / Log out** (`/auth/*`) | ✅ | ✅ | ✅ | ✅ |
| **Book event seat** (`POST /events/:id/bookings`) | ❌ (401) | ✅ | ❌ (403) | ❌ (403) |
| **View personal bookings** (`GET /me/bookings`) | ❌ (401) | ✅ | ❌ (403) | ❌ (403) |
| **Cancel personal booking** (`DELETE /bookings/:id`) | ❌ (401) | ✅ (Owner) | ❌ (403) | ❌ (403) |
| **Submit review after event** (`POST /events/:id/reviews`) | ❌ (401) | ✅ (If attended) | ❌ (403) | ❌ (403) |
| **Create event** (`POST /events`) | ❌ (401) | ❌ (403) | ✅ (Starts pending) | ✅ |
| **Edit owned event** (`PATCH /events/:id`) | ❌ (401) | ❌ (403) | ✅ (Own events only) | ✅ (Any event) |
| **View owned events** (`GET /me/events`) | ❌ (401) | ❌ (403) | ✅ | ✅ |
| **View attendee list** (`GET /events/:id/bookings`) | ❌ (401) | ❌ (403) | ✅ (Own events only) | ✅ (Any event) |
| **View pending events** (`GET /admin/events`) | ❌ (401) | ❌ (403) | ❌ (403) | ✅ |
| **Approve / Reject event** (`PATCH /admin/events/:id/status`) | ❌ (401) | ❌ (403) | ❌ (403) | ✅ |
| **Manage user roles** (`PATCH /admin/users/:id/role`) | ❌ (401) | ❌ (403) | ❌ (403) | ✅ |

---

## 2. Server-Side Enforcement Rules

1. **Self-Registration Constraint:**
   - Public registration (`/auth/register`) strictly sets `role = 'student'` regardless of request payload.
   - Organiser and Admin roles can only be granted by existing Admins via `PATCH /api/v1/admin/users/:id/role`.

2. **Ownership Check on Event Modifications:**
   - An organiser attempting to update or view attendees of an event not owned by them receives `403 FORBIDDEN`.

3. **Ownership Check on Booking Cancellation:**
   - A student attempting to cancel another user's booking receives `403 FORBIDDEN`.
