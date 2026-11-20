import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

test('componentes React renderizam shell, laboratório e checkout com contratos do catálogo', async () => {
  const server = await createServer({
    configFile: 'frontend/vite.config.js',
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  });
  const previous = globalThis.location;
  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    globalThis.location = { hash: '#home' };
    const shell = renderToString(React.createElement(App));
    assert.match(shell, /Buscar eventos/);
    assert.match(shell, /Visão geral/);
    assert.match(shell, /Meus ingressos/);
    globalThis.location = { hash: '#lab' };
    const lab = renderToString(React.createElement(App));
    assert.match(lab, /Gateway HTTP/);
    assert.match(lab, /Mock no navegador/);
    assert.match(lab, /Notificações/);
    const { default: Checkout } = await server.ssrLoadModule('/src/Checkout.jsx');
    const { createMockNetwork } = await import('../mocks/network.js');
    const events = (await createMockNetwork().api('GET', '/events')).body.items;
    const checkout = renderToString(
      React.createElement(Checkout, {
        initialEvent: events[0],
        events,
        onClose() {},
        onComplete() {},
      }),
    );
    assert.match(checkout, /Escolha o seu lugar/);
    assert.match(checkout, /Nome de usuário/);
    assert.match(checkout, /Reservar meus lugares/);
  } finally {
    globalThis.location = previous;
    await server.close();
  }
});
