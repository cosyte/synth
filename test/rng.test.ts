import { describe, expect, it } from "vitest";

import { createRng, splitmix32, sfc32Next, type Sfc32State } from "../src/index.js";

describe("createRng — the reproducibility contract", () => {
  it("same seed yields an identical sequence", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 50 }, () => a.nextUint32());
    const seqB = Array.from({ length: 50 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.nextUint32());
    const seqB = Array.from({ length: 20 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it("exposes the seed", () => {
    expect(createRng(777).seed).toBe(777);
  });

  it("float() stays in [0, 1)", () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i += 1) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("int() respects inclusive bounds and covers the range", () => {
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i += 1) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("int() throws when max < min", () => {
    expect(() => createRng(1).int(5, 1)).toThrow(RangeError);
  });

  it("pick() returns an in-range element and throws on empty", () => {
    const rng = createRng(4);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i += 1) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it("bool() honors the probability extremes", () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i += 1) {
      expect(rng.bool(1)).toBe(true);
      expect(rng.bool(0)).toBe(false);
    }
  });

  it("digits() returns exactly n decimal digits", () => {
    const rng = createRng(6);
    const d = rng.digits(8);
    expect(d).toMatch(/^\d{8}$/);
    expect(createRng(6).digits(0)).toBe("");
  });
});

describe("splitmix32 / sfc32 primitives", () => {
  it("splitmix32 is deterministic per seed and returns uint32", () => {
    const a = splitmix32(42);
    const b = splitmix32(42);
    for (let i = 0; i < 10; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("sfc32Next advances state deterministically", () => {
    const s1: Sfc32State = { a: 1, b: 2, c: 3, d: 4 };
    const s2: Sfc32State = { a: 1, b: 2, c: 3, d: 4 };
    for (let i = 0; i < 10; i += 1) expect(sfc32Next(s1)).toBe(sfc32Next(s2));
  });
});
