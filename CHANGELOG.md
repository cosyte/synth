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
    hand-writes bytes around a missing builder). **ASTM** generation is gated on `@cosyte/astm`'s
    serializer (`ASTM-7`, not yet shipped — SYNTH-8), and vendor-quirk mode remains Phase 7.
- `VERSION` export.

### Changed

- Replaced the parser-archetype scaffold stubs (`parseSynth`, `WARNING_CODES`, `FATAL_CODES`) with the
  generator surface — `@cosyte/synth` is a synthetic-fixture **generator**, not a parser.

### Deprecated

### Removed

### Fixed

### Security

[Unreleased]: https://github.com/cosyte/synth/commits/main
