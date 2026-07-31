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

- **A brand image at the top of `README.md`.** The page opens with the Cosyte lockup, served as a
  `<picture>` with a light and a dark source so it follows the reader's theme, and carrying alt text
  that describes the mark for anyone reading with images off or a screen reader on. The block is
  copied byte for byte out of the `hl7` README, which is the reference the suite mirrors, so the
  repos that carry it stay one string rather than drifting into as many hand-typed variants. The
  first 353 bytes of this README are now byte-identical to that file's, with the first divergence
  inside the H1.
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
- **Phase 3 — FHIR R4 / US Core (SYNTH-3).** A new `@cosyte/synth/fhir` subpath generating the US Core
  clinical spine **through `@cosyte/fhir`'s own model constructors and serializer**, so every resource
  is spec-clean by construction — validating under `@cosyte/fhir.validateResource` and, against the
  **real, published US Core 6.1.0 `StructureDefinition`s** (BYO — none bundled), conformant to US Core:
  - **New generators** at the `@cosyte/synth/fhir` subpath: `generatePatient` (base + `profile:"us-core"`
    with the race/ethnicity/birthsex must-support extensions), `generateCondition` (US Core
    problem-list item), `generateObservationLab` (US Core Laboratory Result), `generateVitalSign` (US
    Core Vital Signs), `generateMedicationRequest` (US Core, satisfying the `us-core-21` requester
    invariant), and `generateBundle` (`collection` + `transaction`, wired by `urn:uuid:` references).
  - **`fhirCorpus(seed, count?, mix?)`** — a reproducible mixed corpus across the spine; **`roundTrip`**
    — the FHIR round-trip/validate harness (serialize → parse → validate(strict) → serialize), which
    accepts caller-supplied (BYO) US Core / vendor profiles. For FHIR, **spec-clean means zero
    `error`/`fatal` findings + byte-stable** (the harness exposes both `errors` and `warnings`);
    advisory findings a valid resource may legally carry — `REFERENCE_UNRESOLVED` on a collection
    Bundle's external reference, `MUST_SUPPORT_ABSENT`, `INVARIANT_UNCHECKED`, base `dom-6` — are **not**
    spec-cleanliness violations, unlike the HL7-side "zero warnings" contract (FHIR warnings are not all
    conformance failures).
  - **Model-construction helpers** (`prop`/`str`/`dec`/`bool`/`coding`/`codeableConcept`/`reference`/
    `narrative`/`meta`/`mrnIdentifier`/`fhirPatientIdentity`/`toFhirDate`) that build through
    `@cosyte/fhir`; US Core canonical URLs + code-system identifiers (`US_CORE_PROFILE`, `SYSTEM`, the
    race/ethnicity/birthsex extension URLs) as **facts only**; and a small **license-clean** FHIR
    example-code pool (`EXAMPLE_LAB_OBSERVATIONS`, `EXAMPLE_VITAL_SIGNS`, `EXAMPLE_CONDITIONS`,
    `EXAMPLE_MEDICATIONS`, `EXAMPLE_RACE_CATEGORIES`, `EXAMPLE_ETHNICITY_CATEGORIES` — public LOINC/
    SNOMED/RxNorm/OMB code facts). **No** US Core IG or terminology content is bundled.
  - **US Core conformance is validated firsthand** against the committed real US Core 6.1.0 profiles
    (`test/us-core-profiles/`, BYO reference inputs) — every US-Core generator validates with **zero
    errors** across a 200-seed sweep; plus FHIR seed-determinism, synthetic-safety, and golden-fixture
    property/regression suites, and FHIR-aware structured detection (HumanName + phone `ContactPoint`)
    in the repo `phi-scan`.
  - **Vendored `@cosyte/fhir`** as an optional peer dep via the same `file:vendor/*.tgz` pattern —
    third-party runtime deps stay at **zero**. Deferred to SYNTH-4: `Encounter`, `DiagnosticReport`,
    `Immunization`, `AllergyIntolerance`, `Procedure`, the `document` Bundle shape, and quirk mode.
- **Phase 4 — the rest of the US Core clinical set (SYNTH-4).** Extends the `@cosyte/synth/fhir` subpath
  from the SYNTH-3 clinical spine to the full US Core clinical set, each built **through `@cosyte/fhir`'s
  own model constructors** and validated firsthand against the **real, published US Core 6.1.0
  `StructureDefinition`s** (BYO — none bundled):
  - **New generators:** `generateEncounter` (US Core Encounter), `generateDiagnosticReport` (US Core
    Laboratory DiagnosticReport — carries the mandated `LAB` category slice and `effectiveDateTime` +
    `issued` for the `us-core-8`/`us-core-9` invariants, with optional `result` wiring),
    `generateImmunization` (US Core Immunization), `generateAllergyIntolerance` (US Core
    AllergyIntolerance — `clinicalStatus` + `verificationStatus` emitted together for `ait-1`/`ait-2`),
    and `generateProcedure` (US Core Procedure). Each takes a `subject`/`patient` reference and claims US
    Core via `meta.profile` by default (`usCore:false` opts out).
  - **The `document` Bundle shape:** `generateBundle({ type: "document" })` leads with the FHIR-mandated
    `Composition` (`bdl-11`) plus a synthetic `Organization` author/custodian, and carries the required
    `identifier` (`bdl-9`) and `timestamp` (`bdl-10`). `buildComposition` is exported. The shared Bundle
    spine now assembles the **full clinical set** wired by `urn:uuid:` `fullUrl`s so **every reference
    resolves in-bundle** (the `DiagnosticReport.result` points at the in-bundle lab `Observation`).
  - **New license-clean example-code pools** (public code facts, no terminology bundled): `EXAMPLE_VACCINES`
    (CVX), `EXAMPLE_ALLERGENS` + `EXAMPLE_ALLERGY_MANIFESTATIONS` (RxNorm/SNOMED), `EXAMPLE_PROCEDURES`
    (SNOMED — never CPT), `EXAMPLE_DIAGNOSTIC_REPORTS` (LOINC panels), `EXAMPLE_ENCOUNTER_TYPES` (SNOMED),
    `EXAMPLE_ENCOUNTER_CLASSES` (v3 ActCode); plus the matching `SYSTEM`/`US_CORE_PROFILE` identifiers.
  - **`fhirCorpus`** now cycles the full clinical set by default; every new generator is covered by the
    round-trip (zero-error, byte-stable), US-Core-conformance (zero-error over a 200-seed sweep),
    seed-determinism, synthetic-safety, and golden-fixture suites. The five new US Core 6.1.0 profiles
    (`us-core-encounter`, `us-core-diagnosticreport-lab`, `us-core-immunization`,
    `us-core-allergyintolerance`, `us-core-procedure`) are committed under `test/us-core-profiles/`.
    Deferred to SYNTH-5: C-CDA generation; quirk mode remains Phase 7.
