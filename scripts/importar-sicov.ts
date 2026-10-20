/**
 * Importa o backup do SICOV para dentro de um escritório do RepPlast.
 *
 * COMO RODAR
 *
 *   npm run db:importar -- --escritorio "Vera & Assis"            # ensaio
 *   npm run db:importar -- --escritorio "Vera & Assis" --gravar
 *
 * Opções: --pular a@b.com,c@d.com   não inscreve esses como preposto
 *         --arquivo caminho.json.gz  outro backup
 *         --forcar                   importa mesmo com o escritório já povoado
 *         --substituir               APAGA o escritório (menos o admin) e importa
 *                                    por cima, na mesma transação
 *         --conferir                 só compara o que está gravado com o backup
 *                                    (repita o --pular da importação)
 *
 * O `--substituir` guarda o logo de cada indústria (o backup só tem o caminho
 * de um arquivo do sistema antigo) e devolve-o à indústria de mesmo nome. A
 * limpeza mora na transação da importação: no ensaio ela também é desfeita, e
 * se a importação falhar nada terá sido apagado.
 *
 * No fim, a importação é CONFERIDA contra o backup dentro da mesma transação —
 * valores, status, comissão, parcelas, vínculos. Uma divergência aborta tudo.
 *
 * O ENSAIO NÃO É SIMULAÇÃO. Ele executa a importação inteira de verdade —
 * passando por RLS, CHECKs, chaves únicas e triggers — e no fim desfaz tudo
 * com um ROLLBACK. Um ensaio que passa é a prova de que a gravação passa; um
 * ensaio que falha teria falhado igual valendo.
 *
 * Tudo roda em UMA transação e sob o PAPEL RESTRITO, com o contexto de tenant
 * ligado. Não é preciosismo: importar como dono do banco esconderia qualquer
 * policy mal escrita, e o dia de descobrir isso seria o primeiro dia de uso.
 */

/*
 * O `any` é honesto aqui: a entrada é um JSON de outro sistema, sem contrato
 * nenhum do nosso lado. Tipar o backup do SICOV seria inventar garantias que o
 * arquivo não dá — o que garante é a validação campo a campo abaixo, e o banco,
 * que recusa o que não couber.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import "dotenv/config";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { readFile } from "node:fs/promises";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import Decimal from "decimal.js";

import { PrismaClient } from "../src/generated/prisma/client";

const scrypt = promisify(scryptCb) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number },
) => Promise<Buffer>;

/* -------------------------------------------------------------------------- */
/* Argumentos                                                                 */
/* -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const arg = (nome: string): string | null => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 ? argv[i + 1] : null;
};
const tem = (nome: string) => argv.includes(`--${nome}`);

const NOME_ESCRITORIO = arg("escritorio");
const ARQUIVO = arg("arquivo") ?? "referencia/sicov-backup-2026-10-19-08h54.json.gz";
const GRAVAR = tem("gravar");
const SUBSTITUIR = tem("substituir");
const SO_CONFERIR = tem("conferir");

if (SO_CONFERIR && (GRAVAR || SUBSTITUIR)) {
  console.error("\n--conferir só lê: não combina com --gravar nem com --substituir.\n");
  process.exit(1);
}

/**
 * E-mails que NÃO devem virar preposto, separados por vírgula.
 *
 * Existe para a decisão ficar escrita: sem isto, quem não entrou teria como
 * único motivo registrado "o e-mail já estava em uso" — que é um acidente, e
 * não a escolha de quem pediu a importação.
 */
