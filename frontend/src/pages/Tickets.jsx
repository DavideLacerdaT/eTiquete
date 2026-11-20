import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge, date, Empty, money, Poster } from '../ui.jsx';

function Tickets({ orders, events, onSelect }) {
  const [filter, setFilter] = useState('Todos');
  const filtered = orders.filter(
    (o) =>
      filter === 'Todos' ||
      (filter === 'Confirmados'
        ? o.status === 'CONFIRMED'
        : filter === 'Em andamento'
          ? !['CONFIRMED', 'CANCELLED', 'FAILED'].includes(o.status)
          : ['CANCELLED', 'FAILED'].includes(o.status)),
  );
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">HISTÓRIAS PARA VIVER</span>
        <h1>Meus ingressos</h1>
        <p>Seus lugares, suas compras e cada etapa até o grande dia.</p>
      </div>
      <div className="filter-chips">
        {['Todos', 'Confirmados', 'Em andamento', 'Cancelados'].map((f) => (
          <button
            className={`chip ${filter === f ? 'active' : ''}`}
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="orders-list">
        {filtered.map((order) => {
          const event = events.find((e) =>
            e.sessions.some((s) => s.sessionId === order.items[0].sessionId),
          );
          return (
            <button
              className="order-card"
              onClick={() => onSelect(order.orderId)}
              key={order.orderId}
            >
              <Poster kind={event?.artwork} small />
              <div>
                <span className="eyebrow">{date(order.createdAt)}</span>
                <h3>{event?.title || 'Compra de ingressos'}</h3>
                <small>
                  {order.items.reduce((n, i) => n + i.seatIds.length, 0)} ingresso(s) ·{' '}
                  {order.username}
                </small>
              </div>
              <div className="order-card-status">
                <Badge status={order.status} />
                <strong>{money(order.amountCents)}</strong>
              </div>
              <ChevronRight size={20} />
            </button>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty title="Seu próximo encontro ainda está por vir">
          Explore os eventos e escolha um lugar para você.
        </Empty>
      )}
    </>
  );
}

export default Tickets;
