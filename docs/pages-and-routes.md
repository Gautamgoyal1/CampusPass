# Pages and Frontend Routes

This document outlines the routing structure, access levels, and page responsibilities within CampusPass.

---

## 1. Route Map

| Path | Component / Page | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `/` | `EventsPage.jsx` | Public | Event discovery with debounced search, category filters, and cursor-based infinite scrolling. |
| `/events/:id` | `EventDetailPage.jsx` | Public | Full event details, venue info, schedule, live remaining seats, and reviews. |
| `/login` | `LoginPage.jsx` | Public (Unauthenticated) | Student & Organiser login with demo accounts for quick testing. |
| `/register` | `RegisterPage.jsx` | Public (Unauthenticated) | New student registration. |
| `/my-bookings` | `MyBookingsPage.jsx` | Student | Personal bookings dashboard, status badges, and 2-hour window cancellation dialog. |
| `/organiser` | `OrganiserPage.jsx` (Lazy) | Organiser, Admin | Create event form, manage submitted events, track status, and view attendee lists. |
| `/admin` | `AdminPage.jsx` (Lazy) | Admin | Pending event review queue (Approve/Reject) and user role administration. |
| `*` | `NotFoundPage.jsx` | Public | Accessible 404 page with return link. |

---

## 2. Protected Route Implementation

- Implemented via `ProtectedRoute.jsx`.
- Validates current `user` object from `AuthContext`.
- If the session is currently restoring on initial page load, renders an accessible `<Skeleton>` placeholder without flickering.
- If unauthenticated, redirects to `/login` with `state: { from: location }` to preserve the user's intended target route after login.
- If authenticated but lacking the required role, displays an accessible permission restricted message.
