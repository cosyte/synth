---
id: test-x12-handling-with-fixtures
title: Test your X12 handling with generated fixtures
sidebar_label: Test X12 handling
description: "A tutorial: write a small X12 835 reconciliation check, test it with generated remittances, route every transaction, and pin the seed."
---

# Test your X12 handling with generated fixtures

In this tutorial we write a small piece of code that reconciles X12 835 remittances and test it with
fixtures from `@cosyte/synth`. We start from one generated 835 and end with a router that sorts
every transaction the subpath generates. Every interchange is synthetic, so the tests can live in a
public repository and print their input to a CI log.

You need `@cosyte/synth` and `@cosyte/x12` installed ([Installation](./installation.md)). Each
step is a complete program you can run on its own.

## 1. Write the code under test

An 835 states the total payment once, and what was paid on each claim. The code under test reads an
835 with `@cosyte/x12` and checks that the claim payments add up to the total. Feed it a generated
835, serialized to the EDI a payer would send:

```ts runnable
import { get835, parseX12, serializeX12 } from "@cosyte/x12";
import { generate835 } from "@cosyte/synth/x12";

function cents(amount: { toString(): string } | undefined): number {
  return Math.round(Number(amount?.toString() ?? "0") * 100);
}

function paymentsBalance(raw: string): boolean {
  const ix = parseX12(raw);
  const tx = ix.groups[0]?.transactions.find((t) => t.st.elements[1] === "835");
  const remit = tx === undefined ? undefined : get835(ix.delimiters, tx);
  if (remit === undefined) return false;
  const claimed = remit.claims.reduce((sum, claim) => sum + cents(claim.totalPaymentAmount), 0);
  return claimed === cents(remit.payment.totalActualPayment);
}

const raw = serializeX12(generate835({ seed: 12345 }));

paymentsBalance(raw); // => true
```

`generate835` returns `@cosyte/x12`'s interchange model; `serializeX12` gives the EDI text. The
generator balances the line, claim and payment totals before it calls the builder, which is why this
check holds.

## 2. Check what the fixture carries

A generated interchange says it is test data. Its `ISA` segment has a fixed layout, the element
separator is its fourth character, and element 15, the usage indicator, is `T` for test, never `P`
for production. It also reads back with no warnings:

```ts runnable
import { parseX12, serializeX12 } from "@cosyte/x12";
import { generate835 } from "@cosyte/synth/x12";

const raw = serializeX12(generate835({ seed: 12345 }));
const isa = raw.split(raw.charAt(3));

isa[0]; // => "ISA"
isa[15]; // => "T"
parseX12(raw).warnings.length; // => 0
```

## 3. Run many remittances through it

One remittance passing proves little. `x12Corpus` with a `mix` of `["835"]` gives as many as you ask
for, each from its own seed, and the check should hold for every one:

```ts runnable
import { get835, parseX12 } from "@cosyte/x12";
import { x12Corpus } from "@cosyte/synth/x12";

function cents(amount: { toString(): string } | undefined): number {
  return Math.round(Number(amount?.toString() ?? "0") * 100);
}

function paymentsBalance(raw: string): boolean {
  const ix = parseX12(raw);
  const tx = ix.groups[0]?.transactions.find((t) => t.st.elements[1] === "835");
  const remit = tx === undefined ? undefined : get835(ix.delimiters, tx);
  if (remit === undefined) return false;
  const claimed = remit.claims.reduce((sum, claim) => sum + cents(claim.totalPaymentAmount), 0);
  return claimed === cents(remit.payment.totalActualPayment);
}

const corpus = x12Corpus({ seed: 2026, mix: ["835"], count: 20 });

corpus.artifacts.length; // => 20
corpus.artifacts.every((artifact) => paymentsBalance(artifact.content)); // => true
```

## 4. Route every transaction

A clearinghouse feed carries claims, remittances and eligibility responses together. Say the code
under test routes each interchange by its transaction set code (`ST01`) and, for an 837, by the
implementation guide its `GS08` names: `005010X222` is professional, `005010X223` institutional
and `005010X224` dental, each followed by the addenda letters the builder writes. `x12Corpus` with no `mix` gives one of each transaction it
generates, and the router should agree with each artifact's `kind`:

```ts runnable
import { parseX12 } from "@cosyte/x12";
import { x12Corpus } from "@cosyte/synth/x12";

const VARIANTS: Record<string, string> = {
  "005010X222": "837P",
  "005010X223": "837I",
  "005010X224": "837D",
};

function route(raw: string): string {
  const group = parseX12(raw).groups[0];
  const code = group?.transactions[0]?.st.elements[1] ?? "";
  if (code !== "837") return code;
  return VARIANTS[(group?.gs.elements[8] ?? "").slice(0, 10)] ?? "837?";
}

const corpus = x12Corpus({ seed: 42 });

corpus.artifacts.map((artifact) => artifact.kind); // => ["837P", "837I", "837D", "835", "271"]
corpus.artifacts.map((artifact) => route(artifact.content)); // => ["837P", "837I", "837D", "835", "271"]
```

## 5. Pin the seed

A test that regenerates its fixture from a seed needs no fixture file, and its input does not change
between runs, because the same seed gives the same bytes:

```ts runnable
import { serializeX12 } from "@cosyte/x12";
import { generate835 } from "@cosyte/synth/x12";

const first = serializeX12(generate835({ seed: 12345 }));
const again = serializeX12(generate835({ seed: 12345 }));

first === again; // => true
```

The bytes come from `@cosyte/x12`'s builders, so pin the versions of `@cosyte/synth` and
`@cosyte/x12` in your lockfile as well as the seed.

## What you built

A reconciliation check for 835 remittances, tested against twenty generated remittances, and a
router tested against one of every transaction the subpath generates, each regenerated from a seed.
None of it holds patient data.

## Next

- [Generate X12 transactions](./guides-x12.md): every generator on the X12 subpath, and where each
  identifier comes from.
- [Generator options, kinds and profiles](./generator-options.md): every option and every kind a
  corpus accepts.
- [Check a de-identifier with the pairing loop](./guides-deid.md): X12 claims through
  `@cosyte/deid`.
