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
  (`scripts/smoke.mjs`, `smoke` script) across all eight subpaths, whose subpath set is now derived
  from `package.json` `exports` and which now runs in CI (`smoke.yml`) rather than only in
  `verify.sh`; a proven publish
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
  (per-condition types: `.d.ts` for `import`, `.d.cts` for `require`). The `attw` script is
  **`node scripts/attw.mjs --profile node16`, not the bare CLI** — see the guardrail below; the CLI
  reports a wholly-untyped pack as "does not contain types" and **exits 0**.
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

## Required checks on `main`

One repository ruleset protects `main`: **`required-checks`, id `19913330`**. **Read the live set
back rather than trusting this list** (`gh api "repos/cosyte/synth/rulesets?includes_parents=true"`);
a hardcoded list here goes stale, and it is prose that no test can check. As of 2026-07-29 it
requires five contexts, every one pinned to the GitHub Actions app (`integration_id: 15368`):
`ci / verify (22, ubuntu-latest)`, `ci / verify (24, ubuntu-latest)`, `ci / actionlint`,
`codeql / analyze (javascript-typescript)`, `no-internal-refs`. It also carries `pull_request`,
`required_linear_history`, and the deletion / non-fast-forward bans.

**Extend that one ruleset in place. Do not add a second one for the next gate.** An unpinned required
context can be satisfied by any actor with write access posting a commit status of that name, without
the workflow ever running, and a repo is not pinned because one of its rulesets is.

