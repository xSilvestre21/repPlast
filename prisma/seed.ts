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
import { gerarHashSenha } from "../src/lib/senha";

const db = dbAdministrativo();

async function main() {
  const organizacao =
    (await db.organizacao.findFirst({ where: { nome: "Representação Modelo" } })) ??
    (await db.organizacao.create({ data: { nome: "Representação Modelo" } }));

  const organizacaoId = organizacao.id;

  // --- Usuário de desenvolvimento ----------------------------------------
  // Senha fraca de propósito e SÓ para desenvolvimento: existe para conseguir
  // entrar no sistema local sem passar pelo cadastro toda vez.
  const email = "dev@repplast.local";

  if (!(await db.usuario.findUnique({ where: { email }, select: { id: true } }))) {
    await db.usuario.create({
      data: {
        organizacaoId,
        nome: "Renata Prado",
        email,
        senhaHash: await gerarHashSenha("repplast123"),
      },
    });
    console.log(`  usuário de desenvolvimento: ${email} / repplast123`);
  }

  // --- Indústria ---------------------------------------------------------
  const alfaplast =
    (await db.fornecedor.findFirst({
      where: { organizacaoId, nome: "ALFAPLAST EMBALAGENS" },
    })) ??
    (await db.fornecedor.create({
      data: {
        organizacaoId,
        nome: "ALFAPLAST EMBALAGENS",
        ipiPercentual: "9.75",
        comissaoPercentual: "3",
        fatorKgPadrao: "13.50",
        // Os pedidos reais de referência são o 2253 e o 2256.
        proximoNumeroPedido: 2257,
      },
    }));

  const deslizante =
    (await db.aditivo.findFirst({
      where: { fornecedorId: alfaplast.id, nome: "Deslizante" },
    })) ??
    (await db.aditivo.create({
      data: {
        fornecedorId: alfaplast.id,
        nome: "Deslizante",
        sufixoDescricao: "C/ DESLIZANTE",
        tipo: "POR_KG",
        // 13,50 + 2,10 = 15,60, que é o fator praticado no pedido 2256.
        valor: "2.10",
      },
    }));

  // --- Tabela de material -------------------------------------------------
  // 13,50 é o fator praticado nos pedidos 2253 e 2256: é o preço do quilo do
  // PEAD nesta indústria. `update: {}` para que rodar o seed de novo não
  // desfaça um reajuste que o usuário tenha lançado pela tela.
  //
  // Densidade 0,1: é o divisor 10 que era constante no motor de preço, e que
  // agora é propriedade do material. Com ela o pedido 2253 fecha em 1.774,872,
  // igual ao PDF que a indústria emitiu.
  await db.material.upsert({
    where: { fornecedorId_nome: { fornecedorId: alfaplast.id, nome: "PEAD" } },
    create: {
      fornecedorId: alfaplast.id,
      nome: "PEAD",
      precoKg: "13.50",
      densidade: "0.1",
    },
    update: {},
  });

  // --- Clientes ----------------------------------------------------------
  const orion =
    (await db.cliente.findFirst({ where: { organizacaoId, apelido: "ORION" } })) ??
    (await db.cliente.create({
      data: {
        organizacaoId,
        apelido: "ORION",
        razaoSocial: "ORION EMBALAGENS LTDA",
        cnpj: "12.345.678/0001-95",
        ie: "111.111.111.111",
        uf: "SP",
        endereco: "Avenida das Indústrias",
        numero: "100",
        bairro: "Distrito Industrial",
        cep: "12345-678",
        municipio: "Monte Claro",
        telefone: "(11) 3456-7890",
        emailNfe: "nfe@orionembalagens.com.br",
      },
    }));

  const vegapack =
    (await db.cliente.findFirst({ where: { organizacaoId, apelido: "VEGAPACK" } })) ??
    (await db.cliente.create({
      data: {
        organizacaoId,
        apelido: "VEGAPACK",
        razaoSocial: "VEGAPACK SOLUÇÕES EM EMBALAGENS LTDA",
        cnpj: "98.765.432/0001-98",
        ie: "222.222.222.222",
        uf: "SP",
        endereco: "Rua das Palmeiras",
        numero: "200",
        bairro: "Jardim Exemplo",
        cep: "12345-679",
        municipio: "Lagoa Azul",
        telefone: "(15) 98765-4321",
        emailNfe: "administrativo@vegapack.com.br",
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
      clienteId: orion.id,
      codigoCliente: "121010011",
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
      clienteId: orion.id,
      codigoCliente: "121010014",
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
      // Dono sim, código não: nem todo cliente numera o que compra, e o
      // produto é dele do mesmo jeito.
      clienteId: orion.id,
      codigoCliente: null as string | null,
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
      where: { organizacaoId, fornecedorId: alfaplast.id, codigoFornecedor: p.codigoFornecedor },
    });

    const produto =
      existente ??
      (await db.produto.create({
        data: {
          organizacaoId,
          fornecedorId: alfaplast.id,
          familia: "SACO",
          codigoFornecedor: p.codigoFornecedor,
          clienteId: p.clienteId,
          codigoCliente: p.codigoCliente,
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

    console.log(`  produto ${p.codigoFornecedor}: ${descricao}`);
  }

  await semearBetapack(organizacaoId);

  console.log(`\nOrganização: ${organizacao.nome} (${organizacaoId})`);
  console.log(`Fornecedores: ${alfaplast.nome} (IPI 9,75%), BETAPACK (IPI 15%)`);
  console.log(`Clientes:     ${orion.apelido}, ${vegapack.apelido}, COSTA-MELO, JK-PARAFUSOS`);
}

/**
 * Segunda indústria, dos pedidos 133 e 146.
 *
 * Vale a pena estar no seed por dois motivos: prova que o IPI é mesmo por
 * fornecedor (15% aqui contra 9,75% da ALFAPLAST) e traz as famílias fita e
 * stretch, que não aparecem nos pedidos da ALFAPLAST.
 */
async function semearBetapack(organizacaoId: string) {
  const betapack =
    (await db.fornecedor.findFirst({ where: { organizacaoId, nome: "BETAPACK" } })) ??
    (await db.fornecedor.create({
      data: {
        organizacaoId,
        nome: "BETAPACK",
        razaoSocial: "BETAPACK EMBALAGENS INDUSTRIAIS",
        ipiPercentual: "15",
        // O percentual de comissão da BETAPACK não consta nos pedidos de
        // referência — fica zero até o usuário informar.
        comissaoPercentual: "0",
        proximoNumeroPedido: 147,
      },
    }));

  const clientes = [
    {
      apelido: "COSTA-MELO",
      razaoSocial: "COSTA & MELO INDUSTRIA E COMERCIO LTDA",
      cnpj: "11.222.333/0001-81",
      ie: "333.333.333.333",
      uf: "SP",
      endereco: "Rua dos Ipês",
      numero: "300",
      bairro: "Distrito Industrial",
      cep: "12345-680",
      municipio: "Sao Bento D'Oeste",
      telefone: "(11) 91234-5678",
      emailNfe: "financeiro@costamelo.com.br",
    },
    {
      apelido: "JK-PARAFUSOS",
      razaoSocial: "JK PARAFUSOS LTDA -EPP",
      cnpj: "11.444.777/0001-61",
      ie: "444.444.444.444",
      uf: "SP",
      endereco: "Avenida Central",
      numero: "400",
      bairro: "Centro",
      cep: "01234-000",
      municipio: "Vale Verde",
      telefone: "(11) 4567-8901",
      emailNfe: "financeiro@jkparafusos.com.br",
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
      where: { organizacaoId, fornecedorId: betapack.id, descricao },
    });

    if (!existente) {
      await db.produto.create({
        data: { organizacaoId, fornecedorId: betapack.id, descricao, ...p },
      });
    }

    console.log(`  produto BETAPACK: ${descricao}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
