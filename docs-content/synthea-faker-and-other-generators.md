---
id: synthea-faker-and-other-generators
title: Synthea, faker and other generators
sidebar_label: Synthea, faker and others
description: "How @cosyte/synth differs from Synthea, faker-style libraries, fhir-test-data, carebundle and hl7gen, and when one of them fits better."
---

# Synthea, faker and other generators

`@cosyte/synth` is one of several ways to get healthcare test data. This page sets out what it is
built for, what the other tools we know of are built for, and when one of them fits better. We have
not run the other tools: what this page says of each comes from its own repository's description and
README, read on 2026-11-11, and each name links there so you can check it.

## What synth is built for

`@cosyte/synth` makes fixtures for testing code that reads or writes healthcare formats. Its
randomness is structural: which message type, which fields are filled, which vendor deviation is
applied. Three things decide its design:

- **Six formats, each through its parser.** It generates HL7 v2, FHIR R4 and US Core, C-CDA, X12,
  NCPDP and ASTM, each built through the Cosyte parser for that format and read back by it.
- **The same bytes for a seed.** A test can regenerate its fixture instead of storing it, on the
  same package versions.
- **Values that cannot be real.** Every identifying value comes from a reserved range or a pool of
  invented names, so a fixture can go in a public repository or a CI log.

It is not built to be clinically coherent. A generated lab result pairs a code and a value with no
claim that they make sense together, and a set of generated patients is not representative of any
population. [What it does and does not do](./limitations.md) is the full list.

## Synthea

[Synthea](https://github.com/synthetichealth/synthea), from MITRE, calls itself a synthetic patient
population simulator. It simulates each patient from birth to death, with encounters, conditions,
medications, results and procedures, and its demographics default to Massachusetts census data. It
writes FHIR (R4, STU3 and DSTU2), bulk FHIR as ndjson, C-CDA, CSV and CPCDS. It is written in Java,
needs JDK 17 or later, takes a seed on its command line, and is licensed under Apache 2.0.

That is the opposite trade from ours. Synthea gives a believable history for each patient and a
population shaped like a real one; we give a message or document of the type you ask for, a known
vendor deviation when you want one, and the same bytes on every run. Choose Synthea for research,
analytics, demonstrations, or any test that needs clinical sense across a patient's records. Choose
`@cosyte/synth` for testing an interface or a parser, or for HL7 v2, X12, NCPDP or ASTM, which
Synthea's README does not list among its formats. The two can sit in one test suite.
`@cosyte/synth` does not read Synthea output.

## Faker-style libraries

A faker library generates values of many kinds for any domain. [`@faker-js/faker`](https://github.com/faker-js/faker)
generates names, addresses, dates, finance and commerce data, numbers and strings, in more than 70
locales, in the browser and in Node.js. It knows nothing of a healthcare format: building an HL7 v2
message, a FHIR resource or an X12 claim around its values, and getting the structure right, is left
to you.

The bigger difference is in the values. Its README says Faker "tries to generate realistic data and
not obvious fake data", and that the names, addresses, emails and phone numbers it generates "might
be coincidentally valid information". That suits a demonstration or a user interface. For a fixture
that stands in for a patient, we take the other side: every value comes from a range reserved so it
cannot be real, such as phone numbers from `555-0100` to `555-0199` and NPIs that fail their check
digit. If you build fixtures from another library's values, the checks in
[Draw synthetic values for your own fixtures](./draw-synthetic-values.md) (`isSyntheticPhone`,
`isSyntheticNpi` and the others) work on any value, whatever produced it.

## Other healthcare generators

These are the generators we found that overlap with part of what `@cosyte/synth` does.

| Project | Language and license | Formats | What its README says it is built for |
| --- | --- | --- | --- |
| [fhir-test-data](https://github.com/dnlbox/fhir-test-data) | TypeScript, MIT | FHIR R4, R4B and R5 | Valid FHIR resources with identifiers for 14 countries, seeded and deterministic, as a command-line tool and a library |
| [carebundle](https://github.com/27jackson08/fhirfaker) | Python, Apache 2.0 | FHIR R4 | Clinically coherent FHIR R4 Bundles conforming to US Core 6.1.0, byte-identical for a seed, for use inside a test |
| [hl7gen](https://github.com/mwaseem75/hl7gen) | Python, MIT | HL7 v2.5 | Generating, validating and sending HL7 v2 messages of about 185 types, and converting common ones to FHIR |

How each differs from `@cosyte/synth`, by its own README:

- **fhir-test-data** covers FHIR versions we do not (R4B and R5) and identifiers for 14 countries.
  Its README says generated identifiers "always pass the official algorithm for their country", and
  for the United States that includes the NPI's Luhn check. Ours are built to fail that check, so a
  generated NPI cannot be an issued one. It also uses real LOINC
  and SNOMED CT codes in clinically plausible ranges, and can inject faults into a resource for
  testing a validator. We generate FHIR R4 with US Core, from a small pool of example codes, beside
  five other formats.
- **carebundle** aims for clinical coherence, calibrated to published population statistics, as
  Synthea does at a smaller scale and in Python. Much of the rest is close to ours: it is
  byte-identical for a seed, validates against US Core 6.1.0, labels every resource `HTEST`, keeps
  SSN-style identifiers in the 900 series, and gives practitioners NPIs that fail their check digit.
  It covers FHIR alone, where we cover six formats.
- **hl7gen** generates any of about 185 HL7 v2.5 message types where we generate seventeen, and adds
  validation, sending over TCP, and conversion to FHIR. It fills values with Faker, or with a patient
  persona from Claude when you supply an Anthropic API key. Its README does not describe seeding or
  values from reserved ranges.

None of the three generates C-CDA, X12, NCPDP or ASTM.

## When to choose which

- A clinically coherent patient history or population: Synthea, or carebundle for FHIR in Python.
- FHIR R4B or R5, or identifiers outside the United States: fhir-test-data.
- Many HL7 v2 message types, or messages sent to a live listener: hl7gen.
- Realistic values for a domain that is not a healthcare format: a faker library.
- Fixtures in any of the six formats, regenerated from a seed, with values that cannot be real and
  vendor deviations that raise a known warning: `@cosyte/synth`.

## Related

- [What it does and does not do](./limitations.md): the promise and its edges.
- [How it works](./concepts-archetype.md): why every fixture is synthetic by construction.
- How-to guides that apply it: [Pin a golden fixture](./pin-a-golden-fixture.md),
  [Generate vendor-quirk fixtures](./guides-quirks.md), and
  [Draw synthetic values for your own fixtures](./draw-synthetic-values.md).
