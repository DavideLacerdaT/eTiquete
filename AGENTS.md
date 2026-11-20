# Regras de contribuição — eTiquete

Leia `docs/contratos-etiquete.md`, `docs/desenvolvimento.md` e `docs/padroes-interface.md` antes de alterar contratos ou telas.

## Integração obrigatória

- Todo microsserviço deve receber dependências por adaptadores. HTTP, Kafka e fixtures não entram diretamente nas regras de negócio.
- Cada dependência admite `mock` e `live`, selecionados no processo por `DATA_MODE` e `<SERVICE>_MODE`. Um serviço novo precisa dos dois adaptadores e dos mesmos contratos em ambos.
- Não substituir falha real por sucesso mockado. Retornar erro contratual, preservar correlação e manter idempotência em retries.
- Em execução híbrida com vários processos, todos usam o mesmo `MOCK_BASE_URL` e a mesma matriz de modos. O mock hub não aponta para si próprio.
- Frontend real acessa somente `/api/v1` no Gateway. Mock no navegador é um modo de desenvolvimento explícito.
- Não acessar banco ou objeto de estado de outro domínio. Chamadas síncronas usam HTTP; comandos reais da SAGA usam Kafka.
- Manter UUIDs, ISO UTC, camelCase, valores em centavos, máximo de dois ingressos, reserva antes do pedido e `sagaId = orderId`.
- Atualizar as fixtures estáticas em `mocks/contracts/` pelo comando `pnpm fixtures` e adicionar verificação de contrato quando houver mudança de comportamento.
- Simuladores em memória não são persistência de produção. Implementações reais precisam de transações, Inbox/Outbox, concorrência no banco, recuperação, retry/DLQ e autenticação.

## Interface

- Reutilizar `frontend/src/tokens.css` e os componentes de `frontend/src/ui.jsx`.
- Preservar a referência: fundo creme, navegação escura, cartões pastéis, cantos arredondados, tipografia DM Sans e ícones de traço.
- Texto em português; dinheiro em BRL; datas de exibição em America/Bahia. Estado nunca depende só de cor.
- Toda consulta precisa de carregamento, vazio, erro e recuperação. Toda ação assíncrona bloqueia envio duplicado.
- Respeitar teclado, foco visível, nomes acessíveis, diálogos com foco contido e telas pequenas.

## Verificação

Rodar `pnpm test` e `pnpm build`. Para alterações de infraestrutura, validar `docker compose config --quiet` e o arquivo de integração. Não afirmar validação visual ou Kafka real quando o ambiente não permitiu executá-los.
