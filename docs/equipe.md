# Equipe

| Integrante | Parte | Responsabilidades | Entrega prática |
|---|---|---|---|
| Herick José de Freitas | Interface e API Gateway | Frontend React: navegação entre eventos, seleção de assentos, checkout e acompanhamento da compra. Gateway com roteamento e Circuit Breaker. | O cliente percorre o fluxo na interface e vê espera, sucesso, expiração e falhas. |
| Davi de Lacerda Teixeira | Catálogo, cache e admissão | Serviço de eventos, PostgreSQL do catálogo, Cache-Aside e Redis. Fila de espera, tokens temporários e limite de entrada no checkout. | Eventos consultados com cache, e controle de quantos usuários entram na compra ao mesmo tempo. |
