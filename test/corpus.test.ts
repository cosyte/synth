import { describe, expect, it } from "vitest";

import {
  makeCorpus,
  SYNTH_FATAL_CODES,
  SynthError,
  type Artifact,
  type Corpus,
} from "../src/index.js";
import { astmCorpus } from "../src/astm/index.js";
import { ccdaCorpus } from "../src/ccda/index.js";
import { fhirCorpus } from "../src/fhir/index.js";
import { hl7Corpus } from "../src/hl7/index.js";
import { ncpdpCorpus } from "../src/ncpdp/index.js";
import { x12Corpus } from "../src/x12/index.js";

/** Assert that `call` throws a `SynthError` carrying `SYNTH_EMPTY_POOL`. */
function expectEmptyPool(call: () => unknown): void {
  let thrown: unknown;
  try {
    call();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(SynthError);
  expect((thrown as SynthError).code).toBe(SYNTH_FATAL_CODES.SYNTH_EMPTY_POOL);
}

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

describe("a corpus given an empty mix is refused", () => {
  // An empty `mix` names no kind, so there is nothing to cycle through. Every format throws
  // `SYNTH_EMPTY_POOL` before it generates anything, whatever the count, and never fills the corpus
  // with a kind the caller did not ask for.
  const counts = { omitted: {}, "0": { count: 0 }, "2": { count: 2 } } as const;
  const cases: ReadonlyArray<readonly [string, (count: { readonly count?: number }) => Corpus]> = [
    ["hl7", (c) => hl7Corpus({ seed: 5, mix: [], ...c })],
    ["hl7 triggers", (c) => hl7Corpus({ seed: 5, triggers: [], ...c })],
    ["fhir", (c) => fhirCorpus({ seed: 5, mix: [], ...c })],
    ["ccda", (c) => ccdaCorpus({ seed: 5, mix: [], ...c })],
    ["x12", (c) => x12Corpus({ seed: 5, mix: [], ...c })],
    ["ncpdp", (c) => ncpdpCorpus({ seed: 5, mix: [], ...c })],
    ["astm", (c) => astmCorpus({ seed: 5, mix: [], ...c })],
  ];
  for (const [format, make] of cases) {
    for (const [label, count] of Object.entries(counts)) {
      it(`${format}: throws SYNTH_EMPTY_POOL with the count ${label}`, () => {
        expectEmptyPool(() => make(count));
      });
    }
  }
});
