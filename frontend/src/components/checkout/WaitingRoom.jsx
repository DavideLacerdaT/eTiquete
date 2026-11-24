import React from 'react';
import { Clock3 } from 'lucide-react';

export default function WaitingRoom({ admission }) {
  return (
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
  );
}
