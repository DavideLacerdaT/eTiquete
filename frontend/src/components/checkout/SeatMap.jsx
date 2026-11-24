import React from 'react';
import { Check } from 'lucide-react';
import { Loading } from '../../ui.jsx';

export default function SeatMap({ seats, cart, sessionId, onToggleSeat }) {
  return (
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
                      onClick={() => onToggleSeat(seat)}
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
  );
}
