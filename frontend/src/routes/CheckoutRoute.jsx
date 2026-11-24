import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import Checkout from '../Checkout.jsx';
import ResourceState from '../components/ResourceState.jsx';
import { useResource } from '../hooks/useResource.js';
import { loadCatalog, loadEvent } from '../services/catalog-view.js';
import { Empty } from '../ui.jsx';
import { paths } from './paths.js';

export default function CheckoutRoute() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState(null);

  const loader = useCallback(
    async (options) => {
      const [event, catalog] = await Promise.all([
        loadEvent(eventId, options),
        loadCatalog({}, options),
      ]);
      const events = [event, ...catalog.filter((item) => item.eventId !== eventId)];

      return { event, events: events.filter((item) => item.sessions.length > 0) };
    },
    [eventId],
  );

  const resource = useResource(loader);
  const close = useCallback(() => {
    navigate(orderId ? paths.order(orderId) : paths.event(eventId));
  }, [navigate, eventId, orderId]);

  const complete = useCallback((createdOrderId) => setOrderId(createdOrderId), []);

  return (
    <>
      <div className="page-intro">
        <h1>Escolha seus ingressos</h1>
        <p>Reserve até dois lugares antes de confirmar o pedido.</p>
      </div>

      <Link className="text-button" to={paths.event(eventId)}>
        Voltar ao evento
      </Link>

      <ResourceState resource={resource}>
        {({ event, events }) =>
          event.sessions.length ? (
            <Checkout
              key={eventId}
              initialEvent={event}
              events={events}
              onClose={close}
              onComplete={complete}
            />
          ) : (
            <Empty title="Nenhuma sessão disponível">Escolha outro evento para continuar.</Empty>
          )
        }
      </ResourceState>
    </>
  );
}
