import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, Minus, ShieldCheck, Ticket } from 'lucide-react';
import { api, customer, newContext, setCustomer } from './api.js';
import { Badge, Countdown, date, Dialog, ErrorNotice, Loading, money, Steps, time } from './ui.jsx';

export default function Checkout({ initialEvent, events, onClose, onComplete }) {
  const [eventId, setEventId] = useState(initialEvent.eventId),
    [sessionId, setSessionId] = useState(initialEvent.sessions[0]?.sessionId || '');
  const [seats, setSeats] = useState(null),
    [cart, setCart] = useState([]),
    [username, setUsername] = useState(customer);
  const [stage, setStage] = useState('select'),
    [admission, setAdmission] = useState(null),
    [reservation, setReservation] = useState(null);
  const [order, setOrder] = useState(null),
    [timeline, setTimeline] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [expired, setExpired] = useState(false);
  const [reload, setReload] = useState(0);
  const reserveContext = useRef(newContext()),
    orderContext = useRef(newContext()),
    submitted = useRef(false);
  const event = events.find((e) => e.eventId === eventId) || initialEvent;
  const items = useMemo(
    () =>
      Object.entries(Object.groupBy(cart, (s) => s.sessionId)).map(([sessionId, selected]) => ({
        sessionId,
        seatIds: selected.map((s) => s.seatId),
      })),
    [cart],
  );
  const total = cart.reduce((sum, seat) => sum + seat.priceCents, 0);
  const markExpired = useCallback(() => setExpired(true), []);
  useEffect(() => {
    let active = true;
    setSeats(null);
    setError(null);
    api('GET', `/sessions/${sessionId}/seats`)
      .then((data) => {
        if (active) setSeats(data.seats);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [sessionId, reload]);
  useEffect(() => {
    if (stage !== 'waiting' || !admission) return;
    let stopped = false,
      timer;
    async function poll() {
      try {
        const result = await api('GET', `/admissions/${admission.admissionTokenId}`);
        if (stopped) return;
        setAdmission(result);
        if (result.status === 'ADMITTED') {
          await hold(result.token);
          return;
        }
        if (result.status === 'EXPIRED') {
          setStage('select');
          setError(new Error('Sua admissão expirou. Entre na fila novamente.'));
          return;
        }
      } catch (e) {
        if (!stopped) setError(e);
      }
      if (!stopped) timer = setTimeout(poll, 1200);
    }
    timer = setTimeout(poll, 1200);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [stage, admission?.admissionTokenId]);
  useEffect(() => {
    if (
      !order ||
      ['CONFIRMED', 'CANCELLED', 'FAILED'].includes(order.status) ||
      order.sagaStatus === 'MANUAL_INTERVENTION'
    )
      return;
    let stopped = false,
      timer;
    const poll = async () => {
      try {
        const [current, history] = await Promise.all([
          api('GET', `/orders/${order.orderId}`),
          api('GET', `/orders/${order.orderId}/timeline`),
        ]);
        if (stopped) return;
        setError(null);
        setOrder(current);
        setTimeline(history.items);
        if (
          ['CONFIRMED', 'CANCELLED', 'FAILED'].includes(current.status) ||
          current.sagaStatus === 'MANUAL_INTERVENTION'
        ) {
          onComplete();
          return;
        }
      } catch (e) {
        if (!stopped) setError(e);
      }
      if (!stopped) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [order?.orderId, order?.status, order?.sagaStatus]);
  function toggle(seat) {
    setError(null);
    if (cart.some((s) => s.seatId === seat.seatId && s.sessionId === sessionId))
      setCart(cart.filter((s) => !(s.seatId === seat.seatId && s.sessionId === sessionId)));
    else if (cart.length < 2) setCart([...cart, { ...seat, sessionId, eventTitle: event.title }]);
    else
      setError(new Error('Você pode escolher até 2 ingressos, inclusive de sessões diferentes.'));
    reserveContext.current = newContext();
  }
  async function hold(token) {
    setBusy(true);
    try {
      reserveContext.current.admissionToken = token;
      orderContext.current.admissionToken = token;
      const result = await api(
        'POST',
        '/reservations',
        { username: username.trim(), items, expiresInSeconds: 600 },
        reserveContext.current,
      );
      setReservation(result);
      setStage('held');
      setError(null);
    } catch (e) {
      setError(e);
      setStage('select');
    } finally {
      setBusy(false);
    }
  }
  async function enter() {
    if (busy || !cart.length) return;
    setBusy(true);
    setError(null);
    try {
      const first = cart[0],
        chosenEvent = events.find((e) => e.sessions.some((s) => s.sessionId === first.sessionId));
      const result = await api('POST', '/admissions', {
        eventId: chosenEvent.eventId,
        sessionId: first.sessionId,
      });
      setAdmission(result);
      if (result.status === 'ADMITTED') await hold(result.token);
      else setStage('waiting');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (busy || expired || submitted.current) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api(
        'POST',
        '/orders',
        {
          reservationId: reservation.reservationId,
          username: reservation.username,
          items: reservation.items,
          paymentMethod: 'SIMULATED',
        },
        orderContext.current,
      );
      submitted.current = true;
      setCustomer(reservation.username);
      setOrder(result);
      setStage('order');
      onComplete();
    } catch (e) {
      setError(e);
      if (e.status === 410) setExpired(true);
    } finally {
      setBusy(false);
    }
  }
  const confirmed = order?.status === 'CONFIRMED';
  return (
    <Dialog
      title={
        stage === 'order'
          ? confirmed
            ? 'Você tem um encontro marcado.'
            : 'Acompanhe sua compra'
          : 'Escolha o seu lugar'
      }
      onClose={onClose}
      wide
    >
      <Steps step={stage === 'order' ? 2 : stage === 'held' ? 1 : 0} />
      <ErrorNotice
        error={error}
        retry={stage === 'select' && !seats ? () => setReload((v) => v + 1) : undefined}
      />
      {stage === 'select' && (
        <div className="checkout-grid">
          <div>
            <div className="form-row">
              <label>
                Evento
                <select
                  value={eventId}
                  onChange={(e) => {
                    const next = events.find((v) => v.eventId === e.target.value);
                    setEventId(next.eventId);
                    setSessionId(next.sessions[0].sessionId);
                  }}
                >
                  {events.map((item) => (
                    <option key={item.eventId} value={item.eventId}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sessão
                <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                  {event.sessions.map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {date(session.startsAt)} · {time(session.startsAt)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="seat-map">
              <div className="stage">PALCO</div>
              {!seats ? (
                <Loading />
              ) : (
                <div className="seat-grid">
                  {['A', 'B', 'C', 'D', 'E', 'F'].map((row) => (
                    <div className="seat-row" key={row}>
                      <span>{row}</span>
                      {seats
                        .filter((s) => s.row === row)
                        .map((seat) => {
                          const selected = cart.some(
                            (s) => s.seatId === seat.seatId && s.sessionId === sessionId,
                          );
                          return (
                            <button
                              key={seat.seatId}
                              className={`seat ${seat.status.toLowerCase()} ${selected ? 'selected' : ''}`}
                              disabled={seat.status !== 'AVAILABLE'}
                              aria-label={`Assento ${seat.row}${seat.number}, ${seat.status === 'AVAILABLE' ? 'disponível' : 'indisponível'}`}
                              aria-pressed={selected}
                              onClick={() => toggle(seat)}
                            >
                              {selected ? <Check size={13} /> : seat.number}
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
              )}
              <div className="seat-legend">
                <span>
                  <i />
                  Disponível
                </span>
                <span>
                  <i className="selected" />
                  Sua escolha
                </span>
                <span>
                  <i className="sold" />
                  Indisponível
                </span>
              </div>
            </div>
            <p className="muted small-text">
              A disponibilidade é confirmada ao reservar. Até 2 ingressos por compra.
            </p>
          </div>
          <aside className="purchase-summary">
            <span className="eyebrow">SUA ESCOLHA</span>
            <h3>Um lugar para você.</h3>
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
                    onClick={() => {
                      setCart(cart.filter((s) => s.seatId !== seat.seatId));
                      reserveContext.current = newContext();
                    }}
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
                onChange={(e) => {
                  setUsername(e.target.value);
                  reserveContext.current = newContext();
                }}
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
              onClick={enter}
            >
              {busy ? 'Reservando…' : 'Reservar meus lugares'}
            </button>
            <small className="secure">
              <ShieldCheck size={15} /> Reserva por até 10 minutos
            </small>
          </aside>
        </div>
      )}
      {stage === 'waiting' && (
        <div className="flow-state">
          <div className="round-illustration yellow">
            <Clock3 size={44} />
          </div>
          <span className="eyebrow">FALTA POUCO</span>
          <h3>Seu encontro começa na fila.</h3>
          <p>Estamos organizando a entrada para que todos possam escolher com tranquilidade.</p>
          <div className="queue-position">
            <strong>{admission?.position || '—'}</strong>
            <span>sua posição na fila</span>
          </div>
          <p className="muted">
            Estimativa: {admission?.estimatedWaitSeconds || 0} segundos · Atualização automática
          </p>
        </div>
      )}
      {stage === 'held' && (
        <div className="checkout-grid">
          <div className="flow-state compact">
            <div className="round-illustration green">
              <Ticket size={40} />
            </div>
            <h3>{expired ? 'O tempo da reserva terminou.' : 'Seus lugares estão reservados.'}</h3>
            <p>
              {expired
                ? 'Escolha seus assentos novamente para continuar.'
                : 'Conclua o pagamento simulado dentro do prazo. Nenhum valor real será cobrado.'}
            </p>
            <Countdown expiresAt={reservation.expiresAt} onExpire={markExpired} />
            <span className="muted small-text">tempo restante da reserva</span>
          </div>
          <aside className="purchase-summary">
            <span className="eyebrow">RESUMO DA COMPRA</span>
            {cart.map((seat) => (
              <div className="cart-item" key={seat.seatId}>
                <div>
                  <strong>{seat.eventTitle}</strong>
                  <small>
                    Plateia · {seat.row}
                    {seat.number}
                  </small>
                </div>
                <span>{money(seat.priceCents)}</span>
              </div>
            ))}
            <p>
              Em nome de <strong>{reservation.username}</strong>
            </p>
            <div className="payment-option">
              <Check size={18} /> Pagamento simulado
            </div>
            <div className="total">
              <span>Total</span>
              <strong>{money(reservation.amountCents)}</strong>
            </div>
            {expired ? (
              <button
                className="button primary full"
                onClick={() => {
                  setStage('select');
                  setExpired(false);
                  setCart([]);
                  setReload((v) => v + 1);
                  reserveContext.current = newContext();
                }}
              >
                Escolher novamente
              </button>
            ) : (
              <button className="button primary full" disabled={busy} onClick={pay}>
                {busy ? 'Enviando…' : 'Confirmar e pagar'}
              </button>
            )}
            <small className="secure">
              <ShieldCheck size={15} /> Confirmação acompanhada em tempo real
            </small>
          </aside>
        </div>
      )}
      {stage === 'order' && order && (
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
      )}
    </Dialog>
  );
}