const SEM_PREPOSTO = new Set(
  (arg("pular") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);

if (!NOME_ESCRITORIO) {
  console.error(
    "\nInforme o escritório de destino:\n" +
      '  node scripts/importar-sicov.mjs --escritorio "Vera & Assis"\n',
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* Leitura do backup                                                          */
/* -------------------------------------------------------------------------- */

async function lerBackup(caminho: string): Promise<any> {
  if (!caminho.endsWith(".gz")) return JSON.parse(await readFile(caminho, "utf8"));

  const pedacos: Buffer[] = [];
  const fluxo = createReadStream(caminho).pipe(createGunzip());

  for await (const pedaco of fluxo) pedacos.push(pedaco);
  return JSON.parse(Buffer.concat(pedacos).toString("utf8"));
}

/* -------------------------------------------------------------------------- */
/* Conversões                                                                 */
/* -------------------------------------------------------------------------- */

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Mesma máscara da aplicação — ver src/lib/mascara.ts. */
function documento(valor: any) {
  const d = digitos(valor);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return valor?.trim() || null;
}

function cep(valor: any) {
  const d = digitos(valor);
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, "$1-$2") : valor?.trim() || null;
}

function telefone(valor: any) {
  const d = digitos(valor);
  if (d.startsWith("0") || (d.length !== 10 && d.length !== 11)) return valor?.trim() || null;

  const prefixo = d.length > 10 ? 5 : 4;
  return `(${d.slice(0, 2)}) ${d.slice(2, 2 + prefixo)}-${d.slice(2 + prefixo)}`;
}

const texto = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
};

const numero = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

const data = (v: unknown) => (v ? new Date(v as string) : null);

/**
 * "Iara Celina Rocha" → nome "Iara", sobrenome "Celina Rocha".
 *
 * A mesma regra da migration `usuario_sobrenome_telefone`, que separou os
 * nomes que já existiam: a primeira palavra é o nome, o resto o sobrenome.
 */
function separarNome(completo: string): { nome: string; sobrenome: string | null } {
  const limpo = completo.trim().replace(/\s+/g, " ");
  const espaco = limpo.indexOf(" ");
  if (espaco < 0) return { nome: limpo, sobrenome: null };
  return { nome: limpo.slice(0, espaco), sobrenome: limpo.slice(espaco + 1) };
}

/**
 * As observações do cliente, com o que o SICOV guardava em campo próprio e
 * aqui não tem coluna: a transportadora de costume e o endereço de cobrança.
 * Ficam escritos, onde quem lança o pedido lê, em vez de sumir.
 */
function observacoesDoCliente(c: any): string | null {
  const partes = [
    texto(c.notes),
    texto(c.carrier) && `Transportadora: ${texto(c.carrier)}`,
    texto(c.billingAddress) && `Endereço de cobrança: ${texto(c.billingAddress)}`,
  ].filter(Boolean);
  return partes.length ? partes.join("\n") : null;
}

/** Hash de senha no mesmo formato de src/lib/senha.ts. */
async function gerarHashSenha(senha: string) {
  const N = 16384, r = 8, p = 1;
  const sal = randomBytes(16);
  const derivada = await scrypt(senha.normalize("NFKC"), sal, 64, { N, r, p });

  return `scrypt$${N}$${r}$${p}$${sal.toString("base64")}$${derivada.toString("base64")}`;
}

/**
 * O percentual que cada indústria costuma pagar, tirado das comissões dela.
 *
 * O fornecedor do SICOV não tem campo de comissão — o percentual nasce em cada
 * comissão (`adminPercentage`), a partir de `DEFAULT_ADMIN_PERCENTAGE = 5`
 * (`orderController.js:11`). A moda é a leitura honesta do "padrão da casa":
 * a ALFAPLAST pagou 5% em 149 pedidos e 3% em 14 — quem lança o próximo espera
 * ver 5. Empate resolve pelo maior, que é o que menos surpreende quem confere.
 */
function modaDoPercentualPorFornecedor(sicov: any): Map<string, number> {
  const pedidoPorId = new Map(sicov.orders.map((o: any) => [String(o._id), o]));
  const contagem = new Map<string, Map<number, number>>();

  for (const c of sicov.commissions as any[]) {
    const pedido = pedidoPorId.get(String(c.orderId)) as any;
    const percentual = Number(c?.adminPercentage);
    if (!pedido || !Number.isFinite(percentual)) continue;

    const fornecedor = String(pedido.supplierId);
    if (!contagem.has(fornecedor)) contagem.set(fornecedor, new Map());
    const porPercentual = contagem.get(fornecedor)!;
    porPercentual.set(percentual, (porPercentual.get(percentual) ?? 0) + 1);
  }

  const moda = new Map<string, number>();
  for (const [fornecedor, porPercentual] of contagem) {
    const [melhor] = [...porPercentual.entries()].sort(
      (a, b) => b[1] - a[1] || b[0] - a[0],
    );
    moda.set(fornecedor, melhor[0]);
  }

  return moda;
}

/**
 * Peso da linha do pedido, em quilo.
 *
 * O SICOV não guardava peso em lugar nenhum — ele o recalculava quando
 * precisava. Aqui a coluna existe (`Pedido.pesoTotalKg`, "usado nas metas
 * medidas em quilo") e a importação nunca a escrevia: os 193 pedidos ficaram
 * com 0,000, e qualquer conta em quilo lia zero sem dizer por quê.
 *
 * A conta sai do SNAPSHOT do produto gravado no item, não do produto de hoje:
 * é o peso de quando o pedido foi feito, igual a todo o resto da linha.
 */
function pesoDoItemImportado(snap: any, unidade: string, quantidade: number): number {
  if (unidade === "KG") return quantidade;

  const m = snap?.technicalData?.measurements ?? {};
  const densidade = snap?.commercialData?.density;

  if (unidade !== "MIL" || !m.width || !m.length || !m.thickness || !densidade) return 0;

  // O mesmo `L × C × E × densidade` de `pesoMilheiroKg`, que dá o peso do milheiro.
  return m.width * m.length * m.thickness * densidade * quantidade;
}

/**
 * Família do produto.
 *
 * O modo de cálculo manda na maioria dos casos, mas não sozinho — e foi ele
 * sozinho que produziu o pior estrago da primeira importação.
 *
 * `weight_times_price_per_kg` quer dizer só "é cobrado por quilo", e isso vale
 * tanto para o filme em bobina quanto para o SACO vendido a peso. Mandando os
 * dois para STRETCH, 26 sacos perderam comprimento, sanfona, fator e densidade
 * — e apareciam na lista como "Stretch · R$ 21,00 por kg" onde eram saco por
 * milheiro. O que distingue os dois é concreto: o saco tem as três medidas e
 * um fator kg; o filme não tem medida nenhuma.
 *
 * Os 18 filmes shrink do acervo entram como STRETCH com razão: não têm largura,
 * comprimento nem espessura, e o preço deles é mesmo o quilo.
 */
function familiaDoProduto(p: any) {
  const m = p.technicalData?.measurements ?? {};
  const c = p.commercialData ?? {};
  const temCorpoDeSaco = Boolean(m.width && m.length && m.thickness && c.factorKg);

  switch (p.calculationMode) {
    case "dimensions_density_factor":
      return "SACO";
    case "boxes_times_units_per_box_times_unit_price":
      return "FITA";
    case "weight_times_price_per_kg":
      if (temCorpoDeSaco && (p.productType === "plastic_bag" || p.productType === "shrink"))
        return "SACO";
      return p.productType === "bobbin" ? "BOBINA" : "STRETCH";
    default:
      // manual_price, quantity_times_unit_price, boxes_times_box_price:
      // todos são "o preço é digitado".
      return "AVULSO";
  }
}

/**
 * A sanfona e o complemento, lidos do NOME do produto.
 *
 * O SICOV guardava a sanfona como número e montava o nome com o texto que a
 * pessoa digitou — e os dois não são a mesma coisa: o mesmo `gusset: 9` aparece
 * no acervo como "SF 09" e como "SF 9", e `17.5` como "SF 17,50". Regravar a
 * partir do número perderia o zero à esquerda em 12 produtos.
 *
 * O que sobra do nome depois de tirar medidas, sanfona e material é o
 * complemento — "Vermelho Gofrado", "s/ deslizante", "AZUL". São 148 produtos
 * com esse texto livre, e sem um lugar para ele a descrição se perde na
 * primeira edição.
 */
function partesDoNome(
  p: any,
  familia: string,
): { sanfona: string | null; complemento: string | null } {
  const nome = String(p.name ?? "");
  const m = p.technicalData?.measurements ?? {};

  /*
   * Sanfona e "S/SF" só são tiradas do nome no SACO.
   *
   * É a única família cujo gerador as recoloca. No filme termoencolhível o
   * "S/SF" de `42x0,06 S/SF Filme Termoencolhível` faz parte do texto, e
   * removê-lo ali fazia a descrição regerar sem ele — perdendo informação que
   * a indústria lê.
   */
  const ehSaco = familia === "SACO";
  const tokenSanfona = ehSaco ? (nome.match(/\bSF\s*[\d.,]+/i)?.[0] ?? null) : null;
  const sanfona = tokenSanfona?.match(/[\d.,]+/)?.[0] ?? null;

  let resto = nome;

  /*
   * A medida sai por REGEX, não por comparação de texto.
   *
   * O nome foi digitado e as medidas foram gravadas como número, e os dois nem
   * sempre coincidem na formatação: o acervo tem `0,1` escrito onde o campo
   * guarda `0.1` (que renderiza "0,10"), e `56,50` onde o campo tem `56.5`.
   * Comparando texto com texto, a medida não era encontrada, sobrava no resto e
   * ia parar no complemento — que virava "100x165x0,1 ROSA" em vez de "ROSA".
   */
  if (m.width && m.length && m.thickness) {
    resto = resto.replace(/\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?/, " ");
  }

  for (const parte of [tokenSanfona, ehSaco ? "S/SF" : null, texto(p.material)])
    if (parte) resto = resto.replace(parte, " ");

  return { sanfona, complemento: texto(resto.replace(/\s+/g, " ")) };
}

/**
 * A densidade com que o saco entra.
 *
 * Quatro sacos da GAMAPACK, editados no SICOV em 15/10, guardam a densidade da
 * tabela (0,0944 / 0,0922) mas têm o preço calculado com 0,1 — o divisor 10 que
 * era fixo: 40,5 × 60,5 × 0,04 × 0,1 × 18 = 176,418, o preço gravado. Com a
 * densidade gravada, o pedido novo sairia 5% a 8% mais barato do que o SICOV
 * mostrava. Decisão do usuário: vale o preço do SICOV, então quando o preço só
 * fecha com 0,1, a densidade entra 0,1.
 */
function densidadeDoSaco(p: any): { densidade: number | null; ajustada: boolean } {
  const m = p.technicalData?.measurements ?? {};
  const c = p.commercialData ?? {};
  const gravada = c.density ?? null;
  if (!m.width || !m.length || !m.thickness || !c.factorKg || c.basePrice == null || !gravada) {
    return { densidade: gravada, ajustada: false };
  }

  const preco = (d: number) => m.width * m.length * m.thickness * d * c.factorKg;
  if (Math.abs(preco(gravada) - c.basePrice) > 0.01 && Math.abs(preco(0.1) - c.basePrice) <= 0.01) {
    return { densidade: 0.1, ajustada: true };
  }
  return { densidade: gravada, ajustada: false };
}

const UNIDADE: Record<string, string> = { thousand: "MIL", kg: "KG", unit: "UN", box: "CX" };
const TIPO_ADITIVO: Record<string, string> = {
  per_kg: "POR_KG",
  per_thousand: "POR_MILHEIRO",
  per_linear_meter: "POR_METRO_LINEAR",
};

/* -------------------------------------------------------------------------- */
/* Relatório                                                                  */
/* -------------------------------------------------------------------------- */

const relatorio = {
  criados: {} as Record<string, number>,
  pulados: [] as string[],
  avisos: [] as string[],
  senhas: [] as string[],
};

const contar = (o: string, n = 1) => {
  relatorio.criados[o] = (relatorio.criados[o] ?? 0) + n;
};
const pular = (o: string, motivo: string) => relatorio.pulados.push(`${o}: ${motivo}`);
const avisar = (m: string) => relatorio.avisos.push(m);

/* -------------------------------------------------------------------------- */
/* A importação                                                               */
/* -------------------------------------------------------------------------- */

class Rollback extends Error {}

/** O logo que a indústria já tinha aqui, guardado antes da limpeza. */
type Logo = { logo: Uint8Array; logoTipo: string | null };

async function importar(
  tx: any,
  sicov: any,
  emailsOcupados: Set<string>,
  logos: Map<string, Logo>,
) {
  /* --- 1. O escritório e o administrador ---------------------------------- */

  const escritorio = await tx.organizacao.findFirst({
    where: { nome: NOME_ESCRITORIO },
    include: { usuarios: { where: { papel: "ADMIN" }, orderBy: { criadoEm: "asc" } } },
  });

  if (!escritorio) throw new Error(`Escritório "${NOME_ESCRITORIO}" não encontrado.`);

  const admin = escritorio.usuarios[0];
  if (!admin) throw new Error("O escritório não tem administrador.");

  const jaTem = await tx.cliente.count({ where: { organizacaoId: escritorio.id } });
  if (jaTem > 0 && !tem("forcar")) {
    throw new Error(
      `O escritório já tem ${jaTem} cliente(s). Importar por cima duplicaria tudo.\n` +
        "Use --substituir para apagar e importar de novo, ou --forcar para somar.",
    );
  }

  // O plano PLUS é ligado em `main`, antes da troca de papel: sob o papel da
  // aplicação o trigger `app_cobranca_so_administrativa` recusa mexer nele.

  const orgId = escritorio.id;

  /* --- 2. Usuários -------------------------------------------------------- */

  /*
   * A conta que já existe OCUPA o lugar do admin do SICOV.
   *
   * O mapa vale para PREPOSTO, e o admin fica de fora dele de propósito:
   * `representanteId` quer dizer "a carteira é deste preposto", e o dono do
   * escritório não é preposto de si mesmo. Carimbá-lo faria a tela de comissões
   * mostrar o nome dele onde deveria estar o de quem vende por ele, e criaria
   * uma linha em "por preposto" dizendo que ele deve a si próprio.
   *
   * Sem mapeamento, as 91 carteiras e os 193 pedidos dele ficam SEM DONO — que
   * é exatamente como o sistema grava o que o administrador cadastra.
   */
  const renata = sicov.users.find((u: any) => u.profile === "admin");
  const usuarios = new Map<string, string>();

  // O texto padrão de "Condições" é de cada usuário agora — o do SICOV era do
  // escritório inteiro, então vai para quem ocupa o lugar do admin dele. Só
  // quando ele ainda não tem um: o que ele já escreveu aqui é configuração
  // dele, e reimportar não a desfaz.
  if (!texto(admin.observacoesPadrao)) {
    await tx.usuario.update({
      where: { id: admin.id },
      data: { observacoesPadrao: texto(sicov.settings[0]?.defaultObservations) },
    });
  }

  /** O id daqui de um usuário do SICOV — o admin dele inclusive. */
  const idDoUsuario = (sicovId: unknown): string | null =>
    sicovId === renata._id ? admin.id : (usuarios.get(String(sicovId)) ?? null);

  for (const u of sicov.users as any[]) {
    if (u._id === renata._id) continue;

    /*
     * O e-mail é único no SISTEMA, não no escritório: é a chave do login.
     *
     * A lista de ocupados é levantada antes de assumir o papel restrito
     * (ver `emailsOcupados`), porque o RLS esconderia justamente o caso que
     * interessa — uma conta do mesmo e-mail em OUTRO escritório. Perguntar
     * daqui devolveria "livre" e o banco recusaria a gravação depois.
     *
     * Quem colide fica de fora, e o id dele NÃO é mapeado: apontar para uma
     * conta de outro escritório carimbaria cliente e pedido com um dono que o
     * RLS de lá nem enxerga. Sem mapeamento, a carteira dele fica do
     * escritório, visível a todos.
     */
    if (SEM_PREPOSTO.has(u.email.toLowerCase())) {
      pular(`preposto ${u.name}`, "pedido para ficar de fora");
      continue;
    }

    if (emailsOcupados.has(u.email.toLowerCase())) {
      pular(
        `preposto ${u.name}`,
        `o e-mail ${u.email} já tem conta no sistema — a carteira dele fica do escritório`,
      );
      continue;
    }

    const senha = randomBytes(6).toString("base64url");

    const criado = await tx.usuario.create({
      data: {
        organizacaoId: orgId,
        ...separarNome(u.name),
        email: u.email.toLowerCase(),
        senhaHash: await gerarHashSenha(senha),
        // Escolhida aqui, não por ele: o sistema sugere a troca no 1º acesso.
        senhaProvisoria: true,
        papel: "REPRESENTANTE",
        ativo: u.active !== false,
        comissaoPercentualPadrao: numero(u.defaultCommissionPercentage ?? 0),
      },
    });

    usuarios.set(u._id, criado.id);
    relatorio.senhas.push(`${u.name} · ${u.email} · ${senha}`);
    contar("prepostos");
  }

  /* --- 3. Indústrias, materiais e aditivos -------------------------------- */

  const fornecedores = new Map<string, string>();

  /*
   * As indústrias que cada preposto atende (`FornecedorPreposto`).
   *
   * A regra daqui é estrita: sem marca, o preposto não vê indústria nenhuma
   * (migration `industria_so_do_preposto_marcado`). A marca vem do
   * `allowedRepresentatives` do SICOV e, como na migration, de todo pedido,
   * proposta ou produto que já liga o preposto à indústria — senão a Iara
   * Celina, que não estava na lista de ninguém, perderia de vista a indústria
   * dos próprios 29 pedidos. As linhas são gravadas no fim.
   */
  const marcas = new Map<string, Set<string>>();
  const industriasDoPreposto = (usuarioId: string) => {
    if (!marcas.has(usuarioId)) marcas.set(usuarioId, new Set());
    return marcas.get(usuarioId)!;
  };

  /*
   * O percentual que cada indústria costuma pagar.
   *
   * O SICOV não tinha esse campo no fornecedor — ele nascia em cada comissão.
   * A moda é a melhor leitura do "padrão da casa": a ALFAPLAST pagou 5% em 149
   * pedidos e 3% em 14, e é 5 que deve aparecer preenchido ao lançar o próximo.
   * O percentual REAL de cada pedido continua congelado no pedido, então
   * nenhuma comissão histórica depende desta escolha.
   */
  const percentualUsual = modaDoPercentualPorFornecedor(sicov);

  /*
   * Os aditivos criados, por "fornecedor|nome do extra".
   *
   * Existe porque o produto precisa VOLTAR a apontar para eles. A importação
   * anterior criava os aditivos da indústria e nunca criava um `ProdutoAditivo`:
   * os quatro sacos que levavam "Sacos / por kg / R$ 1,65" ficaram com fator 21
   * em vez de 22,65, cerca de 8% mais baratos em qualquer pedido novo.
   */
  const aditivosPorNome = new Map<string, string>();

  for (const s of sicov.suppliers as any[]) {
    const nomeIndustria = texto(s.tradeName) ?? s.name;
    const logo = logos.get(nomeIndustria);

    const f = await tx.fornecedor.create({
      data: {
        organizacaoId: orgId,
        nome: nomeIndustria,
        // O logo que já estava aqui volta; o `logoUrl` do SICOV é o caminho de
        // um arquivo do sistema antigo, sem a imagem.
        logo: logo?.logo ?? null,
        logoTipo: logo?.logoTipo ?? null,
        razaoSocial: texto(s.name),
        cnpj: documento(s.cnpj),
        endereco: texto(s.address),
        municipio: texto(s.city),
        uf: texto(s.state)?.slice(0, 2) ?? null,
        cep: cep(s.zipCode),
        telefone: telefone(s.phone),
        email: texto(s.email),
        ipiPercentual: numero(s.ipi ?? 0),
        /*
         * O percentual da indústria.
         *
         * O SICOV não guardava isto no fornecedor: o valor vivia em cada
         * comissão (`adminPercentage`), com `DEFAULT_ADMIN_PERCENTAGE = 5` de
         * partida. Aqui o campo é o SUGERIDO ao lançar pedido novo — então vem
         * da moda das comissões da indústria, e cai no 5 do SICOV quando ela
         * ainda não vendeu nada.
         *
         * Gravar "0" aqui, como era feito antes, tinha dois efeitos: pedido
         * novo nascia com comissão zero, e todo pedido cujo percentual próprio
         * fosse nulo caía nesse zero pelo fallback de `percentualDoPedido`.
         */
        comissaoPercentual: numero(percentualUsual.get(s._id) ?? 5),
        /*
         * `currentOrderNumber` é o ÚLTIMO número usado, não o próximo. Sem o
         * `+ 1`, o primeiro pedido lançado depois da importação repetiria o
         * número do último importado e esbarraria na unique [fornecedorId, numero].
         */
        proximoNumeroPedido: Math.max(1, (s.currentOrderNumber ?? 0) + 1),
        ativo: s.active !== false,
      },
    });

    fornecedores.set(s._id, f.id);
    contar("indústrias");
    if (logo) contar("logos preservados");

    for (const r of (s.allowedRepresentatives ?? []) as any[]) {
      const usuarioId = usuarios.get(String(r));
      if (usuarioId) industriasDoPreposto(usuarioId).add(f.id);
    }

    // O que a ficha do SICOV tinha e a indústria daqui não tem onde guardar.
    if (!logo && texto(s.logoUrl)) {
      avisar(`${nomeIndustria}: sem logo — o backup só traz o caminho "${s.logoUrl}".`);
    }
    if (texto(s.stateRegistration)) {
      avisar(`${nomeIndustria}: IE ${s.stateRegistration} não importada — a indústria não tem campo de IE.`);
    }
    if (texto(s.notes)) {
      avisar(`${nomeIndustria}: anotação não importada (sem campo) — "${texto(s.notes)!.replace(/\s+/g, " ")}"`);
    }

    // A tabela de preço vira material + faixas. O mesmo material aparece
    // várias vezes quando a indústria cobra por faixa de peso (GAMAPACK).
    const porMaterial = new Map<string, any[]>();
    for (const linha of s.priceTable ?? []) {
      const nome = texto(linha.material)?.toUpperCase();
      if (!nome) continue;
      if (!porMaterial.has(nome)) porMaterial.set(nome, []);
      porMaterial.get(nome)!.push(linha);
    }

    for (const [nome, linhas] of porMaterial) {
      const base = linhas[0];

      const material = await tx.material.create({
        data: {
          fornecedorId: f.id,
          nome,
          precoKg: numero(base.factorKg ?? 0),
          precoMinimoKg: numero(base.limitFactorKg),
          densidade: numero(base.density),
        },
      });
      contar("materiais");

      const faixas = linhas.filter(
        (l: any) => l.weightFrom !== undefined || l.weightTo !== undefined,
      );

      for (const l of faixas) {
        await tx.materialFaixa.create({
          data: {
            materialId: material.id,
            pesoDeKg: numero(l.weightFrom),
            pesoAteKg: numero(l.weightTo),
            precoKg: numero(l.factorKg ?? 0),
          },
        });
        contar("faixas de peso");
      }
    }

    for (const e of (s.extras ?? []) as any[]) {
      const tipo = TIPO_ADITIVO[e.chargeType];
      if (!tipo) {
        pular(`aditivo ${e.name}`, `cobrança "${e.chargeType}" não existe aqui`);
        continue;
      }

      const aditivoCriado = await tx.aditivo.create({
        data: {
          fornecedorId: f.id,
          nome: e.name,
          // O SICOV não guarda sufixo de descrição. Montamos um no padrão que
          // os pedidos reais usam ("C/ DESLIZANTE") — é editável na tela.
          sufixoDescricao: `C/ ${e.name.toUpperCase()}`,
          tipo,
          valor: numero(e.value ?? 0),
        },
      });
      // A chave é fornecedor + nome porque é assim que o produto se refere ao
      // extra: o `selectedExtras` dele guarda o NOME, não um id.
      aditivosPorNome.set(`${s._id}|${e.name}`, aditivoCriado.id);
      contar("aditivos");
    }

    if ((s.minimumOrderTable ?? []).length > 0) {
      avisar(
        `${s.tradeName ?? s.name}: ${s.minimumOrderTable.length} faixa(s) de pedido mínimo ` +
          "em kg não foram importadas — o conceito não existe no RepPlast.",
      );
    }
  }

  /* --- 4. Clientes -------------------------------------------------------- */

  const clientes = new Map<string, string>();

  /**
   * Quem atende o cliente — o `representativeId` dele no SICOV, quando é um
   * preposto que entrou. O cliente da Renata fica sem vínculo: é do
   * escritório, e o dono não é preposto de si mesmo.
   */
  const prepostoDoCliente = new Map<string, string>();
  const vincularPreposto = async (clienteId: string, sicovRepresentante: unknown) => {
    const usuarioId = usuarios.get(String(sicovRepresentante));
    if (!usuarioId) return;
    await tx.clientePreposto.create({ data: { clienteId, usuarioId } });
    prepostoDoCliente.set(clienteId, usuarioId);
    contar("clientes com preposto");
  };

  for (const c of sicov.clients as any[]) {
    const criado = await tx.cliente.create({
      data: {
        organizacaoId: orgId,
        apelido: texto(c.tradeName) ?? c.name,
        razaoSocial: c.name,
        cnpj: documento(c.cnpj),
        ie: texto(c.stateRegistration),
        endereco: texto(c.address),
        bairro: texto(c.district),
        municipio: texto(c.city),
        uf: texto(c.state)?.slice(0, 2) ?? null,
        cep: cep(c.zipCode),
        telefone: telefone(c.phone),
        email: texto(c.email),
        // O SICOV tem um e-mail só; ele serve de contato e de destino da NF-e.
        emailNfe: texto(c.email),
        prazoPagamento: texto(c.paymentTerm),
        observacoes: observacoesDoCliente(c),
        ativo: c.active !== false,
        // Cadastro é do administrador (migration `cadastros_so_do_admin`).
        criadoPorId: admin.id,
      },
    });

    clientes.set(c._id, criado.id);
    contar("clientes");
    await vincularPreposto(criado.id, c.representativeId);
  }

  /* --- 5. Produtos -------------------------------------------------------- */

  const produtos = new Map<string, string>();

  for (const p of sicov.products as any[]) {
    const familia = familiaDoProduto(p);
    const med = p.technicalData?.measurements ?? {};
    const com = p.commercialData ?? {};
    const fornecedorId = fornecedores.get(p.supplierId);

    if (!fornecedorId) {
      pular(`produto ${p.name}`, "indústria não encontrada");
      continue;
    }

    const { sanfona, complemento } = partesDoNome(p, familia);

    const dados: Record<string, unknown> = {
      organizacaoId: orgId,
      fornecedorId,
      // O produto é DO CLIENTE: é isso que distingue as quatro linhas de
      // `90x160x0,055 SF 12 PEAD`, cada uma com o preço de um cliente.
      clienteId: clientes.get(p.clientId) ?? null,
      familia,
      codigoFornecedor: texto(p.supplierCode),
      // COD.CLI: o número que ELE usa. Vazio é legítimo — nem todo cliente
      // numera o que compra, e isso nunca disse nada sobre de quem o produto é.
      codigoCliente: texto(p.clientCode),
      descricao: p.name,
      material: texto(p.material),
      // `description` do SICOV está preenchido em 1 produto de 444; o texto que
      // importa está no NOME, depois do material.
      complemento: complemento ?? texto(p.description),
      // "MIL", "Kg", "Caixas" — vem escrito assim, com a caixa que o usuário
      // digitou. Três produtos trazem a string "undefined", que não é rótulo.
      unidadeRotulo: p.unitLabel === "undefined" ? null : texto(p.unitLabel),
      ativo: p.active !== false,
    };

    if (familia === "SACO") {
      if (!med.width || !med.length || !med.thickness || !com.factorKg) {
        pular(`produto ${p.name}`, "saco sem medidas ou sem fator kg");
        continue;
      }
      const { densidade, ajustada } = densidadeDoSaco(p);
      if (ajustada) {
        avisar(
          `Produto "${p.name}": entra com densidade 0,1 (o SICOV guardava ${com.density}) para ` +
            `manter o preço de R$ ${com.basePrice} que o SICOV mostrava.`,
        );
        contar("sacos com densidade 0,1 pelo preço do SICOV");
      }
      Object.assign(dados, {
        larguraCm: numero(med.width),
        comprimentoCm: numero(med.length),
        espessuraMm: numero(med.thickness),
        fatorKg: numero(com.factorKg),
        densidade: numero(densidade),
        sanfona,
      });
    } else if (familia === "FITA") {
      const porCaixa = p.technicalData?.unitsPerBox ?? null;
      Object.assign(dados, {
        unidadesPorCaixa: porCaixa,
        precoUnidade: numero(com.unitPrice),
        // O SICOV cobrava a caixa como `unitsPerBox x unitPrice` e nao guardava
        // o resultado. Sem calcula-lo aqui, a tela mostra R$ 4,39 "por unidade"
        // onde a industria cobra R$ 368,76 pela caixa de 84.
        precoCaixa:
          numero(com.boxPrice) ??
          (porCaixa && com.unitPrice ? String(porCaixa * Number(com.unitPrice)) : null),
        larguraMm: numero(med.width),
        metragemM: numero(med.length),
      });
      if (!dados.precoUnidade && !dados.precoCaixa) {
        pular(`produto ${p.name}`, "fita sem preço de unidade nem de caixa");
        continue;
      }
    } else if (familia === "AVULSO") {
      /*
       * Vendido por unidade, o preco e o `unitPrice` -- nao o `basePrice`.
       *
       * No modo `quantity_times_unit_price` o SICOV cobrava `cd.unitPrice`
       * (priceCalculator.js:61). Pegar o `basePrice` primeiro gravou
       * R$ 1.734,13 por unidade onde a industria cobrava R$ 1,74 -- mil vezes
       * mais, num produto so, e sem nada na tela denunciando.
       */
      const preco =
        p.calculationMode === "quantity_times_unit_price"
          ? com.unitPrice ?? com.basePrice ?? com.boxPrice
          : com.basePrice ?? com.unitPrice ?? com.boxPrice;
      if (!preco) {
        pular(`produto ${p.name}`, "avulso sem preço");
        continue;
      }
      Object.assign(dados, {
        unidadeAvulsa: UNIDADE[p.saleMode] ?? "UN",
        precoAvulso: numero(preco),
        larguraMm: numero(med.width),
      });
    } else {
      if (!com.basePrice) {
        pular(`produto ${p.name}`, "vendido por quilo, sem preço");
        continue;
      }
      Object.assign(dados, {
        precoKg: numero(com.basePrice),
        larguraMm: numero(med.width),
        micragem: numero(med.thickness),
      });
    }

    const criado = await tx.produto.create({ data: dados });
    produtos.set(p._id, criado.id);
    contar("produtos");

    const atendeProduto = prepostoDoCliente.get(dados.clienteId as string);
    if (atendeProduto) industriasDoPreposto(atendeProduto).add(fornecedorId);

    // O produto não tem campo de anotação, e o complemento sai impresso no
    // pedido — não é lugar para "Comissão 4%". Fica no relatório.
    if (texto(p.notes)) {
      avisar(`Produto "${p.name}": anotação não importada — "${texto(p.notes)!.replace(/\s+/g, " ")}"`);
    }

    // Os extras que ESTE produto leva. O preço só muda no SACO — é a única
    // família cuja fórmula soma aditivo (ver produto-preco.ts).
    for (const e of (p.selectedExtras ?? []) as any[]) {
      const aditivoId = aditivosPorNome.get(`${p.supplierId}|${e.name}`);

      if (!aditivoId) {
        pular(`aditivo "${e.name}" de ${p.name}`, "não existe na indústria");
        continue;
      }

      await tx.produtoAditivo.create({ data: { produtoId: criado.id, aditivoId } });
      contar("aditivos do produto");
    }
  }

  /* --- 6. Pedidos --------------------------------------------------------- */

  const pedidos = new Map<string, string>();
  const { comissaoPrincipal, parcelasDoSicov } = comissoesPorPedido(sicov);

  for (const o of sicov.orders as any[]) {
    const fornecedorId = fornecedores.get(o.supplierId);

    if (!fornecedorId) {
      pular(`pedido ${o.orderNumber}`, "indústria não existe mais");
      continue;
    }

    /*
     * Pedido cujo cliente foi apagado no SICOV.
     *
     * O pedido guarda a ficha inteira do cliente no `clientSnapshot` — é o que
     * saiu impresso na época. Recriar o cliente a partir dela é melhor que
     * perder um pedido de verdade: o documento existiu, a comissão foi paga, e
     * um buraco na numeração não se explica depois.
     */
    let clienteId = clientes.get(o.clientId);

    if (!clienteId) {
      const snap = o.clientSnapshot ?? {};
      if (!snap.name) {
        pular(`pedido ${o.orderNumber}`, "cliente apagado e sem nome no snapshot");
        continue;
      }

      const recriado = await tx.cliente.create({
        data: {
          organizacaoId: orgId,
          apelido: texto(snap.tradeName) ?? snap.name,
          razaoSocial: snap.name,
          cnpj: documento(snap.cnpj),
          ie: texto(snap.stateRegistration),
          endereco: texto(snap.address),
          bairro: texto(snap.district),
          municipio: texto(snap.city),
          uf: texto(snap.state)?.slice(0, 2) ?? null,
          cep: cep(snap.zipCode),
          telefone: telefone(snap.phone),
          email: texto(snap.email),
          emailNfe: texto(snap.email),
          // O snapshot não guarda o prazo; o que sobrou dele é o do próprio pedido.
          prazoPagamento: texto(snap.paymentTerm) ?? texto(o.paymentTerm),
          observacoes: texto(snap.notes),
          criadoPorId: admin.id,
        },
      });

      // O snapshot não diz quem atendia; quem dividiu a comissão do pedido, sim.
      await vincularPreposto(recriado.id, comissaoPrincipal.get(o._id)?.representativeId);
      clienteId = recriado.id;
      clientes.set(o.clientId, clienteId!);
      avisar(
        `Cliente "${snap.name}" foi recriado a partir do pedido ${o.orderNumber} — ` +
          "ele tinha sido apagado no SICOV.",
      );
      contar("clientes recriados de pedido");
    }

    const comissao = comissaoPrincipal.get(o._id);
    const situacao = situacaoDoPedido(o, comissao);
    const acerto = acertoDaComissao(comissao);

    /*
     * Com quem a comissão DESTE pedido é dividida.
     *
     * Não é `o.representativeId`: no SICOV todo pedido é da Renata, que é
     * quem lança. A fatia do preposto vive na comissão — Iara Celina a 50%,
     * Davi e Leo a 60% —, e lida do pedido ela some.
     */
    const prepostoDaComissao =
      comissao && Number(comissao.representativePercentage) > 0
        ? (usuarios.get(String(comissao.representativeId)) ?? null)
        : null;
    if (comissao && Number(comissao.representativePercentage) > 0 && !prepostoDaComissao) {
      avisar(
        `Pedido ${o.orderNumber}: a fatia de ${comissao.representativePercentage}% de ` +
          `${comissao.representativeName} fica com o escritório — ele não entrou como preposto.`,
      );
    }

    const parcelas = parcelasDoPedido(o, comissao, parcelasDoSicov.get(o._id) ?? []);

    // O peso de cada linha, para somar no cabeçalho depois de montar os itens.
    const pesos = ((o.items ?? []) as any[]).map((i: any) =>
      pesoDoItemImportado(
        i.productSnapshot ?? {},
        UNIDADE[i.productSnapshot?.saleMode] ?? "UN",
        Number(i.quantity ?? 0),
      ),
    );

    const criado = await tx.pedido.create({
      data: {
        organizacaoId: orgId,
        clienteId,
        fornecedorId,
        numero: o.orderNumber,
        status: situacao.status,
        // Pedido importado está pronto: abri-lo "em montagem" diria que está pela metade.
        emElaboracao: false,
        pedidoDoCliente: texto(o.customerPurchaseOrder),
        prazoPagamento: texto(o.paymentTerm),
        prazoEntrega: data(o.deliveryDate),
        observacoes: texto(o.notes),
        vendedor: texto(o.sellerName),
        // Congelados como foram cobrados: nada é recalculado.
        ipiPercentual: numero(o.supplierSnapshot?.ipi ?? 0),
        subtotalSemIpi: numero(o.subtotal ?? 0),
        valorIpi: numero(o.ipiValue ?? 0),
        totalGeral: numero(o.total ?? 0),
        pesoTotalKg: pesos.reduce((a, b) => a + b, 0).toFixed(3),
        // A comissão como o SICOV a guardava, por pedido. Sem a comissão, o
        // percentual fica nulo e vale o da indústria (`percentualDoPedido`).
        comissaoPercentual: numero(comissao?.adminPercentage),
        comissaoPercentualPreposto: numero(comissao?.representativePercentage),
        representanteId: prepostoDaComissao,
        // Quem digitou: nulo é o escritório, e todo pedido do SICOV foi lançado por ele.
        criadoPorId: null,
        // Com parcelas o acerto mora em cada uma (`expandirParcelas` ignora o do pedido).
        valorRecebido: parcelas.length ? null : (acerto?.valorRecebido ?? null),
        comissaoPercentualRecebido: parcelas.length ? null : (acerto?.percentual ?? null),
        entregueEm: data(comissao?.realDeliveryDate),
        criadoEm: data(o.createdAt) ?? undefined,
        enviadoEm: situacao.enviadoEm,
        canceladoEm: situacao.status === "CANCELADO" ? data(o.updatedAt) : null,
        parcelas: { create: parcelas },
        itens: {
          create: ((o.items ?? []) as any[]).map((i: any, indice: number) => {
            const snap = i.productSnapshot ?? {};
            const bruto = Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0);
            const ipi = i.hasIpi === false ? 0 : bruto * Number(o.supplierSnapshot?.ipi ?? 0) / 100;

            return {
              produtoId: produtos.get(i.productId) ?? null,
              ordem: indice + 1,
              familia: familiaDoProduto(snap),
              codigoFornecedor: texto(snap.supplierCode),
              codigoCliente: texto(snap.clientCode),
              descricao: snap.name ?? "(sem descrição)",
              unidade: UNIDADE[snap.saleMode] ?? "UN",
              quantidade: numero(i.quantity ?? 0),
              comIpi: i.hasIpi !== false,
              precoUnitario: numero(i.unitPrice ?? 0),
              totalSemIpi: bruto.toFixed(2),
              valorIpi: ipi.toFixed(2),
              total: (bruto + ipi).toFixed(2),
              pesoKg: pesos[indice].toFixed(3),
            };
          }),
        },
      },
      select: { id: true },
    });

    pedidos.set(o._id, criado.id);
    contar("pedidos");
    contar(`pedidos ${situacao.status}`);
    contar("itens de pedido", (o.items ?? []).length);
    if (parcelas.length) contar("parcelas de recebimento", parcelas.length);
    if (acerto && !parcelas.length) contar("acertos de comissão");
    if (situacao.status === "ENVIADO" && !o.sentToSupplier) {
      avisar(
        `Pedido ${o.orderNumber}: o SICOV nunca o marcou como enviado, mas ele foi entregue ` +
          "e acertado — entra como ENVIADO na data da entrega.",
      );
    }

    if (prepostoDaComissao) industriasDoPreposto(prepostoDaComissao).add(fornecedorId);
    const atende = prepostoDoCliente.get(clienteId!);
    if (atende) industriasDoPreposto(atende).add(fornecedorId);
  }

  /* --- 7. Orçamentos ------------------------------------------------------ */

  let numeroOrcamento = 1;

  for (const q of sicov.quotations as any[]) {
    const fornecedorId =
      fornecedores.get(q.supplierId) ?? industriaRecriada(sicov, fornecedores, q, avisar);

    if (!fornecedorId) {
      pular(`orçamento de ${(q.clientSnapshot ?? {}).name ?? "?"}`, "indústria não existe mais");
      continue;
    }

    /*
     * Proposta sem cliente cadastrado entra COMO ESTÁ.
     *
     * 99 das 166 nasceram assim no sistema antigo — cotar para quem ainda não
     * é cliente é o começo da conversa. Inventar uma ficha com nome e cidade
     * para cada uma encheria o cadastro de gente que talvez nunca compre; o
     * cadastro se faz depois, pela própria proposta, se o negócio acontecer.
     */
    const clienteId = clientes.get(q.clientId) ?? null;
    const avulso = clienteId ? null : texto((q.clientSnapshot ?? {}).name);

    if (!clienteId && !avulso) {
      pular("orçamento", "sem cliente e sem nome de destinatário");
      continue;
    }

    const ipi = Number(q.supplierSnapshot?.ipi ?? 0);
    const autor = usuarios.get(String(q.representativeId)) ?? null;
    const edicoes = ((q.editHistory ?? []) as any[]).filter((e) => data(e.editedAt));

    await tx.orcamento.create({
      data: {
        organizacaoId: orgId,
        clienteId,
        clienteAvulsoNome: avulso,
        clienteAvulsoMunicipio: clienteId ? null : texto((q.clientSnapshot ?? {}).city),
        fornecedorId,
        numero: numeroOrcamento++,
        // O SICOV não tinha desfecho: tudo que veio de lá entra como aberto.
        status: "ABERTO",
        emElaboracao: false,
        attn: texto(q.attn),
        // A proposta do SICOV não tem prazo próprio: o que ela levava era o do cliente.
        prazoPagamento: texto(q.paymentTerm) ?? texto(q.clientSnapshot?.paymentTerm),
        observacoes: texto(q.observations),
        vendedor: texto(q.sellerName),
        ipiPercentual: numero(ipi),
        subtotalSemIpi: numero(q.subtotal ?? 0),
        valorIpi: numero(q.ipiValue ?? 0),
        totalGeral: numero(q.total ?? 0),
        representanteId: autor,
        // Quem a digitou: é o que deixa o preposto ver a proposta que ele fez.
        criadoPorId: autor,
        criadoEm: data(q.createdAt) ?? undefined,
        // O "Orçamento atualizado" do SICOV é o log de edição daqui.
        edicoes: {
          create: edicoes.map((e) => ({
            usuarioId: idDoUsuario(e.editedBy),
            editadoEm: data(e.editedAt)!,
          })),
        },
        itens: {
          create: ((q.items ?? []) as any[]).map((i: any, indice: number) => {
            const snap = i.productSnapshot ?? {};
            const bruto = Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0);
            const valorIpi = i.hasIpi === false ? 0 : (bruto * ipi) / 100;

            return {
              produtoId: produtos.get(i.productId) ?? null,
              ordem: indice + 1,
              familia: familiaDoProduto(snap),
              codigoFornecedor: texto(snap.supplierCode),
              codigoCliente: texto(snap.clientCode),
              descricao: snap.name ?? "(sem descrição)",
              unidade: UNIDADE[snap.saleMode] ?? "UN",
              quantidade: numero(i.quantity ?? 0),
              comIpi: i.hasIpi !== false,
              precoUnitario: numero(i.unitPrice ?? 0),
              totalSemIpi: bruto.toFixed(2),
              valorIpi: valorIpi.toFixed(2),
              total: (bruto + valorIpi).toFixed(2),
            };
          }),
        },
      },
    });

    contar("orçamentos");
    contar("itens de orçamento", (q.items ?? []).length);
    if (edicoes.length) contar("edições de orçamento", edicoes.length);

    if (autor) industriasDoPreposto(autor).add(fornecedorId);
    const atende = clienteId ? prepostoDoCliente.get(clienteId) : undefined;
    if (atende) industriasDoPreposto(atende).add(fornecedorId);
  }

  await tx.organizacao.update({
    where: { id: orgId },
    data: { proximoNumeroOrcamento: numeroOrcamento },
  });

  /* --- 8. As indústrias de cada preposto ---------------------------------- */

  // A comissão e o acerto já entraram com o pedido (seção 6).
  for (const [usuarioId, industrias] of marcas) {
    for (const fornecedorId of industrias) {
      await tx.fornecedorPreposto.create({ data: { fornecedorId, usuarioId } });
      contar("indústrias marcadas para prepostos");
    }
  }

  return orgId;
}

