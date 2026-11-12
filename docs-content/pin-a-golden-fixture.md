---
id: pin-a-golden-fixture
title: Pin a golden fixture
sidebar_label: Pin a golden fixture
description: "Pin a seed and the package versions, write a generated corpus to disk as a golden file, and check later that it still regenerates the same."
---

# Pin a golden fixture

A golden fixture is a file a test compares against. With `@cosyte/synth` it can come from a seed,
so you can regenerate it at any time, and a change in its bytes tells you something moved.

## 1. Pin the seed and the versions

A seed maps to the same bytes within a release, and across releases unless a changelog entry states
an output change for that format. Each format's bytes come from its parser's builder, so a parser
upgrade can move them too. Pin all three:

- the seed, in your test;
- the `@cosyte/synth` version, in your lockfile;
- the version of each parser you generate with (`@cosyte/hl7`, `@cosyte/fhir`, and the others), in
  your lockfile.

[Determinism holds within a version window](./limitations.md#determinism-holds-within-a-version-window)
says how we state an output change.

## 2. Check the fixture reads back clean

Before you trust a fixture, check its parser reads it with no warnings and serializes it back to the
same bytes:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

const { warnings, byteStable } = roundTrip(generateAdt({ seed: 21 }));

[warnings.length, byteStable]; // => [0, true]
```

Every artifact in a corpus has already been through this, and its `warnings` holds the result.

## 3. Write the corpus to disk

A corpus carries its seed and a manifest, so the file says how to regenerate itself:

```ts runnable
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hl7Corpus } from "@cosyte/synth/hl7";

const dir = mkdtempSync(join(tmpdir(), "golden-"));
const golden = join(dir, "hl7-corpus.json");

writeFileSync(golden, JSON.stringify(hl7Corpus({ seed: 1867, count: 4 }), null, 2));

const saved = JSON.parse(readFileSync(golden, "utf8")) as { seed: number };
saved.seed; // => 1867

rmSync(dir, { recursive: true });
```

In a real project, write the file into your repository and commit it. Every value in it is
synthetic, so it needs no PHI review.

## 4. Check it still regenerates the same

Regenerate from the seed in the file and compare. A difference means the code or a pinned version
changed the output:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const committed = JSON.stringify(hl7Corpus({ seed: 1867, count: 4 }));
const regenerated = JSON.stringify(hl7Corpus({ seed: 1867, count: 4 }));

regenerated === committed; // => true
```

## Related

- [Test your HL7 handling with generated fixtures](./test-hl7-handling-with-fixtures.md): the same
  ideas in a tutorial.
- Reference: [`Corpus`](./api/src.md#corpus), [`makeCorpus`](./api/src.md#makecorpus), and
  [`hl7Corpus`](./api/src/hl7.md#hl7corpus).
