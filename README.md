# @cosyte/synth

> Deterministic, seedable **synthetic healthcare-fixture generator** for Node.js and TypeScript —
> spec-clean by construction, and **never real PHI**.

`@cosyte/synth` generates reproducible synthetic test corpora across the six cosyte formats (HL7 v2,
FHIR R4 / US Core, C-CDA, X12, NCPDP, and ASTM). It is a **consumer** of the
cosyte parsers, not a parser: it builds each artifact **through the parser's own builder/serializer**
(so the output is spec-clean by the same mechanism the parser proves) and draws every identifier, name,
date, phone, and address from a **guaranteed-non-colliding synthetic source**. It is a
**format/conformance generator, not a clinical simulator** — it does not model disease progression
(that is Synthea).

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. Phase 1 ships the seeded-PRNG core, the
> synthetic-safety providers, and the round-trip harness; Phase 2 the full HL7 v2 message set; Phase 3
> FHIR R4 / US Core (Patient + the clinical spine + Bundles); Phase 4 the rest of the US Core clinical
> set (`Encounter`, `DiagnosticReport`, `Immunization`, `AllergyIntolerance`, `Procedure`) and the
> `document` Bundle shape; Phase 4 **C-CDA generation** (CCD + Referral Note via `@cosyte/ccda`'s
> `buildCcda`); Phase 5 **X12 generation** (837P/I/D, 835, 271 in HIPAA 005010 via `@cosyte/x12`);
> Phase 6 **NCPDP generation** (SCRIPT NewRx / RxRenewal / RxChange + Telecom B1/B2/B3 via
> `@cosyte/ncpdp`) and **ASTM generation** (E1394 `H`/`P`/`O`/`R`/`C`/`L` record reports + E1381 framing
> via `@cosyte/astm`) — completing the spec-clean generation core across all six formats; Phase 7
> **vendor-quirk generation** — profile-driven off-spec fixtures for **HL7 v2, C-CDA, and ASTM**, each
> round-tripping to exactly the intended parser warning (the intended-warning contract).

## Install

```bash
npm install @cosyte/synth @cosyte/hl7 @cosyte/fhir @cosyte/ccda @cosyte/x12 @cosyte/ncpdp @cosyte/astm
```

`@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`, `@cosyte/x12`, `@cosyte/ncpdp`, and `@cosyte/astm` are
**optional peer dependencies**, each needed only for its subpath (`@cosyte/synth/hl7`,
`@cosyte/synth/fhir`, `@cosyte/synth/ccda`, `@cosyte/synth/x12`, `@cosyte/synth/ncpdp`,
`@cosyte/synth/astm`) — install only the parsers whose fixtures you generate. The package core has
**zero third-party runtime dependencies**.

## Generate a spec-clean HL7 v2 message

The HL7 v2 set covers `ADT` (`A01`/`A04`/`A08`), `ORU^R01`, `ORM^O01`, `SIU^S12`, and `VXU^V04` —
each built through `@cosyte/hl7`'s `buildMessage`, so it is spec-clean by construction.

```ts
import { generateAdt, generateOru, generateHl7, hl7Corpus, roundTrip } from "@cosyte/synth/hl7";

// Same seed → byte-identical message, on any machine, any run.
const adt = generateAdt({ seed: 12345, trigger: "A01" });
const oru = generateOru({ seed: 12345 });

// Spec-clean by construction: it round-trips through @cosyte/hl7 with zero warnings.
roundTrip(adt).specClean; // true
roundTrip(oru).specClean; // true

// Or generate a reproducible mixed corpus across every family:
const corpus = hl7Corpus({ seed: 42, count: 7 }); // one of each family, cycled
corpus.artifacts.every((a) => a.warnings.length === 0); // true — all spec-clean

// Dispatch by kind when the message type is data:
generateHl7("VXU^V04", 12345);
```

## Generate a spec-clean FHIR R4 / US Core resource

