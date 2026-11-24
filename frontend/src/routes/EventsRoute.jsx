import React, { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import ResourceState from '../components/ResourceState.jsx';
import { useResource } from '../hooks/useResource.js';
import Events from '../pages/Events.jsx';
import { loadCatalog } from '../services/catalog-view.js';
import { paths } from './paths.js';

export default function EventsRoute() {
  const [query, setQuery] = useSearchParams();
  const navigate = useNavigate();
  const search = query.get('search') || '';
  const category = query.get('category') || '';

  const loader = useCallback(
    (options) => loadCatalog({ search, category }, options),
    [search, category],
  );
  const resource = useResource(loader);

  function changeCategory(value) {
    const next = new URLSearchParams(query);

    if (value === 'Todos') {
      next.delete('category');
    } else {
      next.set('category', value);
    }

    setQuery(next);
  }

  return (
    <ResourceState resource={resource}>
      {(events) => (
        <Events
          events={events}
          category={category || 'Todos'}
          onCategoryChange={changeCategory}
          onSelect={(event) => navigate(paths.event(event.eventId))}
        />
      )}
    </ResourceState>
  );
}
