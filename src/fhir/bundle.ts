/**
 * Synthetic FHIR R4 **`Bundle`** generation (roadmap §Phase 3) — a self-contained `collection` or
 * `transaction` Bundle assembling a synthetic US Core `Patient` and its clinical spine (`Condition`,
 * lab + vital-sign `Observation`s, `MedicationRequest`), wired by `urn:uuid:` `fullUrl`s so every
 * intra-bundle `subject` reference resolves. Built through `@cosyte/fhir`; the `document` shape (which
 * requires a `Composition`) is deferred to SYNTH-4.
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";
import { prop, str, type Prop } from "./builder.js";
import { generatePatient } from "./patient.js";
import { generateCondition } from "./condition.js";
import { generateObservationLab, generateVitalSign } from "./observation.js";
import { generateMedicationRequest } from "./medication-request.js";
import { roundTrip } from "./round-trip.js";
import { safe } from "../safe/index.js";

/** The Bundle shapes Phase 3 supports (`document` is deferred to SYNTH-4). */
export type FhirBundleType = "collection" | "transaction";

/** Options for {@link generateBundle}. */
export interface GenerateBundleOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The Bundle shape. Defaults to `"collection"`. */
  readonly type?: FhirBundleType;
}

/** The `resourceType` string of a generated resource (its `request.url` in a transaction Bundle). */
function resourceTypeOf(resource: FhirComplex): string {
  const rt = resource.properties.find((p) => p.name === "resourceType");
  return rt !== undefined && rt.value.kind === "primitive" ? String(rt.value.value) : "Resource";
}

/**
 * Generate a spec-clean synthetic FHIR `Bundle` (collection or transaction) built through
 * `@cosyte/fhir`, containing a US Core `Patient` and its clinical spine wired by `urn:uuid:` references.
 *
 * @param options - Seed and Bundle shape. See {@link GenerateBundleOptions}.
 * @returns The `Bundle` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateBundle } from "@cosyte/synth/fhir";
 * const bundle = generateBundle({ seed: 42, type: "transaction" });
 * ```
 */
export function generateBundle(options: GenerateBundleOptions = {}): FhirComplex {
  const { seed = 0, type = "collection" } = options;
  const rng = createRng(seed);

  // A stable per-entry fullUrl (urn:uuid) so intra-bundle references resolve; the patient's is the
  // subject every clinical resource points at.
  const patientUrl = `urn:uuid:${safe.uuid(rng)}`;
  const resources: FhirComplex[] = [
    generatePatient({ seed: rng.nextUint32(), profile: "us-core" }),
    generateCondition({ seed: rng.nextUint32(), subject: patientUrl }),
    generateObservationLab({ seed: rng.nextUint32(), subject: patientUrl }),
    generateVitalSign({ seed: rng.nextUint32(), subject: patientUrl }),
    generateMedicationRequest({ seed: rng.nextUint32(), subject: patientUrl }),
  ];
  const fullUrls = [patientUrl, ...resources.slice(1).map(() => `urn:uuid:${safe.uuid(rng)}`)];

  const entries = resources.map((resource, i) => {
    const entryProps: Prop[] = [
      prop("fullUrl", str(fullUrls[i] ?? "")),
      prop("resource", resource),
    ];
    if (type === "transaction") {
      entryProps.push(
        prop(
          "request",
          complex([prop("method", str("POST")), prop("url", str(resourceTypeOf(resource)))]),
        ),
      );
    }
    return complex(entryProps);
  });

  return complex([
    prop("resourceType", str("Bundle")),
    prop("id", str(`syn-bundle-${rng.digits(8)}`)),
    prop("type", str(type)),
    prop("entry", list(entries)),
  ]);
}

/** A FHIR resource kind the {@link fhirCorpus} can generate. */
export type FhirResourceKind =
  | "Patient"
  | "USCorePatient"
  | "Condition"
  | "ObservationLab"
  | "VitalSign"
  | "MedicationRequest"
  | "Bundle";

/** The default corpus mix — the full US Core clinical spine plus a collection Bundle. */
const DEFAULT_MIX: readonly FhirResourceKind[] = Object.freeze([
  "USCorePatient",
  "Condition",
  "ObservationLab",
  "VitalSign",
  "MedicationRequest",
  "Bundle",
]);

/** Generate one resource of the given kind from a seed. */
function generateKind(kind: FhirResourceKind, seed: number): FhirComplex {
  switch (kind) {
    case "Patient":
      return generatePatient({ seed, profile: "base" });
    case "USCorePatient":
      return generatePatient({ seed, profile: "us-core" });
    case "Condition":
      return generateCondition({ seed });
    case "ObservationLab":
      return generateObservationLab({ seed });
    case "VitalSign":
      return generateVitalSign({ seed });
    case "MedicationRequest":
      return generateMedicationRequest({ seed });
    case "Bundle":
      return generateBundle({ seed });
  }
}

/** Options for {@link fhirCorpus}. */
export interface FhirCorpusOptions {
  /** The seed for the whole corpus (deterministic). */
  readonly seed: number;
  /** How many resources to generate. Defaults to `1`. */
  readonly count?: number;
  /** The resource kinds to cycle through. Defaults to the full US Core clinical spine + a Bundle. */
  readonly mix?: readonly FhirResourceKind[];
}

/**
 * Build a reproducible {@link Corpus} of spec-clean FHIR resources across the Phase-3 kinds. Each
 * resource is generated from a distinct sub-seed derived from the corpus seed and round-tripped through
 * `@cosyte/fhir`; the per-artifact `warnings` record the validator's non-informational findings (empty
 * ⇒ spec-clean, no US Core profiles supplied). Pass US Core `StructureDefinition`s to a per-resource
 * {@link roundTrip} call to additionally assert profile conformance (BYO — none is bundled).
 *
 * @param options - Seed, count, and the resource mix. See {@link FhirCorpusOptions}.
 * @returns A deep-frozen {@link Corpus}.
 * @example
 * ```ts
 * import { fhirCorpus } from "@cosyte/synth/fhir";
 * const corpus = fhirCorpus({ seed: 42, count: 6 });
 * corpus.artifacts.every((a) => a.warnings.length === 0); // spec-clean (structural)
 * ```
 */
export function fhirCorpus(options: FhirCorpusOptions): Corpus {
  const { seed, count = 1 } = options;
  const kinds = options.mix ?? DEFAULT_MIX;
  const seedStream = createRng(seed);
  const artifacts = Array.from({ length: count }, (_unused, i) => {
    const kind = kinds[i % kinds.length] ?? "USCorePatient";
    const rt = roundTrip(generateKind(kind, seedStream.nextUint32()));
    // The artifact records the findings that break spec-cleanliness — validator **errors** (empty ⇒
    // spec-clean). Advisory warnings a legal resource may carry (e.g. `REFERENCE_UNRESOLVED` on a
    // collection Bundle's external `requester` reference, or the base `dom-6` narrative best-practice)
    // are not spec-cleanliness violations and are excluded here; a caller wanting the full picture
    // calls `roundTrip` directly (it exposes both `errors` and `warnings`).
    return { format: "fhir" as const, kind, content: rt.content, warnings: rt.errors };
  });
  return makeCorpus(seed, artifacts);
}
