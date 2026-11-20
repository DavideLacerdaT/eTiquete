# ETIQUETE — Contratos de integração

> **Status:** proposta inicial para alinhamento entre os microsserviços.  
> **Escopo:** endpoints HTTP, comandos, eventos Kafka, identificadores, estados de pedido/reserva e regras de consistência.
>
> Este documento transforma as decisões arquiteturais do projeto em contratos implementáveis. O documento-base define microsserviços com banco exclusivo, API Gateway e SAGA orquestrada pelo serviço de Pedidos. **Nesta revisão, RabbitMQ foi substituído por Apache Kafka** como infraestrutura de mensageria; os contratos abaixo adaptam a integração para tópicos, partições, chaves e consumer groups. Outbox, Retry/DLQ, Redis para cache/admissão e PostgreSQL como persistência permanecem. Os caminhos, nomes de eventos, campos, tópicos e códigos HTTP são uma **convenção proposta** pelo grupo e devem ser validados antes da implementação.

---

## 1. Serviços e responsabilidades

| Serviço | Responsabilidade | Dados sob sua propriedade |
|---|---|---|
| **API Gateway** | Entrada HTTP do frontend, roteamento, autenticação/validação de token de admissão, limite de requisições e Circuit Breaker | Não é dono dos dados de negócio |
| **Catálogo** | Consulta e manutenção de eventos, sessões e informações necessárias para exibir o mapa de assentos | Eventos, sessões, locais e metadados do catálogo |
| **Admissão** | Fila de espera, emissão e validação de tokens temporários e limite de entrada no checkout | Estado da fila e admissões; Redis pode guardar tokens com TTL |
| **Reservas** | Inventário de assentos, aquisição atômica, confirmação, liberação e expiração | Assentos e reservas |
| **Pedidos** | Criação e consulta de pedidos; coordenação da SAGA | Pedidos, etapas da SAGA e Outbox |
| **Pagamentos** | Pagamento simulado, idempotência de cobrança e estorno | Tentativas, cobranças e estornos |
| **Notificações** | Envio e persistência de confirmações ao cliente | Notificações e seu estado de entrega |

**Regra de propriedade:** um serviço não consulta nem altera diretamente o banco de outro serviço. A integração ocorre por HTTP (quando uma resposta síncrona é necessária) ou por mensagens Kafka.

## 2. Convenções gerais

### 2.1 Base URL e versão

O frontend acessa somente o Gateway:

```text
/api/v1
```

O Gateway encaminha as rotas aos serviços internos. Os nomes internos e portas podem variar conforme o `docker-compose`; não devem ser acoplados ao frontend.

### 2.2 Formato

