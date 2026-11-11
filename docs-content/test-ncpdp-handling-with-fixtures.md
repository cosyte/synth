---
id: test-ncpdp-handling-with-fixtures
title: Test your NCPDP handling with generated fixtures
sidebar_label: Test NCPDP handling
description: "A tutorial: write a small NCPDP Telecom claim reader, test it with generated B1, B2 and B3 transactions, a SCRIPT NewRx, and a pinned seed."
---

# Test your NCPDP handling with generated fixtures

In this tutorial we write a small piece of code that reads NCPDP pharmacy claims and test it with
fixtures from `@cosyte/synth`. We start from one generated Telecom billing claim and end with a
SCRIPT prescription whose prescriber identifiers we check. Every message is synthetic, so the tests
can live in a public repository and print their input to a CI log.

You need `@cosyte/synth` and `@cosyte/ncpdp` installed ([Installation](./installation.md)). Each
step is a complete program you can run on its own.

## 1. Write the code under test

The code under test reads a Telecom request with `@cosyte/ncpdp` and pulls out the transaction code,
the product dispensed and the quantity. Feed it a generated `B1` billing claim. The generators on
this subpath return the wire text itself:

```ts runnable
import { claim, parseTelecom } from "@cosyte/ncpdp/telecom";
import { generateB1 } from "@cosyte/synth/ncpdp";

function summarizeClaim(wire: string) {
  const transaction = parseTelecom(wire);
  const view = claim(transaction);
  return {
    transactionCode: transaction.header.transactionCode,
    product: view?.product?.id,
    quantity: view?.quantityDispensed?.impliedDecimal,
  };
}

const summary = summarizeClaim(generateB1({ seed: 12345 }));

summary.transactionCode; // => "B1"
summary.product !== undefined; // => true
summary.quantity !== undefined; // => true
```

## 2. Check what the fixture carries

A generated value is not a value you typed, so assert on its kind rather than its spelling. The
product comes from a small example pool whose NDCs use the labeler prefix `00000`, which we invented,
and the claim reads back with no warnings:

```ts runnable
import { claim, parseTelecom } from "@cosyte/ncpdp/telecom";
import { generateB1 } from "@cosyte/synth/ncpdp";

const transaction = parseTelecom(generateB1({ seed: 12345 }));

claim(transaction)?.product?.id.startsWith("00000"); // => true
transaction.warnings.length; // => 0
```

## 3. Run every Telecom transaction through it

A pharmacy system sends a reversal (`B2`) and a rebill (`B3`) as well as a billing (`B1`).
`generateTelecom` takes the transaction code as data, so one loop covers all three:

```ts runnable
import { parseTelecom } from "@cosyte/ncpdp/telecom";
import { generateTelecom } from "@cosyte/synth/ncpdp";

const codes = (["B1", "B2", "B3"] as const).map(
  (code) => parseTelecom(generateTelecom(code, { seed: 777 })).header.transactionCode,
);

codes; // => ["B1", "B2", "B3"]
```

## 4. Check a SCRIPT prescription

SCRIPT is the other NCPDP standard: XML ePrescribing. A `NewRx` carries the prescriber's NPI and DEA
number, and neither may be a real one. `isSyntheticNpi` and `isSyntheticDea` check that each fails
its check digit, so it cannot have been issued:

```ts runnable
import { newRx, parseScript } from "@cosyte/ncpdp/script";
import { isSyntheticDea, isSyntheticNpi } from "@cosyte/synth";
import { generateNewRx } from "@cosyte/synth/ncpdp";

const message = parseScript(generateNewRx({ seed: 12345 }));
const ids = newRx(message)?.prescriber?.identification;

isSyntheticNpi(ids?.npi ?? ""); // => true
isSyntheticDea(ids?.deaNumber ?? ""); // => true
message.warnings.length; // => 0
```

## 5. Pin the seed

A test that regenerates its fixture from a seed needs no fixture file, and its input does not change
between runs, because the same seed gives the same bytes:

```ts runnable
import { generateB1 } from "@cosyte/synth/ncpdp";

generateB1({ seed: 12345 }) === generateB1({ seed: 12345 }); // => true
```

The bytes come from `@cosyte/ncpdp`'s builders and serializers, so pin the versions of
`@cosyte/synth` and `@cosyte/ncpdp` in your lockfile as well as the seed.

## What you built

A reader for NCPDP Telecom claims, tested against a billing, a reversal and a rebill, plus a SCRIPT
prescription whose prescriber identifiers cannot be real, each regenerated from a seed. None of it
holds patient data.

## Where to go next

- [Generate NCPDP messages](./guides-ncpdp.md): every generator on the NCPDP subpath, and where each
  identifier comes from.
- [Generator options, kinds and profiles](./generator-options.md): every option and every kind a
  corpus accepts.
- [Draw synthetic values for your own fixtures](./draw-synthetic-values.md): the providers and
  checks used above.
