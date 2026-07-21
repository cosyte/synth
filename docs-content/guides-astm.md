---
id: guides-astm
title: ASTM (E1394 / E1381)
sidebar_position: 7
---

# Generate ASTM messages

The `@cosyte/synth/astm` subpath builds ASTM laboratory messages **through `@cosyte/astm`'s own emit
surface** — `buildAstmMessage` for the E1394 record layer and `composeAstmFrames` for the E1381 frame
layer — so every message is **spec-clean by construction** and round-trips through the parser with
**zero warnings**. `@cosyte/astm` is an **optional peer dependency**, needed only for this subpath.

The surface covers both layers:

- **Records (E1394)** — `generateAstmResult` emits a full `H`/`P`/`O`/`R`…/`C`/`L` result report;
  `generateAstmOrder` emits the `H`/`P`/`O`/`L` order side. Both are built through `buildAstmMessage`,
  so the `H|\^&` delimiter declaration, the record type letters, the per-type sequence counters, and the
  `L` terminator are the parser's own conservative emit — never a hand-written byte.
- **Framing (E1381)** — `generateAstmResultFramed` wraps the same records in the
  `<STX> FN text <ETB|ETX> CS <CR><LF>` frame envelope, with the **modulo-256 checksum and the `0`–`7`
  frame number computed by `@cosyte/astm`**, never faked.

Every value at the `P` (patient) record — the name, birthdate, and the practice- and laboratory-assigned
patient IDs — is drawn from the synthetic-safety providers, so no output can be real or plausibly-real
PHI. The practice- and lab-assigned IDs are minted independently, so they stay **distinct** (exactly as
`@cosyte/astm` keeps them distinct on parse). `synth` is a **format/conformance generator, not a clinical
simulator**: a generated result pairs a code and a value with no claim of clinical coherence.

## A result report, spec-clean by construction

The round-trip harness proves spec-cleanliness by `@cosyte/astm`'s own judgment — a spec-clean message
re-parses with zero warnings and re-serializes byte-identically:

```ts runnable
import { generateAstmResult, astmRoundTrip } from "@cosyte/synth/astm";

// Same seed → byte-identical ASTM record stream, on any machine, any run.
const result = astmRoundTrip(generateAstmResult({ seed: 12345 }));
result.warnings; // => []
result.byteStable; // => true
result.specClean; // => true
```

## A framed (E1381) message

The framed twin carries the same records with a real frame envelope — the checksum and frame numbers
are computed, so it decodes with zero frame **and** record warnings:

```ts runnable
import { generateAstmResultFramed, astmFramedRoundTrip } from "@cosyte/synth/astm";

const framed = astmFramedRoundTrip(generateAstmResultFramed({ seed: 12345 }));
framed.warnings; // => []
framed.specClean; // => true
```

## A reproducible corpus

`astmCorpus` builds a deep-frozen, seed-tagged set — a downstream repo pins the seed and gets a stable
fixture set that regenerates identically:

```ts runnable
import { astmCorpus } from "@cosyte/synth/astm";

const corpus = astmCorpus({ seed: 42 });
corpus.artifacts.length; // => 2
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

## What is deferred

**Quirk mode** (a later phase) — lowercase ASTM checksums, framing dropped over TCP, and the other
vendor tolerances `@cosyte/astm`'s profile system advertises, each round-tripping to exactly the intended
warning — is not yet shipped. The spec-clean generation core is feature-complete across all six formats.