- **Phase 4 / C-CDA — spec-clean C-CDA generation (SYNTH-5).** A new `@cosyte/synth/ccda` subpath
  generating Consolidated CDA R2.1 documents **through `@cosyte/ccda`'s `buildCcda`**, so every document
  is spec-clean by construction — it round-trips through `parseCcda` with **zero warnings**, is
  seed-deterministic (byte-identical for a seed), and is synthetic by construction:
  - **New generators:** `generateCcd` (Continuity of Care Document), `generateReferralNote` (the second
    document type `buildCcda` supports, with its Reason-for-Referral + Assessment narrative sections),
    and the generic `generateCcda({ documentType })`. Each populates the CCD SHALL sections (Problems,
    Allergies, Medications, Results, Vital Signs) plus Immunizations, Procedures, and Social History
    (Smoking Status).
  - **`ccdaCorpus`** builds a reproducible mixed corpus (CCD + Referral Note by default); `roundTrip`
    is the C-CDA round-trip-through-the-parser harness (serialize → parse → serialize, judged by the
    parser). `ccdaPatientIdentity` mints the synthetic `recordTarget`.
  - **Reuses the license-clean example-code pools** (the same public LOINC/RxNorm/SNOMED/CVX facts the
    FHIR generators ship, adapted to `@cosyte/ccda`'s OID-coded `BuildCode`) plus a small Social-History
    (SNOMED smoking status) and NCI-route pool. No terminology content is bundled.
  - **Synthetic-by-construction:** the patient name is from the shipped fake-name pool, the MRN lives
    under the synthetic assigning-authority OID (never a real facility namespace), and every date comes
    from the seeded generator — `buildCcda`'s default `effectiveTime: new Date()` is always overridden
    with a synthetic date so the reproducibility contract holds. Seed-determinism and synthetic-safety
    property suites (250-seed sweeps) + golden fixtures added; the repo `phi-scan` gains C-CDA-aware
    structured detection (recordTarget `name` + `telecom`).
  - **`@cosyte/ccda` vendored as an optional peer dep** (`file:vendor/cosyte-ccda-0.0.1.tgz`), lazily
    loaded per format — importing the package root never pulls it; third-party runtime deps stay at
    zero. Deferred to SYNTH-6: X12 generation; quirk mode remains Phase 7.
- **Phase 5 / X12 — spec-clean HIPAA 005010 generation (SYNTH-6).** A new `@cosyte/synth/x12` subpath
  generating X12 EDI transactions **through `@cosyte/x12`'s domain builders**, so every interchange is
  spec-clean by construction — it round-trips through `@cosyte/x12` with **zero warnings**, is
  byte-stable, seed-deterministic, and synthetic by construction:
  - **New generators:** `generate837P` / `generate837I` / `generate837D` (Professional / Institutional /
    Dental claims via `build837P/I/D`), `generate835` (Health Care Claim Payment/Advice via `build835`,
    **balance-checked by construction** — line, claim, and remit balance identities are satisfied before
    the builder is called), and `generate271` (Health Care Eligibility Benefit Response via `build271`).
    A shared `generate837(variant, …)` selects the claim variant. The builder computes the HL spine and
    the ISA/GS/ST…SE/GE/IEA envelope + control numbers, so `synth` never hand-writes a byte.
  - **`x12Corpus`** builds a reproducible mixed corpus (one of each of 837P/I/D + 835 + 271 by default);
    `roundTrip` is the X12 round-trip-through-the-parser harness (serialize → parse → serialize, judged
    by the parser). `x12Person` / `x12Organization` / `x12ProviderPerson` / `x12Payer` /
    `x12TradingPartners` / `x12EnvelopeTiming` mint the synthetic identity; `dec` / `money` are the
    shared `X12Decimal` money helpers.
  - **Synthetic-safety is the hardest-attacked invariant here** (an 837/271 is identity-dense). New
    provider **`safe.npi`** emits a 10-digit NPI with a **deliberately-invalid Luhn check digit** — a real
    NPI must satisfy the CMS `80840`-prefixed Luhn check, so a `synth` NPI can **never** be a NPPES-issued
    provider (new `isSyntheticNpi` / `npiCheckDigit` / `luhnMod10` + `NPI_LUHN_PREFIX`). Provider tax ids
    are SSA never-issued (900-range) SSNs at `REF*SY`; member ids are synthetic-assigning-authority
    scoped; person names are from the shipped fake-name pool; DOBs/dates come from the seeded generator.
  - The repo **`phi-scan` gains X12-aware structured detection** (NM1 person names + member ids + NPIs,
    PER contact names + phones, `REF*SY` provider SSNs, and a hard refusal of `NM1*34` raw SSNs). A
    Luhn-**valid** XX-qualified NPI is a hard hit — it could denote a real provider. Seed-determinism and
    synthetic-safety property suites (120-seed sweeps) + committed `.edi` golden fixtures added.
  - **`@cosyte/x12` vendored as an optional peer dep** (`file:vendor/cosyte-x12-0.0.1.tgz`), lazily loaded
    per format — importing the package root never pulls it; third-party runtime deps stay at zero.
  - **Deferred:** the **270** eligibility _request_ (`@cosyte/x12` ships `build271` but no `build270`, and
    `synth` never hand-writes bytes around a missing builder — coverage tracks the builder); vendor-quirk
    mode remains Phase 7 / SYNTH-7.
- **Phase 6 / NCPDP — spec-clean SCRIPT + Telecom generation (SYNTH-7).** A new `@cosyte/synth/ncpdp`
  subpath generating both NCPDP standards **through `@cosyte/ncpdp`'s own emit surface**, so every
  message is spec-clean by construction — it round-trips through the parser with **zero warnings**, is
  byte-stable, seed-deterministic, and synthetic by construction:
  - **New SCRIPT (XML ePrescribing) generators:** `generateNewRx` (via the validated `buildNewRx`
    builder) and `generateRxRenewalRequest` / `generateRxChangeRequest` (built as `@cosyte/ncpdp`'s
    **public typed `ScriptMessage` model** + `serializeScript` — the same typed-model→serializer path
    the X12 arm uses, never a hand-written byte). Each round-trips through `parseScript` cleanly.
  - **New Telecom (vD.0 pharmacy claim) generators:** `generateB1` (billing), `generateB2` (reversal),
    and `generateB3` (rebill) via `buildTelecomRequest` + `serializeTelecom` — the fixed Transaction
    Header, the FS/GS/RS framing, and every field id are the parser's own emit. A shared
    `generateTelecom(code, …)` selects the transaction.
  - **`ncpdpCorpus`** builds a reproducible mixed corpus (one of each of NewRx + RxRenewalRequest +
    RxChangeRequest + B1 + B2 + B3 by default); `scriptRoundTrip` / `telecomRoundTrip` are the NCPDP
    round-trip-through-the-parser harnesses. `ncpdpPatient` / `ncpdpPrescriber` / `ncpdpPharmacy` /
    `ncpdpCardholder` / `ncpdpScriptRouting` mint the synthetic identity; a small license-clean
    example-drug pool (`EXAMPLE_DRUGS`, invented `00000`-labeler NDCs) supplies drug content — **no
    NCPDP-copyrighted text is bundled**.
  - **Synthetic-safety carries a new identity locus X12 did not have — the prescriber DEA.** New
    provider **`safe.dea`** emits a `XX`+7-digit DEA number with a **deliberately-invalid checksum** — a
    real DEA number's 7th digit satisfies the published `(d1+d3+d5)+2·(d2+d4+d6)` checksum, so a `synth`
    DEA can **never** be a validly-issued registration (new `isSyntheticDea` / `deaCheckDigit` +
    `DEA_REGISTRANT_TYPES`). Prescriber NPIs remain invalid-Luhn; patient / cardholder / member ids are
    synthetic-assigning-authority scoped (`MBR`-prefixed); names from the fake-name pool; DOBs and dates
    (including SCRIPT `SentTime`) from the seeded generator (never wall-clock).
  - The repo **`phi-scan` gains an NCPDP arm** — SCRIPT (`<FirstName>`/`<LastName>`/`<MiddleName>`
    names, `<NPI>` Luhn, `<DEANumber>` checksum) and Telecom (field-id-keyed CA/CB/CC/CD names, CQ
    phone, CY/C2 ids, DB prescriber NPI). A Luhn-**valid** NPI or a checksum-**valid** DEA is a hard hit
    — it could denote a real provider. Seed-determinism + synthetic-safety property suites (120-seed
    sweeps) and committed `.xml` (SCRIPT) + `.ncpdp` (Telecom) golden fixtures added.
  - **`@cosyte/ncpdp` vendored as an optional peer dep** (`file:vendor/cosyte-ncpdp-0.0.1.tgz`), lazily
    loaded per format — importing the package root never pulls it; third-party runtime deps stay at zero.
  - **Deferred:** SCRIPT coverage tracks the parser's builder surface — the renewal/change **responses**
    and other lifecycle transactions land as `@cosyte/ncpdp` grows its builders (`synth` never
    hand-writes bytes around a missing builder). Vendor-quirk mode remains Phase 7.
- **Phase 6 / ASTM — spec-clean E1394 + E1381 generation (SYNTH-8).** A new `@cosyte/synth/astm` subpath
  generating ASTM/CLSI-LIS laboratory messages **through `@cosyte/astm`'s own emit surface**, so every
  message is spec-clean by construction — it round-trips through the parser with **zero warnings**, is
  byte-stable, seed-deterministic, and synthetic by construction. This **completes the spec-clean
  generation core across all six formats** (ASTM was gated on `@cosyte/astm`'s serializer/builder,
  `ASTM-7`, now shipped):
  - **New record generators (E1394):** `generateAstmResult` (a full `H`/`P`/`O`/`R`…/`C`/`L` result
    report) and `generateAstmOrder` (`H`/`P`/`O`/`L`), built through `buildAstmMessage` — the `H|\^&`
    delimiter declaration, record type letters, per-type sequence counters, and `L` terminator are the
    parser's own conservative emit, never a hand-written byte. Each round-trips through
    `parseAstmRecords` cleanly and re-serializes byte-identically.
  - **New framing generator (E1381):** `generateAstmResultFramed` frames the same records via
    `composeAstmFrames` into `<STX> FN text <ETB|ETX> CS <CR><LF>` — the **modulo-256 checksum and the
    `0`–`7` frame number are computed by `@cosyte/astm`, never faked** — round-tripping through
    `parseFramedAstm` with **zero frame and zero record warnings**.
  - **`astmCorpus`** builds a reproducible mixed corpus (a result report + an order by default);
    `astmRoundTrip` / `astmFramedRoundTrip` are the ASTM round-trip-through-the-parser harnesses.
    `astmPatient` / `astmOrder` / `astmHeaderIdentity` mint the synthetic identity; a small license-clean
    `EXAMPLE_ASTM_TESTS` pool (public LOINC codes + invented local analyzer codes) supplies test content
    — **no terminology prose is bundled**.
  - **Synthetic-safety at ASTM's PHI-dense `P` (patient) record:** the patient name comes from the
    shipped fake-name pool, the birthdate is seeded (never wall-clock), and the **practice-assigned**
    and **laboratory-assigned** patient IDs are minted **independently** under the synthetic assigning
    authority (`PRA` / `LAB`-prefixed) so they stay **distinct** — exactly as `@cosyte/astm` keeps them
    distinct on parse. The order accession is `ACC`-prefixed synthetic.
  - The repo **`phi-scan` gains an ASTM arm** — the `P`-record name (field 6, `Last^First^Middle`) and
    the practice/lab patient IDs (fields 3/4), tolerating an E1381 frame prefix so a framed fixture is
    swept identically to a bare record stream. A name not declared synthetic, or a patient ID not
    recognized as synthetic-AA-scoped, is a hard hit. Seed-determinism + synthetic-safety + spec-clean
    round-trip property suites (150-seed sweeps, record and framed) and committed `.astm` (record) +
    `.frame` (framed) golden fixtures added.
  - **`@cosyte/astm` vendored as an optional peer dep** (`file:vendor/cosyte-astm-0.0.0.tgz`), lazily
    loaded per format — importing the package root never pulls it; third-party runtime deps stay at zero.
  - **Deferred:** vendor-quirk mode (lowercase ASTM checksums, framing dropped over TCP, and the other
    tolerances `@cosyte/astm`'s profile system advertises, each round-tripping to exactly the intended
    warning) remains Phase 7.
- **Phase 7 — vendor-quirk generation, the differentiator (SYNTH-9).** Profile-driven **off-spec**
  fixtures whose vocabulary **is the parsers' own profile systems** — a quirk deviates message
  _structure_ so it round-trips to **exactly one intended, stable parser warning** (the
  **intended-warning contract**), and where a **public** built-in parser profile claims the deviation it
  round-trips cleanly under it (suppressed, or re-badged to `PROFILE_QUIRK_APPLIED`). Shipped for the
  three richest profile systems — **HL7 v2, C-CDA, ASTM**:
  - **Format-agnostic quirk core** (`src/quirk.ts`, root subpath): `QuirkDescriptor` / `QuirkArtifact` /
    `QuirkRoundTripResult` / `QuirkProfiledVerdict` / `QuirkProfileDisposition`, `resolveQuirk` (fail-closed
    `SYNTH_UNSUPPORTED_QUIRK`), `sameCodeSet`, `profileTolerated`, `validateProfileQuirks`,
    `assertIntendedWarnings`, and the `PROFILE_QUIRK_APPLIED` marker. Quirks are applied **post-serialize**
    (roadmap §10 Q4: profile tolerance is parse-side) as a deterministic transform of the parser's own
    emit, and every `generate*Quirk` **self-checks the intended-warning contract at generation time**
    (`assertIntendedWarnings`) — a fixture whose bare parse does not produce exactly the declared code is a
    fatal error, never a silently-mislabeled golden file.
  - **HL7 v2** (`@cosyte/synth/hl7`): `generateHl7Quirk` / `hl7QuirkRoundTrip` / `hl7QuirkCorpus` /
    `hl7QuirkProfile` / `HL7_QUIRKS`. `unknown-zsegment` → `UNKNOWN_SEGMENT` (suppressed by the public
    `visage` PACS profile's `ZDS` claim); `unknown-escape` → `UNKNOWN_ESCAPE_SEQUENCE`.
  - **C-CDA** (`@cosyte/synth/ccda`): `generateCcdaQuirk` / `injectCcdaQuirk` / `ccdaQuirkRoundTrip` /
    `ccdaQuirkCorpus` / `ccdaQuirkProfile` / `CCDA_QUIRKS`. `template-extension-absent` →
    `TEMPLATE_EXTENSION_ABSENT` (re-badged by the public `legacyR11` profile); `deprecated-loinc` →
    `DEPRECATED_LOINC` and `deprecated-code-system` → `DEPRECATED_CODE_SYSTEM` (re-badged by the public
    `smartScorecard` profile). Structural (seed-robust) XML anchors that hold for **every generable
    document type** (CCD **and** Referral Note — the `template-extension-absent` quirk drops the R2.1
    stamp on each document-type template root).
  - **ASTM** (`@cosyte/synth/astm`): `generateAstmQuirk` / `astmQuirkRoundTrip` / `astmQuirkCorpus` /
    `astmQuirkProfile` / `ASTM_QUIRKS`. `unknown-escape` → `ASTM_UNKNOWN_ESCAPE_SEQUENCE` (re-badged by the
    public `referenceCorpus` OSS profile); `unknown-record-type` → `ASTM_RECORD_UNKNOWN_TYPE`.
  - **Synthetic-safety holds in quirk mode** — a quirk changes shape, never provenance, so the `phi-scan`
    gate stays zero over quirk output (proven by scanner tests + committed quirk fixtures under
    `test/fixtures/{hl7,ccda,astm}/quirk/`). Mandatory property suites: intended-warning (every quirk ×
    seed × kind → exactly the intended code), seed-determinism (byte-identical), synthetic-safety.
  - **Grounding:** every quirk is **publicly grounded** (ADR 0018 — a published IG, a vendor interface
    spec, or a redistributable OSS corpus), never a private vendor corpus. **Deferred:** quirk recipes for
    **FHIR / X12 / NCPDP**, and any quirk that would need a private, vendor-attributed corpus
    (`REAL-CORPUS`-gated). New `@cosyte/synth/ccda` export `injectCcdaQuirk`; a new **quirk guide** in
    `docs-content/`.
- **Phase 8 — the `@cosyte/deid` pairing loop (SYNTH-10).** A new `@cosyte/synth/deid` subpath — a
  deterministic, seeded **closed-loop co-validation harness** for the `synth` ⇄ `deid` pair: **generate**
  a spec-clean synthetic artifact → **enumerate** the distinctive synthetic PHI sentinels `synth` planted
  at its patient loci → **de-identify** through `@cosyte/deid` → **verify** every sentinel is gone from
  the de-identified output (a surviving sentinel is a hard failure) **and** that the clinical payload
  survives (the over-scrub guard). It consumes the shipped generators unchanged — a harness capability,
  not a generator change.
  - **Per-format loops:** `hl7DeidLoop` (ADT/ORU/ORM/SIU/VXU), `fhirDeidLoop` (a US-Core `Bundle`, so
    there is clinical content to prove is not over-scrubbed), `x12DeidLoop` (837P/837I/837D/271/835),
    `ncpdpTelecomDeidLoop` (B1/B2/B3), and `ccdaDeidLoop` (CCD + Referral Note). Each returns an immutable
    `DeidLoopResult` (`planted` / `survivors` / `clinicalProbed` / `clinicalScrubbed` / `pass`).
  - **Removal check, locus-scoped and collision-proof.** Sentinels are enumerated from the patient PHI
    loci — via `@cosyte/deid`'s own extractors for HL7/FHIR/X12/NCPDP, and a `<recordTarget>`-scoped scan
    for C-CDA — then decomposed to **literal, distinctive** synthetic tokens (`identifierSentinels`,
    `recordTargetSentinels`). Removal is verified by sweeping only the **de-identified values that remain
    at those former PHI loci** (`sweepSurvivors`), re-read from the de-identifier's own output — so
    provider/organization identity a de-identifier legitimately retains (drawn from the same synthetic
    pools) never reads as a false survivor.
  - **Removal-oriented policy** (`deidLoopPolicy`, `DEID_LOOP_POLICY_NAME`): HIPAA Safe Harbor with the
    keyed-by-default identifier categories (MRN / beneficiary / account) switched to `redact`, so the loop
    needs **no key context** and is a pure function of the seed.
  - **Over-scrub guard** (`clinicalRetention`): distinctive (≥ 4-char) structured clinical codes present
    before de-identification must survive after — short codes are not probed (they collide inside removed
    PHI). Plus a `summarizeDeidCoverage` per-format coverage report.
  - **Honest scope (roadmap §Phase 8, §7):** this is a **co-validation harness**, not an independent audit
    of `@cosyte/deid` against real-world data — it proves the pair works on `synth`'s own output; a
    sentinel `deid` **blocks** rather than redacts still passes (blocked = gone). Covers the five formats
    both packages support; **NCPDP SCRIPT** and **ASTM** (no `@cosyte/deid` adapter) and **DICOM** (not
    generated by `synth`) are **skipped and named** (`DEID_LOOP_SKIPPED`), never silently.
  - `@cosyte/deid` is an **optional peer dependency**, vendored for dev/test via the `mllp`/`ncpdp`
    pattern (`vendor/cosyte-deid-0.0.0.tgz`); **third-party runtime deps stay at 0**. Property suites:
    seed-determinism (byte-identical artifact + de-identified output + sentinels), removal (0 survivors
    across every format × seed), over-scrub (0 clinical loss), non-vacuity (the loop genuinely fails when
    a sentinel survives — proven by tampering), and synthetic-safety of every planted sentinel.
    **Deferred:** NCPDP SCRIPT / ASTM / DICOM pairing (blocked on `@cosyte/deid` adapters), optional
    Synthea clinical-content ingestion (roadmap §Phase 8 — documented future concern), and SYNTH-11
    release hardening.
- **Phase 9 — release hardening (SYNTH-11), the final roadmap phase.** No new runtime API; this phase
  is the property/fuzz suite, coverage, publish dry-run, and honesty docs that make the package
  release-shaped. The generator is feature-complete across all six formats.
  - **Consolidated conformance property suite** (`test/property/all-formats.property.test.ts`) — every
    one of the six spec-clean format generators is driven through the **same three mandatory
    properties** (round-trip spec-clean · seed-determinism · synthetic-safety) so no format can silently
    ship without one; plus an **intended-warning** arm proving each quirk corpus (HL7 v2 / C-CDA / ASTM)
    is non-vacuous and stays synthetic-safe. Non-vacuity is asserted directly (the registry is proved to
    cover every `SynthFormat`; every corpus is proved non-empty with non-trivial content).
  - **Seed-sweep generation fuzz** (`test/property/seed-sweep.fuzz.property.test.ts`, the inverted fuzz
    of roadmap §6) — sweeps seed × count × format across the six spec-clean corpora and the three quirk
    corpora, asserting generation is **total**: it never throws outside the sanctioned `SYNTH_FATAL_CODES`
    set, never hangs, and every output still passes the round-trip + synthetic-safety gates. Scales via
    `SYNTH_FUZZ_RUNS`; new `test:fuzz` script + a nightly `Fuzz` workflow (`.github/workflows/fuzz.yml`).
  - **Dual ESM/CJS release-shape smoke** (`scripts/smoke.mjs`, new `smoke` script, run by `verify.sh`) —
    for **every published subpath** (`.`/`hl7`/`fhir`/`ccda`/`x12`/`ncpdp`/`astm`/`deid`) it imports the
    ESM entry and requires the CJS entry from `dist/`, generates synthetic output through each, and
    asserts ESM/CJS agree byte-for-byte for the same seed — catching a broken dual build a source-only
    suite would not.
  - **Publish dry-run proven:** `attw` green (per-condition types across all eight subpaths) and an
    `npm publish --dry-run` clean 58-file tarball carrying every subpath's `.d.ts`/`.mjs`/`.cjs` plus
    `README`/`LICENSE`/`CHANGELOG`. Per-dir **≥90 coverage** continues to gate.
  - **Honesty docs** — `docs-content/limitations.md` (registered in the sidebar and gated by the
    doc/code-agreement runner) leads with the governing sentence (_format/conformance generator, not a
    clinical simulator; synthetic-by-construction; deterministic per seed within a version window; no
    bundled terminology; no DICOM in v1_) and states the full **synthetic-safety posture** (the
    900-range SSN, invalid-Luhn NPI, invalid-checksum DEA, `555-01xx` phone, `example.*` domain,
    TEST-NET IP, and synthetic-assigning-authority MRN floors), the structural-not-clinical / not-Synthea
    scoping, and the deferred surfaces (FHIR/X12/NCPDP quirks, NCPDP SCRIPT responses, X12 270 request,
    DICOM, Synthea ingestion). **Founder-gated tail (not crossed):** the actual `npm publish` and the
    repo public-flip remain the two standing human stops.
- `VERSION` export.
- **Public-surface gate: `scripts/check-no-internal-refs.sh` + `pnpm check:no-internal-refs` + the
  `no-internal-refs` workflow.** Ported from `hl7`'s reference implementation via `ncpdp`'s copy (which
  added the fourth pass), keeping the cross-repo parts verbatim: the prefix list, the paragraph-join
  second pass, the doc-comment third pass, the string-literal fourth pass, the silent-green route
  closures and the NEGATIVE self-tests. Four passes: the public markdown + npm metadata, the same rules
  over paragraph-joined text (so a violation straddling a line wrap cannot hide), `src/` doc comments,
  and `src/` string literals. It self-tests both directions on every run and refuses to print OK from a
  scan that did not read all of its input.
  Two deliberate divergences from the sibling copies, both recorded in the script header:
  **`SYNTH` is in the prefix list here and absent from `ncpdp`'s** (it is this repo's own item prefix,
  and was the whole of the identifier backlog), with the collision it creates handled by an explicit
  `SYNTHETIC_FIXTURE_TOKEN` exclusion for the three provenance markers this package stamps into
  generated output (`SYNTH-FAC`, `SYNTH-LIS`, `SYNTH-ANALYZER`) rather than by dropping the prefix; and
  **rule 5 gained a `roadmap §` arm**, the same widening `ncpdp` made to rule 3 for ADR paths, because
  this repo cites its roadmap by section and 169 such citations were structurally invisible without it.
  Both widenings carry their own standalone self-test so a later "resync with a sibling copy" reds
  instead of silently reopening the hole. `CHANGELOG.md` is excluded on purpose, as in every sibling
  copy: it ships inside the npm tarball, yet the same convention names it as a place identifiers
  belong. That contradiction is ecosystem-wide and is recorded, not decided here.
- **CI-REQUIRED-CHECKS: a gate on what the required test job SELECTS, not just that it ran.**
  `scripts/check-test-selection.ts` (`pnpm check:test-selection`, also reached by `pnpm check`) plus
  `.github/workflows/test-selection.yml` (job id, and therefore future check-run context,
  `test-selection`). It compares the tracked test files that EXIST against the files
  `vitest list --filesOnly` says vitest would RUN, and reds on any shortfall in its subject. Ported
  in shape from `ncpdp` `27f9e89`; the **invocation rule ports verbatim** (this repo's `test` /
  `test:coverage` bodies are spelled identically, confirmed before reuse, so
  `ALLOWED_TEST_SCRIPT_BODIES` is the same closed exact-match set rather than a re-derivation), and
  the **derived subjects are re-derived here**, because `ncpdp`'s ground its fuzz subject in a
  workflow that hands a path straight to `vitest run` and **no workflow in this repo contains that
  string at all** (ported verbatim it refuses). Three subjects instead:
  1. **The published surface**, from `package.json` `exports`. Each of the eight subpaths resolves to
     a `dist/[<dir>/]index.<ext>` emitted from `src/[<dir>/]index.ts`; every tracked module under
     scope naming one of those entry points must be selected, and every entry point must have at
     least one selected module naming it. Keyed on a **resolved module path**, not a filename and not
     a bare substring, so a rename moves nothing out of the subject; scope is a **deny-list** of
     `src/`, `scripts/` and the repo root, so a move anywhere else does not either. **This is the
     rule that reaches the synthetic-safety property layer**, which was named by nothing.
     **The scope was an allow-list (`test/`) in the first version and the refuter broke it**:
     relocating all six `synthetic-safety.property.test.ts` files into `internal/` took the whole
     safety layer out of CI, `vitest list` selected zero of them, and the gate printed OK exit 0.
     A move into one of the three denied locations still escapes and is stated in three places
     rather than denied.
  2. **The fuzz path**, derived in two steps because that is how this repo spells it: the nightly
     `Fuzz` workflow runs `pnpm test:fuzz`, whose body is a `vitest run <path>`. Redundant today
     (that module also imports a published entry) and kept for its empty-set refusal, which is a
     tripwire on the fuzz job disappearing **only if no other literal path is left behind anywhere in
     a workflow**. The extraction is text and cannot tell a real `run:` from prose quoting one, so a
     commented `vitest run test/hl7` suppresses the refusal; calling it unconditional would overstate
     it.
  3. **The PHI scanner**, ported directly (`phi-scan` script plus `run-phi-scan: true` in `ci.yml`).

  It prints a **denominator** on every run instead of a bare OK: of 39 tracked in-scope code modules,
  **38 are watched by a name-independent rule, 1 by the `.test.`/`.spec.` filename shape alone
  (`test/docs-content.test.ts`), and 0 by no rule at all**. The like-for-like figure in `ncpdp` is **4
  of 27** in-scope modules; its own header quotes "4 of 24", counting only name-shaped files, which
  flatters the ratio. Cite the comparable number, not the friendlier one.
  Three self-tests re-prove it on every run, one resolving a genuinely narrowed config through real
  vitest; **self-test A ignores the filename floor and requires a DERIVED rule to name each dropped
  file**. Both A's drop targets one at a time, so the colliding direction is exercised in each; the
  single difference is that `ncpdp`'s verdict counts the filename floor, which is why that one passed
  with its derived rules neutered. (An earlier draft of this entry said `ncpdp`'s A "does not do" the
  one-at-a-time part; a refuter corrected it, and A is not the backstop for the derived rules in either
  repo, because emptying a subject empties A's targets with it. Self-test C is.)
  **`test-selection` is deliberately NOT added to ruleset `19913330`**: a required context no
  workflow has emitted on `main` leaves every future PR pending and unmergeable. Wire first, require
  later.

  **Every quantity above is re-derivable, not asserted.** The script header lists the command that
  produces each one, because two of the three refuter passes found a false number or a false claim of
  reach rather than a hole in the mechanism, both times from a sentence ported out of a sibling repo
  and never re-measured here. All of them were re-measured against this repo, on the tree that ships.

  Demonstrated red by seeding, one route at a time: a narrowed `include`; an `exclude` targeting
  `**/synthetic-safety.property.test.ts`; an `exclude` dropping `test/property/`; positional filters
  written both `vitest run <p>` and `vitest --run <p>`; `--shard=`, `--config=`; a body naming no
  vitest at all (`pnpm run test:unit`, `node node_modules/vitest/vitest.mjs run`) **and a delegation
  to this repo's own narrowing script, `pnpm run test:fuzz`**; renaming a safety suite to `.ts`,
  `.spec.ts` and `_safety.ts`; **the colliding renames that were measured GREEN on `ncpdp`'s earlier
  versions** (`_helpers.ts`, `test/_helpers/load-fixture.ts`, `test/_x/parse.ts`, and the cross-format
  safety suite moved into `test/_helpers/fuzz-config.ts`); the PHI suite renamed to
  `phi-scan-suite.ts`; the fuzz subject renamed out of shape; `run-phi-scan: false`; and
  un-exporting `./astm` together with a narrowed include. Deleting the `Fuzz` workflow, deleting the
  `test:fuzz` script, or deleting the `exports` map each make it **REFUSE to report** rather than pass
  vacuously.

  Red after the refuter pass, having been **green before it**: any suite relocated out of `test/`
  (one safety suite, then all six at once, then the PHI suite, each into `internal/`), and a suite
  renamed to `_safety.ts` whose import specifiers were rewritten to unicode escapes so the raw text
  no longer looked like the path while the imports still resolved.

  Green and stated as limits rather than denied: a config branching on `process.argv` (**2 of 39**
  suites would have run); un-exporting `./astm` alone (**2** `test/astm` suites drop to the filename
  floor, denominator 38 to 36); a suite moved into `src/`, `scripts/` or the repo root; and renaming
  `test/docs-content.test.ts` out of shape.

- **The dual ESM/CJS release smoke now runs in a job.** `.github/workflows/smoke.yml` (job id `smoke`,
  matrix contexts `smoke (22)` / `smoke (24)`), with `build` and `smoke` as steps of **one** job so a
  future required context covers both. Same wiring `deid` used for the same defect, which is what
  makes this a class rather than an incident. These contexts are also deliberately **not** added to
  the ruleset yet.

### Changed

- **Fatal messages come from a frozen registry, and `SynthError` takes no value parameter.** Every
  message is a fixed entry in the newly exported `SYNTH_FATAL_MESSAGES` table, keyed by code, and the
  constructor is `SynthError(code)`: there is no longer a position through which a caller-supplied
  string can reach `message`, `stack`, or any field on the thrown object.

  **The severity, stated honestly.** This is not a leak of patient data and describing it as one
  would be its own dishonesty. `@cosyte/synth` generates synthetic fixtures, so the values a refusal
  used to quote were quirk names, format labels, code-system URIs and money strings. What was wrong
  was the _shape_: every fatal took a value parameter, and the only thing keeping PHI out of a
  diagnostic was that callers happened to be passing harmless values. The audit of the thirteen
  cosyte repos found that the single property separating the packages that leak from the ones that
  are genuinely prevented is exactly this: whether the message factory takes a value parameter at
  all. It now does not.

  The prose mattered as much as the code here. The claim that warning messages are PHI-free by
  construction spread through this ecosystem as a _sentence_, not as shared runtime code, and this
  package had inherited the sentence and used it as a reason not to bound anything. Every surface
  carrying it has been corrected in the same change rather than restated in fresher words:
  `src/codes.ts` (whose `@param message` read "never contains PHI, there is none"),
  `docs-content/troubleshooting.md`, `docs-content/concepts-archetype.md`,
  `docs-content/limitations.md`, `docs-content/guides-quirks.md` and `README.md`.

- **Every caller-supplied selector is resolved against its closed set, not trusted.** `resolveKind`
  and `resolveMix` (new, exported, `src/select.ts`) sit at the entry point of every option that names
  a member of a union: a message kind, an `ADT` trigger, a document type, a corpus mix entry, an `837`
  variant, a Bundle type, a `Patient` profile, a quirk kind. An unrecognised one is a fatal
  `SYNTH_UNSUPPORTED_KIND`.

  **This is the same defect as the message one, not a separate tidy-up**, and it was found by the
  refuter after the message fix had been called done. A selector union does not exist at run time, and
  an unresolved selector did three things at once. It travelled into an optional peer builder, which is
  entitled to quote it back in its own `TypeError` and does, so a caller-supplied string reached an
  `err.message` and an `err.stack` through a `@cosyte/synth` entry point (`generateCcda`,
  `generateCcdaQuirk`, `ccdaCorpus`, `ccdaQuirkCorpus`). It became an `Artifact.kind` and a
  `manifest.counts` key, which is the structural-identifier position the whole model half of this work
  is about (`x12Corpus({ mix })`). And it fell out of an exhaustive `switch` as `undefined`, which
  neither reads as an error nor is one.

- **`assertIntendedWarnings` loses its leading `quirk` parameter**, and is now
  `assertIntendedWarnings(intendedWarnings, bareWarnings)`. It existed only to be interpolated into
  the refusal. A parameter whose sole job is to reach a message is the shape being removed, so it was
  deleted rather than left in place and ignored.

- **`resolveQuirk` refuses a descriptor found under a different format's registry**, on the same
  `SYNTH_UNSUPPORTED_QUIRK` code. The `format` argument used to be read only to build the message
  text; it is now compared, never rendered.

- **`defineSynthProfile` raises `SynthError` with `SYNTH_INVALID_PROFILE`** for a missing or blank
  `name`, where it previously raised a `TypeError`.

- Replaced the parser-archetype scaffold stubs (`parseSynth`, `WARNING_CODES`, `FATAL_CODES`) with the
  generator surface — `@cosyte/synth` is a synthetic-fixture **generator**, not a parser.
- **Docs:** refreshed the `README.md` status block to describe the **feature-complete** generator surface
  (all six spec-clean formats + quirk mode for HL7 v2/C-CDA/ASTM + the `@cosyte/deid` pairing loop) with
  its honest deferrals, replacing the stale forward-looking Phase 1–7 roadmap narrative. Status remains
  pre-alpha (`0.0.x`), not yet published to npm.
- **PUBLIC-SURFACE-HYGIENE (founder directive, 2026-07-27): no internal project bookkeeping on a public
  surface.** Swept every surface a consumer reads — `README.md`, `docs-content/`, the npm `description`
  and `keywords`, the `src/` JSDoc that compiles into `dist/*.d.ts` and renders on hover, and the `src/`
  string literals this package emits into what it generates. Measured on the base commit `cdfcdd9` by
  running the gate exactly as it ships, with its refusal suppressed so every pass reports rather than
  stopping at the first: **21 rows over 19 distinct locations on the public markdown and npm metadata**;
  **416 rows over 227 distinct lines in `src/` doc comments** (288 found line by line, 128 more found
  only by the paragraph-reflow pass); **1 in `src/` string literals**, with a second found by hand that
  no rule here can see; and **562 rows over 442 distinct lines in the built declaration files**, 281
  rows per module condition. All
  are now zero. The backlog recorded "11+6"; a count is a function of the rule set, so these were taken
  with the final one and are quoted with the tree they were taken on. Item identifiers (`SYNTH-4`),
  `Phase N` language, ADR numbers, meta-repo paths and `roadmap §N` citations are gone from those
  surfaces; they remain where the convention puts them — the changeset, this file, the commit, the PR
  and the roadmap.
- **Stale deferral claims deleted rather than reworded.** `src/ccda/index.ts` and `src/astm/index.ts`
  each documented quirk generation as still to come, lines above the export that ships it;
  `src/ncpdp/index.ts` and `docs-content/guides-ncpdp.md` said ASTM generation was not yet shipped when
  the ASTM subpath ships. Stripping the phase number would have left
  a false claim standing in cleaner clothes, so the sentences were cut.
- **`DEID_LOOP_SKIPPED[].reason` text changed for the `ncpdp-script` and `dicom` entries.** The reasons
  are unchanged in substance; the internal citation trailing each was removed. These strings are part of
  a frozen exported constant, so a consumer asserting them verbatim is affected. The `format` values and
  the shape of the constant are unchanged, and no generated byte changes.

### Deprecated

### Removed

### Fixed

- **A corpus could report a transaction it did not contain.** `x12Corpus({ seed: 9, mix: ["270"] })`
  returned a corpus whose manifest said `{"270": 1}` and whose bytes were an `837` professional claim,
  byte-identical to `mix: ["837P"]` at the same seed, because the kind dispatcher ended in an
  unguarded fallback. Every corpus dispatcher is now an exhaustive `switch` behind a resolved
  selector, so an unrecognised kind is a fatal `SYNTH_UNSUPPORTED_KIND` and can no longer be silently
  relabelled. A golden file that lies about what it holds is the failure the intended-warning contract
  exists to prevent, in the one format that had no equivalent check.

- **Five exhaustive `switch`es over run-time-erased unions returned `undefined` typed as a value.**
  `generateHl7`, `generateHl7Quirk`'s base-message dispatcher, `fhirCorpus`, `ncpdpCorpus` and
  `astmCorpus` each took no branch for a kind outside its union and handed the result on, surfacing
  later as a `TypeError` from the runtime with no code to branch on. All five are now guarded by a
  resolved selector.

  **Three more of the same shape are known and deliberately left**, in `src/deid/`:
  `x12DeidLoop({ variant })` and `ncpdpTelecomDeidLoop({ transaction })` fall through to an uncoded
  `TypeError`, and `ccdaDeidLoop({ documentType })` silently generates a Referral Note for anything but
  `"ccd"`. None echoes a caller value into a message, so none is a diagnostic leak. They are named here
  rather than swept in, because two review passes had each found one more position after this change
  described its own coverage as general, and widening the change a third time is the wrong response to
  that.

- **`injectCcdaQuirk` returned `undefined` for an unrecognised quirk name, as though it were a
  document.** `CcdaQuirkName` is a union that does not exist at run time, so a JavaScript caller (or
  a cast) reaching the function with any other string fell out of the transform's switch with no
  branch taken and no error. The name is now resolved against `CCDA_QUIRKS` first and an unknown one
  is a fatal `SYNTH_UNSUPPORTED_QUIRK`. Found by the diagnostic-surface slot table below, which
  recorded it as the one slot that produced neither a value nor a diagnostic.

- **`README.md` said the package was not published to npm. It is.** The summary blockquote opened
  with "pre-alpha (`0.0.x`), not yet published to npm", so the npm package page asserted that the
  package did not exist on npm, directly under the version npm renders in its own header. A reader
  could not tell which half was current. The line now says the package is published and points at
  the npm package page for the version that is live. **No version number is written into the
  correction, deliberately**: the registry is the source of truth, and a number copied onto a page
  is a number that goes stale there (`npm view @cosyte/synth version` is the check).
  - The closing line of the same blockquote, "the two remaining founder gates are the actual
    `npm publish` and the repo public-flip", was **cut rather than reworded**. Both halves are now
    false: the publish happened, and `cosyte/synth` is already a public repository (read back from
    `gh repo view`). Rewording it would have left a measured falsehood standing in cleaner clothes.
  - **Still standing, and deliberately not touched here.** `CLAUDE.md` carries the same "not yet
    published" claim, and the `[Unreleased]` preamble in this file still says the first pre-alpha
    release "will ship" the initial API surface, in the future tense, about a version that shipped.
    Both belong to a cross-repo item spanning eight repos; fixing one repo's copy inside this change
    would fragment it. `docs-content/intro.md` and `docs-content/installation.md` carry the "not yet
    published to npm" claim too, and are left for the same sweep.
- **`scripts/smoke.mjs` ran in NO CI job.** It only ever ran on the meta-repo's local
  `scripts/verify.sh` ladder, which a contributor is not obliged to run and CI never invokes, so no
  required check covered the eight published subpaths and a green PR said nothing about whether they
  load. Now wired (`.github/workflows/smoke.yml`).

  **A correction, recorded rather than quietly dropped.** Earlier drafts of this entry and of two
  other surfaces said the file had been _documented as a CI gate_, so that the docs asserted a
  protection nothing provided. **That was false here**, and the third refuter pass caught it: every
  surface describing this file said `run by verify.sh` (this file, `CLAUDE.md`, and the
  release-hardening changeset), and its header said only "Run after `build`". The docs were accurate.
  The sentence was **ported from `deid`, where it is true** (its own changelog records the line that
  claimed CI and never ran), and it was ported without re-measuring it against this repo, which is
  precisely the failure the test-selection gate's header warns about two entries up. The defect is
  real and unchanged; only the indictment of the prior docs was wrong.

- **The smoke's subpath set was a hand-written array.** `SUBPATHS` listed the eight subpaths inline,
  so dropping one would have left the gate printing OK over a subset. It is now derived from
  `package.json` `exports` at run time, loads the export targets themselves rather than
  reconstructing `dist/<name>/index.mjs` by hand (so an `exports` entry pointing at a path the build
  does not emit fails here rather than in a consumer's install), and **REFUSES to report** if its
  per-subpath probe map and that `exports` map disagree in either direction. There is no exclusion
  list either: `./package.json` drops out because its target is structurally data, not because a key
  was named. Demonstrated: deleting `"./astm"` from `exports` makes the smoke refuse. That refusal is
  the interlock under `check:test-selection`, whose headline subject is derived from the same map.

### Security

- **A per-slot diagnostic-surface gate, run red before it was run green.**
  `test/phi/diagnostic-surface.test.ts` drives `assertNoDiagnosticPhiLeak` from `@cosyte/test-utils`
  over a table of **44** consumer-controlled positions: the quirk name, format label and registry key
  on `resolveQuirk`; the quirk selector on all three `generate*Quirk`, all three `*QuirkRoundTrip` and
  all three `*QuirkCorpus` entry points, by explicit list and through a `defineSynthProfile` profile;
  both code lists on `assertIntendedWarnings`; both parameters of `injectCcdaQuirk`; the code-system
  URI on `toBuildCode`; the money string on `dec`; **eighteen selector positions** across the six
  formats (message kind, `ADT` trigger, document type, corpus mix, `837` variant, Bundle type,
  `Patient` profile, quirk kind); and the artifact `content` each quirk round-trip harness hands to a
  sibling parser. Each slot plants an eight-byte marker and a 32 KiB one, names the code it must
  reach, and fails if any four-byte run of the marker turns up in a thrown value, a `message`, a
  `stack`, or a structural identifier on a returned model.

  **Measured against the unfixed source first, because a suite never seen red is indistinguishable
  from one that cannot go red.** Of the 44 slots, **3 were clean and 41 failed**. The failure
  categories **overlap** — a slot can both echo the marker and throw an uncoded error, and 8 do — so
  they are counted per slot per category and do not sum to 41: **20** echoed the planted value
  verbatim into an error message or stack, **4** put it on a model identifier, **16** threw an error
  carrying no code to branch on, and **7** accepted it with neither an error nor a usable value. The
  method: check out the base tree's `src/`, add the new codes and the frozen table as a purely
  additive patch with an _optional_ message parameter so no base call site changes, then invoke each
  slot's plant directly with both probe sizes.

  **The model half of that sweep is vacuous, and the file says so rather than letting a reader infer
  coverage.** Every slot throws, because every position fails closed before a model exists, so
  `getModelIdentifiers` is never reached during the sweep. That is the result of the fix, not a gap in
  the table, and it is carried instead by a separate assertion that runs the three identifier helpers
  over real corpora and real quirk round-trips and checks that every identifier they yield comes from
  a set this package controls. Between them: the slots prove no caller value survives to a model, and
  the closed-set test proves the identifiers that exist were derived rather than passed through.

  It also asserts the structural half: no `throw new` under `src/` names anything but `SynthError`,
  and no construction of one carries an interpolation. The scanner is positive-controlled against a
  constructed string containing the thing it hunts, not against a file that happens to be nearby, and
  **its title says what a regex can see while its docblock says what it cannot** — it cannot see a
  `TypeError` the runtime raises on its own, which is exactly the route the selector chokepoint
  closes.

  What the gate does not prove is in the runner's own documentation and is not restated more
  favourably here: it does not catch a re-encoded echo, an echo under four bytes, a leak carried only
  as a number, or a leak through a position nobody declared. The slot table is the deliverable. It was
  derived by enumerating the exported types with the TypeScript checker rather than by sweeping the
  source from memory. **Even so it was refuted twice, on the same class both times.** The first
  version covered only `throw` sites and missed eighteen selector positions. The second called the
  selectors "generalised, not patched" and missed the tail of a quirk list a `count` never reaches,
  which lands on `manifest.quirks` unresolved. Enumerating the types was necessary and not sufficient:
  both misses were judgements about which positions "reach a diagnostic", made before it was
  established that an unresolved selector reaches a peer builder's diagnostic and a derived manifest
  key.

  **So the table is no longer described as exhaustive, on any surface.** A third claim of completeness
  would be worth exactly what the first two were. What holds generally is the mechanism — the error
  type has no value parameter, and a selector is read in one place — and the table is an enumeration
  of the positions that have been checked. That wording is now in the test file's own header, in
  `docs-content/limitations.md` and in `CLAUDE.md`, so the next person to add a position adds a slot
  rather than trusting a count.

[Unreleased]: https://github.com/cosyte/synth/commits/main
