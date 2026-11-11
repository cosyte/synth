/**
 * The `verify` option of every corpus generator: on by default, and off it builds the same
 * artifacts without reading them back, so each one's `warnings` is empty.
 */

import { describe, expect, it } from "vitest";

import type { Corpus } from "../src/index.js";
import { astmCorpus } from "../src/astm/index.js";
import { ccdaCorpus } from "../src/ccda/index.js";
import { fhirCorpus } from "../src/fhir/index.js";
import { hl7Corpus } from "../src/hl7/index.js";
import { ncpdpCorpus } from "../src/ncpdp/index.js";
import { x12Corpus } from "../src/x12/index.js";

type CorpusOf = (options: { seed: number; count: number; verify?: boolean }) => Corpus;

const CORPORA: readonly [string, CorpusOf, number][] = [
  ["hl7Corpus", hl7Corpus, 7],
  ["fhirCorpus", fhirCorpus, 13],
  ["ccdaCorpus", ccdaCorpus, 2],
  ["x12Corpus", x12Corpus, 5],
  ["ncpdpCorpus", ncpdpCorpus, 6],
  ["astmCorpus", astmCorpus, 2],
];

describe("a corpus with verify off", () => {
  for (const [name, corpusOf, count] of CORPORA) {
    it(`${name} builds the same artifacts, each with no warnings`, () => {
      const checked = corpusOf({ seed: 42, count });
      const unchecked = corpusOf({ seed: 42, count, verify: false });
      expect(corpusOf({ seed: 42, count, verify: true })).toEqual(checked);
      expect(unchecked.seed).toBe(checked.seed);
      expect(unchecked.manifest).toEqual(checked.manifest);
      expect(unchecked.artifacts.map((a) => [a.format, a.kind, a.content])).toEqual(
        checked.artifacts.map((a) => [a.format, a.kind, a.content]),
      );
      expect(unchecked.artifacts.every((a) => a.warnings.length === 0)).toBe(true);
      expect(Object.isFrozen(unchecked.artifacts[0]?.warnings)).toBe(true);
    });
  }
});
