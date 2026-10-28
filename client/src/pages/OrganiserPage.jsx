import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import LiveRegion from '../components/LiveRegion.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function OrganiserPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState('');

  // Modals & form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [attendeeEvent, setAttendeeEvent] = useState(null);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState('all'); // 'all' | 'booked' | 'cancelled'

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'approved' | 'pending' | 'rejected'
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Technology',
    venue: '',
    starts_at: '',
    ends_at: '',
    capacity: 50,
    poster_url: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  // 1. Fetch organiser's live metrics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['organiser-stats'],
    queryFn: async () => {
      const res = await api.get('/me/stats');
      return res.data.stats;
    }
  });

  // 2. Fetch organiser's events
  const { data: events, isLoading: eventsLoading, isError, error, refetch: refetchEvents } = useQuery({
    queryKey: ['organiser-events'],
    queryFn: async () => {
      const res = await api.get('/me/events');
      return res.data.events;
    }
  });

  // 3. Fetch attendees for selected event
  const { data: attendeesData, isLoading: attendeesLoading } = useQuery({
    queryKey: ['attendees', attendeeEvent?.id],
    queryFn: async () => {
      const res = await api.get(`/events/${attendeeEvent.id}/bookings`);
      return res.data.attendees;
    },
    enabled: Boolean(attendeeEvent?.id)
  });

  // Create event mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/events', payload);
      return res.data.event;
    },
    onSuccess: (newEvent) => {
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['organiser-events'] });
      queryClient.invalidateQueries({ queryKey: ['organiser-stats'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setAnnouncement(`Event "${newEvent.title}" submitted successfully for admin review!`);
      refetchEvents();
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to create event');
    }
  });

  // Edit event mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.patch(`/events/${id}`, payload);
      return res.data.event;
    },
    onSuccess: (updatedEvent) => {
      setEditingEvent(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['organiser-events'] });
      queryClient.invalidateQueries({ queryKey: ['organiser-stats'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setAnnouncement(`Event "${updatedEvent.title}" updated successfully!`);
      refetchEvents();
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to update event');
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'Technology',
      venue: '',
      starts_at: '',
      ends_at: '',
      capacity: 50,
      poster_url: ''
    });
    setFieldErrors({});
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (event) => {
    resetForm();
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      category: event.category,
      venue: event.venue,
      starts_at: new Date(event.starts_at).toISOString().slice(0, 16),
      ends_at: new Date(event.ends_at).toISOString().slice(0, 16),
      capacity: event.capacity,
      poster_url: event.poster_url || ''
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim() || formData.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters.';
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters.';
    }
    if (!formData.venue.trim()) {
      errors.venue = 'Venue or room location is required.';
    }
    const capNum = Number(formData.capacity);
    if (!capNum || capNum < 1) {
      errors.capacity = 'Capacity must be at least 1 seat.';
    }
    if (editingEvent && capNum < editingEvent.booked_count) {
      errors.capacity = `Capacity cannot be lower than current active bookings (${editingEvent.booked_count}).`;
    }
    if (!formData.starts_at) {
      errors.starts_at = 'Start date and time is required.';
    }
    if (!formData.ends_at) {
      errors.ends_at = 'End date and time is required.';
    }
    if (formData.starts_at && formData.ends_at) {
      const s = new Date(formData.starts_at);
      const e = new Date(formData.ends_at);
      if (e <= s) {
        errors.ends_at = 'End time must be strictly after the start time.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      venue: formData.venue.trim(),
      capacity: Number(formData.capacity),
      starts_at: new Date(formData.starts_at).toISOString(),
      ends_at: new Date(formData.ends_at).toISOString(),
      poster_url: formData.poster_url?.trim() ? formData.poster_url.trim() : null
    };

    if (editingEvent) {
      editMutation.mutate({ id: editingEvent.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((ev) => {
      // Status filter
      if (statusFilter !== 'all' && ev.status !== statusFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== 'all' && ev.category !== categoryFilter) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(query);
        const matchVenue = ev.venue.toLowerCase().includes(query);
        const matchDesc = ev.description.toLowerCase().includes(query);
        if (!matchTitle && !matchVenue && !matchDesc) return false;
      }
      return true;
    });
  }, [events, statusFilter, categoryFilter, searchQuery]);

  // Filtered attendees in modal
  const filteredAttendees = useMemo(() => {
    if (!attendeesData) return [];
    return attendeesData.filter((att) => {
      if (attendeeStatusFilter !== 'all' && att.status !== attendeeStatusFilter) {
        return false;
      }
      if (attendeeSearch.trim()) {
        const q = attendeeSearch.toLowerCase();
        const matchName = att.user_name.toLowerCase().includes(q);
        const matchEmail = att.user_email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [attendeesData, attendeeStatusFilter, attendeeSearch]);

  const activeBookingsCount = attendeesData?.filter((a) => a.status === 'booked').length || 0;

  return (
    <div className="container page-container">
      <LiveRegion message={announcement} />

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">
            Organizer Hub {user?.name ? `— ${user.name}` : ''}
          </h1>
          <p className="section-subtitle">
            Manage your campus events, monitor seat reservations, and view attendee lists
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn btn-primary"
          id="btn-create-event"
        >
          + Create New Event
        </button>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div
          className={`stat-card stat-card-clickable ${statusFilter === 'all' ? 'stat-card-active' : ''}`}
          onClick={() => setStatusFilter('all')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('all')}
          aria-label="Filter all events"
        >
          <div className="stat-card-header">
            <span className="stat-label">Total Events</span>
            <span className="stat-icon" aria-hidden="true">📅</span>
          </div>
          <div className="stat-number">
            {statsLoading ? '...' : (statsData?.total_events ?? events?.length ?? 0)}
          </div>
          <div className="stat-subtext">All events created by you</div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${statusFilter === 'approved' ? 'stat-card-active' : ''}`}
          onClick={() => setStatusFilter('approved')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('approved')}
          aria-label="Filter approved events"
        >
          <div className="stat-card-header">
            <span className="stat-label">Approved & Active</span>
            <span className="stat-icon" aria-hidden="true">✅</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--success)' }}>
            {statsLoading ? '...' : (statsData?.approved_events ?? 0)}
          </div>
          <div className="stat-subtext">Live on campus discovery</div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${statusFilter === 'pending' ? 'stat-card-active' : ''}`}
          onClick={() => setStatusFilter('pending')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('pending')}
          aria-label="Filter pending events"
        >
          <div className="stat-card-header">
            <span className="stat-label">Pending Approval</span>
            <span className="stat-icon" aria-hidden="true">⏳</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--warning)' }}>
            {statsLoading ? '...' : (statsData?.pending_events ?? 0)}
          </div>
          <div className="stat-subtext">Awaiting administrator review</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Bookings</span>
            <span className="stat-icon" aria-hidden="true">🎟️</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--primary)' }}>
            {statsLoading ? '...' : (statsData?.total_active_bookings ?? 0)}
          </div>
          <div className="stat-subtext">Confirmed seats across your events</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="search-filter-row">
        <div className="search-filter-group">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, venue, or description..."
            className="form-input"
            style={{ minWidth: '260px' }}
            aria-label="Search my events"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-select"
            style={{ width: 'auto' }}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            <option value="Technology">Technology</option>
            <option value="Music">Music</option>
            <option value="Design">Design</option>
            <option value="Gaming">Gaming</option>
            <option value="Career">Career</option>
            <option value="Workshop">Workshop</option>
            <option value="Arts">Arts</option>
            <option value="Sports">Sports</option>
            <option value="Academic">Academic</option>
          </select>
        </div>

        {/* Status Pills */}
        <div className="pill-group" role="group" aria-label="Status filter">
          <button
            type="button"
            className={`pill-button ${statusFilter === 'all' ? 'pill-button-active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({events?.length || 0})
          </button>
          <button
            type="button"
            className={`pill-button ${statusFilter === 'approved' ? 'pill-button-active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            Approved ({events?.filter((e) => e.status === 'approved').length || 0})
          </button>
          <button
            type="button"
            className={`pill-button ${statusFilter === 'pending' ? 'pill-button-active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending ({events?.filter((e) => e.status === 'pending').length || 0})
          </button>
          <button
            type="button"
            className={`pill-button ${statusFilter === 'rejected' ? 'pill-button-active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            Rejected ({events?.filter((e) => e.status === 'rejected').length || 0})
          </button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {eventsLoading && <Skeleton height="280px" />}

      {/* Error State */}
      {isError && (
        <div className="form-error banner-error" role="alert">
          {error?.message || 'Failed to load organiser events.'}
        </div>
      )}

      {/* Empty State */}
      {!eventsLoading && filteredEvents.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">📋</div>
          <h2 className="empty-state-title">
            {events?.length === 0 ? 'No Events Created Yet' : 'No Events Match Filter'}
          </h2>
          <p className="empty-state-desc">
            {events?.length === 0
              ? 'You have not submitted any events yet. Click "+ Create New Event" above to create your first campus event.'
              : 'Try clearing your search query or switching your status filter to see other events.'}
          </p>
          {events?.length > 0 && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); }}
              className="btn btn-outline btn-sm"
              style={{ marginTop: '1rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Events Table */}
      {!eventsLoading && filteredEvents.length > 0 && (
        <div className="table-responsive">
          <table className="data-table" aria-label="Organiser Events Roster">
            <thead>
              <tr>
                <th scope="col">Event Details</th>
                <th scope="col">Category</th>
                <th scope="col">Approval Status</th>
                <th scope="col">Scheduled Date</th>
                <th scope="col">Capacity & Bookings</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {ev.poster_url ? (
                        <img
                          src={ev.poster_url}
                          alt=""
                          style={{ width: '48px', height: '48px', borderRadius: 'var(--radius)', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: 'var(--radius)',
                            backgroundColor: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem'
                          }}
                          aria-hidden="true"
                        >
                          🎟️
                        </div>
                      )}
                      <div>
                        <strong>{ev.title}</strong>
                        <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                          📍 {ev.venue}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-category">{ev.category}</span>
                  </td>
                  <td>
                    <span className={`badge badge-status badge-status-${ev.status}`}>
                      {ev.status === 'approved' ? '✓ APPROVED' : ev.status === 'pending' ? '⏳ PENDING REVIEW' : '✕ REJECTED'}
                    </span>
                  </td>
                  <td>
                    <div>
                      {new Date(ev.starts_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {new Date(ev.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {new Date(ev.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{ev.booked_count}</strong> / {ev.capacity} booked
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {ev.seats_left} seat(s) remaining
                    </div>
                  </td>
                  <td className="text-right table-actions-cell">
                    <button
                      type="button"
                      onClick={() => setAttendeeEvent(ev)}
                      className="btn btn-secondary btn-sm"
                      aria-label={`View attendees for ${ev.title}`}
                    >
                      Attendees ({ev.booked_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(ev)}
                      className="btn btn-outline btn-sm"
                      aria-label={`Edit ${ev.title}`}
                    >
                      Edit
                    </button>
                    {ev.status === 'approved' && (
                      <Link
                        to={`/events/${ev.id}`}
                        className="btn btn-ghost btn-sm"
                        title="View public event page"
                      >
                        Preview ↗
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {(isCreateOpen || editingEvent) && (
        <div
          className="modal-backdrop"
          onClick={() => { setIsCreateOpen(false); setEditingEvent(null); }}
          role="presentation"
        >
          <div
            className="modal-content modal-content-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 id="event-modal-title" className="modal-title" style={{ margin: 0 }}>
                {editingEvent ? `Edit Event: ${editingEvent.title}` : 'Create New Event'}
              </h2>
              <button
                type="button"
                onClick={() => { setIsCreateOpen(false); setEditingEvent(null); }}
                className="btn btn-ghost btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="form-error banner-error" role="alert" style={{ marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="modal-form" noValidate>
              <div className="form-group">
                <label htmlFor="evt-title" className="form-label">
                  Event Title <span className="text-danger">*</span>
                </label>
                <input
                  id="evt-title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`form-input ${fieldErrors.title ? 'form-input-error' : ''}`}
                  placeholder="e.g. Annual Campus Hackathon 2026"
                />
                {fieldErrors.title && <div className="form-error">{fieldErrors.title}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="evt-desc" className="form-label">
                  Description <span className="text-danger">*</span>
                </label>
                <textarea
                  id="evt-desc"
                  rows="3"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`form-input form-textarea ${fieldErrors.description ? 'form-input-error' : ''}`}
                  placeholder="Comprehensive description of the event, itinerary, and requirements..."
                />
                {fieldErrors.description && <div className="form-error">{fieldErrors.description}</div>}
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="evt-cat" className="form-label">Category</label>
                  <select
                    id="evt-cat"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-select"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Music">Music</option>
                    <option value="Design">Design</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Career">Career</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Arts">Arts</option>
                    <option value="Sports">Sports</option>
                    <option value="Academic">Academic</option>
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="evt-cap" className="form-label">
                    Seat Capacity <span className="text-danger">*</span>
                  </label>
                  <input
                    id="evt-cap"
                    type="number"
                    min="1"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className={`form-input ${fieldErrors.capacity ? 'form-input-error' : ''}`}
                  />
                  {fieldErrors.capacity && <div className="form-error">{fieldErrors.capacity}</div>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="evt-venue" className="form-label">
                  Venue / Room Location <span className="text-danger">*</span>
                </label>
                <input
                  id="evt-venue"
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className={`form-input ${fieldErrors.venue ? 'form-input-error' : ''}`}
                  placeholder="e.g. Main Auditorium Hall B or Science Complex Room 204"
                />
                {fieldErrors.venue && <div className="form-error">{fieldErrors.venue}</div>}
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="evt-start" className="form-label">
                    Starts At <span className="text-danger">*</span>
                  </label>
                  <input
                    id="evt-start"
                    type="datetime-local"
                    required
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    className={`form-input ${fieldErrors.starts_at ? 'form-input-error' : ''}`}
                  />
                  {fieldErrors.starts_at && <div className="form-error">{fieldErrors.starts_at}</div>}
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="evt-end" className="form-label">
                    Ends At <span className="text-danger">*</span>
                  </label>
                  <input
                    id="evt-end"
                    type="datetime-local"
                    required
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    className={`form-input ${fieldErrors.ends_at ? 'form-input-error' : ''}`}
                  />
                  {fieldErrors.ends_at && <div className="form-error">{fieldErrors.ends_at}</div>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="evt-poster" className="form-label">Poster Image URL (optional)</label>
                <input
                  id="evt-poster"
                  type="url"
                  value={formData.poster_url}
                  onChange={(e) => setFormData({ ...formData, poster_url: e.target.value })}
                  className="form-input"
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setEditingEvent(null); }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || editMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending || editMutation.isPending
                    ? 'Saving...'
                    : editingEvent
                    ? 'Save Changes'
                    : 'Submit Event for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendee Roster Modal */}
      {attendeeEvent && (
        <div
          className="modal-backdrop"
          onClick={() => setAttendeeEvent(null)}
          role="presentation"
        >
          <div
            className="modal-content modal-content-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendees-modal-title"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 id="attendees-modal-title" className="modal-title" style={{ margin: 0 }}>
                  Attendee Roster
                </h2>
                <div className="modal-desc" style={{ marginTop: '0.25rem' }}>
                  <strong>{attendeeEvent.title}</strong> — 📍 {attendeeEvent.venue}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttendeeEvent(null)}
                className="btn btn-ghost btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span className="badge badge-seats">
                Active Bookings: {activeBookingsCount} / {attendeeEvent.capacity}
              </span>
              <span className="badge badge-category">{attendeeEvent.category}</span>
            </div>

            {/* Attendee search & filter */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input
                type="search"
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                placeholder="Search attendee by name or email..."
                className="form-input form-input-sm"
                style={{ flex: 1, minWidth: '220px' }}
                aria-label="Filter attendee roster"
              />
              <select
                value={attendeeStatusFilter}
                onChange={(e) => setAttendeeStatusFilter(e.target.value)}
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                aria-label="Filter by attendee booking status"
              >
                <option value="all">All Records</option>
                <option value="booked">Active Bookings Only</option>
                <option value="cancelled">Cancelled Only</option>
              </select>
            </div>

            {attendeesLoading && <Skeleton height="180px" />}

            {!attendeesLoading && attendeesData && (
              <>
                {filteredAttendees.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                    <p className="empty-state-desc">
                      {attendeesData.length === 0
                        ? 'No students have booked seats for this event yet.'
                        : 'No attendees match your search filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="data-table" aria-label="Event Attendee List">
                      <thead>
                        <tr>
                          <th scope="col">Student Name</th>
                          <th scope="col">Email</th>
                          <th scope="col">Booking Status</th>
                          <th scope="col">Booked Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendees.map((att) => (
                          <tr key={att.id}>
                            <td><strong>{att.user_name}</strong></td>
                            <td>{att.user_email}</td>
                            <td>
                              <span className={`badge ${att.status === 'booked' ? 'badge-confirmed' : 'badge-cancelled'}`}>
                                {att.status === 'booked' ? '✓ CONFIRMED' : 'CANCELLED'}
                              </span>
                            </td>
                            <td>{new Date(att.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setAttendeeEvent(null)}
                className="btn btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
