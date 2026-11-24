import React, { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { orders, payments, newContext } from '../api.js';
import { Badge, date, Dialog, ErrorNotice, Loading, money, time } from '../ui.jsx';

function OrderDetails({ orderId, onClose, events = [], eventError, retryEvents }) {
  const [order, setOrder] = useState(null);

  const [history, setHistory] = useState([]);

  const [payment, setPayment] = useState(null);

  const [error, setError] = useState(null);

  const [busy, setBusy] = useState(false);

  const [confirmCancel, setConfirmCancel] = useState(false);

  const [cancelContext] = useState(newContext);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let stopped = false;

    const controller = new AbortController();

    let timer;

    async function load() {
      try {
        const [current, timeline] = await Promise.all([
          orders.get(orderId, { context: cancelContext, signal: controller.signal }),
          orders.timeline(orderId, { context: cancelContext, signal: controller.signal }),
        ]);

        if (stopped) {
          return;
        }

        setOrder(current);

        setHistory(timeline.items);

        setError(null);

        if (current.paymentId) {
          const p = await payments.get(current.paymentId, {
            context: cancelContext,
            signal: controller.signal,
          });

          if (!stopped) {
            setPayment(p);
          }
        }

        if (
          !stopped &&
          !['CONFIRMED', 'CANCELLED', 'FAILED'].includes(current.status) &&
          current.sagaStatus !== 'MANUAL_INTERVENTION'
        ) {
          timer = setTimeout(load, 1200);
        }
      } catch (e) {
        if (!stopped) {
          setError(e);
        }
      }
    }

    load();

    return () => {
      stopped = true;

      controller.abort();

      clearTimeout(timer);
    };
  }, [orderId, reload]);

  async function cancel() {
    if (busy) {
      return;
    }

    setBusy(true);

    setError(null);

    try {
      await orders.cancel(orderId, { context: cancelContext });

      setConfirmCancel(false);

      setReload((v) => v + 1);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Detalhes do seu ingresso" onClose={onClose}>
      <ErrorNotice error={eventError} retry={retryEvents} />

      <ErrorNotice error={error} retry={() => setReload((v) => v + 1)} />

      {!order ? (
        !error && <Loading />
      ) : (
        <>
          <div className="detail-heading">
            <Badge status={order.status} />

            <strong>{money(order.amountCents)}</strong>
          </div>

          {order.items.map((item, i) => (
            <div className="detail-event" key={i}>
              <Ticket />

              <div>
                <h3>
                  {events.find((e) => e.sessions.some((s) => s.sessionId === item.sessionId))
                    ?.title || 'Evento'}
                </h3>

                <p>
                  {item.seatIds.length} ingresso(s) · {order.username}
                </p>
              </div>
            </div>
          ))}

          <small className="order-reference">Pedido {order.orderId}</small>

          <ol className="timeline">
            {history.map((item, i) => (
              <li key={i}>
                <span className="timeline-dot" />

                <div>
                  <strong>{item.label}</strong>

                  <small>
                    {date(item.occurredAt)} · {time(item.occurredAt)}
                  </small>
                </div>
              </li>
            ))}
          </ol>

          {payment && (
            <div className="payment-summary">
              <span>Pagamento simulado</span>

              <Badge status={payment.status} />
            </div>
          )}

          {order.sagaStatus === 'MANUAL_INTERVENTION' && (
            <p className="notice">
              A compra está registrada e precisa de revisão da equipe. O estado será atualizado após
              o reprocessamento.
            </p>
          )}

          {order.status === 'CONFIRMED' &&
            (confirmCancel ? (
              <div className="cancel-confirm">
                <h3>Cancelar este encontro?</h3>

                <p>O cancelamento será concluído após a confirmação do estorno.</p>

                <div className="actions">
                  <button className="button secondary" onClick={() => setConfirmCancel(false)}>
                    Manter ingresso
                  </button>

                  <button className="button primary" disabled={busy} onClick={cancel}>
                    {busy ? 'Solicitando…' : 'Confirmar cancelamento'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="button secondary full" onClick={() => setConfirmCancel(true)}>
                Solicitar cancelamento
              </button>
            ))}
        </>
      )}
    </Dialog>
  );
}

export default OrderDetails;
