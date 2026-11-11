/**
 * O catálogo dos tipos: a descrição de cada um e o que acontece ao trocar de tipo.
 *
 * As frases são as combinadas para sair no pedido. A forma delas vem dos
 * catálogos das indústrias ("1,5L", "20L Bombona", "TAMPA 42MM COM BATOQUE").
 */

import { describe, expect, it } from "vitest";

import {
  type CamposDaEmbalagem,
  OPCOES_TIPO,
  TIPOS,
  camposAoTrocarDeTipo,
  camposDaMedida,
  descricaoDoTipo,
  materialAoTrocarDeTipo,
  tipoDoProduto,
  tipoPorValor,
  unidadeDaCapacidade,
  unidadeDeVenda,
} from "./tipos-produto";
import { ehPorMilheiro, escolheUnidade } from "./produto-preco";

const VAZIO: CamposDaEmbalagem = {
  material: "",
  complemento: "",
  capacidade: "",
  capacidadeUnidade: "",
  comprimentoCm: "",
  larguraCm: "",
  alturaCm: "",
  diametroMm: "",
  larguraMm: "",
  metragemM: "",
  espessuraMm: "",
  larguraM: "",
  comprimentoMm: "",
  unidadeAvulsa: "",
  precoAvulso: "",
  materialTampa: "",
  complementoTampa: "",
  fornecedorTampaId: "",
  fornecedorTampaVariavel: "",
  acabamento: "",
  acabamentoValorCom: "",
  acabamentoValorSem: "",
};

const descricao = (
  valor: string,
  campos: Partial<CamposDaEmbalagem>,
  adicionais?: string[],
) => descricaoDoTipo(tipoPorValor(valor), { ...VAZIO, ...campos }, adicionais);

