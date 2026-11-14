# Equipe

| Integrante | Parte | Responsabilidades | Entrega prática |
|---|---|---|---|
| Herick José de Freitas | Interface e API Gateway | Frontend React: navegação entre eventos, seleção de assentos, checkout e acompanhamento da compra. Gateway com roteamento e Circuit Breaker. | O cliente percorre o fluxo na interface e vê espera, sucesso, expiração e falhas. |
| Davi de Lacerda Teixeira | Catálogo, cache e admissão | Serviço de eventos, PostgreSQL do catálogo, Cache-Aside e Redis. Fila de espera, tokens temporários e limite de entrada no checkout. | Eventos consultados com cache, e controle de quantos usuários entram na compra ao mesmo tempo. |
| João Victor Fernandes da Silveira | Reservas e concorrência | Inventário de assentos, banco de reservas, aquisição atômica, confirmação, liberação e rotina de expiração. | Duas compras concorrentes não levam o mesmo assento, e a reserva abandonada é liberada. |
| Rafael de França Silva | Pedidos e coordenação distribuída | Serviço de Pedidos orquestra a SAGA no Kafka, com contratos de mensagens, retry, DLT e recuperação de pedidos incompletos. | A compra avança entre os serviços e executa compensações quando uma etapa falha. |
| Enilson Lima da Costa Júnior | Pagamentos e confirmações | Pagamento simulado com idempotência de cobrança e estorno, e serviço de Notificações com persistência das confirmações. | Repetir a solicitação não duplica a cobrança; a compra concluída recebe confirmação e o pagamento tardio pode ser estornado. |
