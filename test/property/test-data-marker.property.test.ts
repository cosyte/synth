/**
 * Every artifact says it is test data, in the field its standard gives for that.
 *
 * Output realistic enough to pass for real is the hazard this package exists to avoid, so where a
 * format's standard defines a test-or-production marker, every artifact sets it to test:
 *
 * - **HL7 v2**: `MSH-11` processing ID `T` (HL7 table 0103: `D` debugging, `P` production, `T`
 *   training). Quirk messages included.
 * - **FHIR**: every resource, and every resource inside a Bundle, and the Bundle itself, carries the
 *   security label `HTEST` ("test health data") from `http://terminology.hl7.org/CodeSystem/v3-ActReason`
 *   in `meta.security`.
 * - **X12**: `ISA-15` usage indicator `T` (test).
 * - **ASTM**: `H.12` processing ID `T` (`P` production, `T` training, `D` debugging, `Q` quality
 *   control). Quirk messages included.
 *
 * Two formats have no marker to set, and the registry below names each with its reason, so a format
 * cannot drop out of this suite unnoticed:
 *
 * - **C-CDA**: the CDA header has no test-or-production field.
 * - **NCPDP**: the Telecommunication request header has no such field, and the SCRIPT header model in
 *   `@cosyte/ncpdp` carries none.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { Corpus, SynthFormat } from "../../src/index.js";
import { hl7Corpus, hl7QuirkCorpus } from "../../src/hl7/index.js";
import { fhirCorpus, type FhirResourceKind } from "../../src/fhir/index.js";
import { ccdaCorpus } from "../../src/ccda/index.js";
import { x12Corpus } from "../../src/x12/index.js";
import { ncpdpCorpus } from "../../src/ncpdp/index.js";
import { astmCorpus, astmQuirkCorpus } from "../../src/astm/index.js";
import { checkProperty, propertyTimeout } from "../support/property.js";

const seed = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 2 ** 31 - 1 });
const count = (): fc.Arbitrary<number> => fc.integer({ min: 1, max: 4 });
const TEST_TIMEOUT_MS = 120_000;

/** The FHIR code system and code that label a resource as test data. */
const ACT_REASON = "http://terminology.hl7.org/CodeSystem/v3-ActReason";
const HTEST = "HTEST";

/** Every FHIR kind the corpus generates, so a base Patient and both Bundle shapes are covered. */
const FHIR_KINDS: readonly FhirResourceKind[] = [
  "Patient",
  "USCorePatient",
  "Condition",
  "ObservationLab",
  "VitalSign",
  "MedicationRequest",
  "Encounter",
  "Immunization",
  "AllergyIntolerance",
  "Procedure",
  "DiagnosticReport",
  "Bundle",
  "DocumentBundle",
];

/** `MSH-11` of an HL7 v2 message: field 11, which is index 10 once `MSH-1` is the separator. */
function hl7ProcessingId(content: string): string | undefined {
  const msh = content.split("\r").find((segment) => segment.startsWith("MSH"));
  return msh?.split(msh.charAt(3))[10];
}

/** `H.12` of an ASTM message: field 12 of the first record, which is index 11. */
function astmProcessingId(content: string): string | undefined {
  const header = content.split("\r")[0] ?? "";
  if (!header.startsWith("H")) return undefined;
  return header.split(header.charAt(1))[11];
}

/** `ISA-15` of an X12 interchange: element 15 of the fixed-width `ISA` segment. */
function x12UsageIndicator(content: string): string | undefined {
  if (!content.startsWith("ISA")) return undefined;
  return content.split(content.charAt(3))[15];
}

/** Every object in a parsed FHIR artifact that has a `resourceType`: the artifact and its entries. */
function fhirResources(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap((item) => fhirResources(item));
  if (node === null || typeof node !== "object") return [];
  const record = node as Record<string, unknown>;
  const own = typeof record["resourceType"] === "string" ? [record] : [];
  return [...own, ...Object.values(record).flatMap((value) => fhirResources(value))];
}

/** Whether one FHIR resource carries the `HTEST` security label in `meta.security`. */
function fhirIsLabelledTest(resource: Record<string, unknown>): boolean {
  const meta = resource["meta"] as { security?: { system?: string; code?: string }[] } | undefined;
  return (meta?.security ?? []).some(
    (label) => label.system === ACT_REASON && label.code === HTEST,
  );
}

/** The resource types in a FHIR artifact that do not carry the `HTEST` label. */
function fhirUnlabelled(content: string): string[] {
  return fhirResources(JSON.parse(content))
    .filter((resource) => !fhirIsLabelledTest(resource))
    .map((resource) => String(resource["resourceType"]));
}

/** How one format marks an artifact as test data, or why it cannot. */
type Marker =
  | { readonly kind: "marked"; readonly unmarked: (content: string) => readonly string[] }
  | { readonly kind: "none"; readonly reason: string };

/** Returns the one finding when `actual` is not `T`, else none. */
const expectT =
  (field: string, read: (content: string) => string | undefined) =>
  (content: string): readonly string[] => {
    const actual = read(content);
    return actual === "T" ? [] : [`${field}=${String(actual)}`];
  };

