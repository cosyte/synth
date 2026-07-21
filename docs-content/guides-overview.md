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
> (CCD + Referral Note via `@cosyte/ccda`'s `buildCcda`) ships as the [C-CDA guide](./guides-ccda); and
> Phase 5 adds X12 005010 (837P/I/D, 835, 271 via `@cosyte/x12`) — see the [X12 guide](./guides-x12); and
> Phase 6 adds NCPDP (SCRIPT + Telecom via `@cosyte/ncpdp` — the [NCPDP guide](./guides-ncpdp)) and ASTM
> (E1394 records + E1381 framing via `@cosyte/astm` — the [ASTM guide](./guides-astm)), completing the
> spec-clean generation core across all six formats; and Phase 7 adds **vendor-quirk generation** for
> HL7 v2, C-CDA, and ASTM (see the [quirk guide](./guides-quirks)). A guide is only written once the
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

Shipped: **[vendor-quirk generation](./guides-quirks)** — inject the deviations a parser tolerates, each
round-tripping to exactly the intended warning code (HL7 v2, C-CDA, and ASTM). As later phases land,
expect recipes such as:

- **Feed a parser's three-tier conformance corpus** — tiers 1 and 2, mechanically and seedably.
- **Pair with `@cosyte/deid`** — generate clean, plant tagged synthetic sentinels, de-identify, verify.
- **Quirk recipes for FHIR, X12, and NCPDP** — as those parsers' profile/quirk surface lands.

Until then, the [Quickstart](./quickstart) covers the core primitives and the HL7 corpus.
