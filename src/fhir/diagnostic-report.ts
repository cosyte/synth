/**
 * Synthetic FHIR R4 **`DiagnosticReport`** generation — the US Core DiagnosticReport Profile for
 * Laboratory Results Reporting (roadmap §Phase 3, deferred to SYNTH-4). Built through `@cosyte/fhir`;
 * the report `code` comes from the license-clean LOINC example pool, `subject` from a supplied or
 * derived synthetic Patient reference. The required `category` carries the profile's mandated `LAB`
 * slice, and `effectiveDateTime` + `issued` are always present so the `us-core-8`/`us-core-9`
 * invariants hold for a `final` report. Optional `result` references wire the report to its
 * `Observation`s (used by the `document` Bundle).
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { safe } from "../safe/index.js";
import {
  codeableConcept,
  meta,
  narrative,
  prop,
  reference,
  str,
  toFhirDate,
  type Prop,
} from "./builder.js";
import { EXAMPLE_DIAGNOSTIC_REPORTS } from "./example-codes.js";
import { SYSTEM, US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateDiagnosticReport}. */
export interface GenerateDiagnosticReportOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `subject` reference (e.g. `"Patient/syn-patient-1"` or a `urn:uuid:` fullUrl). */
  readonly subject?: string;
  /** `result` references to the report's `Observation`s (empty ⇒ omitted). */
  readonly results?: readonly string[];
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core Laboratory `DiagnosticReport`, built through `@cosyte/fhir`.
 *
 * @param options - Seed, subject, result references, US Core posture. See
 *   {@link GenerateDiagnosticReportOptions}.
 * @returns The `DiagnosticReport` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateDiagnosticReport } from "@cosyte/synth/fhir";
 * const report = generateDiagnosticReport({ seed: 19, subject: "Patient/syn-patient-1" });
 * ```
 */
export function generateDiagnosticReport(
  options: GenerateDiagnosticReportOptions = {},
): FhirComplex {
  const { seed = 0, subject = "Patient/syn-patient-1", results = [], usCore = true } = options;
  const rng = createRng(seed);
  const code = rng.pick(EXAMPLE_DIAGNOSTIC_REPORTS);
  const day = toFhirDate(safe.dateYmd(rng, 2018, 2024));

  const props: Prop[] = [
    prop("resourceType", str("DiagnosticReport")),
    prop("id", str(`syn-dr-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.DIAGNOSTIC_REPORT_LAB])));
  props.push(prop("text", narrative(`Synthetic laboratory report: ${code.display}.`)));
  props.push(prop("status", str("final")));
  props.push(
    prop(
      "category",
      list([
        codeableConcept({
          system: SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
          code: "LAB",
          display: "Laboratory",
        }),
      ]),
    ),
  );
  props.push(prop("code", codeableConcept(code)));
  props.push(prop("subject", reference(subject)));
  props.push(prop("effectiveDateTime", str(`${day}T08:30:00Z`)));
  props.push(prop("issued", str(`${day}T09:00:00.000Z`)));
  if (results.length > 0) {
    props.push(prop("result", list(results.map((r) => reference(r)))));
  }
  return complex(props);
}