/* -------------------------------------------------------------------------- */
/* Comissão, situação e parcelas do pedido                                    */
/* -------------------------------------------------------------------------- */

/**
 * As comissões do SICOV, separadas por pedido.
 *
 * Cada pedido tem UMA comissão principal (a sem `parentOrderId`) e, se o
 * recebimento foi dividido, as parcelas como comissões filhas — `installmentIndex`
 * 1, 2, 3, com `dueDate` própria. Os percentuais saem da principal MESMO quando
 * ela é `projected`: é o que o pai de um parcelado vira, e o laço antigo que a
 * pulava deixava os 7 parcelados sem percentual e sem acerto.
 */
function comissoesPorPedido(sicov: any) {
  const comissaoPrincipal = new Map<string, any>();
  const parcelasDoSicov = new Map<string, any[]>();

  for (const c of sicov.commissions as any[]) {
    const pedido = String(c.orderId);
    if (c.parentOrderId) {
      if (!parcelasDoSicov.has(pedido)) parcelasDoSicov.set(pedido, []);
      parcelasDoSicov.get(pedido)!.push(c);
    } else if (comissaoPrincipal.has(pedido)) {
      throw new Error(`Pedido ${c.orderNumber}: duas comissões principais no backup.`);
    } else {
      comissaoPrincipal.set(pedido, c);
    }
  }

  for (const lista of parcelasDoSicov.values()) {
    lista.sort((a, b) => a.installmentIndex - b.installmentIndex);
  }

  return { comissaoPrincipal, parcelasDoSicov };
}

