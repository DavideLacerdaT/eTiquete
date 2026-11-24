import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge, date, Empty, money, Poster } from '../ui.jsx';
import { ticketFilters, ticketMatchesFilter } from '../routes/ticket-filters.js';

function Tickets({ orders, events, onSelect, filter = 'all', onFilterChange }) {
  const filtered = orders.filter((order) => ticketMatchesFilter(order, filter));

  return (
    <>
      <div className="page-intro">
        <h1>Meus ingressos</h1>

        <p>Consulte suas compras e acompanhe os pedidos.</p>
      </div>

      <div className="filter-chips" aria-label="Situação dos ingressos">
        {ticketFilters.map(({ value, label }) => (
          <button
            className={`chip ${filter === value ? 'active' : ''}`}
            key={value}
            onClick={() => onFilterChange(value)}
            aria-pressed={filter === value}
          >
            {label}
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
        <Empty title={filter === 'all' ? 'Nenhum ingresso ainda' : 'Nenhum pedido nesta situação'}>
          {filter === 'all'
            ? 'Explore os eventos para comprar ingressos.'
            : 'Escolha outro filtro para ver seus pedidos.'}
        </Empty>
      )}
    </>
  );
}

export default Tickets;
