import React from 'react';

const CATEGORIES = [
  'All Categories',
  'Technology',
  'Music',
  'Design',
  'Gaming',
  'Career',
  'Workshop',
  'Arts',
  'Sports',
  'Academic'
];

export default function SearchBox({
  search,
  onSearchChange,
  category,
  onCategoryChange
}) {
  return (
    <div className="search-box-wrapper">
      <form
        className="search-box-container"
        onSubmit={(e) => e.preventDefault()}
        role="search"
        aria-label="Filter events"
      >
        <div className="search-field">
          <label htmlFor="event-search-input" className="visually-hidden">
            Search events by title, venue, or keyword
          </label>
          <div className="input-with-icon">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              id="event-search-input"
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search events by title, venue, or keyword..."
              className="form-input search-input"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear search input"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="category-field">
          <label htmlFor="event-category-select" className="visually-hidden">
            Filter by category
          </label>
          <select
            id="event-category-select"
            value={category || 'All Categories'}
            onChange={(e) => onCategoryChange(e.target.value === 'All Categories' ? '' : e.target.value)}
            className="form-select category-select"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat === 'All Categories' ? '' : cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </form>

      {/* Quick Category Filter Pills */}
      <div
        className="category-pills-row"
        role="group"
        aria-label="Filter events by category quick chips"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginTop: '0.75rem',
          justifyContent: 'center'
        }}
      >
        {CATEGORIES.map((cat) => {
          const value = cat === 'All Categories' ? '' : cat;
          const isSelected = (!category && cat === 'All Categories') || category === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`pill-button ${isSelected ? 'pill-button-active' : ''}`}
              onClick={() => onCategoryChange(value)}
              style={{
                fontSize: '0.8125rem',
                padding: '0.35rem 0.85rem'
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
