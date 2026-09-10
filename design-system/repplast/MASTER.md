# RepPlast — Papel & Tinta

> Sistema de design do produto. Substitui a direção anterior ("Aurora": violeta → ciano, vidro
> fosco, fundo animado), descartada porque era o visual padrão de IA — bonito de primeira, igual a
> todo painel gerado por modelo, e sem nenhuma relação com o negócio.

## A ideia

**O que este sistema produz é um documento impresso.** O pedido em PDF é o que a indústria recebe,
guarda e confere; é o artefato pelo qual o representante é julgado. Então a tela se parece com a
versão boa do papel que ela gera.

Disso decorre tudo o resto — e é o que impede a próxima decisão de virar palpite:

| Princípio | Consequência |
| --- | --- |
| Separa-se com **filete**, não com caixa | Sem cartão arredondado com sombra difusa. Traço de 1px, canto de 3px. |
| O **preto é a tinta principal** | O botão de ação primária é preto sólido, porque preto é a tinta do texto. |
| O **vermelho é carimbo** | Marca a aba ativa, o pedido enviado e o que é destrutivo. Nunca decora. |
| O **verde é a segunda tinta** | Existe só para a meta batida. |
| O **número é impresso** | Todo valor em dinheiro sai em serifada, com dígitos de largura fixa. |
| **Nada brilha** | Sem gradiente, sem vidro fosco, sem sombra colorida, sem fundo animado. |

## Cor

Tokens em `src/app/globals.css`. Claro é o estado natural; escuro é **tinta invertida quente** —
marrom-preto, não azul-preto, porque azul-preto é o padrão de todo painel escuro que existe.

| Papel | Claro | Escuro |
| --- | --- | --- |
| Fundo (a mesa) | `#faf8f3` | `#14110e` |
| Folha (o que está em cima) | `#fffdf9` | `#1d1915` |
| Filete | tinta a 13% | papel a 13% |

| Tinta | Claro | Escuro | Contraste mínimo medido |
| --- | --- | --- | --- |
| Texto | `#16130f` | `#f2ede4` | 17,4 : 1 |
| Texto secundário | `#57514a` | `#b0a79b` | 7,4 : 1 |
| Texto fraco (rótulos) | `#756c62` | `#948b7f` | 4,85 : 1 |
| **Carimbo** | `#c8341e` | `#e8563c` | 4,85 : 1 |
| Verde (meta) | `#1f6f4a` | `#4fb286` | 5,77 : 1 |
| Perigo | `#9a2010` | `#f26b50` | 6,27 : 1 |

Papel sobre o carimbo (texto da aba ativa) fica em **4,99 : 1** no claro e **5,22 : 1** no escuro.
Todos os pares passam de 4,5:1 nos dois temas.

**Carimbo cheio × contorno.** O vermelho aparece preenchido só onde significa "feito": a aba ativa
e o selo ENVIADO. Ação destrutiva usa o mesmo vermelho **em contorno**. Dois vermelhos sólidos com
sentidos opostos na mesma tela confundiriam.

## Tipografia

Três vozes, cada uma com um trabalho:

| Fonte | Papel |
| --- | --- |
| **Newsreader** (serifada) | Títulos e todos os números de dinheiro. É o gesto central. |
| **IBM Plex Sans** | Interface. Desenhada para uma empresa que fazia máquinas, e carrega isso. |
| **IBM Plex Mono** | Medida (`99x166x0,08`), COD.FORN, descrição gerada — dados conferidos caractere a caractere. |

`.cifra` aplica serifada + `tabular-nums` + `lining-nums`. `.rotulo` é caixa alta espaçada, como
legenda de formulário.

## Movimento

O movimento aqui tem que **significar** alguma coisa. Nada se move por enfeite.

| Efeito | O que comunica |
| --- | --- |
| Marcador da aba **desliza** de um item ao outro | "Você saiu daqui e foi para ali" |
| Conteúdo entra pelo **lado** | Direção segue a ORDEM da barra: item mais à direita empurra o conteúdo para a esquerda |
| Barra do topo **fica parada** | O ponto fixo que diz que quem se moveu foi o conteúdo |
| Barra da meta cresce de zero | Mostra o progresso acontecendo, não só o resultado |
| Valor conta até o total | O número "chega" |
| Cascata curta na entrada | Dá ordem de leitura |

Implementado com a **View Transitions API** via `<ViewTransition>` do React — sem biblioteca de
animação. Detalhes em `src/components/pagina.tsx` e `src/components/navegacao.tsx`.

Quem pede `prefers-reduced-motion` recebe o **estado final**, não o inicial, e o deslize lateral
some inteiro — é o efeito de maior risco para sensibilidade a movimento.

## Checklist antes de entregar tela

- [x] Nenhum gradiente, vidro fosco ou sombra colorida
- [x] Vermelho só onde significa carimbo, aba ativa ou perigo
- [x] Valor em dinheiro em serifada com dígito tabular
- [x] Contraste de 4,5:1 nos dois temas
- [x] Foco visível pelo teclado
- [x] `prefers-reduced-motion` respeitado
- [x] Verificado em 375px, 768px, 1280px e 1440px
- [x] Sem rolagem horizontal na página (tabelas rolam no próprio contêiner)

## O que a consultoria de UI recomendou, e o que foi feito

A skill `ui-ux-pro-max` foi consultada nas duas rodadas. Da segunda saíram três direções ancoradas
no domínio — Papel & Tinta, Chão de Fábrica e Livro-Caixa —, e o usuário escolheu a primeira.

Recomendações **adotadas**: perfil "Editorial Grid / Magazine" (grade assimétrica, tipografia de
impresso, filete entre seções); ícones SVG de um só conjunto, nunca emoji; contraste de 4,5:1;
`prefers-reduced-motion`.

Recomendações **recusadas**: as paletas de catálogo (azul-confiança + laranja, cinza industrial +
laranja de segurança) — nenhuma delas dizia nada sobre um sistema cujo produto final é um
documento; e o padrão de página "Hero + Features + CTA", que é estrutura de página de venda, não de
aplicativo onde quem entra já é assinante.
