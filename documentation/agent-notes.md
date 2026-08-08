# Agent notes: @cosyte/synth

The long-form record behind `CLAUDE.md`: the shipped-phase history, the per-incident narratives,
and the full rationale behind every trap that `CLAUDE.md` states in one line. Each compressed rule
up there names the section down here that carries its evidence.

**This file exists because `CLAUDE.md` is always-read and this is not** (meta-repo ADR 0023,
amendment 2026-08-04). Everything below was **relocated verbatim**, not rewritten or summarised. If
you refute something here, correct it *here* and keep the one-line rule in `CLAUDE.md` pointing at
it. The standing rule is **relocate, never delete**: every paragraph below cost a defect to learn.

## Status: the shipped roadmap, in full

### Shipped phases, release hardening, and the generator core

- **Phases 1–9 shipped (SYNTH-1 … SYNTH-11): the roadmap is complete.** Pre-alpha `0.0.x`, and
  **published to npm** (verify with `npm view @cosyte/synth version`; this line deliberately does not
  name the number, which is stale by construction on the next release). The repo is **already public**
  (`gh repo view cosyte/synth --json visibility`), so neither founder gate is still pending: flipping a
  repo public remains a non-waived act as **policy**, but it is not an outstanding item of **state**
  here, and `npm publish` is covered by the standing waiver. **Publish state and visibility are
  independent, so never infer one from the other, in either direction.** **SYNTH-11 (Phase 9, release hardening)** added no runtime API: it is the
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
  (`src/safe/`, incl. `safe.npi`, a deliberately-invalid-Luhn NPI + `isSyntheticNpi`, and `safe.dea`, a
  deliberately-invalid-checksum DEA + `isSyntheticDea`/`deaCheckDigit`), the `Corpus` abstraction,
  `defineSynthProfile`, the `SYNTH_FATAL_CODES`/`SynthError`. All six formats are wired:

### HL7 v2

  - **HL7 v2** at the `@cosyte/synth/hl7` subpath (`generateAdt`/`generateOru`/`generateOrm`/
    `generateSiu`/`generateVxu`/`generateHl7`/`hl7Corpus`/`roundTrip`), built through `@cosyte/hl7`'s
    `buildMessage`, round-tripping with zero warnings.

### FHIR R4 / US Core (SYNTH-3 + SYNTH-4)

  - **FHIR R4 / US Core (SYNTH-3 + SYNTH-4)** at the `@cosyte/synth/fhir` subpath: the full US Core
    clinical set: `generatePatient` (base + `profile:"us-core"`), `generateCondition`,
    `generateObservationLab`, `generateVitalSign`, `generateMedicationRequest`, `generateEncounter`,
    `generateDiagnosticReport`, `generateImmunization`, `generateAllergyIntolerance`,
    `generateProcedure`, `generateBundle` (collection + transaction + `document`), `buildComposition`,
    `fhirCorpus`, and the FHIR `roundTrip` harness. Built through `@cosyte/fhir`'s model constructors +
    serializer (spec-clean by construction); US Core conformance is validated firsthand against the
    **real US Core 6.1.0 profiles** committed under `test/us-core-profiles/` (BYO, no IG bundled).