The `@cosyte/synth/fhir` subpath builds resources **through `@cosyte/fhir`'s model constructors**, so
they are spec-clean by construction — validating under `validateResource` and, against the **real US
Core 6.1.0 profiles** (bring your own `StructureDefinition`s — none is bundled), conformant to US Core.
The clinical set covers `Patient` (base + US Core), `Condition`, `Observation` (US Core Laboratory
Result + Vital Signs), `MedicationRequest`, `Encounter`, `DiagnosticReport`, `Immunization`,
`AllergyIntolerance`, and `Procedure`, assembled into a `collection`, `transaction`, or `document`
`Bundle`.

```ts
import { generatePatient, generateBundle, fhirCorpus, roundTrip } from "@cosyte/synth/fhir";

// A US Core Patient — same seed → byte-identical resource, anywhere.
const patient = generatePatient({ seed: 12345, profile: "us-core" });

// Spec-clean by construction: it round-trips through @cosyte/fhir with zero errors, byte-stable.
roundTrip(patient).specClean; // true

// A self-contained Bundle assembling a patient + its clinical spine, wired by urn:uuid references:
const bundle = generateBundle({ seed: 42, type: "transaction" });

// Or a reproducible mixed corpus across the whole spine:
const corpus = fhirCorpus({ seed: 2026, count: 6 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true — all spec-clean
```

`@cosyte/fhir` is an **optional peer dependency**, needed only for the `@cosyte/synth/fhir` subpath.

## Generate a spec-clean C-CDA document

The `@cosyte/synth/ccda` subpath builds Consolidated CDA R2.1 documents **through `@cosyte/ccda`'s
`buildCcda`**, so template IDs, LOINC section codes, and structured/narrative agreement are the
builder's own — the document round-trips through `parseCcda` with **zero warnings**. It emits a
**CCD** (`generateCcd`) or a **Referral Note** (`generateReferralNote`), each with the CCD sections
(Problems, Allergies, Medications, Results, Vital Signs, Immunizations, Procedures, Social History)
populated from the reused, license-clean example-code pools.

```ts
import { serializeCcda } from "@cosyte/ccda";
import { generateCcd, generateReferralNote, ccdaCorpus, roundTrip } from "@cosyte/synth/ccda";

// Same seed → byte-identical document. The patient name is from the shipped fake-name pool, the MRN
// lives under a synthetic assigning-authority OID, and every date comes from the seeded generator.
const ccd = generateCcd({ seed: 12345 });
serializeCcda(ccd); // spec-clean C-CDA R2.1 XML

// Spec-clean by construction: it round-trips through @cosyte/ccda with zero warnings.
roundTrip(ccd).specClean; // true
roundTrip(generateReferralNote({ seed: 12345 })).specClean; // true

// Or a reproducible mixed corpus (CCD + Referral Note, cycled):
const corpus = ccdaCorpus({ seed: 42, count: 4 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true — all spec-clean
```

`@cosyte/ccda` is an **optional peer dependency**, needed only for the `@cosyte/synth/ccda` subpath.

## Generate a spec-clean X12 transaction

The `@cosyte/synth/x12` subpath builds HIPAA **005010** transactions **through `@cosyte/x12`'s domain
builders** (`build837P/I/D`, `build835`, `build271`), so the ISA/GS/ST…SE/GE/IEA envelope, the
computed HL spine, the control numbers, and every segment are the builder's own — each transaction
round-trips through `@cosyte/x12` with **zero warnings**. It emits **837** professional / institutional
/ dental claims, the **835** remittance (balance-checked by construction), and the **271** eligibility
response.

```ts
import { generate837P, generate835, generate271, x12Corpus, roundTrip } from "@cosyte/synth/x12";

// Same seed → byte-identical EDI. Every subscriber/patient/provider identifier is
// synthetic-by-construction: the provider NPI has a deliberately-INVALID Luhn check digit (so it can
// never be a NPPES-issued NPI), the provider tax id is an SSA never-issued 900-range SSN, member ids
// live under a synthetic assigning authority, and names come from the shipped fake-name pool.
const claim = generate837P({ seed: 12345 });
roundTrip(claim).specClean; // true — re-parses through @cosyte/x12 with zero warnings, byte-stable
roundTrip(generate835({ seed: 7 })).specClean; // true
roundTrip(generate271({ seed: 3 })).specClean; // true

// Or a reproducible mixed corpus (837P/I/D + 835 + 271):
const corpus = x12Corpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true — all spec-clean
```

