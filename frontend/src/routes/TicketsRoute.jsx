import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { customer, orders } from '../api.js';
import ResourceState from '../components/ResourceState.jsx';
import { useResource } from '../hooks/useResource.js';
import Tickets from '../pages/Tickets.jsx';
import { loadCatalog } from '../services/catalog-view.js';
import { listAll } from '../services/pagination.js';
import { ErrorNotice } from '../ui.jsx';
import { paths } from './paths.js';
import { ticketFilters } from './ticket-filters.js';

const loadOrders = (options) => listAll(orders.list, { username: customer }, options);
const loadEvents = (options) => loadCatalog({}, options);

export default function TicketsRoute() {
  const purchases = useResource(loadOrders);
  const events = useResource(loadEvents);
  const navigate = useNavigate();
  const [query, setQuery] = useSearchParams();
  const status = query.get('status');
  const filter = ticketFilters.some((item) => item.value === status) ? status : 'all';

  function changeFilter(value) {
    const next = new URLSearchParams(query);

    if (value === 'all') {
      next.delete('status');
    } else {
      next.set('status', value);
    }

    setQuery(next);
  }

  return (
    <>
      <ErrorNotice error={events.error} retry={events.retry} />

      <ResourceState resource={purchases}>
        {(items) => (
          <Tickets
            orders={items}
            events={events.data || []}
            filter={filter}
            onFilterChange={changeFilter}
            onSelect={(orderId) => navigate(paths.order(orderId))}
          />
        )}
      </ResourceState>
    </>
  );
}
