import { describe, expect, it } from "vitest";

import { makeCorpus, type Artifact, type Corpus } from "../src/index.js";
import { astmCorpus } from "../src/astm/index.js";
import { ccdaCorpus } from "../src/ccda/index.js";
import { ncpdpCorpus } from "../src/ncpdp/index.js";
import { x12Corpus } from "../src/x12/index.js";

const artifact = (kind: string): Artifact => ({
  format: "hl7v2",
  kind,
  content: "MSH|...",
  warnings: [],
});

describe("makeCorpus: reproducible, self-describing, deep-frozen", () => {
  it("derives per-kind counts and the format set", () => {
    const corpus = makeCorpus(42, [artifact("ADT^A01"), artifact("ADT^A01"), artifact("ADT^A04")]);
    expect(corpus.seed).toBe(42);
    expect(corpus.manifest.counts).toEqual({ "ADT^A01": 2, "ADT^A04": 1 });
    expect(corpus.manifest.formats).toEqual(["hl7v2"]);
    expect(corpus.manifest.quirks).toEqual([]);
    expect(corpus.artifacts).toHaveLength(3);
  });

  it("carries quirk labels through the manifest", () => {
    const corpus = makeCorpus(1, [artifact("ADT^A01")], ["cerner-z-segments"]);
    expect(corpus.manifest.quirks).toEqual(["cerner-z-segments"]);
  });

  it("deep-freezes the corpus, manifest, and every artifact", () => {
    const corpus = makeCorpus(1, [artifact("ADT^A01")]);
    expect(Object.isFrozen(corpus)).toBe(true);
    expect(Object.isFrozen(corpus.manifest)).toBe(true);
    expect(Object.isFrozen(corpus.artifacts)).toBe(true);
    expect(Object.isFrozen(corpus.artifacts[0])).toBe(true);
    expect(Object.isFrozen(corpus.artifacts[0]?.warnings)).toBe(true);
  });

  it("an empty corpus is valid", () => {
    const corpus = makeCorpus(0, []);
    expect(corpus.artifacts).toHaveLength(0);
    expect(corpus.manifest.formats).toEqual([]);
  });
});

describe("a corpus asked for a count over an empty mix", () => {
  // An empty `mix` names no kind, so each slot falls back to the format's first kind.
  const cases: ReadonlyArray<readonly [string, () => Corpus, () => Corpus]> = [
    [
      "astm",
      () => astmCorpus({ seed: 5, mix: [], count: 2 }),
      () => astmCorpus({ seed: 5, mix: ["Result"], count: 2 }),
    ],
    [
      "ccda",
      () => ccdaCorpus({ seed: 5, mix: [], count: 2 }),
      () => ccdaCorpus({ seed: 5, mix: ["ccd"], count: 2 }),
    ],
    [
      "ncpdp",
      () => ncpdpCorpus({ seed: 5, mix: [], count: 2 }),
      () => ncpdpCorpus({ seed: 5, mix: ["NewRx"], count: 2 }),
    ],
    [
      "x12",
      () => x12Corpus({ seed: 5, mix: [], count: 2 }),
      () => x12Corpus({ seed: 5, mix: ["837P"], count: 2 }),
    ],
  ];
  for (const [format, make, expected] of cases) {
    it(`${format}: builds that many artifacts of its first kind`, () => {
      const corpus = make();
      expect(corpus.artifacts).toHaveLength(2);
      expect(corpus.artifacts.map((a) => [a.kind, a.content])).toStrictEqual(
        expected().artifacts.map((a) => [a.kind, a.content]),
      );
    });
  }
});
