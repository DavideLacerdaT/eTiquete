# Mocks contratuais

`fixtures/` separa IDs, catálogo, reservas, pedidos, pagamentos, notificações e cenários em arquivos próprios. `fixtures.js` reexporta esses dados para manter uma entrada comum. `contracts/` fornece JSON estático por serviço, além de mensagens e cenários. Execute `pnpm fixtures` para regenerar essas coleções após editar o gerador/dados; a saída já recebe a formatação do projeto.

`services/` contém simuladores com comportamento: leitura, escrita em memória, transições, validação e efeitos assíncronos. `network.js` conecta esses domínios por adaptadores, sem acesso cruzado a estado.

```js
import { createMockNetwork } from './network.js';
const mock = createMockNetwork({ scenario: 'payment-declined', delay: 1 });
const catalog = await mock.api('GET', '/events');
// mock.api devolve { status, body }; erros usam ApiError.
// mock.settled() aguarda tarefas para testes determinísticos.
// mock.messages registra comandos/resultados com envelopes Kafka.
```

As datas estáticas são uma agenda de demonstração de novembro de 2026. Reservas novas e tokens usam o relógio atual; testes podem injetar `now`. IDs fixos de fixture não são documentos/identificadores pessoais reais.

Para usar entre processos: `pnpm dev:mocks` e `MOCK_BASE_URL=http://127.0.0.1:3090`. O endpoint privado `/_mock/commands` transporta **somente comandos mockados**. No modo live, o transporte de comandos é Kafka.

Os exemplos `RATE_LIMITED` e erros de domínio nas coleções documentam contratos; a simulação de rate limiting do Gateway não está implementada. Autenticação, persistência e recuperação também não são simuladas como garantias de produção.
