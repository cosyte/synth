# @cosyte/synth

> Deterministic, seedable **synthetic healthcare-fixture generator** for Node.js and TypeScript —
> spec-clean by construction, and **never real PHI**.

`@cosyte/synth` generates reproducible synthetic test corpora across the cosyte formats (HL7 v2,
FHIR R4 / US Core, and C-CDA today; X12 / NCPDP / ASTM in later phases). It is a **consumer** of the
cosyte parsers, not a parser: it builds each artifact **through the parser's own builder/serializer**
(so the output is spec-clean by the same mechanism the parser proves) and draws every identifier, name,
date, phone, and address from a **guaranteed-non-colliding synthetic source**. It is a
**format/conformance generator, not a clinical simulator** — it does not model disease progression
(that is Synthea).

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. Phase 1 ships the seeded-PRNG core, the
> synthetic-safety providers, and the round-trip harness; Phase 2 the full HL7 v2 message set; Phase 3
> FHIR R4 / US Core (Patient + the clinical spine + Bundles); Phase 4 the rest of the US Core clinical
> set (`Encounter`, `DiagnosticReport`, `Immunization`, `AllergyIntolerance`, `Procedure`) and the
> `document` Bundle shape; **C-CDA generation** (CCD + Referral Note via `@cosyte/ccda`'s `buildCcda`).

## Install

```bash
npm install @cosyte/synth @cosyte/hl7 @cosyte/fhir @cosyte/ccda
```

`@cosyte/hl7`, `@cosyte/fhir`, and `@cosyte/ccda` are **optional peer dependencies**, each needed only
for its subpath (`@cosyte/synth/hl7`, `@cosyte/synth/fhir`, `@cosyte/synth/ccda`) — install only the
parsers whose fixtures you generate. The package core has **zero third-party runtime dependencies**.

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

## Draw a synthetic value

```ts
import { createRng, safe, isSyntheticSsn } from "@cosyte/synth";

const rng = createRng(42);
isSyntheticSsn(safe.ssn(rng)); // true — always an SSA never-issued SSN
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
