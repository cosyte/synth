/**
 * The **synthetic-safety gate** for FHIR (roadmap §4.4, §6: mandatory, must be ZERO). For arbitrary
 * seeds and every Phase-3 resource, **no emitted value falls outside a reserved / synthetic source**,
 * so no generated resource can carry real or plausibly-real PHI (roadmap §4.5, the synthetic-safety
 * breach head the refuter attacks).
 *
 * Two sweeps: a **raw cross-cutting sweep** (no issuable-area dashed SSN, no non-reserved email, anywhere
 * in the serialized JSON) and a **structured sweep** that walks the resource model at every identity
 * locus, `HumanName` (names from the shipped pool), phone `ContactPoint` (reserved `555-01xx`), email
 * `ContactPoint` (`example.*`), `Patient.identifier` (synthetic assigning-authority OID), and the
 * reserved non-real ZIP.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { serializeResource } from "@cosyte/fhir";

import {
  isSyntheticEmail,
  isItinFormatted,
  isSyntheticPhone,
  isSyntheticSsn,
  SYNTHETIC_FAMILY_NAMES,
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_ASSIGNING_AUTHORITY,
} from "../../src/index.js";
import {
  generateAllergyIntolerance,
  generateBundle,
  generateCondition,
  generateDiagnosticReport,
  generateEncounter,
  generateImmunization,
  generateMedicationRequest,
  generateObservationLab,
  generatePatient,
  generateProcedure,
  generateProvenance,
  generateVitalSign,
} from "../../src/fhir/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

const NAME_POOL = new Set<string>([...SYNTHETIC_GIVEN_NAMES, ...SYNTHETIC_FAMILY_NAMES]);
const SYNTH_OID = `urn:oid:${SYNTHETIC_ASSIGNING_AUTHORITY.universalId}`;

/**
 * The **SSN-locus floor**, applied to one value. Two federal authorities share this number space:
 * SSA never issues area `000`/`666`/`900-999`, and the IRS issues ITINs *inside* `900-999`, told
 * apart by the group digits. A value must clear both, so an ITIN-formatted one is a hit even
 * though the never-issued area half passes it.
 */
function ssnLocusHits(value: string): string[] {
  if (!isSyntheticSsn(value)) return [`ssn:${value}`];
  if (isItinFormatted(value)) return [`itin:${value}`];
  return [];
}

/**
 * A conservative real-data sweep: any dashed SSN in issuable-area or ITIN-formatted form, or any
 * non-reserved email.
 */
function realDataHits(content: string): string[] {
  const hits: string[] = [];
  for (const m of content.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    hits.push(...ssnLocusHits(m[0]));
  }
  for (const m of content.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)) {
    if (!isSyntheticEmail(m[0])) hits.push(`email:${m[0]}`);
  }
  return hits;
}

/** Structured sweep over a parsed FHIR JSON tree; pushes a hit for any non-synthetic identity value. */
function structuredHits(json: unknown): string[] {
  const hits: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    // HumanName: every family/given token must be from the shipped pool.
    if ("family" in obj && typeof obj["family"] === "string" && !NAME_POOL.has(obj["family"])) {
      hits.push(`family:${obj["family"]}`);
    }
    if (Array.isArray(obj["given"])) {
      for (const g of obj["given"]) {
        if (typeof g === "string" && !NAME_POOL.has(g)) hits.push(`given:${g}`);
      }
    }
    // ContactPoint, phone reserved, email reserved.
    if (
      obj["system"] === "phone" &&
      typeof obj["value"] === "string" &&
      !isSyntheticPhone(obj["value"])
    ) {
      hits.push(`phone:${obj["value"]}`);
    }
    if (
      obj["system"] === "email" &&
      typeof obj["value"] === "string" &&
      !isSyntheticEmail(obj["value"])
    ) {
      hits.push(`email:${obj["value"]}`);
    }
    for (const v of Object.values(obj)) visit(v);
  };
  visit(json);
  return hits;
}

