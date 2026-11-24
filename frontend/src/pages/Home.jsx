import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  MapPin,
  Music2,
  Ticket,
} from 'lucide-react';
import { customer } from '../api.js';
import { date, Empty, money, Poster, time } from '../ui.jsx';
import { paths } from '../routes/paths.js';

function EventRow({ event, onSelect }) {
  return (
    <button className="event-row" onClick={() => onSelect(event)}>
      <Poster kind={event.artwork} small />

      <div className="event-row-info">
        <strong>{event.title}</strong>

        <small>
          {event.category} · {event.venue?.name}
        </small>
      </div>

      <span className="event-date">
        {event.sessions[0] ? date(event.sessions[0].startsAt) : 'Em breve'}
      </span>

      <span className="row-price">{money(event.priceFromCents)}</span>

      <ChevronRight size={17} />
    </button>
  );
}

function Calendar({ events, onSelect }) {
  const [month, setMonth] = useState(new Date(2026, 10, 1));

  const [selectedDay, setSelectedDay] = useState(20);

  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const agenda = events
    .flatMap((event) => event.sessions.map((session) => ({ event, session })))
    .filter(({ session }) => {
      const local = new Date(new Date(session.startsAt).getTime() - 3 * 3600000);

      return (
        local.getUTCMonth() === month.getMonth() &&
        local.getUTCFullYear() === month.getFullYear() &&
        local.getUTCDate() === selectedDay
      );
    });

  const hasEvent = (day) =>
    events.some((e) =>
      e.sessions.some(
        (s) =>
          date(s.startsAt, { month: 'numeric', year: 'numeric', day: 'numeric' }) ===
          `${day}/${month.getMonth() + 1}/${month.getFullYear()}`,
      ),
    );

  return (
    <>
      <section className="calendar">
        <div className="calendar-header">
          <button
            className="icon-button"
            aria-label="Mês anterior"
            onClick={() => {
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));

              setSelectedDay(1);
            }}
          >
            <ChevronLeft size={18} />
          </button>

          <span>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>

          <button
            className="icon-button"
            aria-label="Próximo mês"
            onClick={() => {
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

              setSelectedDay(1);
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-grid">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <span key={`weekday-${i}`} className="weekday">
              {d}
            </span>
          ))}

          {Array.from({ length: first }, (_, i) => (
            <span key={`empty-${i}`} />
          ))}

          {Array.from({ length: days }, (_, i) => (
            <button
              key={i}
              className={`${selectedDay === i + 1 ? 'selected' : ''} ${hasEvent(i + 1) ? 'has-event' : ''}`}
              aria-label={`${i + 1} de ${month.toLocaleDateString('pt-BR', { month: 'long' })}`}
              aria-pressed={selectedDay === i + 1}
              onClick={() => setSelectedDay(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </section>

      <div className="agenda">
        <div className="section-heading">
          <h3>Agenda</h3>

          <CalendarDays size={18} />
        </div>

        <span className="muted small-text">
          {selectedDay} de {month.toLocaleDateString('pt-BR', { month: 'long' })}
        </span>

        {agenda.length ? (
          agenda.map(({ event, session }) => (
            <button className="agenda-item" key={session.sessionId} onClick={() => onSelect(event)}>
              <span className="agenda-time">{time(session.startsAt)}</span>

              <span className={`agenda-icon ${event.color}`}>
                <Music2 size={20} />
              </span>

              <span className="agenda-details">
                <strong>{event.title}</strong>

                <small>{event.venue?.name}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="agenda-empty">Nenhum evento nesta data.</p>
        )}
      </div>
    </>
  );
}

function Home({ events, orders, onSelect, navigate }) {
  const upcoming = orders.filter((o) => o.status === 'CONFIRMED');

  const featured = events[0];

  return (
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <div className="page-intro">
          <h1>
            Olá, {customer}
            <span className="greeting-spark" aria-hidden="true">
              ✳
            </span>
          </h1>

          <p>Seus ingressos e eventos em um só lugar.</p>
        </div>

        <div className="stats-grid">
          <Link className="stat-card yellow" to={`${paths.tickets}?status=confirmed`}>
            <span>
              Ingressos confirmados <Ticket size={20} />
            </span>

            <strong>
              {String(
                upcoming.reduce(
                  (sum, o) => sum + o.items.reduce((n, i) => n + i.seatIds.length, 0),
                  0,
                ),
              ).padStart(2, '0')}
            </strong>

            <small>
              Ver ingressos <ChevronRight size={14} aria-hidden="true" />
            </small>

            <div className="ticket-art" aria-hidden="true">
              <Ticket />
            </div>
          </Link>

          <Link className="stat-card green" to={paths.events}>
            <span>
              Eventos <Compass size={20} />
            </span>

            <strong>{String(events.length).padStart(2, '0')}</strong>

            <small>
              Explorar eventos <ChevronRight size={14} aria-hidden="true" />
            </small>

            <span className="stat-star" aria-hidden="true">
              ✳
            </span>
          </Link>

          <Link className="stat-card blue" to={paths.tickets}>
            <span>
              Pedidos <Heart size={20} />
            </span>

            <strong>{String(orders.length).padStart(2, '0')}</strong>

            <small>
              Ver histórico <ChevronRight size={14} aria-hidden="true" />
            </small>

            <div className="mini-bars" aria-hidden="true">
              {[22, 40, 29, 52, 35, 65, 46].map((h, i) => (
                <i style={{ height: h }} key={i} />
              ))}
            </div>
          </Link>
        </div>

        {featured && (
          <section className="feature-card pink">
            <div className="feature-copy">
              <span className="pill">EM DESTAQUE</span>

              <h2>{featured.title}</h2>

              <p>
                <MapPin size={15} />
                {featured.venue?.name}
              </p>

              <div className="feature-bottom">
                <button className="button primary" onClick={() => onSelect(featured)}>
                  Ver evento <Ticket size={16} />
                </button>

                <span>
                  A partir de <strong>{money(featured.priceFromCents)}</strong>
                </span>
              </div>
            </div>

            <Poster kind="jazz" />
          </section>
        )}

        <section>
          <div className="section-heading">
            <div>
              <h2>Eventos disponíveis</h2>
            </div>

            <button className="text-button" onClick={() => navigate('events')}>
              Ver todos <ChevronRight size={16} />
            </button>
          </div>

          <div className="event-list">
            {events.length ? (
              events.map((event) => (
                <EventRow key={event.eventId} event={event} onSelect={onSelect} />
              ))
            ) : (
              <Empty title="Nenhum evento disponível">Novas datas serão publicadas aqui.</Empty>
            )}
          </div>
        </section>
      </div>

      <aside className="dashboard-aside">
        <Calendar events={events} onSelect={onSelect} />

        <div className="next-ticket">
          <div className="section-heading">
            <h3>Ingresso confirmado</h3>

            <Ticket size={18} />
          </div>

          {upcoming[0] ? (
            <>
              <div className="ticket-top">
                <span className="badge green">Confirmado</span>

                <span className="ticket-stamp">eT.</span>
              </div>

              <h3>
                {events.find((e) =>
                  e.sessions.some((s) => s.sessionId === upcoming[0].items[0].sessionId),
                )?.title || 'Evento confirmado'}
              </h3>

              <div className="ticket-perforation" />

              <div className="barcode" aria-hidden="true" />

              <Link className="button primary full" to={paths.order(upcoming[0].orderId)}>
                Ver meu ingresso
              </Link>
            </>
          ) : (
            <p>Nenhum ingresso confirmado.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

export default Home;
