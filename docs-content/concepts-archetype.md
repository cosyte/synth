---
id: concepts-archetype
title: How it works
sidebar_label: How it works
description: "Why every fixture is synthetic by construction, checked by its own parser, the same for a seed, frozen, and refused with a stable code."
---

# How it works

The Cosyte parsers share a few rules: their models are frozen, their codes are stable, and their
vendor behavior lives in profiles. `@cosyte/synth` keeps those rules, and adds the one that matters
most for a generator: every value is synthetic by construction. This page explains each, and what it
costs.

## Synthetic by construction

The risk with a fixture generator is a value that looks real enough to be taken for, or to match,
a real person's data. So no code path emits a value from anywhere but a reserved range or a shipped
pool of invented words: SSNs with a 900-series area, phone numbers in `555-0100` to `555-0199`,
`example.*` email domains, documentation IP ranges, a synthetic assigning authority for medical
record numbers, and invented names, streets, and cities.

A parser is lenient about its input; `synth` is closed about its sources. A de-identifier shows
that real PHI is gone from a document; `synth` shows that none was ever generated. The test suite's
synthetic-safety properties check it for arbitrary seeds and every format:

```ts runnable
import { createRng, isSyntheticPhone, isSyntheticSsn, safe } from "@cosyte/synth";

const rng = createRng(1);

[isSyntheticSsn(safe.ssn(rng)), isSyntheticPhone(safe.phone(rng))]; // => [true, true]
```

[What it does and does not do](./limitations.md#the-synthetic-safety-posture-the-floors) cites the
authority behind each source. [Draw synthetic values](./draw-synthetic-values.md) shows how to use
the providers in your own fixtures.

## Built and checked by the parser

`synth` never writes wire bytes by hand. Each format is built through its parser's own builder or
serializer, so an artifact can be checked by feeding it back to that parser: it should parse with no
warnings and serialize to the same bytes. The round-trip helpers do exactly that:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

roundTrip(generateAdt({ seed: 3 })).specClean; // => true
```

What this cannot see is a misreading of a standard that the builder and the parser share, since the
same code is on both sides of the check. For FHIR, a validator we did not write also grades the
output; for the other five formats, no public validator that runs offline from a file was found.
[Who checks the output](./limitations.md#who-checks-the-output-and-who-does-not) has the details.

## Determinism: a seed gives the same bytes

A seed decides the output. The generator is `sfc32`, seeded by `splitmix32`, with no dependencies.
`Math.random` is banned from the source by lint, because its seed cannot be set, and nothing reads
the clock: timestamps and control IDs come from the seed too. The generator is passed explicitly to
every provider, never held globally, so two fixtures built in the same process do not affect each
other.

CI checks this across Node.js versions: it generates a declared corpus of every format on Node.js
22, 24, and 26 in separate jobs, compares the digests, and compares them with a committed baseline.
[Determinism holds within a version window](./limitations.md#determinism-holds-within-a-version-window)
says what can change the bytes between releases, and how we say so.

## Frozen results

Generated artifacts, the `Corpus` and its manifest, the example code pools, and the fatal-code
registry are frozen, so a fixture shared across tests cannot be changed by one of them. A write to
one throws in strict mode.

## Vendor quirks come from parser profiles

A quirk fixture deviates from the standard in one way that a Cosyte parser's profile system
describes as tolerable, and raises exactly one intended warning. Where a built-in public profile
tolerates the deviation, the round trip also shows that profile suppressing or re-badging the
warning. The quirk vocabulary is the parsers' own, so a quirk fixture tests documented behavior, not
an invented failure. [Generate vendor-quirk fixtures](./guides-quirks.md) shows how.

## Refusals are fatal, coded, and quote nothing

A generator has no input to tolerate, so when it is asked for something it cannot build (an unknown
message kind, a quirk outside a registry, a US Core profile it does not generate) it throws a
`SynthError` with a stable code rather than return something mislabelled.

`SynthError` takes a code and nothing else. Its message comes from the frozen `SYNTH_FATAL_MESSAGES`
table, so a value you passed cannot reach `message`, `stack`, or any field of the error. The cost is
that an error names the rule that refused, not the value that tripped it; you already hold the value
you passed, and the stack names the call. [Fatal codes](./fatal-codes.md) lists every code.

## Related

- [What it does and does not do](./limitations.md): the promise and its edges.
- [Testing and quality](./testing-and-quality.md): how each of these is tested.
