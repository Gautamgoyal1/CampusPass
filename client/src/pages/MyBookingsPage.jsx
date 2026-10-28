import React, { useState } from 'react';
import { Link } from 'react-router';
import { useMyBookings, useBooking } from '../hooks/useBooking.js';
import CancelDialog from '../components/CancelDialog.jsx';
import LiveRegion from '../components/LiveRegion.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function MyBookingsPage() {
  const { data: bookings, isLoading, isError, error, refetch } = useMyBookings();
  const { cancelBooking, isCancelling } = useBooking();

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const handleOpenCancel = (booking) => {
    setCancelError(null);
    setSelectedBooking(booking);
  };

  const handleConfirmCancel = async (bookingId) => {
    setCancelError(null);
    try {
      await cancelBooking(bookingId);
      setSelectedBooking(null);
      setAnnouncement('Booking was cancelled successfully.');
      refetch();
    } catch (err) {
      const msg = err.code === 'CANCEL_WINDOW_CLOSED'
        ? 'Bookings cannot be cancelled less than 2 hours before the event starts.'
        : err.message || 'Failed to cancel booking.';
      setCancelError(msg);
      setAnnouncement(msg);
    }
  };

  return (
    <div className="container page-container">
      <LiveRegion message={announcement} />

      <div className="section-header">
        <div>
          <h1 className="section-title">My Event Bookings</h1>
          <p className="section-subtitle">
            Manage your reserved seats and review upcoming campus events
          </p>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Skeleton height="100px" />
          <Skeleton height="100px" />
          <Skeleton height="100px" />
        </div>
      )}

      {isError && (
        <div className="form-error banner-error" role="alert">
          {error?.message || 'Could not load your bookings. Please try again later.'}
        </div>
      )}

      {!isLoading && bookings && bookings.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">🎟️</div>
          <h2 className="empty-state-title">No Bookings Found</h2>
          <p className="empty-state-desc">
            You haven't reserved seats for any events yet. Explore upcoming campus events to get started!
          </p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Browse Events
          </Link>
        </div>
      )}

      <div className="bookings-list" role="list">
        {bookings?.map((booking) => {
          const startDate = new Date(booking.event_starts_at);
          const isCancelled = booking.status === 'cancelled';
          const isPast = startDate < new Date();
          const twoHoursMs = 2 * 60 * 60 * 1000;
          const isWithinCutoff = startDate.getTime() - Date.now() < twoHoursMs;

          return (
            <div
              key={booking.id}
              role="listitem"
              className={`booking-card ${isCancelled ? 'booking-card-cancelled' : ''}`}
            >
              <div className="booking-card-media">
                <img
                  src={booking.event_poster_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&q=80'}
                  alt={`Poster for ${booking.event_title}`}
                  className="booking-poster"
                />
              </div>

              <div className="booking-card-content">
                <div className="booking-header">
                  <span className="badge badge-category">{booking.event_category}</span>
                  <span className={`badge ${isCancelled ? 'badge-cancelled' : 'badge-confirmed'}`}>
                    {isCancelled ? 'Cancelled' : 'Confirmed'}
                  </span>
                </div>

                <h2 className="booking-title">
                  <Link to={`/events/${booking.event_id}`} className="booking-title-link">
                    {booking.event_title}
                  </Link>
                </h2>

                <div className="booking-meta">
                  <span>📅 {startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>📍 {booking.event_venue}</span>
                  <span className="booking-booked-date">
                    Booked on {new Date(booking.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="booking-card-actions">
                <Link to={`/events/${booking.event_id}`} className="btn btn-secondary btn-sm">
                  View Event
                </Link>

                {!isCancelled && !isPast && (
                  <button
                    type="button"
                    onClick={() => handleOpenCancel(booking)}
                    className="btn btn-outline-danger btn-sm"
                    title={isWithinCutoff ? 'Cancellation window closed (less than 2 hours remaining)' : 'Cancel your booking'}
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
