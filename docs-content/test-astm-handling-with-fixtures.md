---
id: test-astm-handling-with-fixtures
title: Test your ASTM handling with generated fixtures
sidebar_label: Test ASTM handling
description: "A tutorial: write a small ASTM result reader, test it with generated records, the framed form, a pinned seed, and a non-standard escape."
---

# Test your ASTM handling with generated fixtures

In this tutorial we write a small piece of code that reads laboratory results from ASTM messages and
test it with fixtures from `@cosyte/synth`. We start from one generated result report and end with a
message that carries a non-standard escape and the warning it should raise. Every message is
synthetic, so the tests can live in a public repository and print their input to a CI log.

You need `@cosyte/synth` and `@cosyte/astm` installed ([Installation](./installation.md)). Each
step is a complete program you can run on its own.

## 1. Write the code under test

The code under test reads an E1394 record stream with `@cosyte/astm` and lists each result's test
code and value. Feed it a generated result report with three results. The generator returns the
record stream itself:

```ts runnable
import { parseAstmRecords, results } from "@cosyte/astm";
import { generateAstmResult } from "@cosyte/synth/astm";

function readResults(stream: string) {
  return results(parseAstmRecords(stream)).map((result) => ({
    code: result.universalTestId?.localCode,
    value: result.value,
  }));
}

const found = readResults(generateAstmResult({ seed: 12345, resultCount: 3 }));

found.length; // => 3
found.every((result) => result.code !== undefined && result.value !== undefined); // => true
```

`resultCount` sets how many `R` records the report holds; without it the generator picks one to four
from the seed.

## 2. Check what the fixture carries

A generated message says it is test data: field 12 of the `H` record, the processing ID, is `T`,
never `P` for production. The patient's practice-assigned and laboratory-assigned IDs are minted
separately, so they differ, and the stream reads back with no warnings:

```ts runnable
import { parseAstmRecords, patient } from "@cosyte/astm";
import { generateAstmResult } from "@cosyte/synth/astm";

const stream = generateAstmResult({ seed: 12345 });
const header = (stream.split("\r")[0] ?? "").split("|");
const message = parseAstmRecords(stream);
const ids = patient(message);

header[11]; // => "T"
ids?.practiceAssignedId !== ids?.laboratoryAssignedId; // => true
message.warnings.length; // => 0
```

## 3. Read the framed form

An analyzer on a serial line or TCP wraps the records in E1381 frames, each with a frame number and
a checksum. `generateAstmResultFramed` frames the same records the unframed generator gives for the
same seed, so the reader should find the same results once `@cosyte/astm` has taken the frames off:

```ts runnable
import { parseAstmRecords, parseFramedAstm, results } from "@cosyte/astm";
import { generateAstmResult, generateAstmResultFramed } from "@cosyte/synth/astm";

const framed = parseFramedAstm(generateAstmResultFramed({ seed: 12345 }));
const unframed = parseAstmRecords(generateAstmResult({ seed: 12345 }));

framed.frameWarnings.length; // => 0
results(framed.message).length === results(unframed).length; // => true
```

## 4. Pin the seed

A test that regenerates its fixture from a seed needs no fixture file, and its input does not change
between runs, because the same seed gives the same bytes:

```ts runnable
import { generateAstmResult } from "@cosyte/synth/astm";

generateAstmResult({ seed: 12345 }) === generateAstmResult({ seed: 12345 }); // => true
```

The bytes come from `@cosyte/astm`'s builders, so pin the versions of `@cosyte/synth` and
`@cosyte/astm` in your lockfile as well as the seed.

## 5. Add a non-standard escape

Some instruments write escape sequences the standard does not define. `generateAstmQuirk` puts a
`&Z&` escape in an otherwise clean report, and checks before it returns that `@cosyte/astm` raises
exactly the warning the quirk is meant to cause. Your code should still read the results, and the
parser should flag the escape:

```ts runnable
import { parseAstmRecords, results } from "@cosyte/astm";
import { generateAstmQuirk } from "@cosyte/synth/astm";

const fixture = generateAstmQuirk({ seed: 12345, quirk: "unknown-escape" });
const message = parseAstmRecords(fixture.content);

fixture.intendedWarnings; // => ["ASTM_UNKNOWN_ESCAPE_SEQUENCE"]
message.warnings.map((w) => w.code); // => ["ASTM_UNKNOWN_ESCAPE_SEQUENCE"]
results(message).length > 0; // => true
```

## What you built

A reader for ASTM laboratory results, tested against a record stream and its framed form regenerated
from a seed, plus a message with a known deviation and the warning it raises. None of it holds
patient data.

## Where to go next

- [Generate ASTM messages](./guides-astm.md): every generator on the ASTM subpath.
- [Generate vendor-quirk fixtures](./guides-quirks.md): the other ASTM quirk, and the parser profile
  that tolerates it.
- [Generator options, kinds and profiles](./generator-options.md): every option and every kind a
  corpus accepts.
