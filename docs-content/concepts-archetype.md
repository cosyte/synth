---
id: concepts-archetype
title: Core concepts
sidebar_position: 1
---

# Core Concepts

`@cosyte/synth` borrows the cosyte parser archetype's *disciplines* (immutability, stable typed codes,
the profile system) but its central reflex is neither the parser's liberal parse nor a fail-closed
de-identifier — it is **synthetic-by-construction**.

## Synthetic-by-construction

There is **no code path** that emits a value not drawn from a guaranteed-non-colliding synthetic
source. This inverts a parser's liberality: a parser is liberal on *input*; `synth` is **closed-world on
its data sources**. The hazard is asymmetric and specific — a generated value that looks real enough to
be mistaken for, or collide with, a real person's PHI. So every identifier comes from a reserved range
(SSA never-issued SSNs, NANP `555-01xx` phones, `example.*` domains, RFC 5737 TEST-NET IPs) or a shipped
clearly-fake pool, and a CI gate proves it:

```ts runnable
import { createRng, safe, isSyntheticSsn, isSyntheticPhone } from "@cosyte/synth";

const rng = createRng(1);

[isSyntheticSsn(safe.ssn(rng)), isSyntheticPhone(safe.phone(rng))]; // => [true, true]
```

## Spec-clean, by the parser's own judgment

`synth` never hand-writes bytes. It builds **through the parser's own conservative serializer**, so an
artifact is spec-clean by the exact mechanism the parser already proves — and its correctness is
checkable by feeding it straight back into that parser. A spec-clean artifact re-parses with **zero
warnings** and re-serializes byte-identically:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

roundTrip(generateAdt({ seed: 3 })).specClean; // => true
```

## Determinism: a seed → the same bytes

Reproducibility is a first-class guarantee, not a nicety. The PRNG is a hand-rolled, seeded, zero-dep
generator (`sfc32` seeded by `splitmix32`); `Math.random` is **lint-banned** in source because it is not
seedable. The seeded state is threaded explicitly, never global — so the same seed yields byte-identical
output on any machine, any run.

## Immutability

Generated artifacts and the `Corpus` result are **deep-frozen** — a fixture is safe to share across a
pipeline without defensive copying.

## Stable fatal codes

A generator has no input to tolerate, so its diagnostics are **fatal**: a request it cannot honor
spec-clean (an unsupported format or quirk) throws a typed `SynthError` carrying a stable
`SYNTH_FATAL_CODES` value — never a silent fabrication. Codes are `key === value`, so the full set
survives an `Object.values(...)` snapshot into a stability tripwire.