**Two workflows now emit contexts that are deliberately NOT required yet**: `test-selection`, and
`smoke (22)` / `smoke (24)`. **Requiring a context before its workflow has completed on `main` leaves
every future pull request PENDING and unmergeable, with nothing anywhere saying why.** Let them run
on `main`, read the real names off a live check run
(`gh api repos/cosyte/synth/commits/<sha>/check-runs --jq '.check_runs[].name'`, never off the
workflow's `name:`), and only then extend the ruleset. After that, a job id and its required context
move together or not at all.

Things that silently detach or hollow out a required check:

- **Renaming a job.** The ruleset keeps requiring a context nothing emits, which leaves PRs pending
  rather than red.
- **Splitting a step into its own job.** A required job gates all of its steps, so moving one out
  quietly un-requires it. This is why `build` and `smoke` are steps of one job in `smoke.yml`.
- **Narrowing `include` in `vitest.config.ts`.** `pnpm test` takes no path arguments, so that single
  glob is the sole selector for everything `ci / verify` runs. Coverage does not backstop it:
  coverage is measured over `src/**/*.ts` only, so dropping every `synthetic-safety.property.test.ts`
  costs zero coverage percent and reds nothing. **For a synthetic-data generator that is the whole
  safety story**, since the property layer is the executable proof that nothing emitted can be real
  or plausibly-real PHI.

  **This one is now gated.** `scripts/check-test-selection.ts` (`pnpm check:test-selection`, also
  reached by `pnpm check`) compares the test files that **exist** against the files vitest would
  actually **run**, and reds on any shortfall **in its subject**. Read that scope before trusting it;
  the script header carries the design rules and the limits, and four things about its shape are
  deliberate:
  1. It asks vitest for its **resolved** selection (`vitest list --filesOnly`) rather than reading the
     globs, so an `exclude`, a `projects` split and a `dir` are caught alongside a narrowed
     `include`. **A config body that branches on its own invocation is NOT caught**, and that is
     measured here rather than guessed: a config serving the wide glob under `vitest list` and
     `["test/hl7/**"]` under `vitest run` left the gate green while CI would have run **2 of 39**
     suites.
  2. **The config is not the only selector; the invocation is one too**, and `vitest list` cannot see
     it. That rule **does not parse the script body**: `test` and `test:coverage` must equal one of
     two exact strings. This is the half a refuter broke **three times** in `ncpdp`, each time in the
     remedy for the last, ending with a version that failed closed on arguments but **open on the
     invocation** so `"test": "pnpm run test:unit"` reported as passing. **Analysing a shell string is
     unbounded and each round bought one more spelling.** This repo's two bodies are spelled
     identically to `ncpdp`'s, so the exact-match set is **ported verbatim**. Never replace it with a
     parser.
  3. Its subjects are **derived from files that exist for their own reasons**, never hand-listed.
     `ncpdp`'s fuzz derivation did **not** port: no workflow here contains the string `vitest run`, so
     ported verbatim it refuses outright. The headline subject here is **`package.json` `exports`**.
     Every published subpath resolves to a `dist/` entry emitted from a `src/` entry, so every tracked
     **in-scope** code module naming one of those entry points must be selected, and every entry point
     must have a selected module naming it. It is keyed on a **resolved module path**, so a rename and an
     `_` prefix change nothing, and its scope is a **deny-list of three locations** (`src/`,
     `scripts/`, the repo root), so a move anywhere else changes nothing either. **That scope was an
     allow-list in the first version and a refuter broke it**: scoped to `test/`, relocating all six
     `synthetic-safety.property.test.ts` files into an `internal/` directory took the entire safety
     layer out of CI with `vitest list` selecting zero of them and the gate printing OK exit 0. A
     move into one of the three denied locations still escapes; that is stated in the script header,
     in the failure epilogue and on the OK line, and it is **not** denied anywhere. Two more
     subjects: the fuzz path (two steps, the `Fuzz` workflow runs `pnpm test:fuzz` and that script
     body names the path) and the PHI scanner. **A hand-editable list of what to check is not a
     gate**, which `deid` learned when a refuter dropped an entry from its exclusion set with the run
     still green.
  4. It **re-proves itself on every run**: three self-tests seed the removals it exists to catch, one
     resolving a genuinely narrowed config through real vitest. Both A's drop targets **one at a time**,
     so the colliding direction is exercised; the single difference from `ncpdp`'s is that **this one
     ignores the filename floor and requires a DERIVED rule to name each dropped file**, where
     `ncpdp`'s verdict counts the floor and therefore passed with its derived rules neutered. An
     earlier draft of this line said `ncpdp`'s A "does neither", which a refuter corrected: it does
     drop one at a time. **A is not the backstop for the derived rules** either way, because emptying
     a subject empties A's targets with it. Self-test C is; do not delete it thinking A covers them.

  **Know the denominator, which the gate prints on every run rather than a bare OK.** Of 39 tracked
  in-scope code modules, **38 are watched by a name-independent rule, 1 by the `.test.`/`.spec.`
  filename shape alone (`test/docs-content.test.ts`), and 0 by no rule at all.** Renaming that one out
  of shape stops it running with the gate green; the count moves from `1 name-only` to `1 unwatched`,
  so a reviewer sees it. **These routes are closed; that is not the claim that the selection cannot be
  collapsed**, and writing it up as the latter is the recurring mistake in this ecosystem. What it
  does not reach is in its header: which script the shared pipeline elects to invoke, scripts other
  than those two, anything a workflow runs inline, a config branching on its own invocation, a move
  into `src/` / `scripts/` / the repo root, a module that reaches `src/` without naming it, and
  whether a selected test asserts anything useful. The fuzz subject's empty-set refusal is a tripwire
  on the `Fuzz` job disappearing **only if no other literal path is left behind in a workflow**; a
  quoted `vitest run <path>` in a comment suppresses it, which the header states rather than glosses.

- **Narrowing the published surface.** `exports` feeds two gates. Deleting a subpath shrinks
  `check:test-selection`'s headline subject and that gate stays **green** (measured: dropping
  `"./astm"` moves **2** suites, `test/astm/determinism.property.test.ts` and
  `test/astm/generators.test.ts`, onto the filename floor, denominator 38 to 36; the other three
  `test/astm` suites also name `src/index.ts` and stay). It is not a free escape: it is a breaking
  change to the package, the suites still red if also deselected, and `scripts/smoke.mjs` derives its
  own subpath set from the same map and **refuses** when that set and its probe map disagree. Two
  gates on one map, on purpose.

- **Requiring a workflow with no `pull_request` trigger.** `fuzz`, `scorecard` and `release` are
  schedule, push or dispatch only. Requiring any of them strands every pull request forever.

