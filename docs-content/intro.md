---
id: intro
title: Getting started
sidebar_position: 1
---

# @cosyte/synth

Parse real-world, vendor-quirky Synthetic Data and pull fields out in one line — without reading the spec.
`@cosyte/synth` is a zero-dependency TypeScript toolkit following the cosyte parser archetype: a lenient
parser, an immutable model, a spec-clean serializer, and a profile system for vendor quirks. It
mirrors the API shape of the reference parser, `@cosyte/hl7`.

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. This page describes the scaffold; the
> real parser lands in subsequent phases.

## Install

```bash
npm install @cosyte/synth
```

## Parse a message

```ts
import { parseSynth } from "@cosyte/synth";

const result = parseSynth(raw);

result.warnings; // stable, positional tolerance warnings
```

The parser is **lenient by default** — vendor quirks become warnings, not failures — while the
serializer always emits spec-clean output (Postel's Law). A `{ strict: true }` mode (to be added)
escalates every tolerated deviation to a thrown error.

## Next

- Read the **API reference** for every export, generated from source.
