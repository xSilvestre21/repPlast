# RepPlast — Luz & Superfície

> Substitui a direção anterior ("Papel & Tinta": filete de 1px, canto de 3px, serifada nos números,
> vermelho de carimbo), trocada no commit `054f29b`. Antes dela houve "Aurora" (violeta → ciano,
> vidro fosco, fundo animado), descartada por ser o visual padrão de IA.
>
> **Este documento esteve desatualizado por toda a fase de prepostos/orçamentos** — descrevia Papel
> & Tinta enquanto o código já era Luz & Superfície. Metade das inconsistências visuais que
> apareceram naquele período nasceu daí: telas novas escritas contra um documento falso.

## A ideia

Papel & Tinta partia de uma premissa verdadeira com uma conclusão que não segue: *o que o sistema
produz é um documento impresso, então a tela deveria se parecer com ele*. O PDF continua sendo
papel — mas quem olha a **tela** é o representante, doze vezes por dia, num celular dentro do
carro. Para ele o sistema não é um documento: é um aplicativo.

Então a tela é aplicativo. Fundo quase branco, um campo de luz difuso no topo, e cartões que
flutuam sobre ele.

| Princípio | Consequência |
| --- | --- |
| **A sombra separa, não a borda** | O cartão não é desenhado por um filete: ele é *levantado* do fundo. Canto de 16px. |
| **Dois brancos, nunca um** | A página é `#fbfbfc` (cinza frio) para o `#ffffff` do cartão ter de onde se destacar. |
| **Uma ação principal por tela** | Pílula preta. Preto é a tinta do texto, e por isso é a ação, não uma cor de marca. |
| **O azul é o interativo** | Link, foco, campo ativo, aba. Nunca decora. |
| **O amarelo é marca-texto** | Um destaque por tela, nunca dois. |
| **O número é conferido** | Todo valor em dinheiro sai com dígito de largura fixa (`.cifra` / `.numerico`). |
| **A cor da placa não quer dizer nada** | Exceção deliberada: as placas de ícone existem para o olho separar um item do seguinte numa fila. |

## Cor

Tokens em `src/app/globals.css`. Claro é o estado natural. O escuro **não é o claro invertido** —
é uma paleta própria, com o azul clareado para sobreviver ao fundo.

Três camadas, nesta ordem (`globals.css:33`, `:103`, `:159`): `:root` define o claro;
`@media (prefers-color-scheme: dark) :root:not([data-tema="claro"])` segue o sistema;
`:root[data-tema="escuro"]` é a escolha explícita e vence as duas.

| Vaga | Papel | Claro | Escuro |
| --- | --- | --- | --- |
| Fundo da página | `--papel` | `#fbfbfc` | `#0b0b0f` |
| Superfície (cartão) | `--folha` | `#ffffff` | `#15151b` |
| Preenchimento interno | `--folha-2` | `#f4f4f7` | `#1d1d25` |
| Borda de cabelo | `--filete` | tinta a 7% | papel a 8% |
| Borda forte | `--filete-forte` | tinta a 15% | papel a 18% |

| Tinta | Vaga | Claro | Escuro |
| --- | --- | --- | --- |
| Texto | `--tinta` | `#111117` | `#f4f4f7` |
| Texto secundário | `--tinta-2` | `#5a5a68` | `#a3a3b4` |
| Texto fraco (rótulos) | `--tinta-3` | `#8d8d9c` | `#78788a` |
| **Interativo** | `--carimbo` | `#2f6fed` | `#6b9dff` |
| Alcançado | `--verde` | `#0f9d70` | `#32c48f` |
| Erro e perda | `--perigo` | `#e0484d` | `#ff6b6f` |
| Marca-texto | `--destaque` | `#fcf08f` | `#f2dd6e` |

Cada cor semântica tem um par `-fraco` para preenchimento lavado. **Não existe token de alerta** —
a paleta é de três estados, e o amarelo é marca-texto, não aviso.

**Cor nunca sozinha.** Todo estado que a cor comunica leva também ícone ou palavra: o selo diz
"ENVIADO", o erro leva texto, a meta batida leva o número.

**Nada de hex literal em `.tsx`.** Uma cor escrita à mão fica no tema claro para sempre; quem olha
no escuro vê a cor errada sobre o fundo errado. Se um valor precisa ir para um `style` inline, vai
como `var(--token)`.

