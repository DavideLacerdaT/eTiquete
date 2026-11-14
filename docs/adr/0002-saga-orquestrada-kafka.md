# ADR 0002 — SAGA orquestrada com Kafka

- **Status:** Aceito

## Contexto

A compra passa por reserva, pagamento e confirmação. Falha no pagamento ou reserva expirada precisa desfazer o que já ocorreu, sem transação distribuída entre os serviços. O isolamento dos dados está na [ADR 0001](0001-banco-exclusivo-por-servico.md).

## Alternativas descartadas

Transação distribuída entre os bancos. A compra atravessa os bancos exclusivos de cada serviço. Um commit distribuído prende a disponibilidade de todos à falha de um, e não desfaz reserva expirada nem cobrança já feita.

RabbitMQ, broker registrado no PDF da entrega 2. O repositório já fixou um broker só, o Kafka, no README e no Compose. Manter RabbitMQ deixaria o texto e a execução em desacordo.

## Decisão

O serviço de Pedidos orquestra a SAGA. O Kafka leva as mensagens entre pedidos, reservas, pagamento e notificações, com tópico durável, confirmação, retry e dead letter topic (DLT). Se uma etapa falha ou a reserva expira, o orquestrador pede a compensação: libera os assentos e, se o pagamento já ocorreu, estorna a cobrança.

## Consequências

O pedido incompleto se recupera por compensação. Retry trata falha passageira. A DLT guarda a mensagem que esgotou as tentativas.
