import React from 'react';
import { Link } from 'react-router';

const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80';

export default function EventCard({ event }) {
  const {
    id,
    title,
    category,
    venue,
    starts_at,
    capacity,
    seats_left,
    poster_url,
    status
  } = event;

  const startDate = new Date(starts_at);
  const formattedDate = startDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = startDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isSoldOut = seats_left <= 0;
  const isUrgent = seats_left > 0 && seats_left <= 5;
  const bookedPercent = Math.min(100, Math.max(0, ((capacity - seats_left) / capacity) * 100));

  return (
    <article className="event-card" aria-labelledby={`event-title-${id}`}>
      <div className="event-card-media">
        <img
          src={poster_url || DEFAULT_POSTER}
          alt={`Poster for ${title}`}
          loading="lazy"
          className="event-card-img"
          onError={(e) => {
            if (e.target.src !== DEFAULT_POSTER) {
              e.target.src = DEFAULT_POSTER;
            }
          }}
        />
        <div className="event-card-badges">
          <span className="badge badge-category">{category}</span>
          {status && status !== 'approved' && (
            <span className={`badge badge-status badge-status-${status}`}>
              {status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="event-card-body">
        <div className="event-card-datetime">
          <span className="datetime-icon" aria-hidden="true">📅</span>
          <time dateTime={starts_at}>{formattedDate} • {formattedTime}</time>
        </div>

        <h3 id={`event-title-${id}`} className="event-card-title">
          <Link to={`/events/${id}`} className="event-card-link">
            {title}
          </Link>
        </h3>

        <p className="event-card-venue">
          <span aria-hidden="true">📍</span> {venue}
        </p>

        {/* Capacity bar indicator */}
        <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
          <div
            style={{
              height: '4px',
              backgroundColor: '#e2e8f0',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '0.5rem'
            }}
            aria-hidden="true"
          >
            <div
              style={{
                width: `${bookedPercent}%`,
                height: '100%',
                backgroundColor: isSoldOut ? 'var(--danger)' : isUrgent ? 'var(--warning)' : 'var(--primary)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          <div className="event-card-footer">
            <div className="seat-badge-wrapper">
              {isSoldOut ? (
                <span className="badge badge-sold-out">Sold Out</span>
              ) : (
                <span className={`badge ${isUrgent ? 'badge-urgent' : 'badge-seats'}`}>
                  {seats_left} / {capacity} seats left
                </span>
              )}
            </div>

            <Link
              to={`/events/${id}`}
              className="btn btn-secondary btn-sm"
              aria-label={`View details for ${title}`}
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
