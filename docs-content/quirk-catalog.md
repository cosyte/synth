---
id: quirk-catalog
title: Quirk catalog
sidebar_label: Quirk catalog
description: "Every vendor quirk @cosyte/synth generates, by format: the warning a bare parse raises, the built-in parser profile that tolerates it, and what grounds it."
---

# Quirk catalog

Every quirk below changes the structure of an otherwise clean fixture so that a parse with no
profile raises exactly the listed warning code. Where a built-in, public parser profile claims the
deviation, a parse under that profile either drops the warning (suppressed) or replaces it with
`PROFILE_QUIRK_APPLIED` (re-badged). A quirk with no tolerating profile is bare.

The registries are exported: `HL7_QUIRKS` from `@cosyte/synth/hl7`, `CCDA_QUIRKS` from
`@cosyte/synth/ccda`, and `ASTM_QUIRKS` from `@cosyte/synth/astm`. Each entry carries the same
facts as a row here, with its grounding in full.

## HL7 v2

| Quirk              | Bare parse raises         | Tolerated by          | Under the profile | Grounding                                                                                       |
| ------------------ | ------------------------- | --------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `unknown-zsegment` | `UNKNOWN_SEGMENT`         | `visage`              | suppressed        | Site-defined `Z` segments; `@cosyte/hl7`'s public imaging profiles declare the `ZDS` segment   |
| `unknown-escape`   | `UNKNOWN_ESCAPE_SEQUENCE` | none                  | bare              | A locally defined `\Z..\` escape, kept verbatim and flagged; no HL7 v2 profile re-badges it    |

## C-CDA

| Quirk                       | Bare parse raises           | Tolerated by     | Under the profile | Grounding                                                                                          |
| --------------------------- | --------------------------- | ---------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `template-extension-absent` | `TEMPLATE_EXTENSION_ABSENT` | `legacyR11`      | re-badged         | Older documents omit the R2.1 `extension` version stamp on a template ID                          |
| `deprecated-loinc`          | `DEPRECATED_LOINC`          | `smartScorecard` | re-badged         | Real documents carry deprecated LOINC codes, as the SMART C-CDA Scorecard found                    |
| `deprecated-code-system`    | `DEPRECATED_CODE_SYSTEM`    | `smartScorecard` | re-badged         | Older problem lists code diagnoses in ICD-9-CM, as the SMART C-CDA Scorecard found                 |

## ASTM

| Quirk                 | Bare parse raises              | Tolerated by      | Under the profile | Grounding                                                                                                   |
| --------------------- | ------------------------------ | ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `unknown-escape`      | `ASTM_UNKNOWN_ESCAPE_SEQUENCE` | `referenceCorpus` | re-badged         | A non-standard `&Z&` escape, kept verbatim and flagged; the profile is grounded in public open-source corpora |
| `unknown-record-type` | `ASTM_RECORD_UNKNOWN_TYPE`     | none              | bare              | E1394 allows manufacturer and site record types; a `Z` record is flagged. A profile you write can re-badge it |

## Read a registry entry

```ts runnable
import { CCDA_QUIRKS } from "@cosyte/synth/ccda";

const quirk = CCDA_QUIRKS["deprecated-loinc"];
quirk.intendedWarnings; // => ["DEPRECATED_LOINC"]
quirk.toleratingProfile; // => "smartScorecard"
quirk.disposition; // => "rebadged"
```

## Not in the catalog

- Quirks for FHIR, X12, and NCPDP.
- Any quirk that would need a private, vendor-attributed corpus to ground it.
- ASTM frame-layer faults (a wrong checksum, framing dropped over TCP): they raise diagnostics no
  parser profile tolerates.

## Related

- [Generate vendor-quirk fixtures](./guides-quirks.md): how to generate each of these.
- Reference: [`HL7_QUIRKS`](./api/src/hl7.md#hl7_quirks), [`CCDA_QUIRKS`](./api/src/ccda.md#ccda_quirks),
  [`ASTM_QUIRKS`](./api/src/astm.md#astm_quirks), and
  [`QuirkDescriptor`](./api/src.md#quirkdescriptor).
