import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import LiveRegion from '../components/LiveRegion.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals' | 'events' | 'users'
  const [announcement, setAnnouncement] = useState('');

  // Modals & Confirmation States
  const [selectedEventForDetails, setSelectedEventForDetails] = useState(null);
  const [eventToConfirm, setEventToConfirm] = useState(null); // { event, targetStatus }
  const [attendeeEvent, setAttendeeEvent] = useState(null);
  const [roleChangeToConfirm, setRoleChangeToConfirm] = useState(null); // { user, targetRole }

  // Oversight Filter States
  const [eventSearch, setEventSearch] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('all');
  const [eventStatusFilter, setEventStatusFilter] = useState('all');

  // User Management Filter & Pagination States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 10;

  // 1. Fetch Platform-wide Live Metrics
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data.stats;
    }
  });

  // 2. Query Pending Approvals Queue
  const {
    data: pendingEvents,
    isLoading: pendingLoading,
    refetch: refetchPending
  } = useQuery({
    queryKey: ['admin-pending-events'],
    queryFn: async () => {
      const res = await api.get('/admin/events?status=pending');
      return res.data.events;
    }
  });

  // 3. Query All Events for Platform Oversight
  const {
    data: oversightEvents,
    isLoading: oversightLoading,
    refetch: refetchOversight
  } = useQuery({
    queryKey: ['admin-oversight-events', eventStatusFilter, eventCategoryFilter, eventSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (eventStatusFilter !== 'all') params.append('status', eventStatusFilter);
      if (eventCategoryFilter !== 'all') params.append('category', eventCategoryFilter);
      if (eventSearch.trim()) params.append('search', eventSearch.trim());
      const res = await api.get(`/admin/events?${params.toString()}`);
      return res.data.events;
    },
    enabled: activeTab === 'events'
  });

  // 4. Query Users (Searchable & Paginated)
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['admin-users', userSearch, userRoleFilter, userPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(userPage),
        limit: String(userPageSize)
      });
      if (userSearch.trim()) params.append('search', userSearch.trim());
      if (userRoleFilter !== 'all') params.append('role', userRoleFilter);
      const res = await api.get(`/admin/users?${params.toString()}`);
      return res.data;
    },
    enabled: activeTab === 'users'
  });

  // 5. Query Attendees for an event (when inspecting attendees)
  const { data: attendeesData, isLoading: attendeesLoading } = useQuery({
    queryKey: ['admin-attendees', attendeeEvent?.id],
    queryFn: async () => {
      const res = await api.get(`/events/${attendeeEvent.id}/bookings`);
      return res.data.attendees;
    },
    enabled: Boolean(attendeeEvent?.id)
  });

  // Event Approval / Rejection Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ eventId, status }) => {
      const res = await api.patch(`/admin/events/${eventId}/status`, { status });
      return res.data.event;
    },
    onSuccess: (updatedEvent) => {
      setEventToConfirm(null);
      setSelectedEventForDetails(null);
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-oversight-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setAnnouncement(`Event "${updatedEvent.title}" has been ${updatedEvent.status}.`);
      refetchStats();
      refetchPending();
      if (activeTab === 'events') refetchOversight();
    },
    onError: (err) => {
      setAnnouncement(`Failed to update event status: ${err.message}`);
    }
  });

  // User Role Mutation
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const res = await api.patch(`/admin/users/${userId}/role`, { role });
      return res.data.user;
    },
    onSuccess: (updatedUser) => {
      setRoleChangeToConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setAnnouncement(`User "${updatedUser.name}" role updated to ${updatedUser.role}.`);
      refetchUsers();
      refetchStats();
    },
    onError: (err) => {
      setAnnouncement(`Failed to change role: ${err.message}`);
    }
  });

  const handleRoleSelectChange = (u, targetRole) => {
    if (targetRole === u.role) return;
    setRoleChangeToConfirm({ user: u, targetRole });
  };

  return (
    <div className="container page-container">
      <LiveRegion message={announcement} />

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Administrative Dashboard</h1>
          <p className="section-subtitle">
            Platform governance, event approval queue, capacity tracking, and campus user roles
          </p>
        </div>
      </div>

      {/* Platform-wide Live Metrics */}
      <div className="stats-grid stats-grid-5">
        <div
          className={`stat-card stat-card-clickable ${activeTab === 'users' ? 'stat-card-active' : ''}`}
          onClick={() => setActiveTab('users')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('users')}
          aria-label="View user management tab"
        >
          <div className="stat-card-header">
            <span className="stat-label">Campus Users</span>
            <span className="stat-icon" aria-hidden="true">👥</span>
          </div>
          <div className="stat-number">
            {statsLoading ? '...' : (statsData?.total_users ?? 0)}
          </div>
          <div className="stat-subtext">
            {statsData ? `${statsData.total_students} students · ${statsData.total_organisers} organisers` : 'Loading breakdown...'}
          </div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${activeTab === 'approvals' ? 'stat-card-active' : ''}`}
          onClick={() => setActiveTab('approvals')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('approvals')}
          aria-label="View event approvals queue"
        >
          <div className="stat-card-header">
            <span className="stat-label">Pending Review</span>
            <span className="stat-icon" aria-hidden="true">⏳</span>
          </div>
          <div className="stat-number" style={{ color: (statsData?.pending_events || 0) > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
            {statsLoading ? '...' : (statsData?.pending_events ?? pendingEvents?.length ?? 0)}
          </div>
          <div className="stat-subtext">
            {(statsData?.pending_events || 0) > 0 ? 'Requires administrative action' : 'Queue is empty'}
          </div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${activeTab === 'events' ? 'stat-card-active' : ''}`}
          onClick={() => { setActiveTab('events'); setEventStatusFilter('approved'); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('events')}
          aria-label="View approved events"
        >
          <div className="stat-card-header">
            <span className="stat-label">Approved Events</span>
            <span className="stat-icon" aria-hidden="true">✅</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--success)' }}>
            {statsLoading ? '...' : (statsData?.approved_events ?? 0)}
          </div>
          <div className="stat-subtext">Active campus events</div>
        </div>

        <div
          className={`stat-card stat-card-clickable ${activeTab === 'events' ? 'stat-card-active' : ''}`}
          onClick={() => { setActiveTab('events'); setEventStatusFilter('all'); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('events')}
          aria-label="View all platform events"
        >
          <div className="stat-card-header">
            <span className="stat-label">Total Events</span>
            <span className="stat-icon" aria-hidden="true">📅</span>
          </div>
          <div className="stat-number">
            {statsLoading ? '...' : (statsData?.total_events ?? 0)}
          </div>
          <div className="stat-subtext">Across all campus departments</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Active Bookings</span>
            <span className="stat-icon" aria-hidden="true">🎟️</span>
          </div>
          <div className="stat-number" style={{ color: 'var(--primary)' }}>
            {statsLoading ? '...' : (statsData?.total_active_bookings ?? 0)}
          </div>
          <div className="stat-subtext">Total seats reserved platform-wide</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container" role="tablist" aria-label="Admin Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'approvals'}
          aria-controls="panel-approvals"
          id="tab-approvals"
          onClick={() => setActiveTab('approvals')}
          className={`tab-btn ${activeTab === 'approvals' ? 'tab-btn-active' : ''}`}
        >
          Approval Queue ({pendingEvents?.length ?? 0})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'events'}
          aria-controls="panel-events"
          id="tab-events"
          onClick={() => setActiveTab('events')}
          className={`tab-btn ${activeTab === 'events' ? 'tab-btn-active' : ''}`}
        >
          Platform Events Oversight
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          aria-controls="panel-users"
          id="tab-users"
          onClick={() => setActiveTab('users')}
          className={`tab-btn ${activeTab === 'users' ? 'tab-btn-active' : ''}`}
        >
          User & Role Management
        </button>
      </div>

      {/* TAB 1: Event Approvals Queue */}
      {activeTab === 'approvals' && (
        <div id="panel-approvals" role="tabpanel" aria-labelledby="tab-approvals" className="tab-panel">
          {pendingLoading && <Skeleton height="250px" />}

          {!pendingLoading && pendingEvents?.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">✓</div>
              <h2 className="empty-state-title">No Pending Event Submissions</h2>
              <p className="empty-state-desc">
                All submitted events have been reviewed. New organizer submissions will appear here for administrative verification.
              </p>
            </div>
          )}

          {!pendingLoading && pendingEvents && pendingEvents.length > 0 && (
            <div className="table-responsive">
              <table className="data-table" aria-label="Events Awaiting Review">
                <thead>
                  <tr>
                    <th scope="col">Event Info</th>
                    <th scope="col">Organiser</th>
                    <th scope="col">Category</th>
                    <th scope="col">Schedule</th>
                    <th scope="col">Capacity</th>
                    <th scope="col" className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <strong>{ev.title}</strong>
                        <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                          📍 {ev.venue}
                        </div>
                      </td>
                      <td>
                        <strong>{ev.organiser_name}</strong>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {ev.organiser_email}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-category">{ev.category}</span>
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
                      <td>{ev.capacity} seats</td>
                      <td className="text-right table-actions-cell">
                        <button
                          type="button"
                          onClick={() => setSelectedEventForDetails(ev)}
                          className="btn btn-outline btn-sm"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          disabled={statusMutation.isPending}
                          onClick={() => setEventToConfirm({ event: ev, targetStatus: 'approved' })}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={statusMutation.isPending}
                          onClick={() => setEventToConfirm({ event: ev, targetStatus: 'rejected' })}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Platform Events Oversight */}
      {activeTab === 'events' && (
        <div id="panel-events" role="tabpanel" aria-labelledby="tab-events" className="tab-panel">
          <div className="search-filter-row">
            <div className="search-filter-group">
              <input
                type="search"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search by event title, venue, or organiser..."
                className="form-input"
                style={{ minWidth: '280px' }}
                aria-label="Search all platform events"
              />

              <select
                value={eventCategoryFilter}
                onChange={(e) => setEventCategoryFilter(e.target.value)}
                className="form-select"
                style={{ width: 'auto' }}
                aria-label="Filter events by category"
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

              <select
                value={eventStatusFilter}
                onChange={(e) => setEventStatusFilter(e.target.value)}
                className="form-select"
                style={{ width: 'auto' }}
                aria-label="Filter events by approval status"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {oversightLoading && <Skeleton height="250px" />}

          {!oversightLoading && oversightEvents?.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">📅</div>
              <h2 className="empty-state-title">No Events Match Filter</h2>
              <p className="empty-state-desc">Try clearing your search query or selecting a different status filter.</p>
            </div>
          )}

          {!oversightLoading && oversightEvents && oversightEvents.length > 0 && (
            <div className="table-responsive">
              <table className="data-table" aria-label="Platform Events Oversight">
                <thead>
                  <tr>
                    <th scope="col">Event Details</th>
                    <th scope="col">Organiser</th>
                    <th scope="col">Status</th>
                    <th scope="col">Date</th>
                    <th scope="col">Booked / Capacity</th>
                    <th scope="col" className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {oversightEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <strong>{ev.title}</strong>
                        <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                          📍 {ev.venue} · <span className="badge badge-category">{ev.category}</span>
                        </div>
                      </td>
                      <td>
                        <div><strong>{ev.organiser_name}</strong></div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{ev.organiser_email}</div>
                      </td>
                      <td>
                        <span className={`badge badge-status badge-status-${ev.status}`}>
                          {ev.status === 'approved' ? '✓ APPROVED' : ev.status === 'pending' ? '⏳ PENDING' : '✕ REJECTED'}
                        </span>
                      </td>
                      <td>
                        <div>{new Date(ev.starts_at).toLocaleDateString()}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {new Date(ev.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <strong>{ev.booked_count}</strong> / {ev.capacity}
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {ev.seats_left} seats left
                        </div>
                      </td>
                      <td className="text-right table-actions-cell">
                        <button
                          type="button"
                          onClick={() => setSelectedEventForDetails(ev)}
                          className="btn btn-outline btn-sm"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendeeEvent(ev)}
                          className="btn btn-secondary btn-sm"
                        >
                          Attendees ({ev.booked_count})
                        </button>
                        {ev.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => setEventToConfirm({ event: ev, targetStatus: 'approved' })}
                            className="btn btn-success btn-sm"
                          >
                            Approve
                          </button>
                        )}
                        {ev.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => setEventToConfirm({ event: ev, targetStatus: 'rejected' })}
                            className="btn btn-danger btn-sm"
                          >
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: User Role Management */}
      {activeTab === 'users' && (
        <div id="panel-users" role="tabpanel" aria-labelledby="tab-users" className="tab-panel">
          <div className="search-filter-row">
            <div className="search-filter-group">
              <input
                type="search"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                placeholder="Search users by name or email..."
                className="form-input"
                style={{ minWidth: '260px' }}
                aria-label="Search campus users"
              />

              <div className="pill-group" role="group" aria-label="Filter users by role">
                <button
                  type="button"
                  className={`pill-button ${userRoleFilter === 'all' ? 'pill-button-active' : ''}`}
                  onClick={() => { setUserRoleFilter('all'); setUserPage(1); }}
                >
                  All Users
                </button>
                <button
                  type="button"
                  className={`pill-button ${userRoleFilter === 'student' ? 'pill-button-active' : ''}`}
                  onClick={() => { setUserRoleFilter('student'); setUserPage(1); }}
                >
                  Students
                </button>
                <button
                  type="button"
                  className={`pill-button ${userRoleFilter === 'organiser' ? 'pill-button-active' : ''}`}
                  onClick={() => { setUserRoleFilter('organiser'); setUserPage(1); }}
                >
                  Organisers
                </button>
                <button
                  type="button"
                  className={`pill-button ${userRoleFilter === 'admin' ? 'pill-button-active' : ''}`}
                  onClick={() => { setUserRoleFilter('admin'); setUserPage(1); }}
                >
                  Admins
                </button>
              </div>
            </div>
          </div>

          {usersLoading && <Skeleton height="250px" />}

          {!usersLoading && usersData?.users?.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">👥</div>
              <h2 className="empty-state-title">No Users Found</h2>
              <p className="empty-state-desc">No accounts match your current query or role filter.</p>
            </div>
          )}

          {!usersLoading && usersData?.users && usersData.users.length > 0 && (
            <>
              <div className="table-responsive">
                <table className="data-table" aria-label="Campus User Roster">
                  <thead>
                    <tr>
                      <th scope="col">User Name</th>
                      <th scope="col">Email Address</th>
                      <th scope="col">Account Role</th>
                      <th scope="col">Registered On</th>
                      <th scope="col" className="text-right">Modify Permission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.users.map((u) => {
                      const isSelf = String(u.id) === String(currentAdmin?.id);
                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.name}</strong>
                            {isSelf && (
                              <span className="badge badge-category" style={{ marginLeft: '0.5rem' }}>
                                You (Active Session)
                              </span>
                            )}
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span className="badge badge-seats" style={{ textTransform: 'capitalize' }}>
                              {u.role}
                            </span>
                          </td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="text-right">
                            {isSelf ? (
                              <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
                                Self-demotion protected
                              </span>
                            ) : (
                              <select
                                aria-label={`Change role for ${u.name}`}
                                value={u.role}
                                disabled={roleMutation.isPending}
                                onChange={(e) => handleRoleSelectChange(u, e.target.value)}
                                className="form-select form-select-sm"
                                style={{ display: 'inline-block', width: 'auto' }}
                              >
                                <option value="student">Student</option>
                                <option value="organiser">Organiser</option>
                                <option value="admin">Admin</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="pagination-bar">
                <span>
                  Showing page <strong>{usersData.page}</strong> of <strong>{usersData.totalPages || 1}</strong> ({usersData.total} total accounts)
                </span>
                <div className="pagination-actions">
                  <button
                    type="button"
                    disabled={usersData.page <= 1}
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    className="btn btn-outline btn-sm"
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    disabled={usersData.page >= usersData.totalPages}
                    onClick={() => setUserPage((p) => p + 1)}
                    className="btn btn-outline btn-sm"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL 1: Full Event Details for Admin Inspection */}
      {selectedEventForDetails && (
        <div className="modal-backdrop" onClick={() => setSelectedEventForDetails(null)} role="presentation">
          <div
            className="modal-content modal-content-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-modal-title"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 id="details-modal-title" className="modal-title" style={{ margin: 0 }}>
                  {selectedEventForDetails.title}
                </h2>
                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className={`badge badge-status badge-status-${selectedEventForDetails.status}`}>
                    {selectedEventForDetails.status.toUpperCase()}
                  </span>
                  <span className="badge badge-category">{selectedEventForDetails.category}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventForDetails(null)}
                className="btn btn-ghost btn-sm"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="detail-grid">
              <div className="detail-item detail-item-full">
                <div className="detail-item-label">Description</div>
                <div className="detail-item-value">{selectedEventForDetails.description}</div>
              </div>

              <div className="detail-item">
                <div className="detail-item-label">Venue / Room</div>
                <div className="detail-item-value">📍 {selectedEventForDetails.venue}</div>
              </div>

              <div className="detail-item">
                <div className="detail-item-label">Seat Capacity</div>
                <div className="detail-item-value">{selectedEventForDetails.capacity} seats</div>
              </div>

              <div className="detail-item">
                <div className="detail-item-label">Scheduled Start</div>
                <div className="detail-item-value">{new Date(selectedEventForDetails.starts_at).toLocaleString()}</div>
              </div>

              <div className="detail-item">
                <div className="detail-item-label">Scheduled End</div>
                <div className="detail-item-value">{new Date(selectedEventForDetails.ends_at).toLocaleString()}</div>
              </div>

              <div className="detail-item">
                <div className="detail-item-label">Submitted By (Organiser)</div>
                <div className="detail-item-value">
                  {selectedEventForDetails.organiser_name || 'Organiser'} ({selectedEventForDetails.organiser_email || '—'})
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-item-label">Submission Date</div>
                <div className="detail-item-value">
                  {new Date(selectedEventForDetails.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setSelectedEventForDetails(null)}
                className="btn btn-secondary"
              >
                Close
              </button>

              {selectedEventForDetails.status !== 'approved' && (
                <button
                  type="button"
                  onClick={() => setEventToConfirm({ event: selectedEventForDetails, targetStatus: 'approved' })}
                  className="btn btn-success"
                >
                  Approve Event
                </button>
              )}

              {selectedEventForDetails.status !== 'rejected' && (
                <button
                  type="button"
                  onClick={() => setEventToConfirm({ event: selectedEventForDetails, targetStatus: 'rejected' })}
                  className="btn btn-danger"
                >
                  Reject Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Event Status Confirmation Dialog */}
      {eventToConfirm && (
        <div className="modal-backdrop" onClick={() => setEventToConfirm(null)} role="presentation">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-status-title"
          >
            <h2 id="confirm-status-title" className="modal-title">
              {eventToConfirm.targetStatus === 'approved' ? 'Approve Event' : 'Reject Event'}
            </h2>
            <p className="modal-desc">
              Are you sure you want to <strong>{eventToConfirm.targetStatus}</strong> "
              {eventToConfirm.event.title}"?
            </p>
            <div className="modal-notice">
              {eventToConfirm.targetStatus === 'approved'
                ? 'Approving this event will immediately publish it to the student discovery feed and open seat reservations.'
                : 'Rejecting this event will prevent it from appearing in student search results and halt bookings.'}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setEventToConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    eventId: eventToConfirm.event.id,
                    status: eventToConfirm.targetStatus
                  })
                }
                className={`btn ${eventToConfirm.targetStatus === 'approved' ? 'btn-success' : 'btn-danger'}`}
              >
                {statusMutation.isPending ? 'Processing...' : `Confirm ${eventToConfirm.targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: User Role Change Confirmation Dialog */}
      {roleChangeToConfirm && (
        <div className="modal-backdrop" onClick={() => setRoleChangeToConfirm(null)} role="presentation">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-role-title"
          >
            <h2 id="confirm-role-title" className="modal-title">
              Confirm Role Modification
            </h2>
            <p className="modal-desc">
              Change permissions for <strong>{roleChangeToConfirm.user.name}</strong> ({roleChangeToConfirm.user.email})?
            </p>
            <div className="detail-item" style={{ marginBottom: '1rem' }}>
              <div>
                Current Role: <span className="badge badge-seats">{roleChangeToConfirm.user.role}</span>
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                New Role: <span className="badge badge-category">{roleChangeToConfirm.targetRole}</span>
              </div>
            </div>
            <div className="modal-notice">
              {roleChangeToConfirm.targetRole === 'admin'
                ? 'Caution: Granting Admin permissions provides full system control, user role management, and event approvals.'
                : roleChangeToConfirm.targetRole === 'organiser'
                ? 'Organisers can create events, edit their own submissions, and view attendee rosters.'
                : 'Students can discover events, book seats, and manage personal bookings.'}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setRoleChangeToConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={roleMutation.isPending}
                onClick={() =>
                  roleMutation.mutate({
                    userId: roleChangeToConfirm.user.id,
                    role: roleChangeToConfirm.targetRole
                  })
                }
                className="btn btn-primary"
              >
                {roleMutation.isPending ? 'Updating...' : 'Confirm Role Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Admin Attendee Roster Inspection */}
      {attendeeEvent && (
        <div className="modal-backdrop" onClick={() => setAttendeeEvent(null)} role="presentation">
          <div
            className="modal-content modal-content-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-attendees-title"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 id="admin-attendees-title" className="modal-title" style={{ margin: 0 }}>
                  Attendee Roster Oversight
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

            {attendeesLoading && <Skeleton height="150px" />}

            {!attendeesLoading && attendeesData && (
              <>
                <p className="modal-desc">
                  Active Bookings: <strong>{attendeesData.filter((a) => a.status === 'booked').length}</strong> / {attendeeEvent.capacity} seats
                </p>

                {attendeesData.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                    <p className="empty-state-desc">No seat reservations have been made for this event.</p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="data-table" aria-label="Event Attendee List">
                      <thead>
                        <tr>
                          <th scope="col">Student Name</th>
                          <th scope="col">Email</th>
                          <th scope="col">Status</th>
                          <th scope="col">Booked At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendeesData.map((att) => (
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