describe("descrição impressa", () => {
  it("bombona, em litros", () => {
    expect(descricao("BOMBONA", { capacidade: "20" })).toBe("Bombona 20L");
    expect(
      descricao("BOMBONA", {
        capacidade: "20",
        material: "PEAD",
        complemento: "Tampa Removível C/ Lacre Natural",
      }),
    ).toBe("Bombona 20L PEAD Tampa Removível C/ Lacre Natural");
  });

  it("frasco, em mL ou em L, com vírgula decimal", () => {
    expect(
      descricao("FRASCO", {
        capacidade: "500",
        capacidadeUnidade: "mL",
        material: "PEAD",
        complemento: "Oval Tampa Flip Top Branco",
      }),
    ).toBe("Frasco 500mL PEAD Oval Tampa Flip Top Branco");
    expect(descricao("FRASCO", { capacidade: "1,5", capacidadeUnidade: "L" })).toBe("Frasco 1,5L");
  });

  it("papelão: o modelo abre, e a altura é opcional", () => {
    expect(
      descricao("PAPELAO", {
        material: "Caixa de papelão",
        comprimentoCm: "30",
        larguraCm: "20",
        alturaCm: "15",
        complemento: "Onda B Kraft Maleta (FEFCO 0201)",
      }),
    ).toBe("Caixa de papelão 30x20x15cm Onda B Kraft Maleta (FEFCO 0201)");

    expect(
      descricao("PAPELAO", {
        material: "Chapa de papelão",
        comprimentoCm: "100",
        larguraCm: "80",
        complemento: "Onda B",
      }),
    ).toBe("Chapa de papelão 100x80cm Onda B");
  });

  it("tampa, pelo diâmetro", () => {
    expect(
      descricao("TAMPA", {
        diametroMm: "38",
        material: "PP",
        complemento: "Lacre Baixa C/ Selo de Indução Azul",
      }),
    ).toBe("Tampa 38mm PP Lacre Baixa C/ Selo de Indução Azul");
    expect(descricao("TAMPA", { diametroMm: "42", complemento: "C/ Batoque" })).toBe(
      "Tampa 42mm C/ Batoque",
    );
  });

  it("conjunto: as duas peças, ligadas por +", () => {
    expect(
      descricao("FRASCO_TAMPA", {
        capacidade: "500",
        capacidadeUnidade: "mL",
        material: "PEAD",
        complemento: "Oval Branco",
        diametroMm: "28",
        materialTampa: "PP",
        complementoTampa: "Flip Top Azul",
      }),
    ).toBe("Frasco 500mL PEAD Oval Branco + Tampa 28mm PP Flip Top Azul");

    expect(
      descricao("BOMBONA_TAMPA", {
        capacidade: "20",
        material: "PEAD",
        complemento: "Natural",
        diametroMm: "63",
        materialTampa: "PP",
        complementoTampa: "Lacre Azul",
      }),
    ).toBe("Bombona 20L PEAD Natural + Tampa 63mm PP Lacre Azul");
  });

  it("os aditivos fecham a descrição, inclusive no conjunto", () => {
    expect(
      descricao("BOMBONA_TAMPA", { capacidade: "20", diametroMm: "63" }, ["ANTI-UV"]),
    ).toBe("Bombona 20L + Tampa 63mm ANTI-UV");
  });

  it("o acabamento fecha a peça, antes da tampa e dos aditivos", () => {
    expect(
      descricao("FRASCO", {
        capacidade: "500",
        capacidadeUnidade: "mL",
        material: "PEAD",
        complemento: "Oval Branco",
        acabamento: "Serigrafado",
      }),
    ).toBe("Frasco 500mL PEAD Oval Branco Serigrafado");

    expect(
      descricao(
        "BOMBONA_TAMPA",
        { capacidade: "20", acabamento: "Sleeve", diametroMm: "63", materialTampa: "PP" },
        ["ANTI-UV"],
      ),
    ).toBe("Bombona 20L Sleeve + Tampa 63mm PP ANTI-UV");
  });

  it("os valores do acabamento não saem na descrição", () => {
    expect(
      descricao("BOMBONA", {
        capacidade: "20",
        acabamento: "Rotulado Adesivo",
        acabamentoValorCom: "150,00",
        acabamentoValorSem: "90,00",
      }),
    ).toBe("Bombona 20L Rotulado Adesivo");
  });

  it("tipo sem acabamento ignora o que sobrou no campo", () => {
    expect(descricao("TAMPA", { diametroMm: "28", acabamento: "Serigrafado" })).toBe("Tampa 28mm");
  });

  // Os dois saem como a Alemolde os chama: "Batoque para Tampa 18 Lacre",
  // "Alça para Gargalo 48". A medida é a do gargalo.
  it("batoque e alça, pelo gargalo onde entram", () => {
    expect(
      descricao("BATOQUE", {
        diametroMm: "18",
        material: "PE",
        complemento: "Conta-Gotas P/ Tampa Lacre Natural",
      }),
    ).toBe("Batoque 18mm PE Conta-Gotas P/ Tampa Lacre Natural");
    expect(descricao("ALCA", { diametroMm: "48", material: "PE", complemento: "Azul" })).toBe(
      "Alça para gargalo 48mm PE Azul",
    );
  });

  it("pote e balde, pela capacidade, e o conjunto com a tampa", () => {
    expect(
      descricao("POTE", {
        capacidade: "500",
        capacidadeUnidade: "mL",
        material: "PP",
        complemento: "Redondo Boca 90mm Transparente",
      }),
    ).toBe("Pote 500mL PP Redondo Boca 90mm Transparente");
    expect(
      descricao("BALDE_TAMPA", {
        capacidade: "20",
        material: "PP",
        complemento: "Alça Metálica Tinta",
        diametroMm: "290",
        materialTampa: "PP",
        complementoTampa: "Lacre",
      }),
    ).toBe("Balde 20L PP Alça Metálica Tinta + Tampa 290mm PP Lacre");
  });

  it("gatilho e válvula, pelo gargalo", () => {
    expect(
      descricao("GATILHO", { diametroMm: "28", material: "PP", complemento: "28/410 Spray e Jato" }),
    ).toBe("Gatilho 28mm PP 28/410 Spray e Jato");
    expect(descricao("VALVULA", { diametroMm: "24", complemento: "Pump 24/410 2 mL" })).toBe(
      "Válvula 24mm Pump 24/410 2 mL",
    );
  });

  it("pré-forma, pelo peso em gramas", () => {
    expect(
      descricao("PREFORMA", {
        capacidade: "18",
        capacidadeUnidade: "g",
        material: "PET",
        complemento: "PCO 1881 Cristal",
      }),
    ).toBe("Pré-forma 18g PET PCO 1881 Cristal");
    // A unidade é uma só: nem escolhida, sai em gramas.
    expect(descricao("PREFORMA", { capacidade: "21,5" })).toBe("Pré-forma 21,5g");
  });

  it("ráfia em largura por comprimento, como o saco, e a carga que ela leva", () => {
    expect(
      descricao("RAFIA", {
        larguraCm: "60",
        comprimentoCm: "90",
        material: "PP",
        complemento: "70g/m² P/ 50 kg Laminado Branco",
      }),
    ).toBe("Saco de ráfia 60x90cm PP 70g/m² P/ 50 kg Laminado Branco");
  });

  it("big bag pela caixa, e a carga no complemento", () => {
    expect(
      descricao("BIG_BAG", {
        comprimentoCm: "90",
        larguraCm: "90",
        alturaCm: "120",
        complemento: "1000 kg 4 Alças Topo C/ Saia Fundo C/ Válvula",
      }),
    ).toBe("Big bag 90x90x120cm 1000 kg 4 Alças Topo C/ Saia Fundo C/ Válvula");
  });

  it("plástico bolha e fita de arquear, em rolo", () => {
    // Como o mercado escreve: a largura em metros, com duas casas.
    expect(
      descricao("BOLHA", {
        larguraM: "1,3",
        metragemM: "100",
        material: "PEBD",
        complemento: "Bolha Pequena 20 Micras",
      }),
    ).toBe("Plástico bolha 1,30 x 100m PEBD Bolha Pequena 20 Micras");
    expect(descricao("BOLHA", { larguraM: "1,2" })).toBe("Plástico bolha 1,20m");
    expect(
      descricao("FITA_ARQUEAR", {
        larguraMm: "12",
        espessuraMm: "0,6",
        metragemM: "1500",
        material: "PP",
        complemento: "Preta",
      }),
    ).toBe("Fita de arquear 12x0,6mm x 1500m PP Preta");
    // Sem a metragem, que é opcional, fica só a seção.
    expect(descricao("FITA_ARQUEAR", { larguraMm: "16" })).toBe("Fita de arquear 16mm");
    expect(descricao("SELO_ARQUEAR", { larguraMm: "12", material: "Aço Galvanizado" })).toBe(
      "Selo para fita de arquear 12mm Aço Galvanizado",
    );
  });

  it("cantoneira: aba por aba por espessura por comprimento, tudo em mm", () => {
    expect(
      descricao("CANTONEIRA", {
        larguraMm: "50",
        espessuraMm: "5",
        comprimentoMm: "1200",
        material: "Papelão",
      }),
    ).toBe("Cantoneira 50x50x5x1200mm Papelão");
  });

  it("descartável: o modelo abre, e a capacidade pode faltar", () => {
    expect(
      descricao("DESCARTAVEL", {
        material: "Copo descartável",
        capacidade: "200",
        capacidadeUnidade: "mL",
        complemento: "PP Transparente Caixa C/ 2500",
      }),
    ).toBe("Copo descartável 200mL PP Transparente Caixa C/ 2500");
    expect(descricao("DESCARTAVEL", { material: "Bandeja", complemento: "EPS" })).toBe(
      "Bandeja EPS",
    );
  });

  it("batoque e alça não levam acabamento", () => {
    expect(descricao("BATOQUE", { diametroMm: "18", acabamento: "Serigrafado" })).toBe(
      "Batoque 18mm",
    );
    expect(descricao("ALCA", { diametroMm: "48", acabamento: "Serigrafado" })).toBe(
      "Alça para gargalo 48mm",
    );
  });

  it("antes de digitar a medida, sai o que já se sabe", () => {
    expect(descricao("BOMBONA", { material: "PEAD" })).toBe("Bombona PEAD");
  });
});

