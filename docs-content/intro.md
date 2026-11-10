---
id: intro
title: "@cosyte/synth"
sidebar_label: Overview
description: "What @cosyte/synth is: seeded, reproducible synthetic healthcare fixtures in six formats, built through each parser's own builder and never real PHI."
---

# @cosyte/synth

`@cosyte/synth` generates synthetic healthcare test fixtures for Node.js and TypeScript: HL7 v2,
FHIR R4 and US Core, C-CDA, X12, NCPDP, and ASTM. A seed decides every byte, so a fixture set
regenerates the same way on any machine, and every name, identifier, date, phone number, and
address comes from a reserved range or a shipped pool of invented names, so no fixture holds a real
person's data.

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

// The same seed gives the same message, on any machine and any run.
const message = generateAdt({ seed: 12345, trigger: "A01" });

// It reads back through @cosyte/hl7 with no warnings.
roundTrip(message).specClean; // => true
```

## Who it is for

- Teams that test an HL7 v2, FHIR, C-CDA, X12, NCPDP, or ASTM integration and cannot put patient
  data in a repository, a CI log, or a bug report.
- Parser and interface authors who want golden files that stay stable, plus fixtures that carry a
  known vendor deviation and the exact warning it should raise.
- Anyone checking a de-identifier: the `@cosyte/synth/deid` subpath plants synthetic identifiers,
  runs `@cosyte/deid`, and reports anything left behind.

## How it works, in short

- **Built through the parser.** Each format is built by its sibling Cosyte parser's own builder or
  serializer (`@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`, `@cosyte/x12`, `@cosyte/ncpdp`,
  `@cosyte/astm`), and the round-trip helpers feed the output back to that parser. We never write
  wire bytes by hand.
- **Synthetic by construction.** No code path emits a value from anywhere but a reserved range or
  the invented-name pool. [What it does and does not do](./limitations.md#the-synthetic-safety-posture-the-floors)
  names the source for each kind of value.
- **Deterministic.** A seeded generator (`sfc32`, seeded by `splitmix32`) drives every choice;
  nothing reads the clock or `Math.random`.
- **No third-party runtime dependencies.** The parsers are optional peer dependencies, one per
  subpath, and the package root loads none of them.

[How it works](./concepts-archetype.md) explains each of these in more depth.

## What it is not

- **Not a clinical simulator.** It does not model disease or a patient's history; a generated lab
  result pairs a code and a value with no claim that they make clinical sense. Synthea is the tool
  for clinically coherent records.
- **Not a parser.** It generates; the `@cosyte/*` parsers read.
- **Not a source of real-world distributions.** A generated set is not representative of any
  population.
- **No bundled terminology.** Codes come from a small example pool, never a full LOINC, SNOMED CT,
  or CPT table.

[What it does and does not do](./limitations.md) is the full list.

## Status

The 0.1 line, published to npm. The npm package page shows the version that is live; this page
never repeats it.

## Where to go next

- [Installation](./installation.md): which packages to install for the formats you need.
- [Quickstart](./quickstart.md): a first message, a synthetic value, and a reproducible corpus.
- [Test your HL7 handling with generated fixtures](./test-hl7-handling-with-fixtures.md): a
  tutorial from a single message to a fixture with a vendor deviation.
- The how-to guides, one per format, starting with [Generate HL7 v2 messages](./guides-hl7.md).
