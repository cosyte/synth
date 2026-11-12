---
id: test-ccda-handling-with-fixtures
title: Test your C-CDA handling with generated fixtures
sidebar_label: Test C-CDA handling
description: "A tutorial: write a small C-CDA reader, test it with a generated CCD, both document types, a pinned seed, and a deprecated code."
---

# Test your C-CDA handling with generated fixtures

In this tutorial we write a small piece of code that reads C-CDA R2.1 documents and test it with
fixtures from `@cosyte/synth`. We start from one generated Continuity of Care Document (CCD) and end
with a document that carries a deprecated code and the warning it should raise. Every document is
synthetic, so the tests can live in a public repository and print their input to a CI log.

You need `@cosyte/synth` and `@cosyte/ccda` installed ([Installation](./installation.md)). Each
step is a complete program you can run on its own.

## 1. Write the code under test

The code under test reads a document with `@cosyte/ccda` and pulls out its type, the patient's
family name, and how many problems and medications it lists. Feed it a generated CCD, serialized to
the XML a sending system would hand you:

```ts runnable
import { parseCcda, serializeCcda } from "@cosyte/ccda";
import { generateCcd } from "@cosyte/synth/ccda";

function summarizeDocument(xml: string) {
  const doc = parseCcda(xml);
  return {
    documentType: doc.documentType,
    family: doc.getPatient()?.name?.family,
    problems: doc.getProblems().length,
    medications: doc.getMedications().length,
  };
}

const xml = serializeCcda(generateCcd({ seed: 12345 }));
const summary = summarizeDocument(xml);

summary.documentType; // => "ccd"
summary.problems > 0; // => true
summary.medications > 0; // => true
```

`generateCcd` returns `@cosyte/ccda`'s document model; `serializeCcda` gives the XML.

## 2. Check what the fixture carries

A generated value is not a value you typed, so assert on its kind rather than its spelling. The
family name comes from the shipped pool of invented names, and the document reads back with no
warnings:

```ts runnable
import { parseCcda, serializeCcda } from "@cosyte/ccda";
import { SYNTHETIC_FAMILY_NAMES } from "@cosyte/synth";
import { generateCcd } from "@cosyte/synth/ccda";

const doc = parseCcda(serializeCcda(generateCcd({ seed: 12345 })));

SYNTHETIC_FAMILY_NAMES.includes(doc.getPatient()?.name?.family ?? ""); // => true
doc.warnings.length; // => 0
```

## 3. Run both document types through it

`ccdaCorpus` alternates a CCD and a Referral Note. With a count of 2 you get one of each, and each
artifact's `kind` says which. The code under test should report the same type the generator was
asked for:

```ts runnable
import { parseCcda } from "@cosyte/ccda";
import { ccdaCorpus } from "@cosyte/synth/ccda";

const corpus = ccdaCorpus({ seed: 42, count: 2 });
const types = corpus.artifacts.map((artifact) => parseCcda(artifact.content).documentType);

corpus.artifacts.map((artifact) => artifact.kind); // => ["ccd", "referralNote"]
types; // => ["ccd", "referralNote"]
```

## 4. Pin the seed

A test that regenerates its fixture from a seed needs no fixture file, and its input does not change
between runs, because the same seed gives the same bytes:

```ts runnable
import { serializeCcda } from "@cosyte/ccda";
import { generateCcd } from "@cosyte/synth/ccda";

const first = serializeCcda(generateCcd({ seed: 12345 }));
const again = serializeCcda(generateCcd({ seed: 12345 }));

first === again; // => true
```

The bytes come from `@cosyte/ccda`'s serializer, so pin the versions of `@cosyte/synth` and
`@cosyte/ccda` in your lockfile as well as the seed.

## 5. Add a deprecated code

Documents from older systems carry codes that have since been retired. `generateCcdaQuirk` puts a
deprecated LOINC code in an otherwise clean document, and checks before it returns that
`@cosyte/ccda` raises exactly the warning the quirk is meant to cause. Your code should still read
the document, and the parser should flag the code:

```ts runnable
import { parseCcda } from "@cosyte/ccda";
import { generateCcdaQuirk } from "@cosyte/synth/ccda";

const fixture = generateCcdaQuirk({ seed: 12345, quirk: "deprecated-loinc" });
const doc = parseCcda(fixture.content);

fixture.intendedWarnings; // => ["DEPRECATED_LOINC"]
doc.warnings.map((w) => w.code); // => ["DEPRECATED_LOINC"]
doc.documentType; // => "ccd"
```

## What you built

A reader for C-CDA documents, tested against a CCD and a Referral Note regenerated from a seed, plus
a document with a known deviation and the warning it raises. None of it holds patient data.

## Next

- [Generate C-CDA documents](./guides-ccda.md): every generator and option on the C-CDA subpath.
- [Generate vendor-quirk fixtures](./guides-quirks.md): the other C-CDA quirks, and the parser
  profile that tolerates them.
- [Generator options, kinds and profiles](./generator-options.md): every option and every kind a
  corpus accepts.
