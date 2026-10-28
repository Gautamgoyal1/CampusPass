import React from 'react';

export default function LiveRegion({ message, type = 'polite' }) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic="true"
      className="visually-hidden"
    >
      {message}
    </div>
  );
}
