---
id: installation
title: Installation
sidebar_label: Installation
description: "Install @cosyte/synth and the parser packages for the formats you generate, and check the Node.js versions it supports."
---

# Installation

## Prerequisites

- Node.js 22.12 or later. CI tests on Node.js 22.12, 22, 24, and 26. A generator loads its parser
  on first use through `require`, and Node.js loads an ES module that way only from 22.12, so on
  22.12 and later a value a generator returns is an instance of the parser classes your code
  imports, whether it uses `import` or `require`.
- A package manager: npm, pnpm, or Yarn.

## Install the package and the parsers you need

`@cosyte/synth` builds each format through its sibling parser, and each parser is an optional peer
dependency. Install the package with the parsers for the formats you generate:

```bash
npm install @cosyte/synth @cosyte/hl7
```

| You import            | Install alongside `@cosyte/synth`                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `@cosyte/synth`       | nothing: the seeded generator, the value providers, and the checks                                |
| `@cosyte/synth/hl7`   | `@cosyte/hl7`                                                                                     |
| `@cosyte/synth/fhir`  | `@cosyte/fhir`                                                                                    |
| `@cosyte/synth/ccda`  | `@cosyte/ccda`                                                                                    |
| `@cosyte/synth/x12`   | `@cosyte/x12`                                                                                     |
| `@cosyte/synth/ncpdp` | `@cosyte/ncpdp`                                                                                   |
| `@cosyte/synth/astm`  | `@cosyte/astm`                                                                                    |
| `@cosyte/synth/deid`  | `@cosyte/deid`, `@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`, `@cosyte/x12`, and `@cosyte/ncpdp` |

Importing a subpath loads no parser: each is loaded the first time a generator needs it. Each loop
of the `deid` subpath needs `@cosyte/deid` and the parser of its own format, so install those for
the loops you call: `hl7DeidLoop` needs `@cosyte/hl7`, `fhirDeidLoop` `@cosyte/fhir`,
`ccdaDeidLoop` `@cosyte/ccda`, `x12DeidLoop` `@cosyte/x12`, and `ncpdpTelecomDeidLoop`
`@cosyte/ncpdp`. The table's row is what all five loops need together. Each parser peer is declared
at `^0.1`, and `@cosyte/deid` at `^0.1.5 || ^0.2.0`, so either release line installs beside it.

Under Bun, a project with no `node_modules` folder works differently: Bun installs a package it
cannot find while the program runs, so a missing parser is downloaded and loaded rather than
reported. Install the parsers you use, so the versions that run are the ones you chose.

To install every format at once:

```bash
npm install @cosyte/synth @cosyte/hl7 @cosyte/fhir @cosyte/ccda @cosyte/x12 @cosyte/ncpdp @cosyte/astm @cosyte/deid
```

Pin the exact version. Below 1.0 a breaking change can ship in a patch release, so a caret range
(`^0.1.x`) does not protect you from one. Install with `--save-exact` (pnpm takes the same flag;
Yarn's is `--exact`) and read the changelog before you move the pin:

```bash
npm install --save-exact @cosyte/synth
```

The package has no third-party runtime dependencies. It ships ESM and CommonJS builds, each with its
own type declarations, so `import` and `require` both work without configuration.

## Bundle an application that uses it

A bundler cannot follow the first-use load: the generator `require`s its parser at run time, by a
name the bundler does not see. If you bundle code that imports `@cosyte/synth`, mark
`@cosyte/synth` and each `@cosyte/*` parser you use as external, and install them in the
`node_modules` the bundle runs beside:

- esbuild: `--external:@cosyte/*`, or `external: ["@cosyte/*"]` in the build options.
- Rollup: `external: [/^@cosyte\//]`; in Vite, the same under `build.rollupOptions`.
- webpack: an `externals` entry for `@cosyte/synth` and for each `@cosyte/*` parser.

If the bundle inlines a parser while the generator loads the installed one, your code and the
generator hold two copies of that parser, and `instanceof` against its classes is false. If the
parser is not installed beside the bundle at all, the first generator call that needs it throws a
`SynthError` with the code `SYNTH_PEER_NOT_INSTALLED`, naming the parser and its install command.

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

If the call throws a `SynthError` with the code `SYNTH_PEER_NOT_INSTALLED`, the parser for that
subpath is missing; the message names it and the command that installs it. See
[Troubleshooting](./troubleshooting.md#a-parser-is-not-installed).

## Next

The [Quickstart](./quickstart.md) generates a first message, draws a synthetic value, and builds a
reproducible corpus.
