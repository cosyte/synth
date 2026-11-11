---
id: test-fhir-handling-with-fixtures
title: Test your FHIR handling with generated fixtures
sidebar_label: Test FHIR handling
description: "A tutorial: write a small FHIR R4 reader, test it with a generated US Core Patient, every resource kind, a document Bundle, and a pinned seed."
---

# Test your FHIR handling with generated fixtures

In this tutorial we write a small piece of code that reads FHIR R4 resources and test it with
fixtures from `@cosyte/synth`. We start from one generated US Core Patient and end with a document
Bundle whose references we check. Every resource is synthetic, so the tests can live in a public
repository and print their input to a CI log.

You need `@cosyte/synth` and `@cosyte/fhir` installed ([Installation](./installation.md)). Each
step is a complete program you can run on its own.

## 1. Write the code under test

The code under test takes the JSON text a server would send and reads three things from a Patient:
its family name, its medical record number, and the system that number belongs to. Feed it a
generated US Core Patient, serialized by `@cosyte/fhir`:

```ts runnable
import { serializeResource } from "@cosyte/fhir";
import { generatePatient } from "@cosyte/synth/fhir";

interface PatientJson {
  resourceType: string;
  name?: { family?: string }[];
  identifier?: { system?: string; value?: string }[];
}

function summarizePatient(json: string) {
  const patient = JSON.parse(json) as PatientJson;
  return {
    resourceType: patient.resourceType,
    family: patient.name?.[0]?.family,
    mrnSystem: patient.identifier?.[0]?.system,
    hasMrn: (patient.identifier?.[0]?.value ?? "") !== "",
  };
}

const json = serializeResource(generatePatient({ seed: 12345, profile: "us-core" }));
const summary = summarizePatient(json);

summary.resourceType; // => "Patient"
summary.hasMrn; // => true
```

`generatePatient` returns `@cosyte/fhir`'s resource model; `serializeResource` gives the JSON text
your code would receive.

## 2. Check what the fixture carries

A generated value is not a value you typed, so assert on its kind rather than its spelling. The
family name comes from the shipped pool of invented names, the record number sits under the
synthetic assigning authority's OID, and the resource is labelled as test data:

```ts runnable
import { serializeResource } from "@cosyte/fhir";
import { SYNTHETIC_ASSIGNING_AUTHORITY, SYNTHETIC_FAMILY_NAMES } from "@cosyte/synth";
import { generatePatient } from "@cosyte/synth/fhir";

const patient = JSON.parse(serializeResource(generatePatient({ seed: 12345, profile: "us-core" })));

SYNTHETIC_FAMILY_NAMES.includes(patient.name[0].family); // => true
patient.identifier[0].system === `urn:oid:${SYNTHETIC_ASSIGNING_AUTHORITY.universalId}`; // => true
patient.meta.security[0].code; // => "HTEST"
```

`HTEST` is the security label for test health data. A server that honors security labels can tell
the fixture from a real record.

## 3. Run every resource kind through a reader

Real feeds send more than Patients. Say the code under test routes each resource by its
`resourceType`. `fhirCorpus` cycles through the kinds it generates, and with a count of 11 you get
one of each in its default mix, each artifact's `kind` saying which:

```ts runnable
import { fhirCorpus } from "@cosyte/synth/fhir";

function resourceTypeOf(json: string): string {
  return (JSON.parse(json) as { resourceType: string }).resourceType;
}

const corpus = fhirCorpus({ seed: 42, count: 11 });
const routed = corpus.artifacts.map((artifact) => resourceTypeOf(artifact.content));

routed; // => ["Patient", "Condition", "Observation", "Observation", "MedicationRequest", "Encounter", "Immunization", "AllergyIntolerance", "Procedure", "DiagnosticReport", "Bundle"]
corpus.artifacts.every((artifact) => artifact.warnings.length === 0); // => true
```

The two `Observation`s are a laboratory result and a vital sign, and the last artifact is a
`collection` Bundle.

## 4. Check the references in a document Bundle

A document Bundle is a set of resources that point at each other. Here the code under test lists
every reference in a Bundle that no entry in it resolves. In a `document` Bundle from
`generateBundle`, every reference is a `urn:uuid:` that an entry's `fullUrl` carries, so the list is
empty:

```ts runnable
import { serializeResource } from "@cosyte/fhir";
import { generateBundle } from "@cosyte/synth/fhir";

interface BundleJson {
  entry?: { fullUrl?: string; resource?: unknown }[];
}

function unresolvedReferences(json: string): string[] {
  const bundle = JSON.parse(json) as BundleJson;
  const entries = bundle.entry ?? [];
  const known = new Set(entries.map((entry) => entry.fullUrl));
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node !== null && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key === "reference" && typeof value === "string" && !known.has(value)) found.push(value);
        walk(value);
      }
    }
  };
  entries.forEach((entry) => walk(entry.resource));
  return found;
}

const json = serializeResource(generateBundle({ seed: 42, type: "document" }));
const bundle = JSON.parse(json);

bundle.entry[0].resource.resourceType; // => "Composition"
unresolvedReferences(json); // => []
```

FHIR requires a document Bundle to start with its `Composition`, and the generator puts it there.

## 5. Pin the seed

A test that regenerates its fixture from a seed needs no fixture file, and its input does not change
between runs, because the same seed gives the same bytes:

```ts runnable
import { serializeResource } from "@cosyte/fhir";
import { generateBundle } from "@cosyte/synth/fhir";

const first = serializeResource(generateBundle({ seed: 42, type: "document" }));
const again = serializeResource(generateBundle({ seed: 42, type: "document" }));

first === again; // => true
```

The bytes come from `@cosyte/fhir`'s serializer, so pin the versions of `@cosyte/synth` and
`@cosyte/fhir` in your lockfile as well as the seed.

## What you built

A reader for FHIR R4 JSON, tested against a US Core Patient, one resource of every kind, and a
document Bundle whose references all resolve, each regenerated from a seed. None of it holds patient
data.

## Where to go next

- [Generate FHIR R4 and US Core resources](./guides-fhir.md): every generator, the Bundle types, and
  validation against the US Core profiles.
- [Generator options, kinds and profiles](./generator-options.md): every option and every kind a
  corpus accepts.
- [Pin a golden fixture](./guides-overview.md): write a corpus to disk and check it later.
