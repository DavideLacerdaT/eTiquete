import React from 'react';
import { Minus, ShieldCheck } from 'lucide-react';
import { date, money, time } from '../../ui.jsx';
import SeatMap from './SeatMap.jsx';

export default function SeatSelection({
  events,
  eventId,
  event,
  sessionId,
  seats,
  cart,
  username,
  total,
  busy,
  onSelectEvent,
  onSessionChange,
  onToggleSeat,
  onRemoveSeat,
  onUsernameChange,
  onReserve,
}) {
  return (
    <div className="checkout-grid">
      <div>
        <div className="form-row">
          <label>
            Evento
            <select value={eventId} onChange={(event) => onSelectEvent(event.target.value)}>
              {events.map((item) => (
                <option key={item.eventId} value={item.eventId}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sessão
            <select value={sessionId} onChange={(e) => onSessionChange(e.target.value)}>
              {event.sessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId}>
                  {date(session.startsAt)} · {time(session.startsAt)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <SeatMap seats={seats} cart={cart} sessionId={sessionId} onToggleSeat={onToggleSeat} />

        <p className="muted small-text">
          A disponibilidade é confirmada ao reservar. Até 2 ingressos por compra.
        </p>
      </div>

      <aside className="purchase-summary">
        <h3>Resumo da compra</h3>

        {!cart.length ? (
          <p className="muted">Escolha seus assentos no mapa para continuar.</p>
        ) : (
          cart.map((seat) => (
            <div className="cart-item" key={seat.seatId}>
              <div>
                <strong>{seat.eventTitle}</strong>

                <small>
                  Plateia · {seat.row}
                  {seat.number}
                </small>
              </div>

              <button
                className="icon-button"
                aria-label={`Remover ${seat.row}${seat.number}`}
                onClick={() => onRemoveSeat(seat.seatId)}
              >
                <Minus size={16} />
              </button>
            </div>
          ))
        )}

        <label>
          Nome de usuário
          <input
            value={username}
            minLength={2}
            maxLength={80}
            onChange={(event) => onUsernameChange(event.target.value)}
            autoComplete="username"
            placeholder="Como podemos chamar você?"
          />
        </label>

        <div className="total">
          <span>Total</span>

          <strong>{money(total)}</strong>
        </div>

        <button
          className="button primary full"
          disabled={!cart.length || username.trim().length < 2 || busy}
          onClick={onReserve}
        >
          {busy ? 'Reservando…' : 'Reservar meus lugares'}
        </button>

        <small className="secure">
          <ShieldCheck size={15} /> Reserva por até 10 minutos
        </small>
      </aside>
    </div>
  );
}
