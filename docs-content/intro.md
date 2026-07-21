---
id: intro
title: Getting started
sidebar_position: 1
---

# @cosyte/synth

Generate **deterministic, seedable synthetic healthcare fixtures** — spec-clean HL7 v2 (and, in later
phases, FHIR / C-CDA / X12 / NCPDP / ASTM) — without hand-writing a byte of the wire format, and
**without any chance the "patient" you just generated is a real person**.

`@cosyte/synth` is a **consumer** of the cosyte parsers, not a parser. It builds each artifact **through
the parser's own builder/serializer** (so the output is spec-clean by construction) and draws every
identifier, name, date, phone, and address from a **guaranteed-non-colliding synthetic source** (SSA
never-issued SSNs, NANP `555-01xx` phones, `example.*` domains, TEST-NET IPs, a synthetic assigning
authority for MRNs, and a shipped clearly-fake name pool). It is a **format/conformance generator, not a
clinical simulator** — it does not model disease progression (that is Synthea).

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. Phase 1 shipped the seeded-PRNG core, the
> synthetic-safety providers, and the round-trip harness; Phase 2 completes the HL7 v2 message set
> (`ADT`, `ORU^R01`, `ORM^O01`, `SIU^S12`, `VXU^V04`).

## Install

```bash
npm install @cosyte/synth @cosyte/hl7
```

`@cosyte/hl7` is an **optional peer dependency** — install it only if you use the `@cosyte/synth/hl7`
subpath. The package core (PRNG + safe providers) has **zero third-party runtime dependencies**.

## Generate a spec-clean message

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

// Same seed → byte-identical message, on any machine, any run.
const message = generateAdt({ seed: 12345, trigger: "A01" });

// It round-trips through @cosyte/hl7 with zero warnings — spec-clean by construction.
roundTrip(message).specClean; // => true
```

Every value in that message is provably synthetic: the SSN is never-issued (`900–999` area), the phone
is in the reserved `555-01xx` block, the name is from a clearly-fake pool, and the MRN lives under a
synthetic assigning authority.

## Next

- [Quickstart](./quickstart) — the core primitives and the HL7 corpus.
- [Core Concepts](./concepts-archetype) — synthetic-by-construction, determinism, the round-trip gate.
