/**
 * The scaling gates for every corpus generator, from `@cosyte/test-utils/perf`, run by
 * `pnpm test:perf` and never under coverage (see `vitest.perf.config.ts`).
 *
 * Each asks one question: does generating cost more than its output grows? On the count axis, 4
 * times as many one-artifact corpora, each from its own seed; on the size axis, corpora of 4 times
 * as many artifacts. Each ratio must stay inside the band the shared contract fixes. A gate does
 * not see a constant-factor slowdown: a generator 10% slower everywhere passes, and always will. The
 * base against head comparison on a pull request (`bench/synth.bench.mjs`) is the instrument for
 * that.
 *
 * Each self-check proves its fixtures are large enough for its gate to fail: the same corpus built
 * the wrong way, every prefix of it generated again before the next artifact is added, as a corpus
 * that rebuilt itself from its seed on every append would be, must clear the ceiling at exactly
 * these sizes. Every input is a seed and a count, so every value generated is synthetic.
 *
 * It lives under `scripts/` rather than `test/` because it is a timing instrument, like the bench,
 * and not part of `pnpm test`: `pnpm check:test-selection` holds every module under `test/` that
 * names a published entry point to the selection of `vitest.config.ts`, which must never run a
 * clock under coverage.
 */

import {
  assertScalingGateFires,
  scalingGate,
  type ScalingGateOptions,
} from "@cosyte/test-utils/perf";
import { describe, expect, it } from "vitest";

import { astmCorpus } from "../../src/astm/index.js";
import { ccdaCorpus } from "../../src/ccda/index.js";
import type { Corpus } from "../../src/corpus.js";
import { fhirCorpus } from "../../src/fhir/index.js";
import { hl7Corpus } from "../../src/hl7/index.js";
import { ncpdpCorpus } from "../../src/ncpdp/index.js";
import { x12Corpus } from "../../src/x12/index.js";

/** What every generator here is handed: a seed, and how many artifacts to build from it. */
interface Request {
  readonly seed: number;
  readonly count: number;
}

/** One gate: its generator, and fixture sizes that keep each clean base phase well over 8 ms. */
interface Gate {
  readonly name: string;
  readonly generate: (request: Request) => Corpus;
  /** One-artifact corpora in the count axis's base phase. */
  readonly count: number;
  /** Corpora in each size-axis phase. */
  readonly inputs: number;
  /** Artifacts in each corpus of the size axis's base phase; the scaled phase has 4 times as many. */
  readonly size: number;
}

// Each size is a whole number of turns of its corpus's default mix (7 HL7 kinds, 11 FHIR, 2 C-CDA,
// 5 X12, 6 NCPDP, 2 ASTM), so both phases hold every kind in the same proportion: a size cut part of
// the way through a mix weighs the phases differently (the first FHIR kinds are small resources and
// the last a Bundle), and the ratio then reads a change of mix as a change of cost.
//
// About 0.2 ms an artifact for HL7, X12, NCPDP and ASTM, 0.4 ms for FHIR and 7 ms for a C-CDA
// document on a developer machine. Every size axis is small, so the self-check's quadratic version
// stays at a few seconds a phase: rebuilding every prefix of a corpus of `4 * size` artifacts
// generates `2 * size * (4 * size + 1)` of them, about 15 times the base phase's at these sizes.
// The floor is 4 ms, and a hosted runner's speed moves from run to run: at the earlier counts (HL7
// 192 and 16, FHIR 32 and 4, X12 96 and 8, NCPDP 64 and 8, ASTM 96 and 8) the slowest of five
// runners read clean base phases from 5.0 ms (HL7) to 10.3 ms. Each count and number of inputs
// below is about twice what that runner needed for 8 ms, so every base phase is near 16 ms or more
// there. Only the number of corpora grows, never a corpus's size, so the self-check's quadratic
// version grows in step with the clean one and its margin does not move.
const GATES: readonly Gate[] = [
  { name: "hl7Corpus", generate: (r) => hl7Corpus(r), count: 640, inputs: 40, size: 14 },
  { name: "fhirCorpus", generate: (r) => fhirCorpus(r), count: 72, inputs: 8, size: 11 },
  { name: "ccdaCorpus", generate: (r) => ccdaCorpus(r), count: 4, inputs: 1, size: 6 },
  { name: "x12Corpus", generate: (r) => x12Corpus(r), count: 224, inputs: 16, size: 15 },
  { name: "ncpdpCorpus", generate: (r) => ncpdpCorpus(r), count: 160, inputs: 20, size: 12 },
  { name: "astmCorpus", generate: (r) => astmCorpus(r), count: 192, inputs: 16, size: 16 },
];

function options(gate: Gate): ScalingGateOptions<Request, Corpus> {
  return {
    name: `@cosyte/synth ${gate.name}`,
    parse: gate.generate,
    weigh: (c) => c.artifacts.length,
    count: { n: gate.count, generate: (i) => ({ seed: i + 1, count: 1 }) },
    size: {
      inputs: gate.inputs,
      size: gate.size,
      generate: (i, size) => ({ seed: i + 1, count: size }),
    },
  };
}

/** The same corpus, every prefix built again first: the cost grows with the square of the count. */
function rebuildingEveryPrefix(generate: (request: Request) => Corpus) {
  return (request: Request): Corpus => {
    let corpus = generate({ seed: request.seed, count: 1 });
    for (let k = 2; k <= request.count; k++) corpus = generate({ seed: request.seed, count: k });
    return corpus;
  };
}

const sameCorpus = (a: Corpus, b: Corpus): boolean =>
  a.artifacts.length === b.artifacts.length &&
  a.artifacts.every((x, i) => x.content === b.artifacts[i]?.content);

/** A skip is not a pass: a gate that could not measure says so here, rather than reading green. */
function expectMeasured(report: ReturnType<typeof scalingGate>): void {
  expect(report.count.status, report.count.diagnostic).toBe("measured");
  expect(report.size.status, report.size.diagnostic).toBe("measured");
}

for (const gate of GATES) {
  describe(`the scaling gate: ${gate.name}`, () => {
    it("has not acquired a complexity regression on either axis", () => {
      expectMeasured(scalingGate(options(gate)));
    });

    it("has fixtures large enough for that gate to fail", () => {
      const report = assertScalingGateFires(options(gate), {
        regressedParse: rebuildingEveryPrefix(gate.generate),
        equals: sameCorpus,
      });
      expect(report.margin).toBeGreaterThan(1);
    });
  });
}
