import React from 'react';
import { Link } from 'react-router';

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

  return (
    <article className="event-card" aria-labelledby={`event-title-${id}`}>
      <div className="event-card-media">
        <img
          src={poster_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'}
          alt={`Poster for ${title}`}
          loading="lazy"
          className="event-card-img"
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
    </article>
  );
}
