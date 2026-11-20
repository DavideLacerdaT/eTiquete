# Serviços de desenvolvimento

As pastas de implementação estão em `mocks/services/`; cada arquivo possui seu próprio estado e expõe um handler. `server.mjs` é o bootstrap HTTP comum. Para substituir o simulador por implementação persistente, preserve as portas/contratos e injete `deps` nas regras de negócio.

| Serviço | Implementação / coleção estática | Trabalho independente |
|---|---|---|
| Gateway | `gateway/server.mjs` / `mocks/contracts/gateway.json` | Roteamento, limites, autenticação e circuit breaker |
| Catálogo | `mocks/services/catalog.js` / `mocks/contracts/catalog.json` | Eventos/sessões, PostgreSQL e cache |
| Admissão | `mocks/services/admissions.js` / `mocks/contracts/admissions.json` | Fila, capacidade e tokens com TTL |
| Reservas | `mocks/services/reservations.js` / `mocks/contracts/reservations.json` | Transação e unicidade por sessão/assento |
| Pedidos | `mocks/services/orders.js` / `mocks/contracts/orders.json` | SAGA persistente, recuperação e compensações |
| Pagamentos | `mocks/services/payments.js` / `mocks/contracts/payments.json` | Idempotência durável de cobrança/estorno |
| Notificações | `mocks/services/notifications.js` / `mocks/contracts/notifications.json` | Persistência antes do envio, retry de entrega |

Os comandos `pnpm dev:service <domínio>` usam nomes em inglês: `catalog`, `admissions`, `reservations`, `orders`, `payments`, `notifications`. Consulte [o guia](../docs/desenvolvimento.md) para rodar com os outros domínios mockados e preservar uma compra entre processos.

Regras de integração: [ADR 0003](../docs/adr/0003-mocks-e-adaptadores.md). Interface: [padrões compartilhados](../docs/padroes-interface.md). Não há banco compartilhado nem chamada de UI diretamente a um serviço interno.
