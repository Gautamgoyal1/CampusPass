import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useEvents } from '../hooks/useEvents.js';
import { useDebounce } from '../hooks/useDebounce.js';
import SearchBox from '../components/SearchBox.jsx';
import EventGrid from '../components/EventGrid.jsx';
import LiveRegion from '../components/LiveRegion.jsx';

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get('q') || '';
  const urlCategory = searchParams.get('category') || '';

  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [category, setCategory] = useState(urlCategory);
  const [announcement, setAnnouncement] = useState('');

  const debouncedSearch = useDebounce(searchTerm, 350);

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (category) params.set('category', category);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, category, setSearchParams]);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useEvents({ search: debouncedSearch, category });

  const allEvents = data?.pages.flatMap((page) => page.events) || [];

  useEffect(() => {
    if (data && !isLoading) {
      setAnnouncement(`Found ${allEvents.length} events matching your criteria.`);
    }
  }, [allEvents.length, data, isLoading]);

  return (
    <div className="container page-container">
      <LiveRegion message={announcement} />

      <section className="hero-section" aria-labelledby="hero-title">
        <h1 id="hero-title" className="hero-title">
          Discover & Book <span className="brand-highlight">Campus Events</span>
        </h1>
        <p className="hero-subtitle">
          Say goodbye to messy WhatsApp groups and Google Forms. Discover college festivals, tech hackathons, and workshops all in one place.
        </p>

        <div className="hero-search-wrapper">
          <SearchBox
            search={searchTerm}
            onSearchChange={setSearchTerm}
            category={category}
            onCategoryChange={setCategory}
          />
        </div>
      </section>

      <section className="events-listing-section" aria-label="Available Events List">
        <div className="section-header">
          <h2 className="section-title">
            {category ? `${category} Events` : 'Upcoming Events'}
          </h2>
          <span className="results-count" aria-live="polite">
            {!isLoading && `${allEvents.length} event${allEvents.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {isError && (
          <div className="form-error banner-error" role="alert">
            {error?.message || 'Failed to load events. Please try refreshing the page.'}
          </div>
        )}

        <EventGrid events={allEvents} loading={isLoading} />

        {hasNextPage && (
          <div className="load-more-container">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="btn btn-outline btn-lg"
            >
              {isFetchingNextPage ? (
                <>
                  <span className="spinner" aria-hidden="true"></span> Loading More...
                </>
              ) : (
                'Load More Events'
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
