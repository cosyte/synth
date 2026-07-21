# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions and publishing are managed with [Changesets](https://github.com/changesets/changesets);
this file is maintained by hand (Changesets handles the version bump and publish only).

## [Unreleased]

The first pre-alpha release (`0.0.1`) will ship the initial public API surface. The package begins
its public history at `0.0.x`, per the cosyte version ladder (`0.0.x` until first alpha).

### Added

- Project scaffold from the shared `@cosyte/*` parser template: the canonical toolchain (TypeScript
  ES2023 + strict rigor via `@cosyte/tsconfig`, ESLint 10 + type-checked `typescript-eslint` via
  `@cosyte/eslint-config`, Prettier via `@cosyte/prettier-config`, Vitest 4 + v8 coverage via
  `@cosyte/vitest-config`, dual ESM + CJS build via `tsup` + `@cosyte/tsup-config`, `attw` publish
  gate), thin callers of the reusable `cosyte/.github` CI/release workflows, Changesets on the
  `0.0.x` ladder, and the property-based conformance harness from `@cosyte/test-utils`.
- **Phase 1 — the generator core (SYNTH-1).** The seeded-PRNG + synthetic-safety + round-trip
  foundation every format plugs into, proven end-to-end on HL7 v2:
  - **Seeded, deterministic PRNG** — a hand-rolled, zero-dep `sfc32` seeded by `splitmix32`
    (`createRng`, `splitmix32`, `sfc32Next`). `Math.random` is **lint-banned** in `src/` (it is not
    seedable). Same seed → byte-identical output, a tested invariant.
  - **The synthetic-safety provider layer** (`safe` + `ssn`/`phone`/`email`/`ipv4`/`ipv6`/`uuid`/
    `identifier`/`address`/`dateYmd`/`name`) — every value drawn from a guaranteed-non-colliding
    source: SSA never-issued (`900–999`) + advertising (`987-65-432x`) SSNs, NANP `555-01xx` phones,
    RFC 2606/6761 `example.*` domains, RFC 5737/3849 TEST-NET IPs, a synthetic assigning authority
    (`COSYTE-SYNTH`) for MRNs, and a shipped clearly-fake name pool. Reserved-range predicates
    (`isSyntheticSsn`/`isSyntheticPhone`/`isSyntheticEmail`/`isSyntheticIp`).
  - **The `Corpus` abstraction** (`makeCorpus`) — a deep-frozen, self-describing seed + manifest.
  - **`defineSynthProfile`** — the profile growth-loop skeleton.
  - **Stable fatal codes** (`SYNTH_FATAL_CODES`: `SYNTH_UNSUPPORTED_FORMAT`, `SYNTH_UNSUPPORTED_QUIRK`)
    - the typed `SynthError`.
  - **HL7 v2 generation** at the `@cosyte/synth/hl7` subpath (`generateAdt`, `roundTrip`, `hl7Corpus`,
    `componentsField`) — builds `ADT^A01/A04/A08` **through `@cosyte/hl7`'s `buildMessage`**, so output
    is spec-clean by construction and round-trips with zero warnings.
  - **The round-trip harness + synthetic-safety CI gate** — property tests prove seed-determinism,
    zero-warning round-trips, and that no generated value escapes a reserved/synthetic source; the
    repo `phi-scan` gains HL7-PID structured detection (synthetic-SSN-range aware).
  - **Vendored `@cosyte/hl7`** as an optional peer dep via the `mllp` pattern (`file:vendor/*.tgz`
    devDependency) — third-party runtime deps stay at **zero**.
- `VERSION` export.

### Changed

- Replaced the parser-archetype scaffold stubs (`parseSynth`, `WARNING_CODES`, `FATAL_CODES`) with the
  generator surface — `@cosyte/synth` is a synthetic-fixture **generator**, not a parser.

### Deprecated

### Removed

### Fixed

### Security

[Unreleased]: https://github.com/cosyte/synth/commits/main
