/**
 * Synthetic FHIR R4 **`Composition`** generation — the mandatory first resource of a `document` Bundle
 * (FHIR invariant `bdl-11`), built through `@cosyte/fhir` (roadmap §Phase 3 `document` shape, SYNTH-4).
 * A Composition is a base-R4 resource (US Core 6.1.0 defines no Composition profile), so it is grounded
 * against base FHIR R4; every reference it carries (`subject`, `author`, `custodian`, section `entry`s)
 * is an in-bundle `urn:uuid:` fullUrl so the document is self-contained and its references resolve.
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import type { Rng } from "../rng/rng.js";
import { codeableConcept, narrative, prop, reference, str, type Prop } from "./builder.js";
import { SYSTEM } from "./us-core.js";

/** A document section: a LOINC section code, a human title, and the entry references it summarizes. */
export interface CompositionSection {
  /** The LOINC section code. */
  readonly code: string;
  /** The section's human title / display. */
  readonly title: string;
  /** In-bundle `urn:uuid:` references to the resources the section summarizes. */
  readonly entries: readonly string[];
}

/** Inputs for {@link buildComposition}. */
export interface BuildCompositionInput {
  /** The `subject` reference (the patient's in-bundle fullUrl). */
  readonly subject: string;
  /** The `author` + `custodian` reference (an in-bundle Organization fullUrl). */
  readonly organization: string;
  /** The document date (`YYYY-MM-DD`). */
  readonly date: string;
  /** The document sections. */
  readonly sections: readonly CompositionSection[];
}

/** One `Composition.section` — title, LOINC code, and its `entry` references (satisfies `cmp-1`). */
function section(sec: CompositionSection): FhirComplex {
  return complex([
    prop("title", str(sec.title)),
    prop("code", codeableConcept({ system: SYSTEM.LOINC, code: sec.code, display: sec.title })),
    prop("entry", list(sec.entries.map((e) => reference(e)))),
  ]);
}

/**
 * Build a spec-clean synthetic base-R4 `Composition` for a `document` Bundle, through `@cosyte/fhir`.
 *
 * @param rng - The seeded generator (for the resource id).
 * @param input - Subject/organization references, date, and sections. See {@link BuildCompositionInput}.
 * @returns The `Composition` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { buildComposition } from "@cosyte/synth/fhir";
 * // buildComposition(createRng(1), { subject, organization, date: "2020-01-01", sections: [] });
 * ```
 */
export function buildComposition(rng: Rng, input: BuildCompositionInput): FhirComplex {
  const props: Prop[] = [
    prop("resourceType", str("Composition")),
    prop("id", str(`syn-comp-${rng.digits(8)}`)),
    prop("text", narrative("Synthetic continuity-of-care document summary.")),
    prop("status", str("final")),
    prop(
      "type",
      codeableConcept({
        system: SYSTEM.LOINC,
        code: "34133-9",
        display: "Summarization of Episode Note",
      }),
    ),
    prop("subject", reference(input.subject)),
    prop("date", str(`${input.date}T09:00:00Z`)),
    prop("author", list([reference(input.organization)])),
    prop("title", str("Synthetic Continuity of Care Document")),
    prop("custodian", reference(input.organization)),
    prop("section", list(input.sections.map((s) => section(s)))),
  ];
  return complex(props);
}
