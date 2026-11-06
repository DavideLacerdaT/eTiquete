# eTiquete

Este sistema está sendo desenvolvido como projeto final da disciplina de Engenharia de Sistemas Distribuídos. O E-Tiquete é uma plataforma de venda e reserva de ingressos baseada em uma arquitetura de microsserviços, com foco em confiabilidade, concorrência e desempenho.

## Sobre o projeto

O eTiquete busca evitar problemas comuns em vendas de ingressos de alta demanda, como venda duplicada de assentos, cobranças em duplicidade e reservas abandonadas.

A plataforma permite consultar eventos, selecionar e reservar assentos temporariamente, realizar pagamentos simulados e acompanhar a confirmação da compra. Também conta com um mecanismo de fila de espera e controle de admissão ao checkout, limitando a quantidade de usuários que acessam simultaneamente o processo de compra.

Em caso de falha no pagamento ou expiração da reserva, o sistema executa ações compensatórias para liberar os assentos e, quando necessário, estornar pagamentos.

**Serviços e componentes:** Aplicação Web, API Gateway, Admissão, Catálogo de Eventos, Reserva de Assentos, Pedidos (orquestrador da SAGA), Pagamento Simulado, Notificações, Redis e Barramento de Mensagens.

## Objetivos

- Evitar a venda duplicada de assentos.
- Garantir a idempotência das operações de pagamento.
- Liberar reservas expiradas automaticamente.
- Controlar o acesso simultâneo ao checkout por meio de fila de espera.
- Manter a disponibilidade dos serviços diante de falhas.
- Monitorar o desempenho sob alta concorrência.
- Garantir a entrega confiável de eventos entre os serviços.

## Tecnologias

| Tecnologia | Descrição |
|---|---|
| Node.js + React | Desenvolvimento dos microsserviços e da interface web. |
| PostgreSQL | Banco de dados relacional, com persistência exclusiva por serviço. |
| Redis | Cache do catálogo e gerenciamento de tokens temporários da fila de espera. |
| RabbitMQ | Barramento de mensagens para comunicação assíncrona entre os serviços. |
| Docker Compose | Execução e integração dos serviços e suas dependências em contêineres. |
| GitHub Actions | Automação de verificações, testes e builds. |
| Testcontainers | Execução de testes de integração com dependências reais em contêineres. |
| Prometheus | Coleta e armazenamento de métricas dos serviços. |
| Grafana | Dashboards e visualização de métricas para monitoramento. |

## Execução local

Para iniciar os contêineres e suas dependências:

```bash
docker compose up -d
```

Para interromper e remover os contêineres, preservando os volumes:

```bash
docker compose down
```

As configurações de execução e credenciais de desenvolvimento devem ser consultadas no arquivo `.env.example`.

## Padrões arquiteturais

O projeto adota os seguintes padrões para garantir a confiabilidade e a coordenação das operações distribuídas:

- **SAGA (orquestração):** coordenação das etapas da compra pelo serviço de Pedidos, com ações compensatórias em caso de falhas.
- **Transactional Outbox:** registro das alterações e mensagens a publicar na mesma transação do banco de dados.
- **Retry e DLQ:** novas tentativas de processamento e encaminhamento de mensagens não processadas para uma fila de mensagens não entregues.
- **Circuit Breaker:** interrupção temporária de chamadas a serviços com falhas recorrentes.
- **API Gateway:** ponto de entrada para as requisições dos clientes e encaminhamento aos serviços responsáveis.
- **Cache-Aside:** utilização de cache para reduzir consultas repetidas ao banco de dados.
- **Database-per-service:** isolamento dos dados, com banco ou esquema exclusivo para cada microsserviço.

## Status

Em desenvolvimento.

## GitHub Actions

O workflow [`deploy.yml`](.github/workflows/deploy.yml) atualmente apenas valida o Compose, constrói as imagens dos serviços e verifica a saúde da aplicação em um runner do GitHub Actions. Não há deploy automático para servidor neste momento.

As imagens construídas são as imagens locais dos serviços `frontend` e `backend`, definidos no [`docker-compose.yml`](docker-compose.yml). PostgreSQL, Kafka e Nginx utilizam imagens oficiais do Docker Hub.
