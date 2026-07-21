/**
 * Synthetic identity for ASTM (E1394 / CLSI LIS02) messages — every value `synth` puts into a `P`
 * (patient) record, an `O` (order) accession, or the `H` header is minted here, and **only** from the
 * synthetic-safety providers (roadmap §4). ASTM's PHI-dense locus is the **`P` record**: it carries the
 * patient **name** (`Last^First^Middle`), **birthdate**, **sex**, and — the detail the roadmap
 * stresses — the **practice-assigned** and **laboratory-assigned** patient IDs, which must stay
 * **distinct** (the parser keeps them distinct; a generator that let one default from the other would
 * defeat that). Every identifier is scoped to the synthetic assigning authority: there is no reserved
 * patient-ID range for ASTM (as for MRNs generally — roadmap §4.1), so the **namespace** is the
 * guarantee. The IDs carry a clearly-synthetic prefix (`PRA` / `LAB` / `ACC`) so the `phi-scan` ASTM
 * arm can recognize them as synthetic-AA-scoped and a real bare numeric MRN can never masquerade as one.
 *
 * @module
 */

import type { Rng } from "../rng/rng.js";
import { safe, type SyntheticName } from "../safe/index.js";

/** Clearly-fictional middle initials, so a `P`-record name can carry the full `Last^First^Middle`. */
const SYNTHETIC_MIDDLE_INITIALS: readonly string[] = Object.freeze([
  "A",
  "B",
  "C",
  "J",
  "M",
  "R",
  "T",
]);

/** Clearly-synthetic sender / analyzer identifiers for the `H` header (never a real site or instrument). */
const SYNTHETIC_SENDERS: readonly string[] = Object.freeze([
  "SYNTH-LIS",
  "FIXTURE-HOST",
  "PLACEHOLDER-LAB",
]);

/** Clearly-synthetic analyzer model strings for the `H` header (Universal Test ID sender component). */
const SYNTHETIC_ANALYZERS: readonly string[] = Object.freeze([
  "SYNTH-ANALYZER^ModelS^1",
  "MOCK-CHEM^ModelC^2",
  "FIXTURE-HEMA^ModelH^1",
]);

/** A synthetic ASTM patient — every field drawn from `../safe`. */
export interface AstmPatient {
  /** Name from the shipped fake-name pool, plus a fictional middle initial. */
  readonly person: SyntheticName;
  /** Middle initial (clearly synthetic). */
  readonly middle: string;
  /** Birthdate `YYYYMMDD`, from the seeded generator (no real event implied — roadmap §4.3). */
  readonly birthDate: string;
  /** Sex code, emitted verbatim (`M` / `F` — structural, never defaulted by the builder). */
  readonly sex: "M" | "F";
  /** Practice-assigned patient ID — synthetic-AA scoped (`PRA`-prefixed). Distinct from the lab ID. */
  readonly practiceAssignedId: string;
  /** Laboratory-assigned patient ID — synthetic-AA scoped (`LAB`-prefixed). Distinct from the practice ID. */
  readonly laboratoryAssignedId: string;
}

/** A synthetic ASTM order identity — the specimen / accession id and priority. */
export interface AstmOrder {
  /** Specimen / accession id — synthetic-AA scoped (`ACC`-prefixed). */
  readonly specimenId: string;
  /** Priority code, emitted verbatim (`R` routine, `S` stat). */
  readonly priority: "R" | "S";
}

/** A synthetic ASTM header identity — the sender and analyzer strings for the `H` record. */
export interface AstmHeaderIdentity {
  /** The sending system id (clearly synthetic). */
  readonly sender: string;
  /** The analyzer / instrument string (clearly synthetic). */
  readonly analyzer: string;
}

/**
 * Mint a synthetic patient for a `P` record. Fixed draw order (name → middle → DOB → sex → practice id
 * → lab id) so the same seed yields the same patient (roadmap §5). The two patient IDs are minted from
 * **independent** synthetic-identifier draws, so they are distinct by construction.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link AstmPatient}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { astmPatient } from "@cosyte/synth/astm";
 * const { person, practiceAssignedId, laboratoryAssignedId } = astmPatient(createRng(1));
 * ```
 */
export function astmPatient(rng: Rng): AstmPatient {
  const person = safe.name(rng);
  const middle = rng.pick(SYNTHETIC_MIDDLE_INITIALS);
  const birthDate = safe.dateYmd(rng, 1935, 2010);
  const sex = rng.pick(["M", "F"] as const);
  const practiceAssignedId = `PRA${safe.identifier(rng, "MR").value}`;
  const laboratoryAssignedId = `LAB${safe.identifier(rng, "MR").value}`;
  return { person, middle, birthDate, sex, practiceAssignedId, laboratoryAssignedId };
}

/**
 * Mint a synthetic order identity for an `O` record — a synthetic-AA-scoped accession id and a priority.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link AstmOrder}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { astmOrder } from "@cosyte/synth/astm";
 * const { specimenId } = astmOrder(createRng(1));
 * ```
 */
export function astmOrder(rng: Rng): AstmOrder {
  const specimenId = `ACC${rng.digits(8)}`;
  const priority = rng.pick(["R", "S"] as const);
  return { specimenId, priority };
}

/**
 * Mint a synthetic header identity for the `H` record — a clearly-synthetic sender and analyzer.
 *
 * @param rng - The seeded generator.
 * @returns A synthetic {@link AstmHeaderIdentity}.
 * @example
 * ```ts
 * import { createRng } from "@cosyte/synth";
 * import { astmHeaderIdentity } from "@cosyte/synth/astm";
 * const { sender } = astmHeaderIdentity(createRng(1));
 * ```
 */
export function astmHeaderIdentity(rng: Rng): AstmHeaderIdentity {
  const sender = rng.pick(SYNTHETIC_SENDERS);
  const analyzer = rng.pick(SYNTHETIC_ANALYZERS);
  return { sender, analyzer };
}
