# React e contrato inicial com o Gateway

Esta é a especialização executável de `contratos-etiquete.md` para o frontend atual. Os contratos de domínio continuam naquele documento; as extensões estão identificadas abaixo e em `desenvolvimento.md`.

## Estrutura React

```text
frontend/src/
  main.jsx                       BrowserRouter e estilos globais
  App.jsx                        Entrada da aplicação
  routes/
    AppRoutes.jsx                Rotas, layout comum e validação de UUID na URL
    paths.js                     Caminhos de navegação e links antigos
    *Route.jsx                   Parâmetros, consultas e composição de cada tela
  components/
    layout/BaseLayout.jsx        Menu, busca, conteúdo, rodapé e ajuda
    layout/Sidebar.jsx           Links e indicação da rota ativa
    layout/Topbar.jsx            Busca e atalhos
    checkout/                    Apresentação das etapas de compra
    ResourceState.jsx            Carregamento, erro e recuperação de consultas
  pages/                         Conteúdo visual das telas
  hooks/
    useResource.js               Consultas canceláveis ao trocar de rota
    useCheckout.js               Admissão → reserva → pedido → acompanhamento
  services/
    http-client.js               Transporte HTTP/mock e validação mínima de respostas
    catalog.js                   Eventos, sessões e mapa público de assentos
    admissions.js                Entrada e acompanhamento da fila
    reservations.js              Reserva temporária e consulta
    orders.js                    Pedidos, histórico e cancelamento
    payments.js                  Consulta do pagamento criado pela SAGA
    notifications.js             Consulta de notificações
    catalog-view.js              Composição explícita de evento e sessões
    pagination.js                Leitura de todas as páginas de uma coleção
  api.js                         Composição dos clientes e escolha do adaptador
  tokens.css / ui.jsx / styles/   Padrões visuais compartilhados
```

As rotas coordenam a consulta e passam dados às telas. Os componentes de apresentação não conhecem portas, URLs dos microsserviços nem métodos HTTP. O checkout mantém sua coordenação em `useCheckout`; `OrderDetails` mantém o acompanhamento e o cancelamento do pedido. Ambos utilizam clientes de domínio.

`BaseLayout` usa `Outlet`, e o menu usa `NavLink`. Navegar não recria o layout. O foco vai para o conteúdo ao mudar de página, preservando a digitação na busca e o foco dos diálogos. A consulta de pedidos não impede abrir o catálogo. Dados complementares do catálogo podem falhar sem impedir consultar ou cancelar um pedido.

Menu e busca permanecem fora da área `.content-scroll`, que contém tela e rodapé. A mudança de página reinicia a rolagem dessa área. A largura da moldura é compartilhada entre rotas e a barra de rolagem tem espaço reservado. Em telas estreitas, `useMediaQuery` ativa o menu modal com Escape, foco contido e conteúdo de fundo inerte. Veja [as regras de layout e UX](padroes-interface.md).

## Rotas do navegador

| URL | Responsabilidade | Chamadas ao Gateway |
|---|---|---|
| `/` | Painel e agenda | `GET /events`, sessões dos eventos, `GET /orders?username=…` |
| `/eventos?search=…&category=…` | Catálogo filtrado | `GET /events` com filtros e paginação; `GET /events/{eventId}/sessions` |
| `/eventos/:eventId` | Detalhe, local e sessões | `GET /events/{eventId}` e `GET /events/{eventId}/sessions` |
| `/eventos/:eventId/checkout` | Seleção, fila, reserva e compra | Catálogo e sequência de compra descrita abaixo |
| `/ingressos?status=confirmed` | Histórico do usuário de demonstração; filtro opcional de situação | `GET /orders?username=…`; catálogo complementar |
| `/pedidos/:orderId` | Pedido, histórico, pagamento e cancelamento | `GET /orders/{orderId}`, `GET /orders/{orderId}/timeline`, `GET /payments/{paymentId}`, `POST /orders/{orderId}/cancel`; catálogo complementar |
| `/notificacoes` | Confirmações e acesso ao pedido | `GET /notifications?username=…` |
| `/laboratorio` | Modos, cenários e diagnóstico | Clientes dos domínios e `GET /_dev/services` |
| Demais caminhos ou UUID inválido | Página não encontrada | Nenhuma consulta ao recurso inválido |

Os caminhos HTTP da tabela recebem o prefixo `/api/v1`; as URLs do navegador não recebem esse prefixo. Filtros do catálogo ficam na URL e sobrevivem ao histórico de navegação. Os links antigos `/#events`, `/#tickets`, `/#notifications` e `/#lab` redirecionam para as novas rotas.

