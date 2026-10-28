import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="navbar" role="banner">
        <div className="container nav-container">
          <Link to="/" className="brand-logo" onClick={closeMenu}>
            <span className="brand-icon" aria-hidden="true">🎟️</span>
            <span className="brand-text">Campus<span className="brand-highlight">Pass</span></span>
          </Link>

          <button
            type="button"
            className="mobile-nav-toggle"
            aria-expanded={mobileMenuOpen}
            aria-controls="primary-navigation"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="hamburger-icon" aria-hidden="true">
              {mobileMenuOpen ? '✕' : '☰'}
            </span>
          </button>

          <nav
            id="primary-navigation"
            className={`nav-links ${mobileMenuOpen ? 'nav-links-open' : ''}`}
            aria-label="Main Navigation"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              onClick={closeMenu}
            >
              Browse Events
            </NavLink>

            {user?.role === 'student' && (
              <NavLink
                to="/my-bookings"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                onClick={closeMenu}
              >
                My Bookings
              </NavLink>
            )}

            {(user?.role === 'organiser' || user?.role === 'admin') && (
              <NavLink
                to="/organiser"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                onClick={closeMenu}
              >
                Organiser Hub
              </NavLink>
            )}

            {user?.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                onClick={closeMenu}
              >
                Admin Panel
              </NavLink>
            )}

            <div className="nav-auth-section">
              {user ? (
                <div className="user-profile-menu">
                  <span className="user-greeting">
                    <span className="user-name">{user.name}</span>
                    <span className="user-role-badge">{user.role}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="btn btn-outline btn-sm"
                  >
                    Log Out
                  </button>
                </div>
              ) : (
                <div className="auth-buttons">
                  <Link
                    to="/login"
                    className="btn btn-ghost btn-sm"
                    onClick={closeMenu}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary btn-sm"
                    onClick={closeMenu}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex="-1">
        <Outlet />
      </main>

      <footer className="footer" role="contentinfo">
        <div className="container footer-container">
          <p className="footer-brand">
            CampusPass — College Event Discovery & Seat Booking Platform
          </p>
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} CampusPass. Built for accessible, reliable campus events.
          </p>
        </div>
      </footer>
    </div>
  );
}