// EXPLICIT 60 s CEILINGS ON ALL FOUR SWEEPS, not a change to the global `testTimeout`.
//
// This is a MANDATORY synthetic-safety gate, and it runs the highest case counts in the package
// (250/250/200/200). Measured sharing a core, the first sweep took 2.31 s against the 10 s global,
// and the same run scaled the package's other unbounded tests by ~1.22x, so under v8 coverage it
// lands near 2.8 s: roughly 3.5x headroom, the smallest of anything still on the global here.
//
// That is not near the wall today, and the ceiling is pre-emptive rather than a fix for an observed
// red. It is applied because of WHAT this suite is: the executable proof that nothing emitted can be
// real or plausibly-real PHI. A gate in that class should not be the one that reds for want of CPU,
// because a safety check that cries wolf is the one people learn to re-run rather than read.
//
// A ceiling and not a smaller `numRuns`: the case count IS the strength of a synthetic-safety sweep.
describe("synthetic-safety gate, generated FHIR output (must be ZERO)", () => {
  it("no resource leaks a real-data SSN or non-reserved email shape", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const resources = [
          generatePatient({ seed: s, profile: "us-core" }),
          generateCondition({ seed: s }),
          generateObservationLab({ seed: s }),
          generateVitalSign({ seed: s }),
          generateMedicationRequest({ seed: s }),
          generateEncounter({ seed: s }),
          generateImmunization({ seed: s }),
          generateAllergyIntolerance({ seed: s }),
          generateProcedure({ seed: s }),
          generateDiagnosticReport({ seed: s }),
          generateProvenance({ seed: s }),
          generateBundle({ seed: s, type: "transaction" }),
          generateBundle({ seed: s, type: "document" }),
        ];
        for (const r of resources) {
          expect(realDataHits(serializeResource(r))).toEqual([]);
        }
      }),
      { numRuns: 250 },
    );
  }, 60_000);

  it("the sweep FAILS on an ITIN-formatted SSN in a resource (true positive, not vacuous)", () => {
    // The sweeps above only ever see values the (fixed) generator emits, so the ITIN arm is never
    // exercised by real output. Inject a known-bad value into a real serialized resource and
    // require the sweep itself to report a hit.
    const ITIN_SHAPED = "987-65-4320"; // area 987 (SSA never issues it) + group 65, inside 50-65
    expect(isSyntheticSsn(ITIN_SHAPED), "the pre-existing area rule passes it").toBe(true);
    const json = serializeResource(generatePatient({ seed: 5150, profile: "us-core" }));
    expect(realDataHits(json)).toEqual([]);
    expect(realDataHits(`${json} ${ITIN_SHAPED}`)).toEqual([`itin:${ITIN_SHAPED}`]);
  });

  it("every Patient identity locus is provably synthetic", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const json = JSON.parse(
          serializeResource(generatePatient({ seed: s, profile: "us-core" })),
        ) as {
          identifier: { system: string }[];
        };
        expect(structuredHits(json)).toEqual([]);
        // The MRN lives under the synthetic assigning-authority OID, never a real facility namespace.
        expect(json.identifier[0]?.system).toBe(SYNTH_OID);
      }),
      { numRuns: 250 },
    );
  }, 60_000);

  it("a Bundle's every contained resource is synthetic at every identity locus", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const json: unknown = JSON.parse(
          serializeResource(generateBundle({ seed: s, type: "collection" })),
        );
        expect(structuredHits(json)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  }, 60_000);

  it("a document Bundle (Composition + full spine) is synthetic at every identity locus", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const content = serializeResource(generateBundle({ seed: s, type: "document" }));
        expect(realDataHits(content)).toEqual([]);
        expect(structuredHits(JSON.parse(content))).toEqual([]);
      }),
      { numRuns: 200 },
    );
  }, 60_000);
});
