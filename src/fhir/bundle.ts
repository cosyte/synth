/**
 * Synthetic FHIR R4 **`Bundle`** generation (roadmap §Phase 3) — a self-contained `collection`,
 * `transaction`, or `document` Bundle assembling a synthetic US Core `Patient` and its full clinical
 * spine (`Condition`, lab + vital-sign `Observation`s, `MedicationRequest`, `Encounter`,
 * `Immunization`, `AllergyIntolerance`, `Procedure`, `DiagnosticReport`), wired by `urn:uuid:`
 * `fullUrl`s so every intra-bundle reference resolves. Built through `@cosyte/fhir`. The `document`
 * shape (SYNTH-4) prepends the FHIR-mandated `Composition` (invariant `bdl-11`) and a synthetic
 * `Organization` author/custodian, and carries the required `identifier` + `timestamp` (`bdl-9`/`bdl-10`).
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng, type Rng } from "../rng/rng.js";
import { makeCorpus, type Corpus } from "../corpus.js";
import { bool, narrative, prop, str, toFhirDate, type Prop } from "./builder.js";
import { buildComposition, type CompositionSection } from "./composition.js";
import { generatePatient } from "./patient.js";
import { generateCondition } from "./condition.js";
import { generateObservationLab, generateVitalSign } from "./observation.js";
import { generateMedicationRequest } from "./medication-request.js";
import { generateEncounter } from "./encounter.js";
import { generateImmunization } from "./immunization.js";
import { generateAllergyIntolerance } from "./allergy-intolerance.js";
import { generateProcedure } from "./procedure.js";
import { generateDiagnosticReport } from "./diagnostic-report.js";
import { roundTrip } from "./round-trip.js";
import { safe } from "../safe/index.js";

/** The Bundle shapes `@cosyte/synth` supports. */
export type FhirBundleType = "collection" | "transaction" | "document";

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

/** A minimal synthetic `Organization` (author/custodian) — no PHI, name is clearly synthetic. */
function buildOrganization(rng: Rng): FhirComplex {
  const id = safe.identifier(rng, "AN");
  return complex([
    prop("resourceType", str("Organization")),
    prop("id", str(`syn-org-${rng.digits(8)}`)),
    prop("text", narrative("Synthetic health organization.")),
    prop(
      "identifier",
      list([
        complex([
          prop("system", str(`urn:oid:${id.assigningAuthorityOid}`)),
          prop("value", str(id.value)),
        ]),
      ]),
    ),
    prop("active", bool(true)),
    prop("name", str("Synthetic Health Organization")),
  ]);
}

/** One assembled spine member — its stable in-bundle `urn:uuid:` fullUrl and its resource model. */
interface SpineEntry {
  readonly fullUrl: string;
  readonly resource: FhirComplex;
}

/** The assembled clinical spine plus the shared patient / organization fullUrls a document references. */
interface Spine {
  readonly patientUrl: string;
  readonly orgUrl: string;
  readonly date: string;
  /** Per-kind fullUrls, for the document Composition's section entries. */
  readonly urls: Readonly<Record<string, string>>;
  /** The clinical entries (Patient first, then Organization, then the clinical resources). */
  readonly entries: readonly SpineEntry[];
}

/** Build the shared clinical spine — every reference wired to an in-bundle `urn:uuid:` fullUrl. */
function buildSpine(rng: Rng): Spine {
  const patientUrl = `urn:uuid:${safe.uuid(rng)}`;
  const orgUrl = `urn:uuid:${safe.uuid(rng)}`;
  const date = toFhirDate(safe.dateYmd(rng, 2018, 2024));

  const patient: SpineEntry = {
    fullUrl: patientUrl,
    resource: generatePatient({ seed: rng.nextUint32(), profile: "us-core" }),
  };
  const org: SpineEntry = { fullUrl: orgUrl, resource: buildOrganization(rng) };

  const condUrl = `urn:uuid:${safe.uuid(rng)}`;
  const cond = generateCondition({ seed: rng.nextUint32(), subject: patientUrl });
  const labUrl = `urn:uuid:${safe.uuid(rng)}`;
  const lab = generateObservationLab({ seed: rng.nextUint32(), subject: patientUrl });
  const vitalUrl = `urn:uuid:${safe.uuid(rng)}`;
  const vital = generateVitalSign({ seed: rng.nextUint32(), subject: patientUrl });
  const medUrl = `urn:uuid:${safe.uuid(rng)}`;
  const med = generateMedicationRequest({
    seed: rng.nextUint32(),
    subject: patientUrl,
    requester: orgUrl,
  });
  const encUrl = `urn:uuid:${safe.uuid(rng)}`;
  const enc = generateEncounter({ seed: rng.nextUint32(), subject: patientUrl });
  const immUrl = `urn:uuid:${safe.uuid(rng)}`;
  const imm = generateImmunization({ seed: rng.nextUint32(), patient: patientUrl });
  const allergyUrl = `urn:uuid:${safe.uuid(rng)}`;
  const allergy = generateAllergyIntolerance({ seed: rng.nextUint32(), patient: patientUrl });
  const procUrl = `urn:uuid:${safe.uuid(rng)}`;
  const proc = generateProcedure({ seed: rng.nextUint32(), subject: patientUrl });
  const drUrl = `urn:uuid:${safe.uuid(rng)}`;
  const dr = generateDiagnosticReport({
    seed: rng.nextUint32(),
    subject: patientUrl,
    results: [labUrl],
  });

  const entries: SpineEntry[] = [
    patient,
    org,
    { fullUrl: condUrl, resource: cond },
    { fullUrl: labUrl, resource: lab },
    { fullUrl: vitalUrl, resource: vital },
    { fullUrl: medUrl, resource: med },
    { fullUrl: encUrl, resource: enc },
    { fullUrl: immUrl, resource: imm },
    { fullUrl: allergyUrl, resource: allergy },
    { fullUrl: procUrl, resource: proc },
    { fullUrl: drUrl, resource: dr },
  ];
  const urls = {
    condition: condUrl,
    lab: labUrl,
    vital: vitalUrl,
    medication: medUrl,
    encounter: encUrl,
    immunization: immUrl,
    allergy: allergyUrl,
    procedure: procUrl,
    diagnosticReport: drUrl,
  };
  return { patientUrl, orgUrl, date, urls, entries };
}

