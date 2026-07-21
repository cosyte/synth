---
id: troubleshooting
title: Troubleshooting
sidebar_position: 1
---

# Troubleshooting

Common questions when generating fixtures with `@cosyte/synth`.

## "I got a different message than last run"

You almost certainly changed the **seed**, or let the format's builder fill a nondeterministic default.
`synth` supplies a seeded control id and timestamp to `@cosyte/hl7` precisely so the bytes are
reproducible — pass the same `seed` and you get byte-identical output:

```ts runnable
import { generateAdt } from "@cosyte/synth/hl7";

generateAdt({ seed: 5 }).toString() === generateAdt({ seed: 5 }).toString(); // => true
```

Note that a **`synth` version bump may change the seed→bytes mapping** — that is a documented breaking
change, so pin the version alongside the seed for a long-lived golden fixture.

## "Cannot find module @cosyte/hl7"

The `@cosyte/synth/hl7` subpath needs the optional peer `@cosyte/hl7` installed. The package **core**
(`@cosyte/synth`) has no such requirement — import from there if you only need the PRNG and the safe
providers.

## An unsupported request threw

A generator has nothing to tolerate, so it **fails closed**. Asking for a format or quirk this build
cannot produce spec-clean throws a typed `SynthError` with a stable `SYNTH_FATAL_CODES` value — never a
hand-written byte workaround:

```ts runnable throws
import { defineSynthProfile } from "@cosyte/synth";

// A blank profile name is a programming error, and is rejected up front — this block is expected
// to throw (a TypeError), and the docs gate asserts that it does.
defineSynthProfile({ name: "" });
```

## Is the generated output safe to commit and log?

Yes — that is the whole point. **Every** value is drawn from a reserved/synthetic source, proven by the
synthetic-safety gate (the inverse of a de-identifier's leak test: `synth` proves plausibly-real PHI was
*never generated*). You can commit a generated corpus as a fixture without a PHI review of its contents.

## Known limitations (Phase 1)

- **HL7 v2 `ADT` only** so far — `A01`/`A04`/`A08`. The full HL7 message set (ORU/ORM/SIU/VXU) and the
  other formats (FHIR / C-CDA / X12 / NCPDP / ASTM) land in later phases.
- **Spec-clean only** — deliberate vendor-quirk generation is a later phase.

The **API Reference** always reflects exactly what this release ships.
