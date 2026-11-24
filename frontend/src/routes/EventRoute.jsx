import React, { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import ResourceState from '../components/ResourceState.jsx';
import { useResource } from '../hooks/useResource.js';
import { loadEvent } from '../services/catalog-view.js';
import { date, Empty, money, Poster, time } from '../ui.jsx';
import { paths } from './paths.js';

export default function EventRoute() {
  const { eventId } = useParams();
  const loader = useCallback((options) => loadEvent(eventId, options), [eventId]);
  const resource = useResource(loader);

  return (
    <ResourceState resource={resource}>
      {(event) => (
        <>
          <Link className="text-button" to={paths.events}>
            Voltar aos eventos
          </Link>

          <div className="page-intro">
            <span className="eyebrow">{event.category}</span>
            <h1>{event.title}</h1>
            <p>{event.subtitle || event.description}</p>
          </div>

          <section className="event-details">
            <Poster kind={event.artwork} />

            <div>
              <h2>{event.venue?.name || 'Local a confirmar'}</h2>
              <p>{event.description}</p>
              <p>
                A partir de <strong>{money(event.priceFromCents)}</strong>
              </p>

              <h3>Sessões disponíveis</h3>

              {event.sessions.length ? (
                <>
                  <ul className="session-list">
                    {event.sessions.map((session) => (
                      <li key={session.sessionId}>
                        {date(session.startsAt)} · {time(session.startsAt)}
                      </li>
                    ))}
                  </ul>

                  <Link className="button primary" to={paths.checkout(event.eventId)}>
                    Escolher lugares
                  </Link>
                </>
              ) : (
                <Empty title="Nenhuma sessão disponível">Volte em breve para novas datas.</Empty>
              )}
            </div>
          </section>
        </>
      )}
    </ResourceState>
  );
}