O filtro `status` dos ingressos aceita `confirmed`, `processing` e `cancelled`; ausência ou valor desconhecido exibe todos. Esse filtro é de apresentação e não altera o contrato HTTP de Pedidos. O KPI de ingressos abre os confirmados; o de pedidos abre o histórico completo; o de eventos abre o catálogo.

Checkout e pedido continuam usando o diálogo compartilhado, agora acessível por URL. Ao fechar a compra após criar um pedido, abre-se `/pedidos/:orderId`. Ao fechar o pedido, abre-se `/ingressos`. Acessar ou recarregar o checkout não envia comandos: o carrinho e os contextos de escrita existem apenas durante aquela montagem. Uma reserva abandonada continua sujeita ao TTL. Persistência e recuperação de uma compra interrompida por recarga ainda não estão implementadas.

O Nginx de `frontend/nginx.conf` serve `index.html` para URLs da SPA. Arquivos ausentes em `/assets/` retornam 404. `/api/` não recebe o HTML da SPA. O Nginx externo continua encaminhando `/api/v1/` ao Gateway; Vite faz isso pelo proxy de desenvolvimento.

## Registro HTTP compartilhado

`shared/http-contract.js` declara as 24 operações por nome, método, caminho, serviço proprietário, status de sucesso, filtros e requisitos de contexto. O Gateway usa esse registro para encaminhar apenas combinações de método e caminho conhecidas. Caminhos ou métodos não registrados retornam `404 RESOURCE_NOT_FOUND`, mantendo a convenção existente.

`operationPath` monta e codifica os parâmetros e filtros. O cliente React não concatena strings de endpoints nas telas. `GET /sessions/{sessionId}/seats` pertence ao inventário de **Reservas**, embora seja apresentado junto ao Catálogo na interface.

`pnpm fixtures` exporta esse mesmo registro para `mocks/contracts/gateway.json`. Os exemplos de cada serviço cobrem todas as operações registradas, e o teste verifica métodos e status. Para adicionar uma operação:

1. Alinhe o contrato do domínio e implemente os adaptadores mock/live compatíveis.
2. Registre a operação em `shared/http-contract.js` e exponha o método no cliente de domínio, quando necessário ao frontend.
3. Acrescente exemplos em `scripts/export-fixtures.mjs` e execute `pnpm fixtures`.
4. Acrescente testes de comportamento e atualize a tabela de telas quando houver um novo fluxo.

O registro não é um esquema completo de DTOs. A validação do cliente confere status, objeto JSON, identificador principal e envelopes de listas. Validações de campos de negócio e transições continuam nos serviços.

## Transporte e contexto da operação

O único endereço HTTP do cliente é `/api/v1`, na mesma origem. Não há configuração de portas de serviços no navegador. O adaptador HTTP tem timeout de 10 segundos, aceita `AbortSignal`, envia JSON e preserva erros do Gateway. Consultas são canceladas ao desmontar a rota; o polling limpa timers e requisições de leitura.

| Cabeçalho | Comportamento |
|---|---|
| `Accept: application/json` | Enviado em todas as chamadas HTTP |
| `Content-Type: application/json` | Enviado quando há corpo |
| `X-Correlation-Id` | UUID por consulta ou compartilhado pelo fluxo de compra; Gateway gera um quando ausente/inválido |
| `Idempotency-Key` | Contexto estável por criação de reserva, pedido e solicitação de cancelamento |
| `X-Admission-Token` | Enviado nas criações de reserva e pedido após liberação da admissão |
| `Authorization` | Ponto de extensão via `context.accessToken`; ainda não há login nem autenticação implementados |

`newContext(correlationId?)` cria uma nova chave de idempotência. Uma compra compartilha a correlação entre admissão, reserva, pedido e polling, mas cada escrita tem sua própria chave. Repetir a mesma operação após timeout conserva contexto e corpo; mudar a seleção cria outro contexto de reserva. Iniciar nova reserva após expiração também cria um novo contexto de pedido.

Exemplo de uso de um cliente:

```js
import { newContext, reservations } from './api.js';

// Criar uma vez e conservar para a tentativa seguinte da mesma operação.
const context = {
  ...newContext(),
  admissionToken: admission.token,
};

const reservation = await reservations.create(
  {
    username: 'marina',
    items: [{ sessionId, seatIds: [seatId] }],
    expiresInSeconds: 600,
  },
  { context },
);
```