- JSON em requisições e respostas.
- Datas em ISO 8601 UTC, por exemplo `2026-11-19T21:30:00Z`.
- Valores monetários em centavos inteiros (`amountCents`), nunca em ponto flutuante.
- Identificadores em UUID.
- Campos em `camelCase`.
- `null` representa ausência de valor; não usar string vazia como substituto.
- Toda resposta de erro segue o formato:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Um ou mais assentos não estão disponíveis.",
    "details": {},
    "correlationId": "uuid"
  }
}
```

### 2.3 Cabeçalhos

| Cabeçalho | Uso |
|---|---|
| `Content-Type: application/json` | Requisições com corpo JSON |
| `Authorization: Bearer <token>` | Identidade/autorização, se autenticação for implementada |
| `X-Correlation-Id: <uuid>` | Rastrear uma operação entre Gateway, serviços e mensagens |
| `Idempotency-Key: <uuid>` | Obrigatório em operações que podem criar cobrança, pedido ou reserva |
| `X-Admission-Token: <token>` | Token temporário emitido pelo serviço de Admissão para entrar no checkout |

O Gateway deve propagar `X-Correlation-Id`. Se o cliente não enviar um, o Gateway gera um UUID. A `Idempotency-Key` deve ser mantida pelo cliente ao repetir a mesma operação após timeout.

### 2.4 Paginação

Listagens usam `page` (inicia em 1) e `limit` (padrão 20, máximo 100). Resposta:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

---

## 3. Identificadores

| Identificador | Formato sugerido | Criado por | Finalidade |
|---|---|---|---|
| `eventId` | UUID | Catálogo | Evento anunciado |
| `sessionId` | UUID | Catálogo | Sessão/apresentação específica do evento |
| `venueId` | UUID | Catálogo | Local do evento |
| `seatId` | UUID | Catálogo/Inventário | Assento físico dentro de uma sessão/local |
| `reservationId` | UUID | Reservas | Reserva temporária ou confirmada |
| `orderId` | UUID | Pedidos | Pedido do cliente e raiz da SAGA |
| `paymentId` | UUID | Pagamentos | Registro de cobrança |
| `refundId` | UUID | Pagamentos | Registro de estorno |
| `notificationId` | UUID | Notificações | Notificação persistida |
| `customerId` | UUID | Identidade/usuário | Cliente, caso exista cadastro |
| `username` | string | Frontend | Nome de usuário informado no checkout e associado à reserva/pedido |
| `admissionTokenId` | UUID | Admissão | Registro lógico do token temporário |
| `idempotencyKey` | UUID/string opaca | Cliente | Deduplicação de comandos HTTP |
| `sagaId` | UUID | Pedidos | Identificador da SAGA; sempre igual ao `orderId` |
| `messageId` | UUID | Produtor da mensagem | Deduplicação de evento/comando |
| `correlationId` | UUID | Gateway/consumidor | Rastreio ponta a ponta |
| `causationId` | UUID | Produtor | `messageId` que causou a mensagem atual |

### Relações importantes

- Um `eventId` pode possuir várias `sessionId`.
- A disponibilidade e a reserva de um assento devem ser controladas no contexto da sessão: a combinação lógica é `(sessionId, seatId)`.
- Uma reserva é criada antes do pedido e depois vinculada a ele. Um pedido pode reunir itens de múltiplas sessões, com no máximo 2 ingressos/unidades no total.
- Uma reserva pode conter vários `seatId`, mas cada assento só pode pertencer a uma reserva ativa por sessão.
- `orderId`, `reservationId` e `paymentId` são identificadores distintos. Não reutilizar um como se fosse outro. `sagaId` é sempre igual a `orderId`.

---

## 4. Contratos HTTP

Os endpoints abaixo são expostos pelo Gateway em `/api/v1`. Rotas internas podem ser separadas por serviço, mantendo os mesmos contratos.

### 4.1 Catálogo

| Método e rota | Descrição | Resposta de sucesso |
|---|---|---|
| `GET /events` | Lista eventos publicados; aceita `page`, `limit`, `search` e filtros | `200` + lista paginada |
| `GET /events/{eventId}` | Detalha um evento | `200` |
| `GET /events/{eventId}/sessions` | Lista sessões do evento | `200` |
| `GET /sessions/{sessionId}` | Detalha uma sessão e seu local | `200` |
| `GET /sessions/{sessionId}/seats` | Consulta mapa/estado público dos assentos | `200` |

Exemplo de `GET /sessions/{sessionId}/seats`:

```json
{
  "sessionId": "uuid",
  "seats": [
    {
      "seatId": "uuid",
      "section": "A",
      "row": "03",
      "number": "12",
      "status": "AVAILABLE"
    }
  ]
}
```

O endpoint de assentos é informativo. A resposta não garante que o assento continuará livre no instante seguinte. A garantia definitiva ocorre na aquisição atômica da reserva.

### 4.2 Admissão

| Método e rota | Descrição | Resposta de sucesso |
|---|---|---|
| `POST /admissions` | Solicita entrada na fila/checkout | `202` |
| `GET /admissions/{admissionTokenId}` | Consulta posição ou situação da admissão | `200` |
| `POST /admissions/validate` | Valida token enviado pelo cliente/Gateway | `200` |

Exemplo de `POST /admissions`:

```json
{
  "eventId": "uuid",
  "sessionId": "uuid"
}
```

Resposta enquanto aguarda:

```json
{
  "admissionTokenId": "uuid",
  "status": "WAITING",
  "position": 37,
  "estimatedWaitSeconds": 180
}
```

Resposta quando admitido:

```json
{
  "admissionTokenId": "uuid",
  "status": "ADMITTED",
  "token": "opaque-token",
  "expiresAt": "2026-11-19T21:40:00Z"
}
```

O token é temporário. O Redis pode armazená-lo com TTL, mas a regra de admissão e sua validade devem ser verificadas pelo serviço responsável. O token não substitui a reserva e não garante a disponibilidade de assentos.

### 4.3 Reservas

| Método e rota | Descrição | Resposta de sucesso |
|---|---|---|
| `POST /reservations` | Cria reserva temporária de assentos antes da criação do pedido | `201` |
| `GET /reservations/{reservationId}` | Consulta reserva | `200` |
| `POST /reservations/{reservationId}/confirm` | Confirma reserva após autorização do fluxo de pedido/pagamento | `200` |
| `POST /reservations/{reservationId}/release` | Libera reserva, como compensação | `200` |

Exemplo de criação:

```http
POST /api/v1/reservations
Idempotency-Key: 2f2e...
X-Correlation-Id: 8e8a...
X-Admission-Token: opaque-token
```

```json
{
  "items": [{
    "sessionId": "uuid",
    "seatIds": ["uuid"]
  }],
  "username": "usuario informado pelo frontend",
  "expiresInSeconds": 600
}
```

Resposta:

```json
{
  "reservationId": "uuid",
  "username": "usuario informado pelo frontend",
  "items": [{ "sessionId": "uuid", "seatIds": ["uuid"] }],
  "status": "HELD",
  "expiresAt": "2026-11-19T21:40:00Z"
}
```

Regras:
- A aquisição dos assentos deve ser atômica: ou todos os assentos solicitados são adquiridos, ou nenhum.
- A concorrência deve ser resolvida no PostgreSQL, por transação/constraint/bloqueio adequado. Redis não é a fonte de verdade da reserva.
- Uma reserva `HELD` possui prazo de expiração.
- O TTL padrão é `600` segundos (10 minutos).
- `username` é obrigatório e informado pelo frontend; deve ser armazenado na reserva e propagado ao pedido.
- `items` permite agrupar sessões diferentes; o total de assentos/ingressos em todos os itens não pode ultrapassar 2. A validação é feita no backend.
- `confirm` e `release` devem ser idempotentes.
- Uma reserva `CONFIRMED` não deve ser liberada pela rotina normal de expiração.
- Uma reserva `EXPIRED` ou `RELEASED` não pode ser confirmada posteriormente.

### 4.4 Pedidos

| Método e rota | Descrição | Resposta de sucesso |
|---|---|---|
| `POST /orders` | Cria pedido e inicia SAGA | `202` |
| `GET /orders/{orderId}` | Consulta pedido e estado da compra | `200` |
| `GET /orders/{orderId}/timeline` | Consulta etapas/eventos relevantes da compra | `200` |
| `POST /orders/{orderId}/cancel` | Solicita cancelamento de compra confirmada e inicia reembolso | `202` |

Exemplo de criação:

```http
POST /api/v1/orders
Idempotency-Key: 7d1a...
X-Correlation-Id: 8e8a...
X-Admission-Token: opaque-token
```

```json
{
  "reservationId": "uuid",
  "username": "usuario informado pelo frontend",
  "items": [{ "sessionId": "uuid", "seatIds": ["uuid"] }],
  "paymentMethod": "SIMULATED"
}
```

Resposta inicial:

```json
{
  "orderId": "uuid",
  "status": "PENDING",
  "sagaStatus": "RUNNING",
  "createdAt": "2026-11-19T21:30:00Z"
}
```

A criação retorna `202 Accepted` porque a compra é distribuída e termina de forma assíncrona. O frontend consulta `GET /orders/{orderId}` para acompanhar o resultado. O pedido é o identificador principal que o cliente usa no acompanhamento.
Exemplo de cancelamento após confirmação:

```http
POST /api/v1/orders/{orderId}/cancel
Idempotency-Key: uuid
```

```json
{ "reason": "CUSTOMER_REQUEST" }
```

O cancelamento é permitido para pedidos `CONFIRMED`. O pedido passa para `REFUND_PENDING`, a SAGA solicita `payment.refund` via Kafka e, após confirmação do estorno, muda para `CANCELLED`. A reserva/ingressos confirmados são marcados como cancelados; a liberação para revenda deve ocorrer somente após a política de cancelamento ser aplicada. Repetir a solicitação é idempotente.


### 4.5 Pagamentos

| Método e rota | Descrição | Resposta de sucesso |
|---|---|---|
| `POST /payments` | Solicita cobrança associada a um pedido | `202` |
| `GET /payments/{paymentId}` | Consulta pagamento | `200` |
| `POST /payments/{paymentId}/refund` | Solicita estorno compensatório | `202` |

Exemplo de solicitação:

```json
{
  "orderId": "uuid",
  "reservationId": "uuid",
  "amountCents": 12000,
  "currency": "BRL",
  "method": "SIMULATED"
}
```

O serviço de Pagamentos deve deduplicar solicitações por `Idempotency-Key` e/ou chave de negócio (`orderId` + operação). Uma repetição da mesma solicitação não pode gerar uma segunda cobrança. O estorno também deve ser idempotente.

### 4.6 Notificações

| Método e rota | Descrição | Resposta de sucesso |
|---|---|---|
| `GET /notifications` | Lista notificações do cliente autenticado | `200` |
| `GET /notifications/{notificationId}` | Consulta uma notificação | `200` |

A criação/envio de notificações é disparada por eventos internos, não por chamada direta do frontend. A confirmação da compra deve ser persistida antes ou durante a tentativa de envio, de forma que falhas possam ser reprocessadas.

---

## 5. Contratos de mensagens Kafka

### 5.1 Envelope padrão

Toda mensagem publicada entre serviços deve seguir um envelope comum. O envelope fica no valor (`value`) do registro Kafka, serializado em JSON:

```json
{
  "messageId": "uuid",
  "messageType": "reservation.held",
  "messageVersion": 1,
  "occurredAt": "2026-11-19T21:30:00Z",
  "producer": "reservation-service",
  "correlationId": "uuid",
  "causationId": "uuid",
  "aggregateType": "Reservation",
  "aggregateId": "uuid",
  "payload": {}
}
```

- `messageId`: identificador único da mensagem; usado para deduplicação.
- `messageType`: nome estável do contrato.
- `messageVersion`: versão do payload.
- `occurredAt`: instante UTC em que o fato ocorreu.
- `producer`: serviço que publicou.
- `correlationId`: acompanha a operação distribuída.
- `causationId`: mensagem/comando que originou este fato, quando aplicável.
- `aggregateId`: identificador do pedido ou reserva relacionada.
- `payload`: conteúdo específico do contrato.

Metadados de transporte devem ser enviados em headers Kafka quando fizer sentido (`correlationId`, `causationId`, `messageType`, `messageVersion`). Os campos do envelope permanecem como fonte portátil do contrato; consumidores não devem depender exclusivamente dos headers.

### 5.2 Tópicos, chave e particionamento

Kafka não utiliza exchanges, routing keys ou filas tradicionais. A comunicação ocorre por tópicos, e cada serviço interessado mantém seu próprio consumer group.

Tópicos sugeridos:

```text
etiquete.orders.events
etiquete.reservations.events
etiquete.payments.events
etiquete.notifications.events

