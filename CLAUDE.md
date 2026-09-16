# @cosyte/synth: Project Guide for Claude

> **The long-form record is `documentation/agent-notes.md`**: the shipped-phase histories, the
> per-incident narratives and the measured evidence behind every one-line rule here, **relocated
> verbatim, not deleted** (meta-repo ADR 0023, amendment 2026-08-04). This file is always-read and
> every worker pays for it; that one is read on demand. A pointer written `notes#<section>` below names
> that section: **read it before you touch the thing the rule guards**, and when you refute
> something, correct it _there_ and keep the one-line rule here pointing at it.

## Project

**`@cosyte/synth`**: a deterministic, seedable **synthetic healthcare-fixture generator** for
Node.js/TypeScript, published under the Cosyte brand. Open-source (MIT). It is a **consumer** of the
sibling `@cosyte/*` parsers, **not a parser**: it builds artifacts _through_ each parser's own
builder/serializer (spec-clean by construction) and draws every value from a guaranteed-non-colliding
synthetic source. See the roadmap `operations/roadmaps/synth.md` in the meta-repo.

**North star:** a developer writes `generateAdt({ seed: 12345 })` and gets a structurally-valid HL7 v2
message whose every identifier/name/date is provably synthetic and which round-trips through
`@cosyte/hl7` with zero warnings, and the _same seed_ on any machine yields the _byte-identical_
message. The central reflex is neither the parser's liberal parse nor a de-identifier's fail-closed:
it is **synthetic-by-construction**: no code path can emit a value not drawn from a reserved range or
the shipped fake-name pool. It borrows the archetype's _disciplines_ (immutability, stable typed codes,
the profile system) but its correctness is round-trip fidelity + seed-determinism + synthetic-safety,
not wire tolerance. **It is a format/conformance generator, NOT a clinical simulator (that is Synthea).**

## Status

- **Phases 1–9 shipped (SYNTH-1 … SYNTH-11): the roadmap is complete.** Pre-alpha `0.0.x`. All six
  formats have spec-clean generators built through their sibling parser's own builder (HL7 v2, FHIR
  R4/US Core, C-CDA R2.1, X12 005010, NCPDP SCRIPT + Telecom, ASTM E1394/E1381), plus vendor-quirk
  mode for HL7 v2/C-CDA/ASTM and the `@cosyte/deid` pairing loop. Per-format public surface, what
  each is built through, and **every DEFERRED item** (X12 270; SCRIPT lifecycle responses;
  FHIR/X12/NCPDP quirks; NCPDP-SCRIPT/ASTM/DICOM deid pairing; Synthea ingestion):
  `notes#status-the-shipped-roadmap-in-full` (per-format subsections `notes#hl7-v2` through
  `notes#astm-synth-8`).
- **Never quote a version here as the CURRENT one**, `npm view @cosyte/synth version` is the only
  source of truth; a number written into this file is stale on the next release. The one exception is
  a DATED MEASUREMENT, like the one immediately below: it records the version a check actually
  installed on a named day, and a dated fact does not go stale because it never claimed to be current.
- **A CONSUMER INSTALL SUCCEEDED, MEASURED ON 2026-08-30, AND A CHECK RE-RUNS IT**: `pnpm
check:install`, `--mode=pack` per pull request and `--mode=registry` per release, where an
  unreachable registry or a missing version is a **FAILURE**, never a skip. **NEVER WRITE THE
  INSTALL UP AS RESOLVED BY REASONING: A DATED MEASUREMENT PLUS ITS CHECK IS THE ONLY THING THAT MAY
  BE WRITTEN HERE**, and `peerDependenciesMeta` is not an argument in either direction. What was
  measured, and the readings that stay RETRACTED: `notes#the-consumer-install-and-the-check-that-re-runs-it`.
- The repo is **already public** (still a non-waived act as **policy**, but not an outstanding item
  of **state**) and `npm publish` is covered by the standing waiver. **Publish state and visibility
  are independent: never infer one from the other, in either direction.**
- The six parsers **and `@cosyte/deid`** are **optional peer deps**, vendored for dev/test via the
  `mllp` pattern (`vendor/*.tgz`). **Third-party runtime deps stay at 0.** Refresh recipe, and the
  `peerDependencies` entry `pnpm remove` strips:
  `notes#optional-peer-deps-and-how-to-refresh-a-vendored-tarball`.

## Synthetic-safety and PHI discipline (why this package exists)

Correctness here is round-trip fidelity + seed-determinism + **synthetic-safety**. These are the
traps a fixture generator gets wrong exactly once.

- **No code path may emit a value not drawn from a reserved range or the shipped fake-name pool.**
  900-range SSNs, a **deliberately-invalid-Luhn** NPI (`safe.npi`), a **deliberately-invalid-checksum**
  DEA (`safe.dea`), `555-01xx` phones, `example.*` domains, TEST-NET addresses, synthetic-AA-scoped
  MRN/member/patient ids. Full posture: `docs-content/limitations.md`,
  `notes#shipped-phases-release-hardening-and-the-generator-core`.
- **A Luhn-valid NPI or a checksum-valid DEA in output is a HARD `phi-scan` hit**, never "fix" a
  synthetic identifier so it validates. Per-format scanner arms (X12 NM1/PER/REF; NCPDP SCRIPT
  `<NPI>`/`<DEANumber>` + Telecom CA/CB/CC/CD/CQ/CY/C2/DB; ASTM P-record fields 3/4/6):
  `notes#x12-005010-synth-6`, `notes#ncpdp-synth-7`, `notes#astm-synth-8`.
