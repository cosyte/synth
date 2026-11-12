<a href="https://cosyte.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cosyte.com/tile/cosyte-lockup-tile-on-dark-1200x300.png">
    <img alt="The Cosyte logo on its own white ground: the icon beside the word Cosyte." src="https://cosyte.com/tile/cosyte-lockup-tile-on-light-1200x300.png">
  </picture>
</a>

# @cosyte/synth

> Seeded, reproducible **synthetic healthcare fixtures** for Node.js and TypeScript: spec-clean, never real PHI.

[![npm version](https://img.shields.io/npm/v/@cosyte/synth.svg)](https://www.npmjs.com/package/@cosyte/synth)
[![CI](https://img.shields.io/github/actions/workflow/status/cosyte/synth/ci.yml?branch=main&label=CI)](https://github.com/cosyte/synth/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/cosyte/synth/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org)

Deterministic, seedable synthetic healthcare test fixtures for Node.js and TypeScript: HL7 v2, FHIR R4 and US Core, C-CDA, X12, NCPDP, and ASTM, spec-clean by construction and never real PHI.

## Why this exists

A test suite for a healthcare integration needs messages and documents that look like what a
sending system produces, and it must never hold a real patient's data. Copying production samples
and scrubbing them by hand risks the second; writing fixtures by hand rarely gets the first. And a
fixture that changes on every run cannot be committed as a golden file.

`@cosyte/synth` generates reproducible synthetic test corpora across the six Cosyte formats (HL7 v2,
FHIR R4 / US Core, C-CDA, X12, NCPDP, and ASTM). It is a **consumer** of the
Cosyte parsers, not a parser: it builds each artifact **through the parser's own builder/serializer**
(so each artifact re-parses through that parser with zero warnings) and draws every identifier, name,
date, phone, and address from a **guaranteed-non-colliding synthetic source**. It is a
**format/conformance generator, not a clinical simulator**: it does not model disease progression
(that is Synthea).

## Status

The 0.1 line, published to npm. The version shown on the npm package page is the one
that is live; this page never repeats it. Every release is a patch, a breaking change included, and
the changelog says what broke and what a caller must change. The generator is **feature-complete**: the
seeded-PRNG core, the synthetic-safety providers, and the round-trip harness; **generation across all
six formats**, HL7 v2 (`ADT`/`ORU`/`ORM`/`SIU`/`VXU`/`MDM`/`DFT`/`OML` and `ACK`), FHIR R4 / US Core (the full clinical
set + `collection`/`transaction`/`document` Bundles), C-CDA R2.1 (CCD + Referral Note), X12 005010
(837P/I/D, 835, 271), NCPDP (SCRIPT NewRx / RxRenewal / RxChange + Telecom B1/B2/B3), and ASTM (E1394
record reports + E1381 framing), each built **through its parser's own builder/serializer**; **vendor-quirk
mode**, profile-driven off-spec fixtures for the three richest profile systems (**HL7 v2, C-CDA, ASTM**),
each round-tripping to exactly the intended parser warning (the intended-warning contract); and the
**`@cosyte/deid` pairing loop**, a closed-loop co-validation harness that de-identifies generated output
and proves every planted synthetic PHI sentinel is removed.

What is not generated yet (quirks for some formats, a few transactions, some pairing loops) is
listed in one place, [what it does and does not do](https://docs.cosyte.com/synth/limitations),
so this page does not repeat it.

## Install

```bash
npm install @cosyte/synth @cosyte/hl7 @cosyte/fhir @cosyte/ccda @cosyte/x12 @cosyte/ncpdp @cosyte/astm @cosyte/deid
```

Node.js 22.12 or later, tested on 22.12, 22, 24, and 26. A generator loads its parser on first use
through `require`, and Node.js loads an ES module that way only from 22.12, so a value you get back
is an instance of the parser classes you import.

**Bundling.** A bundler cannot see that load. If you bundle code that uses `@cosyte/synth`, mark
`@cosyte/synth` and every `@cosyte/*` parser you use as external (esbuild `--external:@cosyte/*`,
Rollup and Vite `external`, webpack `externals`) and install them beside the bundle.

`@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`, `@cosyte/x12`, `@cosyte/ncpdp`, `@cosyte/astm`, and
`@cosyte/deid` are **optional peer dependencies**, each needed only for its subpath (`@cosyte/synth/hl7`,
`@cosyte/synth/fhir`, `@cosyte/synth/ccda`, `@cosyte/synth/x12`, `@cosyte/synth/ncpdp`,
`@cosyte/synth/astm`, and `@cosyte/synth/deid`, whose peer is `@cosyte/deid`). Importing a subpath
loads no parser: each loads the first time a generator needs it, so install only the packages whose
fixtures you generate. A `@cosyte/synth/deid` loop also loads the parser of its own format, so
`hl7DeidLoop` needs `@cosyte/deid` and `@cosyte/hl7`. A parser that is missing throws
`SYNTH_PEER_NOT_INSTALLED` on first use, except under Bun in a project with no `node_modules` folder,
where Bun downloads and loads it instead
([Troubleshooting](https://docs.cosyte.com/synth/troubleshooting#a-parser-is-not-installed)). The
package core has **zero third-party runtime dependencies**.

## Usage

Every value below is synthetic by construction. The full reference, with a guide per format, is
on [docs.cosyte.com/synth](https://docs.cosyte.com/synth).

### Generate a spec-clean HL7 v2 message

The HL7 v2 set covers `ADT` (`A01`/`A02`/`A03`/`A04`/`A08`/`A11`/`A13`/`A28`/`A31`), `ORU^R01`,
`ORM^O01`, `SIU^S12`, `VXU^V04`, `MDM^T02`, `DFT^P03`, `OML^O21`, and an `ACK` for any of them:
each built through `@cosyte/hl7`'s `buildMessage`, so it is spec-clean by construction. Every
message is stamped HL7 v2.5.

```ts
import { generateAdt, generateOru, generateHl7, hl7Corpus, roundTrip } from "@cosyte/synth/hl7";

// Same seed → byte-identical message, on any machine, any run.
const adt = generateAdt({ seed: 12345, trigger: "A01" });
const oru = generateOru({ seed: 12345 });

// Spec-clean by construction: it round-trips through @cosyte/hl7 with zero warnings.
console.log(roundTrip(adt).specClean); // true
console.log(roundTrip(oru).specClean); // true

// Or generate a reproducible mixed corpus across every family:
const corpus = hl7Corpus({ seed: 42, count: 7 }); // one of each family, cycled
console.log(corpus.artifacts.every((a) => a.warnings.length === 0)); // true, all spec-clean

// Dispatch by kind when the message type is data:
console.log(roundTrip(generateHl7("VXU^V04", 12345)).content.split("\r")[0]); // its MSH segment
```

### Generate a spec-clean FHIR R4 / US Core resource

The `@cosyte/synth/fhir` subpath builds resources **through `@cosyte/fhir`'s model constructors**, so
they are spec-clean by construction: validating under `validateResource` and, against the **real US
Core 6.1.0 profiles** (bring your own `StructureDefinition`s, none is bundled), conformant to US Core.
The clinical set covers `Patient` (base + US Core), `Condition`, `Observation` (US Core Laboratory
Result + Vital Signs), `MedicationRequest`, `Encounter`, `DiagnosticReport`, `Immunization`,
`AllergyIntolerance`, `Procedure`, and `Provenance`, assembled into a `collection`, `transaction`, or
`document` `Bundle`.

A fixture can also be requested **by US Core 6.1.0 profile name**. `usCoreCoverage()` reports one
entry for every profile the guide publishes, with its canonical URL and whether this build generates
it; `generateUsCoreProfile()` returns an artifact for a covered profile and otherwise refuses before
generating anything. See [what it does and does not do](./docs-content/limitations.md).

```ts
import { generatePatient, generateBundle, fhirCorpus, roundTrip } from "@cosyte/synth/fhir";

// A US Core Patient: same seed → byte-identical resource, anywhere.
const patient = generatePatient({ seed: 12345, profile: "us-core" });

// Spec-clean by construction: it round-trips through @cosyte/fhir with zero errors, byte-stable.
roundTrip(patient).specClean; // true

// A self-contained Bundle assembling a patient + its clinical spine, wired by urn:uuid references:
const bundle = generateBundle({ seed: 42, type: "transaction" });

// Or a reproducible mixed corpus across the whole spine:
const corpus = fhirCorpus({ seed: 2026, count: 6 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true, all spec-clean
```

`@cosyte/fhir` is an **optional peer dependency**, needed only for the `@cosyte/synth/fhir` subpath.

### Generate a spec-clean C-CDA document

The `@cosyte/synth/ccda` subpath builds Consolidated CDA R2.1 documents **through `@cosyte/ccda`'s
`buildCcda`**, so template IDs, LOINC section codes, and structured/narrative agreement are the
builder's own: the document round-trips through `parseCcda` with **zero warnings**. It emits a
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
corpus.artifacts.every((a) => a.warnings.length === 0); // true, all spec-clean
```

`@cosyte/ccda` is an **optional peer dependency**, needed only for the `@cosyte/synth/ccda` subpath.

### Generate an X12 transaction

The `@cosyte/synth/x12` subpath builds HIPAA **005010** transactions **through `@cosyte/x12`'s domain
builders** (`build837P/I/D`, `build835`, `build271`), so the ISA/GS/ST…SE/GE/IEA envelope, the
computed HL spine, the control numbers, and every segment are the builder's own: each transaction
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
roundTrip(claim).specClean; // true, re-parses through @cosyte/x12 with zero warnings, byte-stable
roundTrip(generate835({ seed: 7 })).specClean; // true
roundTrip(generate271({ seed: 3 })).specClean; // true

// Or a reproducible mixed corpus (837P/I/D + 835 + 271):
const corpus = x12Corpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true
```

`@cosyte/x12` is an **optional peer dependency**, needed only for the `@cosyte/synth/x12` subpath.

**Deferred:** the **270** eligibility _request_ (`@cosyte/x12` ships `build270` on its 0.1 line, but `synth`
does not generate a 270 yet) and **vendor-quirk mode**.

### Generate an NCPDP message

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
scriptRoundTrip(generateNewRx({ seed: 12345 })).specClean; // true, zero warnings, byte-stable
telecomRoundTrip(generateB1({ seed: 777 })).specClean; // true

// Or a reproducible mixed corpus (NewRx + RxRenewal + RxChange + B1 + B2 + B3):
const corpus = ncpdpCorpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true
```

`@cosyte/ncpdp` is an **optional peer dependency**, needed only for the `@cosyte/synth/ncpdp` subpath.

**Deferred:** vendor-quirk mode. SCRIPT coverage tracks the parser's builder surface: the
renewal/change _responses_ land as `@cosyte/ncpdp` grows builders.

### Generate an ASTM message

The `@cosyte/synth/astm` subpath builds ASTM laboratory messages **through `@cosyte/astm`'s own emit
surface**: `buildAstmMessage` for the E1394 record layer, `composeAstmFrames` for the E1381 frame
layer, so each message round-trips through the parser with **zero warnings**. It emits the
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
// practice- and laboratory-assigned patient ids, all synthetic-by-construction: names from the shipped
// fake-name pool, DOB seeded, and the two ids minted independently under a synthetic assigning authority
// (so they stay DISTINCT, exactly as @cosyte/astm keeps them on parse).
astmRoundTrip(generateAstmResult({ seed: 12345 })).specClean; // true, zero warnings, byte-stable

// The E1381-framed twin: the modulo-256 checksum and 0 to 7 frame numbers are computed by @cosyte/astm.
astmFramedRoundTrip(generateAstmResultFramed({ seed: 12345 })).specClean; // true

// Or a reproducible mixed corpus (a result report + an order):
const corpus = astmCorpus({ seed: 42 });
corpus.artifacts.every((a) => a.warnings.length === 0); // true
```

`@cosyte/astm` is an **optional peer dependency**, needed only for the `@cosyte/synth/astm` subpath.

### Generate a vendor-quirk fixture

Spec-clean fixtures test that a parser reads a _correct_ message; **quirk mode** tests that it tolerates
the realistic vendor deviations real traffic carries, and surfaces exactly the right diagnostic. The
quirk vocabulary **is the parsers' own profile systems**: a quirk deviates the message _structure_ so it
round-trips to **exactly one intended, stable warning code** (the **intended-warning contract**), and
where a built-in **public** parser profile claims the deviation, it round-trips cleanly under it
(suppressed, or re-badged to `PROFILE_QUIRK_APPLIED`). A quirk never introduces a real-looking value:
it changes shape, never provenance, so the synthetic-safety gate still passes.

Quirks ship for the three richest profile systems, **HL7 v2, C-CDA, and ASTM**:

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
diagnostic, never a silently-wrong fixture, and so do the other selectors: a message kind, a
document type, a corpus mix entry, an `837` variant, a Bundle type. Each is checked against its own set
before anything is generated, so an unrecognized one is a fatal `SYNTH_UNSUPPORTED_KIND` rather than a
mislabelled corpus. Every refusal carries a code and a fixed message from a frozen table, and quotes
nothing you passed. Every quirk is grounded in a **publicly-documented** deviation or a parser's
**public** profile, never a private vendor corpus.

**Deferred:** quirk recipes for **FHIR, X12, and NCPDP**, and any quirk that would need a **private,
vendor-attributed corpus** to ground.

### Co-validate with `@cosyte/deid` (the pairing loop)

The `@cosyte/synth/deid` subpath is a deterministic **closed-loop co-validation harness** for the
`synth` ⇄ `deid` pair: it **generates** an artifact, **plants** distinctive synthetic PHI
sentinels at the patient loci, **de-identifies** it through `@cosyte/deid`, and **verifies** every
sentinel is gone from the output (a surviving sentinel is a hard failure) while the clinical payload
survives (the over-scrub guard).

```ts
import {
  hl7DeidLoop,
  fhirDeidLoop,
  x12DeidLoop,
  ncpdpTelecomDeidLoop,
  ccdaDeidLoop,
  summarizeDeidCoverage,
} from "@cosyte/synth/deid";

const r = hl7DeidLoop({ seed: 42, kind: "ORU^R01" });
r.pass; // true
r.survivors; // [], every planted synthetic PHI sentinel was removed
r.clinicalScrubbed; // [], no clinical value was over-scrubbed

const summary = summarizeDeidCoverage([
  hl7DeidLoop({ seed: 1 }),
  fhirDeidLoop({ seed: 1 }),
  x12DeidLoop({ seed: 1, variant: "837P" }),
  ncpdpTelecomDeidLoop({ seed: 1, transaction: "B1" }),
  ccdaDeidLoop({ seed: 1 }),
]);
summary.allPass; // true, zero survivors, zero over-scrub, per format
```

This is a **co-validation harness, not an independent audit** of `@cosyte/deid` against real-world
data: it proves the pair works on `synth`'s own output. The removal check is **locus-scoped**: it
sweeps only the de-identified values remaining at the former PHI loci, so provider/organization
identity a de-identifier legitimately retains never reads as a false survivor. `@cosyte/deid` is an
**optional peer dependency**, needed only for this subpath. **Skipped and named** (`DEID_LOOP_SKIPPED`):
NCPDP **SCRIPT** and **ASTM** (no `@cosyte/deid` adapter) and **DICOM** (not generated by `synth`).

### Draw a synthetic value

```ts
import { createRng, safe, isSyntheticSsn, isItinFormatted, isSyntheticNpi } from "@cosyte/synth";

const rng = createRng(42);
const nationalId = safe.ssn(rng);
isSyntheticSsn(nationalId); // true, always an SSA never-issued SSN
isItinFormatted(nationalId); // false, never a validly formatted IRS ITIN either
isSyntheticNpi(safe.npi(rng)); // true, always a deliberately-invalid-Luhn NPI (never a real NPI)
```

## What makes it trustworthy

- **Synthetic-by-construction**, no code path emits a value not drawn from a reserved range or the
  shipped fake-name pool (SSA never-issued SSNs that are not IRS ITINs either, NANP `555-01xx`
  phones, RFC 2606/6761 `example.*` domains, RFC 5737/3849 TEST-NET IPs, a synthetic assigning
  authority for MRNs). A CI gate proves it.
  **No generated value can be real or plausibly-real PHI.**
- **Checked by the parser's own judgment**, built through the parser's conservative serializer and
  fed straight back in: each artifact re-parses with zero warnings.
- **Deterministic**, a hand-rolled seeded PRNG (`sfc32`/`splitmix32`); `Math.random` is lint-banned.
  A seed determines the output, byte for byte, on the same parser versions, and CI compares those
  bytes across Node 22, 24, and 26.
- **Immutable**, generated artifacts and the `Corpus` result are deep-frozen.
- **Zero third-party runtime dependencies**, the parser peers are first-party Cosyte packages,
  installed from npm for the tests; dual ESM + CJS, validated with `attw`.

## Documentation

The full reference is on [docs.cosyte.com/synth](https://docs.cosyte.com/synth):

- [Installation](https://docs.cosyte.com/synth/installation), the [quickstart](https://docs.cosyte.com/synth/quickstart), and
  a tutorial per format: test your [HL7 v2](https://docs.cosyte.com/synth/test-hl7-handling-with-fixtures),
  [FHIR](https://docs.cosyte.com/synth/test-fhir-handling-with-fixtures), [C-CDA](https://docs.cosyte.com/synth/test-ccda-handling-with-fixtures),
  [X12](https://docs.cosyte.com/synth/test-x12-handling-with-fixtures), [NCPDP](https://docs.cosyte.com/synth/test-ncpdp-handling-with-fixtures),
  and [ASTM](https://docs.cosyte.com/synth/test-astm-handling-with-fixtures) handling with generated fixtures.
- How-to guides: [HL7 v2](https://docs.cosyte.com/synth/guides-hl7), [FHIR R4 and US Core](https://docs.cosyte.com/synth/guides-fhir),
  [C-CDA](https://docs.cosyte.com/synth/guides-ccda), [X12](https://docs.cosyte.com/synth/guides-x12), [NCPDP](https://docs.cosyte.com/synth/guides-ncpdp),
  [ASTM](https://docs.cosyte.com/synth/guides-astm), [vendor quirks](https://docs.cosyte.com/synth/guides-quirks),
  [the `@cosyte/deid` pairing loop](https://docs.cosyte.com/synth/guides-deid), [synthetic values](https://docs.cosyte.com/synth/draw-synthetic-values),
  and [pinning a golden fixture](https://docs.cosyte.com/synth/pin-a-golden-fixture).
- Explanation: [how it works](https://docs.cosyte.com/synth/concepts-archetype), [why the removal check reads only the patient fields](https://docs.cosyte.com/synth/why-deid-checks-patient-fields),
  and [Synthea, faker and other generators](https://docs.cosyte.com/synth/synthea-faker-and-other-generators).
- Reference: [generator options, kinds and profiles](https://docs.cosyte.com/synth/generator-options), [fatal codes](https://docs.cosyte.com/synth/fatal-codes),
  the [quirk catalog](https://docs.cosyte.com/synth/quirk-catalog), the [glossary](https://docs.cosyte.com/synth/glossary), [what it does and does not do](https://docs.cosyte.com/synth/limitations), and the
  [API reference](https://github.com/cosyte/synth/blob/main/docs-content/api/README.md), generated from the source.
- [Troubleshooting](https://docs.cosyte.com/synth/troubleshooting), [testing and quality](https://docs.cosyte.com/synth/testing-and-quality), and [performance](https://docs.cosyte.com/synth/performance).
- [`CHANGELOG.md`](https://github.com/cosyte/synth/blob/main/CHANGELOG.md): every release.

## Support

Questions, bug reports, and requests for a format or a quirk go in
[GitHub issues](https://github.com/cosyte/synth/issues). Every fixture this package makes is
synthetic: never attach a real patient's data to an issue. Need an integration built and tested, or
hosted and run for you? See our [integration services](https://cosyte.com/integration-services).

## Security

Report a vulnerability privately, never in a public issue, and with no real patient data in it. Our
[security policy](https://github.com/cosyte/synth/security/policy) says how. A generated value that
is real, or realistic enough to pass for real, is a vulnerability: report it that way.

## Contributing

**Where to ask:** open an issue at
[https://github.com/cosyte/synth/issues](https://github.com/cosyte/synth/issues). A report is most
useful with the seed, the generator call, and the parser warnings you got back.

**Unsolicited pull requests are accepted.** For anything that changes the bytes a seed produces, adds
a generator option, or moves the public API, open an issue first so the behavior can be agreed
before you write it: a seed that maps to different bytes breaks every golden file built on it.
Typo, link, and test fixes can go straight to a pull request.

**What a contribution has to clear**, every one of them a script this package declares:

| check                         | what it is                                            |
| ----------------------------- | ----------------------------------------------------- |
| `pnpm typecheck`              | `tsc --noEmit`, strict (the examples: in `pnpm test`) |
| `pnpm lint`                   | ESLint, at `--max-warnings=0`                         |
| `pnpm format:check`           | Prettier                                              |
| `pnpm phi-scan`               | no patient-shaped value anywhere in a tracked file    |
| `pnpm test`                   | Vitest, including the synthetic-safety suites         |
| `pnpm test:coverage`          | the coverage gate                                     |
| `pnpm build`                  | the dual ESM and CJS bundle                           |
| `pnpm attw`                   | per-condition type resolution for consumers           |
| `pnpm run determinism:digest` | the bytes each seed produces, against the baseline    |
| `pnpm check:no-emdash`        | the house punctuation rule                            |
| `pnpm check:no-internal-refs` | no internal bookkeeping on the public surface         |

New behavior needs a test beside it, and a change a consumer would notice needs a changeset
(`pnpm changeset`), whose summary becomes the changelog entry. A change to the bytes a seed produces
says so in its changeset.

## License

MIT, copyright Cosyte LLC. See [LICENSE](https://github.com/cosyte/synth/blob/main/LICENSE). The
standards this package names belong to their owners; see
[TRADEMARKS.md](https://github.com/cosyte/synth/blob/main/TRADEMARKS.md).
