import React from 'react';

export default function Skeleton({
  height = '1rem',
  width = '100%',
  borderRadius = 'var(--radius)',
  style = {},
  className = ''
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        height,
        width,
        borderRadius,
        ...style
      }}
      aria-hidden="true"
    />
  );
}

export function EventCardSkeleton() {
  return (
    <div className="event-card skeleton-card">
      <Skeleton height="180px" borderRadius="var(--radius) var(--radius) 0 0" />
      <div className="event-card-body">
        <Skeleton height="1.25rem" width="40%" style={{ marginBottom: '0.5rem' }} />
        <Skeleton height="1.5rem" width="80%" style={{ marginBottom: '0.75rem' }} />
        <Skeleton height="1rem" width="60%" style={{ marginBottom: '0.5rem' }} />
        <Skeleton height="1rem" width="90%" style={{ marginBottom: '1.25rem' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton height="1.2rem" width="30%" />
          <Skeleton height="2.2rem" width="35%" borderRadius="var(--radius)" />
        </div>
      </div>
    </div>
  );
}
