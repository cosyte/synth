/**
 * The **synthetic-safety gate** for FHIR (roadmap §4.4, §6 — mandatory, must be ZERO). For arbitrary
 * seeds and every Phase-3 resource, **no emitted value falls outside a reserved / synthetic source** —
 * so no generated resource can carry real or plausibly-real PHI (roadmap §4.5, the synthetic-safety
 * breach head the refuter attacks).
 *
 * Two sweeps: a **raw cross-cutting sweep** (no issuable-area dashed SSN, no non-reserved email, anywhere
 * in the serialized JSON) and a **structured sweep** that walks the resource model at every identity
 * locus — `HumanName` (names from the shipped pool), phone `ContactPoint` (reserved `555-01xx`), email
 * `ContactPoint` (`example.*`), `Patient.identifier` (synthetic assigning-authority OID), and the
 * reserved non-real ZIP.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { serializeResource } from "@cosyte/fhir";

import {
  isSyntheticEmail,
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
  generateVitalSign,
} from "../../src/fhir/index.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });

const NAME_POOL = new Set<string>([...SYNTHETIC_GIVEN_NAMES, ...SYNTHETIC_FAMILY_NAMES]);
const SYNTH_OID = `urn:oid:${SYNTHETIC_ASSIGNING_AUTHORITY.universalId}`;

/** A conservative real-data sweep: any issuable-area dashed SSN, or any non-reserved email. */
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

    // HumanName — every family/given token must be from the shipped pool.
    if ("family" in obj && typeof obj["family"] === "string" && !NAME_POOL.has(obj["family"])) {
      hits.push(`family:${obj["family"]}`);
    }
    if (Array.isArray(obj["given"])) {
      for (const g of obj["given"]) {
        if (typeof g === "string" && !NAME_POOL.has(g)) hits.push(`given:${g}`);
      }
    }
    // ContactPoint — phone reserved, email reserved.
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

describe("synthetic-safety gate — generated FHIR output (must be ZERO)", () => {
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
          generateBundle({ seed: s, type: "transaction" }),
          generateBundle({ seed: s, type: "document" }),
        ];
        for (const r of resources) {
          expect(realDataHits(serializeResource(r))).toEqual([]);
        }
      }),
      { numRuns: 250 },
    );
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
        // The MRN lives under the synthetic assigning-authority OID — never a real facility namespace.
        expect(json.identifier[0]?.system).toBe(SYNTH_OID);
      }),
      { numRuns: 250 },
    );
  });

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
  });

  it("a document Bundle (Composition + full spine) is synthetic at every identity locus", () => {
    fc.assert(
      fc.property(seed(), (s) => {
        const content = serializeResource(generateBundle({ seed: s, type: "document" }));
        expect(realDataHits(content)).toEqual([]);
        expect(structuredHits(JSON.parse(content))).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});