O cliente não faz retries automáticos de escritas. Erros contratuais preservam `status`, `code`, `message`, `details` e correlação em `ApiError`. Falha de rede/timeout produz `503 DEPENDENCY_UNAVAILABLE`. HTML, JSON inválido ou resposta incompatível produzem o erro local `502 INVALID_GATEWAY_RESPONSE`; esse código é um diagnóstico do cliente, não uma nova resposta dos domínios. Nenhum erro HTTP ativa o mock como fallback.

## Sequência da compra

1. Consulte evento e sessões; carregue o mapa com `GET /sessions/{sessionId}/seats`.
2. Selecione até dois lugares, inclusive entre sessões. Preços de exibição usam centavos.
3. Envie `POST /admissions` com `{ eventId, sessionId }`. A resposta é `202`.
4. Enquanto `WAITING`, consulte `GET /admissions/{admissionTokenId}`. Só continue após `ADMITTED`.
5. Envie `POST /reservations` com `{ username, items, expiresInSeconds: 600 }`, idempotência e token. Espere `201` e `HELD`.
6. Após confirmação do usuário, envie `POST /orders` com `{ reservationId, username, items, paymentMethod: 'SIMULATED' }`, token e outra chave de idempotência. Espere `202`.
7. Consulte pedido e timeline até estado terminal ou `MANUAL_INTERVENTION`. `sagaId = orderId`.
8. Para cancelar, revise a ação e envie `POST /orders/{orderId}/cancel` com `{ reason: 'CUSTOMER_REQUEST' }`. Espere `202`; acompanhe o estorno antes de apresentar `CANCELLED`.

O frontend **não** confirma/libera reservas, cria pagamentos, solicita estornos diretamente ou envia notificações. Essas ações pertencem à SAGA. Os endpoints correspondentes continuam no contrato HTTP dos serviços, mas não estão expostos pelos clientes de compra. O mapa de assentos não garante disponibilidade; a reserva atômica decide.

## Extensões e dados necessários à apresentação

- `GET /orders` e `GET /reservations` são extensões de listagem já adotadas nesta base. Usam `{ items, pagination }` e filtros `page`, `limit`, `username`. `username` é um filtro de demonstração, sem autorização.
- `GET /notifications` também admite `username` nesta base.
- `GET /_dev/services` é diagnóstico de desenvolvimento: `{ service, dependencies: { [service]: { mode } }, scenario }`. Não representa um endpoint de negócio.
- A apresentação dos eventos usa `title`, `description`, `category`, `priceFromCents` e o local em `venue`. `subtitle`, `artwork` e demais metadados visuais são aditivos. As sessões são consultadas pelo endpoint dedicado; o frontend não depende de estarem embutidas no evento.
- Sessões usam `sessionId`, `eventId`, `startsAt` em UTC. Assentos usam `seatId`, `row`, `number`, `section`, `status` e `priceCents`. Pedidos usam `items`, `username`, `amountCents`, estados e referências de reserva/pagamento. Os JSONs em `mocks/contracts/` mostram os DTOs completos do protótipo.
- Painel e histórico percorrem todas as páginas com limite 100. Para grandes volumes, a próxima evolução é paginação visível na interface; não introduzir truncamento silencioso.

## Mock, Gateway e verificações

No Vite de desenvolvimento, o padrão é mock no navegador. No build, o padrão é Gateway. `VITE_DATA_MODE` e a preferência explícita do Laboratório podem alterar esse padrão. Apenas o mock do navegador é escolhido na interface; os modos dos serviços são definidos no processo do Gateway por `DATA_MODE` e `<SERVICE>_MODE`, mantendo as regras do hub compartilhado.

`pnpm test` cobre o fluxo dos seis clientes em mock e HTTP, propagação de cabeçalhos, repetição idempotente, respostas inválidas, registro de rotas e exemplos estáticos. Os testes React com DOM simulado exercitam links, busca, voltar, erro/recuperação, estado vazio, foco inicial, checkout e pedido por URL. Não substituem inspeção visual em navegador nem teste com Kafka real.

```sh
pnpm fixtures
pnpm format:check
pnpm test
pnpm build
docker compose config --quiet
docker compose --profile microservices -f docker-compose.yml -f docker-compose.integration.yml config --quiet
```

Ainda são necessários autenticação/autorização, proteção dos endpoints internos, rate limiting, persistência transacional, Inbox/Outbox e recuperação entre processos. O contrato inicial e os testes não tornam os simuladores em memória implementações de produção.
