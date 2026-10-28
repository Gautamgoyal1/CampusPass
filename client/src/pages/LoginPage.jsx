import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import LiveRegion from '../components/LiveRegion.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await login(email, password);
      setAnnouncement('Login successful! Redirecting...');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.message || 'Invalid email or password';
      setErrorMsg(msg);
      setAnnouncement(`Login error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-page-container">
      <LiveRegion message={announcement} />

      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Log in to your CampusPass student or organiser account</p>
        </div>

        {errorMsg && (
          <div className="form-error banner-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              College Email Address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alice@student.campuspass.edu"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="form-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-block"
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true"></span> Logging In...
              </>
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>
            Don't have an account yet?{' '}
            <Link to="/register" className="auth-link">
              Create an account
            </Link>
          </p>

          <div className="demo-credentials-box">
            <strong>Sample Accounts for Testing:</strong>
            <ul>
              <li>Student: <code>alice@student.campuspass.edu</code> / <code>password123</code></li>
              <li>Organiser: <code>organiser@campuspass.edu</code> / <code>organiser123</code></li>
              <li>Admin: <code>admin@campuspass.edu</code> / <code>admin123</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