### C-CDA R2.1 (SYNTH-5)

  - **C-CDA R2.1 (SYNTH-5)** at the `@cosyte/synth/ccda` subpath: `generateCcd` (Continuity of Care
    Document), `generateReferralNote`, the generic `generateCcda({ documentType })`, `ccdaCorpus`,
    `ccdaPatientIdentity`, and the C-CDA `roundTrip` harness. Built through `@cosyte/ccda`'s `buildCcda`
    (spec-clean by construction), so each document round-trips through `parseCcda` with zero warnings.
    Populates the CCD SHALL sections (Problems/Allergies/Medications/Results/Vital Signs) plus
    Immunizations, Procedures, and Social History, reusing the FHIR generators' license-clean
    example-code pools (adapted to `@cosyte/ccda`'s OID-coded `BuildCode`). `buildCcda`'s default
    `effectiveTime: new Date()` is **always overridden** with a synthetic date, so the reproducibility
    contract holds.

### X12 005010 (SYNTH-6)

  - **X12 005010 (SYNTH-6)** at the `@cosyte/synth/x12` subpath: `generate837P`/`generate837I`/
    `generate837D` (claims), `generate835` (remittance, balance-checked by construction), `generate271`
    (eligibility), the shared `generate837(variant, …)`, `x12Corpus`, the `x12*` identity minters, the
    `dec`/`money` helpers, and the X12 `roundTrip` harness. Built through `@cosyte/x12`'s domain builders
    (`build837P/I/D`, `build835`, `build271`), so the ISA/GS/ST…SE/GE/IEA envelope + HL spine are the
    builder's own and each transaction round-trips through `@cosyte/x12` with zero warnings. The
    identity-dense synthetic-safety invariant: NPIs carry a **deliberately-invalid Luhn** check digit
    (never a real NPI), provider tax ids are 900-range SSNs at `REF*SY`, member ids are synthetic-AA
    scoped. The `phi-scan` gains X12-aware structured detection (NM1/PER/REF loci; a Luhn-valid NPI is a
    hard hit). **Deferred: the 270 request (`@cosyte/x12` ships no `build270`).** Quirk mode is Phase 7.

### NCPDP (SYNTH-7)

  - **NCPDP (SYNTH-7)** at the `@cosyte/synth/ncpdp` subpath: **SCRIPT** ePrescribing (`generateNewRx`
    via the validated `buildNewRx`; `generateRxRenewalRequest`/`generateRxChangeRequest` via
    `@cosyte/ncpdp`'s public typed `ScriptMessage` model + `serializeScript`: the X12 typed-model→
    serializer pattern, never hand-written bytes) and **Telecom** vD.0 claims (`generateB1`/`generateB2`/
    `generateB3` via `buildTelecomRequest` + `serializeTelecom`), plus `generateTelecom`, `ncpdpCorpus`,
    the `scriptRoundTrip`/`telecomRoundTrip` harnesses, the `ncpdp*` identity minters, and a
    license-clean `EXAMPLE_DRUGS` pool (invented `00000`-labeler NDCs, no NCPDP prose bundled). Each
    message round-trips through `@cosyte/ncpdp` with zero warnings, byte-stable. The identity invariant
    adds the **prescriber DEA** (invalid checksum, `safe.dea`) alongside the NPI (invalid Luhn);
    patient/cardholder ids are synthetic-AA scoped (`MBR`-prefixed). The `phi-scan` gains an NCPDP arm
    (SCRIPT `<NPI>`/`<DEANumber>`/name tags; Telecom field-id-keyed CA/CB/CC/CD/CQ/CY/C2/DB: a
    Luhn-valid NPI or checksum-valid DEA is a hard hit). **Deferred: SCRIPT lifecycle _responses_
    (track the parser's builder surface).** Quirk mode is Phase 7.

### ASTM (SYNTH-8)

  - **ASTM (SYNTH-8)** at the `@cosyte/synth/astm` subpath: E1394 record reports (`generateAstmResult`
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

### Vendor-quirk mode (SYNTH-9, Phase 7)

  - **Vendor-quirk mode (SYNTH-9, Phase 7)**: the differentiator. Profile-driven off-spec fixtures for the
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
    `SYNTH_UNSUPPORTED_QUIRK`; synthetic-safety still holds (a quirk deviates structure, never provenance:
    the `phi-scan` gate stays zero over quirk output). All quirks are **publicly grounded** (ADR 0018);
    quirk recipes for **FHIR/X12/NCPDP are deferred**, as is any quirk needing a private vendor corpus.

### The `@cosyte/deid` pairing loop (SYNTH-10, Phase 8)

  - **The `@cosyte/deid` pairing loop (SYNTH-10, Phase 8)**: a deterministic, seeded **closed-loop
    co-validation harness** at the `@cosyte/synth/deid` subpath: **generate → plant tagged synthetic PHI
    sentinels at the patient loci → de-identify via `@cosyte/deid` → verify every sentinel is gone**
    (a surviving sentinel is a hard failure) **and** the clinical payload survives (the over-scrub guard).
    Per-format loops `{hl7,fhir,x12,ncpdpTelecom,ccda}DeidLoop` returning an immutable `DeidLoopResult`,
    plus `summarizeDeidCoverage`, `deidLoopPolicy` (Safe Harbor with MRN/beneficiary/account → `redact`,
    so **no key context** is needed and the loop is a pure function of the seed), and the testable
    primitives `identifierSentinels`/`recordTargetSentinels`/`sweepSurvivors`/`clinicalRetention`. The
    removal check is **locus-scoped and collision-proof**: sentinels come from the patient PHI loci
    (deid's own extractors for HL7/FHIR/X12/NCPDP; a `<recordTarget>` scan for C-CDA, deid's C-CDA
    extractor needs a DOM), decomposed to literal distinctive synthetic tokens, and the sweep reads only
    the de-identified values remaining **at those former PHI loci**, so provider/organization identity a
    de-identifier legitimately retains (drawn from the same synthetic pools) never reads as a false
    survivor. It is a **co-validation harness, not an independent audit** of deid; `blocked` counts as
    removed; it **consumes the shipped generators unchanged**. **Deferred:** NCPDP **SCRIPT** / **ASTM** /
    **DICOM** pairing (no `@cosyte/deid` adapter, or not generated, `DEID_LOOP_SKIPPED` names each), and
    optional **Synthea** clinical-content ingestion (roadmap §Phase 8, a documented future concern).

### Optional peer deps and how to refresh a vendored tarball

- The six parsers **and `@cosyte/deid`** are **optional peer deps**, vendored for dev/test via the
  `mllp` pattern (`vendor/cosyte-hl7-0.0.0.tgz`, `vendor/cosyte-fhir-0.0.0.tgz`,
  `vendor/cosyte-ccda-0.0.1.tgz`, `vendor/cosyte-x12-0.0.1.tgz`, `vendor/cosyte-ncpdp-0.0.1.tgz`,
  `vendor/cosyte-astm-0.0.0.tgz`, `vendor/cosyte-deid-0.0.0.tgz`). Refresh one by re-running, e.g.,
  `pnpm -C ../deid build && pnpm -C ../deid pack --pack-destination ../synth/vendor` then
  `pnpm add -D @cosyte/deid@file:vendor/cosyte-deid-0.0.0.tgz` (restore the `peerDependencies` entry
  after if `pnpm remove` stripped it). **Third-party runtime deps stay at 0.** Quirk generation (Phase 7)
  ships for HL7 v2/C-CDA/ASTM; FHIR/X12/NCPDP quirks are deferred, and the `deid` pairing loop (Phase 8)
  ships for HL7/FHIR/C-CDA/X12/NCPDP Telecom.

- **REFRESHING ONE NOW MEANS EDITING `BINARY_EXEMPT_PATHS` IN `scripts/phi-scan.ts` TOO**, because the
  version is in the filename and that list is seven literal paths. Both directions of drift are loud
  and neither is silent: the new filename, unlisted, is scanned and reds on nonsense hits (a gzip
  stream read as UTF-8 produces name-shaped and email-shaped garbage, measured: 4 hits across 3 of the
  7 archives); the old filename, stale, reds the reconciliation test in `test/scripts/phi-scan.test.ts`
  that compares the list against what `.gitattributes` declares `binary`.

## The PHI scan reads more than its three roots

- **THE DEFECT, MEASURED ON `4c9900f`: 225 tracked files, 176 read, 49 read by NEITHER route.** All-mode
  walked `src/`, `test/` and `scripts/`; `--staged` filtered the index by the same three prefixes. So
  every workflow, `package.json`, `pnpm-lock.yaml`, `eslint.config.js`, `tsup.config.ts`,
  `vitest.config.ts`, `tsconfig.json`, `.npmrc`, `.gitignore`, `.gitattributes`, `LICENSE`,
  `docs-content/sidebars.json` and `.changeset/config.json` were opened by nothing. A repo-root file
  carrying a name, an SSN and an email exited **0** on BOTH routes.
- **THE HALF THAT WAS ALREADY CLOSED HERE, AND IT IS WHY THE FIGURES DIFFER FROM A SIBLING'S.** The
  class defect is usually "walk roots stop at `test/fixtures/`, so tracked files under `test/` are read
  by neither route". `test` has been a whole root in this package since the roots were widened, so that
  count is **0** here. Re-derive per repo; do not port a residual.
- **THE REMEDY IS A UNION, NEVER A REPLACEMENT.** All-mode now reconciles what it walked against
  `git ls-files -s` and reads every tracked file the walk did not reach. The walk's own scope is
  untouched, no detector was taught to skip anything, and the head-side scanned set is a strict
  superset of the base's. **Over the same 225 files the base measured: 198 read, 27 in neither** (20
  markdown, 7 vendored archives), and **0** under `test/`. **In the shipped tree it is 226 / 198 / 28**,
  because the change adds a changeset markdown file, which is the whole reason to derive the markdown
  count rather than read it. The grid was proved cell by cell: every base `1` is still `1`, five cells
  go `0 -> 1`, and **nothing goes `1 -> 0`** on either enumeration.
- **THE EXEMPTION IS A LITERAL PATH LIST AND IT REACHES `all` MODE ONLY.** `--staged` enumerates
  exactly what it always did. That is the rule this class paid an `INTRODUCED` major for in a sibling:
  a corpus exemption written as a PREDICATE and applied to `--staged` subtracted a detection the base
  had. The cost is stated rather than hidden: a repo-root file with PHI is caught by CI on the pull
  request and not by the pre-commit hook.
- **AND THE CLAIM THAT COST THIS SLICE ITS OWN REFUTATION, KEPT HERE SO THE DISTINCTION IS NOT
  RE-LEARNED: "`--staged` IS BYTE-IDENTICAL" WAS FALSE, AND ONLY "THE ENUMERATION IS UNCHANGED" IS
  TRUE.** The allow-list is read once and consumed inside `scanTarget`, which every mode shares, so
  the `EMAIL hello@cosyte.com` entry this slice added clears that literal on EVERY route including the
  pre-commit one: a file under `src/` carrying it red on `4c9900f` and does not now. One literal
  organizational address, accepted rather than overlooked, because there is no path-scoped value
  declaration in this scanner and `--allow-fixture` is unreachable from the two invocations that
  matter (CI runs a bare `pnpm phi-scan`, the hook runs `pnpm phi-scan --staged`, neither passes the
  flag). **The scope test could not see it, and neither could the measurement grid**, whose payload
  never contained the cleared literal: appending `EMAILDOMAIN cosyte.com`, a far broader clearance,
  passed the whole suite. Both directions are pinned now, the address cleared and any other address at
  that domain still red, which is what reds that mutation.
- **WHY THE INERT-EXEMPTION CHECK IS A TEST AND NOT A REFUSAL IN THE SCANNER.** Refusing on an exempt
  path git does not track would couple the scanner to seven archives existing, and it refused every
  throwaway root in the suite the first time it was written that way. The drift tripwire belongs where
  repo-specific facts belong: a test that reconciles the literal list against `git check-attr binary`.
- **TWO WALK-ROOT DEFECTS CLOSED WITH IT, BOTH MEASURED ON THE BASE, AND THE EXIT CODE IS THIS REPO'S
  OWN.** A root that is a REGULAR FILE threw `ENOTDIR` out of `walk()` past the `InvocationError`-only
  catch and node exited **1**, the code this contract reserves for "hits found". A root that was a
  SYMLINK TO ANOTHER ROOT returned `OK, no hits (145 file(s) scanned)` and exit **0** with the 99-file
  test corpus not on disk: `normalizePath` is lexical, so `src/` was read twice and attributed once to
  each prefix, and the per-root rule was satisfied by the other root's bytes. A false green. Both now
  refuse with **2**, via an `lstat` on each root before the walk. **Do not port that 2 from here or
  from a sibling: it was 1 in THIS repo, is 2 in some, and is deliberately 1 in another.**
- **`existsSync` IS THE TRAP UNDERNEATH BOTH.** It FOLLOWS a link, so a dangling root answered false
  and read as merely absent, and a root linked at another root answered true and was walked.
- **A THIRD LIMIT CLOSED AS A SIDE EFFECT, AND IT IS NOT THE PER-ROOT RULE THAT CLOSED IT.** An absent
  directory INSIDE a root, and a root emptied down to one file, both used to exit 0 under a plausible
  denominator (`OK, no hits (78 file(s) scanned)` with 98 tracked files unread). The reconciliation
  refuses, because git still carries what nothing read. **Stage the deletions and it is green again at
  a smaller denominator**: the per-root rule is still a floor of one, and the two rules see different
  states. Do not delete either thinking the other covers it.
- **WHAT THE 22 NEWLY-OPENED FILES ACTUALLY CONTAINED, hand-read one by one on 2026-08-08:** no SSN
  shape anywhere, and exactly ONE email, `hello@cosyte.com`, the publisher contact in `package.json`'s
  `author` field. It is **named here and declared in the allow-list rather than scrubbed**: it is this
  company's own published contact, already on the npm registry page, it denotes an organization and not
  a person receiving care, and removing it would delete the evidence that the sweep happened. Declared
  as an exact `EMAIL`, not an `EMAILDOMAIN`, so it clears one address and not a live domain. **What
  that declaration costs on the commit-blocking route is the bullet above; it is not free.**
- **WHAT IS STILL OPEN, DISCLOSED.** The reconciliation compares path SETS, not the bytes git carries at
  those paths, so a root swapped for a directory mirroring the tracked names still exits 0 over decoy
  contents. **No repo in this ecosystem has closed that**, and the widening makes it narrower rather
  than worse: a decoy must now mirror 198 names instead of 176. Markdown stays out of scope on both
  arms; at `4c9900f` all 20 tracked markdown files were read by hand the same day and carry no SSN
  shape and no email at all, and the reason it stays out is a real circularity, `phi-scan-overrides.md`
  exists to record why a value was tolerated. **DERIVE THAT 20, DO NOT TRUST IT**: every changeset adds
  a markdown file, and this very change wrote the cleared address into THIS file, which the hand-read
  predates. Also disclosed: `git ls-files` lists a `skip-worktree` or sparse-checkout entry like any
  other, so all-mode cannot run in a cone-mode checkout at all. Fail-closed, and "stage the deletion"
  is not an available remedy there.

## Required checks on `main`

### The one ruleset that protects `main`

One repository ruleset protects `main`: **`required-checks`, id `19913330`**. **Read the live set
back rather than trusting this list** (`gh api "repos/cosyte/synth/rulesets?includes_parents=true"`);
a hardcoded list here goes stale, and it is prose that no test can check. As of 2026-07-29 it
requires five contexts, every one pinned to the GitHub Actions app (`integration_id: 15368`):
`ci / verify (22, ubuntu-latest)`, `ci / verify (24, ubuntu-latest)`, `ci / actionlint`,
`codeql / analyze (javascript-typescript)`, `no-internal-refs`. It also carries `pull_request`,
`required_linear_history`, and the deletion / non-fast-forward bans.

### Extend that one ruleset in place

**Extend that one ruleset in place. Do not add a second one for the next gate.** An unpinned required
context can be satisfied by any actor with write access posting a commit status of that name, without
the workflow ever running, and a repo is not pinned because one of its rulesets is.

### Contexts deliberately NOT required yet

**Two workflows now emit contexts that are deliberately NOT required yet**: `test-selection`, and
`smoke (22)` / `smoke (24)`. **Requiring a context before its workflow has completed on `main` leaves
every future pull request PENDING and unmergeable, with nothing anywhere saying why.** Let them run
on `main`, read the real names off a live check run
(`gh api repos/cosyte/synth/commits/<sha>/check-runs --jq '.check_runs[].name'`, never off the
workflow's `name:`), and only then extend the ruleset. After that, a job id and its required context
move together or not at all.

### Things that silently detach or hollow out a required check

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

### The test-selection gate and its four deliberate shapes

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

### Know the denominator, and what the gate does not reach

  **Know the denominator, which the gate prints on every run rather than a bare OK.** Of 43 tracked
  in-scope code modules, **40 are watched by a name-independent rule, 3 by the `.test.`/`.spec.`
  filename shape alone (`test/docs-content.test.ts`, `test/scripts/attw-gate.test.ts`,
  `test/scripts/sync-version.test.ts`), and 0 by no rule at all.** Renaming one of those three out
  of shape stops it running with the gate green; the count moves from `3 name-only` to `1 unwatched`
  alongside `2 name-only`, so a reviewer sees it. **READ THE NUMBERS OFF THE GATE, NOT OFF THIS
  PARAGRAPH, AND MOVE THEM WHEN YOU ADD A TEST FILE.** They have gone stale twice now without anyone
  noticing, in the repo whose own guidance says at length that a carried-over number is the recurring
  failure here: `test/scripts/attw-gate.test.ts` landed without moving them, and
  `test/scripts/sync-version.test.ts` was caught only by a refuter re-running the gate. **The gate
  reads TRACKED files, so a brand-new test file moves nothing until it is `git add`ed**: run the
  gate after staging, not before. The command is `pnpm check:test-selection`, and it prints all
  three counts on every run. **These routes are closed; that is not the claim that the selection cannot be
  collapsed**, and writing it up as the latter is the recurring mistake in this ecosystem. What it
  does not reach is in its header: which script the shared pipeline elects to invoke, scripts other
  than those two, anything a workflow runs inline, a config branching on its own invocation, a move
  into `src/` / `scripts/` / the repo root, a module that reaches `src/` without naming it, and
  whether a selected test asserts anything useful. The fuzz subject's empty-set refusal is a tripwire
  on the `Fuzz` job disappearing **only if no other literal path is left behind in a workflow**; a
  quoted `vitest run <path>` in a comment suppresses it, which the header states rather than glosses.

### Narrowing the published surface

- **Narrowing the published surface.** `exports` feeds two gates. Deleting a subpath shrinks
  `check:test-selection`'s headline subject and that gate stays **green** (measured: dropping
  `"./astm"` moves **2** suites, `test/astm/determinism.property.test.ts` and
  `test/astm/generators.test.ts`, onto the filename floor, denominator 38 to 36; the other three
  `test/astm` suites also name `src/index.ts` and stay). It is not a free escape: it is a breaking
  change to the package, the suites still red if also deselected, and `scripts/smoke.mjs` derives its
  own subpath set from the same map and **refuses** when that set and its probe map disagree. Two
  gates on one map, on purpose.

### Requiring a workflow with no `pull_request` trigger

- **Requiring a workflow with no `pull_request` trigger.** `fuzz`, `scorecard` and `release` are
  schedule, push or dispatch only. Requiring any of them strands every pull request forever.

### RE-MEASURE EVERY PORTED SENTENCE AGAINST THIS REPO

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

### Nothing inside this repository can observe its own ruleset

Finally, the part no test can tell you: **nothing inside this repository can observe its own
ruleset.** Delete it and every test still passes, every gate still prints OK, and this file still says
`main` is protected. A ruleset makes a red check block a merge; it does not make the check correct.

## Engineering Guardrails: the rationales

### No diagnostic takes a value parameter

- **No diagnostic takes a value parameter.** `SynthError(code)` is the only error `src/` _constructs_,
  and its message is a fixed entry in the frozen `SYNTH_FATAL_MESSAGES` table, so a caller-supplied
  string has no position through which to reach `message`, `stack`, or a field on the thrown object.
  **Adding a fatal means adding a registry entry, never a template string.** If a new refusal seems to
  need the value it rejected, it does not: name the rule on `err.code` and let the caller read the
  value off the arguments it passed.

### Resolve every caller-supplied selector against its closed set

- **Resolve every caller-supplied selector against its closed set** (`resolveKind` / `resolveMix` in
  `src/select.ts`), at the entry point, before anything is generated. **This is not a style rule.** A
  selector union is erased at run time, and an unresolved one does three things at once: it travels
  into a peer builder that is entitled to quote it back in _its_ `TypeError` (which is how a caller
  string reached an `err.message` and an `err.stack` through this package's own API), it becomes an
  `Artifact.kind` and a `manifest.counts` key, and it falls out of an exhaustive `switch` as
  `undefined` so the corpus is silently mislabeled. All three were live; a refuter found the first two
  after the message fix had been called done.

### `SynthError` being the only constructor is NOT the whole guarantee

  **`SynthError` being the only constructor is therefore NOT the whole guarantee, and never claim it
  is.** `src/` can still surface a `TypeError` the runtime raises, or a fatal an optional peer parser
  raises on input this package forwarded. The selector chokepoint is what closes the first; the second
  is out of scope by design and is documented as such rather than papered over. The round-trip
  harnesses keep `String(w.code)` from a sibling's warnings and never the `message` or a snippet.

  `test/phi/diagnostic-surface.test.ts` carries all of it: the per-slot marker sweep via
  `assertNoDiagnosticPhiLeak`, the closed-set assertion over identifiers a real generation derives,
  and a source scan whose title says what a regex can see and its docblock says what it cannot.


### The PHI-free-diagnostics claim

  **Read `documentation/repos/phi-audit.md` in the meta-repo before touching this.** The claim that
  warning messages are PHI-free by construction spread across thirteen repos as prose rather than as
  shared code, and this package had inherited the sentence and used it as a reason not to bound
  anything. A new safety sentence here is worth nothing without a slot in that table behind it.

### The `attw` false green, and why the script is a wrapper

- **▶ `attw` SAYS "does not contain types" AND EXITS 0, SO THE `attw` SCRIPT IS A WRAPPER, NOT THE
  BARE CLI.** `getExitCode.js` in `@arethetypeswrong/cli@0.18.4` opens with
  `if (!analysis.types) return 0`: an untyped package is a legitimate npm package, so "no types at
  all" is a description, not a problem, and the problem list is never consulted. No `--profile`,
  `--ignore-rules` or config setting reaches that early return. For a package that ships types it
  means the declarations were **not in the tarball**, which is a broken publish reported as a pass.
  Measured on this package with its own arguments, on a quiet box with **zero concurrency**: both
  `rm -rf dist && pnpm attw` and `find dist -name '*.d.*ts' -delete && pnpm attw` printed the
  sentence and exited 0 under the old `attw --pack . --profile node16`.
  **The race only supplies the condition.** `tsup` emits JS in one pass and declarations in a later
  one, so every build here has a window where `dist/` holds `.mjs`/`.cjs` and no `.d.ts`, measured
  at **6.4 s, 8.6 s and 7.4 s on three consecutive clean builds**, against a whole build of roughly
  11 s. It is wide because this package emits declarations for eight entry points. A concurrent
  build or `clean` in the same working tree lands `attw` in it. So the answer is **not** a lock, a
  lease or a build queue: the gate must be able to say its own inputs were missing, whatever removed
  them.

### The false green needs EVERY entry point untyped at once

  **▶ AND THE FALSE GREEN NEEDS EVERY ENTRY POINT UNTYPED AT ONCE: "attw misses subpaths" IS THE
  PLAUSIBLE, WRONG STORY, AND IT WAS ASSERTED AND REFUTED INSIDE THIS SLICE.** With the root entry
  intact and one subpath's declarations missing, bare `attw` reports `UntypedResolution` and
  **exits 1**, because `analysis.types` is truthy and `getExitCode()` runs past the early return. A
  **partial** loss is attw's own catch. Do not restore the wider claim, **and note that the first
  version of this slice forbade it in this paragraph while restoring it IN CODE twenty lines away.**
  The preflight's counterfactual was keyed on `broken.some(isDeclaration)`, i.e. ANY missing
  declaration, so a partial loss red-flagged correctly and then printed "attw would have … EXITED 0",
  which is false, and false inside the very build window this gate exists for, because `tsup` writes
  eight entry points' declarations in sequence. A refuter measured it.

### The first correction was also wrong, in the same direction

  **THE FIRST CORRECTION WAS ALSO WRONG, IN THE SAME DIRECTION, AND THE SECOND REFUTER PASS CAUGHT
  IT. DO NOT RE-DERIVE THIS CONDITION FROM THE SHAPE OF THE CODE.** It was re-keyed on "every declared
  declaration is in `broken`", still false, because the preflight counts **empty** as broken and **a
  zero-byte `.d.ts` STILL RESOLVES**. It types the package while declaring nothing, so
  `analysis.types` is truthy and the early return is not taken. Measured: root declarations zero-byte
  plus a subpath's missing → attw exit **1** with `UntypedResolution`; **all** declarations zero-byte
  → **"No problems found"** and exit 0. Neither is the untyped sentence. So an **empty** declaration
  casualty now makes **no exit-code claim at all**, and the exit-0 arm is reached only when every
  declared declaration is **missing**.

### "Missing" is a proxy, not the key (a known limit)

  **▶ AND "MISSING" IS A PROXY, NOT THE KEY: A THIRD REFUTER PASS CAUGHT THAT SENTENCE TOO. THIS IS
  A KNOWN LIMIT, FILED RATHER THAN FIXED.** `analysis.types` comes from `containsTypes()` in
  `@arethetypeswrong/core`'s `createPackage.js`: `listFiles(directory).some(ts.hasTSFileExtension)`,
  **any** declaration file in the **packed tarball**, not the set `exports` declares. This package's
  `dist/` carries undeclared chunk declarations (`example-codes-*.d.ts`, `providers-*.d.ts`,
  `quirk-*.d.cts`) and `files` packs all of `dist`, so with every **declared** declaration missing and
  one chunk still packed, attw finds types and exits 1 while the exit-0 arm claims otherwise. Measured;
  it **predates this guard and is unchanged by it** (byte-identical output three commits back), which
  is why it was not taken inside the slice. Closing it means the preflight reading the tarball: a
  second moving part, for a wrong _explanation_ of a correct red. **If you take it up, weaken the
  sentence; do not add a fifth arm.**
  A gate that reds correctly and then explains itself with a falsehood teaches the next reader the
  wrong story, and this script gets copied to sixteen more manifests.

### The two nets in `scripts/attw.mjs`

  `scripts/attw.mjs` carries **two nets, and they catch different things**: a preflight that every
  relative path `package.json` promises (`main`, `module`, `types`, `typings`, every string leaf of
  `exports`, across all eight subpaths) exists and is non-empty, which catches the window and _names
  the missing file_ where attw's message names none; and a post-check on attw's untyped sentence,
  which catches what the preflight structurally cannot: declarations present on disk but excluded
  from the tarball by `files`/`.npmignore`. **No instance of that second case is on record here.**
  `test/scripts/attw-gate.test.ts` pins both nets against the real binary, including the upstream
  exit-0 itself, so an `attw` upgrade that reworks the wording or fixes the exit code reds the suite
  instead of letting the net go quietly slack. It also pins a **negative control** on a well-formed
  package, that a real `attw` failure still fails, and that `--profile node16` is still forwarded
  rather than swallowed.

### The argument guard is an ALLOW-LIST, not a deny-list

  **The post-check reads a string, so the argument guard is an ALLOW-LIST, NOT A DENY-LIST, AND THE
  DENY-LIST IS THE SECOND THING A REFUTER BROKE IN THIS SLICE.** Six routes were measured here
  against the pinned binary **with `--profile node16` present**, each making the sentence unreadable
  while attw still exited 0: `--quiet`, `-q`, `--format json`, `-f json`, `--format=json`, and a
  `.attw.json` setting `quiet` or `format` (`readConfig()` applies it after argv). The ported
  deny-list refused a set of spellings via `arg.split("=")[0]`: **token equality, not option-name
  matching**, and commander accepts a value fused to a short flag, so **`-fjson` is neither `-f` nor
  `--format`**, walked through, and handed back exit 0 with the sentence gone. The empty-transcript
  net backstops a `-q` cluster and **structurally cannot backstop `-f`**, because JSON output is not
  empty. **Do not answer this with a seventh spelling**: that is the failure mode
  `scripts/check-test-selection.ts` documents at length for a different guard here. The guard is
  total instead: `--profile` and `--no-definitely-typed` are forwarded and everything else is
  refused, including options that would blind nothing, since "harmless" is not a judgement this
  script can make from an option name. `--config-path` falls out for free. Widening the set is a
  deliberate one-line edit. **The `.attw.json` refusal stays separate**: it is not an argument, and
  no argument guard of any shape can reach a config applied after argv.

### The vendored tarballs are not part of the `attw` story

  **The seven `file:vendor/*.tgz` devDeps are NOT part of this.** `files` is `dist` plus three doc
  files, so `npm pack` emits no `vendor/` and no `node_modules/`, and attw does not resolve bare
  external specifiers at all, measured on a fixture whose only declaration imports a package that
  exists nowhere, which attw calls "No problems found". A **stale** vendored tarball can make this
  gate neither red nor green. A **missing** one is a different thing and this sentence does not cover
  it: `pnpm install`/`build` fail first, and the gate then reds at the preflight or at `could not run`.

## Standing disciplines: the rationales

### The changelog is generated by the release

`.changeset/config.json` set `"changelog": false` for the whole of this package's published history,
so no release ever wrote a version heading into `CHANGELOG.md` and nothing ever rolled `[Unreleased]`
over. `CHANGELOG.md` is in `package.json#files`, so every tarball shipped a changelog with **no
version headings at all** and a preamble promising that a first pre-alpha release "will ship" the
API surface listed under it. That promise was already in the future tense in the very tarball that
fulfilled it, and it stayed in the future tense through every release after. **The flag was the fix,
not the prose**: correcting the sentence by hand leaves the mechanism that wrote it.

Four things about the file's shape, each of which cost a sibling a refuter pass:

- **Changesets prepends by replacing the FIRST newline, so exactly one line may sit above generated
  output.** The rule is **"nothing but the H1 above the first heading"**, asserted on the released
  document too. Phrasing it as **"the archive heading comes second" WEDGES the first real release**,
  which puts its own `## <version>` exactly there.
- **`## 0.0.1` is a substring of `## 0.0.10`.** Compare whole headings, never `indexOf`/`toContain`.
  A summary may also quote the archive heading, and the quoted copy lands **above** the real one;
  anchor on a whole line, which holds because `getReleaseLine` indents every continuation line two
  spaces.
- **A changeset summary must never open a line at column 0 with an ATX heading.** Two spaces is
  exactly the `- ` bullet's content column, so it renders as a permanent second heading inside the
  published release section. Use an inline code span.
- **Changesets swallows a changelog-write failure with `console.warn`.** A tree whose declared
  Prettier config cannot be resolved bumps the version, consumes the changeset and writes **no
  changelog**. A release that publishes with an unchanged changelog is that failure, **not** a
  reverted flag.

**The Prettier pass is ON here, and it is DERIVED, never copied from a sibling: the value goes
wrong in both directions.** The discriminator is this repo's own markdown-formatting scope: there is
**no `.prettierignore` at all** and `format:check` globs `"*.{json,md,yml}"`, so `CHANGELOG.md` is
inside the formatting gate and its archived history is already Prettier-canonical. Measured both
arms: ON leaves the archived history **byte identical** through a real `changeset version`, so it
costs nothing; OFF makes the tool's own output non-canonical (it writes `## <version>` and
`### Patch Changes` on adjacent lines). **One sibling sentence is FALSE here and is not repeated:**
"every Version PR opens red", this repo's `version` script also runs `prettier --write` over
`CHANGELOG.md` one link after `changeset version`, where a sibling's covers only `package.json` and
`src/index.ts`, so OFF would neither red the Version PR nor keep Prettier away from the archive. It
would only leave the tool's output failing the gate covering the file it wrote, buying nothing. A
sibling whose `.prettierignore` lists `*.md` needs the opposite value; resyncing it is how a release
starts rewriting already-published text.

Gated by `test/scripts/changelog-generation.test.ts`, which runs the **real** `changeset version`
against the real changelog and real config in throwaway **git** repos rather than a string fixture:
**9 of its 15 cases are red on the parent** (measured, not recalled). The git history is
load-bearing: the default generator prefixes each entry with the short sha of the commit that added
the changeset, so a tree without history exercises a line shape no release writes.

### No internal project bookkeeping on a public surface

4. **No internal project bookkeeping on a public surface** (founder directive, 2026-07-27). What a
   consumer reads (`README.md`, `docs-content/`, the npm `description`, a release body) says what the
   software does and what changed. Item identifiers (`SYNTH-4`), phase and wave language, ADR numbers,
   meta-repo paths and `roadmap §N` citations belong in the changeset, `CHANGELOG.md`, the commit, the
   PR and the roadmap. It is a **translation** at the boundary, not a deletion, and when you strip an
   identifier off the front of a line, repair the head: a fragment reads worse than the text it
   replaced. Gated by `pnpm check:no-internal-refs`. The gate keys on known project prefixes, so **a
   new programme prefix has to be added to it by hand**; and it catches identifiers and citations, not
   English sentences about our process, so the reviewer still owns half the rule.

### `SYNTH` is both our item prefix and a marker in generated output

   **`SYNTH` is BOTH our item prefix AND the marker this package writes into what it generates.**
   `SYNTH-4` is one of our units of work; `SYNTH-FAC` (the `MSH-4` sending facility), `SYNTH-LIS` and
   `SYNTH-ANALYZER` (the ASTM `H` header) are the PHI discipline made visible in the output, and the
   generated NCPDP message id is `SYNTH-` plus ten random digits. The separation is the explicit
   `SYNTHETIC_FIXTURE_TOKEN` list in the gate, never a shape rule. **Never re-key the identifier rule
   on the `WORD-N` shape**, and never "resync" the prefix list with a sibling repo's copy without
   re-reading why `SYNTH` is PRESENT in this one and ABSENT from `ncpdp`'s.

### Four surfaces, three different answers

   **Four surfaces, three different answers.** Markdown a reader browses and the npm metadata are
   **gated**. `/** */` doc comments compile into `dist/*.d.ts` and render in a consumer's editor, so
   they are **gated**. String literals are **gated too**, and in a generator that pass matters more
   than anywhere else: these literals are not commentary about the software, they are **the bytes it
   emits**. `//` and plain `/* */` comments are **not gated** and identifiers are **welcome** in them,
   because **the convention says source comments are a place identifiers belong**. That is the whole
   reason. **Do not justify this boundary from what reaches `dist/`**: two attempts to, in a sibling
   repo, were both false and both caught by a refuter. Measured here: `dist` is `files[0]`, there is no
   `.npmignore`, the emitted bundles carry `//` comments verbatim (17 lines each in
   `dist/index.mjs` and `dist/index.cjs`), and the sixteen `dist/**/*.map` carry the full text of 66 of
   the 67 tracked `src/**/*.ts` in `sourcesContent`, so **effectively everything in `src/` is in the
   tarball** and the bundle leg carries the argument on its own. The line is not what reaches a
   consumer's disk (all of it does) but what a consumer is **shown**.

### Two consequences: doc comments and stale phase claims

   Two consequences: **removing a doc comment to satisfy the gate is a regression**, not a fix (JSDoc
   with `@example` on every public export is a hard guardrail above, and neither lint nor coverage will
   catch its loss); and **when a stale claim is what carries the phase number, cut the sentence rather
   than reword it**. Three subpath headers here documented quirk generation as still to come, three
   lines above the export that ships it; rewording would have left a falsehood standing in cleaner
   clothes. What the gate cannot do is read `dist/` itself: `dist/` is untracked build output, so this
   is a gate on the source of the published text, not on the published text.

### No em dash, anywhere

Founder directive 2026-07-24, `knowledgebase/06-brand/voice-and-tone.md`: "No em dashes. Ever."
It names commit messages explicitly. `scripts/check-no-emdash.sh` is what enforces it here, ported
from `astm`'s copy (the reference form, carrying the interposed-grep fix and the visibility probe
that the older `hl7` copy lacks). Landed 2026-08-06 with the content sweep in the same change:
**1,167 occurrences out of 1,296, across 135 of the 223 tracked files**, including
`package.json`'s published npm `description` and fourteen `docs-content/` pages that publish to
docs.cosyte.com. **Fourteen, not fifteen, and the off-by-one is worth naming because it was in the
first draft of this sentence, the changeset and the gate header at once**: `docs-content/` holds
fifteen tracked entries, and one of them (`sidebars.json`) is the Docusaurus sidebar config, not a
page. The number that grounds it is the doc-id list in that file, which names exactly fourteen, and
the sweep changed exactly fourteen `.md` files. Count pages, never directory entries.

**The census was taken by reading bytes in Python, not with `grep`.** In these containers `grep` is
a shell function forcing `-G --ignore-files -I`, and under `xargs` it is bypassed for
`/usr/bin/grep`, which in an empty locale fails with exit 2 and prints nothing for
`-P '\x{2014}'`. Piped to `wc -l` that reads as a clean tree. **Every count in this section came
from `open(path,'rb').read().count()`.** Measured at the same time and worth keeping: **zero**
entity, numeric-entity, URL or backslash-u forms anywhere in the tree. The pattern still carries all
six arms, because the reference sweep in `claude-containers` found the gate caught what the hand
sweep missed precisely through a `package.json` holding the named HTML entity rather than the
character. Only `scripts/check-no-emdash.sh` spells the encoded forms out, and it is the one file
excluded from its own pattern scan for that reason.

**Three things diverge from `astm`'s copy, all forced by this repo's own tree.**

1. **The binary partition exists at all.** `astm` tracks no binaries; this repo tracks seven vendored
   `.tgz` archives, and `vendor/cosyte-hl7-0.0.0.tgz` holds `E2 80 94` by coincidence inside its
   DEFLATE stream. A scan-everything form reds on it forever, with no edit that fixes it. Same defect
   `cli` recorded.
2. **The partition is a DECLARATION (`git check-attr binary` + `.gitattributes`), never a NUL test
   and never `grep -I`.** This is the half that matters.
   `test/property/seed-sweep.fuzz.property.test.ts` is a genuine UTF-8 TypeScript source carrying a
   literal NUL (a hostile-bytes fuzz corpus) **and it held 14 em dashes on the base commit of this
   sweep**. A NUL-partitioning scan excludes a prose-bearing source file in silence and reports green
   over all 14. **Do not "simplify" the partition back to a NUL or `-I` test.** The declaration is
   itself bounded: the gate **refuses any `binary` declaration outside `vendor/`**, so widening the
   exclusion means editing the script deliberately rather than adding a line to a dotfile. Tracked
   FILENAMES are scanned whatever the declaration says.
3. **`CHANGELOG.md` is scanned ABOVE its archive boundary only**, not excluded.
   `## Released before this file was generated` is the line. Above it is generated output, which is
   in scope because a changeset summary becomes a published release body **and** a line in the
   tarball's changelog. Below it is the hand-maintained history: **dated ship-log entries that were
   true when written, corrected above the record rather than edited**, and this repo's own rule is
   blunter still (do not hand-edit `CHANGELOG.md`). The 128 occurrences below the boundary are
   deliberate survivors. **It fails closed: remove the boundary heading and the whole file comes back
   into scope and reds.** The forward control point is `.changeset/*.md`, which the tracked-file scan
   covers in full.

**The job is deliberately NOT a required context, and the reason is not that it is weak.** It scans
the PR title, body and commit messages, and Dependabot composes a PR body by pasting the
dependency's **upstream release notes** into it, em dashes included. Requiring it blocks a dependency
bump on prose nobody here wrote and nobody here can edit without rewriting the PR by hand. That is
the same refusal this ecosystem already made for a CI `pnpm audit`: a gate that fails on someone
else's clock stops being a signal and becomes a tax. `website` exempts its own
`no-emdash-messages` context for exactly this. **Do not answer it with `if: github.actor !=
'dependabot[bot]'` on a required context** either: that leaves the check permanently PENDING on
those PRs, which is worse than red because nothing says why. The tracked-file half is what protects
the published surface, and nothing Dependabot does can put an em dash in a tracked file here.

**Two corrections a refuter made to that paragraph, and a third this session made to the first
correction.** First, **`website`'s precedent is a MESSAGES-ONLY context, so its tracked-file half
stays required and this one's does not**: `synth` bundles both halves into one job, so the exemption
un-requires the tracked-file half too.

**NOTHING BUYS THAT HALF BACK, AND THE FIRST ATTEMPT TO SAY OTHERWISE WAS FALSE.** The remediation
initially claimed `ci / verify` covers it by running `pnpm check:no-emdash`. It does not.
`cosyte/.github`'s reusable `ci.yml` runs a **fixed** ladder (typecheck, lint, format:check,
phi-scan, test, coverage, build, attw, dual ESM/CJS smoke) and **no arbitrary repo script**, which is
the same fact the "why a separate workflow" block already states two paragraphs above. So the
tracked-file half is a **visible red, not a merge blocker**, and that is the accepted cost. **Replacing
one false sentence with another is the specific failure this repo keeps re-learning: check the
reusable workflow's step list before attributing coverage to it.** The fix is to split this job in
two (a requirable tracked-file job, an exempt messages job), which is `website`'s shape and how
`no-internal-refs` is already required here; it is deferred only because a context may not be
required before its workflow has completed on `main`.

