import React from 'react';
import { Check, ShieldCheck, Ticket } from 'lucide-react';
import { Countdown, money } from '../../ui.jsx';

export default function ReservationSummary({
  reservation,
  cart,
  expired,
  busy,
  onExpire,
  onRestart,
  onPay,
}) {
  return (
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

        <Countdown expiresAt={reservation.expiresAt} onExpire={onExpire} />

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
          <button className="button primary full" onClick={onRestart}>
            Escolher novamente
          </button>
        ) : (
          <button className="button primary full" disabled={busy} onClick={onPay}>
            {busy ? 'Enviando…' : 'Confirmar e pagar'}
          </button>
        )}

        <small className="secure">
          <ShieldCheck size={15} /> Confirmação acompanhada em tempo real
        </small>
      </aside>
    </div>
  );
}
