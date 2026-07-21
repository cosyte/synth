---
id: quickstart
title: Quickstart
sidebar_position: 1
---

# Quickstart

Generate reproducible, synthetic-by-construction fixtures in a few lines. A **seed** determines the
output entirely, so a fixture set regenerates identically anywhere.

## Draw a synthetic value

The `safe` providers each draw from a reserved, never-collide source. Everything is a pure function of
an explicit seeded generator (`createRng`):

```ts runnable
import { createRng, safe, isSyntheticSsn } from "@cosyte/synth";

const rng = createRng(42);
const nationalId = safe.ssn(rng);

// The SSN is always drawn from the SSA never-issued space — it cannot be a real SSN.
isSyntheticSsn(nationalId); // => true
```

## Generate an HL7 v2 message

The `@cosyte/synth/hl7` subpath builds messages **through `@cosyte/hl7`**, so they are spec-clean by
construction and round-trip with zero warnings:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

const result = roundTrip(generateAdt({ seed: 7, trigger: "A08" }));

result.warnings; // => []
```

## Build a reproducible corpus

`hl7Corpus` returns a deep-frozen, self-describing `Corpus` — a seed plus a manifest of what was
generated. Pin the seed and every downstream test gets a stable fixture set:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const corpus = hl7Corpus({ seed: 2026, count: 3 });

corpus.artifacts.length; // => 3
```

## Determinism is the contract

The same seed yields byte-identical output — this is a tested invariant, not a nicety:

```ts runnable
import { generateAdt } from "@cosyte/synth/hl7";

const a = generateAdt({ seed: 99 }).toString();
const b = generateAdt({ seed: 99 }).toString();

a === b; // => true
```

## Next

- [Core Concepts](./concepts-archetype) — synthetic-by-construction, determinism, the round-trip gate.
- **API Reference** — every export, generated from source.
