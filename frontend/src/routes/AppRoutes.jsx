import React from 'react';
import { Route, Routes, useParams } from 'react-router';
import { isUuid } from '../../../shared/contracts.js';
import BaseLayout from '../components/layout/BaseLayout.jsx';
import Lab from '../pages/Lab.jsx';
import CheckoutRoute from './CheckoutRoute.jsx';
import EventRoute from './EventRoute.jsx';
import EventsRoute from './EventsRoute.jsx';
import HomeRoute from './HomeRoute.jsx';
import NotFoundRoute from './NotFoundRoute.jsx';
import NotificationsRoute from './NotificationsRoute.jsx';
import OrderRoute from './OrderRoute.jsx';
import TicketsRoute from './TicketsRoute.jsx';
import { paths, routePatterns } from './paths.js';

function ResourceId({ name, children }) {
  const params = useParams();

  return isUuid(params[name]) ? (
    React.cloneElement(children, { key: params[name] })
  ) : (
    <NotFoundRoute />
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<BaseLayout />}>
        <Route path={paths.home} element={<HomeRoute />} />
        <Route path={paths.events} element={<EventsRoute />} />
        <Route
          path={routePatterns.event}
          element={
            <ResourceId name="eventId">
              <EventRoute />
            </ResourceId>
          }
        />
        <Route
          path={routePatterns.checkout}
          element={
            <ResourceId name="eventId">
              <CheckoutRoute />
            </ResourceId>
          }
        />
        <Route path={paths.tickets} element={<TicketsRoute />} />
        <Route
          path={routePatterns.order}
          element={
            <ResourceId name="orderId">
              <OrderRoute />
            </ResourceId>
          }
        />
        <Route path={paths.notifications} element={<NotificationsRoute />} />
        <Route path={paths.lab} element={<Lab />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}
