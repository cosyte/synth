/**
 * `@cosyte/synth/deid` — the **`@cosyte/deid` pairing loop** (roadmap §Phase 8): a deterministic,
 * seeded **co-validation harness** for the `synth` ⇄ `deid` pair.
 *
 * For each covered format it **generates** a spec-clean synthetic artifact through `@cosyte/synth`'s own
 * generators, **enumerates** the distinctive synthetic PHI sentinels planted at the patient loci,
 * **de-identifies** it through `@cosyte/deid`, and **verifies** that every planted sentinel is gone from
 * the de-identified output while the clinical payload survives. A surviving sentinel is a hard failure;
 * an over-scrubbed clinical value is a hard failure.
 *
 * **Scope & honesty (roadmap §Phase 8, §7).** This proves *the pair works on `synth`'s own output* — it
 * is **not** an independent audit of `@cosyte/deid` against real-world documents. The sentinels are
 * synthetic-by-construction (never realistic); a sentinel `deid` **blocks** rather than redacts still
 * passes (blocked = gone). The loop covers the five formats both packages support
 * ({@link DEID_LOOP_COVERED_FORMATS}); NCPDP **SCRIPT**, **ASTM**, and **DICOM** are **skipped and
 * named** ({@link DEID_LOOP_SKIPPED}), never silently. `@cosyte/deid` is an **optional peer dependency**
 * (the `mllp`/`ncpdp` vendoring pattern); importing this subpath pulls it in.
 *
 * @module
 */

import { deidentifyHl7, extractHl7Loci } from "@cosyte/deid/hl7";
import { deidentifyFhir, extractFhirLoci } from "@cosyte/deid/fhir";
import { deidentifyX12, extractX12Loci } from "@cosyte/deid/x12";
import { deidentifyTelecom, extractTelecomLoci } from "@cosyte/deid/ncpdp";
import { deidentifyCcda } from "@cosyte/deid/ccda";
import { serializeResource } from "@cosyte/fhir";
import { serializeX12, parseX12, type X12Interchange } from "@cosyte/x12";
import { serializeCcda } from "@cosyte/ccda";
import { parseTelecom } from "@cosyte/ncpdp/telecom";
import type { GenericLocus } from "@cosyte/deid";

import { generateHl7, type Hl7MessageKind } from "../hl7/index.js";
import { generateBundle } from "../fhir/index.js";
import {
  generate837P,
  generate837I,
  generate837D,
  generate271,
  generate835,
} from "../x12/index.js";
import { generateB1, generateB2, generateB3 } from "../ncpdp/index.js";
import { generateCcda } from "../ccda/index.js";
import {
  EXAMPLE_LAB_OBSERVATIONS as HL7_LABS,
  EXAMPLE_ORDER_SERVICES,
  EXAMPLE_VACCINES,
} from "../hl7/example-codes.js";
import {
  EXAMPLE_LAB_OBSERVATIONS as FHIR_LABS,
  EXAMPLE_VITAL_SIGNS,
  EXAMPLE_CONDITIONS,
  EXAMPLE_MEDICATIONS,
} from "../fhir/example-codes.js";
import {
  PROFESSIONAL_PROCEDURES,
  INSTITUTIONAL_PROCEDURES,
  DIAGNOSES,
} from "../x12/example-codes.js";
import { EXAMPLE_DRUGS } from "../ncpdp/example-codes.js";

import {
  assembleVerdict,
  deidLoopPolicy,
  identifierSentinels,
  recordTargetSentinels,
  type DeidLoopResult,
} from "./loop.js";

export {
  deidLoopPolicy,
  DEID_LOOP_POLICY_NAME,
  identifierSentinels,
  recordTargetSentinels,
  sweepSurvivors,
  clinicalRetention,
  assembleVerdict,
  type DeidLoopFormat,
  type DeidSentinel,
  type DeidLoopResult,
} from "./loop.js";

/**
 * The cosyte formats the pairing loop covers — every format for which **both** `@cosyte/synth`
 * generates and `@cosyte/deid` ships an adapter.
 *
 * @example
 * ```ts
 * import { DEID_LOOP_COVERED_FORMATS } from "@cosyte/synth/deid";
 * DEID_LOOP_COVERED_FORMATS; // ["hl7","fhir","ccda","x12","ncpdp-telecom"]
 * ```
 */