**RE-MEASURE EVERY PORTED SENTENCE AGAINST THIS REPO.** This is the one failure that repeated. Three
refuter passes on `check-test-selection.ts` all came back red, and **two of the three found a false
number or a false claim of reach rather than a hole in the mechanism**, both times because a sentence
was carried over from `ncpdp` or `deid` and never re-measured here: a figure labelled `MEASURED` that
was not, an example naming the wrong directories, and a "documented as a CI gate" indictment that was
true in `deid` and false here (every surface in this repo said `run by verify.sh`, accurately). The
guard was sound from pass 2 onward; the prose kept failing. So: **where a number is asserted, name what
produced it** (the script header now carries the command for each), and **where reach is asserted, bound
it to a route that was actually seeded**. A borrowed sentence is a claim about this repo, and it needs
the same evidence as a new one.

Finally, the part no test can tell you: **nothing inside this repository can observe its own
ruleset.** Delete it and every test still passes, every gate still prints OK, and this file still says
`main` is protected. A ruleset makes a red check block a merge; it does not make the check correct.

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
- **No diagnostic takes a value parameter.** `SynthError(code)` is the only error `src/` _constructs_,
  and its message is a fixed entry in the frozen `SYNTH_FATAL_MESSAGES` table, so a caller-supplied
  string has no position through which to reach `message`, `stack`, or a field on the thrown object.
  **Adding a fatal means adding a registry entry, never a template string.** If a new refusal seems to
  need the value it rejected, it does not: name the rule on `err.code` and let the caller read the
  value off the arguments it passed.

