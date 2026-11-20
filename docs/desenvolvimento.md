# Desenvolvimento independente e integração

Esta base implementa o frontend React e **simuladores de desenvolvimento** para os seis domínios, além do Gateway. Não substitui as implementações persistentes dos serviços. O backend anterior continua disponível em `/api/`; os contratos novos usam `/api/v1`.

## Início rápido

Requisitos: Node 22.13+ e pnpm 11.25. O lockfile é `pnpm-lock.yaml`.

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Abra **http://localhost:5173**. O comando inicia Vite e Gateway (porta 3001). O frontend começa em mock no navegador e funciona mesmo sem Gateway. Para trabalhar só na interface: `pnpm dev:frontend`.

No menu **Laboratório**, selecione mock no navegador ou Gateway HTTP. Aplicar recarrega a página e reinicia os dados do navegador. A preferência fica em localStorage; os dados de negócio, não. O botão “Consultar exemplo” exercita cada contrato e mostra JSON. A seção de mensagens mostra comandos e eventos de compras realizadas na sessão.

Para usar variáveis em arquivo no Node, o carregamento é explícito:

```sh
node --env-file=.env services/gateway/server.mjs
node --env-file=.env services/server.mjs orders
```

Copie `.env.example` para `.env` e ajuste. Vite lê variáveis `VITE_*` na pasta `frontend`; a seleção pelo Laboratório dispensa esse arquivo. `VITE_DATA_MODE` é apenas o padrão inicial, antes de uma preferência salva.

## Estrutura e responsabilidade

| Caminho | Papel |
|---|---|
| `frontend/src/` | Telas, componentes, API e design system |
| `frontend/src/pages/` | Painel, catálogo, ingressos, detalhes, notificações e laboratório separados |
| `mocks/fixtures.js` | Dados determinísticos e cenários |
| `mocks/contracts/*.json` | Exemplos estáticos por serviço: requisição, resposta, erro e IDs |
| `mocks/services/<domínio>.js` | Simulador isolado e estado pertencente ao domínio |
| `mocks/network.js` | Rede em memória para frontend e testes |
| `shared/contracts.js` | Erros, UUID, envelopes, paginação e roteamento |
| `shared/config.js` | Política de configuração comum |
| `shared/dependencies.js` | Adaptador mock/HTTP/Kafka por dependência |
| `services/server.mjs` | Processo independente de um domínio |
| `services/gateway/server.mjs` | Entrada única e roteamento da API |
| `services/kafka.mjs` | Transporte real de comandos/resultados para desenvolvimento |
| `scripts/mock-hub.mjs` | Rede compartilhada de mocks para vários processos |

| Serviço | Porta local | Proprietário dos dados | Dependências no fluxo |
|---|---:|---|---|
| Gateway | 3001 | Nenhum dado de negócio | Todos, via adaptadores |
| Catálogo | 3011 | Eventos, sessões e locais | Nenhuma neste simulador |
| Admissão | 3012 | Fila e tokens | Catálogo HTTP |
| Reservas | 3013 | Inventário e reservas | Admissão HTTP; recebe comandos |
| Pedidos | 3014 | Pedidos e SAGA | Admissão/Reservas HTTP; Reservas/Pagamentos/Notificações por comandos |
| Pagamentos | 3015 | Cobranças e estornos | Recebe comandos; nenhuma consulta a banco alheio |
| Notificações | 3016 | Confirmações e entrega | Recebe comandos; nenhuma consulta a banco alheio |
| Mock hub | 3090 | Estados simulados separados por domínio | Mesma matriz de dependências da execução |

Um domínio novo deve manter o mesmo par `handle`/`command` ou oferecer uma implementação compatível por HTTP/Kafka. O objeto `deps` é a fronteira de integração; não importar o estado de outro serviço.

## Configuração de fontes

