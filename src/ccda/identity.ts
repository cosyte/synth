/**
 * Synthetic C-CDA patient identity — the `recordTarget` demographics for a generated document, every
 * field minted from the synthetic-safety providers in `../safe` (roadmap §4). No value a generated
 * C-CDA carries at a PHI locus can be real or plausibly-real: the name is from the shipped fake-name
 * pool, the MRN lives under the synthetic assigning-authority OID (never a real facility namespace),
 * and the birth date comes from the seeded generator (never wall-clock).
 *
 * The draw order is **fixed** (name → MRN → DOB → gender) so the same seed yields the same identity —
 * the reproducibility contract (roadmap §5).
 *
 * @module
 */

import type { BuildCcdaPatient } from "@cosyte/ccda";

import type { Rng } from "../rng/rng.js";
import { safe, type SyntheticIdentifier, type SyntheticName } from "../safe/index.js";

/** A synthetic C-CDA patient identity — the values threaded into a document's `recordTarget`. */
export interface CcdaPatientIdentity {
  /** The `BuildCcdaPatient` `@cosyte/ccda` consumes for the single `recordTarget`. */
  readonly patient: BuildCcdaPatient;
  /** The name from the shipped fake-name pool (also used to compose synthetic narrative/email). */
  readonly person: SyntheticName;
  /** The medical-record identifier, scoped to the synthetic assigning authority. */
  readonly mrn: SyntheticIdentifier;
}

/**
 * Mint a complete synthetic {@link CcdaPatientIdentity}. Every value comes from a synthetic-safety
 * provider — no code path here can return a real identifier (roadmap §4). The MRN is scoped to the
 * synthetic assigning-authority OID (`mrnRoot`), so it is non-colliding by *namespace*, not by value
 * (roadmap §4.1).
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link CcdaPatientIdentity}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { ccdaPatientIdentity } from "@cosyte/synth/ccda";
 * // const { patient } = ccdaPatientIdentity(createRng(1));
 * ```
 */
export function ccdaPatientIdentity(rng: Rng): CcdaPatientIdentity {
  const person = safe.name(rng);
  const mrn = safe.identifier(rng, "MR");
  const birthTime = safe.dateYmd(rng, 1930, 2010);
  const gender = rng.pick(["M", "F"] as const);
  const patient: BuildCcdaPatient = {
    mrn: mrn.value,
    mrnRoot: mrn.assigningAuthorityOid,
    mrnAssigningAuthority: mrn.assigningAuthority,
    given: [person.given],
    family: person.family,
    gender,
    birthTime,
  };
  return { patient, person, mrn };
}
