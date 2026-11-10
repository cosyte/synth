---
id: testing-and-quality
title: Testing and quality
sidebar_label: Testing and quality
description: "How we test @cosyte/synth: round trips, property-based tests, fuzzing, an external FHIR validator, cross-engine digests, and the PHI scan, and what each misses."
---

# Testing and quality

This page describes how we test `@cosyte/synth`, what each technique catches, and what it cannot.
The rules every Cosyte package follows (the coverage and mutation floors, the property-based
runners, what a pull request must prove) are written down in the testing standard in
[cosyte/config's decision records](https://github.com/cosyte/config/tree/main/documentation/decisions).
The numbers for the current release are in [Current numbers](#current-numbers) below.

Two failures matter most for a fixture generator: a value realistic enough to pass for a real
person's, and a fixture that is not what it claims to be. Most of what follows is aimed at one of
the two.

## What we run, and what each technique catches

| Technique | What it catches | What it cannot catch |
| --- | --- | --- |
| Unit tests | each documented behavior and each refusal of every generator, provider, and round-trip helper, run against the source | an input nobody thought to write down |
| Round trips | an artifact its own parser does not read back cleanly: every generator's output is parsed by the sibling parser, which must report no warnings and serialize the same bytes | a misreading of a standard that the builder and the parser share |
| Committed fixtures | an unannounced change in output: generated fixtures are committed under `test/fixtures`, and for FHIR, C-CDA, X12, NCPDP, ASTM, and the HL7 v2 quirks a test regenerates each from its seed and compares the bytes | a change to a seed the fixtures do not use; the clean HL7 v2 fixtures, which no test regenerates yet |
| Synthetic-safety properties | a value outside its synthetic source: for arbitrary seeds and every format, each SSN, phone, NPI, DEA number, email, address, and name at a field that carries identity is checked against its source | a field the properties do not read; a source whose cited rule is itself wrong |
| Determinism properties | a generator whose output depends on anything but its seed: the same seed twice gives the same bytes, and different seeds differ | a dependency that is the same within one process, such as the engine version |
| Cross-engine digests | output that differs between Node.js versions: a declared corpus of all six formats is digested on Node.js 22, 24, and 26 in separate jobs, compared, and compared with a committed baseline | an engine outside those three |
| Fuzzing | a crash, a hang, a fixture that is not spec-clean, or a realistic value, found by sweeping seeds, counts, and formats | a wrong but plausible fixture, unless a property states what right is |
| External validator | a FHIR resource the HL7 FHIR validator rejects against US Core 6.1.0, on a seeded corpus, without a terminology server | terminology checks; anything in the other five formats, for which no public validator that runs offline from a file was found |
| Quirk self-checks | a quirk fixture that does not raise exactly its intended warning: every quirk generator parses its own output before it returns | a parser version that changes what it reports, until the fixture is regenerated |
| Diagnostic probes | a value that reaches an error message, a stack, or a result field: a marker is planted in each selector and option on the list of probes, and every diagnostic is searched for it | a position nobody added to the list |
| Coverage gate | code no test runs: lines, branches, functions, and statements, held at a floor overall and for each core folder | a test that runs code without checking what it returns |
| Mutation testing | a test that runs code but would not notice it changing | not yet run on this package; the numbers below say "not measured" until it is |
| Doc samples | a sample on these pages that no longer matches the code: every TypeScript sample is compiled against the package's types and run against the built package, and its `// =>` values are checked | prose that is wrong beside a sample that is right |
| Package checks | a broken published package: every subpath is imported as ESM and required as CommonJS from the build and must give the same output, the type declarations are checked for each module system, and the packed tarball is installed in a clean project | a runtime other than Node.js |
| PHI scan | a realistic patient identifier in a committed file: format-aware checks of the fields that carry identity in all six formats, against a declared allow list of synthetic values | anything in Markdown, which it does not read; it finds a value after it is written, it does not prevent one |

## How each one runs

- **Unit tests, round trips, committed fixtures, properties, quirk self-checks, diagnostic probes,
  and doc samples** run in one Vitest suite on every pull request and on `main`, on Node.js 22, 24,
  and 26. Each property runs a fixed number of cases.
- **The coverage gate** runs with the suite, and a floor that is not met fails the pull request.
- **Fuzzing** runs at its committed size on every pull request, as part of the suite, and every
  night for a time budget, from a seed that changes each night. A failure prints the seed that
  replays it.
- **Cross-engine digests and the external validator** run as their own jobs on every pull request
  and every push to `main`. The validator and the conformance package it grades against are pinned
  by version and by digest.
- **The PHI scan** runs before every commit, on the staged files, and in CI, on every tracked file.
  Because it does not read Markdown, the docs test also refuses a dashed SSN outside the 900 series,
  a phone number outside `555-0100` to `555-0199`, and an email address outside the reserved
  `example` domains on any of these pages.
- **Package checks** run in CI on every pull request.

## Run them yourself

```bash
pnpm install --frozen-lockfile
pnpm test                    # unit tests, round trips, properties, fuzzing at base size, doc samples
pnpm test:coverage           # the same suite with the coverage gate
pnpm phi-scan                # the PHI scan over the repository
pnpm run determinism:digest  # this engine's digests of the declared corpus
pnpm build && pnpm smoke     # ESM and CommonJS import of every subpath

# A longer fuzzing run from a seed you choose:
SYNTH_FUZZ_SEED=1 SYNTH_FUZZ_SECONDS=60 pnpm fuzz

# The external FHIR validator (needs Java and the network):
pnpm run acquire:oracle && pnpm run oracle
```

## Current numbers

The numbers for this section are measured on `main` at each release and filled in when the release
is built. They are never typed by hand.
