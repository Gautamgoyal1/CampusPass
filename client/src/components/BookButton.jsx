import React, { useState } from 'react';
import { useNavigate } from 'react-router';
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

  const isSoldOut = seatsLeft <= 0;

  const handleClick = async () => {
    setErrorMsg(null);

    if (!user) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }

    if (user.role !== 'student') {
      const msg = 'Only students can book seats for events.';
      setErrorMsg(msg);
      if (onAnnouncement) onAnnouncement(msg);
      return;
    }

    try {
      await bookSeat();
      const successMsg = 'Seat booked successfully!';
      if (onAnnouncement) onAnnouncement(successMsg);
      if (onBookingSuccess) onBookingSuccess();
    } catch (err) {
      let msg = err.message || 'Failed to book seat';
      if (err.code === 'EVENT_FULL') {
        msg = 'Sorry, this event just filled up!';
      } else if (err.code === 'ALREADY_BOOKED') {
        msg = 'You already have an active booking for this event.';
      } else if (err.code === 'SCHEDULE_CONFLICT') {
        msg = err.message || 'Schedule conflict: You already have a booking for an event scheduled during this time.';
      }
      setErrorMsg(msg);
      if (onAnnouncement) onAnnouncement(msg);
    }
  };

  if (hasBooked) {
    return (
      <div className="book-btn-container">
        <button
          type="button"
          disabled
          className="btn btn-success"
          aria-label="You have booked this event"
        >
          ✓ Confirmed Booking
        </button>
      </div>
    );
  }

  if (isSoldOut) {
    return (
      <div className="book-btn-container">
        <button
          type="button"
          disabled
          className="btn btn-disabled"
          aria-label="Event is fully booked"
        >
          Fully Booked
        </button>
      </div>
    );
  }

  return (
    <div className="book-btn-container">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBooking}
        aria-busy={isBooking}
        className="btn btn-primary"
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
        <p className="form-error" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
