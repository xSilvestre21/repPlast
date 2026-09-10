/**
 * Semeia o banco com os dados dos DOIS PEDIDOS REAIS que serviram de referência
 * para o projeto (ver `referencia/`).
 *
 * Não é dado fictício de propósito: com ele é possível remontar o pedido 2253
 * dentro do sistema e comparar o PDF gerado com o PDF que a indústria recebeu
 * de verdade. Esse é o teste de aceitação mais forte que este projeto tem.
 *
 * Rode com:  npm run db:seed
 */

import "dotenv/config";

import { dbAdministrativo } from "../src/lib/db";
import { descricaoFita, descricaoRolo, descricaoSaco } from "../src/lib/descricao";

const db = dbAdministrativo();

async function main() {
  const organizacao =
    (await db.organizacao.findFirst({ where: { nome: "Representação Modelo" } })) ??
    (await db.organizacao.create({ data: { nome: "Representação Modelo" } }));

  const organizacaoId = organizacao.id;

  // --- Indústria ---------------------------------------------------------
  const qualyplast =
    (await db.fornecedor.findFirst({
      where: { organizacaoId, nome: "QUALYPLAST EMBALAGENS" },
    })) ??
    (await db.fornecedor.create({
      data: {
        organizacaoId,
        nome: "QUALYPLAST EMBALAGENS",
        ipiPercentual: "9.75",
        comissaoPercentual: "3",
        unidadeMeta: "REAIS",
        modoFaixa: "PROGRESSIVA",
        fatorKgPadrao: "13.50",
        // Os pedidos reais de referência são o 2253 e o 2256.
        proximoNumeroPedido: 2257,
      },
    }));

  // Faixa de exemplo — esta NÃO veio dos pedidos reais, foi inventada para dar
  // o que testar na apuração de comissão (fase 6). Ajuste ou remova à vontade.
  const faixaExemplo = await db.faixaComissao.findFirst({
    where: { fornecedorId: qualyplast.id, minimo: "50000" },
  });

  if (!faixaExemplo) {
    await db.faixaComissao.create({
      data: { fornecedorId: qualyplast.id, minimo: "50000", percentual: "4.5" },
    });
  }

  const deslizante =
    (await db.aditivo.findFirst({
      where: { fornecedorId: qualyplast.id, nome: "Deslizante" },
    })) ??
    (await db.aditivo.create({
      data: {
        fornecedorId: qualyplast.id,
        nome: "Deslizante",
        sufixoDescricao: "C/ DESLIZANTE",
        tipo: "POR_KG",
        // 13,50 + 2,10 = 15,60, que é o fator praticado no pedido 2256.
        valor: "2.10",
      },
    }));

  // --- Clientes ----------------------------------------------------------
  const mariol =
    (await db.cliente.findFirst({ where: { organizacaoId, apelido: "MARIOL" } })) ??
    (await db.cliente.create({
      data: {
        organizacaoId,
        apelido: "MARIOL",
        razaoSocial: "MARIOL EMBALAGENS LTDA",
        cnpj: "09.507.378/0001-50",
        ie: "204.222.524.111",
        uf: "SP",
        endereco: "Av. Mario de Oliveira, 505",
        bairro: "Distrito Industrial II",
        cep: "14781-160",
        municipio: "Barretos",
        telefone: "(17) 3321-5900",
        emailNfe: "nfe@mariolembalagens.com.br",
      },
    }));

  const lemepack =
    (await db.cliente.findFirst({ where: { organizacaoId, apelido: "LEMEPACK" } })) ??
    (await db.cliente.create({
      data: {
        organizacaoId,
        apelido: "LEMEPACK",
        razaoSocial: "LEMEPACK SOLUÇÕES EM EMBALAGENS LTDA",
        cnpj: "41.938.265/0001-12",
        ie: "415.198.612.112",
        uf: "SP",
        endereco: "Rua Carlos Fatuto, 170",
        bairro: "Jardim do Bosque",
        cep: "13613-110",
        municipio: "Leme",
        telefone: "(15) 98116-0572",
        emailNfe: "administrativo@lemepack.com.br",
      },
    }));

  // --- Produtos ----------------------------------------------------------
  // A descrição é gerada pelo mesmo código que a aplicação usa — se ela sair
  // diferente do PDF real, o seed denuncia na hora.
  const produtos = [
    {
      codigoFornecedor: "3563",
      larguraCm: 99,
      comprimentoCm: 166,
      espessuraMm: 0.08,
      sanfona: "13,50",
      material: "PEAD",
      fatorKg: "13.50",
      aditivos: [] as string[],
      codigoCliente: { clienteId: mariol.id, codigo: "121010011" },
    },
    {
      codigoFornecedor: "3353",
      larguraCm: 105,
      comprimentoCm: 100,
      espessuraMm: 0.08,
      sanfona: "15",
      material: "PEAD",
      fatorKg: "13.50",
      aditivos: [] as string[],
      codigoCliente: { clienteId: mariol.id, codigo: "121010014" },
    },
    {
      codigoFornecedor: "4396",
      larguraCm: 77,
      comprimentoCm: 150,
      espessuraMm: 0.05,
      sanfona: "09",
      material: "PEAD",
      fatorKg: "13.50",
      aditivos: [deslizante.id],
      codigoCliente: null,
    },
  ];

  for (const p of produtos) {
    const descricao = descricaoSaco({
      larguraCm: p.larguraCm,
      comprimentoCm: p.comprimentoCm,
      espessuraMm: p.espessuraMm,
      sanfona: p.sanfona,
      material: p.material,
      adicionais: p.aditivos.length > 0 ? [deslizante.sufixoDescricao] : [],
    });

    const existente = await db.produto.findFirst({
      where: { organizacaoId, fornecedorId: qualyplast.id, codigoFornecedor: p.codigoFornecedor },
    });

    const produto =
      existente ??
      (await db.produto.create({
        data: {
          organizacaoId,
          fornecedorId: qualyplast.id,
          familia: "SACO",
          codigoFornecedor: p.codigoFornecedor,
          descricao,
          material: p.material,
          larguraCm: p.larguraCm,
          comprimentoCm: p.comprimentoCm,
          espessuraMm: p.espessuraMm,
          sanfona: p.sanfona,
          fatorKg: p.fatorKg,
        },
      }));

    for (const aditivoId of p.aditivos) {
      await db.produtoAditivo.upsert({
        where: { produtoId_aditivoId: { produtoId: produto.id, aditivoId } },
        create: { produtoId: produto.id, aditivoId },
        update: {},
      });
    }

    if (p.codigoCliente) {
      await db.produtoCodigoCliente.upsert({
        where: {
          produtoId_clienteId: { produtoId: produto.id, clienteId: p.codigoCliente.clienteId },
        },
        create: { produtoId: produto.id, ...p.codigoCliente },
        update: { codigo: p.codigoCliente.codigo },
      });
    }

    console.log(`  produto ${p.codigoFornecedor}: ${descricao}`);
  }

  await semearEripack(organizacaoId);

  console.log(`\nOrganização: ${organizacao.nome} (${organizacaoId})`);
  console.log(`Fornecedores: ${qualyplast.nome} (IPI 9,75%), ERIPACK (IPI 15%)`);
  console.log(`Clientes:     ${mariol.apelido}, ${lemepack.apelido}, CASTRO-MACHI, AN-PARAFUSOS`);
}

