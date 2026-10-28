import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { useBooking } from '../hooks/useBooking.js';

export default function BookButton({
  eventId,
  seatsLeft,
  hasBooked = false,
  onBookingSuccess,
  onAnnouncement
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { bookSeat, isBooking } = useBooking(eventId);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isConflict, setIsConflict] = useState(false);

  const isSoldOut = seatsLeft <= 0;

  const handleClick = async () => {
    setErrorMsg(null);
    setIsConflict(false);

    if (!user) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }

    if (user.role !== 'student') {
      const msg = `Signed in as an ${user.role}. Only student accounts can book seats for campus events.`;
      setErrorMsg(msg);
      if (onAnnouncement) onAnnouncement(msg);
      return;
    }

    try {
      await bookSeat();
      const successMsg = 'Seat reserved successfully! Your campus pass is confirmed.';
      if (onAnnouncement) onAnnouncement(successMsg);
      if (onBookingSuccess) onBookingSuccess();
    } catch (err) {
      let msg = err.message || 'Failed to book seat';
      if (err.code === 'EVENT_FULL') {
        msg = 'Sorry, this event just filled up! No more seats remaining.';
      } else if (err.code === 'ALREADY_BOOKED') {
        msg = 'You already have an active confirmed booking for this event.';
      } else if (err.code === 'SCHEDULE_CONFLICT') {
        setIsConflict(true);
        msg = err.message || 'Schedule conflict: You have another active booking overlapping this scheduled time.';
      }
      setErrorMsg(msg);
      if (onAnnouncement) onAnnouncement(msg);
    }
  };

  // 1. Unauthenticated Visitor
  if (!user) {
    return (
      <div className="book-btn-container">
        <Link
          to="/login"
          state={{ from: window.location.pathname }}
          className="btn btn-primary btn-block"
        >
          Sign in to Book Seat
        </Link>
        <p className="text-muted text-center" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Free registration required for college students
        </p>
      </div>
    );
  }

  // 2. Already Booked
  if (hasBooked) {
    return (
      <div className="book-btn-container">
        <button
          type="button"
          disabled
          className="btn btn-success btn-block"
          aria-label="You have an active confirmed reservation for this event"
        >
          ✓ Confirmed Booking
        </button>
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <Link to="/my-bookings" className="btn btn-ghost btn-sm">
            View in My Bookings →
          </Link>
        </div>
      </div>
    );
  }

  // 3. Sold Out
  if (isSoldOut) {
    return (
      <div className="book-btn-container">
        <button
          type="button"
          disabled
          className="btn btn-disabled btn-block"
          aria-label="Event capacity reached"
        >
          Capacity Reached (Sold Out)
        </button>
      </div>
    );
  }

  // 4. Eligible to Book
  return (
    <div className="book-btn-container">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBooking}
        aria-busy={isBooking}
        className="btn btn-primary btn-block"
      >
        {isBooking ? (
          <>
            <span className="spinner" aria-hidden="true"></span> Reserving Seat...
          </>
        ) : (
          'Book Seat'
        )}
      </button>

      {errorMsg && (
        <div style={{ marginTop: '0.75rem' }}>
          <div className="form-error" role="alert" style={{ marginBottom: isConflict ? '0.5rem' : 0 }}>
            {errorMsg}
          </div>
          {isConflict && (
            <div style={{ textAlign: 'center' }}>
              <Link to="/my-bookings" className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                Review My Bookings Schedule →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
