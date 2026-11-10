---
id: guides-astm
title: Generate ASTM messages
sidebar_label: ASTM
description: "Generate ASTM E1394 result and order records, and the E1381-framed form, through @cosyte/astm's builders."
---

# Generate ASTM messages

The `@cosyte/synth/astm` subpath builds ASTM laboratory messages through `@cosyte/astm`'s own
builders: `buildAstmMessage` for the E1394 record layer and `composeAstmFrames` for the E1381 frame
layer. Install `@cosyte/astm` alongside it ([Installation](./installation.md)).

- **Records (E1394).** `generateAstmResult` returns a result report (`H`, `P`, `O`, `R` records,
  `C`, and `L`); `generateAstmOrder` returns the order side (`H`, `P`, `O`, and `L`). The `H|\^&`
  delimiter declaration, the record type letters, the sequence numbers, and the `L` terminator come
  from the builder. Both return a string.
- **Framing (E1381).** `generateAstmResultFramed` wraps the same records in frames, with the
  modulo-256 checksum and the frame numbers (`0` to `7`) computed by `@cosyte/astm`. It returns the
  bytes as a `Uint8Array`.

## Generate a result report and check it reads back clean

`astmRoundTrip` parses the records with `@cosyte/astm` and serializes them again:

```ts runnable
import { astmRoundTrip, generateAstmResult } from "@cosyte/synth/astm";

// The same seed gives the same record stream, on any machine and any run.
const result = astmRoundTrip(generateAstmResult({ seed: 12345 }));
result.warnings; // => []
result.byteStable; // => true
result.specClean; // => true
```

## Generate a framed message

`astmFramedRoundTrip` decodes the frames and the records inside them, so a wrong checksum or frame
number shows up as a warning:

```ts runnable
import { astmFramedRoundTrip, generateAstmResultFramed } from "@cosyte/synth/astm";

const framed = astmFramedRoundTrip(generateAstmResultFramed({ seed: 12345 }));
framed.warnings; // => []
framed.specClean; // => true
```

## Build a corpus

`astmCorpus` generates a result report and an order by default:

```ts runnable
import { astmCorpus } from "@cosyte/synth/astm";

const corpus = astmCorpus({ seed: 42 });
corpus.artifacts.map((a) => a.kind); // => ["Result", "Order"]
corpus.artifacts.every((a) => a.warnings.length === 0); // => true
```

## What a message carries

The `P` (patient) record carries the name, the birth date, and the practice-assigned and
laboratory-assigned patient IDs. The name comes from the invented-name pool, the birth date from
the seeded generator, and the two IDs are minted separately under a synthetic assigning authority,
so they differ, as `@cosyte/astm` keeps them apart when it parses. A result pairs a test code and a
value with no claim that they make clinical sense.

## Generate an off-spec message

Quirk fixtures ship for ASTM: a non-standard `&Z&` escape that raises
`ASTM_UNKNOWN_ESCAPE_SEQUENCE`, and a site-defined record type that raises
`ASTM_RECORD_UNKNOWN_TYPE`. See [Generate vendor-quirk fixtures](./guides-quirks.md#astm-a-non-standard-escape).
Frame-layer faults (a wrong checksum, framing dropped over TCP) raise diagnostics that no parser
profile tolerates, so they are not generated.

## Related

- Reference: [`generateAstmResult`](./api/src/astm.md#generateastmresult),
  [`generateAstmOrder`](./api/src/astm.md#generateastmorder),
  [`generateAstmResultFramed`](./api/src/astm.md#generateastmresultframed),
  [`astmRoundTrip`](./api/src/astm.md#astmroundtrip), and
  [`astmCorpus`](./api/src/astm.md#astmcorpus).
