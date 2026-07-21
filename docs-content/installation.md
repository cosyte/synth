---
id: installation
title: Installation
sidebar_position: 1
---

# Installation

`@cosyte/synth` is a TypeScript package for Node.js with **zero third-party runtime dependencies** in
its core. It ships dual **ESM + CJS** builds with per-condition type declarations, so it works from
either module system without configuration.

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. The command below is the shape it will take
> at first publish; until then, consume it from source or a workspace link.

## Prerequisites

- **Node.js >= 22** (the whole `@cosyte/*` suite targets ES2023 / Node 22+).
- A package manager — `pnpm`, `npm`, or `yarn`.

## Install

```bash
npm install @cosyte/synth @cosyte/hl7
```

`@cosyte/hl7` is an **optional peer dependency**, needed only for the `@cosyte/synth/hl7` subpath
(HL7 v2 generation). Each format is a lazily-loaded subpath, so importing the package **core**
(`@cosyte/synth`) never pulls a parser — a consumer who only needs the seeded PRNG and the safe
providers installs nothing extra.

## Smoke test

Confirm the package resolves and its version symbol is present:

```ts runnable
import { VERSION } from "@cosyte/synth";

typeof VERSION; // => "string"
```

If that resolves, the install is good — head to the [Quickstart](./quickstart).
