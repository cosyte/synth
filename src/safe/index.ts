/**
 * The `safe` namespace — the single entry point for every synthetic-by-construction value provider.
 *
 * Grouped under one object so a consumer reads `safe.ssn(rng)` / `safe.phone(rng)` and it is
 * self-evident that the value is drawn from a guaranteed-non-colliding synthetic source (roadmap §4).
 * The individual functions and the reserved-range predicates are also exported by name from the
 * package root for direct import.
 *
 * @module
 */

import {
  ssn,
  phone,
  name,
  email,
  ipv4,
  ipv6,
  uuid,
  identifier,
  address,
  dateYmd,
} from "./providers.js";

export * from "./providers.js";
export * from "./reserved.js";
export * from "./names-pool.js";

/**
 * The synthetic-safety provider namespace. Every function draws only from a reserved range or the
 * shipped fake-name pool — no value it returns can be real or plausibly-real PHI.
 *
 * @example
 * ```ts
 * import { createRng, safe } from "@cosyte/synth";
 * const rng = createRng(42);
 * safe.ssn(rng);   // never-issued SSN
 * safe.phone(rng); // reserved 555-01NN number
 * ```
 */
export const safe = Object.freeze({
  ssn,
  phone,
  name,
  email,
  ipv4,
  ipv6,
  uuid,
  identifier,
  address,
  dateYmd,
});
