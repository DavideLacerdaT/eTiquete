import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { customer, orders } from '../api.js';
import { useResource } from '../hooks/useResource.js';
import { loadCatalog } from '../services/catalog-view.js';
import { listAll } from '../services/pagination.js';
import { ErrorNotice, Loading } from '../ui.jsx';
import Home from '../pages/Home.jsx';
import { legacyDestination, paths } from './paths.js';

const loadEvents = (options) => loadCatalog({}, options);
const loadOrders = (options) => listAll(orders.list, { username: customer }, options);

export default function HomeRoute() {
  const events = useResource(loadEvents);
  const purchases = useResource(loadOrders);
  const navigate = useNavigate();
  const location = useLocation();
  const legacy = legacyDestination(location.hash);

  if (legacy && legacy !== paths.home) {
    return <Navigate to={legacy} replace />;
  }

  return (
    <>
      <ErrorNotice error={events.error} retry={events.retry} />
      <ErrorNotice error={purchases.error} retry={purchases.retry} />

      {events.loading || purchases.loading ? (
        <Loading />
      ) : (
        <Home
          events={events.data || []}
          orders={purchases.data || []}
          onSelect={(event) => navigate(paths.event(event.eventId))}
          navigate={(page) => navigate(paths[page])}
        />
      )}
    </>
  );
}
