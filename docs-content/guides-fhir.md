---
id: guides-fhir
title: FHIR R4 / US Core
sidebar_position: 3
---

# Generate FHIR R4 / US Core resources

The `@cosyte/synth/fhir` subpath builds FHIR resources **through `@cosyte/fhir`'s own model
constructors and serializer**, so every resource is **spec-clean by construction** — it validates under
`@cosyte/fhir.validateResource` and re-serializes byte-for-byte. `@cosyte/fhir` is an **optional peer
dependency**, needed only for this subpath.

The FHIR surface covers the **US Core clinical set**: `Patient` (base + US Core), `Condition`
(problem-list item), `Observation` (US Core Laboratory Result + Vital Signs), `MedicationRequest`,
`Encounter`, `DiagnosticReport` (Laboratory), `Immunization`, `AllergyIntolerance`, and `Procedure`,
assembled into a `collection`, `transaction`, or `document` `Bundle`.

## A US Core Patient, spec-clean by construction

```ts runnable
import { generatePatient, roundTrip } from "@cosyte/synth/fhir";

// Same seed → byte-identical resource, on any machine, any run.
const patient = generatePatient({ seed: 12345, profile: "us-core" });

// Fed straight back into @cosyte/fhir: validates with zero errors and re-serializes byte-identically.
const result = roundTrip(patient);
result.specClean; // => true
```

Every identity field — name, MRN, birth date, phone, email, address — is drawn from a
guaranteed-non-colliding synthetic source, so **no generated value can be real or plausibly-real PHI**.

## The clinical spine, wired to a patient

Each clinical generator takes a `subject` reference (and, for `MedicationRequest`, a `requester`):

```ts runnable
import { generateCondition, generateObservationLab, roundTrip } from "@cosyte/synth/fhir";

const condition = generateCondition({ seed: 7, subject: "Patient/syn-patient-1" });
const lab = generateObservationLab({ seed: 8, subject: "Patient/syn-patient-1" });

roundTrip(condition).errors; // => []
roundTrip(lab).errors; // => []
```

## Validating against US Core (bring your own profile)

`@cosyte/synth` bundles **no** US Core IG — matching `@cosyte/fhir`'s content-free posture. To assert US
Core conformance, load the published US Core `StructureDefinition`s yourself and pass them to
`roundTrip`:

```ts
import { generatePatient, roundTrip } from "@cosyte/synth/fhir";
import { loadStructureDefinition, parseResource } from "@cosyte/fhir";
import { readFileSync } from "node:fs";

const { resource } = parseResource(readFileSync("us-core-patient.json", "utf8"));
const usCorePatient = loadStructureDefinition(resource);

const result = roundTrip(generatePatient({ seed: 1, profile: "us-core" }), {
  profiles: usCorePatient ? [usCorePatient] : [],
});
result.errors; // [] — conformant to the real US Core 6.1.0 Patient profile
```

## The rest of the clinical set

`Encounter`, `DiagnosticReport`, `Immunization`, `AllergyIntolerance`, and `Procedure` follow the same
shape — a `subject`/`patient` reference and a US Core `meta.profile` by default:

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

## A self-contained Bundle

`generateBundle` assembles a `Patient` and its full clinical spine into a `collection`, `transaction`,
or `document` Bundle, wired by `urn:uuid:` references so **every reference resolves in-bundle**. A
`document` Bundle leads with the FHIR-mandated `Composition` and carries the required `identifier` and
`timestamp`:

```ts runnable
import { generateBundle, fhirCorpus } from "@cosyte/synth/fhir";

const doc = generateBundle({ seed: 42, type: "document" });
doc.properties.some((p) => p.name === "entry"); // => true

// Or a reproducible mixed corpus across the whole clinical set:
const corpus = fhirCorpus({ seed: 2026, count: 11 });
corpus.artifacts.length; // => 11
```

## Next

- [Core Concepts](./concepts-archetype) — synthetic-by-construction, determinism, the round-trip gate.
- **API Reference** — every export, generated from source.
