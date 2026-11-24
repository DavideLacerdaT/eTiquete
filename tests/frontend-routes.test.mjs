import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';

test('rotas React navegam, preservam filtros, isolam falhas e concluem checkout', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  };

  const previous = new Map();

  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  dom.window.scrollTo = () => {};

  const mediaListeners = new Set();
  const media = {
    matches: false,
    addEventListener: (_, listener) => mediaListeners.add(listener),
    removeEventListener: (_, listener) => mediaListeners.delete(listener),
  };

  dom.window.matchMedia = () => media;

  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const server = await createServer({
    configFile: 'frontend/vite.config.js',
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  });

  let navigate;
  let location;

  function LocationProbe() {
    navigate = useNavigate();
    location = useLocation();
    return null;
  }

  async function waitFor(predicate, message) {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      if (predicate()) {
        return;
      }

      await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
    }

    assert.fail(`${message}\n${document.body.textContent}`);
  }

  async function click(element) {
    assert.ok(element, 'Controle esperado não está disponível.');
    await act(async () => element.click());
  }

  const buttonWith = (text) =>
    [...document.querySelectorAll('button')].find((button) => button.textContent.includes(text));

  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    const api = await server.ssrLoadModule('/src/api.js');
    const originalListOrders = api.orders.list;
    let orderCalls = 0;

    api.orders.list = async () => {
      orderCalls += 1;
      throw new Error('Pedidos temporariamente indisponíveis.');
    };

    await act(async () =>
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/eventos?search=Jazz'] },
          React.createElement(LocationProbe),
          React.createElement(App),
        ),
      ),
    );

    await waitFor(
      () => document.querySelectorAll('.event-card').length === 1,
      'Catálogo filtrado não carregou.',
    );
    assert.match(document.querySelector('.event-card').textContent, /Noites de Jazz/);
    assert.equal(document.getElementById('global-search').value, 'Jazz');
    assert.equal(orderCalls, 0, 'Consultar eventos não deve depender do serviço de Pedidos.');
    assert.equal(document.querySelector('a[aria-current="page"]').getAttribute('href'), '/eventos');

    await click(document.querySelector('a[href="/ingressos"]'));
    await waitFor(() => document.querySelector('[role="alert"]'), 'Erro de Pedidos não apareceu.');
    assert.match(document.querySelector('[role="alert"]').textContent, /Pedidos temporariamente/);

    api.orders.list = originalListOrders;
    await click(buttonWith('Tentar novamente'));
    await waitFor(
      () => document.querySelector('.order-card'),
      'A recuperação de Pedidos não carregou ingressos.',
    );

    await act(async () => navigate(-1));
    await waitFor(
      () => document.querySelectorAll('.event-card').length === 1,
      'Voltar perdeu a busca.',
    );
    assert.equal(location.search, '?search=Jazz');

    await click(buttonWith('Ver evento'));
    await waitFor(
      () => document.querySelector('.event-details'),
      'Detalhes do evento não carregaram.',
    );
    assert.match(location.pathname, /^\/eventos\/[0-9a-f-]{36}$/);
    assert.equal(document.activeElement.id, 'main-content');

    await click(document.querySelector('a[href$="/checkout"]'));
    await waitFor(
      () => document.querySelector('.seat.available'),
      'Acesso direto ao checkout não carregou lugares.',
    );
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    assert.equal(document.activeElement.getAttribute('role'), 'dialog');

    await click(document.querySelector('.seat.available'));
    await click(buttonWith('Reservar meus lugares'));
    await waitFor(() => buttonWith('Confirmar e pagar'), 'Reserva não chegou à confirmação.');

    await click(buttonWith('Confirmar e pagar'));
    await waitFor(
      () => document.body.textContent.includes('Agora é só viver o momento'),
      'Compra não foi confirmada.',
    );
    await click(document.querySelector('button[aria-label="Fechar"]'));
    await waitFor(
      () => location.pathname.startsWith('/pedidos/'),
      'Fechar compra não abriu o pedido criado.',
    );
    await waitFor(
      () => document.body.textContent.includes('Solicitar cancelamento'),
      'Pedido direto não carregou.',
    );

    const orderPath = location.pathname;

    await click(document.querySelector('button[aria-label="Fechar"]'));
    await waitFor(
      () => document.querySelector('.order-card'),
      'Voltar do pedido não carregou ingressos.',
    );

    await act(async () => navigate(orderPath));
    await waitFor(
      () => document.body.textContent.includes('Solicitar cancelamento'),
      'URL compartilhável do pedido falhou.',
    );

    await act(async () => navigate('/eventos/endereco-invalido'));
    assert.match(document.body.textContent, /Página não encontrada/);
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);

    await act(async () => navigate('/eventos?search=sem-resultados'));
    await waitFor(
      () => document.body.textContent.includes('Nenhum encontro encontrado'),
      'Estado vazio ausente.',
    );

    await act(async () => navigate('/#lab'));
    await waitFor(() => location.pathname === '/laboratorio', 'Link antigo não foi redirecionado.');
    await act(async () => navigate('/'));
    await waitFor(
      () => document.querySelectorAll('.stat-card').length === 3,
      'KPIs não carregaram.',
    );

    const scrollArea = document.querySelector('.content-scroll');
    scrollArea.scrollTop = 500;

    await click(document.querySelector('.stat-card.yellow'));
    await waitFor(
      () => document.querySelector('.order-card'),
      'KPI de ingressos não abriu a listagem.',
    );

    assert.equal(location.pathname, '/ingressos');
    assert.equal(location.search, '?status=confirmed');
    assert.equal(scrollArea.scrollTop, 0, 'Uma nova página deve começar no topo do conteúdo.');
    assert.equal(buttonWith('Confirmados').getAttribute('aria-pressed'), 'true');
    assert.ok(
      [...document.querySelectorAll('.order-card .badge')].every(
        (badge) => badge.textContent === 'Confirmado',
      ),
    );

    await click(buttonWith('Cancelados'));
    assert.equal(location.search, '?status=cancelled');
    assert.ok(
      [...document.querySelectorAll('.order-card .badge')].every(
        (badge) => badge.textContent === 'Cancelado',
      ),
    );

    await act(async () => navigate(-1));
    assert.equal(buttonWith('Confirmados').getAttribute('aria-pressed'), 'true');

    await act(async () => navigate('/'));
    await waitFor(() => document.querySelector('.stat-card.green'), 'Painel não voltou.');
    await click(document.querySelector('.stat-card.green'));
    assert.equal(location.pathname, '/eventos');

    await act(async () => navigate('/'));
    await waitFor(
      () => document.querySelector('.stat-card.blue'),
      'Histórico não ficou disponível.',
    );
    await click(document.querySelector('.stat-card.blue'));
    assert.equal(location.pathname, '/ingressos');
    assert.equal(location.search, '');

    await act(async () => {
      media.matches = true;
      mediaListeners.forEach((listener) => listener());
    });

    const menuButton = document.querySelector('button[aria-label="Abrir menu"]');
    menuButton.focus();

    await click(menuButton);

    const menu = document.querySelector('#primary-navigation');
    const lastControl = [...menu.querySelectorAll('a[href], button:not(:disabled)')].at(-1);

    assert.equal(menu.getAttribute('aria-modal'), 'true');
    assert.ok(document.querySelector('.workspace').hasAttribute('inert'));
    assert.equal(document.activeElement?.className, 'icon-button close-navigation');

    await act(async () =>
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
      ),
    );
    assert.equal(document.activeElement?.textContent, lastControl.textContent);

    await act(async () =>
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
      ),
    );
    assert.equal(document.activeElement?.className, 'icon-button close-navigation');

    await act(async () =>
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    assert.ok(menu.hidden);
    assert.ok(!document.querySelector('.workspace').hasAttribute('inert'));
    assert.equal(document.activeElement?.getAttribute('aria-controls'), 'primary-navigation');

    await click(menuButton);
    await click(menu.querySelector('a[href="/notificacoes"]'));
    assert.equal(location.pathname, '/notificacoes');
    assert.ok(menu.hidden);

    await act(async () => {
      media.matches = false;
      mediaListeners.forEach((listener) => listener());
    });

    assert.ok(!menu.hidden);
    assert.equal(menu.getAttribute('role'), null);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.window.close();

    for (const [key, descriptor] of previous) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    }
  }
});
