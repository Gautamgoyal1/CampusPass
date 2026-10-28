import React from 'react';
import EventCard from './EventCard.jsx';
import { EventCardSkeleton } from './Skeleton.jsx';

export default function EventGrid({ events = [], loading = false, skeletonCount = 6 }) {
  if (loading && events.length === 0) {
    return (
      <div className="event-grid" role="status" aria-label="Loading events">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!loading && events.length === 0) {
    return (
      <div className="empty-state" role="region" aria-label="No events found">
        <div className="empty-state-icon" aria-hidden="true">🎫</div>
        <h3 className="empty-state-title">No Events Found</h3>
        <p className="empty-state-desc">
          Try adjusting your search criteria or selecting a different category.
        </p>
      </div>
    );
  }

  return (
    <div className="event-grid" role="list">
      {events.map((event) => (
        <div key={event.id} role="listitem">
          <EventCard event={event} />
        </div>
      ))}
    </div>
  );
}
