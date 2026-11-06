# E-Tiquete

Este sistema será desenvolvido como projeto final da disciplina de Engenharia de Sistemas Distribuídos. O E-tiquete é uma plataforma de venda e reserva de ingressos desenvolvida com arquitetura de microsserviços, com foco em confiabilidade e desempenho.

## Sobre o projeto

O Etiquete busca evitar problemas comuns em vendas de ingressos de alta demanda, como venda duplicada de assentos, cobranças em duplicidade e reservas abandonadas. A plataforma permitirá consultar eventos, reservar assentos temporariamente, realizar pagamentos simulados e receber confirmações. Em caso de falha no pagamento ou expiração da reserva, o sistema deverá liberar o assento automaticamente.

**Serviços previstos:** API Gateway, Catálogo de Eventos, Reserva de Assentos, Pedidos (orquestrador da SAGA), Pagamento (simulado) e Notificações.

## Objetivos

- Evitar a venda duplicada de assentos.
- Garantir a idempotência das operações de pagamento.
- Liberar reservas expiradas automaticamente.
- Manter a disponibilidade dos serviços diante de falhas.
- Monitorar o desempenho sob alta concorrência.
- Garantir a entrega confiável de eventos entre os serviços.

## Tecnologias previstas

| Tecnologia | Descrição |
|---|---|
| NodeJS + React | Frameworks de aplicação para backend e frontend |
| PostgreSQL | Banco de dados relacional com transações ACID |
| Redis | Banco de dados em memória para cache e dados com expiração |
| Kafka | Message broker para eventos entre os serviços |
| Nginx | Gateway HTTP local na frente dos microsserviços |
| Docker Compose | Orquestração de contêineres para execução local |
| GitHub Actions | Plataforma de CI/CD integrada ao GitHub |
| Testcontainers | Biblioteca para subir dependências reais em contêineres nos testes |
| Prometheus | Sistema de coleta e armazenamento de métricas |
| Grafana | Plataforma de dashboards e visualização de métricas |

*A stack definitiva será confirmada durante o desenvolvimento do projeto.*

## Execução local e deploy

Sobe PostgreSQL, Kafka e Nginx:

```bash
docker compose up -d
```

Para e remove os containers. Os volumes permanecem, então os dados do PostgreSQL e do Kafka continuam na próxima subida:

```bash
docker compose down
```

| Serviço | Endereço no host | Entre contêineres |
|---|---|---|
| Nginx | http://localhost:8080 | — |
| Kafka | localhost:9092 | kafka:9092 |
| PostgreSQL | localhost:5432 | postgres:5432 |

`GET /health` no Nginx responde `{"status":"ok"}`. Na primeira subida, o PostgreSQL cria os bancos `catalog`, `reservation`, `orders`, `payment` e `notification`. Usuário e senha de desenvolvimento ficam em `.env.example` (padrão `etiquete` / `etiquete`).

### Deploy automático

O workflow [`deploy.yml`](.github/workflows/deploy.yml) valida o Compose, constrói as imagens, sobe a stack e verifica `GET /health` antes do deploy. Pushes em `main` e execuções manuais (`workflow_dispatch`) fazem o deploy no ambiente `production`; pull requests executam apenas a validação.

O servidor precisa ter Git, Docker com o plugin Compose, acesso de leitura ao repositório e uma cópia inicial do projeto em `/opt/etiquete` (ou no diretório definido por `SERVER_APP_DIR`). A cópia inicial pode ser preparada assim:

```bash
sudo mkdir -p /opt/etiquete
sudo chown "$USER:$USER" /opt/etiquete
git clone <url-do-repositorio> /opt/etiquete
cd /opt/etiquete
cp .env.example .env
docker compose up -d
```

Configure estes secrets no ambiente `production` do GitHub:

| Secret | Valor |
|---|---|
| `SERVER_HOST` | Hostname ou IP do servidor |
| `SERVER_USER` | Usuário SSH com permissão para executar Docker |
| `SERVER_SSH_KEY` | Chave privada Ed25519 usada pelo Actions |
| `SERVER_KNOWN_HOSTS` | Saída de `ssh-keyscan -H <host>` |
| `SERVER_APP_DIR` | Opcional; diretório do projeto, padrão `/opt/etiquete` |

Não coloque chaves, senhas ou o arquivo `.env` no repositório. Para conferir o serviço após o deploy, use `curl http://<host>:8080/health`.

## Padrões arquiteturais

Os seguintes padrões serão implementados para validar a proposta do projeto:

- SAGA (orquestração)
- Transactional Outbox
- Retry e DLQ
- Circuit Breaker
- Cache-Aside
- Database-per-service
- API Gateway

## Status

Em desenvolvimento.