const MARKERS: Readonly<Record<SynthFormat, Marker>> = {
  hl7v2: { kind: "marked", unmarked: expectT("MSH-11", hl7ProcessingId) },
  fhir: { kind: "marked", unmarked: fhirUnlabelled },
  x12: { kind: "marked", unmarked: expectT("ISA-15", x12UsageIndicator) },
  astm: { kind: "marked", unmarked: expectT("H.12", astmProcessingId) },
  ccda: { kind: "none", reason: "the CDA header has no test-or-production field" },
  ncpdp: {
    kind: "none",
    reason:
      "the Telecommunication header has no such field and the SCRIPT header model carries none",
  },
};

type CorpusFactory = (seed: number, count: number) => Corpus;

/** Every corpus this package generates, spec-clean and quirk, and the format each one emits. */
const CORPORA: ReadonlyArray<readonly [string, SynthFormat, CorpusFactory]> = [
  ["hl7Corpus", "hl7v2", (s, n) => hl7Corpus({ seed: s, count: n })],
  ["hl7QuirkCorpus", "hl7v2", (s, n) => hl7QuirkCorpus({ seed: s, count: n })],
  ["fhirCorpus", "fhir", (s, n) => fhirCorpus({ seed: s, count: n, mix: FHIR_KINDS })],
  [
    "fhirCorpus (every kind)",
    "fhir",
    (s) => fhirCorpus({ seed: s, count: FHIR_KINDS.length, mix: FHIR_KINDS }),
  ],
  ["x12Corpus", "x12", (s, n) => x12Corpus({ seed: s, count: n })],
  ["astmCorpus", "astm", (s, n) => astmCorpus({ seed: s, count: n })],
  ["astmQuirkCorpus", "astm", (s, n) => astmQuirkCorpus({ seed: s, count: n })],
  ["ccdaCorpus", "ccda", (s, n) => ccdaCorpus({ seed: s, count: n })],
  ["ncpdpCorpus", "ncpdp", (s, n) => ncpdpCorpus({ seed: s, count: n })],
];

const ALL_FORMATS: readonly SynthFormat[] = ["hl7v2", "fhir", "ccda", "x12", "ncpdp", "astm"];

describe("every artifact says it is test data, where its standard has a field for it", () => {
  it("every format is either marked or named with the reason it has no marker", () => {
    for (const format of ALL_FORMATS) {
      expect(MARKERS[format], format).toBeDefined();
      expect(
        CORPORA.some(([, f]) => f === format),
        `no corpus for ${format}`,
      ).toBe(true);
    }
    const unmarked = ALL_FORMATS.filter((format) => MARKERS[format].kind === "none");
    expect(unmarked).toEqual(["ccda", "ncpdp"]);
  });

  it("each reader finds a production marker when there is one (not vacuous)", () => {
    const hl7 = hl7Corpus({ seed: 1, count: 1 }).artifacts[0]?.content ?? "";
    const production = hl7.replace(/^(MSH(?:\|[^|\r]*){9})\|T\|/, "$1|P|");
    expect(production).not.toBe(hl7);
    expect(expectT("MSH-11", hl7ProcessingId)(production)).toEqual(["MSH-11=P"]);

    const astm = astmCorpus({ seed: 1, count: 1 }).artifacts[0]?.content ?? "";
    const astmProduction = astm.replace(/^(H(?:\|[^|\r]*){10})\|T/, "$1|P");
    expect(astmProduction).not.toBe(astm);
    expect(expectT("H.12", astmProcessingId)(astmProduction)).toEqual(["H.12=P"]);
    expect(astmProcessingId("P|1")).toBeUndefined();

    const x12 = x12Corpus({ seed: 1, count: 1 }).artifacts[0]?.content ?? "";
    const x12Production = x12.replace(/^((?:[^*]*\*){15})T/, "$1P");
    expect(x12Production).not.toBe(x12);
    expect(expectT("ISA-15", x12UsageIndicator)(x12Production)).toEqual(["ISA-15=P"]);
    expect(x12UsageIndicator("GS*HC")).toBeUndefined();

    expect(fhirUnlabelled(JSON.stringify({ resourceType: "Patient" }))).toEqual(["Patient"]);
    expect(
      fhirUnlabelled(
        JSON.stringify({
          resourceType: "Bundle",
          meta: { security: [{ system: ACT_REASON, code: HTEST }] },
          entry: [{ resource: { resourceType: "Patient", meta: { profile: ["x"] } } }],
        }),
      ),
    ).toEqual(["Patient"]);
  });

  for (const [name, format, make] of CORPORA) {
    const marker = MARKERS[format];
    if (marker.kind === "none") continue;
    it(
      `${name}: every artifact carries the test marker`,
      () => {
        checkProperty(
          fc.property(seed(), count(), (s, n) => {
            const corpus = make(s, n);
            expect(corpus.artifacts.length).toBeGreaterThan(0);
            for (const artifact of corpus.artifacts) {
              expect(artifact.format).toBe(format);
              expect(marker.unmarked(artifact.content), `${name}/${artifact.kind}`).toEqual([]);
            }
          }),
        );
      },
      propertyTimeout(TEST_TIMEOUT_MS),
    );
  }
});