etiquete.reservations.commands
etiquete.payments.commands
etiquete.notifications.commands
```

Regras propostas:

- Usar `aggregateId` como chave (`key`) do registro Kafka. Para o fluxo de compra, o agregado principal é o `orderId`; para eventos próprios de reserva, pode-se usar `reservationId`, desde que a estratégia seja consistente.
- A chave garante que registros com a mesma chave sejam encaminhados à mesma partição, preservando a ordem dentro daquela partição. Kafka **não** garante ordem global entre tópicos ou partições.
- Definir o número de partições conforme carga esperada e capacidade dos consumidores; aumentar partições pode alterar o mapeamento de chaves para partições.
- Cada serviço consumidor deve ter um `group.id` estável e exclusivo por finalidade. Instâncias do mesmo serviço compartilham o group para dividir partições; consumidores independentes usam groups diferentes.
- Não criar um consumer group compartilhado entre serviços que precisam receber todos o mesmo evento: cada serviço interessado deve ter seu próprio group.
- Usar nomes de tópico com prefixo do domínio e sufixos `events` ou `commands`, mantendo nomes de tópico estáveis e versionando contratos pelo campo `messageVersion`. Convenção: `messageVersion: 1` e compatibilidade retroativa dentro da mesma versão principal; mudanças incompatíveis incrementam a versão do contrato e são documentadas.

Exemplos de consumer groups:

```text
orders-saga
notifications-dispatcher
analytics-order-events
```

### 5.3 Tipos de mensagens e nomes

Eventos publicados:

```text
order.created
order.reservation_requested
order.reservation_succeeded
order.reservation_failed
order.payment_requested
order.payment_succeeded
order.payment_failed
order.confirmed
order.cancelled
reservation.held
reservation.confirmed
reservation.expired
reservation.released
payment.succeeded
payment.failed
payment.refunded
notification.requested
notification.sent
notification.failed
```

Comandos publicados:

```text
reservation.hold
reservation.confirm
reservation.release
payment.charge
payment.refund
notification.send
```

Um comando solicita que outro serviço execute uma ação; um evento informa que algo já aconteceu. Não publicar `reservation.confirmed` antes da confirmação persistida.

### 5.4 Comandos

| Comando | Tópico | Produtor → consumidor | Payload mínimo | Resultado esperado |
|---|---|---|---|---|
| `reservation.hold` | `etiquete.reservations.commands` | Pedidos → Reservas | `reservationId`, `username`, `items`, `expiresInSeconds` | Reserva adquirida ou falha, publicada em `etiquete.reservations.events` |
| `reservation.confirm` | `etiquete.reservations.commands` | Pedidos → Reservas | `orderId`, `reservationId` | Reserva confirmada e evento de resultado |
| `reservation.release` | `etiquete.reservations.commands` | Pedidos → Reservas | `orderId`, `reservationId`, `reason` | Reserva liberada e evento de resultado |
| `payment.charge` | `etiquete.payments.commands` | Pedidos → Pagamentos | `orderId`, `reservationId`, `amountCents`, `currency`, `method` | Cobrança aprovada ou recusada, publicada em `etiquete.payments.events` |
| `payment.refund` | `etiquete.payments.commands` | Pedidos → Pagamentos | `orderId`, `paymentId`, `reason` | Estorno concluído ou falha, publicado em `etiquete.payments.events` |
| `notification.send` | `etiquete.notifications.commands` | Pedidos → Notificações | `orderId`, `customerId`, `template`, `data` | Notificação enviada ou falha, publicada em `etiquete.notifications.events` |

Exemplo de payload `reservation.hold`:

```json
{
  "reservationId": "uuid",
  "username": "usuario informado pelo frontend",
  "items": [{ "sessionId": "uuid", "seatIds": ["uuid"] }],
  "expiresInSeconds": 600
}
```

O produtor publica o comando no tópico do serviço responsável. O consumidor executa a operação e publica um evento de resultado no tópico de eventos sob responsabilidade dele. Não tratar a confirmação de publicação no Kafka como confirmação de execução do comando.

### 5.5 Eventos

| Evento | Tópico | Produtor | Payload mínimo | Consumidores principais |
|---|---|---|---|---|
| `order.created` | `etiquete.orders.events` | Pedidos | `orderId`, `customerId`, `sessionId`, `seatIds`, `amountCents` | Analytics/observabilidade |
| `reservation.held` | `etiquete.reservations.events` | Reservas | `orderId`, `reservationId`, `sessionId`, `seatIds`, `expiresAt` | Pedidos |
| `reservation.confirmed` | `etiquete.reservations.events` | Reservas | `orderId`, `reservationId`, `confirmedAt` | Pedidos |
| `reservation.expired` | `etiquete.reservations.events` | Reservas | `orderId`, `reservationId`, `expiredAt` | Pedidos |
| `reservation.released` | `etiquete.reservations.events` | Reservas | `orderId`, `reservationId`, `reason` | Pedidos |
| `payment.succeeded` | `etiquete.payments.events` | Pagamentos | `orderId`, `paymentId`, `amountCents`, `paidAt` | Pedidos |
| `payment.failed` | `etiquete.payments.events` | Pagamentos | `orderId`, `paymentId`, `failureCode`, `failedAt` | Pedidos |
| `payment.refunded` | `etiquete.payments.events` | Pagamentos | `orderId`, `paymentId`, `refundId`, `amountCents`, `refundedAt` | Pedidos |
| `order.confirmed` | `etiquete.orders.events` | Pedidos | `orderId`, `reservationId`, `paymentId`, `confirmedAt` | Notificações |
| `order.cancelled` | `etiquete.orders.events` | Pedidos | `orderId`, `reason`, `cancelledAt` | Notificações |
| `notification.sent` | `etiquete.notifications.events` | Notificações | `notificationId`, `orderId`, `sentAt` | Pedidos/observabilidade |
| `notification.failed` | `etiquete.notifications.events` | Notificações | `notificationId`, `orderId`, `failureCode` | Observabilidade/reprocessamento |

### 5.6 Consumidores e grupos

| Consumer group | Tópicos consumidos | Responsabilidade |
|---|---|---|
| `orders-saga` | `etiquete.reservations.events`, `etiquete.payments.events` | Atualizar a SAGA e emitir os próximos comandos |
| `notifications-dispatcher` | `etiquete.orders.events`, `etiquete.notifications.commands` | Disparar notificações e acompanhar resultados |
| `analytics-order-events` | `etiquete.orders.events` | Projeções e métricas, sem interferir na SAGA |

Os nomes são exemplos. Um serviço que precisa receber todos os eventos deve possuir seu próprio consumer group. Não usar o mesmo group para Pedidos e Notificações, pois nesse caso os consumidores dividiriam as mensagens em vez de receber cópias independentes.

### 5.7 Confirmação, retry e DLQ

- Desabilitar commit automático de offsets para os consumidores críticos da SAGA; confirmar o offset somente depois de persistir o resultado do processamento e seus efeitos locais.
- Processar cada registro de forma idempotente, pois um rebalanceamento ou falha após a gravação no banco e antes do commit pode provocar reentrega.
- Para falhas transitórias, usar tópicos de retry com atraso controlado pela aplicação/infraestrutura, por exemplo `etiquete.reservations.retry` e `etiquete.reservations.dlq`. Definir política equivalente por domínio.
- Kafka não possui uma DLQ automática equivalente a uma fila com dead-letter exchange: a aplicação deve publicar a mensagem que falhou no tópico de DLQ, incluindo tópico/partição/offset originais, número de tentativas, timestamp e motivo.
- Mensagens inválidas ou com erro permanente devem ir para DLQ sem retry infinito. O reprocessamento deve ser explícito, auditável e idempotente.
- Evitar bloquear uma partição inteira por uma mensagem com falha: aplicar retry/DLQ com política clara e preservar a ordem por agregado quando a sequência de eventos for relevante.
- Definir retenção dos tópicos, fator de replicação, política de compactação quando aplicável e prazo de retenção das DLQs conforme os requisitos do projeto.
- Política inicial da DLQ: retenção de **7 dias**; até **3 tentativas** com backoff exponencial para erros transitórios antes de enviar para DLQ. Reprocessamento manual/operacional, após correção do problema, mantendo `messageId` original e adicionando metadados `reprocessedAt`, `reprocessedBy` e `reprocessCount`. Não reprocessar automaticamente mensagens da DLQ em loop.
- A confirmação de escrita pelo broker deve usar uma configuração de durabilidade apropriada ao ambiente (por exemplo, `acks=all` e fator de replicação compatível). A configuração definitiva depende do cluster implantado.

---

## 6. Estados do pedido

O estado de negócio do pedido e o estado técnico da SAGA são campos distintos.

### 6.1 `order.status`

| Estado | Significado | Estado terminal? |
|---|---|---|
| `PENDING` | Pedido criado; aguardando início/conclusão da reserva | Não |
| `RESERVED` | Assentos reservados temporariamente | Não |
| `PAYMENT_PENDING` | Cobrança solicitada; aguardando resultado | Não |
| `PAID` | Pagamento aprovado; aguardando confirmação final da reserva/pedido | Não |
| `CONFIRMED` | Compra concluída; assentos confirmados e pagamento aprovado | Sim |
| `CANCELLED` | Compra cancelada e compensações concluídas ou não necessárias | Sim |
| `FAILED` | Compra não pôde ser concluída por falha não recuperável | Sim |
| `REFUND_PENDING` | Pagamento aprovado, mas compensação por estorno ainda está em andamento | Não |

Transições principais:

```text
PENDING
  ├── reserva adquirida ──> RESERVED
  ├── reserva indisponível ──> FAILED
  └── erro não recuperável ──> FAILED

