# ADR 0003 — Dependências alternáveis e mocks contratuais

- **Status:** adotado para a base de desenvolvimento.
- **Base:** [contratos](../contratos-etiquete.md), ADR 0001 e ADR 0002.

## Decisão

Todos os serviços, inclusive o Gateway, usam adaptadores injetados. Cada dependência é configurada como `mock` ou `live`. `DATA_MODE` define o padrão; `<SERVICE>_MODE` prevalece. A troca ocorre ao iniciar/reiniciar o processo, sem alterar a regra de negócio. Não há descoberta automática nem fallback de produção para dados fictícios.

Consultas reais usam HTTP. Comandos reais de reservas, pagamento e notificação usam Kafka. A confirmação da publicação não é confirmação do negócio: o adaptador de desenvolvimento aguarda o evento correlacionado por `causationId`.

O frontend tem dois adaptadores: simulação local e HTTP pelo Gateway. Componentes recebem o mesmo formato de resposta. Somente o Laboratório apresenta nomes de serviços, fontes e cenários técnicos.

## Isolamento e coerência

Cada simulador é dono do seu estado. Nenhum domínio importa o estado mutável de outro. Mocks locais são ideais para testes isolados e frontend; processos separados compartilham o mock hub para manter coerência de tokens, reservas e pedidos. A matriz de modos deve ser igual no Gateway, no hub e nos serviços participantes de uma mesma execução. Configurar uma dependência como `live` no hub permite que um domínio mockado consulte o domínio real.

## Consequências e limites

- Equipes podem substituir um domínio mantendo os outros simulados e executar cenários determinísticos.
- Mocks usam memória e relógio injetável; expiração é reconciliada a cada operação. Não demonstram durabilidade ou concorrência entre réplicas.
- O adaptador Kafka é uma base de desenvolvimento, de instância única por domínio. A Inbox e a correlação pendente são voláteis; não há Outbox transacional, recuperação após reinício nem política completa de retry de negócio.
- O cancelamento marca `cancelledAt` na reserva confirmada e mantém assentos indisponíveis. A revenda depende de política futura.
- Contratos HTTP adicionais para listagem e o comando de cancelamento estão em [desenvolvimento](../desenvolvimento.md); precisam de alinhamento antes de congelar a API.
