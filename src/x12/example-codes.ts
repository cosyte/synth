/**
 * License-clean example code pools for X12 generation. Following the roadmap's BYO / public-domain
 * terminology posture (roadmap §2 "NO bundled terminology content"), `synth` ships only a tiny curated
 * set of **spec-example codes** — the same codes that appear in the WPC 005010 TR3 implementation-guide
 * examples and the `@cosyte/x12` builder test fixtures — never a bundled CPT/ICD/NDC table. They are
 * used purely to give a generated claim a structurally-valid code element; a consumer who needs a real
 * code set supplies their own (matching `@cosyte/terminology`'s content-free stance).
 *
 * Every code here is a *structural placeholder*: a `synth` claim may pair a diagnosis and a procedure
 * that make no clinical sense, and that is correct — `synth` exercises the *parser*, not clinical
 * coherence (roadmap §2, the Synthea boundary).
 *
 * @module
 */

/** A code drawn from a pool, with the X12 qualifier that names its code system. */
export interface X12ExampleCode {
  /** The code value (the element or composite component). */
  readonly code: string;
  /** A short human label — documentation only, never emitted. */
  readonly label: string;
}

/**
 * HCPCS/CPT professional procedure codes (SV1-01-2, qualifier `HC`) — office-visit / lab E&M codes
 * from the 837P TR3 examples. Structural placeholders only.
 */
export const PROFESSIONAL_PROCEDURES: readonly X12ExampleCode[] = Object.freeze([
  { code: "99213", label: "office/outpatient visit, established patient" },
  { code: "99214", label: "office/outpatient visit, established patient, moderate" },
  { code: "99203", label: "office/outpatient visit, new patient" },
  { code: "85025", label: "complete blood count with differential" },
  { code: "80053", label: "comprehensive metabolic panel" },
  { code: "93000", label: "electrocardiogram, routine" },
]);

/** Professional procedure modifiers (SV1-01-3..6). */
export const PROCEDURE_MODIFIERS: readonly string[] = Object.freeze(["25", "59", "76", "GT"]);

/** Place-of-service codes (CLM-05-1 / SV1-05). */
export const PLACES_OF_SERVICE: readonly string[] = Object.freeze(["11", "22", "21", "12", "49"]);

/**
 * ICD-10-CM diagnosis codes (HI qualifier `ABK` principal / `ABF` secondary) — codes from the TR3
 * examples. Structural placeholders only.
 */
export const DIAGNOSES: readonly X12ExampleCode[] = Object.freeze([
  { code: "J20.9", label: "acute bronchitis, unspecified" },
  { code: "E11.9", label: "type 2 diabetes mellitus without complications" },
  { code: "I10", label: "essential (primary) hypertension" },
  { code: "M54.5", label: "low back pain" },
  { code: "R07.9", label: "chest pain, unspecified" },
  { code: "Z00.00", label: "general adult medical exam without abnormal findings" },
]);

/** NUBC revenue codes (837I SV2-01) — spec-example codes. */
export const REVENUE_CODES: readonly X12ExampleCode[] = Object.freeze([
  { code: "0120", label: "room & board, semi-private" },
  { code: "0300", label: "laboratory, general" },
  { code: "0450", label: "emergency room, general" },
  { code: "0636", label: "drugs requiring detailed coding" },
]);

/** Institutional procedure codes paired with revenue lines (837I SV2-02-2, qualifier `HC`). */
export const INSTITUTIONAL_PROCEDURES: readonly X12ExampleCode[] = Object.freeze([
  { code: "99221", label: "initial hospital care, per day" },
  { code: "99231", label: "subsequent hospital care, per day" },
]);

/** CDT dental procedure codes (837D SV3-01-2, qualifier `AD`) — spec-example codes. */
export const DENTAL_PROCEDURES: readonly X12ExampleCode[] = Object.freeze([
  { code: "D2391", label: "resin-based composite, one surface, posterior" },
  { code: "D1110", label: "prophylaxis, adult" },
  { code: "D0120", label: "periodic oral evaluation" },
]);

/** ADA tooth codes (837D TOO-02, qualifier `JP`) + surfaces (TOO-03). */
export const TOOTH_CODES: readonly string[] = Object.freeze(["14", "3", "19", "30"]);
/** Tooth surface codes (TOO-03). */
export const TOOTH_SURFACES: readonly string[] = Object.freeze(["M", "O", "D", "B", "L"]);

/**
 * Claim adjustment reason codes (CARC — CAS-02) paired with a group code. CARC is a public WPC code
 * list; these are the handful used in the 835 TR3 examples. Structural placeholders only.
 */
export const CARC_CODES: readonly string[] = Object.freeze(["1", "2", "3", "45", "96", "197"]);

/** Service type codes (271 EB-03) — the public X12 code list 1365, spec-example subset. */
export const SERVICE_TYPE_CODES: readonly string[] = Object.freeze(["30", "1", "35", "88", "98"]);
