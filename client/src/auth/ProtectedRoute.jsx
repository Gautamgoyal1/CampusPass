import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 1rem' }}>
        <Skeleton height="40px" width="200px" />
        <div style={{ marginTop: '1.5rem' }}>
          <Skeleton height="150px" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <h2>Access Restricted</h2>
        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
          You do not have the required permissions to access this page.
        </p>
      </div>
    );
  }

  return children ? children : <Outlet />;
}
