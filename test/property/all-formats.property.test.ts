/**
 * The **consolidated conformance property suite** (roadmap §6, §Phase 9). Every one of the six
 * spec-clean format generators is driven through the **same three mandatory properties** — so no format
 * can silently ship without one, and a new format added later fails this suite until it satisfies all
 * three:
 *
 *   1. **round-trip** — every generated artifact round-trips through its own parser with **zero
 *      warnings** (spec-clean by construction, judged by the parser, not by `synth`);
 *   2. **seed-determinism** — the same seed yields byte-identical artifacts, twice;
 *   3. **synthetic-safety** — no emitted value escapes the reserved / synthetic sources (the inverse of
 *      `deid`'s leak test — must be ZERO).
 *
 * Plus the **intended-warning** property for the three quirk formats (HL7 v2 / C-CDA / ASTM): a quirk
 * corpus is deliberately off-spec, so every quirk artifact must carry a **non-empty** intended-warning
 * set (a quirk that produced no coded deviation is a vacuous quirk) while synthetic-safety **still**
 * holds over the quirk output (a quirk changes structure, never provenance — roadmap §7).
 *
 * Non-vacuity is asserted directly: the format registry is proved to cover every {@link SynthFormat},
 * every corpus is proved non-empty with non-trivial content, and the per-format synthetic-safety loci
 * are checked, on the *parsed* wire value, by each format's own structured suite —
 * `test/<fmt>/synthetic-safety.property.test.ts` for FHIR/C-CDA/X12/NCPDP/ASTM and
 * `test/hl7/round-trip.test.ts` for HL7 v2. This file is the cross-cutting union that guarantees
 * uniform round-trip + seed-determinism coverage plus a conservative synthetic-safety text floor.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  isSyntheticSsn,
  isSyntheticEmail,
  type Corpus,
  type SynthFormat,
} from "../../src/index.js";
import { hl7Corpus } from "../../src/hl7/index.js";
import { fhirCorpus } from "../../src/fhir/index.js";
import { ccdaCorpus } from "../../src/ccda/index.js";
import { x12Corpus } from "../../src/x12/index.js";
import { ncpdpCorpus } from "../../src/ncpdp/index.js";
import { astmCorpus } from "../../src/astm/index.js";
import { hl7QuirkCorpus } from "../../src/hl7/index.js";
import { ccdaQuirkCorpus } from "../../src/ccda/index.js";
import { astmQuirkCorpus } from "../../src/astm/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });
const count = (): fc.Arbitrary<number> => fc.integer({ min: 1, max: 4 });

/**
 * This is the cross-format **union** suite — its value is uniform coverage (every format exercised
 * through every mandatory property), not a high case count (each format's own
 * `test/<fmt>/*.property.test.ts` carries the deep sweeps). `synth` generation through a full parser
 * builder + round-trip is heavy per case — C-CDA XML and FHIR validation especially — so the heavy
 * formats run fewer cases and every property test carries an explicit long timeout.
 */
const RUNS_FOR = (format: string): number => (format === "ccda" || format === "fhir" ? 25 : 100);
const TEST_TIMEOUT_MS = 120_000;

/** A uniform corpus factory: `{ seed, count }` in, a {@link Corpus} out. Every format ships one. */
type CorpusFactory = (opts: { seed: number; count?: number }) => Corpus;

/** The six spec-clean format generators, keyed by the format they emit. */
const SPEC_CLEAN: ReadonlyArray<readonly [SynthFormat, CorpusFactory]> = [
  ["hl7v2", hl7Corpus],
  ["fhir", fhirCorpus],
  ["ccda", ccdaCorpus],
  ["x12", x12Corpus],
  ["ncpdp", ncpdpCorpus],
  ["astm", astmCorpus],
];

/** Every format the `Corpus` model knows about — the registry must cover all of them (non-vacuity). */
const ALL_FORMATS: readonly SynthFormat[] = ["hl7v2", "fhir", "ccda", "x12", "ncpdp", "astm"];

/**
 * A conservative whole-content real-data floor: any **dashed** SSN in an issuable-area form, or any
 * email on a non-reserved domain. A hit means a plausibly-real value escaped. It fires for formats that
 * emit dashed SSNs / emails (C-CDA, FHIR); formats that emit **undashed** wire SSNs (HL7/X12/NCPDP/ASTM)
 * are gated authoritatively on the parsed locus by their own structured suites (NPI Luhn, DEA checksum,
 * synthetic-AA scoping included). This text floor is an additional cross-cutting check, not the sole
 * synthetic-safety gate.
 */