## Sombra, raio e superfície

| Token | Uso |
| --- | --- |
| `--sombra-sm` | botão secundário, pastilha ativa de controle segmentado |
| `--sombra` | cartão em repouso (`.folha`) |
| `--sombra-alta` | cartão em hover (`.elevavel`), cartão-herói (`.folha-marcada`) |
| `--radius-suave` 10px | campo de formulário, caixa de lista interna |
| `--radius-folha` 16px | cartão |
| `--radius-grande` 24px | cartão-herói |

**Banidos:** `rounded-md`, `rounded`, `rounded-[3px]` e qualquer `shadow-[...]` arbitrário — são
restos de Papel & Tinta. Pílula (`rounded-full`) continua para botão, selo e chip.

A única superfície de vidro do sistema é a **barra do topo** (`globals.css:338`), e é onde faz
sentido: ela fica parada enquanto o conteúdo passa por baixo. Vidro sobre tabela densa custa
legibilidade e não entra.

## Tipografia

Duas famílias, três vagas:

| Fonte | Papel |
| --- | --- |
| **Plus Jakarta Sans** | Tudo: interface, títulos e **números**. É uma geométrica com contador aberto, que segura bem tanto rótulo pequeno quanto cifra grande. |
| **IBM Plex Mono** | Só o que é código: a medida (`99x166x0,08`), `COD.FORN`, descrição gerada — dado conferido caractere a caractere. |

`--font-serif` aponta para a mesma geométrica **de propósito**, para não quebrar as telas herdadas.
Escrever `font-serif` em código novo é um resto de Papel & Tinta e não deve acontecer.

### A escala

Dez degraus, nomeados pelo papel que cumprem. **Nenhum `text-[...]` arbitrário novo.**

| Token | Tamanho | Onde |
| --- | --- | --- |
| `--text-micro` | 0.6875rem | iniciais de avatar, código curto |
| `--text-mini` | 0.75rem | selo, chip, dica de campo |
| `--text-rotulo` | 0.8125rem | rótulo de campo, detalhe de métrica |
| `--text-corpo` | 0.875rem | corpo padrão, célula de tabela |
| `--text-realce` | 0.9375rem | título de seção, descrição de página |
| `--text-medio` | 1.125rem | número pequeno em linha |
| `--text-forte` | 1.5rem | número de cartão |
| `--text-cifra` | 2rem | número de métrica |
| `--text-titulo` | 2.5rem | h1 de página |
| `--text-heroi` | 4rem | número herói do painel |

Classes utilitárias: `.cifra` (peso 700 + `tabular-nums` + `lining-nums`), `.numerico` (só os
dígitos tabulares, para empilhar em tabela), `.rotulo` (13px, peso 500, `--tinta-3`),
`.marcador` (o marca-texto amarelo).

## Espaçamento — um valor por papel

O problema nunca foi a escala, foi a disciplina: cada tela digitou a sua. Esta tabela é o gabarito.

| Papel | Valor |
| --- | --- |
| Rótulo → campo | `mb-1.5` |
| Entre campos de uma grade | `gap-4` |
| Entre seções da página | `space-y-5` |
| Formulário que **é** a página (empilha cartões) | `space-y-5` |
| Formulário **dentro** de um cartão | `space-y-4` |
| Dentro de cartão de seção | `p-5 sm:p-6` |
| Cartão-herói (`marcada`) | `p-6 sm:p-8` |
| Linha de lista | `px-4 py-3.5` |
| Cabeçalho de página → corpo | `mb-7` |
| Título de seção → conteúdo | `mb-5` |
| Célula de tabela | `px-3 py-2.5` |
| Rodapé de formulário | `flex justify-end`, primário por último |

**Banidos por não terem papel:** `gap-2.5`, `gap-3.5`, `gap-6`, `gap-9`, `p-4 sm:p-5`,
`p-5 sm:p-7`, `mb-3.5`.

**Breakpoints.** Campo de formulário é estreito e cabe cedo: grade de campos nasce em `sm:` com
duas colunas e completa em `lg:`. **Cartão com número grande, não** — `FaixaMetricas` de três vai
`sm:`2 → `md:`3, porque a 640px três cifras lado a lado ficam com 150px cada e a vírgula quebra
para a linha de baixo. O `md:` existia zero vezes no projeto antes disto.

