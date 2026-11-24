import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  admissions,
  catalog,
  customer,
  newContext,
  orders,
  reservations,
  setCustomer,
} from '../api.js';

// Estado e chamadas da compra ficam aqui; os componentes de etapa apenas apresentam dados.
export function useCheckout({ initialEvent, events, onComplete }) {
  const [eventId, setEventId] = useState(initialEvent.eventId);

  const [sessionId, setSessionId] = useState(initialEvent.sessions[0]?.sessionId || '');

  const [seats, setSeats] = useState(null);

  const [cart, setCart] = useState([]);

  const [username, setUsername] = useState(customer);

  const [stage, setStage] = useState('select');

  const [admission, setAdmission] = useState(null);

  const [reservation, setReservation] = useState(null);

  const [order, setOrder] = useState(null);

  const [timeline, setTimeline] = useState([]);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState(null);

  const [expired, setExpired] = useState(false);

  const [reload, setReload] = useState(0);

  const [purchaseContext] = useState(newContext);

  const reserveContext = useRef(newContext(purchaseContext.correlationId));

  const orderContext = useRef(newContext(purchaseContext.correlationId));

  const submitted = useRef(false);

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

  // Carrega apenas o mapa da sessão atual; a seleção de outras sessões permanece no carrinho.
  useEffect(() => {
    let active = true;

    const controller = new AbortController();

    setSeats(null);

    setError(null);

    catalog
      .seats(sessionId, { context: purchaseContext, signal: controller.signal })
      .then((data) => {
        if (active) {
          setSeats(data.seats);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e);
        }
      });

    return () => {
      active = false;

      controller.abort();
    };
  }, [sessionId, reload]);

  // O polling da fila termina quando a admissão permite criar a reserva.
  useEffect(() => {
    if (stage !== 'waiting' || !admission) {
      return;
    }

    let stopped = false;

    let timer;

    const controller = new AbortController();

    async function poll() {
      try {
        const result = await admissions.get(admission.admissionTokenId, {
          context: purchaseContext,
          signal: controller.signal,
        });

        if (stopped) {
          return;
        }

        setAdmission(result);

        if (result.status === 'ADMITTED') {
          await holdSeats(result.token);

          return;
        }

        if (result.status === 'EXPIRED') {
          setStage('select');

          setError(new Error('Sua admissão expirou. Entre na fila novamente.'));

          return;
        }
      } catch (e) {
        if (!stopped) {
          setError(e);
        }
      }

      if (!stopped) {
        timer = setTimeout(poll, 1200);
      }
    }

    timer = setTimeout(poll, 1200);

    return () => {
      stopped = true;

      clearTimeout(timer);

      controller.abort();
    };
  }, [stage, admission?.admissionTokenId]);

  // Acompanhar o pedido não cria uma nova compra; as chaves de envio ficam nos refs acima.
  useEffect(() => {
    if (
      !order ||
      ['CONFIRMED', 'CANCELLED', 'FAILED'].includes(order.status) ||
      order.sagaStatus === 'MANUAL_INTERVENTION'
    ) {
      return;
    }

    let stopped = false;

    let timer;

    const controller = new AbortController();

    const poll = async () => {
      try {
        const [current, history] = await Promise.all([
          orders.get(order.orderId, { context: purchaseContext, signal: controller.signal }),
          orders.timeline(order.orderId, { context: purchaseContext, signal: controller.signal }),
        ]);

        if (stopped) {
          return;
        }

        setError(null);

        setOrder(current);

        setTimeline(history.items);

        if (
          ['CONFIRMED', 'CANCELLED', 'FAILED'].includes(current.status) ||
          current.sagaStatus === 'MANUAL_INTERVENTION'
        ) {
          onComplete(current.orderId);

          return;
        }
      } catch (e) {
        if (!stopped) {
          setError(e);
        }
      }

      if (!stopped) {
        timer = setTimeout(poll, 1000);
      }
    };

    timer = setTimeout(poll, 500);

    return () => {
      stopped = true;

      clearTimeout(timer);

      controller.abort();
    };
  }, [order?.orderId, order?.status, order?.sagaStatus]);

  function toggleSeat(seat) {
    setError(null);

    if (cart.some((s) => s.seatId === seat.seatId && s.sessionId === sessionId)) {
      setCart(cart.filter((s) => !(s.seatId === seat.seatId && s.sessionId === sessionId)));
    } else if (cart.length < 2) {
      setCart([...cart, { ...seat, sessionId, eventTitle: event.title }]);
    } else {
      setError(new Error('Você pode escolher até 2 ingressos, inclusive de sessões diferentes.'));
    }

    reserveContext.current = newContext(purchaseContext.correlationId);
  }

  async function holdSeats(token) {
    setBusy(true);

    try {
      reserveContext.current.admissionToken = token;

      orderContext.current.admissionToken = token;

      const result = await reservations.create(
        { username: username.trim(), items, expiresInSeconds: 600 },
        { context: reserveContext.current },
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

  async function beginAdmission() {
    if (busy || !cart.length) {
      return;
    }

    setBusy(true);

    setError(null);

    try {
      const first = cart[0];

      const chosenEvent = events.find((e) =>
        e.sessions.some((s) => s.sessionId === first.sessionId),
      );

      const result = await admissions.create(
        { eventId: chosenEvent.eventId, sessionId: first.sessionId },
        { context: purchaseContext },
      );

      setAdmission(result);

      if (result.status === 'ADMITTED') {
        await holdSeats(result.token);
      } else {
        setStage('waiting');
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder() {
    if (busy || expired || submitted.current) {
      return;
    }

    setBusy(true);

    setError(null);

    try {
      const result = await orders.create(
        {
          reservationId: reservation.reservationId,
          username: reservation.username,
          items: reservation.items,
          paymentMethod: 'SIMULATED',
        },
        { context: orderContext.current },
      );

      submitted.current = true;

      setCustomer(reservation.username);

      setOrder(result);

      setStage('order');

      onComplete(result.orderId);
    } catch (e) {
      setError(e);

      if (e.status === 410) {
        setExpired(true);
      }
    } finally {
      setBusy(false);
    }
  }

  function selectEvent(nextEventId) {
    const nextEvent = events.find((item) => item.eventId === nextEventId);

    setEventId(nextEvent.eventId);
    setSessionId(nextEvent.sessions[0]?.sessionId || '');
  }

  function removeSeat(seatId) {
    setCart(cart.filter((seat) => seat.seatId !== seatId));
    reserveContext.current = newContext(purchaseContext.correlationId);
  }

  function updateUsername(value) {
    setUsername(value);
    reserveContext.current = newContext(purchaseContext.correlationId);
  }

  function reloadSeats() {
    setReload((value) => value + 1);
  }

  function restartSelection() {
    setStage('select');
    setExpired(false);
    setCart([]);
    reloadSeats();
    reserveContext.current = newContext(purchaseContext.correlationId);
    orderContext.current = newContext(purchaseContext.correlationId);
    submitted.current = false;
  }

  return {
    eventId,
    sessionId,
    event,
    seats,
    cart,
    username,
    total,
    stage,
    admission,
    reservation,
    order,
    timeline,
    busy,
    error,
    expired,
    selectEvent,
    selectSession: setSessionId,
    toggleSeat,
    removeSeat,
    updateUsername,
    beginAdmission,
    submitOrder,
    markExpired,
    reloadSeats,
    restartSelection,
  };
}
