# CampusPass — Performance & Scalability Notes

---

## 1. Expected Bottlenecks & Architectural Solutions

1. **High-Contention Last Seat Booking:**
   - *Risk:* Overbooking or database lock contention during festival/hackathon registration drops.
   - *Solution:* PostgreSQL row locking (`SELECT ... FOR UPDATE`) inside an explicit transaction combined with partial unique indexing (`WHERE status = 'booked'`). Benchmarked with 20 parallel requests competing for 5 seats: exactly 5 succeed, 15 receive clean `EVENT_FULL` responses.

2. **Public Event Discovery Query Volume:**
   - *Risk:* Frequent queries scanning event listings, filtering categories, and calculating `seats_left`.
   - *Solution:*
     - Indexing: `CREATE INDEX events_public_idx ON events(status, starts_at, id);`
     - Redis Cache-Aside: Short 45-second TTL cache for public listing queries keyed by search terms, category, and cursor.
     - Proactive Invalidation: Event updates, approvals, new bookings, and cancellations invalidate `events:*` keys immediately.

3. **Frontend Bundle Size & TTI:**
   - *Risk:* Heavy dashboard components impacting initial load performance for visitors and mobile students.
   - *Solution:* Dynamic code splitting (`React.lazy`) for `OrganiserPage` (9.5 kB) and `AdminPage` (5.9 kB). Mobile-first CSS without heavy UI frameworks (total CSS: 18.5 kB raw, 4.2 kB gzipped).

4. **Cursor-Based Pagination:**
   - *Risk:* `OFFSET` pagination causes degradation on tables with thousands of events.
   - *Solution:* Stable keyset cursor `(starts_at, id) > ($starts_at, $id)` backed by composite index `events_public_idx`. Remains O(1) performance even with 5,000+ events.
