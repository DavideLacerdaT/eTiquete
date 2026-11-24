import React from 'react';
import { MapPin } from 'lucide-react';
import { date, Empty, money, Poster, time } from '../ui.jsx';

function Events({ events, category, onCategoryChange, onSelect }) {
  return (
    <>
      <div className="page-intro">
        <h1>Eventos</h1>

        <p>Escolha um evento para ver sessões e lugares.</p>
      </div>

      <div className="filter-bar">
        <div className="filter-chips" aria-label="Categorias">
          {['Todos', 'Música', 'Teatro', 'Festival', 'Conferência'].map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'active' : ''}`}
              aria-pressed={category === c}
              onClick={() => onCategoryChange(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <span className="muted small-text">{events.length} eventos</span>
      </div>

      <div className="event-cards">
        {events.map((event) => (
          <article className="event-card" key={event.eventId}>
            <button
              className="poster-button"
              onClick={() => onSelect(event)}
              aria-label={`Ver ${event.title}`}
            >
              <Poster kind={event.artwork} />

              <span className="poster-category">{event.category}</span>
            </button>

            <div className="event-card-body">
              <span className="eyebrow">
                {event.sessions[0]
                  ? `${date(event.sessions[0].startsAt)} · ${time(event.sessions[0].startsAt)}`
                  : 'Novas sessões em breve'}
              </span>

              <h2>{event.title}</h2>

              <p>{event.subtitle}</p>

              <small>
                <MapPin size={14} />

                {event.venue?.name}
              </small>

              <div className="event-card-footer">
                <div>
                  <small>A partir de</small>

                  <strong>{money(event.priceFromCents)}</strong>
                </div>

                <button className="button primary" onClick={() => onSelect(event)}>
                  Ver evento
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!events.length && (
        <Empty title="Nenhum encontro encontrado">
          Tente outro nome ou uma categoria diferente.
        </Empty>
      )}
    </>
  );
}

export default Events;
