---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
description: "Why output can change between runs, a missing parser package, an unsupported request, and whether generated output is safe to commit and log."
---

# Troubleshooting

Common questions when generating fixtures with `@cosyte/synth`.

## "I got a different message than last run"

Check the seed first. The same seed gives byte-identical output, and `synth` passes a seeded control
ID and timestamp to each builder so nothing depends on the clock:

```ts runnable
import { generateAdt } from "@cosyte/synth/hl7";

generateAdt({ seed: 5 }).toString() === generateAdt({ seed: 5 }).toString(); // => true
```

If the seed is the same, a version moved. A `synth` release can change the bytes a seed maps to,
and when it does, its changelog entry says so under "Output change" and names each format. A parser
upgrade can change them with `synth` unchanged, because each format's bytes come from that parser's
builder. Pin the seed, the `synth` version, and the parser versions together;
[Pin a golden fixture](./guides-overview.md) shows how.

## "Cannot find module @cosyte/hl7"

Each format subpath needs its parser installed, as an optional peer dependency:
`@cosyte/synth/hl7` needs `@cosyte/hl7`, `@cosyte/synth/fhir` needs `@cosyte/fhir`, and so on. The
package root (`@cosyte/synth`) needs none: import from there if you only need the seeded generator
and the value providers.

`@cosyte/synth/deid` loads `@cosyte/deid`, `@cosyte/hl7`, `@cosyte/fhir`, `@cosyte/ccda`,
`@cosyte/x12`, and `@cosyte/ncpdp` as soon as it is imported, so all six must be installed even if
you call one loop. [Installation](./installation.md) has the table.

## "instanceof is false for a generated value"

A generated `CcdaDocument`, or any other parser class instance, should pass `instanceof` against the
class your code imports from the parser. Three setups break that, each by loading a second copy of the
parser:

- Node.js older than 22.12, which this package does not support. Upgrade Node.js.
- Deno's test runner, where `import.meta.resolve` throws `TypeError: Invalid arguments`, or a
  runtime whose `import.meta.resolve` answers with a URL that is not a `file:` URL. The generator
  then loads the parser by name through `require`, which takes the parser's CommonJS entry:
  generation works, and a returned value is an instance of the CommonJS copy of the parser's
  classes. Any other error from `import.meta.resolve`, such as a parser that is not installed, is
  thrown as it is.
- A bundle that inlines a parser, or `@cosyte/synth`, while the generator loads the installed
  parser. Mark `@cosyte/synth` and each `@cosyte/*` parser external; see
  [Bundle an application that uses it](./installation.md#bundle-an-application-that-uses-it).

## An unsupported request threw

A generator has nothing to tolerate, so a request it cannot honor throws a `SynthError` with a
stable code, rather than return a mislabelled fixture:

```ts runnable throws
import { defineSynthProfile } from "@cosyte/synth";

// A blank profile name is refused: this block throws a SynthError with the code
// SYNTH_INVALID_PROFILE, and the docs test checks that it does.
defineSynthProfile({ name: "" });
```

The codes you are most likely to see:

- [`SYNTH_UNSUPPORTED_KIND`](./fatal-codes.md#synth_unsupported_kind): a message kind, document
  type, `mix` entry, variant, Bundle type, or US Core profile name outside the set that option
  accepts. The option's type in the [API reference](./api/README.md) lists the set.
- [`SYNTH_UNSUPPORTED_QUIRK`](./fatal-codes.md#synth_unsupported_quirk): a quirk name outside the
  format's registry. `Object.keys(HL7_QUIRKS)` (or `CCDA_QUIRKS`, `ASTM_QUIRKS`) lists them.
- [`SYNTH_PROFILE_NOT_GENERATED`](./fatal-codes.md#synth_profile_not_generated): a US Core
  profile the guide publishes and we do not generate yet.
- [`SYNTH_INTENDED_WARNING_MISMATCH`](./fatal-codes.md#synth_intended_warning_mismatch): a quirk
  fixture did not raise exactly its intended warning, which can happen when a parser version changes
  what it reports.

Every message comes from the frozen `SYNTH_FATAL_MESSAGES` table, keyed by code. It says which rule
refused and does not quote the request: `SynthError` takes a code and nothing else. Branch on
`err.code`, and read the value you passed off your own arguments; the stack names the call.
[Fatal codes](./fatal-codes.md) lists every code.

## A pairing loop threw a TypeError

`x12DeidLoop({ variant })` and `ncpdpTelecomDeidLoop({ transaction })` throw a plain `TypeError` for
a value outside their union, rather than a `SynthError`. Check the value against `X12DeidVariant`
(`"837P"`, `"837I"`, `"837D"`, `"271"`, `"835"`) or `NcpdpTelecomVariant` (`"B1"`, `"B2"`, `"B3"`).

## Is the generated output safe to commit and log?

Yes; that is the purpose of the package. Every value comes from a reserved range or the invented-name
pool, and the test suite's synthetic-safety properties check that for arbitrary seeds and every
format. You can commit a generated corpus as a fixture without a PHI review of its contents.

The diagnostics are safe for a different reason. Output is safe because of where its values come
from. A diagnostic is safe because it holds no value at all: a fatal message is a fixed string, a
selector you pass is checked against its closed set before it goes anywhere, and a round-trip result
keeps only the parser's warning codes.

What that does not cover: a value you pass to a generator is your value, and it goes into the
artifact you asked for; `content` is the fixture, not a diagnostic. And if you hand a document you
wrote to a round-trip helper and the sibling parser cannot read it, the error you catch is that
parser's own, passed through unchanged.

## Where the limits are

All six formats generate (HL7 v2, FHIR, C-CDA, X12, NCPDP, and ASTM), with vendor quirks for HL7
v2, C-CDA, and ASTM, and the pairing loop for HL7 v2, FHIR, C-CDA, X12, and NCPDP Telecom.
[What it does and does not do](./limitations.md) is the full account: `synth` is a format and
conformance generator, not a clinical simulator; every value is synthetic by construction; output
is the same for a seed within a version window; and no terminology is bundled.
