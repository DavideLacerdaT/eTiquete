# ADR 0001 — Microsserviços com banco exclusivo por serviço

- **Status:** Aceito

## Contexto

A venda de ingressos cruza catálogo, reserva, pagamento e notificação. Um banco compartilhado faria cada mudança de módulo arrastar os outros.

## Alternativa descartada

Banco único compartilhado.

O esquema vira contrato entre serviços que deveriam evoluir separados. Uma alteração de reserva ou de pagamento obriga os demais a acompanhar a mesma mudança de banco.

## Decisão

Cada microsserviço persiste no próprio banco ou esquema. Os outros só chegam nesses dados por API ou mensagem.

## Consequências

Catálogo, reserva, pedido, pagamento e notificação evoluem separados. Uma compra não cabe numa transação única entre todos os bancos. A coordenação dessa compra fica na [ADR 0002](0002-saga-orquestrada-kafka.md), por compensação.
