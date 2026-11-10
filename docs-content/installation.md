---
id: installation
title: Installation
sidebar_label: Installation
description: "Install @cosyte/synth and the parser packages for the formats you generate, and check the Node.js versions it supports."
---

# Installation

## Prerequisites

- Node.js 22 or later. CI tests on Node.js 22, 24, and 26.
- A package manager: npm, pnpm, or Yarn.

## Install the package and the parsers you need

`@cosyte/synth` builds each format through its sibling parser, and each parser is an optional peer
dependency. Install the package with the parsers for the formats you generate:

```bash
npm install @cosyte/synth @cosyte/hl7
```

| You import            | Install alongside `@cosyte/synth`                                        |
| --------------------- | ------------------------------------------------------------------------ |
| `@cosyte/synth`       | nothing: the seeded generator, the value providers, and the checks       |
| `@cosyte/synth/hl7`   | `@cosyte/hl7`                                                            |
| `@cosyte/synth/fhir`  | `@cosyte/fhir`                                                           |
| `@cosyte/synth/ccda`  | `@cosyte/ccda`                                                           |
| `@cosyte/synth/x12`   | `@cosyte/x12`                                                            |
| `@cosyte/synth/ncpdp` | `@cosyte/ncpdp`                                                          |
| `@cosyte/synth/astm`  | `@cosyte/astm`                                                           |
| `@cosyte/synth/deid`  | `@cosyte/deid`, `@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`, `@cosyte/x12`, and `@cosyte/ncpdp` |

The `deid` subpath loads all five parsers it pairs as soon as it is imported, so all five must be
installed even if you call only one of its loops. Each peer is declared at `^0.1`.

To install every format at once:

```bash
npm install @cosyte/synth @cosyte/hl7 @cosyte/fhir @cosyte/ccda @cosyte/x12 @cosyte/ncpdp @cosyte/astm @cosyte/deid
```

The package has no third-party runtime dependencies. It ships ESM and CommonJS builds, each with its
own type declarations, so `import` and `require` both work without configuration.

## Check the install

```ts runnable
import { VERSION } from "@cosyte/synth";

typeof VERSION; // => "string"
```

`VERSION` is the version of the package you installed, written from its manifest at release. The
check asserts its type rather than its value so this page never names a version.

To check a format subpath, generate one artifact from it:

```ts runnable
import { generateAdt, roundTrip } from "@cosyte/synth/hl7";

roundTrip(generateAdt({ seed: 1 })).specClean; // => true
```

If the import fails with "Cannot find module", the parser for that subpath is missing; see
[Troubleshooting](./troubleshooting.md#cannot-find-module-cosytehl7).

## Next

The [Quickstart](./quickstart.md) generates a first message, draws a synthetic value, and builds a
reproducible corpus.