`@cosyte/x12` is an **optional peer dependency**, needed only for the `@cosyte/synth/x12` subpath.

**Deferred:** the **270** eligibility _request_ (`@cosyte/x12` ships a `build271` but no `build270`, and
`synth` never hand-writes bytes around a missing builder) and **vendor-quirk mode** (Phase 7 / SYNTH-7).

## Generate a spec-clean NCPDP message

The `@cosyte/synth/ncpdp` subpath builds both NCPDP standards **through `@cosyte/ncpdp`'s own emit
surface**, so each message round-trips through the parser with **zero warnings**. It emits **SCRIPT**
ePrescribing (`generateNewRx` via `buildNewRx`; `generateRxRenewalRequest` / `generateRxChangeRequest`
via the parser's typed `ScriptMessage` model + `serializeScript`) and **Telecom** pharmacy claims
(`generateB1` billing / `generateB2` reversal / `generateB3` rebill via `buildTelecomRequest`).

```ts
import {
  generateNewRx,
  generateB1,
  ncpdpCorpus,
  scriptRoundTrip,
  telecomRoundTrip,
} from "@cosyte/synth/ncpdp";

// Same seed → byte-identical output. NCPDP carries patient AND prescriber identity: the prescriber NPI
// has a deliberately-INVALID Luhn check digit and the prescriber DEA a deliberately-INVALID checksum
// (so neither can denote a real provider); patient/cardholder ids live under a synthetic assigning
// authority, phones are reserved 555-01xx, and names come from the shipped fake-name pool.
scriptRoundTrip(generateNewRx({ seed: 12345 })).specClean; // true — zero warnings, byte-stable
telecomRoundTrip(generateB1({ seed: 777 })).specClean; // true

// Or a reproducible mixed corpus (NewRx + RxRenewal + RxChange + B1 + B2 + B3):
const corpus = ncpdpCorpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true — all spec-clean
```

`@cosyte/ncpdp` is an **optional peer dependency**, needed only for the `@cosyte/synth/ncpdp` subpath.

**Deferred:** SCRIPT coverage tracks the parser's builder surface (the renewal/change _responses_ land
as `@cosyte/ncpdp` grows builders); **vendor-quirk mode** is Phase 7.

## Generate a spec-clean ASTM message

The `@cosyte/synth/astm` subpath builds ASTM laboratory messages **through `@cosyte/astm`'s own emit
surface** — `buildAstmMessage` for the E1394 record layer, `composeAstmFrames` for the E1381 frame
layer — so each message round-trips through the parser with **zero warnings**. It emits the
`H`/`P`/`O`/`R`…/`C`/`L` **result report** (`generateAstmResult`), the `H`/`P`/`O`/`L` **order**
(`generateAstmOrder`), and the **framed** twin (`generateAstmResultFramed`).

```ts
import {
  generateAstmResult,
  generateAstmResultFramed,
  astmRoundTrip,
  astmFramedRoundTrip,
  astmCorpus,
} from "@cosyte/synth/astm";

// Same seed → byte-identical output. The P (patient) record carries the name, birthdate, and the
// practice- and laboratory-assigned patient ids — all synthetic-by-construction: names from the shipped
// fake-name pool, DOB seeded, and the two ids minted independently under a synthetic assigning authority
// (so they stay DISTINCT, exactly as @cosyte/astm keeps them on parse).
astmRoundTrip(generateAstmResult({ seed: 12345 })).specClean; // true — zero warnings, byte-stable

// The E1381-framed twin: the modulo-256 checksum and 0–7 frame numbers are computed by @cosyte/astm.
astmFramedRoundTrip(generateAstmResultFramed({ seed: 12345 })).specClean; // true

// Or a reproducible mixed corpus (a result report + an order):
const corpus = astmCorpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true — all spec-clean
```

`@cosyte/astm` is an **optional peer dependency**, needed only for the `@cosyte/synth/astm` subpath.

