import React from 'react';
import { Dialog } from '../../ui.jsx';

export default function HelpDialog({ onClose }) {
  return (
    <Dialog title="Do encontro ao ingresso" onClose={onClose}>
      <ol className="help-list">
        <li>
          <strong>Encontre um evento.</strong>

          <p>Explore o catálogo e escolha uma sessão.</p>
        </li>

        <li>
          <strong>Escolha até 2 lugares.</strong>

          <p>Após a admissão, seus lugares ficam reservados por até 10 minutos.</p>
        </li>

        <li>
          <strong>Confirme a compra.</strong>

          <p>O pagamento é simulado. Acompanhe a confirmação em Meus ingressos.</p>
        </li>
      </ol>

      <p className="notice">
        Esta é uma base de desenvolvimento. A demonstração reinicia ao recarregar a página; os
        serviços de desenvolvimento também usam memória.
      </p>
    </Dialog>
  );
}