- **Resolve every caller-supplied selector against its closed set** (`resolveKind` / `resolveMix` in
  `src/select.ts`), at the entry point, before anything is generated. **This is not a style rule.** A
  selector union is erased at run time, and an unresolved one does three things at once: it travels
  into a peer builder that is entitled to quote it back in _its_ `TypeError` (which is how a caller
  string reached an `err.message` and an `err.stack` through this package's own API), it becomes an
  `Artifact.kind` and a `manifest.counts` key, and it falls out of an exhaustive `switch` as
  `undefined` so the corpus is silently mislabeled. All three were live; a refuter found the first two
  after the message fix had been called done.

  **`SynthError` being the only constructor is therefore NOT the whole guarantee, and never claim it
  is.** `src/` can still surface a `TypeError` the runtime raises, or a fatal an optional peer parser
  raises on input this package forwarded. The selector chokepoint is what closes the first; the second
  is out of scope by design and is documented as such rather than papered over. The round-trip
  harnesses keep `String(w.code)` from a sibling's warnings and never the `message` or a snippet.

  `test/phi/diagnostic-surface.test.ts` carries all of it: the per-slot marker sweep via
  `assertNoDiagnosticPhiLeak`, the closed-set assertion over identifiers a real generation derives,
  and a source scan whose title says what a regex can see and its docblock says what it cannot.

  **Read `documentation/repos/phi-audit.md` in the meta-repo before touching this.** The claim that
  warning messages are PHI-free by construction spread across thirteen repos as prose rather than as
  shared code, and this package had inherited the sentence and used it as a reason not to bound
  anything. A new safety sentence here is worth nothing without a slot in that table behind it.

- **▶ `attw` SAYS "does not contain types" AND EXITS 0, SO THE `attw` SCRIPT IS A WRAPPER, NOT THE
  BARE CLI.** `getExitCode.js` in `@arethetypeswrong/cli@0.18.4` opens with
  `if (!analysis.types) return 0` — an untyped package is a legitimate npm package, so "no types at
  all" is a description, not a problem, and the problem list is never consulted. No `--profile`,
  `--ignore-rules` or config setting reaches that early return. For a package that ships types it
  means the declarations were **not in the tarball**, which is a broken publish reported as a pass.
  Measured on this package with its own arguments, on a quiet box with **zero concurrency**: both
  `rm -rf dist && pnpm attw` and `find dist -name '*.d.*ts' -delete && pnpm attw` printed the
  sentence and exited 0 under the old `attw --pack . --profile node16`.
  **The race only supplies the condition.** `tsup` emits JS in one pass and declarations in a later
  one, so every build here has a window where `dist/` holds `.mjs`/`.cjs` and no `.d.ts` — measured
  at **6.4 s, 8.6 s and 7.4 s on three consecutive clean builds**, against a whole build of roughly
  11 s. It is wide because this package emits declarations for eight entry points. A concurrent
  build or `clean` in the same working tree lands `attw` in it. So the answer is **not** a lock, a
  lease or a build queue: the gate must be able to say its own inputs were missing, whatever removed
  them.
  **▶ AND THE FALSE GREEN NEEDS EVERY ENTRY POINT UNTYPED AT ONCE — "attw misses subpaths" IS THE
  PLAUSIBLE, WRONG STORY, AND IT WAS ASSERTED AND REFUTED INSIDE THIS SLICE.** With the root entry
  intact and one subpath's declarations missing, bare `attw` reports `UntypedResolution` and
  **exits 1**, because `analysis.types` is truthy and `getExitCode()` runs past the early return. A
  **partial** loss is attw's own catch. Do not restore the wider claim — **and note that the first
  version of this slice forbade it in this paragraph while restoring it IN CODE twenty lines away.**
  The preflight's counterfactual was keyed on `broken.some(isDeclaration)`, i.e. ANY missing
  declaration, so a partial loss red-flagged correctly and then printed "attw would have … EXITED 0",
  which is false — and false inside the very build window this gate exists for, because `tsup` writes
  eight entry points' declarations in sequence. A refuter measured it.
  **THE FIRST CORRECTION WAS ALSO WRONG, IN THE SAME DIRECTION, AND THE SECOND REFUTER PASS CAUGHT
  IT. DO NOT RE-DERIVE THIS CONDITION FROM THE SHAPE OF THE CODE.** It was re-keyed on "every declared
  declaration is in `broken`" — still false, because the preflight counts **empty** as broken and **a
  zero-byte `.d.ts` STILL RESOLVES**. It types the package while declaring nothing, so
  `analysis.types` is truthy and the early return is not taken. Measured: root declarations zero-byte
  plus a subpath's missing → attw exit **1** with `UntypedResolution`; **all** declarations zero-byte
  → **"No problems found"** and exit 0. Neither is the untyped sentence. So an **empty** declaration
  casualty now makes **no exit-code claim at all**, and the exit-0 arm is reached only when every
  declared declaration is **missing** — the one state `getExitCode()`'s early return keys on. A gate
  that reds correctly and then explains itself with a falsehood teaches the next reader the wrong
  story, and this script gets copied to sixteen more manifests.
  `scripts/attw.mjs` carries **two nets, and they catch different things** — a preflight that every
  relative path `package.json` promises (`main`, `module`, `types`, `typings`, every string leaf of
  `exports`, across all eight subpaths) exists and is non-empty, which catches the window and _names
  the missing file_ where attw's message names none; and a post-check on attw's untyped sentence,
  which catches what the preflight structurally cannot — declarations present on disk but excluded
  from the tarball by `files`/`.npmignore`. **No instance of that second case is on record here.**
  `test/scripts/attw-gate.test.ts` pins both nets against the real binary, including the upstream
  exit-0 itself, so an `attw` upgrade that reworks the wording or fixes the exit code reds the suite
  instead of letting the net go quietly slack. It also pins a **negative control** on a well-formed
  package, that a real `attw` failure still fails, and that `--profile node16` is still forwarded
  rather than swallowed.
  **The post-check reads a string, so the argument guard is an ALLOW-LIST, NOT A DENY-LIST, AND THE
  DENY-LIST IS THE SECOND THING A REFUTER BROKE IN THIS SLICE.** Six routes were measured here
  against the pinned binary **with `--profile node16` present**, each making the sentence unreadable
  while attw still exited 0: `--quiet`, `-q`, `--format json`, `-f json`, `--format=json`, and a
  `.attw.json` setting `quiet` or `format` (`readConfig()` applies it after argv). The ported
  deny-list refused a set of spellings via `arg.split("=")[0]` — **token equality, not option-name
  matching** — and commander accepts a value fused to a short flag, so **`-fjson` is neither `-f` nor
  `--format`**, walked through, and handed back exit 0 with the sentence gone. The empty-transcript
  net backstops a `-q` cluster and **structurally cannot backstop `-f`**, because JSON output is not
  empty. **Do not answer this with a seventh spelling** — that is the failure mode
  `scripts/check-test-selection.ts` documents at length for a different guard here. The guard is
  total instead: `--profile` and `--no-definitely-typed` are forwarded and everything else is
  refused, including options that would blind nothing, since "harmless" is not a judgement this
  script can make from an option name. `--config-path` falls out for free. Widening the set is a
  deliberate one-line edit. **The `.attw.json` refusal stays separate** — it is not an argument, and
  no argument guard of any shape can reach a config applied after argv.
  **The seven `file:vendor/*.tgz` devDeps are NOT part of this.** `files` is `dist` plus three doc
  files, so `npm pack` emits no `vendor/` and no `node_modules/`, and attw does not resolve bare
  external specifiers at all — measured on a fixture whose only declaration imports a package that
  exists nowhere, which attw calls "No problems found". A **stale** vendored tarball can make this
  gate neither red nor green. A **missing** one is a different thing and this sentence does not cover
  it: `pnpm install`/`build` fail first, and the gate then reds at the preflight or at `could not run`.
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
4. **No internal project bookkeeping on a public surface** (founder directive, 2026-07-27). What a
   consumer reads (`README.md`, `docs-content/`, the npm `description`, a release body) says what the
   software does and what changed. Item identifiers (`SYNTH-4`), phase and wave language, ADR numbers,
   meta-repo paths and `roadmap §N` citations belong in the changeset, `CHANGELOG.md`, the commit, the
   PR and the roadmap. It is a **translation** at the boundary, not a deletion, and when you strip an
   identifier off the front of a line, repair the head: a fragment reads worse than the text it
   replaced. Gated by `pnpm check:no-internal-refs`. The gate keys on known project prefixes, so **a
   new programme prefix has to be added to it by hand**; and it catches identifiers and citations, not
   English sentences about our process, so the reviewer still owns half the rule.

   **`SYNTH` is BOTH our item prefix AND the marker this package writes into what it generates.**
   `SYNTH-4` is one of our units of work; `SYNTH-FAC` (the `MSH-4` sending facility), `SYNTH-LIS` and
   `SYNTH-ANALYZER` (the ASTM `H` header) are the PHI discipline made visible in the output, and the
   generated NCPDP message id is `SYNTH-` plus ten random digits. The separation is the explicit
   `SYNTHETIC_FIXTURE_TOKEN` list in the gate, never a shape rule. **Never re-key the identifier rule
   on the `WORD-N` shape**, and never "resync" the prefix list with a sibling repo's copy without
   re-reading why `SYNTH` is PRESENT in this one and ABSENT from `ncpdp`'s.

   **Four surfaces, three different answers.** Markdown a reader browses and the npm metadata are
   **gated**. `/** */` doc comments compile into `dist/*.d.ts` and render in a consumer's editor, so
   they are **gated**. String literals are **gated too**, and in a generator that pass matters more
   than anywhere else: these literals are not commentary about the software, they are **the bytes it
   emits**. `//` and plain `/* */` comments are **not gated** and identifiers are **welcome** in them,
   because **the convention says source comments are a place identifiers belong**. That is the whole
   reason. **Do not justify this boundary from what reaches `dist/`** — two attempts to, in a sibling
   repo, were both false and both caught by a refuter. Measured here: `dist` is `files[0]`, there is no
   `.npmignore`, the emitted bundles carry `//` comments verbatim (17 lines each in
   `dist/index.mjs` and `dist/index.cjs`), and the sixteen `dist/**/*.map` carry the full text of 66 of
   the 67 tracked `src/**/*.ts` in `sourcesContent`, so **effectively everything in `src/` is in the
   tarball** and the bundle leg carries the argument on its own. The line is not what reaches a
   consumer's disk (all of it does) but what a consumer is **shown**.

   Two consequences: **removing a doc comment to satisfy the gate is a regression**, not a fix (JSDoc
   with `@example` on every public export is a hard guardrail above, and neither lint nor coverage will
   catch its loss); and **when a stale claim is what carries the phase number, cut the sentence rather
   than reword it**. Three subpath headers here documented quirk generation as still to come, three
   lines above the export that ships it; rewording would have left a falsehood standing in cleaner
   clothes. What the gate cannot do is read `dist/` itself: `dist/` is untracked build output, so this
   is a gate on the source of the published text, not on the published text.