describe("unidade da capacidade", () => {
  it("usa a escolhida, se o tipo aceita", () => {
    expect(unidadeDaCapacidade(tipoPorValor("FRASCO"), "L")).toBe("L");
  });

  it("senão cai na primeira do tipo", () => {
    expect(unidadeDaCapacidade(tipoPorValor("FRASCO"), "")).toBe("mL");
    expect(unidadeDaCapacidade(tipoPorValor("BOMBONA"), "mL")).toBe("L");
  });
});

describe("trocar de tipo", () => {
  const trocar = (de: string, para: string, material: string) =>
    materialAoTrocarDeTipo(tipoPorValor(de), tipoPorValor(para), material);

  it("o padrão do tipo anterior dá lugar ao do novo", () => {
    expect(trocar("FITA", "PAPELAO", "Fita adesiva")).toBe("Caixa de papelão");
  });

  it("o que a pessoa digitou fica", () => {
    expect(trocar("FITA", "STRETCH", "Fita adesiva marrom")).toBe("Fita adesiva marrom");
  });

  it("o plástico não vai abrir a descrição de outro tipo", () => {
    expect(trocar("SACO", "FITA", "PEAD")).toBe("Fita adesiva");
    expect(trocar("BOMBONA", "PAPELAO", "PEAD")).toBe("Caixa de papelão");
  });

  it("o tipo em que o campo é plástico começa vazio", () => {
    expect(trocar("FITA", "BOMBONA", "Fita adesiva")).toBe("");
  });

  it("o modelo do papelão não vira material de outro tipo", () => {
    expect(trocar("PAPELAO", "TAMPA", "Chapa de papelão")).toBe("");
    expect(trocar("PAPELAO", "FITA", "Chapa de papelão")).toBe("Fita adesiva");
    expect(trocar("AVULSO", "PAPELAO", "Item especial")).toBe("Caixa de papelão");
  });

  it("escolher de novo o mesmo tipo não apaga nada", () => {
    expect(trocar("TAMPA", "TAMPA", "PP")).toBe("PP");
    expect(trocar("SACO", "SACO", "PEAD")).toBe("PEAD");
  });
});

