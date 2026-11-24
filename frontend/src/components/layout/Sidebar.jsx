import React, { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router';
import { paths } from '../../routes/paths.js';
import {
  Bell,
  CircleHelp,
  Compass,
  LayoutDashboard,
  SlidersHorizontal,
  Ticket,
  X,
} from 'lucide-react';

const navigation = [
  { id: 'home', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'events', label: 'Explorar eventos', icon: Compass },
  { id: 'tickets', label: 'Meus ingressos', icon: Ticket },
  { id: 'notifications', label: 'Notificações', icon: Bell },
];

export default function Sidebar({ sidebar, mobile, customer, onHelp, onClose }) {
  const panel = useRef(null);
  const dismiss = useRef(null);

  useEffect(() => {
    if (!mobile || !sidebar) {
      return;
    }

    const previous = document.activeElement;

    dismiss.current?.focus();

    function handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const controls = [...panel.current.querySelectorAll('*')].filter(
        (element) => element.matches('a[href], button') && !element.disabled,
      );
      const first = controls[0];
      const last = controls.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);

      if (panel.current?.contains(document.activeElement)) {
        previous?.focus({ preventScroll: true });
      }
    };
  }, [mobile, sidebar, onClose]);

  return (
    <aside
      id="primary-navigation"
      ref={panel}
      className={`sidebar ${sidebar ? 'open' : ''}`}
      role={mobile && sidebar ? 'dialog' : undefined}
      aria-modal={mobile && sidebar ? true : undefined}
      aria-label="Menu principal"
      hidden={mobile && !sidebar}
    >
      {mobile && (
        <button
          ref={dismiss}
          className="icon-button close-navigation"
          aria-label="Fechar menu"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      )}

      <Link className="brand" to={paths.home} aria-label="eTiquete início">
        <Ticket size={27} strokeWidth={1.6} />

        <span>
          eTiquete<span className="brand-dot">.</span>
        </span>
      </Link>

      <span className="sidebar-label">NAVEGAÇÃO</span>

      <nav aria-label="Principal">
        {navigation.map(({ id, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={paths[id]}
            end={id === 'home'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={19} />

            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-tools">
        <span className="sidebar-label">BASTIDORES</span>

        <NavLink
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          to={paths.lab}
        >
          <SlidersHorizontal size={19} />
          Laboratório
        </NavLink>

        <button className="nav-item" onClick={onHelp}>
          <CircleHelp size={19} />
          Como funciona
        </button>
      </div>

      <div className="sidebar-bottom">
        <div className="profile">
          <span className="avatar">{customer.charAt(0).toUpperCase()}</span>

          <div>
            <strong>{customer}</strong>

            <small>Demonstração</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