/**
 * A indústria de um documento cujo fornecedor foi apagado no SICOV — quando
 * existe outra de MESMO nome (sem distinguir maiúsculas) no backup.
 *
 * A SIGMAPACK foi excluída e cadastrada de novo como "Sigmapack", e três
 * propostas (uma de R$ 113 mil para a ARGOS) ficaram apontando para a
 * antiga. O snapshot delas guarda o nome; sem casar por ele, as três sumiam
 * caladas como "indústria não existe mais".
 */
function industriaRecriada(
  sicov: any,
  fornecedores: Map<string, string>,
  doc: any,
  aviso?: (m: string) => void,
): string | undefined {
  const nome = texto(doc.supplierSnapshot?.tradeName)?.toLowerCase();
  if (!nome) return undefined;
  const mesma = (sicov.suppliers as any[]).find(
    (s) => (texto(s.tradeName) ?? s.name).toLowerCase() === nome,
  );
  const id = mesma && fornecedores.get(mesma._id);
  if (id) {
    aviso?.(
      `Proposta de ${doc.createdAt?.slice(0, 10)} para ${doc.clientSnapshot?.name}: a indústria ` +
        `"${doc.supplierSnapshot.tradeName}" foi apagada no SICOV — ligada à "${mesma.tradeName}", de mesmo nome.`,
    );
  }
  return id;
}