function realDataHits(content: string): string[] {
  const hits: string[] = [];
  for (const m of content.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    if (!isSyntheticSsn(m[0])) hits.push(`ssn:${m[0]}`);
  }
  for (const m of content.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)) {
    if (!isSyntheticEmail(m[0])) hits.push(`email:${m[0]}`);
  }
  return hits;
}

describe("consolidated property suite — every format satisfies the three mandatory properties", () => {
  it("the registry covers every SynthFormat (non-vacuity — no format is silently skipped)", () => {
    const covered = new Set(SPEC_CLEAN.map(([fmt]) => fmt));
    for (const fmt of ALL_FORMATS) expect(covered.has(fmt), `format ${fmt} untested`).toBe(true);
    expect(covered.size).toBe(ALL_FORMATS.length);
  });

  for (const [format, makeCorpusFor] of SPEC_CLEAN) {
    describe(format, () => {
      it(
        "round-trip: every artifact is spec-clean (zero parser warnings) and the corpus is non-empty",
        () => {
          fc.assert(
            fc.property(seed(), count(), (s, n) => {
              const corpus = makeCorpusFor({ seed: s, count: n });
              expect(corpus.artifacts.length, "non-vacuous corpus").toBeGreaterThan(0);
              for (const artifact of corpus.artifacts) {
                expect(artifact.format).toBe(format);
                expect(artifact.content.length, "non-trivial content").toBeGreaterThan(0);
                expect(artifact.warnings, `${format}/${artifact.kind} seed=${String(s)}`).toEqual(
                  [],
                );
              }
            }),
            { numRuns: RUNS_FOR(format) },
          );
        },
        TEST_TIMEOUT_MS,
      );

      it(
        "seed-determinism: the same seed yields byte-identical artifacts, twice",
        () => {
          fc.assert(
            fc.property(seed(), count(), (s, n) => {
              const a = makeCorpusFor({ seed: s, count: n }).artifacts.map((x) => x.content);
              const b = makeCorpusFor({ seed: s, count: n }).artifacts.map((x) => x.content);
              expect(a).toEqual(b);
            }),
            { numRuns: RUNS_FOR(format) },
          );
        },
        TEST_TIMEOUT_MS,
      );

      it(
        "synthetic-safety: no artifact leaks a plausibly-real value (must be ZERO)",
        () => {
          fc.assert(
            fc.property(seed(), count(), (s, n) => {
              for (const artifact of makeCorpusFor({ seed: s, count: n }).artifacts) {
                expect(realDataHits(artifact.content), `${format}/${artifact.kind}`).toEqual([]);
              }
            }),
            { numRuns: RUNS_FOR(format) },
          );
        },
        TEST_TIMEOUT_MS,
      );
    });
  }
});

describe("intended-warning property — quirk corpora are non-vacuous and stay synthetic-safe", () => {
  const QUIRK: ReadonlyArray<readonly [string, CorpusFactory]> = [
    ["hl7v2", hl7QuirkCorpus],
    ["ccda", ccdaQuirkCorpus],
    ["astm", astmQuirkCorpus],
  ];

  for (const [format, makeQuirkCorpus] of QUIRK) {
    it(
      `${format}: every quirk artifact carries a non-empty intended-warning set and leaks nothing`,
      () => {
        fc.assert(
          fc.property(seed(), count(), (s, n) => {
            const corpus = makeQuirkCorpus({ seed: s, count: n });
            expect(corpus.artifacts.length).toBeGreaterThan(0);
            // The manifest records the quirks it injected — a spec-clean-only run would be empty.
            expect(corpus.manifest.quirks.length).toBeGreaterThan(0);
            for (const artifact of corpus.artifacts) {
              // A quirk is deliberately off-spec: it MUST produce at least one coded deviation, else
              // the "quirk" is a vacuous no-op. (Exact intended-warning match is gated per-format in
              // test/<fmt>/quirk.test.ts against the real parser.)
              expect(artifact.warnings.length, `${format}/${artifact.kind}`).toBeGreaterThan(0);
              // Deviating structure never introduces a real-looking value — safety still holds.
              expect(realDataHits(artifact.content), `${format}/${artifact.kind}`).toEqual([]);
            }
          }),
          { numRuns: RUNS_FOR(format) },
        );
      },
      TEST_TIMEOUT_MS,
    );
  }
});
