import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { FlaskConical } from 'lucide-react';
import { customer, dataMode } from '../../api.js';
import { paths } from '../../routes/paths.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import HelpDialog from './HelpDialog.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function BaseLayout() {
  const [sidebar, setSidebar] = useState(false);
  const [help, setHelp] = useState(false);
  const [query] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const main = useRef(null);
  const viewport = useRef(null);
  const firstRender = useRef(true);
  const mobile = useMediaQuery('(max-width: 800px)');

  const closeHelp = useCallback(() => setHelp(false), []);
  const closeSidebar = useCallback(() => setSidebar(false), []);

  useEffect(() => {
    if (!mobile) {
      setSidebar(false);
    }
  }, [mobile]);

  useEffect(() => {
    setSidebar(false);

    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const searchHasFocus = document.activeElement?.id === 'global-search';

    if (!searchHasFocus && !document.querySelector('[role="dialog"]')) {
      main.current?.focus({ preventScroll: true });
    }

    if (viewport.current) {
      viewport.current.scrollTop = 0;
    }
  }, [location.pathname]);

  function search(value) {
    const next = new URLSearchParams(location.pathname === paths.events ? query : undefined);

    if (value) {
      next.set('search', value);
    } else {
      next.delete('search');
    }

    navigate(`${paths.events}${next.size ? `?${next}` : ''}`, {
      replace: location.pathname === paths.events,
    });
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>

      <div className="app-shell">
        <Sidebar
          sidebar={sidebar}
          mobile={mobile}
          customer={customer}
          onClose={closeSidebar}
          onHelp={() => {
            setSidebar(false);
            setHelp(true);
          }}
        />

        {mobile && sidebar && (
          <div className="navigation-backdrop" aria-hidden="true" onClick={closeSidebar} />
        )}

        <div className="workspace" inert={mobile && sidebar ? true : undefined}>
          <Topbar
            sidebar={sidebar}
            search={query.get('search') || ''}
            onSearch={search}
            onToggleSidebar={() => setSidebar((open) => !open)}
          />

          <div className="content-scroll" ref={viewport}>
            <main id="main-content" ref={main} tabIndex={-1}>
              <Outlet />
            </main>

            <footer className="app-footer">
              <span>eTiquete</span>

              <Link to={paths.lab}>
                {dataMode === 'mock' ? 'Demonstração' : 'Gateway conectado'}{' '}
                <FlaskConical size={13} />
              </Link>
            </footer>
          </div>
        </div>
      </div>

      {help && <HelpDialog onClose={closeHelp} />}
    </>
  );
}
