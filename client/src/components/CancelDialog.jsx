import React, { useEffect, useRef } from 'react';

export default function CancelDialog({
  isOpen,
  booking,
  onConfirm,
  onCancel,
  isCancelling = false,
  error = null
}) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement;
      // Focus the safe action button by default
      cancelButtonRef.current?.focus();

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
          previouslyFocusedElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onCancel]);

  if (!isOpen || !booking) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal-content"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        aria-describedby="cancel-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cancel-dialog-title" className="modal-title">
          Cancel Booking?
        </h2>

        <p id="cancel-dialog-desc" className="modal-desc">
          Are you sure you want to cancel your seat for{' '}
          <strong>{booking.event_title}</strong>?
        </p>

        <p className="modal-notice">
          Note: Bookings can only be cancelled up to 2 hours before the event starts.
        </p>

        {error && (
          <div className="form-error" role="alert" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isCancelling}
            className="btn btn-secondary"
          >
            Keep Booking
          </button>
          <button
            type="button"
            onClick={() => onConfirm(booking.id)}
            disabled={isCancelling}
            className="btn btn-danger"
          >
            {isCancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
