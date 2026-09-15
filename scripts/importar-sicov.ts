/**
 * Importa o backup do SICOV para dentro de um escritório do RepPlast.
 *
 * COMO RODAR
 *
 *   npm run db:importar -- --escritorio "Val & Amaral"            # ensaio
 *   npm run db:importar -- --escritorio "Val & Amaral" --gravar
 *
 * Opções: --pular a@b.com,c@d.com   não inscreve esses como preposto
 *         --arquivo caminho.json.gz  outro backup
 *         --forcar                   importa mesmo com o escritório já povoado
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
const ARQUIVO = arg("arquivo") ?? "referencia/sicov-backup-2026-09-13-18h30.json.gz";
const GRAVAR = tem("gravar");

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
      '  node scripts/importar-sicov.mjs --escritorio "Val & Amaral"\n',
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
 * a QUALYPLAST pagou 5% em 149 pedidos e 3% em 14 — quem lança o próximo espera
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

async function importar(tx: any, sicov: any, emailsOcupados: Set<string>) {
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
        "Use --forcar se for mesmo isso que você quer.",
    );
  }

  if (escritorio.plano !== "PLUS") {
    await tx.organizacao.update({
      where: { id: escritorio.id },
      data: { plano: "PLUS" },
    });
    contar("escritório promovido a Plus");
  }

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
  const valquiria = sicov.users.find((u: any) => u.profile === "admin");
  const usuarios = new Map<string, string>();

  await tx.organizacao.update({
    where: { id: orgId },
    data: { observacoesPadrao: texto(sicov.settings[0]?.defaultObservations) },
  });

  for (const u of sicov.users as any[]) {
    if (u._id === valquiria._id) continue;

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
        nome: u.name,
        email: u.email.toLowerCase(),
        senhaHash: await gerarHashSenha(senha),
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
   * O percentual que cada indústria costuma pagar.
   *
   * O SICOV não tinha esse campo no fornecedor — ele nascia em cada comissão.
   * A moda é a melhor leitura do "padrão da casa": a QUALYPLAST pagou 5% em 149
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
    const f = await tx.fornecedor.create({
      data: {
        organizacaoId: orgId,
        nome: texto(s.tradeName) ?? s.name,
        razaoSocial: texto(s.name),
        cnpj: documento(s.cnpj),
        endereco: texto(s.address),
        municipio: texto(s.city),
        uf: texto(s.state)?.slice(0, 2) ?? null,
        cep: cep(s.zipCode),
        telefone: telefone(s.phone),
        email: texto(s.email),
        emailsPedido: [],
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

    // A tabela de preço vira material + faixas. O mesmo material aparece
    // várias vezes quando a indústria cobra por faixa de peso (SELPACK).
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
        observacoes: texto(c.notes),
        ativo: c.active !== false,
        representanteId: usuarios.get(c.representativeId) ?? null,
      },
    });

    clientes.set(c._id, criado.id);
    contar("clientes");
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
      Object.assign(dados, {
        larguraCm: numero(med.width),
        comprimentoCm: numero(med.length),
        espessuraMm: numero(med.thickness),
        fatorKg: numero(com.factorKg),
        densidade: numero(com.density),
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

    // O código que ESTE cliente usa para ESTE produto — a coluna COD.CLI.
    const clienteId = clientes.get(p.clientId);
    if (clienteId && texto(p.clientCode)) {
      await tx.produtoCodigoCliente.upsert({
        where: { produtoId_clienteId: { produtoId: criado.id, clienteId } },
        create: { produtoId: criado.id, clienteId, codigo: p.clientCode.trim() },
        update: { codigo: p.clientCode.trim() },
      });
      contar("códigos do cliente");
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
          observacoes: texto(snap.notes),
          representanteId: usuarios.get(o.representativeId) ?? null,
        },
      });

      clienteId = recriado.id;
      clientes.set(o.clientId, clienteId!);
      avisar(
        `Cliente "${snap.name}" foi recriado a partir do pedido ${o.orderNumber} — ` +
          "ele tinha sido apagado no SICOV.",
      );
      contar("clientes recriados de pedido");
    }

    const cancelado = o.status === "cancelled";
    const enviadoEm = data(o.sentToSupplierAt) ?? data(o.createdAt);
    const dono = usuarios.get(o.representativeId) ?? null;

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
        status: cancelado ? "CANCELADO" : "ENVIADO",
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
        representanteId: dono,
        criadoEm: data(o.createdAt) ?? undefined,
        enviadoEm: cancelado ? null : enviadoEm,
        canceladoEm: cancelado ? data(o.updatedAt) : null,
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
    contar("itens de pedido", (o.items ?? []).length);
  }

  /* --- 7. Orçamentos ------------------------------------------------------ */

  let numeroOrcamento = 1;

  for (const q of sicov.quotations as any[]) {
    const fornecedorId = fornecedores.get(q.supplierId);

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
        attn: texto(q.attn),
        prazoPagamento: texto(q.paymentTerm),
        observacoes: texto(q.observations),
        vendedor: texto(q.sellerName),
        ipiPercentual: numero(ipi),
        subtotalSemIpi: numero(q.subtotal ?? 0),
        valorIpi: numero(q.ipiValue ?? 0),
        totalGeral: numero(q.total ?? 0),
        representanteId: usuarios.get(q.representativeId) ?? null,
        criadoEm: data(q.createdAt) ?? undefined,
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
  }

  await tx.organizacao.update({
    where: { id: orgId },
    data: { proximoNumeroOrcamento: numeroOrcamento },
  });

  /* --- 8. Comissões: viram o acerto do pedido ----------------------------- */

  for (const c of sicov.commissions as any[]) {
    // Parcela projetada não é acerto: é previsão de recebimento, e o RepPlast
    // não tem parcelamento de comissão.
    if (c.projected || c.realReceivedValue === null || c.realReceivedValue === undefined) continue;

    const pedidoId = pedidos.get(c.orderId);
    if (!pedidoId) {
      pular(`comissão do pedido ${c.orderNumber}`, "pedido não importado");
      continue;
    }

    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        valorRecebido: numero(c.realReceivedValue),
        comissaoPercentualRecebido: numero(c.adminPercentage ?? 0),
        entregueEm: data(c.realDeliveryDate),
      },
    });
    contar("acertos de comissão");
  }

  // O percentual da indústria e a fatia do preposto vêm das comissões, que no
  // SICOV guardavam os dois por pedido.
  for (const c of sicov.commissions as any[]) {
    const pedidoId = pedidos.get(c.orderId);
    if (!pedidoId || c.projected) continue;

    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        comissaoPercentual: numero(c.adminPercentage ?? 0),
        comissaoPercentualPreposto: numero(c.representativePercentage ?? 0),
      },
    });
  }

  return orgId;
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

    const nosso = m.width * m.length * m.thickness * c.density * c.factorKg;
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
         * Tudo que precisa enxergar ALÉM deste escritório tem de ser lido
         * antes da troca de papel — daqui em diante o RLS está valendo.
         */
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

        orgId = await importar(tx, sicov, emailsOcupados);

        if (!GRAVAR) throw new Rollback();
      },
      { timeout: 600_000, maxWait: 60_000 },
    );
  } catch (erro: any) {
    if (!(erro instanceof Rollback)) {
      console.error("\n✗ A importação FALHOU e nada foi gravado.\n");
      console.error(erro.message ?? erro);
      await prisma.$disconnect();
      process.exit(1);
    }
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
