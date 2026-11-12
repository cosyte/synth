---
id: quickstart
title: Quickstart
sidebar_label: Quickstart
description: "Generate a spec-clean HL7 v2 message, draw a synthetic value, check the round trip yourself, and build a reproducible corpus."
---

# Quickstart

Generate a first message, draw a synthetic value, and build a fixture set you can regenerate. A
seed decides the output entirely, so the same call gives the same bytes anywhere. You need
`@cosyte/synth` and `@cosyte/hl7` installed; see [Installation](./installation.md).

## Generate a spec-clean HL7 v2 message

This is the program the README opens with. The `@cosyte/synth/hl7` subpath builds each message
through `@cosyte/hl7`'s own `buildMessage`, and `roundTrip` feeds it back to the parser:

```ts runnable
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

The first three lines print `true`, and the last prints the `MSH` segment of a generated `VXU^V04`.
Every identifier, name, and date in these messages comes from a reserved range or the shipped pool
of invented names.

## Draw a synthetic value

The `safe` providers each draw from a reserved source, and each takes the seeded generator
`createRng` returns, so the value depends only on the seed:

```ts runnable
import { createRng, safe, isSyntheticSsn } from "@cosyte/synth";

const rng = createRng(42);
const nationalId = safe.ssn(rng);

// The SSN always has a 900-series area, which SSA lists as invalid: it cannot be a real SSN.
isSyntheticSsn(nationalId); // => true
```

## Check the round trip yourself

`roundTrip` returns more than the verdict: it also returns the warning codes the parser raised on
the way back, which for a spec-clean message is none:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

const result = roundTrip(generateAdt({ seed: 7, trigger: "A08" }));

result.warnings; // => []
```

## Build a reproducible corpus

`hl7Corpus` returns a frozen `Corpus`: the seed, a manifest of what was generated, and the
artifacts. Pin the seed and every test that uses it gets the same fixtures:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const corpus = hl7Corpus({ seed: 2026, count: 3 });

corpus.artifacts.length; // => 3
```

## The same seed gives the same bytes

Regenerating from a seed gives byte-identical output, and the test suite holds every format to it:

```ts runnable
import { generateAdt } from "@cosyte/synth/hl7";

const a = generateAdt({ seed: 99 }).toString();
const b = generateAdt({ seed: 99 }).toString();

a === b; // => true
```

## Next

- A tutorial per format that takes these fixtures into a test of your own code:
  [HL7 v2](./test-hl7-handling-with-fixtures.md), [FHIR](./test-fhir-handling-with-fixtures.md),
  [C-CDA](./test-ccda-handling-with-fixtures.md), [X12](./test-x12-handling-with-fixtures.md),
  [NCPDP](./test-ncpdp-handling-with-fixtures.md), and [ASTM](./test-astm-handling-with-fixtures.md).
- How-to guides for each format: [HL7 v2](./guides-hl7.md), [FHIR R4 and US Core](./guides-fhir.md),
  [C-CDA](./guides-ccda.md), [X12](./guides-x12.md), [NCPDP](./guides-ncpdp.md), and
  [ASTM](./guides-astm.md).
- [Generate vendor-quirk fixtures](./guides-quirks.md) and
  [Pin a golden fixture](./pin-a-golden-fixture.md).
- [How it works](./concepts-archetype.md): why the output is synthetic, checked, and reproducible.
- [Generator options, kinds and profiles](./generator-options.md) and the [glossary](./glossary.md).
- The [API reference](./api/README.md), generated from the source.