/**
 * Segunda indústria, dos pedidos 133 e 146.
 *
 * Vale a pena estar no seed por dois motivos: prova que o IPI é mesmo por
 * fornecedor (15% aqui contra 9,75% da QUALYPLAST) e traz as famílias fita e
 * stretch, que não aparecem nos pedidos da QUALYPLAST.
 */
async function semearEripack(organizacaoId: string) {
  const eripack =
    (await db.fornecedor.findFirst({ where: { organizacaoId, nome: "ERIPACK" } })) ??
    (await db.fornecedor.create({
      data: {
        organizacaoId,
        nome: "ERIPACK",
        razaoSocial: "ERIPACK EMBALAGENS INDUSTRIAIS",
        ipiPercentual: "15",
        // O percentual de comissão da ERIPACK não consta nos pedidos de
        // referência — fica zero até o usuário informar.
        comissaoPercentual: "0",
        proximoNumeroPedido: 147,
      },
    }));

  const clientes = [
    {
      apelido: "CASTRO-MACHI",
      razaoSocial: "CASTRO & MACHI INDUSTRIA E COMERCIO LTDA",
      cnpj: "45.592.600/0001-24",
      ie: "606.369.999.114",
      uf: "SP",
      endereco: "Rua Ricardo Fracassi, 590",
      bairro: "Distrito Industrial",
      cep: "13457-209",
      municipio: "Santa Barbara D'Oeste",
      telefone: "(19) 99687-3399",
      emailNfe: "castro.machi.ind@gmail.com",
    },
    {
      apelido: "AN-PARAFUSOS",
      razaoSocial: "AN PARAFUSOS LTDA -EPP",
      cnpj: "10.781.464/0001-36",
      ie: "286.299.251.116",
      uf: "SP",
      endereco: "Av. Dom Pedro I 1154",
      bairro: "Vila Conceição",
      cep: "09991-000",
      municipio: "Diadema",
      telefone: "(11) 4043-1468",
      emailNfe: "financeiro@anparafusos.com.br",
    },
  ];

  for (const cliente of clientes) {
    const existente = await db.cliente.findFirst({
      where: { organizacaoId, apelido: cliente.apelido },
    });

    if (!existente) await db.cliente.create({ data: { organizacaoId, ...cliente } });
  }

  const produtos = [
    {
      familia: "FITA" as const,
      material: "Fita adesiva",
      larguraMm: 45,
      metragemM: 100,
      complemento: "transparente",
      precoCaixa: "368.76",
    },
    {
      familia: "STRETCH" as const,
      material: "FILM STRETCH",
      larguraMm: 500,
      micragem: 25,
      complemento: "BOBINA 4KG PESO LÍQUIDO",
      precoKg: "17.40",
    },
    {
      familia: "STRETCH" as const,
      material: "FILM STRETCH",
      larguraMm: 500,
      micragem: 25,
      complemento: "BOBINAS 2KG PESO LÍQUIDO",
      precoKg: "17.40",
    },
  ];

  for (const p of produtos) {
    const descricao = p.familia === "FITA" ? descricaoFita(p) : descricaoRolo(p);

    const existente = await db.produto.findFirst({
      where: { organizacaoId, fornecedorId: eripack.id, descricao },
    });

    if (!existente) {
      await db.produto.create({
        data: { organizacaoId, fornecedorId: eripack.id, descricao, ...p },
      });
    }

    console.log(`  produto ERIPACK: ${descricao}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
