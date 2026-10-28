# CampusPass — Data Placement Strategy

This document details where each state element resides across the frontend and backend architectures.

---

## 1. Frontend State Classification

| State Type | Mechanism | Examples | Justification |
| :--- | :--- | :--- | :--- |
| **Server Cache** | TanStack Query (`useQuery`, `useInfiniteQuery`) | Event list, event details, my bookings, attendee lists, review lists | Keeps client state synchronized with PostgreSQL without duplicate Redux / global stores. Automatic cache invalidation. |
| **URL State** | `useSearchParams` | Search query `?q=...`, category filter `?category=...` | Enables bookmarking, sharing search links, and native browser forward/backward navigation. |
| **Authentication** | React Context (`AuthContext`) | Active `user` (`id`, `email`, `role`, `name`), in-memory `accessToken` | Access tokens stored strictly in JS memory (never `localStorage` or `sessionStorage` to mitigate XSS). Restored automatically via HttpOnly refresh cookie. |
| **Ephemeral UI** | `useState`, `useRef` | Dialog open/close, active tabs, form input drafts, mobile nav toggle | Preserves component encapsulation for non-shared, momentary UI states. |

---

## 2. Backend & Persistence Placement

| Layer | Storage Engine | Scope |
| :--- | :--- | :--- |
| **Persistent Truth** | PostgreSQL 16 | User profiles, event listings, bookings, reviews, hashed refresh tokens. |
| **Cache-Aside** | Redis 7 | Ephemeral public event responses with 45s TTL, invalidated on event modifications. |
| **Rate Limiting** | Redis 7 | Sliding window counters per user/IP (`ratelimit:auth:*`, `ratelimit:booking:*`). |
| **Credentials** | Cookies (HttpOnly) | Hashed refresh tokens (`path: /api/v1/auth`, `sameSite: lax/strict`). |