/** The document sections summarizing the clinical spine (LOINC section codes → entry references). */
function documentSections(urls: Readonly<Record<string, string>>): CompositionSection[] {
  const at = (k: string): string[] => (urls[k] !== undefined ? [urls[k]] : []);
  return [
    { code: "11450-4", title: "Problem List", entries: at("condition") },
    {
      code: "30954-2",
      title: "Relevant Diagnostic Tests/Laboratory Data",
      entries: [...at("diagnosticReport"), ...at("lab"), ...at("vital")],
    },
    { code: "10160-0", title: "History of Medication Use", entries: at("medication") },
    { code: "48765-2", title: "Allergies and Adverse Reactions", entries: at("allergy") },
    { code: "11369-6", title: "History of Immunizations", entries: at("immunization") },
    { code: "47519-4", title: "History of Procedures", entries: at("procedure") },
    { code: "46240-8", title: "History of Encounters", entries: at("encounter") },
  ];
}

/**
 * Generate a spec-clean synthetic FHIR `Bundle` (`collection`, `transaction`, or `document`) built
 * through `@cosyte/fhir`, containing a US Core `Patient` and its full clinical spine wired by
 * `urn:uuid:` references so every reference resolves in-bundle.
 *
 * @param options - Seed and Bundle shape. See {@link GenerateBundleOptions}.
 * @returns The `Bundle` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateBundle } from "@cosyte/synth/fhir";
 * const bundle = generateBundle({ seed: 42, type: "document" });
 * ```
 */
export function generateBundle(options: GenerateBundleOptions = {}): FhirComplex {
  const { seed = 0, type = "collection" } = options;
  const rng = createRng(seed);
  const spine = buildSpine(rng);

  const members: SpineEntry[] =
    type === "document"
      ? [
          {
            fullUrl: `urn:uuid:${safe.uuid(rng)}`,
            resource: buildComposition(rng, {
              subject: spine.patientUrl,
              organization: spine.orgUrl,
              date: spine.date,
              sections: documentSections(spine.urls),
            }),
          },
          ...spine.entries,
        ]
      : [...spine.entries];

  const entries = members.map((member) => {
    const entryProps: Prop[] = [
      prop("fullUrl", str(member.fullUrl)),
      prop("resource", member.resource),
    ];
    // A document Bundle forbids entry.request/response (bdl-3a); a transaction requires request.
    if (type === "transaction") {
      entryProps.push(
        prop(
          "request",
          complex([prop("method", str("POST")), prop("url", str(resourceTypeOf(member.resource)))]),
        ),
      );
    }
    return complex(entryProps);
  });

  const props: Prop[] = [
    prop("resourceType", str("Bundle")),
    prop("id", str(`syn-bundle-${rng.digits(8)}`)),
  ];
  // A document Bundle requires an identifier (bdl-9) and a timestamp (bdl-10).
  if (type === "document") {
    const id = safe.identifier(rng, "AN");
    props.push(
      prop(
        "identifier",
        complex([
          prop("system", str(`urn:oid:${id.assigningAuthorityOid}`)),
          prop("value", str(`urn:uuid:${safe.uuid(rng)}`)),
        ]),
      ),
    );
  }
  props.push(prop("type", str(type)));
  if (type === "document") props.push(prop("timestamp", str(`${spine.date}T09:00:00.000Z`)));
  props.push(prop("entry", list(entries)));

  return complex(props);
}

/** A FHIR resource kind the {@link fhirCorpus} can generate. */
export type FhirResourceKind =
  | "Patient"
  | "USCorePatient"
  | "Condition"
  | "ObservationLab"
  | "VitalSign"
  | "MedicationRequest"
  | "Encounter"
  | "Immunization"
  | "AllergyIntolerance"
  | "Procedure"
  | "DiagnosticReport"
  | "Bundle"
  | "DocumentBundle";

/** The default corpus mix — the full US Core clinical spine plus a collection Bundle. */
const DEFAULT_MIX: readonly FhirResourceKind[] = Object.freeze([
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
    case "Encounter":
      return generateEncounter({ seed });
    case "Immunization":
      return generateImmunization({ seed });
    case "AllergyIntolerance":
      return generateAllergyIntolerance({ seed });
    case "Procedure":
      return generateProcedure({ seed });
    case "DiagnosticReport":
      return generateDiagnosticReport({ seed });
    case "Bundle":
      return generateBundle({ seed });
    case "DocumentBundle":
      return generateBundle({ seed, type: "document" });
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
 * Build a reproducible {@link Corpus} of spec-clean FHIR resources across the supported kinds. Each
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
    // collection Bundle's external reference, or the base `dom-6` narrative best-practice) are not
    // spec-cleanliness violations and are excluded here; a caller wanting the full picture calls
    // `roundTrip` directly (it exposes both `errors` and `warnings`).
    return { format: "fhir" as const, kind, content: rt.content, warnings: rt.errors };
  });
  return makeCorpus(seed, artifacts);
}
