# @cosyte/synth — Project Guide for Claude

## Project

**`@cosyte/synth`** — a deterministic, seedable **synthetic healthcare-fixture generator** for
Node.js/TypeScript, published under the Cosyte brand. Open-source (MIT). It is a **consumer** of the
sibling `@cosyte/*` parsers, **not a parser** — it builds artifacts _through_ each parser's own
builder/serializer (spec-clean by construction) and draws every value from a guaranteed-non-colliding
synthetic source. See the roadmap `operations/roadmaps/synth.md` in the meta-repo.

**North star:** a developer writes `generateAdt({ seed: 12345 })` and gets a structurally-valid HL7 v2
message whose every identifier/name/date is provably synthetic and which round-trips through
`@cosyte/hl7` with zero warnings — and the _same seed_ on any machine yields the _byte-identical_
message. The central reflex is neither the parser's liberal parse nor a de-identifier's fail-closed —
it is **synthetic-by-construction**: no code path can emit a value not drawn from a reserved range or
the shipped fake-name pool. It borrows the archetype's _disciplines_ (immutability, stable typed codes,
the profile system) but its correctness is round-trip fidelity + seed-determinism + synthetic-safety,
not wire tolerance. **It is a format/conformance generator, NOT a clinical simulator (that is Synthea).**

## Status

