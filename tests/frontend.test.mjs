import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

test('componentes React renderizam shell, laboratório e checkout com contratos do catálogo', async () => {
  const server = await createServer({
    configFile: 'frontend/vite.config.js',
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  });

  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');

    const renderRoute = (path) =>
      renderToString(
        React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
      );

    const shell = renderRoute('/');

    assert.match(shell, /Buscar eventos/);

    assert.match(shell, /Visão geral/);

    assert.match(shell, /Meus ingressos/);

    const lab = renderRoute('/laboratorio');

    assert.match(lab, /Gateway HTTP/);

    assert.match(lab, /Mock no navegador/);

    assert.match(lab, /Notificações/);

    assert.match(renderRoute('/caminho-inexistente'), /Página não encontrada/);
    assert.match(renderRoute('/eventos/id-invalido'), /Página não encontrada/);
    assert.match(renderRoute('/pedidos/id-invalido'), /Página não encontrada/);
    assert.match(
      renderRoute('/eventos'),
      /aria-current="page"[^>]*class="nav-item active"|class="nav-item active"/,
    );

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

    // Exercita as etapas extraídas, inclusive as que não aparecem na renderização inicial.
    const { seats, reservations, orders } = await import('../mocks/fixtures.js');
    const { default: SeatMap } = await server.ssrLoadModule('/src/components/checkout/SeatMap.jsx');
    const sessionSeats = seats.filter((seat) => seat.sessionId === events[0].sessions[0].sessionId);
    const seatMap = renderToString(
      React.createElement(SeatMap, {
        seats: sessionSeats,
        cart: [sessionSeats[0]],
        sessionId: sessionSeats[0].sessionId,
        onToggleSeat() {},
      }),
    );

    assert.equal((seatMap.match(/<button/g) || []).length, 48);
    assert.match(seatMap, /aria-pressed="true"/);
    assert.match(seatMap, /disabled=""/);

    const { default: WaitingRoom } = await server.ssrLoadModule(
      '/src/components/checkout/WaitingRoom.jsx',
    );
    const waitingRoom = renderToString(
      React.createElement(WaitingRoom, {
        admission: { position: 8, estimatedWaitSeconds: 8 },
      }),
    );

    assert.match(waitingRoom, /sua posição na fila/);
    assert.match(waitingRoom, /<strong>8<\/strong>/);

    const { default: ReservationSummary } = await server.ssrLoadModule(
      '/src/components/checkout/ReservationSummary.jsx',
    );
    const reservationSummary = renderToString(
      React.createElement(ReservationSummary, {
        reservation: reservations[0],
        cart: [{ ...sessionSeats[0], eventTitle: events[0].title }],
        expired: false,
        busy: false,
        onExpire() {},
        onRestart() {},
        onPay() {},
      }),
    );

    assert.match(reservationSummary, /Confirmar e pagar/);
    assert.match(reservationSummary, /marina/);

    const { default: OrderResult } = await server.ssrLoadModule(
      '/src/components/checkout/OrderResult.jsx',
    );
    const orderResult = renderToString(
      React.createElement(OrderResult, { order: orders[0], timeline: [], onClose() {} }),
    );

    assert.match(orderResult, /Confirmado/);
    assert.match(orderResult, /Agora é só viver o momento/);
  } finally {
    await server.close();
  }
});