| Variável | Valores / significado |
|---|---|
| `DATA_MODE` | `mock` ou `live`; padrão dos adaptadores |
| `CATALOG_MODE`, `ADMISSIONS_MODE`, `RESERVATIONS_MODE`, `ORDERS_MODE`, `PAYMENTS_MODE`, `NOTIFICATIONS_MODE` | Sobrescrevem o padrão para cada dependência |
| `<SERVICE>_URL` | Base HTTP do serviço, sem `/api/v1` |
| `MOCK_BASE_URL` | Hub comum, sem `/api/v1`; omitir no próprio hub |
| `MOCK_SCENARIO` | Cenário do processo (padrão `happy-path`) |
| `DEPENDENCY_TIMEOUT_MS` | Timeout de HTTP/comando; usar pelo menos 10000 para pagamento tardio |
| `MESSAGING_MODE` | `mock` ou `kafka`; Kafka é necessário quando um comando aponta para domínio `live` |
| `KAFKA_BROKERS` | Lista separada por vírgulas |
| `SERVICE_NAME`, `PORT`, `HOST` | Domínio e bind do processo |

“Live” significa **comunicação real com o endpoint/broker configurado**. Os processos fornecidos ainda são simuladores em memória. A troca de fonte não transforma memória em PostgreSQL. Erro real retorna `503 DEPENDENCY_UNAVAILABLE`; nunca há fallback para um sucesso fictício.

### Um serviço por vez

```sh
pnpm dev:service catalog
pnpm dev:service reservations
```

Sem variáveis, o serviço usa mocks internos. Para vários processos participarem **da mesma compra**, use um hub: mocks internos de processos diferentes não compartilham tokens/reservas.

Exemplo completo em PowerShell para desenvolver **Pedidos**, com os demais domínios no mesmo hub:

Terminal 1:

```powershell
$env:ORDERS_MODE = 'live'
$env:ORDERS_URL = 'http://127.0.0.1:3014'
pnpm dev:mocks
```

Terminal 2:

```powershell
$env:MOCK_BASE_URL = 'http://127.0.0.1:3090'
pnpm dev:service orders
```

Terminal 3:

```powershell
$env:ORDERS_MODE = 'live'
$env:ORDERS_URL = 'http://127.0.0.1:3014'
$env:MOCK_BASE_URL = 'http://127.0.0.1:3090'
pnpm dev
```

Escolha **Gateway HTTP** no Laboratório. A admissão e a reserva serão criadas no hub, Pedidos as consultará por HTTP, e comandos mockados irão ao mesmo hub. Isso exercita o serviço de Pedidos sem Kafka, bancos ou outros processos de negócio.

Para substituir Reservas/Pagamentos/Notificações por processos reais, configure seus modos/URLs também no hub e use `MESSAGING_MODE=kafka` no produtor e consumidor. O produtor precisa receber o evento de resultado; serviços HTTP externos devem também implementar os comandos/eventos do contrato. Não alterar modos no meio de uma compra: reinicie a execução de teste com estado coerente.

### Docker

```sh
docker compose up --build -d
```

Abre em **http://localhost:8080**. Inicia frontend, Gateway, hub de mocks, backend anterior e infraestrutura existente. `docker compose --profile microservices up --build` adiciona os seis processos independentes. Cada variável `<SERVICE>_MODE` escolhe o destino; os URLs internos usam DNS do Compose.

Para todos os domínios com comunicação HTTP/Kafka real:

```sh
docker compose --profile microservices -f docker-compose.yml -f docker-compose.integration.yml up --build
```

Escolha Gateway HTTP na interface. Este perfil é de desenvolvimento, com **uma instância por domínio**. O broker precisa estar saudável antes dos consumidores iniciarem. O endpoint `/_mock/commands` só existe no hub e não é publicado no Nginx. As portas diretas dos serviços são ligadas apenas a `127.0.0.1`.

## Cenários

