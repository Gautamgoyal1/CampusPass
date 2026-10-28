import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import LiveRegion from '../components/LiveRegion.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function OrganiserPage() {
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');

  // Modals & form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [attendeeEventId, setAttendeeEventId] = useState(null);

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
  const [formError, setFormError] = useState(null);

  // Fetch organiser's events
  const { data: events, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['organiser-events'],
    queryFn: async () => {
      const res = await api.get('/me/events');
      return res.data.events;
    }
  });

  // Fetch attendees for selected event
  const { data: attendeesData, isLoading: attendeesLoading } = useQuery({
    queryKey: ['attendees', attendeeEventId],
    queryFn: async () => {
      const res = await api.get(`/events/${attendeeEventId}/bookings`);
      return res.data.attendees;
    },
    enabled: Boolean(attendeeEventId)
  });

  // Create event mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/events', payload);
      return res.data.event;
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['organiser-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setAnnouncement('Event created successfully and submitted for admin review!');
      refetch();
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
    onSuccess: () => {
      setEditingEvent(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['organiser-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setAnnouncement('Event updated successfully!');
      refetch();
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
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (event) => {
    setFormError(null);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...formData,
      capacity: Number(formData.capacity),
      starts_at: new Date(formData.starts_at).toISOString(),
      ends_at: new Date(formData.ends_at).toISOString(),
      poster_url: formData.poster_url ? formData.poster_url : null
    };

    if (new Date(payload.ends_at) <= new Date(payload.starts_at)) {
      setFormError('End time must be after start time.');
      return;
    }

    if (editingEvent) {
      editMutation.mutate({ id: editingEvent.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="container page-container">
      <LiveRegion message={announcement} />

      <div className="section-header">
        <div>
          <h1 className="section-title">Organiser Hub</h1>
          <p className="section-subtitle">Manage your college events, track capacity, and view attendee lists</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn btn-primary"
        >
          + Create New Event
        </button>
      </div>

      {isLoading && <Skeleton height="200px" />}

      {isError && (
        <div className="form-error banner-error" role="alert">
          {error?.message || 'Failed to load organiser events.'}
        </div>
      )}

      {!isLoading && events && events.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">📋</div>
          <h2 className="empty-state-title">No Events Created Yet</h2>
          <p className="empty-state-desc">
            You haven't submitted any campus events. Click "Create New Event" above to get started!
          </p>
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table" aria-label="Organiser Events">
          <thead>
            <tr>
              <th scope="col">Event Title</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
              <th scope="col">Seats Left</th>
              <th scope="col">Booked</th>
              <th scope="col" className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events?.map((ev) => (
              <tr key={ev.id}>
                <td>
                  <strong>{ev.title}</strong>
                  <br />
                  <span className="text-muted">{ev.venue}</span>
                </td>
                <td><span className="badge badge-category">{ev.category}</span></td>
                <td>
                  <span className={`badge badge-status badge-status-${ev.status}`}>
                    {ev.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {new Date(ev.starts_at).toLocaleDateString()}
                </td>
                <td><strong>{ev.seats_left}</strong> / {ev.capacity}</td>
                <td>{ev.booked_count}</td>
                <td className="text-right table-actions-cell">
                  <button
                    type="button"
                    onClick={() => setAttendeeEventId(ev.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Attendees ({ev.booked_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ev)}
                    className="btn btn-outline btn-sm"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Event Modal */}
      {(isCreateOpen || editingEvent) && (
        <div className="modal-backdrop" onClick={() => { setIsCreateOpen(false); setEditingEvent(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
            <h2 id="event-modal-title" className="modal-title">
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </h2>

            {formError && (
              <div className="form-error banner-error" role="alert">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="evt-title" className="form-label">Title</label>
                <input
                  id="evt-title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="form-input"
                  placeholder="e.g. Annual Campus Hackathon"
                />
              </div>

              <div className="form-group">
                <label htmlFor="evt-desc" className="form-label">Description</label>
                <textarea
                  id="evt-desc"
                  rows="3"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input form-textarea"
                  placeholder="Detailed description of the event..."
                />
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
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="evt-cap" className="form-label">Seat Capacity</label>
                  <input
                    id="evt-cap"
                    type="number"
                    min="1"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="evt-venue" className="form-label">Venue / Room</label>
                <input
                  id="evt-venue"
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="form-input"
                  placeholder="e.g. Auditorium Hall B"
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="evt-start" className="form-label">Starts At</label>
                  <input
                    id="evt-start"
                    type="datetime-local"
                    required
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="evt-end" className="form-label">Ends At</label>
                  <input
                    id="evt-end"
                    type="datetime-local"
                    required
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    className="form-input"
                  />
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
                  placeholder="https://example.com/poster.jpg"
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
                    : editingEvent ? 'Save Changes' : 'Submit Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendees Modal */}
      {attendeeEventId && (
        <div className="modal-backdrop" onClick={() => setAttendeeEventId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="attendees-modal-title">
            <h2 id="attendees-modal-title" className="modal-title">
              Event Attendees
            </h2>

            {attendeesLoading && <Skeleton height="150px" />}

            {!attendeesLoading && attendeesData && (
              <>
                <p className="modal-desc">
                  Total Booked: <strong>{attendeesData.filter(a => a.status === 'booked').length}</strong> attendee(s)
                </p>

                {attendeesData.length === 0 ? (
                  <p className="empty-state-desc">No bookings yet for this event.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Booked At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendeesData.map((att) => (
                          <tr key={att.id}>
                            <td><strong>{att.user_name}</strong></td>
                            <td>{att.user_email}</td>
                            <td>
                              <span className={`badge ${att.status === 'booked' ? 'badge-confirmed' : 'badge-cancelled'}`}>
                                {att.status}
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
                onClick={() => setAttendeeEventId(null)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