describe("trocar de tipo limpa o que era da outra peça", () => {
  const VAZIOS = {
    familia: "SACO",
    fornecedorId: "",
    material: "",
    complemento: "",
    capacidade: "",
    capacidadeUnidade: "",
    diametroMm: "",
    materialTampa: "",
    fornecedorTampaId: "",
    fornecedorTampaVariavel: "",
    acabamento: "",
    acabamentoValorCom: "",
    precoAvulso: "",
    unidadeAvulsa: "UN",
    aditivos: [] as string[],
  };

  const CONJUNTO = {
    ...VAZIOS,
    familia: "BOMBONA_TAMPA",
    fornecedorId: "f1",
    material: "PEAD",
    complemento: "Natural",
    capacidade: "20",
    capacidadeUnidade: "L",
    diametroMm: "63",
    materialTampa: "PP",
    fornecedorTampaId: "f2",
    fornecedorTampaVariavel: "1",
    acabamento: "Serigrafado",
    acabamentoValorCom: "150,00",
    precoAvulso: "2.000,00",
    aditivos: ["a1"],
  };

  const trocar = (de: string, para: string, campos: typeof VAZIOS) =>
    camposAoTrocarDeTipo(tipoPorValor(de), tipoPorValor(para), campos, VAZIOS, ["fornecedorId"]);

  it("do conjunto para só a tampa, recomeça", () => {
    expect(trocar("BOMBONA_TAMPA", "TAMPA", CONJUNTO)).toEqual({
      ...VAZIOS,
      familia: "TAMPA",
      fornecedorId: "f1",
    });
  });

  it("guarda o que foi pedido para manter", () => {
    expect(trocar("BOMBONA_TAMPA", "FRASCO", CONJUNTO).fornecedorId).toBe("f1");
  });

  it("abre na unidade de capacidade do tipo novo", () => {
    expect(trocar("BOMBONA", "FRASCO", CONJUNTO).capacidadeUnidade).toBe("mL");
  });

  it("na mesma família, é o mesmo produto: nada muda", () => {
    const stretch = { ...VAZIOS, familia: "STRETCH", material: "FILME STRETCH", complemento: "BOBINA 4KG" };
    expect(trocar("STRETCH", "SHRINK", stretch)).toEqual({ ...stretch, material: "FILME SHRINK" });
  });

  it("escolher de novo o mesmo tipo não muda nada", () => {
    expect(trocar("BOMBONA_TAMPA", "BOMBONA_TAMPA", CONJUNTO)).toEqual(CONJUNTO);
  });

  describe("partindo de nenhum tipo, o começo das duas telas", () => {
    const SEM_TIPO = { ...VAZIOS, familia: "", fornecedorId: "f1" };
    const escolher = (para: string) =>
      camposAoTrocarDeTipo(null, tipoPorValor(para), SEM_TIPO, VAZIOS, ["fornecedorId"]);

    it("assume a família escolhida e guarda o que foi pedido para manter", () => {
      expect(escolher("FRASCO")).toEqual({
        ...VAZIOS,
        familia: "FRASCO",
        fornecedorId: "f1",
        capacidadeUnidade: "mL",
      });
    });

    it("o tipo de nome livre já abre com o nome dele", () => {
      expect(escolher("STRETCH").material).toBe("FILME STRETCH");
      expect(escolher("SACO").material).toBe("");
    });
  });
});