RESERVED
  ├── cobrança solicitada ──> PAYMENT_PENDING
  ├── reserva expirada ──> CANCELLED
  └── falha/timeout definitivo ──> CANCELLED

PAYMENT_PENDING
  ├── pagamento aprovado ──> PAID
  ├── pagamento recusado ──> CANCELLED
  └── reserva expirada antes da conclusão ──> CANCELLED

PAID
  ├── confirmação da reserva/pedido ──> CONFIRMED
  └── confirmação impossível ──> REFUND_PENDING

REFUND_PENDING
  ├── estorno concluído ──> CANCELLED
  └── estorno com falha ──> permanece REFUND_PENDING (retry/DLQ/ação operacional)
```

Cancelamento de pedido confirmado: `CONFIRMED` → `REFUND_PENDING` → `CANCELLED` (somente após o estorno confirmado). Falha no estorno mantém `REFUND_PENDING` e permite retry/reprocessamento.

**Invariante:** um pedido só pode chegar a `CONFIRMED` quando o pagamento estiver aprovado e a reserva estiver confirmada. Pagamento aprovado, isoladamente, não significa compra concluída.

### 6.2 `saga.status`

| Estado | Significado |
|---|---|
| `RUNNING` | SAGA em execução |
| `COMPENSATING` | Uma etapa falhou; ações compensatórias estão sendo executadas |
| `COMPLETED` | Fluxo concluído com sucesso |
| `COMPENSATED` | Fluxo desfeito com sucesso |
| `MANUAL_INTERVENTION` | Compensação não foi concluída após política de retry; exige análise |

A SAGA deve persistir a etapa atual, tentativas, último erro e timestamps. Não depender apenas da memória do processo Node.js.

---

## 7. Estados da reserva

Campo `reservation.status`:

| Estado | Significado | Pode expirar? | Pode confirmar? |
|---|---|---:|---:|
| `HELD` | Assentos adquiridos temporariamente; aguardando conclusão da compra | Sim | Sim, se ainda válida |
| `CONFIRMED` | Reserva efetivada após sucesso do fluxo de compra | Não | Já confirmada |
| `EXPIRED` | Prazo da reserva terminou sem confirmação | Não | Não |
| `RELEASED` | Reserva liberada explicitamente por compensação/cancelamento | Não | Não |

Transições permitidas:

```text
HELD ── confirmação válida ──> CONFIRMED
HELD ── prazo expirou ───────> EXPIRED
HELD ── comando de liberação ─> RELEASED
```

`CONFIRMED`, `EXPIRED` e `RELEASED` são estados terminais nesta versão do contrato. Uma nova tentativa de compra deve criar outra reserva, com outro `reservationId`.

### 7.1 Estado do assento

Para a sessão, cada assento pode ser apresentado como:

- `AVAILABLE`: disponível para tentativa de reserva.
- `HELD`: temporariamente reservado.
- `SOLD`: associado a uma reserva confirmada.

O estado exibido no catálogo é uma visão de leitura. A decisão final é feita transacionalmente pelo serviço de Reservas.

---

## 8. Fluxo principal da compra (SAGA)

1. Cliente consulta eventos, sessões e assentos no Catálogo.
2. Cliente entra na Admissão e recebe token temporário quando houver capacidade.
3. Cliente envia `POST /orders` com sessão, assentos, método de pagamento e token de admissão.
4. Frontend cria primeiro a reserva (`POST /reservations`) com username e itens. Reservas valida e adquire os assentos atomicamente, persistindo `HELD`, `reservationId` e `expiresAt` (600 segundos); retorna a reserva criada.
5. Frontend envia `POST /orders` com `reservationId`, username, itens e método de pagamento. Pedidos valida a reserva, cria `orderId` (e define `sagaId = orderId`), vincula a reserva e persiste o pedido.
6. Pedidos registra `order.created` e `payment.charge` na Outbox, publica o comando Kafka e muda o pedido para `PAYMENT_PENDING`.
7. Pagamentos processa a cobrança de forma idempotente:
   - Sucesso: persiste cobrança e publica `payment.succeeded`.
   - Falha: persiste resultado e publica `payment.failed`.
8. Se o pagamento for aprovado, Pedidos solicita `reservation.confirm`.
9. Reservas confirma a reserva e publica `reservation.confirmed`.
10. Pedidos marca `order.status = CONFIRMED` e `saga.status = COMPLETED`; publica `order.confirmed`.
11. Notificações consome `order.confirmed`, persiste e envia a confirmação ao cliente.

### 8.1 Compensações

| Situação | Ação compensatória |
|---|---|
| Assentos indisponíveis | Não há pagamento; pedido termina sem sucesso |
| Pagamento recusado | Pedidos solicita `reservation.release` |
| Reserva expira antes do pagamento ser concluído | Pedidos cancela o pedido; se houver pagamento aprovado/tardio, solicita estorno |
| Pagamento aprovado, mas confirmação da reserva falha definitivamente | Pedidos solicita `payment.refund`; libera a reserva se ainda estiver ativa |
| Mensagem repetida | Consumidor deduplica por `messageId`/chave de negócio e não repete efeito |
| Serviço indisponível temporariamente | Retry com backoff; após limite, DLQ e recuperação operacional |

**Pagamento tardio:** se `payment.succeeded` chegar depois de o pedido ter sido cancelado ou de a reserva ter expirado/liberado, Pedidos não deve confirmar a compra. Deve iniciar estorno idempotente.

---

## 9. Regras de idempotência, concorrência e consistência

1. **Reserva atômica:** a operação de reservar múltiplos assentos deve ser uma única transação local. Não permitir reserva parcial.
2. **Unicidade:** garantir no banco que não existam duas reservas ativas para o mesmo `(sessionId, seatId)`.
3. **Expiração:** a validade da reserva é determinada por `expiresAt` persistido no PostgreSQL. O Redis pode apoiar temporizadores/cache, mas não é a fonte de verdade.
4. **Idempotência HTTP:** armazenar a chave, operação e resultado associado. Mesma chave + mesmo conteúdo retorna o resultado anterior; mesma chave + conteúdo diferente retorna `409 IDEMPOTENCY_KEY_REUSED`.
5. **Idempotência de mensagens:** registrar `messageId` processado ou usar chave de negócio para impedir efeitos duplicados.
6. **Outbox:** alteração de estado e registro da mensagem a publicar devem ocorrer na mesma transação local.
7. **Entrega:** assumir processamento pelo menos uma vez no Kafka. Consumidores precisam tolerar duplicatas; o commit do offset deve ocorrer somente após a persistência dos efeitos locais.
8. **Ordem:** Kafka preserva ordem somente dentro de uma partição. Publicar com chave estável por agregado e validar estado atual/versão do agregado antes de aplicar uma mensagem.
9. **Concorrência de transições:** transições de estado devem ser condicionais ao estado atual esperado (compare-and-set/controle otimista ou bloqueio transacional).
10. **Retry:** aplicar tentativas limitadas e backoff para falhas transitórias. Erros de regra de negócio (ex.: assento ocupado) não devem ser repetidos indefinidamente.
11. **DLQ:** mensagens que esgotarem tentativas vão para DLQ com metadados de erro, tentativas e timestamp. Reprocessamento deve preservar `messageId` original ou registrar claramente a mensagem derivada.
12. **Circuit Breaker:** Gateway e chamadas síncronas internas devem evitar propagar indisponibilidade em cascata; Circuit Breaker não substitui retry nem tratamento da SAGA.
13. **Offsets:** não confirmar offset antes de persistir o processamento. Em falhas entre commit de banco e offset, aceitar reentrega e resolver por idempotência.
14. **Outbox/Publisher:** publicar registros da Outbox no Kafka com chave do agregado; marcar como publicado somente após confirmação do broker. A publicação pode ocorrer mais de uma vez, portanto o consumidor deduplica.

---

## 10. Códigos HTTP e erros de domínio

| HTTP | Código | Quando usar |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Campo ausente ou inválido |
| `401` | `UNAUTHENTICATED` | Credencial ausente/inválida |
| `403` | `ADMISSION_REQUIRED` | Token de admissão ausente, inválido ou expirado |
| `404` | `RESOURCE_NOT_FOUND` | Evento, sessão, pedido ou reserva inexistente |
| `409` | `SEAT_UNAVAILABLE` | Um ou mais assentos já não estão disponíveis |
| `409` | `INVALID_STATE_TRANSITION` | Operação incompatível com o estado atual |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Chave reutilizada com payload diferente |
| `410` | `RESERVATION_EXPIRED` | Reserva expirou |
| `422` | `PAYMENT_DECLINED` | Pagamento recusado por regra do simulador |
| `429` | `RATE_LIMITED` | Limite de requisições/admissão atingido |
| `500` | `INTERNAL_ERROR` | Falha inesperada |
| `503` | `DEPENDENCY_UNAVAILABLE` | Dependência indisponível/Circuit Breaker aberto |

Em operações assíncronas, `202` significa que a solicitação foi aceita para processamento, não que a compra foi concluída.

---

## 11. Observabilidade e rastreabilidade

Todos os serviços devem registrar, quando disponíveis:

- `timestamp`, `service`, `level`, `message`;
- `correlationId`, `causationId`, `messageId`;
- `orderId`, `reservationId`, `paymentId`;
- `sagaStatus`, `orderStatus`, `reservationStatus`;
- número de tentativa e erro, sem registrar dados sensíveis de pagamento.

Métricas úteis para Prometheus/Grafana:

- latência e taxa de erro por endpoint;
- quantidade de pedidos por estado;
- duração total da SAGA;
- reservas adquiridas, expiradas, liberadas e conflitos de assento;
- pagamentos aprovados, recusados e estornados;
- mensagens pendentes, retries e tamanho da DLQ;
- tempo de espera na admissão e quantidade de tokens ativos.

---

## 12. Decisões ainda a validar pelo grupo

Os itens abaixo não estão fechados na documentação arquitetural e precisam de decisão explícita antes de congelar os contratos:

- [x] Duração padrão da reserva (`expiresInSeconds`): 600 segundos (10 minutos).
- [x] Reserva é criada primeiro; o pedido é criado depois e vinculado pelo `reservationId`.
- [x] O frontend informa `username`, que será vinculado à reserva e ao pedido. Não exigir `customerId` para esse fluxo inicial.
- [x] Pagamento simulado sempre assíncrono via Kafka.
- [x] Pedido pode incluir itens de múltiplas sessões; limite de 2 ingressos/unidades por pedido.
- [x] Cancelamento permitido em compra `CONFIRMED`; status muda para `REFUND_PENDING`, solicita estorno via Kafka e só termina em `CANCELLED` após confirmação do refund.
- [x] Convenção definida neste documento: tópicos `etiquete.<domain>.(commands|events)`, consumer groups por finalidade, chave por agregado, `messageVersion` no envelope.
- [x] DLQ com retenção inicial de 7 dias, 3 tentativas com backoff e reprocessamento operacional idempotente.
- [x] `sagaId` é o próprio `orderId`.

---

## 13. Checklist de aceite entre serviços

- [ ] Todos os serviços usam os mesmos nomes, tipos e semântica dos identificadores.
- [ ] Cada endpoint possui request, response, erros e regra de idempotência documentados.
- [ ] Todos os comandos possuem consumidor responsável e resultado definido.
- [ ] Todos os eventos possuem produtor, payload versionado e consumidores definidos.
- [ ] Pedidos e Reservas validam transições de estado.
- [ ] Reserva concorrente do mesmo assento resulta em apenas um vencedor.
- [ ] Repetir criação de pedido/pagamento não duplica efeitos.
- [ ] Mensagens duplicadas não duplicam cobrança, estorno ou confirmação.
- [ ] Expiração libera assentos e atualiza o pedido por evento.
- [ ] Pagamento tardio após cancelamento gera estorno, nunca confirmação.
- [ ] Falha temporária, retry, DLQ, commit de offsets e recuperação foram testados com Kafka/Testcontainers.
- [ ] Outbox garante persistência conjunta da alteração de negócio e da mensagem pendente.
