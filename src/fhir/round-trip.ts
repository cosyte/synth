/**
 * The **round-trip-through-the-parser harness** for FHIR — the headline gate for the synthetic-fixture
 * generator (roadmap §6). A generated resource is "spec-clean" only if `@cosyte/fhir` — not
 * `@cosyte/synth`'s own opinion — reads it back, validates it, and re-serializes it byte-identically.
 * This harness serializes a generated resource, parses it back, validates it (optionally against
 * supplied US Core / vendor `StructureDefinition`s), and re-serializes, reporting what the parser found
 * so a false "spec-clean" claim cannot hide (roadmap §4.5, the first head of the two-headed hazard).
 *
 * `@cosyte/synth` bundles **no** profile content: to validate US Core conformance, a caller supplies
 * the `StructureDefinition`s via {@link RoundTripOptions.profiles} — exactly the content-free posture of
 * `@cosyte/fhir.validateResource({ profiles })` (roadmap §Phase 3).
 *
 * @module
 */

import { parseResource, serializeResource, validateResource } from "@cosyte/fhir";
import type { FhirComplex, StructureDefinition } from "@cosyte/fhir";

/** Options for {@link roundTrip}. */
export interface RoundTripOptions {
  /**
   * US Core / vendor profiles (`StructureDefinition`s) to validate against. **None is bundled** — a
   * caller supplies them (BYO), matching `@cosyte/fhir`'s content-free posture.
   */
  readonly profiles?: readonly StructureDefinition[];
}

/** The verdict of one round-trip through `@cosyte/fhir`. */
export interface RoundTripResult {
  /** The serialized FHIR JSON text (the parser's own conservative emit). */
  readonly content: string;
  /**
   * The validation issue codes at `error`/`fatal` severity (empty ⇒ valid). `information`/`warning`
   * findings (e.g. `MUST_SUPPORT_ABSENT`, `INVARIANT_UNCHECKED`, base `dom-6`) are advisory and are
   * excluded here — they never make a resource invalid.
   */
  readonly errors: readonly string[];
  /** All non-informational issue codes (errors **and** warnings), for the `Corpus` artifact record. */
  readonly warnings: readonly string[];
  /** Whether re-serializing the re-parsed resource is byte-identical to `content`. */
  readonly byteStable: boolean;
  /** Whether `@cosyte/fhir.validateResource` reported no `error`/`fatal` findings. */
  readonly valid: boolean;
  /** `true` iff the artifact is spec-clean: **valid** (zero errors) **and** byte-stable. */
  readonly specClean: boolean;
}

/**
 * Round-trip a generated FHIR resource through serialize → parse → validate → serialize and report the
 * verdict. A spec-clean artifact validates with **zero errors** and re-serializes byte-identically.
 *
 * @param resource - The resource model to check (typically from a `generate*` function).
 * @param options - Optional US Core / vendor profiles to validate against. See {@link RoundTripOptions}.
 * @returns The {@link RoundTripResult}.
 * @example
 * ```ts
 * import { generatePatient, roundTrip } from "@cosyte/synth/fhir";
 * const { specClean, errors } = roundTrip(generatePatient({ seed: 1 }));
 * // specClean === true, errors.length === 0
 * ```
 */
export function roundTrip(resource: FhirComplex, options: RoundTripOptions = {}): RoundTripResult {
  const content = serializeResource(resource);
  const { resource: reparsed } = parseResource(content);
  const byteStable = serializeResource(reparsed) === content;
  const result = validateResource(
    reparsed,
    options.profiles !== undefined
      ? { mode: "strict", profiles: options.profiles }
      : { mode: "strict" },
  );
  const errors = result.issues
    .filter((i) => i.severity === "error" || i.severity === "fatal")
    .map((i) => i.code);
  const warnings = result.issues
    .filter((i) => i.severity === "error" || i.severity === "fatal" || i.severity === "warning")
    .map((i) => i.code);
  const valid = result.valid;
  return { content, errors, warnings, byteStable, valid, specClean: valid && byteStable };
}
