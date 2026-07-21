---
id: guides-overview
title: Guides
sidebar_position: 1
---

# Guides

Task-oriented recipes — "how do I X?" — for `@cosyte/synth`. Each guide is a short, copy-pasteable answer
to one real fixture-generation question.

> **Status:** Phase 1 shipped the seeded-PRNG core, the synthetic-safety providers, and the HL7 v2
> round-trip harness; Phase 2 completes the HL7 v2 message set (`ADT`, `ORU^R01`, `ORM^O01`, `SIU^S12`,
> `VXU^V04`); Phases 3–4 add FHIR R4 / US Core (see the [FHIR guide](./guides-fhir)); C-CDA generation
> (CCD + Referral Note via `@cosyte/ccda`'s `buildCcda`) ships as the [C-CDA guide](./guides-ccda). The
> guide set grows as later phases add formats and quirk generation; a guide is only written once the
> behavior it documents is shipped and its runnable example passes the doc/code-agreement check.

## Pin a seed for a reusable golden fixture

A `Corpus` is a seed plus a manifest of what was generated — deep-frozen and self-describing. Pin the
seed (and the `synth` version) and every downstream run regenerates the identical set:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const corpus = hl7Corpus({ seed: 1867, count: 4 });

corpus.seed; // => 1867
```

## Verify an artifact round-trips before you trust it

The round-trip harness proves spec-cleanliness by the parser's own judgment — a spec-clean artifact
re-parses with zero warnings and re-serializes byte-identically:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

const { warnings, byteStable } = roundTrip(generateAdt({ seed: 21 }));

[warnings.length, byteStable]; // => [0, true]
```

## Planned guides

As later phases land, expect recipes such as:

- **Generate a vendor-quirk corpus** — inject the deviations a parser tolerates, each round-tripping to
  exactly the intended warning code.
- **Feed a parser's three-tier conformance corpus** — tiers 1 and 2, mechanically and seedably.
- **Pair with `@cosyte/deid`** — generate clean, plant tagged synthetic sentinels, de-identify, verify.

Until then, the [Quickstart](./quickstart) covers the core primitives and the HL7 corpus.
