import React, { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { useMyBookings, useBooking } from '../hooks/useBooking.js';
import CancelDialog from '../components/CancelDialog.jsx';
import LiveRegion from '../components/LiveRegion.jsx';
import Skeleton from '../components/Skeleton.jsx';

const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&q=80';

export default function MyBookingsPage() {
  const { user } = useAuth();
  const { data: bookings, isLoading, isError, error, refetch } = useMyBookings();
  const { cancelBooking, isCancelling } = useBooking();

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'cancelled' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const now = new Date();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  // Compute category breakdowns
  const categorized = useMemo(() => {
    if (!bookings) {
      return { upcoming: [], completed: [], cancelled: [], all: [] };
    }

    const upcoming = [];
    const completed = [];
    const cancelled = [];

    bookings.forEach((b) => {
      const isCancelled = b.status === 'cancelled';
      const endsAt = new Date(b.event_ends_at || b.event_starts_at);
      const isPast = endsAt < now;

      if (isCancelled) {
        cancelled.push(b);
      } else if (isPast) {
        completed.push(b);
      } else {
        upcoming.push(b);
      }
    });

    return { upcoming, completed, cancelled, all: bookings };
  }, [bookings, now]);

  // Apply tab and text search
  const displayedBookings = useMemo(() => {
    let list = categorized[activeTab] || categorized.all;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.event_title.toLowerCase().includes(q) ||
          b.event_venue.toLowerCase().includes(q) ||
          b.event_category?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [categorized, activeTab, searchQuery]);

  const handleOpenCancel = (booking) => {
    setCancelError(null);
    setSelectedBooking(booking);
  };

  const handleConfirmCancel = async (bookingId) => {
    setCancelError(null);
    try {
      await cancelBooking(bookingId);
      setSelectedBooking(null);
      setAnnouncement('Booking was cancelled successfully. Your seat has been released.');
      refetch();
    } catch (err) {
      const msg =
        err.code === 'CANCEL_WINDOW_CLOSED'
          ? 'Bookings cannot be cancelled less than 2 hours before the event starts.'
          : err.message || 'Failed to cancel booking.';
      setCancelError(msg);
      setAnnouncement(msg);
    }
  };

  return (
    <div className="container page-container">
      <LiveRegion message={announcement} />

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">
            Student Hub {user?.name ? `— ${user.name}` : ''}
          </h1>
          <p className="section-subtitle">
            Manage your reserved seats, review upcoming schedules, and inspect your event passes
          </p>
        </div>
        <Link to="/" className="btn btn-primary" id="btn-browse-events">
          + Discover More Events
        </Link>
      </div>

      {/* Real Live Metrics Summary Cards */}
      <div className="stats-grid">
        <div
          className={`stat-card stat-card-clickable ${activeTab === 'upcoming' ? 'stat-card-active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('upcoming')}
          aria-label="View upcoming confirmed passes"
        >
          <div className="stat-card-header">
            <span className="stat-label">Upcoming Passes</span>
            <span className="stat-icon" aria-hidden="true">🎟️</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--primary)' }}>
            {isLoading ? '...' : categorized.upcoming.length}
          </div>
          <div className="stat-subtext">Active seat reservations</div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${activeTab === 'completed' ? 'stat-card-active' : ''}`}
          onClick={() => setActiveTab('completed')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('completed')}
          aria-label="View completed events"
        >
          <div className="stat-card-header">
            <span className="stat-label">Completed Events</span>
            <span className="stat-icon" aria-hidden="true">🏆</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--success)' }}>
            {isLoading ? '...' : categorized.completed.length}
          </div>
          <div className="stat-subtext">Past attended events</div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${activeTab === 'cancelled' ? 'stat-card-active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('cancelled')}
          aria-label="View cancelled passes"
        >
          <div className="stat-card-header">
            <span className="stat-label">Cancelled Passes</span>
            <span className="stat-icon" aria-hidden="true">✕</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '...' : categorized.cancelled.length}
          </div>
          <div className="stat-subtext">Released reservations</div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${activeTab === 'all' ? 'stat-card-active' : ''}`}
          onClick={() => setActiveTab('all')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('all')}
          aria-label="View all event bookings"
        >
          <div className="stat-card-header">
            <span className="stat-label">Total Passes</span>
            <span className="stat-icon" aria-hidden="true">📋</span>
          </div>
          <div className="stat-number">
            {isLoading ? '...' : categorized.all.length}
          </div>
          <div className="stat-subtext">All-time booking history</div>
        </div>
      </div>

      {/* Search & Tabs Row */}
      <div className="search-filter-row">
        <div className="search-filter-group">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings by event title or venue..."
            className="form-input"
            style={{ minWidth: '260px' }}
            aria-label="Search my bookings"
          />
        </div>

        <div className="pill-group" role="tablist" aria-label="Bookings Categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upcoming'}
            className={`pill-button ${activeTab === 'upcoming' ? 'pill-button-active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming ({categorized.upcoming.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'completed'}
            className={`pill-button ${activeTab === 'completed' ? 'pill-button-active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({categorized.completed.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cancelled'}
            className={`pill-button ${activeTab === 'cancelled' ? 'pill-button-active' : ''}`}
            onClick={() => setActiveTab('cancelled')}
          >
            Cancelled ({categorized.cancelled.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`pill-button ${activeTab === 'all' ? 'pill-button-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({categorized.all.length})
          </button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Skeleton height="110px" borderRadius="var(--radius-lg)" />
          <Skeleton height="110px" borderRadius="var(--radius-lg)" />
          <Skeleton height="110px" borderRadius="var(--radius-lg)" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="form-error banner-error" role="alert">
          {error?.message || 'Could not load your bookings. Please try again later.'}
        </div>
      )}

      {/* Empty States */}
      {!isLoading && displayedBookings.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">🎟️</div>
          <h2 className="empty-state-title">
            {activeTab === 'upcoming'
              ? 'No Upcoming Event Passes'
              : activeTab === 'completed'
              ? 'No Past Completed Events'
              : activeTab === 'cancelled'
              ? 'No Cancelled Passes'
              : 'No Event Bookings Found'}
          </h2>
          <p className="empty-state-desc">
            {activeTab === 'upcoming'
              ? "You don't have any upcoming events scheduled. Explore campus festivals, hackathons, and guest lectures to reserve your seat!"
              : activeTab === 'completed'
              ? 'You have not attended any completed events yet. When you participate in campus events, they will appear here.'
              : activeTab === 'cancelled'
              ? 'You have not cancelled any event reservations.'
              : "You haven't reserved seats for any events yet. Get started by browsing upcoming campus events."}
          </p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Discover Upcoming Events
          </Link>
        </div>
      )}

      {/* Bookings List */}
      {!isLoading && displayedBookings.length > 0 && (
        <div className="bookings-list" role="list">
          {displayedBookings.map((booking) => {
            const startDate = new Date(booking.event_starts_at);
            const endDate = new Date(booking.event_ends_at || booking.event_starts_at);
            const isCancelled = booking.status === 'cancelled';
            const isPast = endDate < now;
            const timeUntilStart = startDate.getTime() - Date.now();
            const isWithinCutoff = timeUntilStart < twoHoursMs;
            const canCancel = !isCancelled && !isPast && !isWithinCutoff;

            return (
              <div
                key={booking.id}
                role="listitem"
                className={`booking-card ${isCancelled ? 'booking-card-cancelled' : ''}`}
              >
                <div className="booking-card-media">
                  <img
                    src={booking.event_poster_url || DEFAULT_POSTER}
                    alt={`Cover for ${booking.event_title}`}
                    className="booking-poster"
                    onError={(e) => {
                      if (e.target.src !== DEFAULT_POSTER) {
                        e.target.src = DEFAULT_POSTER;
                      }
                    }}
                  />
                </div>

                <div className="booking-card-content">
                  <div className="booking-header">
                    <span className="badge badge-category">{booking.event_category}</span>
                    <span
                      className={`badge ${
                        isCancelled
                          ? 'badge-cancelled'
                          : isPast
                          ? 'badge-seats'
                          : 'badge-confirmed'
                      }`}
                    >
                      {isCancelled ? '✕ Cancelled' : isPast ? '✓ Completed' : '✓ Confirmed Pass'}
                    </span>
                  </div>

                  <h2 className="booking-title">
                    <Link to={`/events/${booking.event_id}`} className="booking-title-link">
                      {booking.event_title}
                    </Link>
                  </h2>

                  <div className="booking-meta">
                    <span>
                      📅{' '}
                      {startDate.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}{' '}
                      at{' '}
                      {startDate.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {' – '}
                      {endDate.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span>📍 {booking.event_venue}</span>
                    <span className="booking-booked-date">
                      Reserved on {new Date(booking.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="booking-card-actions">
                  <Link to={`/events/${booking.event_id}`} className="btn btn-secondary btn-sm">
                    View Event Details
                  </Link>

                  {/* Leave review CTA for past completed events */}
                  {isPast && !isCancelled && (
                    <Link
                      to={`/events/${booking.event_id}`}
                      className="btn btn-outline btn-sm"
                      title="Rate this completed event"
                    >
                      ⭐ Leave Review
                    </Link>
                  )}

                  {/* Active upcoming booking cancellation handling */}
                  {!isCancelled && !isPast && (
                    <>
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCancel(booking)}
                          className="btn btn-outline-danger btn-sm"
                        >
                          Cancel Booking
                        </button>
                      ) : (
                        <span
                          className="badge badge-urgent"
                          title="Cancellations are locked within 2 hours of event start time to prevent seat wastage"
                          style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                        >
                          Cancellation locked (&lt;2h)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessible Cancel Dialog */}
      <CancelDialog
        isOpen={Boolean(selectedBooking)}
        booking={selectedBooking}
        onCancel={() => setSelectedBooking(null)}
        onConfirm={handleConfirmCancel}
        isCancelling={isCancelling}
        error={cancelError}
      />
    </div>
  );
}
