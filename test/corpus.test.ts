import { describe, expect, it } from "vitest";

import { makeCorpus, type Artifact } from "../src/index.js";

const artifact = (kind: string): Artifact => ({
  format: "hl7v2",
  kind,
  content: "MSH|...",
  warnings: [],
});

describe("makeCorpus — reproducible, self-describing, deep-frozen", () => {
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