/** O acerto de uma comissão: base que a indústria pagou e o percentual. */
function acertoDaComissao(c: any): { valorRecebido: string; percentual: string } | null {
  if (!c || c.realReceivedValue === null || c.realReceivedValue === undefined) return null;
  return {
    valorRecebido: numero(c.realReceivedValue)!,
    percentual: numero(c.adminPercentage ?? 0)!,
  };
}

/**
 * Status e data de envio.
 *
 * O SICOV tinha "enviado" à parte do status, e 7 pedidos ativos nunca foram
 * marcados — mas foram entregues e a indústria pagou a comissão deles: saíram
 * por fora do sistema. Como ABERTO, R$ 102 mil e a comissão já recebida
 * sumiriam da tela de Comissões, que só soma o ENVIADO. Entram como ENVIADO
 * na data da entrega (decisão do usuário). Só o que não foi enviado NEM
 * entregue NEM acertado fica ABERTO.
 */
function situacaoDoPedido(
  o: any,
  comissao: any,
): { status: "ABERTO" | "ENVIADO" | "CANCELADO"; enviadoEm: Date | null } {
  if (o.status === "cancelled") return { status: "CANCELADO", enviadoEm: null };

  if (o.sentToSupplier) {
    return { status: "ENVIADO", enviadoEm: data(o.sentToSupplierAt) ?? data(o.createdAt) };
  }

  const entregue = data(comissao?.realDeliveryDate);
  if (entregue || acertoDaComissao(comissao)) {
    return { status: "ENVIADO", enviadoEm: entregue ?? data(o.createdAt) };
  }

  return { status: "ABERTO", enviadoEm: null };
}

/**
 * As parcelas de recebimento do pedido, no formato de `ParcelaRecebimento`.
 *
 * No SICOV, parcelar um pedido já parcialmente pago deixa o pago no PAI (o
 * `realReceivedValue` dele) e cria os filhos com o RESTANTE: o 2181 recebeu
 * 4.950 em julho e ganhou uma filha de 48.675 para agosto — 53.625 no total.
 * Aqui não há pai: o pago vira a parcela 1, no mês da entrega, já acertada, e
 * as filhas vêm depois. Sem nada pago, as filhas são as parcelas.
 *
 * A soma tem de fechar no centavo com a venda (`problemaNasParcelas`); se não
 * fechar, a importação para — uma parcela que somasse diferente inventaria ou
 * apagaria comissão.
 */