Second, **"nothing Dependabot can do dirties a tracked file" was literally false** (`package.json`
and `pnpm-lock.yaml` are its whole job). The true sentence is narrower: it writes version specifiers
and lockfile records, never prose, so it cannot introduce the character. The upstream release notes
it pastes reach the PR body and nothing else.

**The PR-text half is the half no local hook can cover, and two slices elsewhere have lost a review
pass to it.** A NEW file is untracked, so a scan of the index does not see it, and no local hook sees
a PR title or body at all. Check your own before you push.

**Traps paid for by the sweep itself, in this repo:**

- **A paired aside spanning two lines is invisible to a single-line detector.** Eleven of them here
  (`round-trip.ts` in five subpaths, `limitations.md`'s selector list, `attw.mjs`'s preflight
  enumeration, the C-CDA/FHIR identity-field lists). The mechanical rule turned the CLOSING dash into
  a colon and produced `X: aside: is drawn from ...`. **Find them by asking which dashes are followed
  by a finite verb**, then convert those to parentheses or a comma pair by hand.
- **A dash inside a clause that ALREADY carried a colon must become a comma, and twenty of them did
  not on the first pass.** Distinct from the paired-aside trap above: both dashes are on one line,
  the detector sees nothing wrong, and the result is a well-formed line carrying two colons
  (`Unit tests for the quirk core (src/quirk.ts): the machinery: exact comparison, ...`), which reads
  as though the second colon governs. Twelve were rewritten to a comma or a period on the second
  pass, including four `docs-content/` pages and the `README.md` sample. The other eight are sound
  because the two colons are in different sentences or one is inside parentheses or a code sample.
  **Find them by counting colons per line with backticked spans and URLs stripped, on the ADDED side
  of the diff, and comparing the count against the line it replaced.** A `src/safe/reserved.ts`
  source list showed the second-order version: one uniform dash separator became commas on two
  entries and colons on two others, so the list stopped being uniform as well as stacking a colon.
