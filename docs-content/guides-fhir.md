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

Phase 3 ships the **US Core clinical spine**: `Patient` (base + US Core), `Condition` (problem-list
item), `Observation` (US Core Laboratory Result + Vital Signs), `MedicationRequest`, and `Bundle`
(collection + transaction).

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

## A self-contained Bundle

`generateBundle` assembles a `Patient` and its clinical spine into a `collection` or `transaction`
Bundle, wired by `urn:uuid:` references so every `subject` resolves:

```ts runnable
import { generateBundle, fhirCorpus } from "@cosyte/synth/fhir";

const bundle = generateBundle({ seed: 42, type: "transaction" });
bundle.properties.some((p) => p.name === "entry"); // => true

// Or a reproducible mixed corpus across the whole spine:
const corpus = fhirCorpus({ seed: 2026, count: 6 });
corpus.artifacts.length; // => 6
```

## Next

- [Core Concepts](./concepts-archetype) — synthetic-by-construction, determinism, the round-trip gate.
- **API Reference** — every export, generated from source.
