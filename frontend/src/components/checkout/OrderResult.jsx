import React from 'react';
import { Check, Clock3 } from 'lucide-react';
import { Badge, time } from '../../ui.jsx';

export default function OrderResult({ order, timeline, onClose }) {
  const confirmed = order.status === 'CONFIRMED';

  return (
    <div className="order-result">
      <div className="flow-state compact">
        <div className={`round-illustration ${confirmed ? 'green' : 'blue'}`}>
          {confirmed ? <Check size={44} /> : <Clock3 size={44} />}
        </div>

        <Badge status={order.status} />

        <h3>
          {confirmed
            ? 'Agora é só viver o momento.'
            : order.status === 'CANCELLED'
              ? 'Sua compra foi cancelada.'
              : 'Estamos cuidando de cada etapa.'}
        </h3>

        <p>
          {order.sagaStatus === 'MANUAL_INTERVENTION'
            ? 'Uma etapa precisa de revisão. Seu pedido está registrado; acompanhe a atualização em Meus ingressos.'
            : confirmed
              ? 'Seus ingressos e a confirmação estão disponíveis no seu painel.'
              : 'O pedido só é confirmado depois do pagamento e da confirmação dos assentos.'}
        </p>

        <small className="order-reference">Pedido {order.orderId}</small>
      </div>

      <ol className="timeline">
        {timeline.map((item, i) => (
          <li key={i}>
            <span className="timeline-dot" />

            <div>
              <strong>{item.label}</strong>

              <small>{time(item.occurredAt)}</small>
            </div>
          </li>
        ))}
      </ol>

      <button className="button primary" onClick={onClose}>
        Voltar ao painel
      </button>
    </div>
  );
}