## Alinhamento

A regra que mais apareceu como "desalinhado":

- **Número vai à direita, sempre**, com `.numerico`. Vale para dinheiro, quantidade e contagem —
  inclusive o "3 pedido(s)" que parece texto e é número.
- **Toda lista tem o mesmo contrato de coluna**: identificador à esquerda, descrição no meio com
  `flex-1`, valor à direita com largura fixa. Clientes, Produtos, Pedidos, Orçamentos e
  Fornecedores precisam cair na mesma posição.
- **Tabela rola no próprio contêiner** (`overflow-x-auto`), nunca a página.

## Movimento

O movimento tem que **significar** alguma coisa. Nada se move por enfeite.

| Efeito | O que comunica |
| --- | --- |
| Marcador da aba **desliza** de um item ao outro | "Você saiu daqui e foi para ali" |
| Conteúdo entra pelo **lado** | Direção segue a ORDEM da barra |
| Barra do topo **fica parada** | O ponto fixo que diz que quem se moveu foi o conteúdo |
| Barra da meta cresce de zero | Mostra o progresso acontecendo, não só o resultado |
| Valor conta até o total | O número "chega" |
| Cascata curta na entrada (`.palco`) | Dá ordem de leitura — e vale para **todas** as páginas de detalhe, não metade |

Implementado com a **View Transitions API** via `<ViewTransition>` do React — sem biblioteca de
animação. Detalhes em `src/components/pagina.tsx` e `src/components/navegacao.tsx`.

Quem pede `prefers-reduced-motion` recebe o **estado final**, não o inicial (`globals.css:862-902`),
e o deslize lateral some inteiro — é o efeito de maior risco para sensibilidade a movimento.

## Checklist antes de entregar tela

- [ ] Nenhum hex literal em `.tsx`; cor inline só como `var(--token)`
- [ ] Nenhum `rounded-md` / `rounded` / `rounded-[3px]` / `font-serif` / `bg-fundo` / `-acento`
- [ ] Tamanho de texto vem da escala; espaçamento vem da tabela de papéis
- [ ] Todo número à direita e com `.numerico`
- [ ] Componente compartilhado em vez de markup próprio (selo, botão de texto, estado vazio, lista)
- [ ] Contraste de 4,5:1 nos dois temas
- [ ] Foco visível pelo teclado, e `cursor-pointer` em tudo que clica
- [ ] `prefers-reduced-motion` respeitado
- [ ] Verificado em 375px, 768px, 1024px e 1440px, nos dois temas
- [ ] Sem rolagem horizontal da página

## O que a consultoria de UI recomendou, e o que foi feito

A skill `ui-ux-pro-max` foi consultada em três rodadas.

**Rodadas 1 e 2 (Aurora → Papel & Tinta).** Da segunda saíram três direções ancoradas no domínio —
Papel & Tinta, Chão de Fábrica e Livro-Caixa —, e o usuário escolheu a primeira. Adotado: perfil
"Editorial Grid / Magazine", ícones SVG de um só conjunto (nunca emoji), contraste de 4,5:1,
`prefers-reduced-motion`. Recusado: as paletas de catálogo e o padrão "Hero + Features + CTA".

**Rodada 3 (terminar Luz & Superfície).** A consulta para "B2B sales dashboard" devolveu padrão
**Hero + Features + CTA**, estilo **Glassmorphism**, paleta **azul `#2563EB` + laranja** e
tipografia **Plus Jakarta Sans**.

- **Recusado** o padrão de página: é estrutura de página de venda; aqui quem entra já é assinante.
- **Recusado** glassmorphism como estilo geral, pela razão da seção "Sombra, raio e superfície".
- **Já atendido:** a tipografia recomendada é a que o projeto usa, e `#2f6fed` é o mesmo azul de
  confiança do `#2563EB` sugerido. Não faltava paleta — faltava usar a que existe, inteira.
- **Adotado** da lista de pré-entrega: contraste nos dois temas, foco visível, `cursor-pointer`,
  `prefers-reduced-motion`, conferência em 375/768/1024/1440.

A referência visual trazida pelo usuário nesta rodada (Outcrowd, *Website Design for AI Platform*)
entrou como **acabamento, não como paleta**: grade bento no painel, alinhamento milimétrico,
escala tipográfica explícita e micro-detalhe.
