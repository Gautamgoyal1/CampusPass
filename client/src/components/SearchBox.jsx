import React from 'react';

const CATEGORIES = [
  'All Categories',
  'Technology',
  'Music',
  'Design',
  'Gaming',
  'Career',
  'Workshop',
  'Arts'
];

export default function SearchBox({
  search,
  onSearchChange,
  category,
  onCategoryChange
}) {
  return (
    <form
      className="search-box-container"
      onSubmit={(e) => e.preventDefault()}
      role="search"
      aria-label="Filter events"
    >
      <div className="search-field">
        <label htmlFor="event-search-input" className="visually-hidden">
          Search events by title or keyword
        </label>
        <div className="input-with-icon">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            id="event-search-input"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events by title or keyword..."
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
          value={category}
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
  );
}
