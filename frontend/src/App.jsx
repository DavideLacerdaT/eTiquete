import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  CircleHelp,
  Compass,
  FlaskConical,
  LayoutDashboard,
  MapPin,
  Menu,
  Search,
  Settings2,
  SlidersHorizontal,
  Ticket,
  X,
} from 'lucide-react';
import { api, customer, dataMode } from './api.js';
import { Dialog, ErrorNotice, Loading } from './ui.jsx';
import Checkout from './Checkout.jsx';

const navigation = [
  { id: 'home', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'events', label: 'Explorar eventos', icon: Compass },
  { id: 'tickets', label: 'Meus ingressos', icon: Ticket },
  { id: 'notifications', label: 'Notificações', icon: Bell },
];

import Home from './pages/Home.jsx';
import Events from './pages/Events.jsx';
import OrderDetails from './pages/OrderDetails.jsx';
import Tickets from './pages/Tickets.jsx';
import Notifications from './pages/Notifications.jsx';
import Lab from './pages/Lab.jsx';

export default function App() {
  const [page, setPage] = useState(
    ['home', 'events', 'tickets', 'notifications', 'lab'].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : 'home',
  );
  const [events, setEvents] = useState([]),
    [orders, setOrders] = useState([]),
    [notifications, setNotifications] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null),
    [selectedOrder, setSelectedOrder] = useState(null),
    [search, setSearch] = useState(''),
    [sidebar, setSidebar] = useState(false),
    [help, setHelp] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    const results = await Promise.allSettled([
      api('GET', '/events?limit=100'),
      api('GET', `/orders?username=${customer}&limit=100`),
      api('GET', `/notifications?username=${customer}&limit=100`),
    ]);
    const setters = [setEvents, setOrders, setNotifications];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') setters[i](result.value.items);
    });
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) setError(failed.reason);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const onHash = () => {
      const next = location.hash.slice(1);
      if (['home', 'events', 'tickets', 'notifications', 'lab'].includes(next)) setPage(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [load]);
  function navigate(next) {
    setPage(next);
    location.hash = next;
    setSidebar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (['tickets', 'notifications'].includes(next)) load();
  }
  const closeCheckout = useCallback(() => {
    setSelectedEvent(null);
    load();
  }, [load]);
  const closeOrder = useCallback(() => {
    setSelectedOrder(null);
    load();
  }, [load]);
  const closeHelp = useCallback(() => setHelp(false), []);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <div className="app-shell">
        <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
          <a
            className="brand"
            href="#home"
            onClick={() => navigate('home')}
            aria-label="eTiquete início"
          >
            <Ticket size={27} strokeWidth={1.6} />
            <span>
              eTiquete<span className="brand-dot">.</span>
            </span>
          </a>
          <span className="sidebar-label">SEUS ENCONTROS</span>
          <nav aria-label="Principal">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${page === id ? 'active' : ''}`}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={19} />
                <span>{label}</span>
                {id === 'notifications' && notifications.length > 0 && (
                  <span className="nav-count">{notifications.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-tools">
            <span className="sidebar-label">BASTIDORES</span>
            <button
              className={`nav-item ${page === 'lab' ? 'active' : ''}`}
              onClick={() => navigate('lab')}
            >
              <SlidersHorizontal size={19} />
              Laboratório
            </button>
            <button className="nav-item" onClick={() => setHelp(true)}>
              <CircleHelp size={19} />
              Como funciona
            </button>
          </div>
          <div className="sidebar-bottom">
            <div className="sidebar-art" aria-hidden="true">
              ✳
              <span>
                Viva o que
                <br />
                faz sentido.
              </span>
            </div>
            <div className="profile">
              <span className="avatar">{customer.charAt(0).toUpperCase()}</span>
              <div>
                <strong>{customer}</strong>
                <small>Conta de demonstração</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label={sidebar ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={sidebar}
              onClick={() => setSidebar(!sidebar)}
            >
              {sidebar ? <X /> : <Menu />}
            </button>
            <div className="search-wrap">
              <span className="search-icon">
                <Search size={18} />
              </span>
              <label className="sr-only" htmlFor="global-search">
                Buscar eventos
              </label>
              <input
                id="global-search"
                value={search}
                placeholder="Busque seu próximo encontro"
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) navigate('events');
                }}
              />
              <span className="search-hint">EVENTOS</span>
            </div>
            <div className="topbar-actions">
              <span className="location">
                <MapPin size={15} /> Salvador, BA
              </span>
              <button
                className="icon-button dark"
                aria-label="Abrir notificações"
                onClick={() => navigate('notifications')}
              >
                <Bell size={18} />
              </button>
              <button
                className="icon-button dark"
                aria-label="Abrir configurações do laboratório"
                onClick={() => navigate('lab')}
              >
                <Settings2 size={18} />
              </button>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            <ErrorNotice error={error} retry={load} />
            {loading && page !== 'lab' ? (
              <Loading />
            ) : page === 'home' ? (
              <Home
                events={events}
                orders={orders}
                onSelect={setSelectedEvent}
                navigate={navigate}
              />
            ) : page === 'events' ? (
              <Events events={events} search={search} onSelect={setSelectedEvent} />
            ) : page === 'tickets' ? (
              <Tickets orders={orders} events={events} onSelect={setSelectedOrder} />
            ) : page === 'notifications' ? (
              <Notifications notifications={notifications} onSelect={setSelectedOrder} />
            ) : (
              <Lab />
            )}
          </main>
          <footer className="app-footer">
            <span>eTiquete · encontros que ficam.</span>
            <button onClick={() => navigate('lab')}>
              {dataMode === 'mock' ? 'Ambiente de demonstração' : 'Conectado ao Gateway'}{' '}
              <FlaskConical size={13} />
            </button>
          </footer>
        </div>
      </div>
      {selectedEvent && (
        <Checkout
          initialEvent={selectedEvent}
          events={events}
          onClose={closeCheckout}
          onComplete={load}
        />
      )}{' '}
      {selectedOrder && (
        <OrderDetails orderId={selectedOrder} events={events} onClose={closeOrder} refresh={load} />
      )}{' '}
      {help && (
        <Dialog title="Do encontro ao ingresso" onClose={closeHelp}>
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
      )}
    </>
  );
}
