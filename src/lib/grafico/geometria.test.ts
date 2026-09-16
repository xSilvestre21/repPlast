import { describe, expect, it } from "vitest";

import { barrasRanqueadas, curvaAbc, fatias, serieTemporal } from "./geometria";

/** Item de série com o mínimo para a conta. */
const item = (rotulo: string, valor: number) => ({ chave: rotulo, rotulo, valor });

/** Uma série de `quantidade` itens, todos com o mesmo valor. */
const serie = (quantidade: number, valor = 10) =>
  Array.from({ length: quantidade }, (_, i) => item(`C${String(i).padStart(2, "0")}`, valor));

describe("barras ranqueadas", () => {
  it("ordena do maior para o menor", () => {
    const { linhas } = barrasRanqueadas([item("A", 10), item("B", 50), item("C", 30)]);

    expect(linhas.map((l) => l.rotulo)).toEqual(["B", "C", "A"]);
  });

  it("a maior barra enche a linha, e as outras se medem contra ela", () => {
    // Contra o TOTAL, estas três seriam 50/33/17 e nenhuma encheria a linha.
    const { linhas } = barrasRanqueadas([item("A", 100), item("B", 50), item("C", 25)]);

    expect(linhas.map((l) => l.proporcao)).toEqual([100, 50, 25]);
  });

  it("participação é a fatia do bolo, separada da largura da barra", () => {
    const { linhas } = barrasRanqueadas([item("A", 75), item("B", 25)]);

    expect(linhas.map((l) => l.participacao)).toEqual([75, 25]);
    expect(linhas[0].proporcao).toBe(100);
    expect(linhas[1].proporcao).toBeCloseTo(33.33, 2);
  });

  it("valor zero ou negativo não vira barra", () => {
    // Cliente sem comissão no mês não disputa espaço com quem teve.
    const { linhas, itens } = barrasRanqueadas([item("A", 10), item("ZERO", 0), item("NEG", -5)]);

    expect(linhas.map((l) => l.rotulo)).toEqual(["A"]);
    expect(itens).toBe(1);
  });

  it("empate desempata pelo rótulo, para a ordem não mudar entre recargas", () => {
    const { linhas } = barrasRanqueadas([item("Zulu", 10), item("Alfa", 10)]);

    expect(linhas.map((l) => l.rotulo)).toEqual(["Alfa", "Zulu"]);
  });

  describe("corte do topo", () => {
    it("junta o excedente numa linha só, com a contagem no rótulo", () => {
      const { linhas, agrupados } = barrasRanqueadas(serie(20), { teto: 12 });

      expect(linhas).toHaveLength(13);
      expect(linhas[12].rotulo).toBe("Outros (8)");
      expect(linhas[12].residuo).toBe(true);
      expect(agrupados).toBe(8);
    });

    it("a linha juntada soma o valor de quem ela esconde", () => {
      const { linhas } = barrasRanqueadas(serie(20, 10), { teto: 12 });

      expect(linhas[12].valor).toBe(80);
    });

    it("não corta quando sobraria um só", () => {
      // "Outros (1)" ocuparia a mesma linha do item que esconde, e ainda o esconderia.
      const { linhas, agrupados } = barrasRanqueadas(serie(13), { teto: 12 });

      expect(linhas).toHaveLength(13);
      expect(agrupados).toBe(0);
      expect(linhas.some((l) => l.residuo)).toBe(false);
    });

    it("com teto folgado, mostra todo mundo", () => {
      const { linhas, agrupados } = barrasRanqueadas(serie(55), { teto: 200 });

      expect(linhas).toHaveLength(55);
      expect(agrupados).toBe(0);
    });

    it("a linha juntada nunca passa de 100% do trilho", () => {
      // 43 pequenos somados rendem mais que o primeiro. Sem o teto a barra sai
      // de 160% e, fora de um contêiner que corta, atravessa o valor.
      const itens = [item("GRANDE", 100), ...serie(40, 10)];
      const { linhas } = barrasRanqueadas(itens, { teto: 5 });

      const residuo = linhas.find((l) => l.residuo)!;
      expect(residuo.valor).toBeGreaterThan(100);
      expect(residuo.proporcao).toBe(100);
    });

    it("o total é da série inteira, não só do que aparece", () => {
      const { total, itens } = barrasRanqueadas(serie(55, 10), { teto: 12 });

      expect(total).toBe(550);
      expect(itens).toBe(55);
    });
  });

  it("o destino do clique viaja junto com a linha", () => {
    const { linhas } = barrasRanqueadas([
      { chave: "a", rotulo: "A", valor: 10, href: "/clientes/a" },
    ]);

    expect(linhas[0].href).toBe("/clientes/a");
  });

  it("a linha juntada não leva a lugar nenhum", () => {
    // "Outros (43)" junta gente demais para levar a uma ficha só.
    const { linhas } = barrasRanqueadas(
      Array.from({ length: 20 }, (_, i) => ({
        chave: `c${i}`,
        rotulo: `C${i}`,
        valor: 10,
        href: `/clientes/c${i}`,
      })),
      { teto: 12 },
    );

    expect(linhas.find((l) => l.residuo)!.href).toBeUndefined();
  });

  it("série vazia não quebra nem divide por zero", () => {
    const vazio = barrasRanqueadas([]);

    expect(vazio.linhas).toEqual([]);
    expect(vazio.total).toBe(0);
    expect(vazio.maior).toBe(0);
  });
});

