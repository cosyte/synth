---
id: guides-fhir
title: Generate FHIR R4 and US Core resources
sidebar_label: FHIR R4 and US Core
description: "Generate FHIR R4 and US Core resources and Bundles through @cosyte/fhir, ask for one by US Core profile name, and validate against the published profiles."
---

# Generate FHIR R4 and US Core resources

The `@cosyte/synth/fhir` subpath builds FHIR R4 resources through `@cosyte/fhir`'s own model and
serializer. Install `@cosyte/fhir` alongside it ([Installation](./installation.md)).

It covers this clinical set: `Patient` (base or US Core), `Condition` (a problem-list item),
`Observation` (US Core Laboratory Result and Vital Signs), `MedicationRequest`, `Encounter`,
`DiagnosticReport` (Laboratory), `Immunization`, `AllergyIntolerance`, `Procedure`, and
`Provenance`, and it assembles them into a `collection`, `transaction`, or `document` Bundle.
Each generator returns `@cosyte/fhir`'s resource model.

## Generate a US Core Patient

```ts runnable
import { generatePatient, roundTrip } from "@cosyte/synth/fhir";

// The same seed gives the same resource, on any machine and any run.
const patient = generatePatient({ seed: 12345, profile: "us-core" });

// Serialized, parsed, and validated by @cosyte/fhir: no errors, and the same bytes again.
const result = roundTrip(patient);
result.errors; // => []
result.specClean; // => true
```

`roundTrip` serializes the resource, parses it, validates it in strict mode, and serializes it again.
`specClean` is true when validation passes and the bytes match. Every identity field (name, medical
record number, birth date, phone, email, address) comes from a synthetic source; see
[What it does and does not do](./limitations.md#the-synthetic-safety-posture-the-floors).

## Generate clinical resources for a patient

Each clinical generator takes a `subject` reference (and, for `MedicationRequest`, a `requester`):

```ts runnable
import { generateCondition, generateObservationLab, roundTrip } from "@cosyte/synth/fhir";

const condition = generateCondition({ seed: 7, subject: "Patient/syn-patient-1" });
const lab = generateObservationLab({ seed: 8, subject: "Patient/syn-patient-1" });

roundTrip(condition).errors; // => []
roundTrip(lab).errors; // => []
```

## Validate against the US Core profiles

`@cosyte/synth` bundles no US Core implementation guide, and neither does `@cosyte/fhir`. To check
US Core conformance, download the US Core 6.1.0 `StructureDefinition`s from the published guide,
load the ones you need, and pass them to `roundTrip`:

```ts no-run it reads a StructureDefinition file you download from the US Core guide
import { generatePatient, roundTrip } from "@cosyte/synth/fhir";
import { loadStructureDefinition, parseResource } from "@cosyte/fhir";
import { readFileSync } from "node:fs";

const { resource } = parseResource(readFileSync("us-core-patient.json", "utf8"));
const usCorePatient = loadStructureDefinition(resource);

const result = roundTrip(generatePatient({ seed: 1, profile: "us-core" }), {
  profiles: usCorePatient ? [usCorePatient] : [],
});
result.errors; // [] against the US Core 6.1.0 Patient profile
```

Our test suite runs this check for each of the 11 profiles we generate, against the US Core 6.1.0
`StructureDefinition`s committed in the repository.

## Generate the rest of the clinical set

`Encounter`, `DiagnosticReport`, `Immunization`, `AllergyIntolerance`, and `Procedure` follow the same
shape: a `subject` or `patient` reference, and a US Core `meta.profile` by default:

```ts runnable
import {
  generateEncounter,
  generateImmunization,
  generateAllergyIntolerance,
  generateProcedure,
  generateDiagnosticReport,
  roundTrip,
} from "@cosyte/synth/fhir";

const p = "Patient/syn-patient-1";
roundTrip(generateEncounter({ seed: 11, subject: p })).errors; // => []
roundTrip(generateImmunization({ seed: 12, patient: p })).errors; // => []
roundTrip(generateAllergyIntolerance({ seed: 13, patient: p })).errors; // => []
roundTrip(generateProcedure({ seed: 14, subject: p })).errors; // => []
roundTrip(generateDiagnosticReport({ seed: 15, subject: p })).errors; // => []
```

`Provenance` records who authored and transmitted a resource. It follows the same shape, with a
`target` reference instead of a subject:

```ts runnable
import { generateProvenance, roundTrip } from "@cosyte/synth/fhir";

const provenance = generateProvenance({ seed: 16, target: "Patient/syn-patient-1" });
roundTrip(provenance).errors; // => []
```

## Ask for a resource by US Core profile name

A generator name is this library's vocabulary; a US Core 6.1.0 profile name is the guide's.
`generateUsCoreProfile` takes the profile name and checks it against the profiles the guide
publishes before it generates anything, so a name it cannot honor is a refusal, never a mislabelled
resource. `usCoreCoverage` lists that set: one entry per profile, with its canonical URL and whether
this build generates it.

```ts runnable
import { usCoreCoverage, generateUsCoreProfile, roundTrip } from "@cosyte/synth/fhir";

usCoreCoverage().length; // => 49
usCoreCoverage().filter((entry) => entry.generated).length; // => 11

const patient = generateUsCoreProfile({ profile: "us-core-patient", seed: 12345 });
roundTrip(patient).specClean; // => true
```

A profile the guide publishes and we do not generate throws
[`SYNTH_PROFILE_NOT_GENERATED`](./fatal-codes.md#synth_profile_not_generated); a name the guide does
not publish throws [`SYNTH_UNSUPPORTED_KIND`](./fatal-codes.md#synth_unsupported_kind).
[US Core 6.1.0 profile coverage](./limitations.md#us-core-610-profile-coverage) lists the profiles
we generate.

## Generate a Bundle

`generateBundle` assembles a `Patient` and its clinical resources into a `collection`,
`transaction`, or `document` Bundle, linked by `urn:uuid:` references so every reference resolves
inside the Bundle. A `document` Bundle starts with the `Composition` FHIR requires and carries the
required `identifier` and `timestamp`:

```ts runnable
import { generateBundle, fhirCorpus } from "@cosyte/synth/fhir";

const doc = generateBundle({ seed: 42, type: "document" });
doc.properties.some((p) => p.name === "entry"); // => true

// Or a corpus across the clinical set, one resource kind after another:
const corpus = fhirCorpus({ seed: 2026, count: 11 });
corpus.artifacts.length; // => 11
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

## Independent validation

The FHIR output is the one format a validator we did not write also checks: on every pull request,
the HL7 FHIR validator grades a seeded corpus against US Core 6.1.0.
[Who checks the output](./limitations.md#who-checks-the-output-and-who-does-not) says what that
covers and what it leaves out.

## Related

- Reference: [`generatePatient`](./api/src/fhir.md#generatepatient),
  [`generateBundle`](./api/src/fhir.md#generatebundle),
  [`generateUsCoreProfile`](./api/src/fhir.md#generateuscoreprofile),
  [`usCoreCoverage`](./api/src/fhir.md#uscorecoverage), [`roundTrip`](./api/src/fhir.md#roundtrip),
  and [`fhirCorpus`](./api/src/fhir.md#fhircorpus).
- [How it works](./concepts-archetype.md): why a round trip is the check, and what it cannot see.
