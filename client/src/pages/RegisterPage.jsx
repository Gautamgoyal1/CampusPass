import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import LiveRegion from '../components/LiveRegion.jsx';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      setAnnouncement('Registration successful! Welcome to CampusPass.');
      navigate('/');
    } catch (err) {
      const msg = err.message || 'Failed to register. Please check your information.';
      setErrorMsg(msg);
      setAnnouncement(`Registration error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-page-container">
      <LiveRegion message={announcement} />

      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="auth-title">Create an Account</h1>
          <p className="auth-subtitle">Join CampusPass to discover and book seats for campus events</p>
        </div>

        {errorMsg && (
          <div className="form-error banner-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="reg-name" className="form-label">
              Full Name
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">
              College Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@student.edu"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password" className="form-label">
              Password (min. 6 characters)
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a secure password"
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
                <span className="spinner" aria-hidden="true"></span> Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
