import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { date, Empty, money, Poster, time } from '../ui.jsx';

function Events({ events, search, onSelect }) {
  const [category, setCategory] = useState('Todos');
  const filtered = events.filter(
    (e) =>
      (category === 'Todos' || e.category === category) &&
      `${e.title} ${e.category} ${e.venue?.name}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">SAIA DA ROTINA</span>
        <h1>Encontre seu próximo momento.</h1>
        <p>Música, teatro e ideias que merecem a sua presença.</p>
      </div>
      <div className="filter-bar">
        <div className="filter-chips" aria-label="Categorias">
          {['Todos', 'Música', 'Teatro', 'Festival', 'Conferência'].map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'active' : ''}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="muted small-text">{filtered.length} eventos</span>
      </div>
      <div className="event-cards">
        {filtered.map((event) => (
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
                {date(event.sessions[0].startsAt)} · {time(event.sessions[0].startsAt)}
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
                  Escolher lugares
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <Empty title="Nenhum encontro encontrado">
          Tente outro nome ou uma categoria diferente.
        </Empty>
      )}
    </>
  );
}

export default Events;
