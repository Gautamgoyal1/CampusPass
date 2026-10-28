import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import LiveRegion from '../components/LiveRegion.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'users'
  const [announcement, setAnnouncement] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  // Query events for review
  const {
    data: adminEvents,
    isLoading: eventsLoading,
    refetch: refetchEvents
  } = useQuery({
    queryKey: ['admin-events', statusFilter],
    queryFn: async () => {
      const res = await api.get(`/admin/events?status=${statusFilter}`);
      return res.data.events;
    }
  });

  // Query users
  const {
    data: adminUsers,
    isLoading: usersLoading,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data.users;
    },
    enabled: activeTab === 'users'
  });

  // Update Event Status Mutation (Approve / Reject)
  const statusMutation = useMutation({
    mutationFn: async ({ eventId, status }) => {
      const res = await api.patch(`/admin/events/${eventId}/status`, { status });
      return res.data.event;
    },
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setAnnouncement(`Event "${updatedEvent.title}" has been ${updatedEvent.status}.`);
      refetchEvents();
    }
  });

  // Update User Role Mutation
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const res = await api.patch(`/admin/users/${userId}/role`, { role });
      return res.data.user;
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setAnnouncement(`User "${updatedUser.name}" role updated to ${updatedUser.role}.`);
      refetchUsers();
    }
  });

  return (
    <div className="container page-container">
      <LiveRegion message={announcement} />

      <div className="section-header">
        <div>
          <h1 className="section-title">Administrative Dashboard</h1>
          <p className="section-subtitle">
            Review submitted campus events and manage student, organiser, and admin roles
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container" role="tablist" aria-label="Admin Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'events'}
          aria-controls="panel-events"
          id="tab-events"
          onClick={() => setActiveTab('events')}
          className={`tab-btn ${activeTab === 'events' ? 'tab-btn-active' : ''}`}
        >
          Event Approvals
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
          User Role Management
        </button>
      </div>

      {/* Events Panel */}
      {activeTab === 'events' && (
        <div id="panel-events" role="tabpanel" aria-labelledby="tab-events" className="tab-panel">
          <div className="filter-bar">
            <label htmlFor="admin-status-filter" className="form-label" style={{ marginBottom: 0 }}>
              Status Filter:
            </label>
            <select
              id="admin-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
            >
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Events</option>
            </select>
          </div>

          {eventsLoading && <Skeleton height="200px" />}

          {!eventsLoading && adminEvents?.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">✓</div>
              <h2 className="empty-state-title">No Events in this Category</h2>
              <p className="empty-state-desc">There are currently no events matching the "{statusFilter}" filter.</p>
            </div>
          )}

          <div className="table-responsive">
            <table className="data-table" aria-label="Events pending review">
              <thead>
                <tr>
                  <th scope="col">Event Info</th>
                  <th scope="col">Organiser</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Capacity</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminEvents?.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <strong>{ev.title}</strong>
                      <br />
                      <span className="badge badge-category">{ev.category}</span>
                      <br />
                      <span className="text-muted">{ev.venue}</span>
                    </td>
                    <td>
                      <strong>{ev.organiser_name}</strong>
                      <br />
                      <span className="text-muted">{ev.organiser_email}</span>
                    </td>
                    <td>
                      Starts: {new Date(ev.starts_at).toLocaleDateString()}
                    </td>
                    <td>{ev.capacity} seats</td>
                    <td>
                      <span className={`badge badge-status badge-status-${ev.status}`}>
                        {ev.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right table-actions-cell">
                      {ev.status !== 'approved' && (
                        <button
                          type="button"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ eventId: ev.id, status: 'approved' })}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                      )}
                      {ev.status !== 'rejected' && (
                        <button
                          type="button"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ eventId: ev.id, status: 'rejected' })}
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
        </div>
      )}

      {/* Users Panel */}
      {activeTab === 'users' && (
        <div id="panel-users" role="tabpanel" aria-labelledby="tab-users" className="tab-panel">
          {usersLoading && <Skeleton height="200px" />}

          <div className="table-responsive">
            <table className="data-table" aria-label="Campus Users and Roles">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Email</th>
                  <th scope="col">Current Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col" className="text-right">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers?.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-seats">{u.role}</span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="text-right">
                      <select
                        aria-label={`Change role for ${u.name}`}
                        value={u.role}
                        disabled={roleMutation.isPending}
                        onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value })}
                        className="form-select form-select-sm"
                        style={{ display: 'inline-block', width: 'auto' }}
                      >
                        <option value="student">Student</option>
                        <option value="organiser">Organiser</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