| Cenário | Resultado observável |
|---|---|
| `happy-path` | Pedido PENDING → RESERVED → PAYMENT_PENDING → PAID → CONFIRMED |
| `queue` | WAITING por 8 segundos; polling libera a admissão |
| `seat-conflict` | 409; nenhuma aquisição parcial |
| `payment-declined` | Pagamento FAILED; reserva RELEASED; pedido CANCELLED |
| `reservation-expired` | TTL de 5 segundos; confirmação posterior retorna 410 |
| `late-payment` | Aprovação após expiração; estorno e CANCELLED, sem CONFIRMED |
| `refund-failed` | REFUND_PENDING / MANUAL_INTERVENTION |
| `notification-failed` | Compra confirmada, notificação FAILED |
| `unavailable` | 503 explícito |
| `empty` | Catálogo sem resultados |

O cenário é fixado no contexto da operação, para não mudar uma SAGA já iniciada. GET não avança o pagamento; tarefas assíncronas o fazem. Admissão e expiração são determinadas por tempo e reconciliadas nas consultas/operações. Recarregar a interface não altera dados de um Gateway já em execução; reiniciar o processo zera seu estado.

## Complementos aos contratos originais

O documento-base é proposta e contém pontos ainda incompatíveis entre si. A implementação assume reserva antes de pedido (seções 4.3, 4.4 e decisão 12); o passo 3 da seção 8 não deve ser interpretado como criar pedido antes da reserva.

- `GET /orders` e `GET /reservations`: extensões de listagem para painel/laboratório. Retornam paginação padrão e aceitam `username`. Não representam autenticação; o protótipo é uma conta de demonstração.
- Eventos retornam título, descrição, categoria, local, sessões, faixa etária, preço mínimo e metadados visuais. `amountCents` da reserva é calculado pelo inventário; o pedido não confia em preço enviado pelo cliente.
- `POST /admissions/validate` recebe `{ token }`. A resposta inclui `valid`, sessão e expiração. Para uma compra de múltiplas sessões, o token cobre a entrada no checkout e deve corresponder a uma das sessões. Validar essa política com a equipe.
- `reservation.cancel` / `reservation.cancelled`: extensão para marcar ingressos de uma reserva CONFIRMED como cancelados **após** refund. Mantém status terminal CONFIRMED, adiciona `cancelledAt`, e não libera inventário para revenda automática.
- Contratos Kafka de reservas passam a transportar o objeto completo com `items`; esse formato cobre múltiplas sessões. O documento-base ainda exemplifica alguns eventos com `sessionId`/`seatIds` planos. Alinhar essa extensão antes da integração com implementações externas.
- Simulador notifica por `notification.send`, já previsto no documento. O cliente nunca cria uma notificação via HTTP.
- Campos extras nas respostas são aditivos; erros preservam o envelope `error` e o `correlationId`.

## Validação e próximos limites

```sh
pnpm fixtures
pnpm test
pnpm build
docker compose config --quiet
docker compose --profile microservices -f docker-compose.yml -f docker-compose.integration.yml config --quiet
```

Os testes executam contratos, limite de ingressos, aquisição concorrente em um processo, idempotência, expiração, sucesso/compensação, cancelamento, falhas, configuração por domínio, Gateway HTTP e comunicação híbrida com hub.

Kafka real e Docker precisam de daemon/broker disponíveis. O adaptador fornecido valida envelopes, publica com chave de agregado, deduplica comandos em memória e só confirma offsets após tratar/publicar o resultado. Mensagens inválidas vão a DLQ. Falhas de negócio respondem evento de erro. **Não estão implementados** persistência transacional de Inbox/Outbox, três retries de negócio com backoff/DLQ de esgotamento, retenção de sete dias, recuperação após reinício ou isolamento de réplicas. Não usar essa base como implementação de produção.

Também permanecem para implementação: autenticação/autorização, proteção das operações internas de confirmar/liberar, rate limiting/circuit breaker persistente, PostgreSQL por serviço, Redis e observabilidade. O backend anterior permanece independente e não deve ser usado como prova de compatibilidade com `/api/v1`.
