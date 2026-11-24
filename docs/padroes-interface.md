# Padrões de interface

Referência: dashboard anexado à tarefa, com fundo creme, navegação lateral preta, cartões em amarelo/rosa/verde/azul, agenda lateral e formas geométricas. A aplicação adapta essa linguagem para venda de ingressos.

## Fonte de verdade

`frontend/src/tokens.css` define a paleta e as constantes. `styles.css` importa os arquivos de `styles/` na ordem da cascata: base, layout, dashboard, componentes, pôsteres, agenda, listas, feedback, diálogos, checkout, laboratório, barras de rolagem e responsividade. `ui.jsx` contém Badge, Dialog, ErrorNotice, Empty, Loading, Poster, Steps e Countdown. Não criar variações locais desses componentes sem necessidade de comportamento.

Edite uma área no arquivo CSS correspondente e mantenha uma linha em branco entre regras. JSX deve ficar aberto em várias linhas, com separação entre seções. O estado e as chamadas do checkout ficam em `hooks/useCheckout.js`; seus componentes visuais ficam em `components/checkout/`.

`components/layout/BaseLayout.jsx` concentra a composição comum e apresenta as rotas pelo `Outlet`. Links de navegação usam `Link`/`NavLink`; botões executam ações. Rotas e parâmetros ficam em `routes/`, e chamadas passam pelos clientes de `services/`. Consulte [o mapa de telas e endpoints](frontend-gateway.md). A busca do catálogo permanece na URL; navegações por teclado e voltar devem preservar esse contexto.

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
- Título principal entre 24 e 32 px; peso 500; espaçamento levemente fechado. Usar o nome da área e, quando necessário, uma frase curta de orientação. Não repetir título, chamada promocional e subtítulo com o mesmo significado.
- Espaçamento baseado em 4 px: 8, 12, 16, 20, 24 e 32. Cards com raio próximo de 18 px; botões de ação em formato de cápsula.
- A moldura tem a mesma largura em todas as rotas: até 1536 px, com 16 px de margem lateral. Não calcular a largura pelo conteúdo de uma aba. A área rolável reserva o espaço da barra vertical com `scrollbar-gutter: stable`.
- Barras de rolagem usam `styles/scrollbars.css` e tokens `--scrollbar-*`: trilho transparente, alça arredondada e verde sálvia translúcido, com variante clara sobre fundos escuros. Chromium/WebKit usam 6 px de largura total e 4 px visíveis; outros navegadores usam a espessura nativa `thin`. Hover e arraste intensificam a cor, sem engrossar a barra ou deslocar o conteúdo. Alto contraste mantém a aparência do sistema. Não ocultar a rolagem nem criar barras por JavaScript.
- Evitar rolagem horizontal causada pelo conteúdo: colunas flexíveis usam `minmax(0, 1fr)`, itens podem encolher com `min-width: 0` e textos longos quebram dentro do componente. Na agenda, horário e ícone mantêm seu espaço e o título ocupa a largura restante. Recortes decorativos ficam contidos no próprio cartão; não esconder conteúdo da página para disfarçar excesso de largura. Blocos de código como `.json-view` podem rolar nos dois eixos para preservar a formatação.
- Menu e busca ficam fora de `.content-scroll`. O painel usa a altura disponível (`100dvh`), e conteúdo e rodapé rolam juntos. A navegação possui rolagem própria quando sua altura não comporta os controles; não ocultar recursos para fazê-los caber.
- Acima de 1150 px, a agenda fica aderente ao topo da área de conteúdo, com altura limitada e rolagem própria. Abaixo disso ela entra no fluxo da página. Abaixo de 800 px, o menu vira um painel sobreposto com botão de fechar, fundo inerte, Escape e foco contido.
- Abaixo de 720 px de altura no desktop, reduzir margens, espaçamentos decorativos e tamanho dos KPIs. Abaixo de 520 px de largura, usar duas colunas para os dois primeiros KPIs e uma linha para o histórico; cartões de eventos ficam em uma coluna.
- Não usar números ou gráficos como métricas reais sem derivá-los dos dados. As barras decorativas são `aria-hidden`; o ambiente de demonstração é identificado no rodapé.

## Componentes e comportamento

- Um botão principal por etapa. Ações de navegação secundária usam texto ou contorno. Ícones Lucide com traço consistente.
- KPIs são links completos, acionáveis por teclado: ingressos confirmados → `/ingressos?status=confirmed`; eventos → `/eventos`; pedidos → `/ingressos`. O número e o título descrevem a coleção de destino. Os filtros de ingressos permanecem na URL e no histórico de navegação.
- Campos usam a mesma borda, raio, altura e padding com e sem foco. O foco altera apenas o contorno externo, sem deslocar o conteúdo. Na busca composta, o contorno pertence a `.search-wrap:focus-within`; o input interno não cria um segundo contorno retangular.
- Regras de campos de texto não se aplicam a radios e checkboxes. Inputs mantêm fonte de 16 px, inclusive em telas pequenas. O foco na navegação escura usa o tom claro da paleta.
- Diálogos mantêm título e botão de fechar fora da área rolável `.dialog-body`. Ações no final do conteúdo continuam alcançáveis por rolagem e teclado. Não sobrepor barras fixas ao elemento focado.
- Usar rótulos diretos: “Eventos”, “Notificações”, “Ver evento”, “Resumo da compra”. Preservar instruções essenciais sobre limite de ingressos, prazo da reserva, pagamento e cancelamento.
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

## Referências de UX e aplicação

- [W3C — Reflow, WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow): reorganizar conteúdo em larguras pequenas e com zoom, evitando rolagem horizontal para leitura. A grade muda de composição e a navegação é recolhida em telas estreitas.
- [W3C — Focus Not Obscured, WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum): manter o elemento focado visível. Menu, busca e cabeçalho do diálogo ocupam áreas próprias, sem cobrir o conteúdo rolável.
- [GOV.UK Design System — Focus states](https://design-system.service.gov.uk/get-started/focus-states/): aplicar indicação clara e consistente aos componentes focados. Aqui o contorno acompanha o campo e respeita a paleta existente.
- [Nielsen Norman Group — Concise, Scannable, and Objective](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/): favorecer linguagem objetiva e fácil de percorrer. Títulos e chamadas foram reduzidos, mantendo informações necessárias para concluir a tarefa.

As medidas e os breakpoints são decisões deste projeto, não exigências dessas referências. Testes com DOM simulado verificam destinos dos KPIs, filtros, foco e fechamento do menu; não certificam conformidade WCAG nem geometria visual. A revisão em navegador deve incluir 1440×900, 1366×600, 1024×600, 390×844 e 320×568, além de zoom de 200%: conferir largura entre abas, foco dos campos, rolagem até o último recurso e acesso ao botão de fechar.
