---
id: quickstart
title: Quickstart
sidebar_position: 1
---

# Quickstart

Generate reproducible, synthetic-by-construction fixtures in a few lines. A **seed** determines the
output entirely, so a fixture set regenerates identically anywhere.

## Generate a spec-clean HL7 v2 message

This is the program the README opens with. The `@cosyte/synth/hl7` subpath builds each message
**through `@cosyte/hl7`'s own `buildMessage`**, so it is spec-clean by construction, and `roundTrip`
feeds it straight back to the parser. `@cosyte/hl7` is the optional peer this subpath needs; see
[Installation](./installation.md):

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
Every identifier, name and date in these messages is drawn from a reserved range or the shipped
fake-name pool.

## Draw a synthetic value

The `safe` providers each draw from a reserved, never-collide source. Everything is a pure function of
an explicit seeded generator (`createRng`):

```ts runnable
import { createRng, safe, isSyntheticSsn } from "@cosyte/synth";

const rng = createRng(42);
const nationalId = safe.ssn(rng);

// The SSN is always drawn from the SSA never-issued space: it cannot be a real SSN.
isSyntheticSsn(nationalId); // => true
```

## Check the round trip yourself

`roundTrip` returns more than the verdict: the warnings the parser raised on the way back, which for
a spec-clean artifact is none at all:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

const result = roundTrip(generateAdt({ seed: 7, trigger: "A08" }));

result.warnings; // => []
```

## Build a reproducible corpus

`hl7Corpus` returns a deep-frozen, self-describing `Corpus`: a seed plus a manifest of what was
generated. Pin the seed and every downstream test gets a stable fixture set:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const corpus = hl7Corpus({ seed: 2026, count: 3 });

corpus.artifacts.length; // => 3
```

## Determinism is the contract

The same seed yields byte-identical output. This is a tested invariant, not a nicety:

```ts runnable
import { generateAdt } from "@cosyte/synth/hl7";

const a = generateAdt({ seed: 99 }).toString();
const b = generateAdt({ seed: 99 }).toString();

a === b; // => true
```

## Next

- [Core Concepts](./concepts-archetype): synthetic-by-construction, determinism, the round-trip gate.
- **API Reference**: every export, generated from source.