- **Phases 1–9 shipped (SYNTH-1 … SYNTH-11) — the roadmap is complete.** Pre-alpha `0.0.x`, not yet
  published to npm; the actual `npm publish` and the repo public-flip are the two standing founder gates
  (the only remaining tail). **SYNTH-11 (Phase 9, release hardening)** added no runtime API — it is the
  release-readiness layer: a **consolidated conformance property suite**
  (`test/property/all-formats.property.test.ts`) driving every spec-clean format generator through the
  same three mandatory properties (round-trip · seed-determinism · synthetic-safety) with an
  intended-warning arm for the HL7 v2 / C-CDA / ASTM quirk corpora and non-vacuity asserted directly; a
  **seed-sweep generation fuzz** (`test/property/seed-sweep.fuzz.property.test.ts`, the inverted fuzz of
  roadmap §6) proving generation is total over seed × count × format, scaled by `SYNTH_FUZZ_RUNS` with a
  `test:fuzz` script + nightly `Fuzz` workflow; a **dual ESM/CJS release-shape smoke**
  (`scripts/smoke.mjs`, `smoke` script, run by `verify.sh`) across all eight subpaths; a proven publish
  dry-run (`attw` green + a clean `npm publish --dry-run` tarball); per-dir ≥90 coverage still gating;
  and the honesty doc `docs-content/limitations.md` (does/does-not + the full synthetic-safety posture:
  900-range SSN, invalid-Luhn NPI, invalid-checksum DEA, `555-01xx`, `example.*`, TEST-NET, synthetic-AA
  MRN; structural-not-clinical / not-Synthea; the deferred surfaces). The
  generator core is in place: the seeded PRNG (`createRng`, `src/rng/`), the synthetic-safety providers
  (`src/safe/` — incl. `safe.npi`, a deliberately-invalid-Luhn NPI + `isSyntheticNpi`, and `safe.dea`, a
  deliberately-invalid-checksum DEA + `isSyntheticDea`/`deaCheckDigit`), the `Corpus` abstraction,
  `defineSynthProfile`, the `SYNTH_FATAL_CODES`/`SynthError`. All six formats are wired:
  - **HL7 v2** at the `@cosyte/synth/hl7` subpath (`generateAdt`/`generateOru`/`generateOrm`/
    `generateSiu`/`generateVxu`/`generateHl7`/`hl7Corpus`/`roundTrip`), built through `@cosyte/hl7`'s
    `buildMessage`, round-tripping with zero warnings.
  - **FHIR R4 / US Core (SYNTH-3 + SYNTH-4)** at the `@cosyte/synth/fhir` subpath — the full US Core
    clinical set: `generatePatient` (base + `profile:"us-core"`), `generateCondition`,
    `generateObservationLab`, `generateVitalSign`, `generateMedicationRequest`, `generateEncounter`,
    `generateDiagnosticReport`, `generateImmunization`, `generateAllergyIntolerance`,
    `generateProcedure`, `generateBundle` (collection + transaction + `document`), `buildComposition`,
    `fhirCorpus`, and the FHIR `roundTrip` harness. Built through `@cosyte/fhir`'s model constructors +
    serializer (spec-clean by construction); US Core conformance is validated firsthand against the
    **real US Core 6.1.0 profiles** committed under `test/us-core-profiles/` (BYO — no IG bundled).
  - **C-CDA R2.1 (SYNTH-5)** at the `@cosyte/synth/ccda` subpath — `generateCcd` (Continuity of Care
    Document), `generateReferralNote`, the generic `generateCcda({ documentType })`, `ccdaCorpus`,
    `ccdaPatientIdentity`, and the C-CDA `roundTrip` harness. Built through `@cosyte/ccda`'s `buildCcda`
    (spec-clean by construction), so each document round-trips through `parseCcda` with zero warnings.
    Populates the CCD SHALL sections (Problems/Allergies/Medications/Results/Vital Signs) plus
    Immunizations, Procedures, and Social History, reusing the FHIR generators' license-clean
    example-code pools (adapted to `@cosyte/ccda`'s OID-coded `BuildCode`). `buildCcda`'s default
    `effectiveTime: new Date()` is **always overridden** with a synthetic date, so the reproducibility
    contract holds.
  - **X12 005010 (SYNTH-6)** at the `@cosyte/synth/x12` subpath — `generate837P`/`generate837I`/
    `generate837D` (claims), `generate835` (remittance, balance-checked by construction), `generate271`
    (eligibility), the shared `generate837(variant, …)`, `x12Corpus`, the `x12*` identity minters, the
    `dec`/`money` helpers, and the X12 `roundTrip` harness. Built through `@cosyte/x12`'s domain builders
    (`build837P/I/D`, `build835`, `build271`), so the ISA/GS/ST…SE/GE/IEA envelope + HL spine are the
    builder's own and each transaction round-trips through `@cosyte/x12` with zero warnings. The
    identity-dense synthetic-safety invariant: NPIs carry a **deliberately-invalid Luhn** check digit
    (never a real NPI), provider tax ids are 900-range SSNs at `REF*SY`, member ids are synthetic-AA
    scoped. The `phi-scan` gains X12-aware structured detection (NM1/PER/REF loci; a Luhn-valid NPI is a
    hard hit). **Deferred: the 270 request (`@cosyte/x12` ships no `build270`).** Quirk mode is Phase 7.
  - **NCPDP (SYNTH-7)** at the `@cosyte/synth/ncpdp` subpath — **SCRIPT** ePrescribing (`generateNewRx`
    via the validated `buildNewRx`; `generateRxRenewalRequest`/`generateRxChangeRequest` via
    `@cosyte/ncpdp`'s public typed `ScriptMessage` model + `serializeScript` — the X12 typed-model→
    serializer pattern, never hand-written bytes) and **Telecom** vD.0 claims (`generateB1`/`generateB2`/
    `generateB3` via `buildTelecomRequest` + `serializeTelecom`), plus `generateTelecom`, `ncpdpCorpus`,
    the `scriptRoundTrip`/`telecomRoundTrip` harnesses, the `ncpdp*` identity minters, and a
    license-clean `EXAMPLE_DRUGS` pool (invented `00000`-labeler NDCs — no NCPDP prose bundled). Each
    message round-trips through `@cosyte/ncpdp` with zero warnings, byte-stable. The identity invariant
    adds the **prescriber DEA** (invalid checksum, `safe.dea`) alongside the NPI (invalid Luhn);
    patient/cardholder ids are synthetic-AA scoped (`MBR`-prefixed). The `phi-scan` gains an NCPDP arm
    (SCRIPT `<NPI>`/`<DEANumber>`/name tags; Telecom field-id-keyed CA/CB/CC/CD/CQ/CY/C2/DB — a
    Luhn-valid NPI or checksum-valid DEA is a hard hit). **Deferred: SCRIPT lifecycle _responses_
    (track the parser's builder surface).** Quirk mode is Phase 7.
  - **ASTM (SYNTH-8)** at the `@cosyte/synth/astm` subpath — E1394 record reports (`generateAstmResult`
    = `H`/`P`/`O`/`R`…/`C`/`L`; `generateAstmOrder` = `H`/`P`/`O`/`L`) built through `@cosyte/astm`'s
    `buildAstmMessage`, and the E1381-**framed** twin (`generateAstmResultFramed`) via `composeAstmFrames`
    (the modulo-256 checksum + `0`–`7` frame numbers are the parser's own, never faked), plus `astmCorpus`,
    the `astmRoundTrip`/`astmFramedRoundTrip` harnesses, the `astmPatient`/`astmOrder`/`astmHeaderIdentity`
    identity minters, and a license-clean `EXAMPLE_ASTM_TESTS` pool (public LOINC + invented local codes;
    no terminology prose bundled). Each message round-trips through `@cosyte/astm` with zero warnings,
    byte-stable. The `P`-record identity invariant: name from the pool, DOB seeded, and the
    practice-assigned + laboratory-assigned patient IDs minted independently (synthetic-AA scoped,
    `PRA`/`LAB`-prefixed) so they stay **distinct**. The `phi-scan` gains an ASTM arm (P-record name field
    6 + practice/lab ID fields 3/4, tolerating an E1381 frame prefix). This **completes the spec-clean
    generation core across all six formats**.
  - **Vendor-quirk mode (SYNTH-9, Phase 7)** — the differentiator. Profile-driven off-spec fixtures for the
    three richest profile systems (**HL7 v2, C-CDA, ASTM**) at the `@cosyte/synth/{hl7,ccda,astm}` subpaths:
    `generate{Hl7,Ccda,Astm}Quirk` + `{hl7,ccda,astm}QuirkRoundTrip` + `{hl7,ccda,astm}QuirkCorpus`, plus the
    format-agnostic core in `src/quirk.ts` (`QuirkDescriptor`/`QuirkArtifact`/`QuirkRoundTripResult`,
    `resolveQuirk`, `profileTolerated`, `validateProfileQuirks`, `PROFILE_QUIRK_APPLIED`). Each quirk is a
    **post-serialize transform** (roadmap §10 Q4: profile tolerance is parse-side) that round-trips to
    **exactly one intended parser warning** (the intended-warning contract): HL7 `unknown-zsegment`→
    `UNKNOWN_SEGMENT` (suppressed by the public `visage` profile) + `unknown-escape`→`UNKNOWN_ESCAPE_SEQUENCE`;
    C-CDA `template-extension-absent`→`TEMPLATE_EXTENSION_ABSENT` (`legacyR11`), `deprecated-loinc`→
    `DEPRECATED_LOINC` + `deprecated-code-system`→`DEPRECATED_CODE_SYSTEM` (`smartScorecard`), each re-badged
    to `PROFILE_QUIRK_APPLIED`; ASTM `unknown-escape`→`ASTM_UNKNOWN_ESCAPE_SEQUENCE` (`referenceCorpus`
    re-badge) + `unknown-record-type`→`ASTM_RECORD_UNKNOWN_TYPE`. An unsupported quirk is a fatal
    `SYNTH_UNSUPPORTED_QUIRK`; synthetic-safety still holds (a quirk deviates structure, never provenance —
    the `phi-scan` gate stays zero over quirk output). All quirks are **publicly grounded** (ADR 0018);
    quirk recipes for **FHIR/X12/NCPDP are deferred**, as is any quirk needing a private vendor corpus.
  - **The `@cosyte/deid` pairing loop (SYNTH-10, Phase 8)** — a deterministic, seeded **closed-loop
    co-validation harness** at the `@cosyte/synth/deid` subpath: **generate → plant tagged synthetic PHI
    sentinels at the patient loci → de-identify via `@cosyte/deid` → verify every sentinel is gone**
    (a surviving sentinel is a hard failure) **and** the clinical payload survives (the over-scrub guard).
    Per-format loops `{hl7,fhir,x12,ncpdpTelecom,ccda}DeidLoop` returning an immutable `DeidLoopResult`,
    plus `summarizeDeidCoverage`, `deidLoopPolicy` (Safe Harbor with MRN/beneficiary/account → `redact`,
    so **no key context** is needed and the loop is a pure function of the seed), and the testable
    primitives `identifierSentinels`/`recordTargetSentinels`/`sweepSurvivors`/`clinicalRetention`. The
    removal check is **locus-scoped and collision-proof**: sentinels come from the patient PHI loci
    (deid's own extractors for HL7/FHIR/X12/NCPDP; a `<recordTarget>` scan for C-CDA — deid's C-CDA
    extractor needs a DOM), decomposed to literal distinctive synthetic tokens, and the sweep reads only
    the de-identified values remaining **at those former PHI loci** — so provider/organization identity a
    de-identifier legitimately retains (drawn from the same synthetic pools) never reads as a false
    survivor. It is a **co-validation harness, not an independent audit** of deid; `blocked` counts as
    removed; it **consumes the shipped generators unchanged**. **Deferred:** NCPDP **SCRIPT** / **ASTM** /
    **DICOM** pairing (no `@cosyte/deid` adapter, or not generated — `DEID_LOOP_SKIPPED` names each), and
    optional **Synthea** clinical-content ingestion (roadmap §Phase 8 — a documented future concern).
- The six parsers **and `@cosyte/deid`** are **optional peer deps**, vendored for dev/test via the
  `mllp` pattern (`vendor/cosyte-hl7-0.0.0.tgz`, `vendor/cosyte-fhir-0.0.0.tgz`,
  `vendor/cosyte-ccda-0.0.1.tgz`, `vendor/cosyte-x12-0.0.1.tgz`, `vendor/cosyte-ncpdp-0.0.1.tgz`,
  `vendor/cosyte-astm-0.0.0.tgz`, `vendor/cosyte-deid-0.0.0.tgz`). Refresh one by re-running, e.g.,
  `pnpm -C ../deid build && pnpm -C ../deid pack --pack-destination ../synth/vendor` then
  `pnpm add -D @cosyte/deid@file:vendor/cosyte-deid-0.0.0.tgz` (restore the `peerDependencies` entry
  after if `pnpm remove` stripped it). **Third-party runtime deps stay at 0.** Quirk generation (Phase 7)
  ships for HL7 v2/C-CDA/ASTM; FHIR/X12/NCPDP quirks are deferred, and the `deid` pairing loop (Phase 8)
  ships for HL7/FHIR/C-CDA/X12/NCPDP Telecom.

## Tech Stack (the shared `@cosyte/*` standard)

This repo inherits the canonical toolchain by depending on the published `@cosyte/*` config packages,
not by copying files. The source of truth is the meta-repo's `documentation/conventions.md` — this is
a summary.

- **Language:** TypeScript (strict, full rigor set incl. `noUncheckedIndexedAccess`) via
  `@cosyte/tsconfig`. **Target ES2023**, `NodeNext`. TypeScript 5.9.x, exact-pinned.
- **Build:** dual ESM + CJS + `.d.ts` via `tsup` (`@cosyte/tsup-config`); `attw` is a publish gate
  (per-condition types: `.d.ts` for `import`, `.d.cts` for `require`).
- **Node:** **>= 22** (CI matrix 22 + 24).
- **Package manager:** `pnpm@10`.
- **Lint/format:** **ESLint 10** + unified `typescript-eslint` (type-checked) via
  `@cosyte/eslint-config`; Prettier via `@cosyte/prettier-config`. Lint at `--max-warnings=0`.
- **Testing:** **Vitest 4** + v8 coverage (`@cosyte/vitest-config`), per-directory >= 90 gates; the
  property-based conformance invariants come from `@cosyte/test-utils` (round-trip, lenient-mode,
  immutability, warning-code stability) — the format-specific arbitraries stay in this repo.
- **CI/CD:** thin callers of the reusable `cosyte/.github` workflows.
- **Runtime deps:** **Zero.** Node stdlib only.
- **License:** MIT.

## Engineering Guardrails

- No `any`. No unjustified `as` casts. Use `unknown` and narrow.
- JSDoc (with `@example`) on every public export — the JSDoc lint rule is an **error** on public
  exports, so this is enforced, not optional.
- Immutable by default. Mutation only via explicit methods.
- No `console.*` in library code. Throw typed errors or return results.
- Short, testable functions over big parsing blobs.
- Postel's Law: parser is liberal (lenient default + warnings), serializer is conservative (always
  emits spec-clean output).
- Fatal errors only for unrecoverable structural corruption (Tier-3 codes). Everything else is a
  warning with a stable code + positional context.
- Coverage: per-directory >= 90% (lines/branches/functions/statements), enforced by
  `pnpm test:coverage`.

## Standing disciplines (every change)

Mirrors the three disciplines in the meta-repo's `documentation/conventions.md` — they bind here too:

1. **Documentation follows code** — a change to the public surface/stack/status isn't done until the
   docs are: this repo's docs content (`README.md`, `docs-content/`), the meta-repo
   `documentation/repos/synth.md` (bump its "last verified" date), and the `ecosystem-map.md`
   status table.
2. **Version + changelog** — a Changeset (`patch` on the `0.0.x` ladder) + a `CHANGELOG.md`
   `[Unreleased]` entry per meaningful change. Renaming a stable warning code is a **breaking change**.
3. **Crew + knowledgebase loop** — if this parser's public API or warning codes change, flag/update
   the matching `crew` healthcare skill + the KB product doc.
