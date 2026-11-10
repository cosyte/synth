---
id: performance
title: Performance
sidebar_label: Performance
description: "What we measure on @cosyte/synth and how, what each call costs in work, and how to time generation on your own machine."
---

# Performance

This page describes what we measure on `@cosyte/synth`, how, and how to time it yourself. The
shared method every Cosyte package follows (throughput, latency percentiles, memory, import time and
bundle size, and how a pull request is compared with `main`) is written down in the performance
standard in
[cosyte/config's decision records](https://github.com/cosyte/config/tree/main/documentation/decisions).
The numbers for the current release are in [Current numbers](#current-numbers) below.

## What we measure

We do not run benchmarks on `@cosyte/synth` yet, and no CI job guards its speed. The performance
standard names what a benchmark measures: throughput, latency at the 50th, 95th, and 99th
percentiles, peak memory, import time, and bundle size. For this package, each of those reads "not
measured" in the section below until a benchmark runs on it.

## What each call does

The work behind a call depends on which kind of call it is:

- **A generator** (`generateAdt`, `generatePatient`, `generate837P`, and the others) draws its
  values and calls the parser's builder. It does not read its output back through the parser.
- **A round-trip helper** (`roundTrip`, `scriptRoundTrip`, `astmRoundTrip`, and the others)
  serializes the artifact, parses it with the sibling parser, and serializes the parsed result
  again. The FHIR helper also validates the resource.
- **A corpus** (`hl7Corpus`, `fhirCorpus`, and the others) runs a generator and a round trip for
  every artifact, so it costs more per artifact than calling a generator alone.
- **A quirk generator** builds a clean artifact, applies the quirk, and parses the result once to
  check the intended warning.
- **A pairing loop** in `@cosyte/synth/deid` generates an artifact and runs `@cosyte/deid` over it.

If a test needs many fixtures and does not need their warnings, call a generator in a loop rather
than build a corpus.

## Import cost

The package root (`@cosyte/synth`) imports no parser. Each format subpath imports only its own
parser, except `@cosyte/synth/deid`, which imports `@cosyte/deid` and five parsers. Import only the
subpaths you use.

## What these numbers are not

- **Not a guarantee for your machine.** Absolute times depend on the hardware and its load.
- **Not a comparison with other libraries.** That is a separate suite with its own written method.
- **Not a load-testing tool.** A seeded corpus is a fine input for a throughput test of your own
  code, but `synth` ships no benchmark runner.

## Time it yourself

This program times one corpus of each HL7 v2 family on your machine. It prints the time and checks
only that the corpus was built:

```ts runnable
import { hl7Corpus } from "@cosyte/synth/hl7";

const start = performance.now();
const corpus = hl7Corpus({ seed: 1, count: 70 });
const elapsed = performance.now() - start;

console.log(`${String(corpus.artifacts.length)} messages in ${elapsed.toFixed(1)} ms`);
corpus.artifacts.length; // => 70
```

## Current numbers

The numbers for this section are measured on `main` at each release and filled in when the release
is built. They are never typed by hand.
