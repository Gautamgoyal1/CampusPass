import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api } from '../api.js';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dropdownRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 1. Fetch unread count periodically
  const { data: countData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data.data.unreadCount;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });

  const unreadCount = countData || 0;

  // 2. Fetch notifications when dropdown is opened
  const {
    data: notifData,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const res = await api.get('/notifications', {
        params: { unreadOnly: unreadOnly ? 'true' : 'false', limit: 40 }
      });
      return res.data.data;
    },
    enabled: isOpen
  });

  const notifications = notifData?.notifications || [];

  // 3. Mark single notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/notifications/${id}/read`);
      return res.data.data.notification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // 4. Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/notifications/read-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsReadMutation.mutate(notif.id);
    }
    setIsOpen(false);

    if (notif.event_id) {
      navigate(`/events/${notif.event_id}`);
    } else if (notif.booking_id) {
      navigate('/my-bookings');
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'booking_confirmed':
        return '🎟️';
      case 'booking_cancelled':
        return '⚠️';
      case 'event_cancelled':
        return '❌';
      case 'event_updated':
        return '🕒';
      default:
        return '🔔';
    }
  };

  return (
    <div className="notification-center-container" ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) refetch();
        }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="bell-icon" aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-unread-pill" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown-menu" role="dialog" aria-label="Notifications Panel">
          <div className="notification-dropdown-header">
            <div className="notification-header-title-wrap">
              <h3 className="notification-header-title">Notifications</h3>
              {unreadCount > 0 && (
                <span className="notification-unread-tag">{unreadCount} new</span>
              )}
            </div>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs mark-all-read-btn"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="notification-filters">
            <button
              type="button"
              className={`notification-filter-btn ${!unreadOnly ? 'active' : ''}`}
              onClick={() => setUnreadOnly(false)}
            >
              All
            </button>
            <button
              type="button"
              className={`notification-filter-btn ${unreadOnly ? 'active' : ''}`}
              onClick={() => setUnreadOnly(true)}
            >
              Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
            </button>
          </div>

          <div className="notification-list" tabIndex={0}>
            {isLoading ? (
              <div className="notification-loading-state">
                <div className="notification-skeleton-item shimmer" />
                <div className="notification-skeleton-item shimmer" />
                <div className="notification-skeleton-item shimmer" />
              </div>
            ) : isError ? (
              <div className="notification-empty-state">
                <p>Failed to load notifications.</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => refetch()}
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty-state">
                <span className="empty-emoji" aria-hidden="true">🎉</span>
                <p className="empty-text">
                  {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <span className="empty-subtext">You are all caught up!</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item ${!notif.is_read ? 'unread' : 'read'}`}
                  onClick={() => handleNotificationClick(notif)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(notif);
                    }
                  }}
                >
                  <div className="notif-type-icon" aria-hidden="true">
                    {getNotifIcon(notif.type)}
                  </div>
                  <div className="notif-content">
                    <div className="notif-top-row">
                      <span className="notif-title">{notif.title}</span>
                      <span className="notif-time">{formatRelativeTime(notif.created_at)}</span>
                    </div>
                    <p className="notif-message">{notif.message}</p>
                    {notif.event_venue && (
                      <span className="notif-venue-pill">📍 {notif.event_venue}</span>
                    )}
                  </div>
                  {!notif.is_read && (
                    <button
                      type="button"
                      className="notif-mark-single-btn"
                      title="Mark as read"
                      aria-label="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsReadMutation.mutate(notif.id);
                      }}
                    >
                      <span className="unread-dot" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
