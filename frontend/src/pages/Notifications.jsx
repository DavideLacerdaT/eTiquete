import React from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Badge, date, Empty, time } from '../ui.jsx';

function Notifications({ notifications, onSelect }) {
  return (
    <>
      <div className="page-intro">
        <h1>Notificações</h1>

        <p>Atualizações das suas compras.</p>
      </div>

      <div className="notifications-list">
        {notifications.map((note) => (
          <article className="notification-card" key={note.notificationId}>
            <span className={`round-icon ${note.status === 'SENT' ? 'green' : 'pink'}`}>
              <Bell size={22} />
            </span>

            <div>
              <div className="section-heading">
                <h3>{note.title}</h3>

                <Badge status={note.status} />
              </div>

              <p>{note.message}</p>

              <small className="muted">
                {date(note.createdAt)} · {time(note.createdAt)}
              </small>

              <button className="text-button" onClick={() => onSelect(note.orderId)}>
                Ver compra <ChevronRight size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {!notifications.length && (
        <Empty title="Tudo tranquilo por aqui">
          As atualizações das suas compras aparecerão aqui.
        </Empty>
      )}
    </>
  );
}

export default Notifications;
