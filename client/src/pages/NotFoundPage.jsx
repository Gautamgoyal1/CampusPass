import React from 'react';
import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="container page-container text-center" style={{ padding: '5rem 1rem' }}>
      <div className="empty-state-icon" aria-hidden="true">🔍</div>
      <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        404
      </h1>
      <h2 style={{ marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '480px', margin: '0 auto 2rem' }}>
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to Events
      </Link>
    </div>
  );
}
