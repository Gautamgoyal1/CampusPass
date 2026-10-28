import React, { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useEventDetail } from '../hooks/useEvents.js';
import BookButton from '../components/BookButton.jsx';
import LiveRegion from '../components/LiveRegion.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');

  // Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const { data: event, isLoading, isError, error, refetch } = useEventDetail(id);

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', id],
    queryFn: async () => {
      const res = await api.get(`/events/${id}/reviews`);
      return res.data.reviews;
    },
    enabled: Boolean(id)
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ rating, comment }) => {
      const res = await api.post(`/events/${id}/reviews`, { rating, comment });
      return res.data.review;
    },
    onSuccess: () => {
      setReviewSuccess(true);
      setComment('');
      setReviewError(null);
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      setAnnouncement('Review submitted successfully!');
    },
    onError: (err) => {
      setReviewError(err.message || 'Failed to submit review');
      setAnnouncement(err.message || 'Failed to submit review');
    }
  });

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    setReviewError(null);
    setReviewSuccess(false);
    reviewMutation.mutate({ rating, comment });
  };

  if (isLoading) {
    return (
      <div className="container page-container" style={{ maxWidth: '800px' }}>
        <Skeleton height="350px" borderRadius="var(--radius-lg)" style={{ marginBottom: '1.5rem' }} />
        <Skeleton height="2.5rem" width="70%" style={{ marginBottom: '1rem' }} />
        <Skeleton height="1.25rem" width="40%" style={{ marginBottom: '2rem' }} />
        <Skeleton height="150px" style={{ marginBottom: '2rem' }} />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="container page-container text-center" style={{ padding: '4rem 1rem' }}>
        <h2>Event Not Found</h2>
        <p style={{ margin: '1rem 0 2rem', color: 'var(--text-secondary)' }}>
          {error?.message || 'The event you are looking for does not exist or may have been removed.'}
        </p>
        <Link to="/" className="btn btn-primary">
          Back to Events
        </Link>
      </div>
    );
  }

  const startDate = new Date(event.starts_at);
  const endDate = new Date(event.ends_at);
  const isPastEvent = endDate < new Date();

  return (
    <div className="container page-container detail-page-container">
      <LiveRegion message={announcement} />

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/" className="breadcrumb-link">Events</Link>
        <span aria-hidden="true" className="breadcrumb-separator">/</span>
        <span aria-current="page" className="breadcrumb-current">{event.title}</span>
      </nav>

      <article className="event-detail-card">
        <div className="detail-media-container">
          <img
            src={event.poster_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80'}
            alt={`Poster for ${event.title}`}
            className="detail-poster-img"
          />
          <span className="badge badge-category detail-category-badge">{event.category}</span>
        </div>

        <div className="detail-header">
          <h1 className="detail-title">{event.title}</h1>
          <div className="detail-meta-row">
            <span className="organiser-info">
              Organised by <strong>{event.organiser_name}</strong>
            </span>
            {event.average_rating && (
              <span className="rating-badge">
                ★ {event.average_rating} ({event.reviews_count} {event.reviews_count === 1 ? 'review' : 'reviews'})
              </span>
            )}
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-main-info">
            <section aria-labelledby="about-event-title" className="detail-section">
              <h2 id="about-event-title" className="detail-section-title">About this Event</h2>
              <p className="detail-description">{event.description}</p>
            </section>

            <section aria-labelledby="event-schedule-title" className="detail-section">
              <h2 id="event-schedule-title" className="detail-section-title">Date & Location</h2>
              <div className="schedule-cards">
                <div className="info-card">
                  <span className="info-icon" aria-hidden="true">📅</span>
                  <div>
                    <strong className="info-heading">Starts</strong>
                    <p className="info-text">
                      {startDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      <br />
                      {startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="info-card">
                  <span className="info-icon" aria-hidden="true">🏁</span>
                  <div>
                    <strong className="info-heading">Ends</strong>
                    <p className="info-text">
                      {endDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      <br />
                      {endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="info-card full-width">
                  <span className="info-icon" aria-hidden="true">📍</span>
                  <div>
                    <strong className="info-heading">Venue</strong>
                    <p className="info-text">{event.venue}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="detail-sidebar" aria-label="Booking and Tickets">
            <div className="ticket-card">
              <h3 className="ticket-card-title">Registration</h3>

              <div className="seat-availability-stat">
                <div className="seat-count-display">
                  <span className="seats-large">{event.seats_left}</span>
                  <span className="seats-sub">seats remaining</span>
                </div>
                <div className="seat-progress-bar" aria-hidden="true">
                  <div
                    className="seat-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((event.capacity - event.seats_left) / event.capacity) * 100))}%`
                    }}
                  />
                </div>
                <span className="capacity-label">Total capacity: {event.capacity} seats</span>
              </div>

              {!isPastEvent ? (
                <BookButton
                  eventId={event.id}
                  seatsLeft={event.seats_left}
                  hasBooked={event.hasBooked}
                  onBookingSuccess={() => refetch()}
                  onAnnouncement={setAnnouncement}
                />
              ) : (
                <div className="badge badge-sold-out text-center" style={{ width: '100%', padding: '0.75rem' }}>
                  This event has ended
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Reviews Section */}
        <section className="reviews-section" aria-labelledby="reviews-section-title">
          <h2 id="reviews-section-title" className="detail-section-title">
            Student Reviews ({reviewsData?.length || 0})
          </h2>

          {/* If event is past and user booked it, allow review */}
          {isPastEvent && event.hasBooked && (
            <div className="review-form-card">
              <h3 className="review-form-title">Leave a Review</h3>
              {reviewSuccess && (
                <p className="form-success" role="alert">
                  Thank you! Your review has been submitted.
                </p>
              )}
              {reviewError && (
                <p className="form-error" role="alert">
                  {reviewError}
                </p>
              )}

              <form onSubmit={handleReviewSubmit}>
                <div className="form-group">
                  <label htmlFor="review-rating" className="form-label">
                    Rating (1 to 5 Stars)
                  </label>
                  <select
                    id="review-rating"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="form-select"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 - Excellent)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 - Very Good)</option>
                    <option value={3}>⭐⭐⭐ (3 - Good)</option>
                    <option value={2}>⭐⭐ (2 - Fair)</option>
                    <option value={1}>⭐ (1 - Poor)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="review-comment" className="form-label">
                    Comments (Optional)
                  </label>
                  <textarea
                    id="review-comment"
                    rows="3"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience at this event..."
                    className="form-input form-textarea"
                  />
                </div>

                <button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  className="btn btn-primary"
                >
                  {reviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            </div>
          )}

          <div className="reviews-list">
            {reviewsData && reviewsData.length > 0 ? (
              reviewsData.map((rev) => (
                <div key={rev.id} className="review-item">
                  <div className="review-item-header">
                    <strong className="reviewer-name">{rev.user_name}</strong>
                    <span className="review-stars">{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span>
                  </div>
                  {rev.comment && <p className="review-comment">{rev.comment}</p>}
                  <time className="review-date" dateTime={rev.created_at}>
                    {new Date(rev.created_at).toLocaleDateString()}
                  </time>
                </div>
              ))
            ) : (
              <p className="no-reviews-text">No reviews yet for this event.</p>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
