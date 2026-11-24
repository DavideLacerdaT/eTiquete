import React from 'react';
import { useNavigate } from 'react-router';
import { customer, notifications } from '../api.js';
import ResourceState from '../components/ResourceState.jsx';
import { useResource } from '../hooks/useResource.js';
import Notifications from '../pages/Notifications.jsx';
import { listAll } from '../services/pagination.js';
import { paths } from './paths.js';

const loadNotifications = (options) => listAll(notifications.list, { username: customer }, options);

export default function NotificationsRoute() {
  const resource = useResource(loadNotifications);
  const navigate = useNavigate();

  return (
    <ResourceState resource={resource}>
      {(items) => (
        <Notifications
          notifications={items}
          onSelect={(orderId) => navigate(paths.order(orderId))}
        />
      )}
    </ResourceState>
  );
}