- **Never hand-write framing, checksums or envelopes, they are the parser's own, never faked.** The
  ASTM E1381 modulo-256 checksum and `0`–`7` frame numbers come from `composeAstmFrames`, the X12
  ISA/GS/ST…SE/GE/IEA envelope and HL spine from `@cosyte/x12`'s domain builders, and NCPDP goes
  through the public typed model + serializer, **never hand-written bytes**. `notes#astm-synth-8`,
  `notes#x12-005010-synth-6`, `notes#ncpdp-synth-7`.
- **Never let a builder default supply a wall-clock value.** `buildCcda`'s default
  `effectiveTime: new Date()` is **always overridden** with a synthetic date or the reproducibility
  contract silently breaks. `notes#c-cda-r21-synth-5`.
- **ASTM practice- and laboratory-assigned patient IDs are minted independently and must stay
  distinct** (`PRA`/`LAB`). `notes#astm-synth-8`.
- **Code/drug pools stay license-clean**: invented `00000`-labeler NDCs, public LOINC plus invented
  local codes, US Core validated against real profiles under `test/us-core-profiles/` (BYO, no IG
  bundled). **No NCPDP or terminology prose is ever bundled.**
  `notes#fhir-r4--us-core-synth-3--synth-4`.
- **A quirk deviates structure, never provenance**: `phi-scan` stays **zero** over quirk output.
  Every quirk is **publicly grounded** (ADR 0018), is a **post-serialize transform** (profile
  tolerance is parse-side) round-tripping to **exactly one intended warning**, and an unsupported one
  is a fatal `SYNTH_UNSUPPORTED_QUIRK`. `notes#vendor-quirk-mode-synth-9-phase-7`.
- **The `deid` pairing loop is CO-VALIDATION, not an independent audit of `@cosyte/deid`.** A
  surviving sentinel is a hard failure, the over-scrub guard is equally load-bearing, and **never
  widen the sweep past the former PHI loci** (retained provider identity is drawn from the same
  synthetic pools and would read as a false survivor).
  `notes#the-cosytedeid-pairing-loop-synth-10-phase-8`.
- **`pnpm phi-scan` reads MORE than its three roots, and the two modes do NOT share a scope.**
  All-mode walks `src`/`test`/`scripts` and then reads every other file git tracks; **`--staged`, the
  pre-commit half, still narrows to the three roots**. **Write a corpus exemption as a LITERAL PATH,
  never as a predicate**, and refreshing a `vendor/*.tgz` means editing `BINARY_EXEMPT_PATHS`. **What
  is unchanged on `--staged` is the ENUMERATION and ONLY that: the allow-list is GLOBAL and
  route-blind.** **A scan root of the wrong KIND refuses with 2, derived here, not ported.**
  `notes#the-phi-scan-reads-more-than-its-three-roots`.
- **A TARGET THE SCAN ENUMERATED AND NEVER READ IS REFUSED (exit 2), NAMED, AND NEVER REPORTED ON**,
  so **`--allow-fixture` cannot reach exit 0 in any mode**: a logged whole-file bypass is RECORDED and
  then REFUSED, and the only thing that CLEARS a value is `scripts/phi-allow-list.txt`, which clears
  it while keeping the file in the sweep. `notes#a-target-enumerated-and-never-read-is-refused`.
- **Never commit realistic PHI.** A vendor quirk is encoded only when a real de-identified document
  grounds it, never invented.

## Tech Stack (the shared `@cosyte/*` standard)

This repo inherits the canonical toolchain by depending on the published `@cosyte/*` config packages,
not by copying files. The source of truth is the meta-repo's `documentation/conventions.md`: this is
a summary.

- **Language:** TypeScript (strict, full rigor set incl. `noUncheckedIndexedAccess`) via
  `@cosyte/tsconfig`. **Target ES2023**, `NodeNext`. TypeScript 5.9.x, exact-pinned.
- **Build:** dual ESM + CJS + `.d.ts` via `tsup` (`@cosyte/tsup-config`); `attw` is a publish gate
  (per-condition types: `.d.ts` for `import`, `.d.cts` for `require`). The `attw` script is
  **`node scripts/attw.mjs --profile node16`, not the bare CLI**: see the guardrail below; the CLI
  reports a wholly-untyped pack as "does not contain types" and **exits 0**.
- **Node:** **>= 22** (CI matrix 22 + 24).
- **Package manager:** `pnpm@10`.
- **Lint/format:** **ESLint 10** + unified `typescript-eslint` (type-checked) via
  `@cosyte/eslint-config`; Prettier via `@cosyte/prettier-config`. Lint at `--max-warnings=0`.
- **Testing:** **Vitest 4** + v8 coverage (`@cosyte/vitest-config`), per-directory >= 90 gates; the
  property-based conformance invariants come from `@cosyte/test-utils` (round-trip, lenient-mode,
  immutability, warning-code stability), the format-specific arbitraries stay in this repo.
- **CI/CD:** thin callers of the reusable `cosyte/.github` workflows.
- **Runtime deps:** **Zero.** Node stdlib only.
- **License:** MIT.

## Required checks on `main`

Moved whole and unchanged to
[documentation/required-checks-on-main.md](documentation/required-checks-on-main.md): read it
before you touch a workflow, a job name or a required context.

## Engineering Guardrails

Moved whole and unchanged to
[documentation/engineering-guardrails.md](documentation/engineering-guardrails.md): read it before
you touch the thing a guardrail guards.

## Standing disciplines (every change)

Moved whole and unchanged to
[documentation/standing-disciplines.md](documentation/standing-disciplines.md): read it before you
open a change.
