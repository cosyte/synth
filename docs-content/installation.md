---
id: installation
title: Installation
sidebar_position: 1
---

# Installation

`@cosyte/synth` is a TypeScript package for Node.js with **zero third-party runtime dependencies** in
its core. It ships dual **ESM + CJS** builds with per-condition type declarations, so it works from
either module system without configuration.

> **Status:** pre-alpha (`0.0.x`), published to npm. The version shown on the npm package page is the
> one that is live; this page never repeats it.

## Prerequisites

- **Node.js >= 22** (the whole `@cosyte/*` suite targets ES2023 / Node 22+).
- A package manager: `pnpm`, `npm`, or `yarn`.

## Install

```bash
npm install @cosyte/synth @cosyte/hl7
```

`@cosyte/hl7` is an **optional peer dependency**, needed only for the `@cosyte/synth/hl7` subpath
(HL7 v2 generation). Each format is a lazily-loaded subpath, so importing the package **core**
(`@cosyte/synth`) never pulls a parser: a consumer who only needs the seeded PRNG and the safe
providers installs nothing extra.

## Smoke test

Confirm the package resolves and its version symbol is present:

```ts runnable
import { VERSION } from "@cosyte/synth";

typeof VERSION; // => "string"
```

`VERSION` is the version of the package you installed. It is written from the manifest at release
time, so it always names the release npm actually served you rather than a number left behind by an
earlier one. This check asserts the value's **type** rather than the value itself, deliberately, so
that this page never has to name a version and go stale on the next publish.

If that resolves, the install is good. Head to the [Quickstart](./quickstart).
