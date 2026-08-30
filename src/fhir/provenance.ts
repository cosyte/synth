/**
 * Synthetic FHIR R4 **`Provenance`** generation: a US Core Provenance, the record of who authored and
 * transmitted a resource. Built through `@cosyte/fhir`'s model constructors like every other resource
 * here, so it is spec-clean by construction and needs no upstream builder of its own.
 *
 * The profile's required elements (`target`, `recorded`, `agent.who`) are always present, as is the
 * must-support `agent.onBehalfOf`, which also discharges the profile's `provenance-1` invariant
 * ("onBehalfOf SHALL be present when Provenance.agent.who is a Practitioner or Device") outright
 * rather than leaving it to a resolver.
 *
 * **The single agent is typed as both author and transmitter, deliberately.** US Core slices
 * `Provenance.agent` on a `type` pattern into a `ProvenanceAuthor` slice and a `ProvenanceTransmitter`
 * slice, both must-support and both optional. One synthetic source system authored this record and
 * transmitted it, so one agent carries both participation codings: a `CodeableConcept` is a set of
 * codings for exactly this reason, and the slicing is `open`. Splitting it into two agents would say
 * two parties were involved, which is not what a self-contained synthetic fixture models.
 *
 * @module
 */

import { complex, list } from "@cosyte/fhir";
import type { FhirComplex } from "@cosyte/fhir";

import { createRng } from "../rng/rng.js";
import { safe } from "../safe/index.js";
import { coding, meta, narrative, prop, reference, str, toFhirDate, type Prop } from "./builder.js";
import { SYSTEM, US_CORE_PROFILE } from "./us-core.js";

/** Options for {@link generateProvenance}. */
export interface GenerateProvenanceOptions {
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
  /** The `target` reference this provenance is about (e.g. `"Patient/syn-patient-1"`). */
  readonly target?: string;
  /** Whether to claim US Core via `meta.profile`. Defaults to `true`. */
  readonly usCore?: boolean;
}

/**
 * Generate a spec-clean synthetic US Core `Provenance`, built through `@cosyte/fhir`.
 *
 * @param options - Seed, target reference, and US Core posture. See {@link GenerateProvenanceOptions}.
 * @returns The `Provenance` resource model (a `FhirComplex`).
 * @example
 * ```ts
 * import { generateProvenance } from "@cosyte/synth/fhir";
 * const provenance = generateProvenance({ seed: 19, target: "Patient/syn-patient-1" });
 * ```
 */
export function generateProvenance(options: GenerateProvenanceOptions = {}): FhirComplex {
  const { seed = 0, target = "Patient/syn-patient-1", usCore = true } = options;
  const rng = createRng(seed);
  const recorded = toFhirDate(safe.dateYmd(rng, 2018, 2024));
  const practitioner = `Practitioner/syn-practitioner-${rng.digits(8)}`;
  const organization = `Organization/syn-org-${rng.digits(8)}`;

  const props: Prop[] = [
    prop("resourceType", str("Provenance")),
    prop("id", str(`syn-prov-${rng.digits(8)}`)),
  ];
  if (usCore) props.push(prop("meta", meta([US_CORE_PROFILE.PROVENANCE])));
  props.push(prop("text", narrative("Synthetic provenance for a generated fixture.")));
  props.push(prop("target", list([reference(target)])));
  props.push(prop("recorded", str(`${recorded}T10:00:00Z`)));
  props.push(
    prop(
      "agent",
      list([
        complex([
          prop(
            "type",
            complex([
              prop(
                "coding",
                list([
                  coding({
                    system: SYSTEM.PROVENANCE_PARTICIPANT_TYPE,
                    code: "author",
                    display: "Author",
                  }),
                  coding({
                    system: SYSTEM.US_CORE_PROVENANCE_PARTICIPANT_TYPE,
                    code: "transmitter",
                    display: "Transmitter",
                  }),
                ]),
              ),
            ]),
          ),
          prop("who", reference(practitioner)),
          prop("onBehalfOf", reference(organization)),
        ]),
      ]),
    ),
  );
  return complex(props);
}
