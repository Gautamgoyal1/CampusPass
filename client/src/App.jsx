import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import Layout from './components/Layout.jsx';
import EventsPage from './pages/EventsPage.jsx';
import EventDetailPage from './pages/EventDetailPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MyBookingsPage from './pages/MyBookingsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Skeleton from './components/Skeleton.jsx';

// Lazy load organiser and admin dashboards for performance
const OrganiserPage = lazy(() => import('./pages/OrganiserPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

function PageLoader() {
  return (
    <div className="container page-container" style={{ padding: '2rem 1rem' }}>
      <Skeleton height="40px" width="300px" style={{ marginBottom: '1.5rem' }} />
      <Skeleton height="250px" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public Routes */}
        <Route index element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Student Protected Routes */}
        <Route
          path="my-bookings"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />

        {/* Organiser Protected Routes */}
        <Route
          path="organiser"
          element={
            <ProtectedRoute allowedRoles={['organiser', 'admin']}>
              <Suspense fallback={<PageLoader />}>
                <OrganiserPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Admin Protected Routes */}
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<PageLoader />}>
                <AdminPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Fallback 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