## Generate a vendor-quirk fixture

Spec-clean fixtures test that a parser reads a _correct_ message; **quirk mode** tests that it tolerates
the realistic vendor deviations real traffic carries — and surfaces exactly the right diagnostic. The
quirk vocabulary **is the parsers' own profile systems**: a quirk deviates the message _structure_ so it
round-trips to **exactly one intended, stable warning code** (the **intended-warning contract**), and
where a built-in **public** parser profile claims the deviation, it round-trips cleanly under it
(suppressed, or re-badged to `PROFILE_QUIRK_APPLIED`). A quirk never introduces a real-looking value —
it changes shape, never provenance, so the synthetic-safety gate still passes.

Phase 7 ships quirks for the three richest profile systems — **HL7 v2, C-CDA, and ASTM**:

```ts
import { generateHl7Quirk, hl7QuirkRoundTrip } from "@cosyte/synth/hl7";
import { generateCcdaQuirk, ccdaQuirkRoundTrip } from "@cosyte/synth/ccda";
import { generateAstmQuirk, astmQuirkRoundTrip } from "@cosyte/synth/astm";

// A site-defined HL7 v2 Z-segment → exactly UNKNOWN_SEGMENT; the `visage` profile suppresses it.
hl7QuirkRoundTrip(generateHl7Quirk({ seed: 1, quirk: "unknown-zsegment" })).warnings; // ["UNKNOWN_SEGMENT"]

// A deprecated C-CDA LOINC → exactly DEPRECATED_LOINC; `smartScorecard` re-badges it.
ccdaQuirkRoundTrip(generateCcdaQuirk({ seed: 1, quirk: "deprecated-loinc" })).withProfile
  ?.tolerated; // true

// A non-standard ASTM &Z& escape → exactly ASTM_UNKNOWN_ESCAPE_SEQUENCE; `referenceCorpus` re-badges it.
astmQuirkRoundTrip(generateAstmQuirk({ seed: 1, quirk: "unknown-escape" })).intendedWarningHeld; // true
```

A quirk a format's profile system does not support fails closed with a stable `SYNTH_UNSUPPORTED_QUIRK`
diagnostic — never a silently-wrong fixture. Every quirk is grounded in a **publicly-documented**
deviation or a parser's **public** profile (ADR 0018), never a private vendor corpus.

**Deferred:** quirk recipes for **FHIR, X12, and NCPDP** (whose profile/quirk surface lands in a later
phase), and any quirk that would need a **private, vendor-attributed corpus** to ground (kept
`REAL-CORPUS`-gated, exactly as the parsers' named per-vendor profiles are).

## Draw a synthetic value

```ts
import { createRng, safe, isSyntheticSsn, isSyntheticNpi } from "@cosyte/synth";

const rng = createRng(42);
isSyntheticSsn(safe.ssn(rng)); // true — always an SSA never-issued SSN
isSyntheticNpi(safe.npi(rng)); // true — always a deliberately-invalid-Luhn NPI (never a real NPI)
```

## What makes it trustworthy

- **Synthetic-by-construction** — no code path emits a value not drawn from a reserved range or the
  shipped fake-name pool (SSA never-issued SSNs, NANP `555-01xx` phones, RFC 2606/6761 `example.*`
  domains, RFC 5737/3849 TEST-NET IPs, a synthetic assigning authority for MRNs). A CI gate proves it.
  **No generated value can be real or plausibly-real PHI.**
- **Spec-clean by the parser's own judgment** — built through the parser's conservative serializer, and
  checked by feeding the artifact straight back in: a spec-clean artifact re-parses with zero warnings.
- **Deterministic** — a hand-rolled seeded PRNG (`sfc32`/`splitmix32`); `Math.random` is lint-banned.
  A seed, and only the seed, determines the output — byte-for-byte, anywhere.
- **Immutable** — generated artifacts and the `Corpus` result are deep-frozen.
- **Zero third-party runtime dependencies** — the parser peers are first-party cosyte packages,
  vendored for dev/test; dual ESM + CJS, validated with `attw`.

## License

MIT © Cosyte
