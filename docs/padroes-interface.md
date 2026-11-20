# Padrões de interface

Referência: dashboard anexado à tarefa, com fundo creme, navegação lateral preta, cartões em amarelo/rosa/verde/azul, agenda lateral e formas geométricas. A aplicação adapta essa linguagem para venda de ingressos.

## Fonte de verdade

`frontend/src/tokens.css` define a paleta e as constantes. `styles.css` define layout, breakpoints e estados. `ui.jsx` contém Badge, Dialog, ErrorNotice, Empty, Loading, Poster, Steps e Countdown. Não criar variações locais desses componentes sem necessidade de comportamento.

| Token | Valor | Uso |
|---|---|---|
| canvas | `#f7f3e8` | Fundo e superfícies principais |
| ink | `#171915` | Texto, navegação e botões principais |
| muted | `#696b60` | Texto secundário |
| pink | `#edb6d6` | Destaque editorial e seleção |
| yellow | `#f2d96b` | Ingressos, espera e atenção |
| green | `#b1bf83` | Descoberta, aprovação e conclusão |
| blue | `#b3c9e9` | Histórico e processamento |

## Composição e tipografia

- DM Sans hospedada no próprio bundle, sem chamada para fontes externas. Corpo base de 16 px, controles e rótulos regulares de 14 px ou mais; metadados secundários de 12–13 px.
- Título principal entre 30 e 42 px; peso 500; espaçamento levemente fechado. Evitar títulos longos em caixa alta.
- Espaçamento baseado em 4 px: 8, 12, 16, 20, 24 e 32. Cards com raio próximo de 18 px; botões de ação em formato de cápsula.
- Desktop: navegação fixa na composição, conteúdo principal e agenda lateral. Abaixo de 1150 px a agenda desce; abaixo de 800 px o menu vira painel acionável. Abaixo de 520 px os cartões ficam em uma coluna.
- Não usar números ou gráficos como métricas reais sem derivá-los dos dados. As barras decorativas são `aria-hidden`; o ambiente de demonstração é identificado no rodapé.

## Componentes e comportamento

- Um botão principal por etapa. Ações de navegação secundária usam texto ou contorno. Ícones Lucide com traço consistente.
- Cores não substituem rótulos: “Confirmado”, “Reservado”, “Estorno pendente”, “Cancelado”, “Expirado”.
- Mapa de assentos distingue disponível, escolhido e indisponível com texto acessível e `aria-pressed`. O backend decide disponibilidade; o mapa é informativo.
- Seleção limitada a dois lugares, inclusive em sessões diferentes. Exibir total calculado em centavos, nome do usuário, resumo e TTL.
- Repetir pagamento após timeout conserva a chave de idempotência. Erros mantêm o contexto da compra e oferecem ação compatível com o estado.
- Cancelamento exige revisão do usuário, mostra estorno pendente e só apresenta cancelado quando a SAGA concluir.
- Consultas têm loading, vazio, erro legível e tentativa de recuperação. Polling usa intervalo e limpeza ao desmontar a tela.

## Acessibilidade e aceite visual

- Foco visível, link para pular navegação, labels associados a campos, `aria-label` em botões de ícone e mensagens de erro com `role=alert`.
- Diálogo contém o foco, fecha com Escape e devolve foco ao acionador. Nenhum dado técnico deve dominar o fluxo do cliente.
- Verificar em 1440 px, 1024 px e 390 px: sem rolagem horizontal, textos cortados ou botões sobrepostos. Respeitar zoom e `prefers-reduced-motion`.
- Revisar manualmente teclado, mapa de assentos, contador, fila, cancelamento e telas vazias. Build aprovado não substitui revisão visual.
