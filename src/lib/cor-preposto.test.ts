import { describe, expect, it } from "vitest";

import { corDoPreposto } from "./cor-preposto";

describe("cor do preposto", () => {
  it("os cinco primeiros têm cores diferentes", () => {
    const cores = [0, 1, 2, 3, 4].map(corDoPreposto);
    expect(new Set(cores).size).toBe(5);
  });

  it("o sexto volta à cor do primeiro", () => {
    expect(corDoPreposto(5)).toBe(corDoPreposto(0));
  });

  it("a mesma posição dá sempre a mesma cor", () => {
    expect(corDoPreposto(2)).toBe(corDoPreposto(2));
  });
});