export const DEID_LOOP_COVERED_FORMATS = Object.freeze([
  "hl7",
  "fhir",
  "ccda",
  "x12",
  "ncpdp-telecom",
] as const);

/**
 * The format paths the loop **deliberately skips**, each with the honest reason — so a coverage gap is
 * named, never silent (roadmap §Phase 8).
 *
 * @example
 * ```ts
 * import { DEID_LOOP_SKIPPED } from "@cosyte/synth/deid";
 * DEID_LOOP_SKIPPED.map((s) => s.format); // ["ncpdp-script","astm","dicom"]
 * ```
 */
export const DEID_LOOP_SKIPPED = Object.freeze([
  Object.freeze({
    format: "ncpdp-script",
    reason:
      "@cosyte/deid ships no NCPDP SCRIPT locus map (deferred in deid's roadmap); synth generates SCRIPT but the loop cannot pair it.",
  }),
  Object.freeze({
    format: "astm",
    reason: "@cosyte/deid ships no ASTM adapter; synth generates ASTM but the loop cannot pair it.",
  }),
  Object.freeze({
    format: "dicom",
    reason:
      "@cosyte/synth does not generate DICOM (deferred, roadmap §2), so there is nothing to pair.",
  }),
] as const);

const POLICY = deidLoopPolicy();

/**
 * The **PHI-locus residue** of a de-identified artifact: the values that remain at the loci a
 * `@cosyte/deid` extractor locates, newline-joined for the survivor sweep. The newline separator keeps a
 * token that ends one locus's value from concatenating with the start of the next into a spurious match.
 * See {@link sweepSurvivors} for why the sweep is locus-scoped rather than whole-document.
 *
 * @internal
 */
function residue(loci: readonly GenericLocus[]): string {
  return loci.map((l) => l.value).join("\n");
}

/** The de-identified `<recordTarget>` block of a C-CDA document — the patient PHI residue. @internal */
function recordTargetResidue(xml: string): string {
  return /<recordTarget[\s\S]*?<\/recordTarget>/i.exec(xml)?.[0] ?? "";
}

/** The HL7 v2 structured clinical code pool probed for over-scrub. @internal */
const HL7_CLINICAL = [...HL7_LABS, ...EXAMPLE_ORDER_SERVICES, ...EXAMPLE_VACCINES].map(
  (c) => c.code,
);
/** The FHIR structured clinical code pool probed for over-scrub. @internal */
const FHIR_CLINICAL = [
  ...FHIR_LABS,
  ...EXAMPLE_VITAL_SIGNS,
  ...EXAMPLE_CONDITIONS,
  ...EXAMPLE_MEDICATIONS,
].map((c) => c.code);
/** The X12 structured clinical code pool probed for over-scrub. @internal */
const X12_CLINICAL = [...PROFESSIONAL_PROCEDURES, ...INSTITUTIONAL_PROCEDURES, ...DIAGNOSES].map(
  (c) => c.code,
);
/** The NCPDP structured clinical code pool (drug NDCs) probed for over-scrub. @internal */
const NCPDP_CLINICAL = EXAMPLE_DRUGS.map((d) => d.ndc);

/** Options accepted by {@link hl7DeidLoop}. */
export interface Hl7DeidLoopOptions {
  /** The seed — the same seed yields the same artifact and the same verdict. Defaults to `0`. */
  readonly seed?: number;
  /** The HL7 v2 message family to generate. Defaults to `"ORU^R01"` (a PHI- and clinically-dense report). */
  readonly kind?: Hl7MessageKind;
}

/**
 * Run the pairing loop for **HL7 v2**: generate a spec-clean message through `@cosyte/hl7`'s builder,
 * plant PHI sentinels at the `PID`, de-identify through `@cosyte/deid/hl7`, and verify removal +
 * clinical retention.
 *
 * @param options - The seed and message family. See {@link Hl7DeidLoopOptions}.
 * @returns The {@link DeidLoopResult} for the message.
 * @example
 * ```ts
 * import { hl7DeidLoop } from "@cosyte/synth/deid";
 * const { pass, survivors } = hl7DeidLoop({ seed: 42, kind: "ORU^R01" });
 * // pass === true, survivors.length === 0
 * ```
 */