- **A PARALLEL LIST MUST END ON ONE SEPARATOR, and six here did not until a refuter pass.** The
  per-hit rule ("whatever the sentence wants") is right per sentence and wrong per list: applied
  entry by entry to a bullet list whose items were uniform em dashes at base, it lands a colon on
  one sibling and a comma on the next, and the list stops reading as a list. Six were mixed
  (`guides-overview.md`, `guides-x12.md`, `guides-ncpdp.md`, `src/x12/identity.ts`,
  `src/ncpdp/identity.ts`, `all-formats.property.test.ts`), and two of those are the **synthetic-safety
  posture lists that ship into `dist/*.d.ts`**, so a consumer reads them in IntelliSense. All six were
  normalised to `**label**: explanation`. **After sweeping, re-read every list as a list.**
- **The sweep can leave a markdown table ragged, and `format:check` does not cover `docs-content/`.**
  A colon is one character narrower than the dash plus its spaces, so three rows of
  `limitations.md`'s safety-floor table fell out of column alignment while `verify.sh` stayed green:
  the format globs are `src/**/*.{ts,md}`, `test/**/*.ts`, `scripts/**/*.{ts,mjs}` and `*.{json,md,yml}`,
  and `docs-content/` is in none of them. **Run `prettier --list-different "docs-content/**/*.md"` by
  hand after a sweep**, and do not read a green `verify` as covering those pages.
- **A dash that opens a wrapped comment line eats nothing to its left**, so the replacement lands
  against the comment leader (` *, at 6.4 s`). Four here. Grep for a punctuation mark directly after
  `*`, `//` or `#` at the head of a line.
- **A heading's anchor changes with its punctuation.** The `## Status` heading above slugged to
  `status--the-shipped-roadmap-in-full` while it carried a dash: the character drops out and the
  space either side of it survives, so the slug held TWO hyphens. With a colon it holds one, and
  `CLAUDE.md` cited the old anchor. **Re-resolve every `notes#` pointer after touching a heading.**
- **`test/scripts/phi-scan.test.ts` asserts by regex on `scripts/phi-scan.ts`'s own `OK, no hits`
  output string, twice.** Both sides are in scope, so a rule applied uniformly keeps them agreeing;
  a hand edit to one and not the other reds the suite.