describe("catálogo de frascos e bombonas", () => {
  const grupo = (valor: string, titulo: string) =>
    tipoPorValor(valor).complementos.find((g) => g.titulo === titulo);

  it("a bombona tem os bocais dos fabricantes, um por vez", () => {
    expect(grupo("BOMBONA", "Bocal")?.umaSo).toBe(true);
    expect(grupo("BOMBONA", "Bocal")?.opcoes).toEqual(
      expect.arrayContaining(["Bocal 38mm", "Bocal 42mm", "Bocal 45mm", "Bocal 63mm"]),
    );
  });

  it("o conjunto mantém bocal e gargalo, e deixa a tampa para a seção dela", () => {
    expect(grupo("BOMBONA_TAMPA", "Bocal")).toBeDefined();
    expect(grupo("FRASCO_TAMPA", "Gargalo")).toBeDefined();
    expect(grupo("BOMBONA_TAMPA", "Fechamento")).toBeUndefined();
    expect(grupo("FRASCO_TAMPA", "Tampa")).toBeUndefined();
  });

  it("nenhuma opção se repete dentro do mesmo tipo", () => {
    for (const { complementos, valor } of TIPOS) {
      const opcoes = complementos.flatMap((g) => g.opcoes);
      expect(new Set(opcoes).size, valor).toBe(opcoes.length);
    }
  });

  it("a tampa tem os gargalos e os modelos do catálogo da Alemolde", () => {
    expect(grupo("TAMPA", "Gargalo")?.opcoes).toEqual(
      expect.arrayContaining(["PCO 1810", "PCO 1881", "PCO 38", "Finish Europeu"]),
    );
    expect(grupo("TAMPA", "Modelo")?.opcoes).toEqual(
      expect.arrayContaining(["Copo", "Óleo", "Spray", "Lenço Umedecido", "Galão"]),
    );
    expect(grupo("TAMPA", "Orifício")?.umaSo).toBe(true);
    expect(grupo("TAMPA", "Extras")?.opcoes).toContain("Dobradiça Borboleta");
    expect(tipoPorValor("TAMPA").materiais).toContain("PE");
  });

  it("o tipo do lacre separa a Baixa 38 Lacre da Lacre 3.0, e o galão fica com o seu", () => {
    expect(
      descricao("TAMPA", {
        diametroMm: "38",
        material: "PE",
        complemento: "Rosca Baixa PCO 38 Lacre Anel Seccionado",
      }),
    ).not.toBe(
      descricao("TAMPA", {
        diametroMm: "38",
        material: "PE",
        complemento: "Rosca Baixa PCO 38 Lacre Aletas Dobradas",
      }),
    );
    expect(grupo("TAMPA", "Tipo de lacre")?.umaSo).toBe(true);
    expect(grupo("TAMPA", "Tipo de lacre")?.opcoes).toContain("Lacre Catraca");
    // Galão e Lacre Catraca estão em grupos diferentes: um não apaga o outro.
    expect(grupo("TAMPA", "Modelo")?.opcoes).not.toContain("Lacre Catraca");
  });

  it("cada medida pede os campos do tipo, com o nome dele", () => {
    const nomes = (valor: string) => camposDaMedida(tipoPorValor(valor)).map((c) => c.rotulo);

    expect(nomes("CANTONEIRA")).toEqual(["Aba", "Espessura", "Comprimento"]);
    expect(nomes("RAFIA")).toEqual(["Largura", "Comprimento"]);
    expect(nomes("GATILHO")).toEqual(["Diâmetro do gargalo"]);
    expect(camposDaMedida(tipoPorValor("CANTONEIRA")).map((c) => c.sufixo)).toEqual([
      "mm",
      "mm",
      "mm",
    ]);
    expect(camposDaMedida(tipoPorValor("BOLHA")).map((c) => c.campo)).toEqual([
      "larguraM",
      "metragemM",
    ]);
    // A capacidade tem tela própria, com a unidade.
    expect(nomes("POTE")).toEqual([]);
    // No descartável nada é obrigatório.
    expect(tipoPorValor("DESCARTAVEL").medidaOpcional).toBe(true);
    expect(camposDaMedida(tipoPorValor("FITA_ARQUEAR")).map((c) => c.obrigatorio)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("o tipo que escolhe a unidade do preço abre na de costume dele", () => {
    expect(unidadeDeVenda(tipoPorValor("BIG_BAG"), "")).toBe("UN");
    expect(unidadeDeVenda(tipoPorValor("FITA_ARQUEAR"), "")).toBe("KG");
    expect(unidadeDeVenda(tipoPorValor("FITA_ARQUEAR"), "UN")).toBe("UN");
    // Unidade que o tipo não aceita cai na primeira dele; sem escolha, milheiro.
    expect(unidadeDeVenda(tipoPorValor("RAFIA"), "KG")).toBe("MIL");
    expect(unidadeDeVenda(tipoPorValor("POTE"), "UN")).toBe("MIL");
  });

  it("trocar para um tipo que escolhe a unidade traz a dele", () => {
    const campos = { familia: "", material: "", capacidadeUnidade: "", unidadeAvulsa: "UN" };
    expect(
      camposAoTrocarDeTipo(null, tipoPorValor("FITA_ARQUEAR"), campos, campos).unidadeAvulsa,
    ).toBe("KG");
    expect(camposAoTrocarDeTipo(null, tipoPorValor("POTE"), campos, campos).unidadeAvulsa).toBe(
      "UN",
    );
  });

  it("batoque e alça perguntam pelo gargalo", () => {
    for (const valor of ["BATOQUE", "ALCA"]) {
      expect(tipoPorValor(valor).medida, valor).toBe("DIAMETRO");
      expect(tipoPorValor(valor).rotuloDiametro, valor).toBe("Diâmetro do gargalo");
    }
    expect(grupo("BATOQUE", "Modelo")?.opcoes).toEqual(["Cego", "C/ Furo", "Conta-Gotas", "Dosador"]);
  });

  it("só frasco, bombona, pote e balde têm acabamento — o mesmo que o banco aceita", () => {
    const comAcabamento = TIPOS.filter((t) => t.acabamentos).map((t) => t.valor);
    expect(comAcabamento.sort()).toEqual([
      "BALDE",
      "BALDE_TAMPA",
      "BOMBONA",
      "BOMBONA_TAMPA",
      "FRASCO",
      "FRASCO_TAMPA",
      "POTE",
      "POTE_TAMPA",
    ]);
  });
});

describe("o catálogo e o motor de preço", () => {
  it("escolhe a unidade do preço exatamente quem o motor de preço trata assim", () => {
    for (const tipo of TIPOS) {
      expect(Boolean(tipo.unidadesVenda), tipo.valor).toBe(escolheUnidade(tipo.familia));
    }
  });

  it("todo tipo com medida é das famílias de preço digitado", () => {
    for (const tipo of TIPOS.filter((t) => t.medida)) {
      expect(ehPorMilheiro(tipo.familia), tipo.valor).toBe(true);
    }
  });
});

describe("reabrir um produto", () => {
  it("cada família nova volta ao seu tipo", () => {
    for (const { id } of OPCOES_TIPO.filter((o) => o.id !== "SHRINK")) {
      expect(tipoDoProduto({ familia: id, material: "", descricao: "" }).valor).toBe(id);
    }
  });

  it("o shrink continua reconhecido pelo nome", () => {
    expect(
      tipoDoProduto({ familia: "STRETCH", material: "FILME SHRINK", descricao: "" }).valor,
    ).toBe("SHRINK");
  });
});
