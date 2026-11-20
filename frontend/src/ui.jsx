import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Ticket, Music2, Drama, Sun, Sparkles, Check } from 'lucide-react';

export const money = (cents) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const date = (value, options = {}) =>
  new Date(value).toLocaleDateString('pt-BR', {
    timeZone: 'America/Bahia',
    day: '2-digit',
    month: 'short',
    ...options,
  });
export const time = (value) =>
  new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Bahia',
    hour: '2-digit',
    minute: '2-digit',
  });
const statuses = {
  CONFIRMED: ['Confirmado', 'green'],
  HELD: ['Reservado', 'yellow'],
  PENDING: ['Recebido', 'blue'],
  RESERVED: ['Reservado', 'yellow'],
  PAYMENT_PENDING: ['Processando', 'yellow'],
  PAID: ['Pago', 'blue'],
  REFUND_PENDING: ['Estorno pendente', 'pink'],
  CANCELLED: ['Cancelado', 'neutral'],
  FAILED: ['Falhou', 'pink'],
  EXPIRED: ['Expirado', 'neutral'],
  RELEASED: ['Liberado', 'neutral'],
  SENT: ['Enviada', 'green'],
  SUCCEEDED: ['Aprovado', 'green'],
  REFUNDED: ['Estornado', 'blue'],
  WAITING: ['Na fila', 'yellow'],
  ADMITTED: ['Entrada liberada', 'green'],
};
export function Badge({ status }) {
  const [label, color] = statuses[status] || [status, 'neutral'];
  return <span className={`badge ${color}`}>{label}</span>;
}
export function ErrorNotice({ error, retry }) {
  return (
    error && (
      <div className="error-notice" role="alert">
        <AlertCircle size={20} />
        <div>
          <strong>{error.message || String(error)}</strong>
          {error.code && <small>{error.code}</small>}
          {retry && (
            <button className="text-button" onClick={retry}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  );
}
export function Empty({ title = 'Nada por aqui ainda', children }) {
  return (
    <div className="empty">
      <Ticket size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Poster({ kind = 'jazz', small = false }) {
  const Icon = { jazz: Music2, theatre: Drama, sun: Sun, ideas: Sparkles }[kind] || Music2;
  return (
    <div className={`poster poster-${kind} ${small ? 'small' : ''}`} aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <Icon className="poster-icon" strokeWidth={1} />
      <span className="poster-star">✳</span>
      <span className="poster-caption">ENCONTROS QUE FICAM.</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> Preparando seus encontros…
    </div>
  );
}
export function Dialog({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = [
        ...ref.current.querySelectorAll('button, input, select, a[href], [tabindex="0"]'),
      ].filter((el) => !el.disabled && el.offsetParent !== null);
      const first = elements[0],
        last = elements.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className={`dialog ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <header>
          <div>
            <span className="eyebrow">SEU PRÓXIMO ENCONTRO</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Countdown({ expiresAt, onExpire }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) onExpire?.();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);
  return (
    <span className={`countdown ${seconds < 60 ? 'urgent' : ''}`}>
      {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
    </span>
  );
}
export function Steps({ step }) {
  return (
    <div className="steps" aria-label="Etapas da compra">
      {['Lugares', 'Reserva', 'Confirmação'].map((label, i) => (
        <span className={i <= step ? 'active' : ''} key={label}>
          <b>{i < step ? <Check size={14} /> : i + 1}</b>
          {label}
        </span>
      ))}
    </div>
  );
}
