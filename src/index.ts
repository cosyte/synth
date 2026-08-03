/**
 * `@cosyte/synth` — a deterministic, seedable **synthetic-data / test-fixture generator** for the
 * cosyte healthcare formats. A *consumer* of the parsers, not a parser: it builds artifacts **through
 * each parser's own builder/serializer** (so output is spec-clean by construction) and draws every
 * value from a **guaranteed-non-colliding synthetic source** (so no output can be real or
 * plausibly-real PHI). It is a **format/conformance generator, not a clinical simulator**.
 *
 * This root entry point exposes the **format-agnostic core**: the seeded PRNG, the synthetic-safety
 * providers, the `Corpus` abstraction, the profile skeleton, and the fatal codes. Per-format
 * generation lives behind its own subpath (`@cosyte/synth/hl7`) so importing the root never pulls a
 * parser — the lazy per-format boundary.
 *
 * @module
 */

/**
 * Library version string, equal to this package's published `package.json#version`.
 *
 * Changesets owns the bump and rewrites `package.json` only, so the release `version` script runs
 * `scripts/sync-version.mjs` to rewrite this declaration in the same commit, and
 * `test/sanity.test.ts` compares the two so a skipped sync goes red instead of shipping a version
 * string that lies.
 *
 * The `: string` annotation is deliberate: without it the declaration's inferred type is the string
 * literal itself, which bakes the current release into the emitted declarations and narrows every
 * consumer's type on each bump.
 *
 * @example
 * ```ts
 * import { VERSION } from "@cosyte/synth";
 * console.log(VERSION);
 * ```
 */
export const VERSION: string = "0.0.6";

// ── Seeded, deterministic PRNG (the reproducibility contract, roadmap §5) ──
export { createRng, type Rng } from "./rng/rng.js";
export { splitmix32 } from "./rng/splitmix32.js";
export { sfc32Next, type Sfc32State } from "./rng/sfc32.js";

// ── The synthetic-safety provider layer (roadmap §4) ──
export {
  safe,
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
  npi,
  dea,
  type SyntheticName,
  type SyntheticAddress,
  type SyntheticIdentifier,
  type SsnBlock,
} from "./safe/index.js";
export {
  isSyntheticSsn,
  isSyntheticPhone,
  isSyntheticEmail,
  isSyntheticIp,
  isSyntheticNpi,
  npiCheckDigit,
  luhnMod10,
  isSyntheticDea,
  deaCheckDigit,
  DEA_REGISTRANT_TYPES,
  SYNTHETIC_ASSIGNING_AUTHORITY,
  RESERVED_EMAIL_DOMAINS,
  TEST_NET_V4_PREFIXES,
  DOC_V6_PREFIX,
  NPI_LUHN_PREFIX,
} from "./safe/reserved.js";
export {
  SYNTHETIC_GIVEN_NAMES,
  SYNTHETIC_FAMILY_NAMES,
  SYNTHETIC_STREET_NAMES,
  SYNTHETIC_CITY_NAMES,
} from "./safe/names-pool.js";

// ── The reproducible Corpus abstraction (roadmap §2, §5) ──
export {
  makeCorpus,
  type Corpus,
  type CorpusManifest,
  type Artifact,
  type SynthFormat,
} from "./corpus.js";

// ── The profile growth-loop skeleton (roadmap §Phase 1) ──
export { defineSynthProfile, type SynthProfile, type SynthProfileSpec } from "./profile.js";

// ── The quirk core (roadmap §Phase 7 — the differentiator; format recipes live per-subpath) ──
export {
  resolveQuirk,
  sameCodeSet,
  profileTolerated,
  validateProfileQuirks,
  assertIntendedWarnings,
  PROFILE_QUIRK_APPLIED,
  type QuirkDescriptor,
  type QuirkArtifact,
  type QuirkProfileDisposition,
  type QuirkProfiledVerdict,
  type QuirkRoundTripResult,
} from "./quirk.js";

// ── Stable fatal codes + the typed error (roadmap §Phase 1) ──
export {
  SYNTH_FATAL_CODES,
  SYNTH_FATAL_MESSAGES,
  SynthError,
  type SynthFatalCode,
} from "./codes.js";
export { resolveKind, resolveMix } from "./select.js";
