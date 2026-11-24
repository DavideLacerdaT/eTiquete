import React from 'react';

import { Dialog, ErrorNotice, Steps } from './ui.jsx';
import { useCheckout } from './hooks/useCheckout.js';
import OrderResult from './components/checkout/OrderResult.jsx';
import ReservationSummary from './components/checkout/ReservationSummary.jsx';
import SeatSelection from './components/checkout/SeatSelection.jsx';
import WaitingRoom from './components/checkout/WaitingRoom.jsx';

const STEP_INDEX = { select: 0, waiting: 0, held: 1, order: 2 };

function dialogTitle(stage, order) {
  if (stage !== 'order') {
    return 'Escolha o seu lugar';
  }

  return order?.status === 'CONFIRMED' ? 'Você tem um encontro marcado.' : 'Acompanhe sua compra';
}

export default function Checkout({ initialEvent, events, onClose, onComplete }) {
  const checkout = useCheckout({ initialEvent, events, onComplete });

  const { stage, order, error, seats } = checkout;

  return (
    <Dialog title={dialogTitle(stage, order)} onClose={onClose} wide>
      <Steps step={STEP_INDEX[stage]} />

      <ErrorNotice
        error={error}
        retry={stage === 'select' && !seats ? checkout.reloadSeats : undefined}
      />

      {stage === 'select' && (
        <SeatSelection
          events={events}
          eventId={checkout.eventId}
          event={checkout.event}
          sessionId={checkout.sessionId}
          seats={seats}
          cart={checkout.cart}
          username={checkout.username}
          total={checkout.total}
          busy={checkout.busy}
          onSelectEvent={checkout.selectEvent}
          onSessionChange={checkout.selectSession}
          onToggleSeat={checkout.toggleSeat}
          onRemoveSeat={checkout.removeSeat}
          onUsernameChange={checkout.updateUsername}
          onReserve={checkout.beginAdmission}
        />
      )}

      {stage === 'waiting' && <WaitingRoom admission={checkout.admission} />}

      {stage === 'held' && (
        <ReservationSummary
          reservation={checkout.reservation}
          cart={checkout.cart}
          expired={checkout.expired}
          busy={checkout.busy}
          onExpire={checkout.markExpired}
          onRestart={checkout.restartSelection}
          onPay={checkout.submitOrder}
        />
      )}

      {stage === 'order' && order && (
        <OrderResult order={order} timeline={checkout.timeline} onClose={onClose} />
      )}
    </Dialog>
  );
}