describe("série temporal", () => {
  const p = (rotulo: string, ...valores: number[]) => ({ rotulo, valores });

  it("espalha os pontos da borda esquerda à direita", () => {
    const { series } = serieTemporal([p("jun", 0), p("jul", 0), p("ago", 0)]);

    expect(series[0].pontos.map((ponto) => ponto.x)).toEqual([0, 50, 100]);
  });

  it("inverte o y, porque no SVG zero é o topo", () => {
    const { series } = serieTemporal([p("jun", 100), p("jul", 0)]);

    expect(series[0].pontos.map((ponto) => ponto.y)).toEqual([0, 100]);
  });

  it("todas as séries dividem a mesma escala", () => {
    // Duas escalas independentes fariam o previsto e o recebido parecerem
    // iguais num mês em que um é o dobro do outro.
    const { series, maximo } = serieTemporal([p("jun", 100, 50), p("jul", 80, 20)]);

    expect(maximo).toBe(100);
    expect(series[1].pontos[0].y).toBe(50);
  });

  it("mês inteiro zerado não produz NaN no caminho", () => {
    const { series, maximo } = serieTemporal([p("jun", 0), p("jul", 0)]);

    expect(maximo).toBe(1);
    expect(series[0].linha).not.toContain("NaN");
  });

  it("um ponto só fica no meio, sem colar na borda", () => {
    const { series } = serieTemporal([p("jun", 10)]);

    expect(series[0].pontos[0].x).toBe(50);
  });

  it("a área fecha na base para poder ser preenchida", () => {
    const { series } = serieTemporal([p("jun", 100), p("jul", 50)]);

    expect(series[0].area).toMatch(/L100,100 L0,100 Z$/);
  });
});

describe("curva ABC", () => {
  const item = (rotulo: string, valor: number) => ({ chave: rotulo, rotulo, valor });

  it("acumula até cem por cento", () => {
    const { itens } = curvaAbc([item("A", 50), item("B", 30), item("C", 20)]);

    expect(itens.map((i) => i.acumulado)).toEqual([50, 80, 100]);
  });

  it("quem fecha os 80% ainda é banda A", () => {
    // O corte olha o acumulado ANTERIOR: o item que cruza pertence ao grupo
    // que ele completa, não ao seguinte.
    const { itens, vitais } = curvaAbc([item("A", 50), item("B", 30), item("C", 20)]);

    // O terceiro começa o acumulado em 80%, ou seja já na faixa de B.
    expect(itens.map((i) => i.banda)).toEqual(["A", "A", "B"]);
    expect(vitais).toBe(2);
  });

  it("conta quantos caem em cada banda", () => {
    const itens = Array.from({ length: 10 }, (_, i) => item(`C${i}`, 10));
    const { contagem } = curvaAbc(itens);

    expect(contagem.A + contagem.B + contagem.C).toBe(10);
    expect(contagem.A).toBe(8);
  });

  it("a curva sobe da origem, mesmo com um item só", () => {
    // Um ponto solto viraria triângulo ao ser preenchido até a base.
    const { curva } = curvaAbc([item("A", 10)]);

    expect(curva).not.toContain("NaN");
    expect(curva).toBe("M0,100 L100,0");
  });

  it("a curva parte de zero por cento e chega a cem", () => {
    const { curva } = curvaAbc([item("A", 50), item("B", 50)]);

    expect(curva).toBe("M0,100 L50,50 L100,0");
  });

  it("cada item sabe onde cai na curva", () => {
    // Sem isso a curva é uma linha que não se liga a cliente nenhum.
    const { itens, curva } = curvaAbc([item("A", 50), item("B", 30), item("C", 20)]);

    expect(itens.map((i) => i.x)).toEqual([33.333, 66.667, 100]);
    // A mesma coordenada que o caminho desenha.
    expect(curva).toContain("L33.333,");
    expect(curva).toContain("L100,0");
  });

  it("carteira vazia devolve curva vazia sem quebrar", () => {
    const vazio = curvaAbc([]);

    expect(vazio.itens).toEqual([]);
    expect(vazio.curva).toBe("");
    expect(vazio.vitais).toBe(0);
  });
});

describe("fatias", () => {
  const item = (rotulo: string, valor: number) => ({ chave: rotulo, rotulo, valor });

  it("os traços se encaixam sem sobrepor", () => {
    const { fatias: f } = fatias([item("A", 50), item("B", 30), item("C", 20)]);

    expect(f.map((x) => x.inicio)).toEqual([0, 50, 80]);
    expect(f.map((x) => x.traco)).toEqual([50, 30, 20]);
  });

  it("uma fatia só dá a volta inteira", () => {
    // É o caso que o desenho por arco erra: os dois pontos coincidem e some.
    const { fatias: f } = fatias([item("A", 7)]);

    expect(f[0].traco).toBe(100);
    expect(f[0].inicio).toBe(0);
  });

  it("valor zero não vira fatia", () => {
    const { fatias: f } = fatias([item("A", 10), item("VAZIO", 0)]);

    expect(f).toHaveLength(1);
  });
});
