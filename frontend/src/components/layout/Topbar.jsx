import React from 'react';
import { Link } from 'react-router';
import { paths } from '../../routes/paths.js';
import { Bell, MapPin, Menu, Search, Settings2, X } from 'lucide-react';

export default function Topbar({ sidebar, search, onSearch, onToggleSidebar }) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu"
        aria-label={sidebar ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={sidebar}
        aria-controls="primary-navigation"
        onClick={onToggleSidebar}
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
          placeholder="Buscar eventos"
          onChange={(e) => onSearch(e.target.value)}
        />

        <span className="search-hint">EVENTOS</span>
      </div>

      <div className="topbar-actions">
        <span className="location">
          <MapPin size={15} /> Salvador, BA
        </span>

        <Link className="icon-button dark" aria-label="Abrir notificações" to={paths.notifications}>
          <Bell size={18} />
        </Link>

        <Link
          className="icon-button dark"
          aria-label="Abrir configurações do laboratório"
          to={paths.lab}
        >
          <Settings2 size={18} />
        </Link>
      </div>
    </header>
  );
}
