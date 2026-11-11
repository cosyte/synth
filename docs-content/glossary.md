---
id: glossary
title: Glossary
sidebar_label: Glossary
description: "The terms these pages use, from archetype and spec-clean to sentinel, floor, corpus and peer, each defined once."
---

# Glossary

The terms these pages use, in alphabetical order. Each links the page that covers it in depth.

## Archetype

The design rules every Cosyte parser shares: a lenient reader that turns recoverable deviations into
warnings with stable codes rather than failures, a conservative serializer that writes spec-clean
output, frozen models, and vendor behavior described in profiles. `@cosyte/synth` is a generator, not
a parser, and keeps the rules that apply to one: its results are frozen, its errors carry stable
codes, and its quirks come from the parsers' profiles.
[How it works](./concepts-archetype.md) explains each.

## Artifact

One generated fixture as a corpus records it: its `format`, its `kind`, its wire text in `content`,
and the codes its parser reported reading it back in `warnings`. See
[`Artifact`](./api/src.md#artifact).

## Corpus

A frozen set of artifacts generated from one seed, with a manifest that lists the formats, the count
of each kind, and the quirks applied. Each format has one (`hl7Corpus`, `fhirCorpus`, and the
others), and the formats with quirks have a quirk corpus too. Regenerating from the same seed, on the
same package versions, gives the same artifacts. See
[Generator options, kinds and profiles](./generator-options.md#corpus-options).

## Floor

Two things on these pages are called a floor.

- **A synthetic-safety floor** is the source a kind of identifying value is drawn from, chosen so
  the value cannot be a real one: SSNs in the 900 series, phone numbers from `555-0100` to
  `555-0199`, NPIs that fail their check digit, and the others.
  [The floors](./limitations.md#the-synthetic-safety-posture-the-floors) lists each, with the
  authority behind it.
- **A quality floor** is the lowest coverage or mutation score CI accepts, recorded in the
  repository's `quality-floor.json`. It only rises. See
  [Testing and quality](./testing-and-quality.md).

## Intended-warning contract

The promise every quirk fixture keeps: a parse with no profile raises exactly the warning codes its
quirk names, no more and no fewer. Each quirk generator parses its own output and throws
[`SYNTH_INTENDED_WARNING_MISMATCH`](./fatal-codes.md#synth_intended_warning_mismatch) rather than
return a fixture that breaks it. A quirk round trip reports it as `intendedWarningHeld`.

## Kind

The label of what an artifact is within its format, such as `ADT^A01`, `USCorePatient`, `ccd`,
`837P`, `B1` or `Result`. A corpus `mix` is a list of kinds.
[Kinds](./generator-options.md#kinds) lists every one.

## Peer

One of the sibling Cosyte packages `@cosyte/synth` builds through: `@cosyte/hl7`, `@cosyte/fhir`,
`@cosyte/ccda`, `@cosyte/x12`, `@cosyte/ncpdp`, `@cosyte/astm`, and `@cosyte/deid`. Each is an
optional peer dependency, needed only for its subpath and loaded the first time a generator uses it.
A missing one throws
[`SYNTH_PEER_NOT_INSTALLED`](./fatal-codes.md#synth_peer_not_installed). See
[Installation](./installation.md).

## Profile

A named set of behavior. A **synth profile** names quirks for a quirk corpus; a **parser profile**
tells a parser which deviations to tolerate; a **US Core profile** is a FHIR `StructureDefinition` a
resource claims. [Profiles](./generator-options.md#profiles) lists each.

## Quirk

A deviation from a standard that real vendor traffic carries and a Cosyte parser's profile system
describes as tolerable, such as a site-defined `Z` segment in HL7 v2. A quirk fixture is an otherwise
spec-clean artifact with one quirk applied. A quirk changes the structure of a fixture, never where
its values come from. The [quirk catalog](./quirk-catalog.md) lists every one.

## Round trip

Serializing an artifact, parsing it with its own parser, and serializing the result again. Each
format has a helper that does it and reports the parser's warnings and whether the bytes came out
the same. The FHIR helper also validates the resource.

## Seed

The number that decides every choice a generator makes. The same seed gives the same bytes on the
same versions of `@cosyte/synth` and the parser, so a test can regenerate its fixture rather than
store it. See [Pin a golden fixture](./guides-overview.md).

## Sentinel

An identifying value in a generated artifact, at a place that holds patient data, that the
`@cosyte/deid` pairing loop tracks, such as a name from the invented-name pool, a `555-01xx` phone
number, or an identifier under the synthetic assigning authority. The loop
de-identifies the artifact and fails if any sentinel is still in the output. See
[Check a de-identifier with the pairing loop](./guides-deid.md).

## Spec-clean

What a round trip reports when its parser reads the artifact with no warnings and serializes it back
to the same bytes. For FHIR, spec-clean means the resource validates with no error or fatal issue
and serializes back to the same bytes. It is the parser's judgment of our output, so it cannot catch
a misreading of a standard the builder and the parser share.
[Who checks the output](./limitations.md#who-checks-the-output-and-who-does-not) says which formats
an outside validator also grades.

## Synthetic by construction

No code path emits an identifying value from anywhere but a reserved range or the shipped pool of
invented names, so no fixture can hold a real person's data. The floors above are how.

## Test-data marker

The field a format's own standard defines for saying a message is test data, set on every artifact
whose format has one: `MSH-11` in HL7 v2, the `HTEST` security label in FHIR, `ISA-15` in X12, and
field 12 of the ASTM `H` record. See
[the marker table](./limitations.md#the-synthetic-safety-posture-the-floors).