export function hl7DeidLoop(options: Hl7DeidLoopOptions = {}): DeidLoopResult {
  const seed = options.seed ?? 0;
  const kind: Hl7MessageKind = options.kind ?? "ORU^R01";
  const message = generateHl7(kind, seed);
  const original = message.toString();
  const planted = identifierSentinels(extractHl7Loci(message).loci, original);
  const deidDoc = deidentifyHl7(message, { policy: POLICY }).document;
  const deidentified = deidDoc.toString();
  return assembleVerdict({
    format: "hl7",
    artifact: kind,
    seed,
    planted,
    original,
    deidentified,
    phiResidue: residue(extractHl7Loci(deidDoc).loci),
    clinicalCodes: HL7_CLINICAL,
  });
}

/** Options accepted by {@link fhirDeidLoop}. */
export interface FhirDeidLoopOptions {
  /** The seed. Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Run the pairing loop for **FHIR R4**: generate a spec-clean `Bundle` (US-Core `Patient` + a clinical
 * spine) through `@cosyte/fhir`'s model, plant PHI sentinels at the `Patient` demographics, de-identify
 * through `@cosyte/deid/fhir`, and verify removal + clinical retention. A `Bundle` (not a bare
 * `Patient`) is used so there is clinical content to prove is **not** over-scrubbed.
 *
 * @param options - The seed. See {@link FhirDeidLoopOptions}.
 * @returns The {@link DeidLoopResult} for the bundle.
 * @example
 * ```ts
 * import { fhirDeidLoop } from "@cosyte/synth/deid";
 * fhirDeidLoop({ seed: 7 }).pass; // => true
 * ```
 */
export function fhirDeidLoop(options: FhirDeidLoopOptions = {}): DeidLoopResult {
  const seed = options.seed ?? 0;
  const bundle = generateBundle({ seed });
  const original = serializeResource(bundle);
  const planted = identifierSentinels(extractFhirLoci(bundle).loci, original);
  const deidDoc = deidentifyFhir(bundle, { policy: POLICY }).document;
  const deidentified = serializeResource(deidDoc);
  return assembleVerdict({
    format: "fhir",
    artifact: "Bundle",
    seed,
    planted,
    original,
    deidentified,
    phiResidue: residue(extractFhirLoci(deidDoc).loci),
    clinicalCodes: FHIR_CLINICAL,
  });
}

/** The X12 transaction families the loop can pair. */
export type X12DeidVariant = "837P" | "837I" | "837D" | "271" | "835";

/** Options accepted by {@link x12DeidLoop}. */
export interface X12DeidLoopOptions {
  /** The seed. Defaults to `0`. */
  readonly seed?: number;
  /** The transaction family. Defaults to `"837P"`. */
  readonly variant?: X12DeidVariant;
}

/** Dispatch an X12 variant to its generator. @internal */
function generateX12(variant: X12DeidVariant, seed: number): X12Interchange {
  switch (variant) {
    case "837P":
      return generate837P({ seed });
    case "837I":
      return generate837I({ seed });
    case "837D":
      return generate837D({ seed });
    case "271":
      return generate271({ seed });
    case "835":
      return generate835({ seed });
  }
}

/**
 * Run the pairing loop for **X12 005010**: generate a spec-clean transaction through `@cosyte/x12`'s
 * builders, plant PHI sentinels across the subscriber/patient loops, de-identify through
 * `@cosyte/deid/x12`, and verify removal + clinical retention.
 *
 * @param options - The seed and transaction family. See {@link X12DeidLoopOptions}.
 * @returns The {@link DeidLoopResult} for the transaction.
 * @example
 * ```ts
 * import { x12DeidLoop } from "@cosyte/synth/deid";
 * x12DeidLoop({ seed: 1, variant: "837P" }).survivors; // => []
 * ```
 */
export function x12DeidLoop(options: X12DeidLoopOptions = {}): DeidLoopResult {
  const seed = options.seed ?? 0;
  const variant: X12DeidVariant = options.variant ?? "837P";
  const interchange = generateX12(variant, seed);
  const original = serializeX12(interchange);
  const planted = identifierSentinels(extractX12Loci(interchange).loci, original);
  const deidentified = deidentifyX12(interchange, { policy: POLICY }).x12;
  return assembleVerdict({
    format: "x12",
    artifact: variant,
    seed,
    planted,
    original,
    deidentified,
    phiResidue: residue(extractX12Loci(parseX12(deidentified)).loci),
    clinicalCodes: X12_CLINICAL,
  });
}

/** The NCPDP Telecom transactions the loop can pair. */
export type NcpdpTelecomVariant = "B1" | "B2" | "B3";

/** Options accepted by {@link ncpdpTelecomDeidLoop}. */
export interface NcpdpTelecomDeidLoopOptions {
  /** The seed. Defaults to `0`. */
  readonly seed?: number;
  /** The Telecom transaction. Defaults to `"B1"` (a claim, the PHI- and clinically-densest). */
  readonly transaction?: NcpdpTelecomVariant;
}

/** Dispatch an NCPDP Telecom transaction to its generator. @internal */
function generateTelecomWire(transaction: NcpdpTelecomVariant, seed: number): string {
  switch (transaction) {
    case "B1":
      return generateB1({ seed });
    case "B2":
      return generateB2({ seed });
    case "B3":
      return generateB3({ seed });
  }
}

/**
 * Run the pairing loop for **NCPDP Telecom** (pharmacy claims): generate a spec-clean transaction
 * through `@cosyte/ncpdp`, plant PHI sentinels at the patient/cardholder segments, de-identify through
 * `@cosyte/deid/ncpdp`, and verify removal + clinical retention. **NCPDP SCRIPT is out of scope** —
 * `@cosyte/deid` ships no SCRIPT adapter ({@link DEID_LOOP_SKIPPED}).
 *
 * @param options - The seed and transaction. See {@link NcpdpTelecomDeidLoopOptions}.
 * @returns The {@link DeidLoopResult} for the transaction.
 * @example
 * ```ts
 * import { ncpdpTelecomDeidLoop } from "@cosyte/synth/deid";
 * ncpdpTelecomDeidLoop({ seed: 3, transaction: "B1" }).pass; // => true
 * ```
 */
export function ncpdpTelecomDeidLoop(options: NcpdpTelecomDeidLoopOptions = {}): DeidLoopResult {
  const seed = options.seed ?? 0;
  const transaction: NcpdpTelecomVariant = options.transaction ?? "B1";
  const original = generateTelecomWire(transaction, seed);
  const tx = parseTelecom(original);
  const planted = identifierSentinels(extractTelecomLoci(tx).loci, original);
  const deidentified = deidentifyTelecom(tx, { policy: POLICY }).telecom;
  return assembleVerdict({
    format: "ncpdp-telecom",
    artifact: transaction,
    seed,
    planted,
    original,
    deidentified,
    phiResidue: residue(extractTelecomLoci(parseTelecom(deidentified)).loci),
    clinicalCodes: NCPDP_CLINICAL,
  });
}

/** The C-CDA document types the loop can pair. */
export type CcdaDeidDocumentType = "ccd" | "referral";

/** Options accepted by {@link ccdaDeidLoop}. */
export interface CcdaDeidLoopOptions {
  /** The seed. Defaults to `0`. */
  readonly seed?: number;
  /** The document type. Defaults to `"ccd"`. */
  readonly documentType?: CcdaDeidDocumentType;
}

/**
 * Run the pairing loop for **C-CDA R2.1**: generate a spec-clean document through `@cosyte/ccda`'s
 * `buildCcda`, plant PHI sentinels at the `recordTarget` patient participation, de-identify through
 * `@cosyte/deid/ccda`, and verify removal + clinical retention.
 *
 * Sentinels are read from the `<recordTarget>` element of the serialized XML (not `@cosyte/deid`'s DOM
 * extractor) so that this zero-dependency subpath constructs no XML DOM; scoping to `recordTarget` keeps
 * the sentinels patient-PHI only (`author`/`custodian` provider identity is legitimately retained).
 *
 * @param options - The seed and document type. See {@link CcdaDeidLoopOptions}.
 * @returns The {@link DeidLoopResult} for the document.
 * @example
 * ```ts
 * import { ccdaDeidLoop } from "@cosyte/synth/deid";
 * ccdaDeidLoop({ seed: 5, documentType: "ccd" }).survivors; // => []
 * ```
 */
export function ccdaDeidLoop(options: CcdaDeidLoopOptions = {}): DeidLoopResult {
  const seed = options.seed ?? 0;
  const documentType: CcdaDeidDocumentType = options.documentType ?? "ccd";
  const doc = generateCcda({ seed, documentType: documentType === "ccd" ? "ccd" : "referralNote" });
  const original = serializeCcda(doc);
  const planted = recordTargetSentinels(original);
  const deidentified = deidentifyCcda(doc, { policy: POLICY }).document.toString();
  return assembleVerdict({
    format: "ccda",
    artifact: documentType === "ccd" ? "CCD" : "ReferralNote",
    seed,
    planted,
    original,
    deidentified,
    phiResidue: recordTargetResidue(deidentified),
    clinicalCodes: [...EXAMPLE_CONDITIONS, ...EXAMPLE_MEDICATIONS].map((c) => c.code),
  });
}

/** A per-format row of a {@link DeidCoverageSummary}. */
export interface DeidCoverageRow {
  /** The covered format. */
  readonly format: string;
  /** The concrete artifacts run for this format. */
  readonly artifacts: readonly string[];
  /** Total distinctive PHI sentinels planted across the runs. */
  readonly planted: number;
  /** Total surviving sentinels — **0** on a clean pass. */
  readonly survivors: number;
  /** Total clinical tokens probed for over-scrub. */
  readonly clinicalProbed: number;
  /** Total clinical tokens over-scrubbed — **0** on a clean pass. */
  readonly clinicalScrubbed: number;
  /** `true` iff every run for this format passed. */
  readonly pass: boolean;
}

/** The aggregate coverage summary across a set of loop runs. */
export interface DeidCoverageSummary {
  /** One row per format. */
  readonly byFormat: readonly DeidCoverageRow[];
  /** Total sentinels planted across every run. */
  readonly totalPlanted: number;
  /** Total surviving sentinels across every run — **0** on a clean pass. */
  readonly totalSurvivors: number;
  /** Total clinical over-scrubs across every run — **0** on a clean pass. */
  readonly totalClinicalScrubbed: number;
  /** `true` iff every run passed. */
  readonly allPass: boolean;
  /** The named, deliberately-skipped format paths (from {@link DEID_LOOP_SKIPPED}). */
  readonly skipped: typeof DEID_LOOP_SKIPPED;
}

/**
 * Summarize a set of loop runs into a per-format coverage report — the "coverage summary per format" the
 * harness reports (roadmap §Phase 8).
 *
 * @param results - The loop results to aggregate.
 * @returns The {@link DeidCoverageSummary}.
 * @example
 * ```ts
 * import { hl7DeidLoop, fhirDeidLoop, summarizeDeidCoverage } from "@cosyte/synth/deid";
 * const summary = summarizeDeidCoverage([hl7DeidLoop(), fhirDeidLoop()]);
 * summary.allPass; // => true
 * ```
 */
export function summarizeDeidCoverage(results: readonly DeidLoopResult[]): DeidCoverageSummary {
  const byFormatMap = new Map<string, DeidLoopResult[]>();
  for (const r of results) {
    const list = byFormatMap.get(r.format) ?? [];
    list.push(r);
    byFormatMap.set(r.format, list);
  }
  const byFormat: DeidCoverageRow[] = [];
  for (const [format, runs] of byFormatMap) {
    byFormat.push({
      format,
      artifacts: runs.map((r) => r.artifact),
      planted: runs.reduce((n, r) => n + r.planted.length, 0),
      survivors: runs.reduce((n, r) => n + r.survivors.length, 0),
      clinicalProbed: runs.reduce((n, r) => n + r.clinicalProbed.length, 0),
      clinicalScrubbed: runs.reduce((n, r) => n + r.clinicalScrubbed.length, 0),
      pass: runs.every((r) => r.pass),
    });
  }
  return {
    byFormat,
    totalPlanted: results.reduce((n, r) => n + r.planted.length, 0),
    totalSurvivors: results.reduce((n, r) => n + r.survivors.length, 0),
    totalClinicalScrubbed: results.reduce((n, r) => n + r.clinicalScrubbed.length, 0),
    allPass: results.every((r) => r.pass),
    skipped: DEID_LOOP_SKIPPED,
  };
}
