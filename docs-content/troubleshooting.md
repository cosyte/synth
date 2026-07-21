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
_never generated_). You can commit a generated corpus as a fixture without a PHI review of its contents.

## Known limitations

All six formats are wired (HL7 v2, FHIR, C-CDA, X12, NCPDP, ASTM), with vendor-quirk mode for HL7
v2 / C-CDA / ASTM and the `deid` pairing loop for HL7 v2 / FHIR / C-CDA / X12 / NCPDP Telecom. The
honest shape of what `synth` does, does **not** do, and defers — plus the full synthetic-safety posture
— lives in **[What it does — and does not do](./limitations.md)**. The headline: `synth` is a
**format/conformance generator, not a clinical simulator**; every value is synthetic-by-construction;
output is deterministic per seed within a version window; and no terminology is bundled.

The **API Reference** always reflects exactly what this release ships.
