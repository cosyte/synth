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
- **Phase 2 — the rest of the HL7 v2 set (SYNTH-2).** Extends HL7 v2 generation from `ADT` alone to
  the full Phase 2 family, all built **through `@cosyte/hl7`'s `buildMessage`** and all round-tripping
  through the parser with **zero warnings**, seed-deterministic, and synthetic-safe:
  - **New generators** at the `@cosyte/synth/hl7` subpath: `generateOru` (`ORU^R01`, an OBR/OBX result
    group), `generateOrm` (`ORM^O01`, an ORC/OBR order), `generateSiu` (`SIU^S12`, an SCH schedule
    activity), and `generateVxu` (`VXU^V04`, a PID + ORC/RXA/RXR immunization). Each emits exactly the
    segments the parser's structure net requires for its trigger, so nothing warns.
  - **`generateHl7(kind, seed)`** — a dispatch over every `Hl7MessageKind`
    (`ADT^A01`/`A04`/`A08`, `ORU^R01`, `ORM^O01`, `SIU^S12`, `VXU^V04`).
  - **`hl7Corpus` now generates a mixed corpus** across every family by default (`mix?` to choose,
    `triggers?` kept for SYNTH-1 ADT-only back-compat).
  - **Shared HL7 building blocks** (`mshScaffold`, `patientIdentity`, `pidSegment`, `seededTimestamp`)
    so every family mints identity from the same synthetic-safety providers in the same draw order;
    `ADT` now uses them (byte-identical output preserved).
  - **A small, license-clean example-code pool** (`EXAMPLE_LAB_OBSERVATIONS`, `EXAMPLE_ORDER_SERVICES`,
    `EXAMPLE_VACCINES` — public LOINC/CVX code facts) to fill coded fields. **No** terminology is
    bundled; codes are illustrative structural fillers only.
  - **Tier-1 fixtures** for the new families and the synthetic-safety + seed-determinism property tests
    extended to sweep every family (PID loci provably synthetic; whole-message real-data sweep zero).
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