function parcelasDoPedido(o: any, principal: any, filhas: any[]) {
  if (filhas.length === 0) return [];

  const linhas: { vencimento: Date; base: string; acerto: ReturnType<typeof acertoDaComissao> }[] = [];
  const pago = acertoDaComissao(principal);

  if (pago) {
    const entrega = data(principal.realDeliveryDate) ?? data(o.deliveryDate) ?? data(o.createdAt);
    linhas.push({ vencimento: entrega!, base: pago.valorRecebido, acerto: pago });
  }

  for (const f of filhas) {
    const vencimento = data(f.dueDate);
    if (!vencimento) throw new Error(`Pedido ${o.orderNumber}: parcela sem vencimento no backup.`);
    linhas.push({
      vencimento,
      base: new Decimal(f.orderValueWithoutIpi).toFixed(2),
      acerto: acertoDaComissao(f),
    });
  }

  const soma = linhas.reduce((t, l) => t.plus(l.base), new Decimal(0));
  if (!soma.equals(new Decimal(o.subtotal).toDecimalPlaces(2))) {
    throw new Error(
      `Pedido ${o.orderNumber}: as parcelas somam ${soma.toFixed(2)} e a venda é ${o.subtotal}.`,
    );
  }

  return linhas.map((l, i) => ({
    numero: i + 1,
    vencimento: l.vencimento,
    base: l.base,
    valorRecebido: l.acerto?.valorRecebido ?? null,
    comissaoPercentualRecebido: l.acerto?.percentual ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Conferência de preço                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Recalcula o milheiro de cada saco pela NOSSA fórmula e compara com o que o
 * SICOV tinha gravado.
 *
 * É a prova de que os dois sistemas concordam. Divergência aqui não é erro de
 * importação: é sinal de que a fórmula não é a mesma, e isso precisa aparecer
 * antes de virar pedido.
 */
function conferirPrecos(sicov: any) {
  const problemas: string[] = [];
  let conferidos = 0;

  for (const p of sicov.products as any[]) {
    if (p.calculationMode !== "dimensions_density_factor") continue;

    const m = p.technicalData?.measurements ?? {};
    const c = p.commercialData ?? {};
    if (!m.width || !m.length || !m.thickness || !c.density || !c.factorKg) continue;
    if (c.basePrice === undefined || c.basePrice === null) continue;

    // Com a densidade com que o saco ENTRA — ver `densidadeDoSaco`.
    const nosso = m.width * m.length * m.thickness * densidadeDoSaco(p).densidade! * c.factorKg;
    conferidos++;

    if (Math.abs(nosso - c.basePrice) > 0.01) {
      problemas.push(
        `  ${p.name}: SICOV ${c.basePrice.toFixed(3)} × nossa fórmula ${nosso.toFixed(3)}`,
      );
    }
  }

  return { conferidos, problemas };
}

/* -------------------------------------------------------------------------- */
/* Limpeza (--substituir)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Esvazia o escritório, menos o administrador, e devolve os logos das
 * indústrias por nome para a importação regravá-los.
 *
 * Roda como DONO do banco e antes da troca de papel: sob o RLS o admin não vê a
 * meta nem a caixa de e-mail dos prepostos, e uma limpeza pela metade deixaria
 * lixo pendurado. O `app.bypass_rls` é ligado só aqui dentro — os triggers de
 * cadastro e de acerto respeitam ele — e desligado antes de devolver: com ele
 * ligado, o papel restrito que vem depois enxergaria tudo.
 *
 * A ordem respeita as chaves `Restrict`: pedido e orçamento antes de cliente e
 * indústria, produto antes de indústria. Itens, parcelas, envios, edições,
 * vínculos, materiais e aditivos vão em cascata.
 */
async function limparEscritorio(tx: any, orgId: string, adminId: string) {
  await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;

  const comLogo = await tx.fornecedor.findMany({
    where: { organizacaoId: orgId, logo: { not: null } },
    select: { nome: true, logo: true, logoTipo: true },
  });
  const logos = new Map<string, Logo>(
    comLogo.map((f: any) => [f.nome, { logo: f.logo, logoTipo: f.logoTipo }]),
  );

  const doEscritorio = { where: { organizacaoId: orgId } };
  const apagados: Record<string, number> = {
    pedidos: (await tx.pedido.deleteMany(doEscritorio)).count,
    orçamentos: (await tx.orcamento.deleteMany(doEscritorio)).count,
    compromissos: (await tx.compromisso.deleteMany(doEscritorio)).count,
    produtos: (await tx.produto.deleteMany(doEscritorio)).count,
    clientes: (await tx.cliente.deleteMany(doEscritorio)).count,
    indústrias: (await tx.fornecedor.deleteMany(doEscritorio)).count,
    metas: (await tx.metaComissao.deleteMany(doEscritorio)).count,
    repasses: (await tx.repassePreposto.deleteMany(doEscritorio)).count,
    "caixas de e-mail": (await tx.contaEmail.deleteMany(doEscritorio)).count,
    usuários: (
      await tx.usuario.deleteMany({ where: { organizacaoId: orgId, id: { not: adminId } } })
    ).count,
  };

  await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'off', TRUE)`;

  console.log("\nLimpeza do escritório (antes da importação):");
  for (const [o, n] of Object.entries(apagados)) console.log(`  ${String(n).padStart(5)}  ${o}`);
  console.log(`  ${String(logos.size).padStart(5)}  logos guardados (${[...logos.keys()].join(", ")})`);

  return logos;
}

/* -------------------------------------------------------------------------- */
/* Conferência da importação                                                  */
/* -------------------------------------------------------------------------- */

const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const centavos = (v: unknown) =>
  v === null || v === undefined ? null : new Decimal(String(v)).toFixed(2);
const pct = (v: unknown) =>
  v === null || v === undefined ? null : new Decimal(String(v)).toFixed(3);

/**
 * Relê o escritório e compara com o backup, pedido a pedido.
 *
 * Casa tudo por chave NATURAL — indústria pelo nome, pedido por indústria e
 * número, proposta pela data de criação, preposto pelo e-mail —, e não pelos
 * mapas da importação: assim a mesma função confere logo depois de importar e,
 * com `--conferir`, o que já está gravado há dias.
 *
 * Lança com a lista de divergências; dentro da transação, isso desfaz tudo.
 */
async function conferir(tx: any, sicov: any, orgId: string) {
  const problemas: string[] = [];
  const falha = (m: string) => problemas.push(m);
  const igual = (oQue: string, esperado: unknown, achado: unknown) => {
    if (String(esperado) !== String(achado)) falha(`${oQue}: esperado ${esperado}, gravado ${achado}`);
  };

  const pulados = SEM_PREPOSTO;
  const usuarioSicov = new Map((sicov.users as any[]).map((u) => [u._id, u]));
  const clienteSicov = new Map((sicov.clients as any[]).map((c) => [c._id, c]));
  const fornecedorSicov = new Map((sicov.suppliers as any[]).map((s) => [s._id, s]));
  const nomeDaIndustria = (s: any) => texto(s.tradeName) ?? s.name;
  /** O e-mail do preposto que entrou — `null` para o admin e para quem ficou de fora. */
  const emailDoPreposto = (sicovId: unknown) => {
    const u = usuarioSicov.get(String(sicovId));
    if (!u || u.profile === "admin" || pulados.has(u.email.toLowerCase())) return null;
    return u.email.toLowerCase();
  };

  /* --- Usuários ----------------------------------------------------------- */

  const usuarios = await tx.usuario.findMany({ where: { organizacaoId: orgId } });
  const usuarioPorId = new Map(usuarios.map((u: any) => [u.id, u]));
  const prepostosEsperados = (sicov.users as any[]).filter((u) => emailDoPreposto(u._id));
  const prepostos = usuarios.filter((u: any) => u.papel === "REPRESENTANTE");
  igual("prepostos", prepostosEsperados.length, prepostos.length);

  for (const u of prepostosEsperados) {
    const p: any = prepostos.find((x: any) => x.email === u.email.toLowerCase());
    if (!p) {
      falha(`preposto ${u.email} não está no escritório`);
      continue;
    }
    const { nome, sobrenome } = separarNome(u.name);
    igual(`preposto ${u.email} · nome`, `${nome}|${sobrenome}`, `${p.nome}|${p.sobrenome}`);
    igual(`preposto ${u.email} · % padrão`, pct(u.defaultCommissionPercentage ?? 0), pct(p.comissaoPercentualPadrao));
    igual(`preposto ${u.email} · senha provisória`, true, p.senhaProvisoria);
    igual(`preposto ${u.email} · ativo`, u.active !== false, p.ativo);
  }

  /* --- Indústrias --------------------------------------------------------- */

  const industrias = await tx.fornecedor.findMany({ where: { organizacaoId: orgId } });
  const industriaPorNome = new Map(industrias.map((f: any) => [f.nome, f]));
  igual("indústrias", sicov.suppliers.length, industrias.length);

  /* --- Clientes ----------------------------------------------------------- */

  const clientes = await tx.cliente.findMany({
    where: { organizacaoId: orgId },
    include: { prepostos: true },
  });
  const recriados = new Set(
    (sicov.orders as any[]).filter((o) => !clienteSicov.has(o.clientId)).map((o) => o.clientId),
  );
  igual("clientes", sicov.clients.length + recriados.size, clientes.length);

  const clientesPorRazao = Map.groupBy(clientes, (c: any) => c.razaoSocial);
  for (const c of sicov.clients as any[]) {
    const candidatos: any[] = clientesPorRazao.get(c.name) ?? [];
    const k = candidatos.find((x) => x.cnpj === documento(c.cnpj) && x.municipio === texto(c.city));
    if (!k) {
      falha(`cliente ${c.name} (${c.cnpj}) não encontrado com o mesmo CNPJ e município`);
      continue;
    }
    igual(`cliente ${c.name} · prazo`, texto(c.paymentTerm), k.prazoPagamento);
    igual(`cliente ${c.name} · ativo`, c.active !== false, k.ativo);
    const esperado = emailDoPreposto(c.representativeId);
    const achados = k.prepostos.map((v: any) => (usuarioPorId.get(v.usuarioId) as any)?.email).join(",");
    igual(`cliente ${c.name} · preposto`, esperado ?? "", achados);
  }

  /* --- Pedidos ------------------------------------------------------------ */

  const pedidos = await tx.pedido.findMany({
    where: { organizacaoId: orgId },
    include: { itens: true, parcelas: { orderBy: { numero: "asc" } }, cliente: true },
  });
  igual("pedidos", sicov.orders.length, pedidos.length);

  const nomeIndustriaPorId = new Map(industrias.map((f: any) => [f.id, f.nome]));
  const pedidoPorChave = new Map(
    pedidos.map((p: any) => [`${nomeIndustriaPorId.get(p.fornecedorId)}|${p.numero}`, p]),
  );
  const { comissaoPrincipal, parcelasDoSicov } = comissoesPorPedido(sicov);
  const statusContados: Record<string, number> = {};

  for (const o of sicov.orders as any[]) {
    const industria = nomeDaIndustria(fornecedorSicov.get(o.supplierId));
    const p: any = pedidoPorChave.get(`${industria}|${o.orderNumber}`);
    const rotulo = `pedido ${o.orderNumber} (${industria})`;
    if (!p) {
      falha(`${rotulo} não foi gravado`);
      continue;
    }

    const c = comissaoPrincipal.get(o._id);
    const situacao = situacaoDoPedido(o, c);
    statusContados[p.status] = (statusContados[p.status] ?? 0) + 1;

    igual(`${rotulo} · cliente`, clienteSicov.get(o.clientId)?.name ?? o.clientSnapshot?.name, p.cliente.razaoSocial);
    igual(`${rotulo} · status`, situacao.status, p.status);
    igual(`${rotulo} · enviado em`, dia(situacao.enviadoEm), dia(p.enviadoEm));
    igual(`${rotulo} · em elaboração`, false, p.emElaboracao);
    igual(`${rotulo} · subtotal`, centavos(o.subtotal ?? 0), centavos(p.subtotalSemIpi));
    igual(`${rotulo} · IPI`, centavos(o.ipiValue ?? 0), centavos(p.valorIpi));
    igual(`${rotulo} · total`, centavos(o.total ?? 0), centavos(p.totalGeral));
    igual(`${rotulo} · % IPI`, pct(o.supplierSnapshot?.ipi ?? 0), pct(p.ipiPercentual));
    igual(`${rotulo} · entrega prevista`, dia(data(o.deliveryDate)), dia(p.prazoEntrega));
    igual(`${rotulo} · pedido do cliente`, texto(o.customerPurchaseOrder), p.pedidoDoCliente);
    igual(`${rotulo} · itens`, (o.items ?? []).length, p.itens.length);

    // A soma das linhas fecha com o subtotal: cada linha arredonda a 2 casas,
    // então a folga é de meio centavo por linha.
    const somaItens = p.itens.reduce((t: Decimal, i: any) => t.plus(i.totalSemIpi.toString()), new Decimal(0));
    if (somaItens.minus(p.subtotalSemIpi.toString()).abs().greaterThan(0.005 * Math.max(1, p.itens.length))) {
      falha(`${rotulo} · Σ itens ${somaItens.toFixed(2)} ≠ subtotal ${centavos(p.subtotalSemIpi)}`);
    }

    // Comissão
    igual(`${rotulo} · % da indústria`, pct(c?.adminPercentage), pct(p.comissaoPercentual));
    igual(`${rotulo} · % do preposto`, pct(c?.representativePercentage), pct(p.comissaoPercentualPreposto));
    const donoEsperado =
      c && Number(c.representativePercentage) > 0 ? emailDoPreposto(c.representativeId) : null;
    igual(`${rotulo} · preposto da comissão`, donoEsperado ?? "", (usuarioPorId.get(p.representanteId) as any)?.email ?? "");
    igual(`${rotulo} · criado por`, "", p.criadoPorId ?? "");
    igual(`${rotulo} · entregue em`, dia(data(c?.realDeliveryDate)), dia(p.entregueEm));

    const parcelasEsperadas = parcelasDoPedido(o, c, parcelasDoSicov.get(o._id) ?? []);
    const acerto = parcelasEsperadas.length ? null : acertoDaComissao(c);
    igual(`${rotulo} · base recebida`, centavos(acerto?.valorRecebido), centavos(p.valorRecebido));
    igual(`${rotulo} · % recebido`, pct(acerto?.percentual), pct(p.comissaoPercentualRecebido));
    igual(`${rotulo} · parcelas`, parcelasEsperadas.length, p.parcelas.length);

    for (const [i, e] of parcelasEsperadas.entries()) {
      const g = p.parcelas[i];
      if (!g) break;
      const r = `${rotulo} · parcela ${e.numero}`;
      igual(`${r} · número`, e.numero, g.numero);
      igual(`${r} · vencimento`, dia(e.vencimento), dia(g.vencimento));
      igual(`${r} · base`, centavos(e.base), centavos(g.base));
      igual(`${r} · recebido`, centavos(e.valorRecebido), centavos(g.valorRecebido));
      igual(`${r} · % recebido`, pct(e.comissaoPercentualRecebido), pct(g.comissaoPercentualRecebido));
    }
    if (p.parcelas.length) {
      const soma = p.parcelas.reduce((t: Decimal, x: any) => t.plus(x.base.toString()), new Decimal(0));
      igual(`${rotulo} · Σ parcelas`, centavos(p.subtotalSemIpi), soma.toFixed(2));
    }
  }

  /* --- Contadores --------------------------------------------------------- */

  for (const s of sicov.suppliers as any[]) {
    const f: any = industriaPorNome.get(nomeDaIndustria(s));
    if (!f) continue;
    const maior = Math.max(
      0,
      ...pedidos.filter((p: any) => p.fornecedorId === f.id).map((p: any) => p.numero),
    );
    if (f.proximoNumeroPedido <= maior) {
      falha(`${f.nome} · próximo número ${f.proximoNumeroPedido} repetiria o pedido ${maior}`);
    }
  }

  /* --- Preço do saco, pela conta da própria aplicação --------------------- */

  /*
   * O milheiro que um pedido NOVO vai cobrar — `precoUnitario` sobre o que foi
   * gravado — contra o `basePrice` do SICOV. O saco com aditivo fica de fora:
   * o `basePrice` do SICOV não inclui o extra, que ele somava no pedido, e
   * aqui o aditivo já entra no milheiro.
   */
  const { precoUnitario, paraPrecificavel } = await import("../src/lib/produto-preco");
  const produtos = await tx.produto.findMany({
    where: { organizacaoId: orgId, familia: "SACO" },
    include: { aditivos: { include: { aditivo: true } }, cliente: true },
  });
  const produtosPorChave = Map.groupBy(
    produtos,
    (p: any) => `${nomeIndustriaPorId.get(p.fornecedorId)}|${p.cliente?.razaoSocial ?? ""}|${p.descricao}`,
  );
  let sacosConferidos = 0;

  for (const p of sicov.products as any[]) {
    if (familiaDoProduto(p) !== "SACO" || p.commercialData?.basePrice == null) continue;
    if ((p.selectedExtras ?? []).length || p.calculationMode !== "dimensions_density_factor") continue;

    const chave =
      `${nomeDaIndustria(fornecedorSicov.get(p.supplierId))}|` +
      `${clienteSicov.get(p.clientId)?.name ?? ""}|${p.name}`;
    const candidatos: any[] = produtosPorChave.get(chave) ?? [];
    if (!candidatos.length) {
      falha(`saco "${p.name}" não foi gravado`);
      continue;
    }

    const esperado = new Decimal(p.commercialData.basePrice);
    const algumBate = candidatos.some((g) => {
      const preco = precoUnitario(paraPrecificavel(g), "MIL");
      return preco !== null && preco.minus(esperado).abs().lessThanOrEqualTo(0.01);
    });
    if (!algumBate) {
      const preco = precoUnitario(paraPrecificavel(candidatos[0]), "MIL");
      falha(`saco "${p.name}" · milheiro: SICOV ${esperado.toFixed(3)}, aqui ${preco?.toFixed(3)}`);
    }
    sacosConferidos++;
  }

  /* --- Orçamentos --------------------------------------------------------- */

  const orcamentos = await tx.orcamento.findMany({
    where: { organizacaoId: orgId },
    include: { itens: true, edicoes: true },
  });
  igual("orçamentos", sicov.quotations.length, orcamentos.length);

  const orcamentoPorData = Map.groupBy(orcamentos, (q: any) => q.criadoEm.toISOString());
  for (const q of sicov.quotations as any[]) {
    const candidatos: any[] = orcamentoPorData.get(new Date(q.createdAt).toISOString()) ?? [];
    const industriaDoBackup =
      fornecedorSicov.get(q.supplierId) ??
      (sicov.suppliers as any[]).find(
        (s) =>
          nomeDaIndustria(s).toLowerCase() === texto(q.supplierSnapshot?.tradeName)?.toLowerCase(),
      );
    const industriaId = industriaDoBackup
      ? (industriaPorNome.get(nomeDaIndustria(industriaDoBackup)) as any)?.id
      : undefined;
    const g = candidatos.find((x) => x.fornecedorId === industriaId);
    const rotulo = `orçamento de ${q.createdAt.slice(0, 10)} (${q.clientSnapshot?.name})`;
    if (!g) {
      falha(`${rotulo} não foi gravado`);
      continue;
    }
    igual(`${rotulo} · total`, centavos(q.total ?? 0), centavos(g.totalGeral));
    igual(`${rotulo} · itens`, (q.items ?? []).length, g.itens.length);
    igual(`${rotulo} · edições`, (q.editHistory ?? []).length, g.edicoes.length);
    igual(`${rotulo} · em elaboração`, false, g.emElaboracao);
    const autor = emailDoPreposto(q.representativeId);
    igual(`${rotulo} · criado por`, autor ?? "", (usuarioPorId.get(g.criadoPorId) as any)?.email ?? "");
  }

  const escritorio = await tx.organizacao.findUnique({ where: { id: orgId } });
  const maiorOrcamento = Math.max(0, ...orcamentos.map((q: any) => q.numero));
  igual("próximo número de orçamento", maiorOrcamento + 1, escritorio.proximoNumeroOrcamento);
  igual("plano", "PLUS", escritorio.plano);

  /* --- Indústrias de cada preposto ---------------------------------------- */

  const marcas = await tx.fornecedorPreposto.findMany({
    where: { usuario: { organizacaoId: orgId } },
  });
  for (const u of prepostosEsperados) {
    const p: any = prepostos.find((x: any) => x.email === u.email.toLowerCase());
    if (!p) continue;
    const dele = new Set(marcas.filter((m: any) => m.usuarioId === p.id).map((m: any) => m.fornecedorId));
    // Toda indústria em que ele tem pedido com comissão precisa estar marcada.
    for (const ped of pedidos as any[]) {
      if (ped.representanteId === p.id && !dele.has(ped.fornecedorId)) {
        falha(`preposto ${p.email} não vê a indústria do pedido ${ped.numero}`);
      }
    }
  }

  /* --- Comissão por mês, pela conta da própria aplicação ------------------ */

  /*
   * O que a tela de Comissões vai mostrar, mês a mês, calculado pelo mesmo
   * `expandirParcelas` + `resumirComissao` que ela usa — e o que o backup diz
   * que devia ser. Bater aqui é a prova de que a aplicação LÊ o dado como foi
   * gravado (competência pela entrega, parcela pelo vencimento).
   */
  const { expandirParcelas, resumirComissao } = await import("../src/lib/comissao-consulta");
  const { comissaoDoPedido } = await import("../src/lib/comissao");
  const industriaPorId = new Map(industrias.map((f: any) => [f.id, f]));

  const itensDaTela = pedidos
    .filter((p: any) => p.status === "ENVIADO")
    .flatMap((p: any) =>
      expandirParcelas(
        {
          ...p,
          representante: p.representanteId
            ? { id: p.representanteId, nome: "", papel: (usuarioPorId.get(p.representanteId) as any)?.papel }
            : null,
          fornecedor: industriaPorId.get(p.fornecedorId) as any,
        },
        p.parcelas,
      ),
    );
  const telaPorMes = new Map(
    [...Map.groupBy(itensDaTela, (i: any) => i.competencia)].map(([mes, itens]) => [
      mes,
      resumirComissao(itens as any),
    ]),
  );

  const backupPorMes = new Map<string, { previsto: Decimal; recebido: Decimal }>();
  for (const o of sicov.orders as any[]) {
    const c = comissaoPrincipal.get(o._id);
    if (situacaoDoPedido(o, c).status !== "ENVIADO") continue;

    // Sem comissão no backup, vale o da indústria — o `percentualDoPedido` da tela.
    const percentual =
      c?.adminPercentage ??
      (industriaPorNome.get(nomeDaIndustria(fornecedorSicov.get(o.supplierId))) as any)
        ?.comissaoPercentual.toString();
    const parcelas = parcelasDoPedido(o, c, parcelasDoSicov.get(o._id) ?? []);
    const pedacos = parcelas.length
      ? parcelas.map((x) => ({
          mes: dia(x.vencimento)!.slice(0, 7),
          base: x.base,
          acerto: x.valorRecebido
            ? { base: x.valorRecebido, percentual: x.comissaoPercentualRecebido! }
            : null,
        }))
      : [
          {
            mes: dia(data(o.deliveryDate) ?? data(o.createdAt))!.slice(0, 7),
            base: new Decimal(o.subtotal).toFixed(2),
            acerto: acertoDaComissao(c)
              ? { base: acertoDaComissao(c)!.valorRecebido, percentual: acertoDaComissao(c)!.percentual }
              : null,
          },
        ];

    for (const x of pedacos) {
      const m = backupPorMes.get(x.mes) ?? { previsto: new Decimal(0), recebido: new Decimal(0) };
      m.previsto = m.previsto.plus(comissaoDoPedido(x.base, percentual));
      if (x.acerto) m.recebido = m.recebido.plus(comissaoDoPedido(x.acerto.base, x.acerto.percentual));
      backupPorMes.set(x.mes, m);
    }
  }

  const meses = [...new Set([...telaPorMes.keys(), ...backupPorMes.keys()])].sort();
  const quadro: string[] = [];
  for (const mes of meses) {
    const tela = telaPorMes.get(mes);
    const backup = backupPorMes.get(mes);
    const previstoTela = tela?.valor.toFixed(2) ?? "0.00";
    const recebidoTela = tela?.recebido.toFixed(2) ?? "0.00";
    igual(`comissão prevista de ${mes}`, backup?.previsto.toFixed(2) ?? "0.00", previstoTela);
    igual(`comissão recebida de ${mes}`, backup?.recebido.toFixed(2) ?? "0.00", recebidoTela);
    quadro.push(
      `  ${mes}   prevista R$ ${previstoTela.padStart(10)}   recebida R$ ${recebidoTela.padStart(10)}` +
        `   (preposto: R$ ${(tela?.previstoDoPreposto.toFixed(2) ?? "0.00").padStart(8)})`,
    );
  }

  /* --- Resultado ---------------------------------------------------------- */

  console.log("\nConferência contra o backup:");
  console.log(
    `  ${prepostos.length} prepostos · ${industrias.length} indústrias · ${clientes.length} clientes · ` +
      `${pedidos.length} pedidos · ${orcamentos.length} orçamentos`,
  );
  console.log(`  pedidos por status: ${JSON.stringify(statusContados)}`);
  console.log(`  ${sacosConferidos} sacos com o milheiro igual ao do SICOV, pela fórmula da aplicação`);
  console.log(`  logos: ${industrias.filter((f: any) => f.logo).map((f: any) => f.nome).join(", ") || "nenhum"}`);
  console.log("\n  Comissão do escritório por competência (como a tela de Comissões calcula):");
  console.log(quadro.join("\n"));

  if (problemas.length) {
    console.log(`\n  ✗ ${problemas.length} DIVERGÊNCIA(S):`);
    for (const p of problemas.slice(0, 40)) console.log(`    · ${p}`);
    if (problemas.length > 40) console.log(`    … e mais ${problemas.length - 40}`);
    throw new Error(`A conferência achou ${problemas.length} divergência(s).`);
  }

  console.log("\n  ✓ Tudo bate com o backup.");
}

/* -------------------------------------------------------------------------- */

async function main() {
  const sicov = await lerBackup(ARQUIVO);

  console.log(`\nBackup: ${ARQUIVO}`);
  console.log(
    `  ${sicov.clients.length} clientes · ${sicov.products.length} produtos · ` +
      `${sicov.orders.length} pedidos · ${sicov.quotations.length} orçamentos · ` +
      `${sicov.suppliers.length} indústrias · ${sicov.users.length} usuários`,
  );

  const precos = conferirPrecos(sicov);
  console.log(`\nConferência de preço: ${precos.conferidos} sacos recalculados pela nossa fórmula`);
  if (precos.problemas.length === 0) {
    console.log("  todos batem com o SICOV.");
  } else {
    console.log(`  ${precos.problemas.length} DIVERGEM:`);
    console.log(precos.problemas.slice(0, 10).join("\n"));
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL }),
  });

  const papelApp = process.env.APP_DB_ROLE?.trim();
  let orgId: string | null = null;

  try {
    await prisma.$transaction(
      async (tx) => {
        /*
         * O contexto é ligado UMA vez, para a transação inteira — diferente do
         * dia a dia da aplicação, onde cada query abre a sua. Assim a
         * importação inteira cabe num só `commit`, e o papel restrito continua
         * valendo: se alguma policy estiver errada, a importação quebra aqui.
         */
        const escritorio = await tx.organizacao.findFirst({ where: { nome: NOME_ESCRITORIO! } });
        if (!escritorio) throw new Error(`Escritório "${NOME_ESCRITORIO}" não encontrado.`);

        const admin = await tx.usuario.findFirst({
          where: { organizacaoId: escritorio.id, papel: "ADMIN" },
          orderBy: { criadoEm: "asc" },
        });
        if (!admin) throw new Error("O escritório não tem administrador.");

        /*
         * O que tem de acontecer como dono do banco, antes da troca de papel:
         * a limpeza (o RLS esconderia parte do que apagar), o plano (um
         * trigger o recusa ao papel da aplicação) e a lista de e-mails em uso
         * — que tem de ser lida DEPOIS da limpeza, senão os prepostos de hoje
         * contariam como "ocupados" e ficariam de fora.
         */
        const logos =
          SUBSTITUIR ? await limparEscritorio(tx, escritorio.id, admin.id) : new Map<string, Logo>();

        if (!SO_CONFERIR && escritorio.plano !== "PLUS") {
          await tx.organizacao.update({ where: { id: escritorio.id }, data: { plano: "PLUS" } });
          contar("escritório promovido a Plus");
        }

        const todos = await tx.usuario.findMany({ select: { email: true } });
        const emailsOcupados = new Set(todos.map((u: { email: string }) => u.email.toLowerCase()));

        if (papelApp) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(papelApp)) {
            throw new Error(`APP_DB_ROLE inválido: ${papelApp}`);
          }
          await tx.$executeRawUnsafe(`SET LOCAL ROLE ${papelApp}`);
        }
        await tx.$executeRaw`SELECT set_config('app.organizacao_id', ${escritorio.id}, TRUE),
                                    set_config('app.usuario_id', ${admin.id}, TRUE),
                                    set_config('app.papel', 'ADMIN', TRUE)`;

        if (!SO_CONFERIR) orgId = await importar(tx, sicov, emailsOcupados, logos);

        // Sob o papel restrito, como o admin veria: é a leitura da aplicação.
        await conferir(tx, sicov, escritorio.id);

        if (!GRAVAR) throw new Rollback();
      },
      { timeout: 600_000, maxWait: 60_000 },
    );
  } catch (erro: any) {
    if (!(erro instanceof Rollback)) {
      console.error(
        SO_CONFERIR
          ? "\n✗ A conferência FALHOU.\n"
          : "\n✗ A importação FALHOU e nada foi gravado (nem apagado).\n",
      );
      console.error(erro.message ?? erro);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  if (SO_CONFERIR) {
    await prisma.$disconnect();
    return;
  }

  /* --- relatório --------------------------------------------------------- */

  console.log(`\n${GRAVAR ? "GRAVADO" : "ENSAIO (desfeito no fim)"} — escritório "${NOME_ESCRITORIO}"`);

  for (const [o, n] of Object.entries(relatorio.criados)) {
    console.log(`  ${String(n).padStart(5)}  ${o}`);
  }

  if (relatorio.pulados.length > 0) {
    console.log(`\nNão entraram (${relatorio.pulados.length}):`);
    for (const p of relatorio.pulados.slice(0, 25)) console.log(`  · ${p}`);
    if (relatorio.pulados.length > 25) {
      console.log(`  … e mais ${relatorio.pulados.length - 25}`);
    }
  }

  if (relatorio.avisos.length > 0) {
    console.log("\nAvisos:");
    for (const a of relatorio.avisos) console.log(`  · ${a}`);
  }

  if (relatorio.senhas.length > 0) {
    console.log(`\nSenhas provisórias dos prepostos${GRAVAR ? "" : " (do ensaio; a gravação gera outras)"}:`);
    for (const s of relatorio.senhas) console.log(`  ${s}`);
    console.log("\n  Passe cada uma por um canal seguro e peça para trocarem.");
  }

  if (!GRAVAR) {
    console.log("\nNada foi gravado. Rode de novo com --gravar quando estiver satisfeito.\n");
  } else {
    console.log(`\nPronto. Escritório ${orgId}\n`);
  }

  await prisma.$disconnect();
}

main().catch(async (erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
