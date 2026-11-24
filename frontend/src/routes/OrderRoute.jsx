import React, { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import OrderDetails from '../pages/OrderDetails.jsx';
import { useResource } from '../hooks/useResource.js';
import { loadCatalog } from '../services/catalog-view.js';
import { paths } from './paths.js';

const loadEvents = (options) => loadCatalog({}, options);

export default function OrderRoute() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const close = useCallback(() => navigate(paths.tickets), [navigate]);
  const events = useResource(loadEvents);

  return (
    <>
      <div className="page-intro">
        <h1>Seu pedido</h1>
        <p>Acompanhe a compra e o pagamento.</p>
      </div>

      <Link className="text-button" to={paths.tickets}>
        Voltar aos ingressos
      </Link>

      <OrderDetails
        key={orderId}
        orderId={orderId}
        onClose={close}
        events={events.data || []}
        eventError={events.error}
        retryEvents={events.retry}
      />
    </>
  );
}
