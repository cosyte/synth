/**
 * **Profile-addressed generation, and the coverage surface it is resolved against.**
 *
 * A consumer building to `45 CFR 170.315(g)(10)` does not think in this package's generator names: it
 * thinks in US Core 6.1.0 profile names, because that is what the regulation adopts. So this module
 * offers exactly two things, and the pair is the whole contract:
 *
 * 1. {@link usCoreCoverage} reports one entry for **every** profile the adopted guide publishes, each
 *    carrying its canonical URL and whether this build generates it. "The guide does not publish this"
 *    and "we do not generate this yet" are different answers, and without a published closed set
 *    nothing could tell them apart.
 * 2. {@link generateUsCoreProfile} takes a profile name and either returns an artifact claiming that
 *    profile, or **fails closed before anything is generated**, on the `resolveKind` discipline every
 *    other caller-supplied selector here already holds. Two distinct codes: `SYNTH_UNSUPPORTED_KIND`
 *    for a name outside the adopted set (an extension definition, a typo, a blank, a non-string), and
 *    `SYNTH_PROFILE_NOT_GENERATED` for an adopted profile this build does not yet cover. Neither
 *    quotes the requested name, so no caller string reaches a diagnostic surface.
 *
 * **Coverage is derived, never declared twice.** The `generated` flag is read off the generator map
 * below, so a profile cannot be advertised as covered without a generator behind it, and the
 * conformance suite additionally requires a committed `StructureDefinition` for every profile this
 * surface reports as generated.
 *
 * No IG content is bundled: what is encoded here is a set of identifiers, exactly like `./us-core.js`.
 *
 * @module
 */

import type { FhirComplex } from "@cosyte/fhir";

import { SYNTH_FATAL_CODES, SynthError } from "../codes.js";
import { resolveKind } from "../select.js";
import { generateAllergyIntolerance } from "./allergy-intolerance.js";
import { generateCondition } from "./condition.js";
import { generateDiagnosticReport } from "./diagnostic-report.js";
import { generateEncounter } from "./encounter.js";
import { generateImmunization } from "./immunization.js";
import { generateMedicationRequest } from "./medication-request.js";
import { generateObservationLab, generateVitalSign } from "./observation.js";
import { generatePatient } from "./patient.js";
import { generateProcedure } from "./procedure.js";
import { generateProvenance } from "./provenance.js";
import { US_CORE_ADOPTED_PROFILES, US_CORE_PROFILE_BASE, type UsCoreProfileId } from "./us-core.js";

/**
 * The generators, one per **covered** adopted profile. A profile absent from this map is adopted and
 * uncovered: {@link usCoreCoverage} reports it as such and {@link generateUsCoreProfile} refuses it
 * with `SYNTH_PROFILE_NOT_GENERATED`.
 */
const GENERATORS: Readonly<Partial<Record<UsCoreProfileId, (seed: number) => FhirComplex>>> =
  Object.freeze({
    "us-core-allergyintolerance": (seed: number) => generateAllergyIntolerance({ seed }),
    "us-core-condition-problems-health-concerns": (seed: number) => generateCondition({ seed }),
    "us-core-diagnosticreport-lab": (seed: number) => generateDiagnosticReport({ seed }),
    "us-core-encounter": (seed: number) => generateEncounter({ seed }),
    "us-core-immunization": (seed: number) => generateImmunization({ seed }),
    "us-core-medicationrequest": (seed: number) => generateMedicationRequest({ seed }),
    "us-core-observation-lab": (seed: number) => generateObservationLab({ seed }),
    "us-core-patient": (seed: number) => generatePatient({ seed, profile: "us-core" }),
    "us-core-procedure": (seed: number) => generateProcedure({ seed }),
    "us-core-provenance": (seed: number) => generateProvenance({ seed }),
    "us-core-vital-signs": (seed: number) => generateVitalSign({ seed }),
  });

/** One adopted US Core 6.1.0 resource profile, and whether this build generates a fixture for it. */
export interface UsCoreProfileCoverage {
  /** The profile id, as the guide's artifact index spells it. */
  readonly profile: UsCoreProfileId;
  /** The profile's canonical URL: the value a generated artifact's `meta.profile` claims. */
  readonly canonical: string;
  /** `true` when {@link generateUsCoreProfile} returns an artifact for this profile. */
  readonly generated: boolean;
}

/** The coverage report, computed once: the adopted set is frozen and the generator map is frozen. */
const COVERAGE: readonly UsCoreProfileCoverage[] = Object.freeze(
  US_CORE_ADOPTED_PROFILES.map((profile) =>
    Object.freeze({
      profile,
      canonical: `${US_CORE_PROFILE_BASE}${profile}`,
      generated: GENERATORS[profile] !== undefined,
    }),
  ),
);

/**
 * Report this build's US Core 6.1.0 coverage: one entry per **adopted** resource profile, in the
 * guide's own order, each carrying its canonical URL and whether this build generates it.
 *
 * The report is exhaustive over the adopted set by construction, so a profile the guide publishes and
 * this build does not generate is *named* here rather than being indistinguishable from a typo.
 *
 * @returns One frozen {@link UsCoreProfileCoverage} entry per adopted profile.
 * @example
 * ```ts
 * import { usCoreCoverage } from "@cosyte/synth/fhir";
 * usCoreCoverage().filter((entry) => !entry.generated).map((entry) => entry.profile);
 * ```
 */
export function usCoreCoverage(): readonly UsCoreProfileCoverage[] {
  return COVERAGE;
}

/** Options for {@link generateUsCoreProfile}. */
export interface GenerateUsCoreProfileOptions {
  /**
   * The US Core 6.1.0 profile id to generate. Resolved against the adopted set **before** anything is
   * generated; there is deliberately no default, so a blank or absent name refuses rather than
   * falling through to some other profile's artifact.
   */
  readonly profile: UsCoreProfileId;
  /** The seed (deterministic). Defaults to `0`. */
  readonly seed?: number;
}

/**
 * Generate a fixture **by US Core 6.1.0 profile name**, or fail closed before anything is generated.
 *
 * @param options - The profile name and seed. See {@link GenerateUsCoreProfileOptions}.
 * @returns The resource model (a `FhirComplex`) claiming that profile in `meta.profile`.
 * @throws SynthError `SYNTH_UNSUPPORTED_KIND` when the name is not in the adopted set.
 * @throws SynthError `SYNTH_PROFILE_NOT_GENERATED` when the profile is adopted and not generated here.
 * @example
 * ```ts
 * import { generateUsCoreProfile } from "@cosyte/synth/fhir";
 * const provenance = generateUsCoreProfile({ profile: "us-core-provenance", seed: 42 });
 * ```
 */
export function generateUsCoreProfile(options: GenerateUsCoreProfileOptions): FhirComplex {
  const profile = resolveKind(US_CORE_ADOPTED_PROFILES, options.profile);
  const generate = GENERATORS[profile];
  if (generate === undefined) {
    throw new SynthError(SYNTH_FATAL_CODES.SYNTH_PROFILE_NOT_GENERATED);
  }
  return generate(options.seed ?? 0);
}
