/**
 * `@cosyte/synth` — a deterministic, seedable **synthetic-data / test-fixture generator** for the
 * cosyte healthcare formats. A *consumer* of the parsers, not a parser: it builds artifacts **through
 * each parser's own builder/serializer** (so output is spec-clean by construction) and draws every
 * value from a **guaranteed-non-colliding synthetic source** (so no output can be real or
 * plausibly-real PHI). It is a **format/conformance generator, not a clinical simulator** — see the
 * meta-repo roadmap `operations/roadmaps/synth.md`.
 *
 * This root entry point exposes the **format-agnostic core**: the seeded PRNG, the synthetic-safety
 * providers, the `Corpus` abstraction, the profile skeleton, and the fatal codes. Per-format
 * generation lives behind its own subpath (`@cosyte/synth/hl7`) so importing the root never pulls a
 * parser — the lazy per-format boundary (roadmap §1).
 *
 * @module
 */

/**
 * Library version string, synced with `package.json#version` by downstream release tooling.
 *
 * @example
 * ```ts
 * import { VERSION } from "@cosyte/synth";
 * console.log(VERSION);
 * ```
 */
export const VERSION = "0.0.0";

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

// ── Stable fatal codes + the typed error (roadmap §Phase 1) ──
export { SYNTH_FATAL_CODES, SynthError, type SynthFatalCode } from "./codes.js";
